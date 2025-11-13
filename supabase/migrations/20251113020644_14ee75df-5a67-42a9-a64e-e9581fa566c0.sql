-- Função para resetar tokens de um usuário manualmente (apenas para admins)
CREATE OR REPLACE FUNCTION public.admin_reset_user_tokens(
  p_user_email text,
  p_new_token_amount integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_old_tokens integer;
  v_result json;
BEGIN
  -- Buscar o usuário pelo email
  SELECT id, tokens_remaining INTO v_user_id, v_old_tokens
  FROM public.profiles
  WHERE email = p_user_email;

  -- Verificar se o usuário existe
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Atualizar os tokens
  UPDATE public.profiles
  SET tokens_remaining = p_new_token_amount,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Retornar resultado
  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_user_email,
    'old_tokens', v_old_tokens,
    'new_tokens', p_new_token_amount,
    'updated_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.admin_reset_user_tokens IS 
'Função administrativa para resetar tokens de um usuário. 
Uso: SELECT admin_reset_user_tokens(''email@exemplo.com'', 1000000);';