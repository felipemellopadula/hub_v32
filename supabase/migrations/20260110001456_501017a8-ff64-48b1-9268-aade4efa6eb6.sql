-- 1. Criar função auxiliar para verificar propriedade da sessão (evita recursão)
CREATE OR REPLACE FUNCTION public.owns_miniagent_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miniagent_sessions
    WHERE id = p_session_id
    AND (user_id = auth.uid() OR user_id IS NULL)
  )
$$;

-- 2. Remover políticas públicas problemáticas da tabela miniagent_sessions
DROP POLICY IF EXISTS "Permitir leitura publica de sessoes" ON public.miniagent_sessions;

-- 3. Remover políticas públicas problemáticas da tabela miniagent_messages
DROP POLICY IF EXISTS "Permitir leitura publica de mensagens" ON public.miniagent_messages;

-- Criar política segura para mensagens
CREATE POLICY "Users can view own session messages"
ON public.miniagent_messages
FOR SELECT
USING (public.owns_miniagent_session(session_id));

-- 4. Remover políticas públicas problemáticas da tabela miniagent_files
DROP POLICY IF EXISTS "Permitir leitura publica de arquivos" ON public.miniagent_files;

-- Criar política segura para arquivos
CREATE POLICY "Users can view own session files"
ON public.miniagent_files
FOR SELECT
USING (public.owns_miniagent_session(session_id));

-- 5. Remover políticas públicas problemáticas da tabela miniagent_tools_logs
DROP POLICY IF EXISTS "Permitir leitura publica de logs" ON public.miniagent_tools_logs;

-- Criar política segura para logs
CREATE POLICY "Users can view own session logs"
ON public.miniagent_tools_logs
FOR SELECT
USING (public.owns_miniagent_session(session_id));