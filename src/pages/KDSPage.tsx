import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChefHat, Clock, AlertTriangle, Flame, CheckCircle2, XCircle, Check } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type StatusPedido = Database['public']['Enums']['status_pedido'];

interface Pedido {
  id: string;
  numero_pedido: number;
  status: string;
  mesa_id: string;
  created_at: string;
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
  const [cancelAlertFlash, setCancelAlertFlash] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPedidos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .in('status', ['novo', 'preparando', 'pronto', 'cancelamento_solicitado'])
      .order('created_at', { ascending: true });
    if (data) {
      setPedidos(data as Pedido[]);
      const ids = data.map(p => p.id);
      if (ids.length > 0) {
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('*, produtos(nome)')
          .in('pedido_id', ids);
        if (itens) {
          const map: Record<string, ItemPedido[]> = {};
          itens.forEach((item: any) => {
            if (!map[item.pedido_id]) map[item.pedido_id] = [];
            map[item.pedido_id].push(item);
          });
          setItensMap(map);
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

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    const unlock = () => { getAudioCtx(); document.removeEventListener('touchstart', unlock); document.removeEventListener('click', unlock); };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => { document.removeEventListener('touchstart', unlock); document.removeEventListener('click', unlock); };
  }, [getAudioCtx]);

  const playSound = useCallback((freqs: number[]) => {
    try {
      const ctx = getAudioCtx();
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        const start = ctx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0.5, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.start(start); osc.stop(start + 0.3);
      });
    } catch { /* */ }
  }, [getAudioCtx]);

  const playNewOrderSound = useCallback(() => playSound([660, 880, 1100]), [playSound]);
  const playCancelSound = useCallback(() => playSound([800, 400, 800, 400]), [playSound]);

  // Persistent cancel alert sound
  const cancelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelamentos = pedidos.filter(p => p.status === 'cancelamento_solicitado');

  useEffect(() => {
    if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current);
    if (cancelamentos.length > 0) {
      playCancelSound();
      cancelIntervalRef.current = setInterval(() => playCancelSound(), 6000);
    }
    return () => { if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current); };
  }, [cancelamentos.length, playCancelSound]);

  useEffect(() => {
    const channel = supabase
      .channel('kds-pedidos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => {
        fetchPedidos(); playNewOrderSound();
        setNewOrderFlash(true); setTimeout(() => setNewOrderFlash(false), 2000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, (payload: any) => {
        fetchPedidos();
        if (payload.new?.status === 'cancelamento_solicitado') {
          setCancelAlertFlash(true); setTimeout(() => setCancelAlertFlash(false), 3000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPedidos, playNewOrderSound]);

  const getMesaNumero = (mesaId: string) => mesas.find(m => m.id === mesaId)?.numero || '?';
  const getWaitTime = (createdAt: string) => Math.floor((now - new Date(createdAt).getTime()) / 60000);
  const formatWaitTime = (mins: number) => {
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60); const m = mins % 60;
    return `${h}h${m > 0 ? m + 'm' : ''}`;
  };
  const getTimeColor = (mins: number) => {
    if (mins < 10) return 'text-green-400';
    if (mins < 20) return 'text-amber-400';
    return 'text-red-400';
  };

  const updateStatus = async (pedidoId: string, newStatus: StatusPedido) => {
    await supabase.from('pedidos').update({ status: newStatus }).eq('id', pedidoId);
  };

  const handleAcceptCancel = async (pedidoId: string) => {
    await supabase.from('pedidos').update({ status: 'cancelado' as StatusPedido }).eq('id', pedidoId);
    fetchPedidos();
  };

  const handleRejectCancel = async (pedidoId: string) => {
    await supabase.from('pedidos').update({ status: 'preparando' as StatusPedido }).eq('id', pedidoId);
    fetchPedidos();
  };

  const novos = pedidos.filter(p => p.status === 'novo');
  const preparando = pedidos.filter(p => p.status === 'preparando');
  const prontos = pedidos.filter(p => p.status === 'pronto');

  const ActionCard = ({ pedido, borderColor, bgAccent, buttonLabel, buttonClass, onAction }: {
    pedido: Pedido; borderColor: string; bgAccent: string; buttonLabel: string; buttonClass: string; onAction: () => void;
  }) => {
    const itens = itensMap[pedido.id] || [];
    const mins = getWaitTime(pedido.created_at);
    return (
      <div className={`bg-card border-2 ${borderColor} rounded-xl overflow-hidden flex-shrink-0`}>
        <div className={`px-4 py-2.5 flex items-center justify-between ${bgAccent}`}>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-2xl text-foreground">#{pedido.numero_pedido}</span>
            <span className="text-base text-muted-foreground font-body font-medium">Mesa {getMesaNumero(pedido.mesa_id)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-4 h-4 ${getTimeColor(mins)}`} />
            <span className={`font-body font-bold text-sm ${getTimeColor(mins)}`}>{formatWaitTime(mins)}</span>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          {itens.map(item => (
            <div key={item.id}>
              <div className="flex items-center gap-2.5">
                <span className="bg-primary/20 text-primary font-bold text-base min-w-[36px] h-9 rounded-lg flex items-center justify-center shrink-0">{item.quantidade}x</span>
                <span className="font-body font-semibold text-foreground text-base leading-tight">{item.produtos?.nome}</span>
              </div>
              {item.observacoes && (
                <div className="flex items-start gap-1.5 ml-11 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-kds-yellow mt-0.5 shrink-0" />
                  <span className="text-kds-yellow text-sm font-medium">{item.observacoes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground font-body mb-2">
            Recebido às {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button onClick={onAction} className={`w-full rounded-xl py-3.5 font-body font-bold text-lg tracking-wide active:scale-95 transition-all ${buttonClass}`}>
            {buttonLabel}
          </button>
        </div>
      </div>
    );
  };

  const ReadyCard = ({ pedido }: { pedido: Pedido }) => {
    const itens = itensMap[pedido.id] || [];
    const mins = getWaitTime(pedido.created_at);
    return (
      <div className="bg-card border-2 border-green-500/40 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-green-500/20">
        <div className="px-4 py-2.5 flex items-center justify-between bg-green-500/10">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-2xl text-foreground">#{pedido.numero_pedido}</span>
            <span className="text-base text-muted-foreground font-body font-medium">Mesa {getMesaNumero(pedido.mesa_id)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-4 h-4 ${getTimeColor(mins)}`} />
            <span className={`font-body font-bold text-sm ${getTimeColor(mins)}`}>{formatWaitTime(mins)}</span>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          {itens.map(item => (
            <div key={item.id}>
              <div className="flex items-center gap-2.5">
                <span className="bg-green-500/20 text-green-400 font-bold text-base min-w-[36px] h-9 rounded-lg flex items-center justify-center shrink-0">{item.quantidade}x</span>
                <span className="font-body font-semibold text-foreground text-base leading-tight">{item.produtos?.nome}</span>
              </div>
              {item.observacoes && (
                <div className="flex items-start gap-1.5 ml-11 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-kds-yellow mt-0.5 shrink-0" />
                  <span className="text-kds-yellow text-sm font-medium">{item.observacoes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground font-body">Recebido às {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm text-green-400 font-body font-bold mt-1.5 text-center uppercase tracking-wide">✅ Aguardando garçom retirar</p>
        </div>
      </div>
    );
  };

  return (
    <div className={`h-screen flex flex-col bg-background overflow-hidden ${newOrderFlash ? 'ring-4 ring-kds-yellow ring-inset' : ''} ${cancelAlertFlash ? 'ring-4 ring-red-500 ring-inset' : ''}`}>
      {/* Cancel alert banner */}
      {cancelamentos.length > 0 && (
        <div className="flex-shrink-0 bg-red-500/20 border-b-2 border-red-500/50 px-4 py-3 animate-pulse">
          <div className="flex items-center gap-3">
            <XCircle className="w-7 h-7 text-red-400 animate-bounce" />
            <div>
              <p className="font-display font-bold text-lg text-red-400">
                ⚠️ {cancelamentos.length} solicitação(ões) de cancelamento!
              </p>
              <p className="font-body text-sm text-red-400/80">
                {cancelamentos.map(p => `#${p.numero_pedido} (Mesa ${getMesaNumero(p.mesa_id)})`).join(' • ')}
              </p>
            </div>
          </div>
        </div>
      )}

      <header className="flex-shrink-0 bg-card border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ChefHat className="w-7 h-7 text-primary" />
          <h1 className="text-xl font-display font-bold text-foreground">KDS — Cozinha</h1>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1.5 bg-blue-500/15 text-blue-400 px-3 py-1.5 rounded-lg font-body font-bold text-sm">
            <Flame className="w-4 h-4" /> Novos: {novos.length}
          </span>
          <span className="flex items-center gap-1.5 bg-amber-500/15 text-amber-400 px-3 py-1.5 rounded-lg font-body font-bold text-sm">
            <Clock className="w-4 h-4" /> Preparando: {preparando.length}
          </span>
          <span className="flex items-center gap-1.5 bg-green-500/15 text-green-400 px-3 py-1.5 rounded-lg font-body font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" /> Prontos: {prontos.length}
          </span>
          {cancelamentos.length > 0 && (
            <span className="flex items-center gap-1.5 bg-red-500/15 text-red-400 px-3 py-1.5 rounded-lg font-body font-bold text-sm animate-pulse">
              <XCircle className="w-4 h-4" /> Cancelar: {cancelamentos.length}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* NOVOS */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          <div className="flex-shrink-0 px-3 py-2.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-base font-display font-bold text-blue-400 uppercase tracking-wide">Novos</span>
            <span className="bg-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full text-sm font-bold ml-auto">{novos.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5" style={{ WebkitOverflowScrolling: 'touch' }}>
            {novos.map(pedido => (
              <ActionCard key={pedido.id} pedido={pedido} borderColor="border-blue-500/40" bgAccent="bg-blue-500/5"
                buttonLabel="🔥 PREPARAR" buttonClass="bg-amber-600 hover:bg-amber-500 text-white"
                onAction={() => updateStatus(pedido.id, 'preparando')} />
            ))}
            {novos.length === 0 && <p className="text-center text-muted-foreground/30 text-base py-12 font-body">Nenhum novo pedido</p>}
          </div>
        </div>

        {/* PREPARANDO */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          <div className="flex-shrink-0 px-3 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-base font-display font-bold text-amber-400 uppercase tracking-wide">Preparando</span>
            <span className="bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full text-sm font-bold ml-auto">{preparando.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5" style={{ WebkitOverflowScrolling: 'touch' }}>
            {preparando.map(pedido => (
              <ActionCard key={pedido.id} pedido={pedido} borderColor="border-amber-500/40" bgAccent="bg-amber-500/5"
                buttonLabel="✅ PRONTO" buttonClass="bg-green-600 hover:bg-green-500 text-white"
                onAction={() => updateStatus(pedido.id, 'pronto')} />
            ))}
            {preparando.length === 0 && <p className="text-center text-muted-foreground/30 text-base py-12 font-body">Nenhum em preparo</p>}
          </div>
        </div>

        {/* PRONTOS */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-shrink-0 px-3 py-2.5 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-base font-display font-bold text-green-400 uppercase tracking-wide">Prontos</span>
            <span className="bg-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full text-sm font-bold ml-auto">{prontos.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5" style={{ WebkitOverflowScrolling: 'touch' }}>
            {prontos.map(pedido => <ReadyCard key={pedido.id} pedido={pedido} />)}
            {prontos.length === 0 && <p className="text-center text-muted-foreground/30 text-base py-12 font-body">Nenhum pronto</p>}
          </div>
        </div>
      </div>

      {/* Cancellation requests modal cards at bottom */}
      {cancelamentos.length > 0 && (
        <div className="flex-shrink-0 border-t-2 border-red-500/40 bg-red-500/5 p-3 max-h-[35%] overflow-y-auto">
          <h3 className="font-display font-bold text-lg text-red-400 mb-2 px-1">🚫 Solicitações de Cancelamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cancelamentos.map(pedido => {
              const itens = itensMap[pedido.id] || [];
              return (
                <div key={pedido.id} className="bg-card border-2 border-red-500/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-red-500/10 flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-bold text-2xl text-foreground">#{pedido.numero_pedido}</span>
                      <span className="text-base text-muted-foreground font-body font-medium">Mesa {getMesaNumero(pedido.mesa_id)}</span>
                    </div>
                    <span className="text-xs text-red-400 font-body font-bold animate-pulse">CANCELAR?</span>
                  </div>
                  <div className="px-4 py-2 space-y-1">
                    {itens.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="bg-red-500/20 text-red-400 font-bold text-sm min-w-[28px] h-7 rounded-md flex items-center justify-center">{item.quantidade}x</span>
                        <span className="font-body text-sm text-foreground">{item.produtos?.nome}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-3 flex gap-2 mt-1">
                    <button onClick={() => handleAcceptCancel(pedido.id)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-red-600 hover:bg-red-500 text-white font-body font-bold text-base active:scale-95 transition-all">
                      <XCircle className="w-5 h-5" /> Cancelar
                    </button>
                    <button onClick={() => handleRejectCancel(pedido.id)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-green-600 hover:bg-green-500 text-white font-body font-bold text-base active:scale-95 transition-all">
                      <Check className="w-5 h-5" /> Manter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pedidos.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <CheckCircle2 className="w-20 h-20 mb-4 text-muted-foreground/15" />
          <p className="font-display text-2xl font-bold text-muted-foreground/25">Tudo em dia!</p>
          <p className="font-body text-base mt-1 text-muted-foreground/20">Nenhum pedido pendente</p>
        </div>
      )}
    </div>
  );
};

export default KDSPage;
