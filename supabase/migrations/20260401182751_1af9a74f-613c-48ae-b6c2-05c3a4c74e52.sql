
-- Create enum for order status
CREATE TYPE public.status_pedido AS ENUM ('novo', 'preparando', 'pronto', 'entregue');

-- Restaurantes
CREATE TABLE public.restaurantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  endereco TEXT,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mesas
CREATE TABLE public.mesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  qr_code_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Categorias
CREATE TABLE public.categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Produtos
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  imagem_url TEXT,
  disponivel BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pedidos
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mesa_id UUID NOT NULL REFERENCES public.mesas(id) ON DELETE CASCADE,
  numero_pedido SERIAL,
  status status_pedido NOT NULL DEFAULT 'novo',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Itens do Pedido
CREATE TABLE public.itens_pedido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- Public read access for menu data
CREATE POLICY "Public read restaurantes" ON public.restaurantes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read mesas" ON public.mesas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read categorias" ON public.categorias FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read produtos" ON public.produtos FOR SELECT TO anon, authenticated USING (true);

-- Orders: anyone can create, read, update (no auth needed for restaurant customers)
CREATE POLICY "Anyone can create pedidos" ON public.pedidos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read pedidos" ON public.pedidos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can update pedidos" ON public.pedidos FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Anyone can create itens_pedido" ON public.itens_pedido FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read itens_pedido" ON public.itens_pedido FOR SELECT TO anon, authenticated USING (true);

-- Enable realtime for pedidos
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;

-- Trigger for updated_at on pedidos
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
