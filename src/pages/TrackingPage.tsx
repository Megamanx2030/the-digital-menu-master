import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Clock, ArrowLeft } from 'lucide-react';

interface PedidoData {
  id: string;
  numero_pedido: number;
  status: string;
  created_at: string;
}

interface ItemPedido {
  id: string;
  quantidade: number;
  preco_unitario: number;
  observacoes: string | null;
  produtos: { nome: string } | null;
}

const steps = [
  { key: 'novo', label: 'Recebido', desc: 'Pedido recebido pela cozinha' },
  { key: 'preparando', label: 'Preparando', desc: 'Seu pedido está sendo preparado' },
  { key: 'pronto', label: 'Pronto', desc: 'Pedido pronto para retirada' },
];

const TrackingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const pedidoIdFromState = (location.state as { pedidoId?: string })?.pedidoId;

  const [pedido, setPedido] = useState<PedidoData | null>(null);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const fetchPedido = async () => {
      let query = supabase.from('pedidos').select('*');
      if (pedidoIdFromState) {
        query = query.eq('id', pedidoIdFromState);
      } else {
        const { data: mesa } = await supabase.from('mesas').select('id').eq('numero', Number(id)).single();
        if (!mesa) return;
        query = query.eq('mesa_id', mesa.id).order('created_at', { ascending: false }).limit(1);
      }
      const { data } = await query.single();
      if (data) {
        setPedido(data as PedidoData);
        fetchItens(data.id);
      }
    };

    const fetchItens = async (pedidoId: string) => {
      const { data } = await supabase
        .from('itens_pedido')
        .select('*, produtos(nome)')
        .eq('pedido_id', pedidoId);
      if (data) setItens(data as unknown as ItemPedido[]);
    };

    fetchPedido();
  }, [id, pedidoIdFromState]);

  // Realtime subscription
  useEffect(() => {
    if (!pedido?.id) return;
    const channel = supabase
      .channel(`pedido-${pedido.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedido.id}` },
        (payload) => setPedido(payload.new as PedidoData)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pedido?.id]);

  // Timer
  useEffect(() => {
    if (!pedido) return;
    const interval = setInterval(() => {
      const created = new Date(pedido.created_at).getTime();
      const elapsed = Date.now() - created;
      const target = 20 * 60 * 1000;
      const remaining = Math.max(0, target - elapsed);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [pedido]);

  const currentStepIndex = steps.findIndex(s => s.key === pedido?.status);

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto px-4 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md py-4 flex items-center gap-3">
        <button onClick={() => navigate(`/mesa/${id}`)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Acompanhar Pedido</h1>
      </div>

      {/* Ticket info */}
      <div className="bg-card rounded-xl border border-border p-5 mt-2 text-center">
        <p className="text-muted-foreground font-body text-sm">Pedido</p>
        <p className="text-3xl font-display font-bold text-primary">#{pedido?.numero_pedido || '—'}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground font-body text-sm">Tempo restante:</span>
          <span className="font-body font-bold text-foreground">{timeLeft || '--:--'}</span>
        </div>
      </div>

      {/* Progress tracker */}
      <div className="mt-8 px-2">
        {steps.map((step, i) => {
          const isCompleted = i <= currentStepIndex;
          const isActive = i === currentStepIndex;
          return (
            <div key={step.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <motion.div
                  animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isCompleted ? 'bg-primary border-primary' : 'bg-secondary border-border'
                  }`}
                >
                  {isCompleted && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                </motion.div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 h-12 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
              <div className="pb-8">
                <h3 className={`font-body font-bold text-sm ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Items list */}
      <div className="mt-4">
        <h2 className="font-display font-semibold text-foreground mb-3">Itens do pedido</h2>
        <div className="space-y-2">
          {itens.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-card rounded-lg border border-border p-3">
              <div>
                <p className="font-body font-semibold text-foreground text-sm">
                  {item.quantidade}x {(item.produtos as any)?.nome || 'Produto'}
                </p>
                {item.observacoes && <p className="text-xs text-primary mt-0.5">{item.observacoes}</p>}
              </div>
              <span className="font-body font-bold text-muted-foreground text-sm">
                R$ {(item.preco_unitario * item.quantidade).toFixed(2).replace('.', ',')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
