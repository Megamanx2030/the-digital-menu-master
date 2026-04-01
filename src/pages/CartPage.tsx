import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Minus, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const CartPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, updateQuantity, updateObservacoes, removeItem, totalPrice, clearCart } = useCart();

  const handleConfirm = async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: mesa } = await supabase.from('mesas').select('id').eq('numero', Number(id)).single();
    if (!mesa) return;

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .insert({ mesa_id: mesa.id, status: 'novo' })
      .select()
      .single();

    if (error || !pedido) return;

    const itens = items.map(item => ({
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco,
      observacoes: item.observacoes || null,
    }));

    await supabase.from('itens_pedido').insert(itens);
    clearCart();
    navigate(`/mesa/${id}/confirmacao`, { state: { pedidoId: pedido.id, numeroPedido: pedido.numero_pedido } });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center max-w-[430px] mx-auto px-6">
        <p className="text-muted-foreground font-body text-lg mb-4">Carrinho vazio</p>
        <button onClick={() => navigate(`/mesa/${id}`)} className="text-primary font-body font-semibold underline">
          Voltar ao Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(`/mesa/${id}`)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Seu Pedido</h1>
      </div>

      {/* Items */}
      <div className="px-4 pt-4 space-y-4">
        {items.map((item, i) => (
          <motion.div
            key={item.produto_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg border border-border p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3 flex-1">
                {item.imagem_url && (
                  <img src={item.imagem_url} alt={item.nome} className="w-16 h-16 rounded-md object-cover" />
                )}
                <div className="flex-1">
                  <h3 className="font-body font-semibold text-foreground text-sm">{item.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    R$ {item.preco.toFixed(2).replace('.', ',')} un.
                  </p>
                </div>
              </div>
              <button onClick={() => removeItem(item.produto_id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3 bg-secondary rounded-full px-1 py-1">
                <button
                  onClick={() => updateQuantity(item.produto_id, item.quantidade - 1)}
                  className="w-7 h-7 rounded-full bg-background flex items-center justify-center"
                >
                  <Minus className="w-3 h-3 text-foreground" />
                </button>
                <span className="text-sm font-body font-bold text-foreground w-5 text-center">{item.quantidade}</span>
                <button
                  onClick={() => updateQuantity(item.produto_id, item.quantidade + 1)}
                  className="w-7 h-7 rounded-full bg-primary flex items-center justify-center"
                >
                  <Plus className="w-3 h-3 text-primary-foreground" />
                </button>
              </div>
              <span className="font-body font-bold text-primary">
                R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
              </span>
            </div>

            {/* Observações */}
            <input
              type="text"
              placeholder="Observações (ex: sem cebola, bem passado)"
              value={item.observacoes}
              onChange={e => updateObservacoes(item.produto_id, e.target.value)}
              className="mt-3 w-full bg-secondary text-foreground text-xs rounded-lg px-3 py-2 placeholder:text-muted-foreground border-0 outline-none focus:ring-1 focus:ring-primary font-body"
            />
          </motion.div>
        ))}
      </div>

      {/* Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-[430px] mx-auto bg-card border-t border-border px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-body">Total</span>
            <span className="text-xl font-display font-bold text-foreground">
              R$ {totalPrice.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleConfirm}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-body font-bold text-base shadow-lg shadow-primary/30"
          >
            Confirmar Pedido
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
