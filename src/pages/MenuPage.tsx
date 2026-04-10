import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { getProductImage } from '@/lib/imageMap';
import { ShoppingCart, Plus, Minus, UtensilsCrossed, Beef, Wine, IceCreamCone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Entradas': UtensilsCrossed,
  'Pratos Principais': Beef,
  'Bebidas': Wine,
  'Sobremesas': IceCreamCone,
};

const PAGE_SIZE = 20;

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

const QuantityControl = ({
  quantity,
  onAdd,
  onRemove,
}: {
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) => {
  if (quantity === 0) {
    return (
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={onAdd}
        className="flex items-center justify-center gap-1.5 bg-primary rounded-full px-4 py-1.5 transition-colors hover:bg-primary/90 z-10 relative"
      >
        <Plus className="w-4 h-4 text-primary-foreground" />
        <span className="text-xs font-body font-bold text-primary-foreground">Adicionar</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-3 bg-secondary rounded-full p-1 z-10 relative"
    >
      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-full bg-background shadow-sm flex items-center justify-center"
      >
        <Minus className="w-4 h-4 text-foreground" />
      </button>
      <span className="text-sm font-body font-bold text-foreground min-w-[20px] text-center tabular-nums">
        {quantity}
      </span>
      <button
        onClick={onAdd}
        className="w-8 h-8 rounded-full bg-primary shadow-sm flex items-center justify-center"
      >
        <Plus className="w-4 h-4 text-primary-foreground" />
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef<HTMLDivElement>(null);

  const getItemQuantity = useCallback(
    (produtoId: string) => items.find(i => i.produto_id === produtoId)?.quantidade ?? 0,
    [items],
  );

  useEffect(() => {
    const fetchData = async () => {
      const { data: mesa } = await supabase.from('mesas').select('*').eq('numero', Number(id)).single();
      if (mesa) setMesaNumero(mesa.numero);

      const { data: cats } = await supabase.from('categorias').select('*').order('ordem');
      if (cats) {
        setCategorias(cats);
        setActiveCategory(cats[0]?.id || '');
      }

      const { data: prods } = await supabase.from('produtos').select('*').eq('disponivel', true);
      if (prods) setProdutos(prods);
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory]);

  const allFiltered = produtos.filter(p => p.categoria_id === activeCategory);
  const filteredProducts = allFiltered.slice(0, visibleCount);
  const hasMore = visibleCount < allFiltered.length;
  const activeCategoryName = categorias.find(c => c.id === activeCategory)?.nome || '';

  useEffect(() => {
    const el = observerRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, activeCategory]);

  const handleAddItem = (produto: Produto) => {
    addItem({
      produto_id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem_url: getProductImage(produto.nome),
    });
  };

  const handleRemoveItem = (produtoId: string) => {
    const qty = getItemQuantity(produtoId);
    updateQuantity(produtoId, qty - 1);
  };

  return (
    <div className="h-screen bg-background flex flex-col w-full max-w-full lg:max-w-[430px] mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 flex items-center justify-between flex-shrink-0 z-20">
        <div>
          <h1 className="text-lg font-display font-bold text-foreground tracking-wide">The Culinary Curator</h1>
          <p className="text-xs text-muted-foreground font-body">Mesa {mesaNumero || id}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-display font-bold text-xs">{mesaNumero || id}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden w-full">
        {/* Sidebar Vertical (Ligeiramente mais fina para dar espaço aos cards) */}
        <nav className="w-[90px] flex-shrink-0 bg-card border-r border-border flex flex-col items-center py-3 gap-2.5 overflow-y-auto px-1.5">
          {categorias.map(cat => {
            const Icon = CATEGORY_ICONS[cat.nome] || UtensilsCrossed;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="w-full flex flex-col items-center gap-2 py-3 px-1 transition-all duration-200"
                style={{
                  borderRadius: 16,
                  backgroundColor: isActive ? 'hsl(30 25% 28%)' : 'hsl(30 10% 22%)',
                  color: isActive ? 'hsl(var(--gold-light))' : 'hsl(var(--muted-foreground))',
                  boxShadow: isActive
                    ? '0 0 14px hsl(30 43% 52% / 0.4), inset 0 0 0 1.5px hsl(30 43% 52% / 0.3)'
                    : '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                  border: isActive ? 'none' : '1px solid hsl(20 12% 26%)',
                }}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-body font-semibold leading-tight text-center">
                  {cat.nome}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Área de Produtos com Rolagem Livre (Swipe nativo liberado em toda a div) */}
        <div 
          className="flex-1 overflow-y-auto overscroll-y-contain pb-28 px-2.5 pt-3 w-full"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <h2 className="text-lg font-display font-semibold text-foreground mb-3 px-1">
                {activeCategoryName}
              </h2>
              <div className="flex flex-col gap-3 w-full">
                {filteredProducts.map((produto, i) => {
                  const qty = getItemQuantity(produto.id);
                  return (
                    <motion.div
                      key={produto.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i < PAGE_SIZE ? i * 0.05 : 0 }}
                      className="bg-card border border-border overflow-hidden flex gap-2.5 p-2.5 w-full"
                      style={{ borderRadius: 16 }}
                    >
                      {/* Quadrado da Imagem Fixo */}
                      <ImageWithSkeleton
                        src={getProductImage(produto.nome) || '/placeholder.svg'}
                        alt={produto.nome}
                      />
                      
                      {/* Textos e Botões esticados até a direita */}
                      <div className="flex-1 flex flex-col min-w-0 w-full justify-between">
                        <div className="w-full pr-1">
                          <h3 className="font-body font-bold text-foreground text-sm leading-tight line-clamp-2 w-full">
                            {produto.nome}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2 w-full">
                            {produto.descricao}
                          </p>
                        </div>
                        
                        {/* Preço na esquerda, Botão na extremidade direita */}
                        <div className="mt-2 flex items-center justify-between w-full">
                          <span className="text-gold-light font-bold font-body text-sm whitespace-nowrap">
                            R$ {produto.preco.toFixed(2).replace('.', ',')}
                          </span>

                          <div className="flex-shrink-0">
                            <QuantityControl
                              quantity={qty}
                              onAdd={() => handleAddItem(produto)}
                              onRemove={() => handleRemoveItem(produto.id)}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
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

      {/* Carrinho flutuante */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="absolute bottom-0 left-0 right-0 z-40 w-full max-w-full lg:max-w-[430px] mx-auto px-3 pb-3 pointer-events-none"
          >
            <button
              onClick={() => navigate(`/mesa/${id}/carrinho`)}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 px-4 flex items-center justify-between font-body font-bold shadow-lg shadow-primary/30 text-sm pointer-events-auto"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold leading-none">
                    {totalItems}
                  </span>
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
