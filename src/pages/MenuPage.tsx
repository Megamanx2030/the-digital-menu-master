import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { getProductImage } from '@/lib/imageMap';
import { ShoppingCart, Plus, Check, UtensilsCrossed, Beef, Wine, IceCreamCone } from 'lucide-react';
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

const ImageWithSkeleton = ({ src, alt }: { src: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full aspect-[4/3] rounded-t-lg overflow-hidden">
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse overflow-hidden">
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

const MenuPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, totalItems, totalPrice } = useCart();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [mesaNumero, setMesaNumero] = useState<number>(0);
  const [addedId, setAddedId] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingByClick = useRef(false);

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

  // Track active category on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingByClick.current) return;
      for (const cat of [...categorias].reverse()) {
        const el = categoryRefs.current[cat.id];
        if (el) {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (rect.top <= containerRect.top + 80) {
            setActiveCategory(cat.id);
            break;
          }
        }
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [categorias]);

  const handleAddItem = (produto: Produto) => {
    addItem({
      produto_id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem_url: getProductImage(produto.nome),
    });
    setAddedId(produto.id);
    setTimeout(() => setAddedId(null), 600);
  };

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    isScrollingByClick.current = true;
    const el = categoryRefs.current[catId];
    const container = scrollContainerRef.current;
    if (el && container) {
      const containerTop = container.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      const offset = container.scrollTop + (elTop - containerTop) - 16;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
    setTimeout(() => { isScrollingByClick.current = false; }, 800);
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col max-w-[430px] mx-auto overflow-hidden">
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

      {/* Main content with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - categories */}
        <nav className="w-[72px] flex-shrink-0 bg-card border-r border-border flex flex-col items-center py-3 gap-1 overflow-y-auto">
          {categorias.map(cat => {
            const Icon = CATEGORY_ICONS[cat.nome] || UtensilsCrossed;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`w-[60px] flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-body font-medium leading-tight text-center line-clamp-2">
                  {cat.nome}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Right content - products */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pb-28 px-3 pt-3"
        >
          {categorias.map(cat => {
            const catProducts = produtos.filter(p => p.categoria_id === cat.id);
            return (
              <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el; }} className="mb-6">
                <h2 className="text-base font-display font-semibold text-foreground mb-3 px-1">{cat.nome}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {catProducts.map((produto, i) => (
                    <motion.div
                      key={produto.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="relative bg-card rounded-lg overflow-visible border border-border"
                    >
                      <ImageWithSkeleton
                        src={getProductImage(produto.nome) || '/placeholder.svg'}
                        alt={produto.nome}
                      />
                      <div className="p-2.5 pb-3">
                        <h3 className="font-body font-semibold text-foreground text-xs leading-tight line-clamp-2">{produto.nome}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{produto.descricao}</p>
                        <span className="text-gold-light font-bold font-body text-sm mt-1.5 block">
                          R$ {produto.preco.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      {/* FAB add button */}
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleAddItem(produto)}
                        className={`absolute -bottom-2 -right-2 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shadow-lg transition-colors z-10 ${
                          addedId === produto.id
                            ? 'bg-[hsl(var(--kds-green))] shadow-[hsl(var(--kds-green))]/30'
                            : 'bg-primary shadow-primary/40 hover:bg-primary/90'
                        }`}
                      >
                        <AnimatePresence mode="wait">
                          {addedId === produto.id ? (
                            <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </motion.span>
                          ) : (
                            <motion.span key="plus" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <Plus className="w-4 h-4 text-primary-foreground" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart bar */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="absolute bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto px-3 pb-3"
          >
            <button
              onClick={() => navigate(`/mesa/${id}/carrinho`)}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 px-4 flex items-center justify-between font-body font-bold shadow-lg shadow-primary/30 text-sm"
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
