import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Clock, AlertTriangle } from 'lucide-react';

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

  const fetchPedidos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .in('status', ['novo', 'preparando'])
      .order('created_at', { ascending: true });
    if (data) {
      setPedidos(data as Pedido[]);
      // Fetch items for each
      for (const p of data) {
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('*, produtos(nome)')
          .eq('pedido_id', p.id);
        if (itens) {
          setItensMap(prev => ({ ...prev, [p.id]: itens as unknown as ItemPedido[] }));
        }
      }
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

  // Realtime
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
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return mins;
  };

  const getTimeColor = (mins: number) => {
    if (mins < 10) return 'text-kds-green';
    if (mins < 20) return 'text-kds-orange';
    return 'text-kds-red';
  };

  const getTimeBg = (mins: number) => {
    if (mins < 10) return 'bg-kds-green/20';
    if (mins < 20) return 'bg-kds-orange/20';
    return 'bg-kds-red/20';
  };

  const updateStatus = async (pedidoId: string, newStatus: 'novo' | 'preparando' | 'pronto' | 'entregue') => {
    await supabase.from('pedidos').update({ status: newStatus }).eq('id', pedidoId);
  };

  const novos = pedidos.filter(p => p.status === 'novo');
  const preparando = pedidos.filter(p => p.status === 'preparando');
  const prontos = pedidos.filter(p => p.status === 'pronto');

  return (
    <div className={`min-h-screen bg-background p-4 transition-colors ${newOrderFlash ? 'ring-4 ring-kds-yellow ring-inset' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">KDS - Cozinha</h1>
            <p className="text-sm text-muted-foreground font-body">The Culinary Curator</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="bg-kds-green/20 text-kds-green px-3 py-1.5 rounded-lg font-body font-bold text-sm">
            Novos: {novos.length}
          </div>
          <div className="bg-kds-orange/20 text-kds-orange px-3 py-1.5 rounded-lg font-body font-bold text-sm">
            Preparando: {preparando.length}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {pedidos.map(pedido => {
            const waitMins = getWaitTime(pedido.created_at);
            const itens = itensMap[pedido.id] || [];
            return (
              <motion.div
                key={pedido.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-card border-2 rounded-xl overflow-hidden ${
                  pedido.status === 'novo' ? 'border-kds-green' : 'border-kds-orange'
                }`}
              >
                {/* Ticket header */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  pedido.status === 'novo' ? 'bg-kds-green/10' : 'bg-kds-orange/10'
                }`}>
                  <div>
                    <span className="font-display font-bold text-foreground text-lg">#{pedido.numero_pedido}</span>
                    <span className="ml-2 text-muted-foreground font-body text-sm">Mesa {getMesaNumero(pedido.mesa_id)}</span>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${getTimeBg(waitMins)}`}>
                    <Clock className={`w-3.5 h-3.5 ${getTimeColor(waitMins)}`} />
                    <span className={`font-body font-bold text-sm ${getTimeColor(waitMins)}`}>{waitMins}min</span>
                  </div>
                </div>

                {/* Items */}
                <div className="px-4 py-3 space-y-2">
                  {itens.map(item => (
                    <div key={item.id}>
                      <div className="flex items-center justify-between">
                        <span className="font-body font-semibold text-foreground text-sm">
                          {item.quantidade}x {(item.produtos as any)?.nome}
                        </span>
                      </div>
                      {item.observacoes && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 text-kds-yellow" />
                          <span className="text-kds-yellow font-body text-xs font-medium">{item.observacoes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Time */}
                <div className="px-4 py-2 text-xs text-muted-foreground font-body">
                  {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex gap-2">
                  {pedido.status === 'novo' && (
                    <button
                      onClick={() => updateStatus(pedido.id, 'preparando')}
                      className="flex-1 bg-kds-orange text-foreground rounded-lg py-2.5 font-body font-bold text-sm"
                    >
                      Preparar
                    </button>
                  )}
                  {pedido.status === 'preparando' && (
                    <button
                      onClick={() => updateStatus(pedido.id, 'pronto')}
                      className="flex-1 bg-kds-green text-foreground rounded-lg py-2.5 font-body font-bold text-sm"
                    >
                      Pronto
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {pedidos.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-20 text-muted-foreground">
          <ChefHat className="w-16 h-16 mb-4 opacity-30" />
          <p className="font-body text-lg">Nenhum pedido no momento</p>
        </div>
      )}
    </div>
  );
};

export default KDSPage;
