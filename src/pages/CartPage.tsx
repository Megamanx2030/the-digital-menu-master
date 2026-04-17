import { useParams, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Minus, Plus, ArrowLeft, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending'; attempt: number; nextRetryInMs?: number }
  | { kind: 'failed' };

const RETRY_DELAYS_MS = [5000, 10000, 20000, 40000];
const MAX_TOTAL_MS = 120_000; // 2 minutos
const PER_ATTEMPT_TIMEOUT_MS = 10_000; // timeout por tentativa

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout de tentativa')), ms);
    promise.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });

const CartPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, updateQuantity, updateObservacoes, removeItem, totalPrice, clearCart } = useCart();
  const [sendState, setSendState] = useState<SendState>({ kind: 'idle' });
  const cancelledRef = useRef(false);

  // Se o usuário fechar a aba antes da confirmação, descarta tudo (não retoma em background).
  useEffect(() => {
    const handleUnload = () => {
      cancelledRef.current = true;
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      // Ao desmontar (navegação), também marca como cancelado para evitar retries órfãos
      cancelledRef.current = true;
    };
  }, []);

  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  const trySendOnce = async () => {
    const { data: mesa, error: mesaErr } = await supabase
      .from('mesas')
      .select('id')
      .eq('numero', Number(id))
      .single();
    if (mesaErr || !mesa) throw mesaErr || new Error('Mesa não encontrada');

    const { data: pedido, error: pedErr } = await supabase
      .from('pedidos')
      .insert({ mesa_id: mesa.id, status: 'novo' })
      .select()
      .single();
    if (pedErr || !pedido) throw pedErr || new Error('Falha ao criar pedido');

    const itens = items.map(item => ({
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco,
      observacoes: item.observacoes || null,
    }));

    const { error: itensErr } = await supabase.from('itens_pedido').insert(itens);
    if (itensErr) throw itensErr;

    return pedido;
  };

  const handleConfirm = async () => {
    if (sendState.kind === 'sending') return;
    cancelledRef.current = false;
    const startedAt = Date.now();
    let attempt = 0;

    while (true) {
      if (cancelledRef.current) return;
      attempt += 1;
      setSendState({ kind: 'sending', attempt });

      try {
        const pedido = await trySendOnce();
        if (cancelledRef.current) return;
        clearCart();
        // Limpa rascunhos locais, se houver
        try {
          localStorage.removeItem('tcc:pending-order');
        } catch {}
        setSendState({ kind: 'idle' });
        navigate(`/mesa/${id}/confirmacao`, {
          state: { pedidoId: pedido.id, numeroPedido: pedido.numero_pedido },
        });
        return;
      } catch (err) {
        const elapsed = Date.now() - startedAt;
        const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];

        // Se a próxima tentativa já estouraria os 2 minutos, desiste.
        if (elapsed + delay >= MAX_TOTAL_MS) {
          try {
            localStorage.removeItem('tcc:pending-order');
          } catch {}
          setSendState({ kind: 'failed' });
          return;
        }

        setSendState({ kind: 'sending', attempt, nextRetryInMs: delay });
        await sleep(delay);
        if (cancelledRef.current) return;
      }
    }
  };

  if (items.length === 0 && sendState.kind === 'idle') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center w-full max-w-full lg:max-w-[430px] mx-auto px-6">
        <p className="text-muted-foreground font-body text-xl mb-4">Carrinho vazio</p>
        <button onClick={() => navigate(`/mesa/${id}`)} className="text-primary font-body font-semibold underline text-lg">
          Voltar ao Menu
        </button>
      </div>
    );
  }

  const isSending = sendState.kind === 'sending';
  const isFailed = sendState.kind === 'failed';

  return (
    <div className="min-h-screen bg-background w-full max-w-full lg:max-w-[430px] mx-auto pb-40">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(`/mesa/${id}`)} className="text-foreground p-1" disabled={isSending}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Seu Pedido</h1>
      </div>

      {/* Items */}
      <div className="px-4 pt-4 space-y-4">
        {items.map((item, i) => (
          <motion.div
            key={item.produto_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-2xl border border-border p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4 flex-1">
                {item.imagem_url && (
                  <img src={item.imagem_url} alt={item.nome} className="w-24 h-24 rounded-xl object-cover" />
                )}
                <div className="flex-1">
                  <h3 className="font-body font-bold text-foreground text-lg leading-tight">{item.nome}</h3>
                  <p className="text-base text-muted-foreground mt-1">
                    R$ {item.preco.toFixed(2).replace('.', ',')} un.
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeItem(item.produto_id)}
                disabled={isSending}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <span className="font-body font-bold text-primary text-lg">
                R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div className="flex items-center justify-between mt-3 w-full bg-secondary rounded-full px-2 py-1.5">
              <button
                onClick={() => updateQuantity(item.produto_id, item.quantidade - 1)}
                disabled={isSending}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-background shadow-sm flex items-center justify-center disabled:opacity-50"
              >
                <Minus className="w-5 h-5 text-foreground" />
              </button>
              <span className="text-xl font-body font-bold text-foreground min-w-[32px] text-center tabular-nums">
                {item.quantidade}
              </span>
              <button
                onClick={() => updateQuantity(item.produto_id, item.quantidade + 1)}
                disabled={isSending}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-primary shadow-sm flex items-center justify-center disabled:opacity-50"
              >
                <Plus className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>

            <textarea
              placeholder="Observações (ex: sem cebola, bem passado)"
              value={item.observacoes}
              onChange={e => updateObservacoes(item.produto_id, e.target.value)}
              disabled={isSending}
              rows={2}
              className="mt-3 w-full bg-secondary text-foreground text-base rounded-xl px-4 py-3 placeholder:text-muted-foreground border-0 outline-none focus:ring-1 focus:ring-primary font-body resize-none disabled:opacity-60"
            />
          </motion.div>
        ))}
      </div>

      {/* Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="w-full max-w-full lg:max-w-[430px] mx-auto bg-card border-t border-border px-4 py-5 space-y-3">
          <AnimatePresence mode="wait">
            {isSending && (
              <motion.div
                key="sending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3"
              >
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="font-body font-semibold text-foreground text-sm">
                    📤 Enviando seu pedido...
                  </p>
                  {sendState.attempt > 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tentativa {sendState.attempt} — conexão instável, aguarde
                    </p>
                  )}
                </div>
              </motion.div>
            )}
            {isFailed && (
              <motion.div
                key="failed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-body font-semibold text-foreground text-sm">
                    Não conseguimos enviar seu pedido.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por favor, chame um atendente.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <span className="text-lg text-muted-foreground font-body">Total</span>
            <span className="text-2xl font-display font-bold text-foreground">
              R$ {totalPrice.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <motion.button
            whileTap={!isSending && !isFailed ? { scale: 0.97 } : undefined}
            onClick={isFailed ? () => setSendState({ kind: 'idle' }) : handleConfirm}
            disabled={isSending}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-body font-bold text-lg shadow-lg shadow-primary/30 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : isFailed ? (
              'Tentar novamente'
            ) : (
              'Confirmar Pedido'
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
