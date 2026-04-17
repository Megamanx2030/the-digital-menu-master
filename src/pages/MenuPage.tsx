import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { getProductImage, carouselImages } from '@/lib/imageMap';
import { saveCache, readCache, readCacheStale, CACHE_KEYS } from '@/lib/menuCache';
import { ShoppingCart, Plus, Minus, UtensilsCrossed, Beef, Wine, IceCreamCone, ChevronLeft, ChevronRight, Menu, X, Clock, XCircle, ChevronRight as ChevronRightIcon, Info, ShoppingBag, Instagram, Facebook, Globe, MapPin, Phone, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';

interface Categoria {
  id: string;
  nome: string;
  ordem: number;
}

interface Produto {
  id: string;
  categoria_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  disponivel: boolean;
}

interface PedidoEnviado {
  id: string;
  numero_pedido: number;
  status: string;
  created_at: string;
}

interface ItemPedidoEnviado {
  id: string;
  quantidade: number;
  preco_unitario: number;
  observacoes: string | null;
  produtos: { nome: string } | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Entradas': UtensilsCrossed,
  'Pratos Principais': Beef,
  'Bebidas': Wine,
  'Sobremesas': IceCreamCone,
};

const NON_ALCOHOLIC_PRODUCTS = ['Red Bull Energy Drink'];
const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  novo: { label: 'Enviado', color: 'bg-blue-500/20 text-blue-400' },
  preparando: { label: 'Preparando', color: 'bg-amber-500/20 text-amber-400' },
  pronto: { label: 'Pronto', color: 'bg-green-500/20 text-green-400' },
  entregue: { label: 'Entregue', color: 'bg-muted text-muted-foreground' },
  cancelamento_solicitado: { label: 'Cancelamento solicitado', color: 'bg-red-500/20 text-red-400' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400' },
};

const ImageWithSkeleton = ({ src, alt }: { src: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="relative w-28 h-28 flex-shrink-0 overflow-hidden bg-muted" style={{ borderRadius: 12 }}>
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      )}
      <img
        src={src || '/placeholder.svg'}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(true); }}
      />
    </div>
  );
};

