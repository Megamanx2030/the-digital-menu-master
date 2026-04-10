import { useEffect, useState, useCallback } from 'react';
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

const ImageWithSkeleton = ({ src, alt }: { src: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full aspect-[16/10] overflow-hidden" style={{ borderRadius: '12px 12px 0 0' }}>
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

/* ─── Quantity control (inline, estilo do carrinho) ─── */
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
        className="w-full mt-2 flex items-center justify-center gap-1.5 bg-primary rounded-full py-2 transition-colors hover:bg-primary/90"
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
      className="w-full mt-2 flex items-center justify-between bg-secondary rounded-full px-1 py-1"
    >
      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-full bg-background flex items-center justify-center"
      >
        <Minus className="w-3.5 h-3.5 text-foreground" />
      </button>
      <span className="text-sm font-body font-bold text-foreground tabular-nums">
        {quantity}
      </span>
      <button
        onClick={onAdd}
        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
      >
        <Plus className="w-3.5 h-3.5 text-primary-foreground" />
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

  const filteredProducts = produtos.filter(p => p.categoria_id === activeCategory);
  const activeCategoryName = categorias.find(c => c.id === activeCategory)?.nome || '';

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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-[82px] flex-shrink-0 bg-card border-r border-border flex flex-col items-center py-3 gap-2 overflow-y-auto">
          {categorias.map(cat => {
            const Icon = CATEGORY_ICONS[cat.nome] || UtensilsCrossed;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="w-[70px] flex flex-col items-center gap-1.5 py-3 px-1 transition-all duration-200"
                style={{
                  borderRadius: '9999px',
                  backgroundColor: isActive ? 'hsl(30 30% 25%)' : 'transparent',
                  color: isActive ? 'hsl(var(--gold-light))' : 'hsl(var(--muted-foreground))',
                  boxShadow: isActive
                    ? '0 0 10px hsl(30 43% 52% / 0.35), inset 0 0 0 1px hsl(30 43% 52% / 0.25)'
                    : 'none',
                }}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[11px] font-body font-semibold leading-tight text-center line-clamp-2">
                  {cat.nome}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Products */}
        <div className="flex-1 overflow-y-auto pb-28 px-3 pt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-lg font-display font-semibold text-foreground mb-3 px-1">
                {activeCategoryName}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {filteredProducts.map((produto, i) => {
                  const qty = getItemQuantity(produto.id);
                  return (
                    <motion.div
                      key={produto.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="bg-card border border-border overflow-hidden"
                      style={{ borderRadius: 12 }}
                    >
                      <ImageWithSkeleton
                        src={getProductImage(produto.nome) || '/placeholder.svg'}
                        alt={produto.nome}
                      />
                      <div className="p-2.5 pb-3">
                        <h3 className="font-body font-semibold text-foreground text-sm leading-tight line-clamp-2">
                          {produto.nome}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {produto.descricao}
                        </p>
                        <span className="text-gold-light font-bold font-body text-base mt-1 block">
                          R$ {produto.preco.toFixed(2).replace('.', ',')}
                        </span>

                        <QuantityControl
                          quantity={qty}
                          onAdd={() => handleAddItem(produto)}
                          onRemove={() => handleRemoveItem(produto.id)}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
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
