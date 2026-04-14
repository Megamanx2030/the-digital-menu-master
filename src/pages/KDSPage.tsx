import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Clock, AlertTriangle, Flame, CheckCircle2 } from 'lucide-react';

interface Pedido {
  id: string;
  numero_pedido: number;
  status: string;
  mesa_id: string;
  created_at: string;
  updated_at: string;
}

interface Mesa {
  id: string;
  numero: number;
}

interface ItemPedido {
  id: string;
  quantidade: number;
  preco_unitario: number;
  observacoes: string | null;
  produtos: { nome: string } | null;
}

const KDSPage = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [itensMap, setItensMap] = useState<Record<string, ItemPedido[]>>({});
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchPedidos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .in('status', ['novo', 'preparando'])
      .order('created_at', { ascending: true });
    if (data) {
      setPedidos(data as Pedido[]);
      const newItensMap: Record<string, ItemPedido[]> = {};
      await Promise.all(data.map(async (p) => {
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('*, produtos(nome)')
          .eq('pedido_id', p.id);
        if (itens) {
          newItensMap[p.id] = itens as unknown as ItemPedido[];
        }
      }));
      setItensMap(newItensMap);
    }
  }, []);

  useEffect(() => {
    const fetchMesas = async () => {
      const { data } = await supabase.from('mesas').select('id, numero');
      if (data) setMesas(data);
    };
    fetchMesas();
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    const channel = supabase
      .channel('kds-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          fetchPedidos();
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 2000);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPedidos]);

  const getMesaNumero = (mesaId: string) => mesas.find(m => m.id === mesaId)?.numero || '?';

  const getWaitTime = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const formatWaitTime = (mins: number) => {
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m > 0 ? m + 'm' : ''}`;
  };

  const getUrgency = (mins: number): 'ok' | 'warn' | 'danger' => {
    if (mins < 10) return 'ok';
    if (mins < 20) return 'warn';
    return 'danger';
  };

  const urgencyStyles = {
    ok: { border: 'border-kds-green/40', timeBg: 'bg-kds-green/15', timeText: 'text-kds-green' },
    warn: { border: 'border-kds-orange/60', timeBg: 'bg-kds-orange/15', timeText: 'text-kds-orange' },
    danger: { border: 'border-kds-red/70', timeBg: 'bg-kds-red/20', timeText: 'text-kds-red' },
  };

  const updateStatus = async (pedidoId: string, newStatus: 'novo' | 'preparando' | 'pronto' | 'entregue') => {
    await supabase.from('pedidos').update({ status: newStatus }).eq('id', pedidoId);
  };

  const novos = pedidos.filter(p => p.status === 'novo');
  const preparando = pedidos.filter(p => p.status === 'preparando');

  return (
    <div className={`min-h-screen bg-background transition-all ${newOrderFlash ? 'ring-4 ring-kds-yellow ring-inset' : ''}`}>
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <ChefHat className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-display font-bold text-foreground">KDS — Cozinha</h1>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-kds-green/15 text-kds-green px-4 py-2 rounded-lg font-body font-bold text-base">
              <Flame className="w-4 h-4" />
              Novos: {novos.length}
            </div>
            <div className="flex items-center gap-2 bg-kds-orange/15 text-kds-orange px-4 py-2 rounded-lg font-body font-bold text-base">
              <Clock className="w-4 h-4" />
              Preparando: {preparando.length}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto p-4">
        {/* NOVOS section */}
        {novos.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-kds-green animate-pulse" />
              <h2 className="text-lg font-display font-bold text-kds-green uppercase tracking-wide">
                Novos Pedidos
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence>
                {novos.map(pedido => (
                  <OrderCard
                    key={pedido.id}
                    pedido={pedido}
                    itens={itensMap[pedido.id] || []}
                    mesaNumero={getMesaNumero(pedido.mesa_id)}
                    getWaitTime={getWaitTime}
                    formatWaitTime={formatWaitTime}
                    getUrgency={getUrgency}
                    urgencyStyles={urgencyStyles}
                    onAction={() => updateStatus(pedido.id, 'preparando')}
                    actionLabel="🔥 PREPARAR"
                    actionClass="bg-kds-orange hover:bg-kds-orange/80 text-white"
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* PREPARANDO section */}
        {preparando.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-kds-orange animate-pulse" />
              <h2 className="text-lg font-display font-bold text-kds-orange uppercase tracking-wide">
                Em Preparo
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence>
                {preparando.map(pedido => (
                  <OrderCard
                    key={pedido.id}
                    pedido={pedido}
                    itens={itensMap[pedido.id] || []}
                    mesaNumero={getMesaNumero(pedido.mesa_id)}
                    getWaitTime={getWaitTime}
                    formatWaitTime={formatWaitTime}
                    getUrgency={getUrgency}
                    urgencyStyles={urgencyStyles}
                    onAction={() => updateStatus(pedido.id, 'pronto')}
                    actionLabel="✅ PRONTO"
                    actionClass="bg-kds-green hover:bg-kds-green/80 text-white"
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {pedidos.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-32 text-muted-foreground">
            <CheckCircle2 className="w-20 h-20 mb-4 opacity-20" />
            <p className="font-display text-2xl font-bold opacity-40">Tudo em dia!</p>
            <p className="font-body text-base mt-1 opacity-30">Nenhum pedido pendente</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Order Card Component ─── */
interface OrderCardProps {
  pedido: Pedido;
  itens: ItemPedido[];
  mesaNumero: number | string;
  getWaitTime: (createdAt: string) => number;
  formatWaitTime: (mins: number) => string;
  getUrgency: (mins: number) => 'ok' | 'warn' | 'danger';
  urgencyStyles: Record<string, { border: string; timeBg: string; timeText: string }>;
  onAction: () => void;
  actionLabel: string;
  actionClass: string;
}

interface Pedido {
  id: string;
  numero_pedido: number;
  status: string;
  mesa_id: string;
  created_at: string;
  updated_at: string;
}

interface ItemPedido {
  id: string;
  quantidade: number;
  preco_unitario: number;
  observacoes: string | null;
  produtos: { nome: string } | null;
}

const OrderCard = ({
  pedido, itens, mesaNumero, getWaitTime, formatWaitTime, getUrgency, urgencyStyles,
  onAction, actionLabel, actionClass,
}: OrderCardProps) => {
  const waitMins = getWaitTime(pedido.created_at);
  const urgency = getUrgency(waitMins);
  const styles = urgencyStyles[urgency];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-card border-2 ${styles.border} rounded-xl overflow-hidden flex flex-col`}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between bg-secondary/30">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-2xl text-foreground">#{pedido.numero_pedido}</span>
          <span className="text-base text-muted-foreground font-body">Mesa {mesaNumero}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${styles.timeBg}`}>
          <Clock className={`w-4 h-4 ${styles.timeText}`} />
          <span className={`font-body font-bold text-base ${styles.timeText}`}>{formatWaitTime(waitMins)}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 flex-1 space-y-2">
        {itens.map(item => (
          <div key={item.id} className="border-b border-border/30 pb-2 last:border-0 last:pb-0">
            <div className="flex items-center gap-2">
              <span className="bg-primary/20 text-primary font-bold text-sm w-7 h-7 rounded-md flex items-center justify-center shrink-0">
                {item.quantidade}x
              </span>
              <span className="font-body font-semibold text-foreground text-base">
                {(item.produtos as any)?.nome}
              </span>
            </div>
            {item.observacoes && (
              <div className="flex items-start gap-1.5 mt-1 ml-9">
                <AlertTriangle className="w-3.5 h-3.5 text-kds-yellow mt-0.5 shrink-0" />
                <span className="text-kds-yellow font-body text-sm font-medium leading-tight">{item.observacoes}</span>
              </div>
            )}
          </div>
        ))}
        {itens.length === 0 && (
          <p className="text-muted-foreground text-sm font-body italic">Carregando itens...</p>
        )}
      </div>

      {/* Time + Action */}
      <div className="px-4 pb-3">
        <div className="text-xs text-muted-foreground font-body mb-2">
          Recebido às {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <button
          onClick={onAction}
          className={`w-full rounded-xl py-3 font-body font-bold text-lg tracking-wide transition-all active:scale-95 ${actionClass}`}
        >
          {actionLabel}
        </button>
      </div>
    </motion.div>
  );
};

export default KDSPage;
