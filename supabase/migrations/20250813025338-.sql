-- Create table to store last 5 images per user
CREATE TABLE IF NOT EXISTS public.user_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_path text NOT NULL,
  prompt text,
  width integer,
  height integer,
  format text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_images ENABLE ROW LEVEL SECURITY;

-- Policies: users can manage only their own images
CREATE POLICY IF NOT EXISTS "Users can view their images"
ON public.user_images
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their images"
ON public.user_images
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their images"
ON public.user_images
FOR DELETE
USING (auth.uid() = user_id);

-- Useful index
CREATE INDEX IF NOT EXISTS idx_user_images_user_created ON public.user_images (user_id, created_at DESC);

-- Trigger to keep only the latest 5 images per user
CREATE OR REPLACE FUNCTION public.enforce_user_images_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  DELETE FROM public.user_images
  WHERE id IN (
    SELECT id FROM public.user_images
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 5
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_images_limit ON public.user_images;
CREATE TRIGGER trg_enforce_user_images_limit
AFTER INSERT ON public.user_images
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_images_limit();