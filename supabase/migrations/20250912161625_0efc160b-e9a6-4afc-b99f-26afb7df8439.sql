-- Criar função para inserir custo de imagem no token_usage
CREATE OR REPLACE FUNCTION public.insert_image_usage(
  p_user_id UUID,
  p_model_name TEXT,
  p_prompt TEXT,
  p_cost NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.token_usage (
    user_id,
    model_name,
    message_content,
    ai_response_content,
    tokens_used,
    input_tokens,
    output_tokens,
    created_at
  ) VALUES (
    p_user_id,
    p_model_name,
    p_prompt,
    'Image generated successfully',
    1, -- Para imagens, 1 token representa 1 imagem
    1, -- Input: 1 imagem solicitada
    1, -- Output: 1 imagem gerada
    NOW()
  );
END;
$$;