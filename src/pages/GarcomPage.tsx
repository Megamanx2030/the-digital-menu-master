import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Minus, ArrowRightLeft, X, Check, ChefHat,
  Clock, ShoppingBag, Coffee, Search, DoorOpen, DoorClosed, Trash2
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
      // fetch items for each order
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
  const mesaPedidos = (mesaId: string) => pedidos.filter(p => p.mesa_id === mesaId);
  const mesaTotal = (mesaId: string) => {
    let total = 0;
    mesaPedidos(mesaId).forEach(p => {
      (itensPedido[p.id] || []).forEach(i => { total += i.quantidade * i.preco_unitario; });
    });
    return total;
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'novo': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'preparando': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'pronto': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'novo': return 'Novo';
      case 'preparando': return 'Preparando';
      case 'pronto': return 'Pronto';
      case 'entregue': return 'Entregue';
      default: return s;
    }
  };

  /* ── actions ── */
  const toggleMesa = async (mesa: Mesa) => {
    const newStatus = mesa.status === 'aberta' ? 'fechada' : 'aberta';
    if (newStatus === 'fechada') {
      // Mark all active orders as "entregue" when closing
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
    // Open target mesa if closed
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
    // Open mesa if closed
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

  const removeItem = async (itemId: string, pedidoId: string) => {
    const { error } = await supabase.from('itens_pedido').delete().eq('id', itemId);
    if (error) {
      toast.error('Erro ao remover item: ' + error.message);
      return;
    }
    // Check if pedido has remaining items
    const { data: remaining } = await supabase
      .from('itens_pedido')
      .select('id')
      .eq('pedido_id', pedidoId);
    if (!remaining || remaining.length === 0) {
      await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedidoId);
      toast.success('Item removido — pedido cancelado (sem itens)');
    } else {
      toast.success('Item removido do pedido');
    }
    fetchPedidos();
  };

  const cancelPedido = async (pedido: Pedido) => {
    const { error: errItems } = await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id);
    if (errItems) {
      toast.error('Erro ao remover itens: ' + errItems.message);
      return;
    }
    const { error: errPedido } = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedido.id);
    if (errPedido) {
      toast.error('Erro ao cancelar pedido: ' + errPedido.message);
      return;
    }
    toast.success(`Pedido #${pedido.numero_pedido} cancelado`);
    fetchPedidos();
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
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground">Painel do Garçom</h1>
              <p className="text-xs text-muted-foreground">The Culinary Curator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Coffee className="w-3 h-3 mr-1" />
              {mesas.filter(m => m.status === 'aberta').length} mesas abertas
            </Badge>
          </div>
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
            const hasNew = pedidosMesa.some(p => p.status === 'novo');
            const hasReady = pedidosMesa.some(p => p.status === 'pronto');

            return (
              <motion.div
                key={mesa.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`
                  relative rounded-xl border-2 p-4 cursor-pointer transition-all
                  ${isOpen
                    ? 'bg-primary/5 border-primary/30 shadow-lg shadow-primary/5'
                    : 'bg-card border-border/50 opacity-70'}
                  ${hasReady ? 'ring-2 ring-green-500/50 animate-pulse' : ''}
                  ${hasNew ? 'ring-2 ring-blue-500/30' : ''}
                `}
                onClick={() => setSelectedMesa(mesa)}
              >
                {/* Status dot */}
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />

                <div className="text-center">
                  <span className="font-display text-2xl font-bold text-foreground">
                    {mesa.numero}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                    {isOpen ? 'Aberta' : 'Fechada'}
                  </p>
                </div>

                {hasOrders && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-center gap-1">
                      <ShoppingBag className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{pedidosMesa.length} pedido{pedidosMesa.length > 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-center text-sm font-bold text-primary">
                      R$ {total.toFixed(2).replace('.', ',')}
                    </p>
                    <div className="flex justify-center gap-1 flex-wrap">
                      {pedidosMesa.map(p => (
                        <span key={p.id} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${statusColor(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Mesa Detail Dialog */}
      <Dialog open={!!selectedMesa && !showNewOrder && !showTransfer} onOpenChange={() => setSelectedMesa(null)}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] flex flex-col">
          {selectedMesa && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-3">
                  Mesa {selectedMesa.numero}
                  <Badge variant={selectedMesa.status === 'aberta' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                    {selectedMesa.status === 'aberta' ? 'Aberta' : 'Fechada'}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
                {/* Active orders */}
                {mesaPedidos(selectedMesa.id).length > 0 ? (
                  <div className="space-y-4">
                    {mesaPedidos(selectedMesa.id).map(pedido => (
                      <div key={pedido.id} className="rounded-xl border border-border bg-background p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-body font-bold text-base">Pedido #{pedido.numero_pedido}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusColor(pedido.status)}`}>
                              {statusLabel(pedido.status)}
                            </span>
                            <button
                              onClick={() => cancelPedido(pedido)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors"
                              title="Excluir pedido inteiro"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                              <span className="text-xs text-destructive font-medium">Excluir pedido</span>
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {(itensPedido[pedido.id] || []).map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm text-muted-foreground group">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{item.quantidade}x {item.produtos?.nome}</span>
                                {item.observacoes && (
                                  <span className="text-xs text-amber-400/80 italic mt-0.5">💬 {item.observacoes}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold">R$ {(item.quantidade * item.preco_unitario).toFixed(2).replace('.', ',')}</span>
                                <button
                                  onClick={() => removeItem(item.id, pedido.id)}
                                  className="w-7 h-7 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center opacity-60 hover:opacity-100 transition-all"
                                  title="Remover item"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {pedido.observacoes && (
                          <p className="text-xs text-muted-foreground mt-3 italic border-t border-border/50 pt-2">💬 {pedido.observacoes}</p>
                        )}
                      </div>
                    ))}

                    <div className="flex justify-between items-center pt-3 border-t border-border">
                      <span className="font-body font-bold text-base text-foreground">Total da Mesa</span>
                      <span className="font-body font-bold text-xl text-primary">
                        R$ {mesaTotal(selectedMesa.id).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-base">Nenhum pedido ativo</p>
                  </div>
                )}
              </ScrollArea>

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  className="w-full gap-2"
                  onClick={() => setShowNewOrder(true)}
                >
                  <Plus className="w-4 h-4" /> Novo Pedido
                </Button>

                {mesaPedidos(selectedMesa.id).length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setShowTransfer(true)}
                  >
                    <ArrowRightLeft className="w-4 h-4" /> Transferir Mesa
                  </Button>
                )}

                <Button
                  variant={selectedMesa.status === 'aberta' ? 'destructive' : 'secondary'}
                  className="w-full gap-2"
                  onClick={() => { toggleMesa(selectedMesa); setSelectedMesa(null); }}
                >
                  {selectedMesa.status === 'aberta' ? (
                    <><DoorClosed className="w-4 h-4" /> Fechar Mesa</>
                  ) : (
                    <><DoorOpen className="w-4 h-4" /> Abrir Mesa</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={showNewOrder} onOpenChange={(open) => { if (!open) { setShowNewOrder(false); setNewOrderItems([]); setSearchTerm(''); setOrderObs(''); } }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="font-display text-xl">
              Novo Pedido — Mesa {selectedMesa?.numero}
            </DialogTitle>
          </DialogHeader>

          {/* Search + Category filter */}
          <div className="px-5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-background text-base h-12"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`text-sm px-4 py-2 rounded-full whitespace-nowrap transition-all font-medium ${!selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >
                Todos
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-sm px-4 py-2 rounded-full whitespace-nowrap transition-all font-medium ${selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                >
                  {cat.nome}
                </button>
              ))}
            </div>
          </div>

          {/* Products list */}
          <ScrollArea className="flex-1 px-5 min-h-0" style={{ maxHeight: '35vh' }}>
            <div className="space-y-2 py-2">
              {filteredProdutos.map(produto => {
                const inOrder = newOrderItems.find(i => i.produto.id === produto.id);
                return (
                  <div key={produto.id} className="rounded-xl bg-background border border-border/50 hover:border-primary/30 transition-colors overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <img
                        src={getProductImage(produto.nome) || '/placeholder.svg'}
                        alt={produto.nome}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">{produto.nome}</p>
                        <p className="text-sm text-primary font-bold">
                          R$ {produto.preco.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      {inOrder ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateNewOrderQty(produto.id, -1)}
                            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-base font-bold w-7 text-center">{inOrder.quantidade}</span>
                          <button
                            onClick={() => updateNewOrderQty(produto.id, 1)}
                            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4 text-primary-foreground" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToNewOrder(produto)}
                          className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                          <Plus className="w-5 h-5 text-primary" />
                        </button>
                      )}
                    </div>
                    {/* Per-item observation field */}
                    {inOrder && (
                      <div className="px-3 pb-3 pt-0">
                        <Input
                          placeholder="Obs: sem cebola, bem passado..."
                          value={inOrder.observacoes}
                          onChange={e => {
                            const val = e.target.value;
                            setNewOrderItems(prev => prev.map(i =>
                              i.produto.id === produto.id ? { ...i, observacoes: val } : i
                            ));
                          }}
                          className="bg-card/50 text-sm h-9 border-border/30 placeholder:text-muted-foreground/50"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Order summary */}
          {newOrderItems.length > 0 && (
            <div className="border-t border-border px-4 pt-3 pb-2 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {newOrderItems.map(item => (
                  <Badge key={item.produto.id} variant="secondary" className="gap-1 text-xs">
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
                className="bg-background text-xs min-h-[60px]"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">
                  Total: R$ {newOrderTotal.toFixed(2).replace('.', ',')}
                </span>
                <Button onClick={submitNewOrder} className="gap-2">
                  <Check className="w-4 h-4" /> Enviar Pedido
                </Button>
              </div>
            </div>
          )}

          {newOrderItems.length === 0 && (
            <div className="px-4 pb-4">
              <Button variant="outline" className="w-full" onClick={() => setShowNewOrder(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={(open) => { if (!open) { setShowTransfer(false); setTransferTarget(''); } }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Transferir Pedidos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Transferir todos os pedidos da <strong>Mesa {selectedMesa?.numero}</strong> para:
          </p>
          <Select value={transferTarget} onValueChange={setTransferTarget}>
            <SelectTrigger className="bg-background">
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
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Cancelar</Button>
            <Button onClick={transferPedidos} disabled={!transferTarget} className="gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GarcomPage;