const CarouselImage = ({ images }: { images: { src: string; label: string }[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);
  return (
    <div className="relative w-28 h-28 flex-shrink-0 overflow-hidden bg-muted" style={{ borderRadius: 12 }}>
      <div ref={emblaRef} className="overflow-hidden w-full h-full">
        <div className="flex h-full">
          {images.map((img, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 h-full">
              <img src={img.src} alt={img.label} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center gap-1">
        {images.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${i === selectedIndex ? 'bg-gold-light w-3' : 'bg-white/50'}`} />
        ))}
      </div>
      <div className="absolute top-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
        <ChevronLeft className="w-2.5 h-2.5 text-white/70" />
        <ChevronRight className="w-2.5 h-2.5 text-white/70" />
      </div>
    </div>
  );
};

const QuantityControl = ({ quantity, onAdd, onRemove }: { quantity: number; onAdd: () => void; onRemove: () => void }) => {
  if (quantity === 0) {
    return (
      <motion.button whileTap={{ scale: 0.85 }} onClick={onAdd}
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-primary flex items-center justify-center shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
        <Plus className="w-5 h-5 text-primary-foreground" />
      </motion.button>
    );
  }
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="flex items-center justify-between w-full bg-secondary rounded-full px-2 py-1.5">
      <button onClick={onRemove} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-background shadow-sm flex items-center justify-center">
        <Minus className="w-5 h-5 text-foreground" />
      </button>
      <span className="text-lg font-body font-bold text-foreground min-w-[24px] text-center tabular-nums">{quantity}</span>
      <button onClick={onAdd} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-primary shadow-sm flex items-center justify-center">
        <Plus className="w-5 h-5 text-primary-foreground" />
      </button>
    </motion.div>
  );
};

const MenuPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, addItem, updateQuantity, totalItems, totalPrice } = useCart();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [mesaNumero, setMesaNumero] = useState<number>(0);
  const [mesaId, setMesaId] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef<HTMLDivElement>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<'menu' | 'pedidos' | 'sobre'>('menu');
  const [pedidosEnviados, setPedidosEnviados] = useState<PedidoEnviado[]>([]);
  const [itensMap, setItensMap] = useState<Record<string, ItemPedidoEnviado[]>>({});

  // Offline state
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [usingCache, setUsingCache] = useState<boolean>(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(false);
  const offlineBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Banner só aparece se revalidação demorar mais de 3s (evita flash)
  useEffect(() => {
    if (offlineBannerTimeoutRef.current) {
      clearTimeout(offlineBannerTimeoutRef.current);
      offlineBannerTimeoutRef.current = null;
    }

    if (!isOnline) {
      // Offline de verdade: mostra imediatamente
      setShowOfflineBanner(true);
      return;
    }

    if (usingCache) {
      // Revalidação em andamento: espera 3s antes de mostrar
      offlineBannerTimeoutRef.current = setTimeout(() => {
        setShowOfflineBanner(true);
      }, 3000);
    } else {
      // Revalidação terminou com sucesso
      setShowOfflineBanner(false);
    }

    return () => {
      if (offlineBannerTimeoutRef.current) {
        clearTimeout(offlineBannerTimeoutRef.current);
        offlineBannerTimeoutRef.current = null;
      }
    };
  }, [isOnline, usingCache]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const getItemQuantity = useCallback(
    (produtoId: string) => items.find(i => i.produto_id === produtoId)?.quantidade ?? 0,
    [items],
  );

  useEffect(() => {
    if (!id) return;

    // 1) Hydrate instantly from cache (if available) — works even fully offline.
    const cachedMesa = readCache<{ id: string; numero: number }>(CACHE_KEYS.mesa(id))
      ?? readCacheStale<{ id: string; numero: number }>(CACHE_KEYS.mesa(id));
    const cachedCats = readCache<Categoria[]>(CACHE_KEYS.categorias)
      ?? readCacheStale<Categoria[]>(CACHE_KEYS.categorias);
    const cachedProds = readCache<Produto[]>(CACHE_KEYS.produtos)
      ?? readCacheStale<Produto[]>(CACHE_KEYS.produtos);

    if (cachedMesa) { setMesaNumero(cachedMesa.numero); setMesaId(cachedMesa.id); }
    if (cachedCats && cachedCats.length) {
      setCategorias(cachedCats);
      setActiveCategory(prev => prev || cachedCats[0]?.id || '');
    }
    if (cachedProds && cachedProds.length) setProdutos(cachedProds);
    if (cachedMesa || cachedCats || cachedProds) setUsingCache(true);

    // 2) Revalidate in background. If network fails, cached data stays.
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [mesaRes, catsRes, prodsRes] = await Promise.all([
          supabase.from('mesas').select('*').eq('numero', Number(id)).single(),
          supabase.from('categorias').select('*').order('ordem'),
          supabase.from('produtos').select('*').eq('disponivel', true),
        ]);
        if (cancelled) return;

        if (mesaRes.data) {
          setMesaNumero(mesaRes.data.numero);
          setMesaId(mesaRes.data.id);
          saveCache(CACHE_KEYS.mesa(id), { id: mesaRes.data.id, numero: mesaRes.data.numero });
        }
        if (catsRes.data) {
          setCategorias(catsRes.data);
          setActiveCategory(prev => prev || catsRes.data[0]?.id || '');
          saveCache(CACHE_KEYS.categorias, catsRes.data);
        }
        if (prodsRes.data) {
          setProdutos(prodsRes.data);
          saveCache(CACHE_KEYS.produtos, prodsRes.data);
        }
        setUsingCache(false);
      } catch {
        // Network error — keep cached data, flag as offline-ish.
        setUsingCache(true);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  // Fetch sent orders for this table
  const fetchPedidosEnviados = useCallback(async () => {
    if (!mesaId) return;
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('mesa_id', mesaId)
      .in('status', ['novo', 'preparando', 'pronto', 'cancelamento_solicitado'])
      .order('created_at', { ascending: false });
    if (data) {
      setPedidosEnviados(data as PedidoEnviado[]);
      const ids = data.map(p => p.id);
      if (ids.length > 0) {
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('*, produtos(nome)')
          .in('pedido_id', ids);
        if (itens) {
          const map: Record<string, ItemPedidoEnviado[]> = {};
          itens.forEach((item: any) => {
            if (!map[item.pedido_id]) map[item.pedido_id] = [];
            map[item.pedido_id].push(item);
          });
          setItensMap(map);
        }
      }
    }
  }, [mesaId]);

  useEffect(() => {
    if (drawerOpen && mesaId) fetchPedidosEnviados();
  }, [drawerOpen, mesaId, fetchPedidosEnviados]);

  // Realtime updates for orders
  useEffect(() => {
    if (!mesaId) return;
    const channel = supabase
      .channel('menu-pedidos-' + mesaId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => {
        if (drawerOpen) fetchPedidosEnviados();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mesaId, drawerOpen, fetchPedidosEnviados]);

  const solicitarCancelamento = async (pedidoId: string) => {
    await supabase.from('pedidos').update({ status: 'cancelamento_solicitado' as any }).eq('id', pedidoId);
    fetchPedidosEnviados();
  };

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeCategory]);

  const allFiltered = produtos.filter(p => p.categoria_id === activeCategory);
  const filteredProducts = allFiltered.slice(0, visibleCount);
  const hasMore = visibleCount < allFiltered.length;
  const activeCategoryName = categorias.find(c => c.id === activeCategory)?.nome || '';

  useEffect(() => {
    const el = observerRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(prev => prev + PAGE_SIZE);
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, activeCategory]);

  const handleAddItem = (produto: Produto) => {
    addItem({ produto_id: produto.id, nome: produto.nome, preco: produto.preco, imagem_url: getProductImage(produto.nome) });
  };
  const handleRemoveItem = (produtoId: string) => {
    const qty = getItemQuantity(produtoId);
    updateQuantity(produtoId, qty - 1);
  };

  return (
    <div className="h-screen bg-background flex flex-col w-full max-w-full lg:max-w-[430px] mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-3 py-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => { setDrawerView('menu'); setDrawerOpen(true); }} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-display font-bold text-foreground tracking-wide">The Culinary Curator</h1>
            <p className="text-xs text-muted-foreground font-body">Mesa {mesaNumero || id}</p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-display font-bold text-xs">{mesaNumero || id}</span>
        </div>
      </div>

      {/* Offline / cached-data banner */}
      {showOfflineBanner && (
        <div className="flex-shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-3 py-2 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs font-body text-amber-400 leading-tight">
            {!isOnline
              ? 'Você está offline. Mostrando o cardápio salvo. Pedidos serão enviados quando voltar a conexão.'
              : 'Conexão instável. Exibindo cardápio salvo enquanto tentamos atualizar.'}
          </p>
        </div>
      )}

      {/* Drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[85%] max-w-[360px] bg-card z-50 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <h2 className="text-xl font-display font-bold text-foreground">
                  {drawerView === 'menu' ? 'Menu' : drawerView === 'pedidos' ? 'Meus Pedidos' : 'Sobre o Restaurante'}
                </h2>
                <button onClick={() => setDrawerOpen(false)} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {drawerView === 'menu' && (
                <div className="flex-1 p-4 space-y-3">
                  <button
                    onClick={() => { setDrawerView('pedidos'); fetchPedidosEnviados(); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-background border border-border active:scale-[0.98] transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-display font-bold text-foreground text-lg">Meus Pedidos</p>
                      <p className="text-sm text-muted-foreground">Acompanhe seus pedidos enviados</p>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
                  </button>

                  <button
                    onClick={() => setDrawerView('sobre')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-background border border-border active:scale-[0.98] transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-gold-light/20 flex items-center justify-center">
                      <Info className="w-6 h-6 text-gold-light" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-display font-bold text-foreground text-lg">Sobre o Restaurante</p>
                      <p className="text-sm text-muted-foreground">Horários, história e redes sociais</p>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              )}

              {drawerView === 'pedidos' && (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  <button onClick={() => setDrawerView('menu')} className="flex items-center gap-2 px-4 py-3 text-sm text-primary font-body font-semibold border-b border-border">
                    <ChevronLeft className="w-4 h-4" /> Voltar
                  </button>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {pedidosEnviados.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-lg font-body font-semibold text-muted-foreground/50">Nenhum pedido enviado</p>
                        <p className="text-sm text-muted-foreground/40 mt-1">Seus pedidos aparecerão aqui</p>
                      </div>
                    ) : (
                      pedidosEnviados.map(pedido => {
                        const statusInfo = STATUS_LABELS[pedido.status] || STATUS_LABELS.novo;
                        const itens = itensMap[pedido.id] || [];
                        const canCancel = pedido.status === 'novo';
                        const isCancelRequested = pedido.status === 'cancelamento_solicitado';
                        return (
                          <div key={pedido.id} className="bg-background border border-border rounded-xl overflow-hidden">
                            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                              <div>
                                <span className="font-display font-bold text-xl text-foreground">#{pedido.numero_pedido}</span>
                                <span className={`ml-3 text-xs font-body font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground font-body">
                                {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="px-4 py-3 space-y-2">
                              {itens.map(item => (
                                <div key={item.id} className="flex items-center gap-2">
                                  <span className="bg-primary/20 text-primary font-bold text-sm min-w-[28px] h-7 rounded-md flex items-center justify-center">
                                    {item.quantidade}x
                                  </span>
                                  <span className="font-body text-sm text-foreground">{item.produtos?.nome}</span>
                                </div>
                              ))}
                            </div>
                            {canCancel && (
                              <div className="px-4 pb-3">
                                <button
                                  onClick={() => solicitarCancelamento(pedido.id)}
                                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-red-500/15 text-red-400 font-body font-bold text-sm active:scale-95 transition-all"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Solicitar Cancelamento
                                </button>
                              </div>
                            )}
                            {isCancelRequested && (
                              <div className="px-4 pb-3">
                                <p className="text-center text-sm font-body font-semibold text-red-400 animate-pulse">
                                  ⏳ Aguardando resposta da cozinha...
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {drawerView === 'sobre' && (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  <button onClick={() => setDrawerView('menu')} className="flex items-center gap-2 px-4 py-3 text-sm text-primary font-body font-semibold border-b border-border">
                    <ChevronLeft className="w-4 h-4" /> Voltar
                  </button>
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* História */}
                    <div>
                      <h3 className="font-display font-bold text-foreground text-lg mb-2">Nossa História</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed font-body">
                        O The Culinary Curator nasceu da paixão por reunir sabores autênticos e experiências
                        gastronômicas memoráveis. Cada prato é cuidadosamente elaborado com ingredientes
                        selecionados, trazendo o melhor da culinária contemporânea em um ambiente acolhedor
                        e sofisticado.
                      </p>
                    </div>

                    {/* Horários */}
                    <div>
                      <h3 className="font-display font-bold text-foreground text-lg mb-3">Horários de Funcionamento</h3>
                      <div className="space-y-2">
                        {[
                          { day: 'Segunda a Quinta', hours: '11:30 – 15:00 / 18:00 – 23:00' },
                          { day: 'Sexta e Sábado', hours: '11:30 – 00:00' },
                          { day: 'Domingo', hours: '11:30 – 16:00' },
                        ].map(item => (
                          <div key={item.day} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                            <span className="text-sm font-body font-semibold text-foreground">{item.day}</span>
                            <span className="text-sm text-muted-foreground font-body">{item.hours}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contato */}
                    <div>
                      <h3 className="font-display font-bold text-foreground text-lg mb-3">Contato</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-background border border-border">
                          <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground font-body">Rua da Gastronomia, 123 — Centro</span>
                        </div>
                        <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-background border border-border">
                          <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground font-body">(11) 99999-0000</span>
                        </div>
                      </div>
                    </div>

                    {/* Redes Sociais */}
                    <div>
                      <h3 className="font-display font-bold text-foreground text-lg mb-3">Redes Sociais</h3>
                      <div className="flex gap-3">
                        <a href="#" className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-primary/10 transition-colors">
                          <Instagram className="w-5 h-5 text-foreground" />
                        </a>
                        <a href="#" className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-primary/10 transition-colors">
                          <Facebook className="w-5 h-5 text-foreground" />
                        </a>
                        <a href="#" className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-primary/10 transition-colors">
                          <Globe className="w-5 h-5 text-foreground" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden w-full">
        {/* Sidebar */}
        <nav className="w-[90px] flex-shrink-0 bg-card border-r border-border flex flex-col items-center py-3 gap-2.5 overflow-y-auto px-1.5">
          {categorias.map(cat => {
            const Icon = CATEGORY_ICONS[cat.nome] || UtensilsCrossed;
            const isActive = activeCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className="w-full flex flex-col items-center gap-2 py-3 px-1 transition-all duration-200"
                style={{
                  borderRadius: 16,
                  backgroundColor: isActive ? 'hsl(30 25% 28%)' : 'hsl(30 10% 22%)',
                  color: isActive ? 'hsl(var(--gold-light))' : 'hsl(var(--muted-foreground))',
                  boxShadow: isActive ? '0 0 14px hsl(30 43% 52% / 0.4), inset 0 0 0 1.5px hsl(30 43% 52% / 0.3)' : '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                  border: isActive ? 'none' : '1px solid hsl(20 12% 26%)',
                }}>
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-body font-semibold leading-tight text-center">{cat.nome}</span>
              </button>
            );
          })}
        </nav>

        {/* Products */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain pb-28 px-2.5 pt-3 w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeCategory} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="w-full">
              <h2 className="text-lg font-display font-semibold text-foreground mb-3 px-1">{activeCategoryName}</h2>
              <div className="flex flex-col gap-3 w-full">
                {(() => {
                  const alcoholic = filteredProducts.filter(p => !NON_ALCOHOLIC_PRODUCTS.includes(p.nome));
                  const nonAlcoholic = filteredProducts.filter(p => NON_ALCOHOLIC_PRODUCTS.includes(p.nome));
                  const combined = [...alcoholic, ...(nonAlcoholic.length > 0 ? [null, ...nonAlcoholic] : [])];
                  return combined.map((produto, i) => {
                    if (produto === null) {
                      return <h3 key="sub-header" className="text-base font-display font-semibold text-gold-light mt-4 mb-1 px-1">Bebidas Não Alcoólicas</h3>;
                    }
                    const qty = getItemQuantity(produto.id);
                    return (
                      <motion.div key={produto.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i < PAGE_SIZE ? i * 0.05 : 0 }}
                        className="bg-card border border-border overflow-hidden p-3 w-full" style={{ borderRadius: 16 }}>
                        <div className="flex gap-3 w-full">
                          {carouselImages[produto.nome] ? (
                            <CarouselImage images={carouselImages[produto.nome]} />
                          ) : (
                            <ImageWithSkeleton src={getProductImage(produto.nome) || '/placeholder.svg'} alt={produto.nome} />
                          )}
                          <div className="flex-1 flex flex-col min-w-0">
                            <h3 className="font-body font-bold text-foreground text-lg leading-tight">{produto.nome}</h3>
                            <p className="text-base text-muted-foreground mt-1 leading-relaxed">{produto.descricao}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between w-full">
                          <span className="text-gold-light font-bold font-body text-base whitespace-nowrap">R$ {produto.preco.toFixed(2).replace('.', ',')}</span>
                          {qty === 0 && <QuantityControl quantity={qty} onAdd={() => handleAddItem(produto)} onRemove={() => handleRemoveItem(produto.id)} />}
                        </div>
                        {qty > 0 && (
                          <div className="mt-2.5 w-full">
                            <QuantityControl quantity={qty} onAdd={() => handleAddItem(produto)} onRemove={() => handleRemoveItem(produto.id)} />
                          </div>
                        )}
                      </motion.div>
                    );
                  });
                })()}
              </div>
              {hasMore && (
                <div ref={observerRef} className="flex justify-center py-6 w-full">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Cart bar */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="absolute bottom-0 left-0 right-0 z-40 w-full max-w-full lg:max-w-[430px] mx-auto px-3 pb-3 pointer-events-none">
            <button onClick={() => navigate(`/mesa/${id}/carrinho`)}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 px-4 flex items-center justify-between font-body font-bold shadow-lg shadow-primary/30 text-sm pointer-events-auto">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold leading-none">{totalItems}</span>
                </div>
                <span>Ver Carrinho</span>
              </div>
              <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenuPage;
