-- Add is_public column to user_images table
ALTER TABLE public.user_images 
ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Create RLS policy to allow anyone to view public images
CREATE POLICY "Anyone can view public images" 
ON public.user_images 
FOR SELECT 
USING (is_public = true);

-- Create policy to allow users to update their own images (for toggling public/private)
CREATE POLICY "Users can update their own images" 
ON public.user_images 
FOR UPDATE 
USING (auth.uid() = user_id);