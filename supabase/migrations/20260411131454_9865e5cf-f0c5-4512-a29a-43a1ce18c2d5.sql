
-- Move Red Bull to Bebidas category
UPDATE public.produtos 
SET categoria_id = (SELECT id FROM public.categorias WHERE nome = 'Bebidas' LIMIT 1)
WHERE nome = 'Red Bull Energy Drink';

-- Remove the separate Bebidas Não Alcoólicas category
DELETE FROM public.categorias WHERE nome = 'Bebidas Não Alcoólicas';
