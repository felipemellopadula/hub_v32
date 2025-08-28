-- Create table for video metadata
CREATE TABLE public.user_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  prompt TEXT,
  model TEXT NOT NULL,
  resolution TEXT,
  duration INTEGER,
  aspect_ratio TEXT,
  initial_frame_url TEXT,
  final_frame_url TEXT,
  format TEXT DEFAULT 'mp4',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own videos" 
ON public.user_videos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own videos" 
ON public.user_videos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" 
ON public.user_videos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('user-videos', 'user-videos', true);

-- Create policies for video storage
CREATE POLICY "Users can view their own videos in storage" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos from storage" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create index for better performance
CREATE INDEX idx_user_videos_user_id_created_at ON public.user_videos(user_id, created_at DESC);