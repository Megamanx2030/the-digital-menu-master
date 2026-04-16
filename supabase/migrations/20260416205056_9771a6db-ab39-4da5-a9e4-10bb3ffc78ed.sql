-- Trigger para rejeitar inserção de pedidos em mesas fechadas
CREATE OR REPLACE FUNCTION public.check_mesa_aberta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mesa_status status_mesa;
BEGIN
  SELECT status INTO mesa_status
  FROM public.mesas
  WHERE id = NEW.mesa_id;

  IF mesa_status IS NULL THEN
    RAISE EXCEPTION 'Mesa não encontrada';
  END IF;

  IF mesa_status = 'fechada' THEN
    RAISE EXCEPTION 'Não é possível criar pedidos em uma mesa fechada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_mesa_aberta ON public.pedidos;

CREATE TRIGGER trg_check_mesa_aberta
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.check_mesa_aberta();