-- Add 'cancelado' to status_pedido enum
ALTER TYPE public.status_pedido ADD VALUE IF NOT EXISTS 'cancelado';

-- Allow deleting itens_pedido
CREATE POLICY "Anyone can delete itens_pedido"
ON public.itens_pedido
FOR DELETE
USING (true);

-- Allow deleting pedidos
CREATE POLICY "Anyone can delete pedidos"
ON public.pedidos
FOR DELETE
USING (true);