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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center w-full max-w-full lg:max-w-[430px] mx-auto px-6">
        <p className="text-muted-foreground font-body text-xl mb-4">Carrinho vazio</p>
        <button onClick={() => navigate(`/mesa/${id}`)} className="text-primary font-body font-semibold underline text-lg">
          Voltar ao Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full max-w-full lg:max-w-[430px] mx-auto pb-40">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(`/mesa/${id}`)} className="text-foreground p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Seu Pedido</h1>
      </div>

      {/* Items */}
      <div className="px-4 pt-4 space-y-4">
        {items.map((item, i) => (
          <motion.div
            key={item.produto_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-2xl border border-border p-5"
          >
            {/* Nome + imagem + lixeira */}
            <div className="flex items-start justify-between">
              <div className="flex gap-4 flex-1">
                {item.imagem_url && (
                  <img src={item.imagem_url} alt={item.nome} className="w-24 h-24 rounded-xl object-cover" />
                )}
                <div className="flex-1">
                  <h3 className="font-body font-bold text-foreground text-lg leading-tight">{item.nome}</h3>
                  <p className="text-base text-muted-foreground mt-1">
                    R$ {item.preco.toFixed(2).replace('.', ',')} un.
                  </p>
                </div>
              </div>
              <button onClick={() => removeItem(item.produto_id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Subtotal */}
            <div className="mt-4 flex justify-end">
              <span className="font-body font-bold text-primary text-lg">
                R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
              </span>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between mt-3 w-full bg-secondary rounded-full px-2 py-1.5">
              <button
                onClick={() => updateQuantity(item.produto_id, item.quantidade - 1)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-background shadow-sm flex items-center justify-center"
              >
                <Minus className="w-5 h-5 text-foreground" />
              </button>
              <span className="text-xl font-body font-bold text-foreground min-w-[32px] text-center tabular-nums">
                {item.quantidade}
              </span>
              <button
                onClick={() => updateQuantity(item.produto_id, item.quantidade + 1)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-primary shadow-sm flex items-center justify-center"
              >
                <Plus className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>

            {/* Observações */}
            <textarea
              placeholder="Observações (ex: sem cebola, bem passado)"
              value={item.observacoes}
              onChange={e => updateObservacoes(item.produto_id, e.target.value)}
              rows={2}
              className="mt-3 w-full bg-secondary text-foreground text-base rounded-xl px-4 py-3 placeholder:text-muted-foreground border-0 outline-none focus:ring-1 focus:ring-primary font-body resize-none"
            />
          </motion.div>
        ))}
      </div>

      {/* Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="w-full max-w-full lg:max-w-[430px] mx-auto bg-card border-t border-border px-4 py-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-lg text-muted-foreground font-body">Total</span>
            <span className="text-2xl font-display font-bold text-foreground">
              R$ {totalPrice.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleConfirm}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-body font-bold text-lg shadow-lg shadow-primary/30"
          >
            Confirmar Pedido
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
