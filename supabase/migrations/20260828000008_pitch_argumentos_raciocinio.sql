ALTER TABLE public.pitch_argumentos
  ADD COLUMN IF NOT EXISTS raciocinio TEXT,
  ADD COLUMN IF NOT EXISTS relevancia_interlocutor TEXT;

