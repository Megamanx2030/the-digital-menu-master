import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Minus, ArrowRightLeft, X, Check, ChefHat,
  Clock, ShoppingBag, Coffee, Search, DoorOpen, DoorClosed,
  Flame, Sparkles, CircleCheckBig, CookingPot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getProductImage } from '@/lib/imageMap';

/* ────────── types ────────── */
interface Mesa {
  id: string;
  numero: number;
  status: 'aberta' | 'fechada';
}

interface Pedido {
  id: string;
  numero_pedido: number;
  status: string;
  mesa_id: string;
  created_at: string;
  observacoes: string | null;
}

interface ItemPedido {
  id: string;
  quantidade: number;
  preco_unitario: number;
  observacoes: string | null;
  pedido_id: string;
  produtos: { nome: string } | null;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
  categoria_id: string;
  descricao: string | null;
  imagem_url: string | null;
  disponivel: boolean;
}

interface Categoria {
  id: string;
  nome: string;
  ordem: number;
}

interface NewOrderItem {
  produto: Produto;
  quantidade: number;
  observacoes: string;
}

interface ConsolidatedItem {
  nome: string;
  totalQty: number;
  totalPrice: number;
  status: string;
}

/* ────────── component ────────── */
const GarcomPage = () => {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itensPedido, setItensPedido] = useState<Record<string, ItemPedido[]>>({});
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [newOrderItems, setNewOrderItems] = useState<NewOrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderObs, setOrderObs] = useState('');

  /* ── fetch data ── */
  const fetchMesas = useCallback(async () => {
    const { data } = await supabase.from('mesas').select('id, numero, status').order('numero');
    if (data) setMesas(data as Mesa[]);
  }, []);

  const fetchPedidos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .in('status', ['novo', 'preparando', 'pronto'])
      .order('created_at', { ascending: false });
    if (data) {
      setPedidos(data as Pedido[]);
      const ids = data.map((p: any) => p.id);
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from('itens_pedido')
          .select('*, produtos(nome)')
          .in('pedido_id', ids);
        if (items) {
          const map: Record<string, ItemPedido[]> = {};
          items.forEach((item: any) => {
            if (!map[item.pedido_id]) map[item.pedido_id] = [];
            map[item.pedido_id].push(item);
          });
          setItensPedido(map);
        }
      }
    }
  }, []);

  const fetchProdutos = useCallback(async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produtos').select('*').eq('disponivel', true).order('nome'),
      supabase.from('categorias').select('*').order('ordem'),
    ]);
    if (prods) setProdutos(prods as Produto[]);
    if (cats) setCategorias(cats as Categoria[]);
  }, []);

  useEffect(() => {
    fetchMesas();
    fetchPedidos();
    fetchProdutos();

    const ch1 = supabase
      .channel('garcom-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => fetchPedidos())
      .subscribe();

    const ch2 = supabase
      .channel('garcom-mesas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => fetchMesas())
      .subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchMesas, fetchPedidos, fetchProdutos]);

  /* ── helpers ── */
  const mesaPedidos = useCallback((mesaId: string) => pedidos.filter(p => p.mesa_id === mesaId), [pedidos]);

  const mesaTotal = useCallback((mesaId: string) => {
    let total = 0;
    mesaPedidos(mesaId).forEach(p => {
      (itensPedido[p.id] || []).forEach(i => { total += i.quantidade * i.preco_unitario; });
    });
    return total;
  }, [mesaPedidos, itensPedido]);

  const getStatusCounts = useCallback((mesaId: string) => {
    const mp = mesaPedidos(mesaId);
    const counts = { novo: 0, preparando: 0, pronto: 0 };
    mp.forEach(p => {
      (itensPedido[p.id] || []).forEach(i => {
        const s = p.status as keyof typeof counts;
        if (counts[s] !== undefined) counts[s] += i.quantidade;
      });
    });
    return counts;
  }, [mesaPedidos, itensPedido]);

  const getConsolidatedItems = useCallback((mesaId: string): { ready: ConsolidatedItem[]; pending: ConsolidatedItem[] } => {
    const mp = mesaPedidos(mesaId);
    const readyMap: Record<string, ConsolidatedItem> = {};
    const pendingMap: Record<string, ConsolidatedItem> = {};

    mp.forEach(p => {
      (itensPedido[p.id] || []).forEach(i => {
        const nome = i.produtos?.nome || 'Item';
        const target = p.status === 'pronto' ? readyMap : pendingMap;
        if (!target[nome]) {
          target[nome] = { nome, totalQty: 0, totalPrice: 0, status: p.status };
        }
        target[nome].totalQty += i.quantidade;
        target[nome].totalPrice += i.quantidade * i.preco_unitario;
      });
    });

    return {
      ready: Object.values(readyMap),
      pending: Object.values(pendingMap),
    };
  }, [mesaPedidos, itensPedido]);

  const formatPrice = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  /* ── actions ── */
  const toggleMesa = async (mesa: Mesa) => {
    const newStatus = mesa.status === 'aberta' ? 'fechada' : 'aberta';
    if (newStatus === 'fechada') {
      const activePedidos = mesaPedidos(mesa.id);
      for (const p of activePedidos) {
        await supabase.from('pedidos').update({ status: 'entregue' }).eq('id', p.id);
      }
    }
    await supabase.from('mesas').update({ status: newStatus }).eq('id', mesa.id);
    toast.success(newStatus === 'aberta' ? `Mesa ${mesa.numero} aberta` : `Mesa ${mesa.numero} fechada`);
    fetchMesas();
    fetchPedidos();
  };

  const transferPedidos = async () => {
    if (!selectedMesa || !transferTarget) return;
    const activePedidos = mesaPedidos(selectedMesa.id);
    for (const p of activePedidos) {
      await supabase.from('pedidos').update({ mesa_id: transferTarget }).eq('id', p.id);
    }
    await supabase.from('mesas').update({ status: 'aberta' }).eq('id', transferTarget);
    toast.success(`Pedidos transferidos para mesa ${mesas.find(m => m.id === transferTarget)?.numero}`);
    setShowTransfer(false);
    setTransferTarget('');
    fetchPedidos();
    fetchMesas();
  };

  const addToNewOrder = (produto: Produto) => {
    setNewOrderItems(prev => {
      const existing = prev.find(i => i.produto.id === produto.id);
      if (existing) {
        return prev.map(i => i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, { produto, quantidade: 1, observacoes: '' }];
    });
  };

  const updateNewOrderQty = (produtoId: string, delta: number) => {
    setNewOrderItems(prev => {
      return prev.map(i => {
        if (i.produto.id !== produtoId) return i;
        const newQty = i.quantidade + delta;
        return newQty <= 0 ? null : { ...i, quantidade: newQty };
      }).filter(Boolean) as NewOrderItem[];
    });
  };

  const submitNewOrder = async () => {
    if (!selectedMesa || newOrderItems.length === 0) return;
    if (selectedMesa.status === 'fechada') {
      await supabase.from('mesas').update({ status: 'aberta' }).eq('id', selectedMesa.id);
    }
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .insert({ mesa_id: selectedMesa.id, observacoes: orderObs || null })
      .select()
      .single();
    if (error || !pedido) {
      toast.error('Erro ao criar pedido');
      return;
    }
    const items = newOrderItems.map(i => ({
      pedido_id: pedido.id,
      produto_id: i.produto.id,
      preco_unitario: i.produto.preco,
      quantidade: i.quantidade,
      observacoes: i.observacoes || null,
    }));
    await supabase.from('itens_pedido').insert(items);
    toast.success(`Pedido #${pedido.numero_pedido} criado para Mesa ${selectedMesa.numero}`);
    setShowNewOrder(false);
    setNewOrderItems([]);
    setOrderObs('');
    fetchPedidos();
    fetchMesas();
  };

  const filteredProdutos = produtos.filter(p => {
    const matchSearch = !searchTerm || p.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = !selectedCategory || p.categoria_id === selectedCategory;
    return matchSearch && matchCat;
  });

  const newOrderTotal = newOrderItems.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);

  /* ── render ── */
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 px-4 py-3" style={{ background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground tracking-tight">Painel do Garçom</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">The Culinary Curator</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1.5 px-3 py-1">
            <Coffee className="w-3 h-3" />
            {mesas.filter(m => m.status === 'aberta').length} abertas
          </Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {/* Mesas Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {mesas.map(mesa => {
            const pedidosMesa = mesaPedidos(mesa.id);
            const total = mesaTotal(mesa.id);
            const isOpen = mesa.status === 'aberta';
            const hasOrders = pedidosMesa.length > 0;
            const hasReady = pedidosMesa.some(p => p.status === 'pronto');
            const counts = getStatusCounts(mesa.id);

            return (
              <motion.div
                key={mesa.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  relative rounded-2xl border p-4 cursor-pointer transition-all duration-300 group
                  ${isOpen
                    ? 'bg-card border-primary/20 shadow-lg shadow-primary/5 hover:border-primary/40 hover:shadow-primary/10'
                    : 'bg-card/50 border-border/30 opacity-60 hover:opacity-80'}
                  ${hasReady ? 'ring-2 ring-green-500/40' : ''}
                `}
                onClick={() => setSelectedMesa(mesa)}
              >
                {/* Glow effect for ready */}
                {hasReady && (
                  <div className="absolute inset-0 rounded-2xl bg-green-500/5 animate-pulse pointer-events-none" />
                )}

                {/* Status indicator */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] uppercase tracking-widest font-bold ${isOpen ? 'text-green-400' : 'text-muted-foreground/50'}`}>
                    {isOpen ? 'Aberta' : 'Fechada'}
                  </span>
                  <div className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-muted-foreground/20'}`} />
                </div>

                <div className="text-center mb-2">
                  <span className="font-display text-3xl font-bold text-foreground">
                    {mesa.numero}
                  </span>
                </div>

                {hasOrders && (
                  <div className="space-y-2">
                    {/* Status pills */}
                    <div className="flex justify-center gap-1 flex-wrap">
                      {counts.pronto > 0 && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold border border-green-500/20">
                          {counts.pronto} pronto
                        </span>
                      )}
                      {counts.preparando > 0 && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/20">
                          {counts.preparando} prep
                        </span>
                      )}
                      {counts.novo > 0 && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold border border-blue-500/20">
                          {counts.novo} novo
                        </span>
                      )}
                    </div>

                    {/* Total */}
                    <p className="text-center text-sm font-bold text-primary">
                      {formatPrice(total)}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ══════════ Mesa Detail Modal ══════════ */}
      <AnimatePresence>
        {selectedMesa && !showNewOrder && !showTransfer && (
          <Dialog open onOpenChange={() => setSelectedMesa(null)}>
            <DialogContent className="max-w-md border-primary/20 max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl" style={{ background: 'hsl(var(--card))' }}>
              {(() => {
                const { ready, pending } = getConsolidatedItems(selectedMesa.id);
                const counts = getStatusCounts(selectedMesa.id);
                const total = mesaTotal(selectedMesa.id);
                const hasItems = ready.length > 0 || pending.length > 0;

                return (
                  <>
                    {/* Modal Header */}
                    <div className="px-5 pt-5 pb-3 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h2 className="font-display text-2xl font-bold text-foreground">Mesa {selectedMesa.numero}</h2>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full ${
                            selectedMesa.status === 'aberta'
                              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}>
                            {selectedMesa.status === 'aberta' ? 'Aberta' : 'Fechada'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Scrollable Content */}
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="px-5 py-4 space-y-5">
                        {hasItems ? (
                          <>
                            {/* ── Status Summary Bar ── */}
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-background/50 border border-border/50">
                              <div className="flex items-center gap-3 flex-wrap w-full justify-center">
                                {counts.pronto > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-xs font-semibold text-green-400">{counts.pronto} pronto</span>
                                  </div>
                                )}
                                {counts.preparando > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-xs font-semibold text-amber-400">{counts.preparando} preparando</span>
                                  </div>
                                )}
                                {counts.novo > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-xs font-semibold text-blue-400">{counts.novo} novos</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ── PRONTOS PARA ENTREGA ── */}
                            {ready.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <CircleCheckBig className="w-4 h-4 text-green-400" />
                                  <h3 className="text-xs font-bold uppercase tracking-widest text-green-400">
                                    Prontos para Entrega
                                  </h3>
                                </div>
                                <div className="space-y-1.5">
                                  {ready.map((item, idx) => (
                                    <motion.div
                                      key={`ready-${idx}`}
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: idx * 0.05 }}
                                      className="flex items-center justify-between p-3 rounded-xl bg-green-500/8 border border-green-500/15"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span className="text-sm font-bold text-green-400 min-w-[28px]">{item.totalQty}x</span>
                                        <span className="text-sm font-medium text-foreground">{item.nome}</span>
                                      </div>
                                      <span className="text-sm font-bold text-foreground">
                                        {formatPrice(item.totalPrice)}
                                      </span>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ── EM PREPARAÇÃO / NOVOS ── */}
                            {pending.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <CookingPot className="w-4 h-4 text-amber-400" />
                                  <Plus className="w-3 h-3 text-blue-400" />
                                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Em Preparação / Novos
                                  </h3>
                                </div>
                                <div className="space-y-1.5">
                                  {pending.map((item, idx) => (
                                    <motion.div
                                      key={`pending-${idx}`}
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: idx * 0.05 }}
                                      className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span className="text-sm font-bold text-muted-foreground min-w-[28px]">{item.totalQty}x</span>
                                        <span className="text-sm font-medium text-foreground/80">{item.nome}</span>
                                      </div>
                                      <span className="text-sm font-semibold text-muted-foreground">
                                        {formatPrice(item.totalPrice)}
                                      </span>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ── Mesa Total ── */}
                            <div className="pt-3 border-t border-border/50">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-foreground uppercase tracking-wide">Total da Mesa</span>
                                <span className="text-xl font-bold text-primary font-display">
                                  {formatPrice(total)}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-10">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                            <p className="text-sm text-muted-foreground">Nenhum pedido ativo</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Action Buttons */}
                    <div className="px-5 py-4 border-t border-border/50 flex gap-2">
                      <Button
                        className="flex-1 gap-2 h-11 rounded-xl font-semibold text-sm"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                        onClick={() => setShowNewOrder(true)}
                      >
                        <Plus className="w-4 h-4" /> Novo Pedido
                      </Button>

                      {mesaPedidos(selectedMesa.id).length > 0 && (
                        <Button
                          variant="outline"
                          className="flex-1 gap-2 h-11 rounded-xl font-semibold text-sm border-border/50 hover:bg-secondary"
                          onClick={() => setShowTransfer(true)}
                        >
                          <ArrowRightLeft className="w-4 h-4" /> Transferir
                        </Button>
                      )}

                      <Button
                        className="flex-1 gap-2 h-11 rounded-xl font-semibold text-sm"
                        style={selectedMesa.status === 'aberta'
                          ? { background: 'hsl(0 84% 40%)', color: 'white' }
                          : { background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }
                        }
                        onClick={() => { toggleMesa(selectedMesa); setSelectedMesa(null); }}
                      >
                        {selectedMesa.status === 'aberta' ? (
                          <><DoorClosed className="w-4 h-4" /> Fechar</>
                        ) : (
                          <><DoorOpen className="w-4 h-4" /> Abrir</>
                        )}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* ══════════ New Order Dialog ══════════ */}
      <Dialog open={showNewOrder} onOpenChange={(open) => { if (!open) { setShowNewOrder(false); setNewOrderItems([]); setSearchTerm(''); setOrderObs(''); } }}>
        <DialogContent className="max-w-lg border-primary/20 max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl" style={{ background: 'hsl(var(--card))' }}>
          <div className="px-5 pt-5 pb-3 border-b border-border/50">
            <h2 className="font-display text-lg font-bold text-foreground">
              Novo Pedido — Mesa {selectedMesa?.numero}
            </h2>
          </div>

          {/* Search + Category filter */}
          <div className="px-5 py-3 space-y-2 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border/50 rounded-xl"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap transition-all font-medium ${!selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'}`}
              >
                Todos
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap transition-all font-medium ${selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'}`}
                >
                  {cat.nome}
                </button>
              ))}
            </div>
          </div>

          {/* Products list */}
          <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: '35vh' }}>
            <div className="space-y-1 px-5 py-2">
              {filteredProdutos.map(produto => {
                const inOrder = newOrderItems.find(i => i.produto.id === produto.id);
                return (
                  <motion.div
                    key={produto.id}
                    layout
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-background border border-border/30 hover:border-primary/20 transition-colors"
                  >
                    <img
                      src={getProductImage(produto.nome) || '/placeholder.svg'}
                      alt={produto.nome}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{produto.nome}</p>
                      <p className="text-xs text-primary font-bold">
                        {formatPrice(produto.preco)}
                      </p>
                    </div>
                    {inOrder ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateNewOrderQty(produto.id, -1)}
                          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-bold w-6 text-center">{inOrder.quantidade}</span>
                        <button
                          onClick={() => updateNewOrderQty(produto.id, 1)}
                          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-primary-foreground" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToNewOrder(produto)}
                        className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:bg-primary/20 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Order summary */}
          {newOrderItems.length > 0 && (
            <div className="border-t border-border/50 px-5 pt-3 pb-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {newOrderItems.map(item => (
                  <Badge key={item.produto.id} variant="secondary" className="gap-1 text-xs rounded-lg">
                    {item.quantidade}x {item.produto.nome}
                    <button onClick={() => updateNewOrderQty(item.produto.id, -item.quantidade)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Textarea
                placeholder="Observações do pedido..."
                value={orderObs}
                onChange={e => setOrderObs(e.target.value)}
                className="bg-background text-xs min-h-[60px] rounded-xl border-border/50"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">
                  Total: {formatPrice(newOrderTotal)}
                </span>
                <Button onClick={submitNewOrder} className="gap-2 rounded-xl h-10">
                  <Check className="w-4 h-4" /> Enviar Pedido
                </Button>
              </div>
            </div>
          )}

          {newOrderItems.length === 0 && (
            <div className="px-5 pb-4">
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowNewOrder(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════ Transfer Dialog ══════════ */}
      <Dialog open={showTransfer} onOpenChange={(open) => { if (!open) { setShowTransfer(false); setTransferTarget(''); } }}>
        <DialogContent className="max-w-sm border-primary/20 rounded-2xl" style={{ background: 'hsl(var(--card))' }}>
          <DialogHeader>
            <DialogTitle className="font-display">Transferir Pedidos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Transferir todos os pedidos da <strong className="text-foreground">Mesa {selectedMesa?.numero}</strong> para:
          </p>
          <Select value={transferTarget} onValueChange={setTransferTarget}>
            <SelectTrigger className="bg-background rounded-xl border-border/50">
              <SelectValue placeholder="Selecione a mesa destino" />
            </SelectTrigger>
            <SelectContent>
              {mesas.filter(m => m.id !== selectedMesa?.id).map(m => (
                <SelectItem key={m.id} value={m.id}>
                  Mesa {m.numero} {m.status === 'aberta' ? '(aberta)' : '(fechada)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowTransfer(false)}>Cancelar</Button>
            <Button onClick={transferPedidos} disabled={!transferTarget} className="gap-2 rounded-xl">
              <ArrowRightLeft className="w-4 h-4" /> Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GarcomPage;
