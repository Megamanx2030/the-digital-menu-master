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

const CATEGORY_EMOJIS: Record<string, string> = {
  'Entradas': '🥗',
  'Pratos Principais': '🍝',
  'Bebidas': '🍷',
  'Sobremesas': '🍦',
};

const ImageWithSkeleton = ({ src, alt }: { src: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-brown-dark/50">
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-brown-dark border-b border-border/30 px-4 py-3 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex-1">
          <h1 className="text-base font-display font-bold text-cream tracking-wide">The Culinary Curator</h1>
          <p className="text-[11px] text-cream/60 font-body">Mesa <span className="text-gold font-semibold">{mesaNumero || id}</span></p>
        </div>
        <button
          onClick={() => totalItems > 0 ? navigate(`/mesa/${id}/carrinho`) : undefined}
          className="relative w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center"
        >
          <ShoppingCart className="w-5 h-5 text-gold" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
              {totalItems}
            </span>
          )}
        </button>
      </header>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <nav className="w-20 flex-shrink-0 bg-brown-dark flex flex-col items-center py-4 gap-2 overflow-y-auto border-r border-border/20">
          {categorias.map(cat => {
            const emoji = CATEGORY_EMOJIS[cat.nome] || '🍽️';
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`w-[68px] flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gold/25 shadow-md'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="text-2xl leading-none">{emoji}</span>
                <span className={`text-[9px] font-body font-medium leading-tight text-center line-clamp-2 ${
                  isActive ? 'text-gold' : 'text-cream/50'
                }`}>
                  {cat.nome}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Products grid */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pb-24 px-3 pt-3 bg-background"
        >
          {categorias.map(cat => {
            const catProducts = produtos.filter(p => p.categoria_id === cat.id);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el; }} className="mb-6">
                <h2 className="text-sm font-display font-semibold text-cream mb-3 px-1">{cat.nome}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {catProducts.map((produto, i) => (
                    <motion.div
                      key={produto.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="relative bg-card rounded-xl overflow-visible border border-border/40"
                    >
                      <div className="p-2">
                        <ImageWithSkeleton
                          src={getProductImage(produto.nome) || '/placeholder.svg'}
                          alt={produto.nome}
                        />
                      </div>
                      <div className="px-2.5 pb-3 text-center">
                        <h3 className="font-body font-semibold text-cream text-xs leading-tight line-clamp-2 mb-1">
                          {produto.nome}
                        </h3>
                        <span className="text-gold font-bold font-body text-sm block">
                          R$ {produto.preco.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      {/* FAB */}
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleAddItem(produto)}
                        className={`absolute -bottom-2 -right-2 w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center shadow-lg transition-colors z-10 ${
                          addedId === produto.id
                            ? 'bg-[hsl(var(--kds-green))] shadow-[hsl(var(--kds-green))]/30'
                            : 'bg-gold shadow-gold/40 hover:bg-gold/90'
                        }`}
                      >
                        <AnimatePresence mode="wait">
                          {addedId === produto.id ? (
                            <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <Check className="w-5 h-5 text-brown-dark" />
                            </motion.span>
                          ) : (
                            <motion.span key="plus" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <Plus className="w-5 h-5 text-brown-dark" />
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
            className="absolute bottom-0 left-20 right-0 z-40 px-3 pb-3"
          >
            <button
              onClick={() => navigate(`/mesa/${id}/carrinho`)}
              className="w-full bg-gold text-brown-dark rounded-xl py-3.5 px-4 flex items-center justify-between font-body font-bold shadow-lg shadow-gold/30 text-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
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
