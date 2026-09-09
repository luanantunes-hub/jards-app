-- Add logo_url column to captadores
ALTER TABLE captadores ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create logos storage bucket (public, 2MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 2097152, ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for logos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'logos_public_read' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'logos_auth_insert' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "logos_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'logos_auth_update' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "logos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
  END IF;
END $$;
