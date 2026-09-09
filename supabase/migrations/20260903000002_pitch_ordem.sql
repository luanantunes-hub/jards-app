-- Add ordem column to pitch_argumentos and pitch_objecoes for manual reordering

ALTER TABLE public.pitch_argumentos ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.pitch_objecoes ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0;

-- Initialize ordem from created_at so existing data keeps its current order
UPDATE public.pitch_argumentos a
SET ordem = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY projeto_id ORDER BY created_at) - 1) AS rn
  FROM public.pitch_argumentos
) sub
WHERE a.id = sub.id;

UPDATE public.pitch_objecoes o
SET ordem = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY projeto_id ORDER BY created_at DESC) - 1) AS rn
  FROM public.pitch_objecoes
) sub
WHERE o.id = sub.id;
