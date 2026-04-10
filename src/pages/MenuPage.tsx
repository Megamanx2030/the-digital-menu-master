import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { getProductImage } from '@/lib/imageMap';
import { ShoppingCart, Plus, Check } from 'lucide-react';
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

const ImageWithSkeleton = ({ src, alt }: { src: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-24 h-24 rounded-md overflow-hidden flex-shrink-0">
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
  const tabsRef = useRef<HTMLDivElement>(null);
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
    const handleScroll = () => {
      if (isScrollingByClick.current) return;
      const headerHeight = 140;
      for (const cat of [...categorias].reverse()) {
        const el = categoryRefs.current[cat.id];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= headerHeight + 20) {
            setActiveCategory(cat.id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
    if (el) {
      const headerHeight = 140;
      const y = el.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setTimeout(() => { isScrollingByClick.current = false; }, 800);
  }, []);

  // Scroll active tab into view
  useEffect(() => {
    if (!tabsRef.current || !activeCategory) return;
    const activeBtn = tabsRef.current.querySelector(`[data-cat-id="${activeCategory}"]`) as HTMLElement;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  return (
    <div className="min-h-screen bg-background pb-24 max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-foreground tracking-wide">The Culinary Curator</h1>
            <p className="text-sm text-muted-foreground font-body">Mesa {mesaNumero || id}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-display font-bold text-sm">{mesaNumero || id}</span>
          </div>
        </div>

        {/* Category tabs - sticky */}
        <div
          ref={tabsRef}
          className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4"
        >
          {categorias.map(cat => (
            <button
              key={cat.id}
              data-cat-id={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-body font-medium whitespace-nowrap transition-all duration-300 ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="px-4 pt-4 space-y-8">
        {categorias.map(cat => {
          const catProducts = produtos.filter(p => p.categoria_id === cat.id);
          return (
            <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el; }}>
              <h2 className="text-lg font-display font-semibold text-foreground mb-3">{cat.nome}</h2>
              <div className="space-y-3">
                {catProducts.map((produto, i) => (
                  <motion.div
                    key={produto.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="relative flex gap-3 bg-card rounded-lg overflow-visible border border-border p-3"
                  >
                    <ImageWithSkeleton
                      src={getProductImage(produto.nome) || '/placeholder.svg'}
                      alt={produto.nome}
                    />
                    <div className="flex-1 flex flex-col justify-between min-w-0 pr-6">
                      <div>
                        <h3 className="font-body font-semibold text-foreground text-sm">{produto.nome}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{produto.descricao}</p>
                      </div>
                      <span className="text-gold-light font-bold font-body text-base mt-2">
                        R$ {produto.preco.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    {/* FAB add button */}
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleAddItem(produto)}
                      className={`absolute -bottom-2 -right-2 w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center shadow-lg transition-colors z-10 ${
                        addedId === produto.id
                          ? 'bg-[hsl(var(--kds-green))] shadow-[hsl(var(--kds-green))]/30'
                          : 'bg-primary shadow-primary/40 hover:bg-primary/90'
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {addedId === produto.id ? (
                          <motion.span
                            key="check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                          >
                            <Check className="w-5 h-5 text-primary-foreground" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="plus"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                          >
                            <Plus className="w-5 h-5 text-primary-foreground" />
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

      {/* Cart bar */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-40"
          >
            <div className="max-w-[430px] mx-auto px-4 pb-4">
              <button
                onClick={() => navigate(`/mesa/${id}/carrinho`)}
                className="w-full bg-primary text-primary-foreground rounded-xl py-4 px-5 flex items-center justify-between font-body font-bold shadow-lg shadow-primary/30"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {totalItems}
                    </span>
                  </div>
                  <span>Ver Carrinho</span>
                </div>
                <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenuPage;
