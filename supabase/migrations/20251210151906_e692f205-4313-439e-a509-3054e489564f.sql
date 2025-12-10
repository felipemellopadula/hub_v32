-- Update trigger to keep the latest 8 images per user instead of 5
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
    OFFSET 8
  );
  RETURN NEW;
END;
$$;