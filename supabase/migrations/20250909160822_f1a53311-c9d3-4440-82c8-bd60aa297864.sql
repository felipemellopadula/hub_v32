-- Add columns to store AI response and actual token counts
ALTER TABLE public.token_usage 
ADD COLUMN IF NOT EXISTS ai_response_content TEXT,
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

-- Update existing records to have reasonable input tokens based on message length
UPDATE public.token_usage 
SET input_tokens = CEIL(LENGTH(COALESCE(message_content, '')) / 4.0)::integer
WHERE input_tokens IS NULL;

-- Set output tokens to 0 for existing records since we don't have the AI responses
UPDATE public.token_usage 
SET output_tokens = 0
WHERE output_tokens IS NULL;