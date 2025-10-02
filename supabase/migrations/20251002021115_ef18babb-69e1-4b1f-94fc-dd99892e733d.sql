-- Garante que o bucket video-refs existe e é público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-refs',
  'video-refs',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários podem fazer upload de frames" ON storage.objects;
DROP POLICY IF EXISTS "Frames são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios frames" ON storage.objects;

-- Cria políticas RLS para o bucket video-refs
CREATE POLICY "Usuários podem fazer upload de frames"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'video-refs');

CREATE POLICY "Frames são publicamente acessíveis"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'video-refs');

CREATE POLICY "Usuários podem deletar seus próprios frames"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'video-refs');