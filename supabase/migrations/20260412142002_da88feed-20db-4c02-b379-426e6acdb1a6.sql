
-- Add status to mesas
CREATE TYPE public.status_mesa AS ENUM ('aberta', 'fechada');

ALTER TABLE public.mesas ADD COLUMN status public.status_mesa NOT NULL DEFAULT 'fechada';

-- Allow anyone to update mesas (waiter needs to open/close tables)
CREATE POLICY "Anyone can update mesas"
ON public.mesas
FOR UPDATE
TO anon, authenticated
USING (true);

-- Enable realtime for mesas
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
