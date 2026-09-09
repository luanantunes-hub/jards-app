ALTER TABLE public.cotas_patrocinio
  ADD COLUMN IF NOT EXISTS unidades_vendidas INTEGER NOT NULL DEFAULT 0;
