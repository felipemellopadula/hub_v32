-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job for daily storage cleanup at 2 AM UTC
SELECT cron.schedule(
  'daily-storage-cleanup',
  '0 2 * * *', -- Run at 2:00 AM UTC every day
  $$
  SELECT
    net.http_post(
        url:='https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/storage-cleanup',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE"}'::jsonb,
        body:='{"scheduled": true, "time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to track storage cleanup logs
CREATE TABLE IF NOT EXISTS public.storage_cleanup_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_files INTEGER,
  deleted_files INTEGER,
  freed_space_mb INTEGER,
  errors TEXT[],
  triggered_by TEXT DEFAULT 'cron',
  success BOOLEAN DEFAULT true
);

-- Enable RLS on storage cleanup logs
ALTER TABLE public.storage_cleanup_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access to storage cleanup logs
CREATE POLICY "Admin can view storage cleanup logs" 
ON public.storage_cleanup_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.subscription_type = 'admin'
  )
);

-- Create policy for system to insert storage cleanup logs
CREATE POLICY "System can insert storage cleanup logs" 
ON public.storage_cleanup_logs 
FOR INSERT 
WITH CHECK (true);

-- Add trigger to update updated_at column
CREATE TRIGGER update_storage_cleanup_logs_updated_at
BEFORE UPDATE ON public.storage_cleanup_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();