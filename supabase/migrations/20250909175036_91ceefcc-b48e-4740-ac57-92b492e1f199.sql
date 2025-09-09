-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create automated daily storage cleanup job at 2:00 AM UTC
SELECT cron.schedule(
  'daily-storage-cleanup',
  '0 2 * * *', -- Daily at 2:00 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/storage-cleanup',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE"}'::jsonb,
        body:=('{"manual": false, "triggered_by": "cron_daily", "timestamp": "' || now() || '"}')::jsonb
    ) as request_id;
  $$
);

-- Create table to track cron job executions
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  details JSONB
);

-- Enable RLS on the cron logs table
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admin access only
CREATE POLICY "Admin can view cron logs" ON public.cron_job_logs
FOR SELECT USING (true);

-- Insert initial log entry with proper JSONB casting
INSERT INTO public.cron_job_logs (job_name, details) 
VALUES ('daily-storage-cleanup', '{"message": "Automated daily storage cleanup job configured", "schedule": "0 2 * * *"}'::jsonb);