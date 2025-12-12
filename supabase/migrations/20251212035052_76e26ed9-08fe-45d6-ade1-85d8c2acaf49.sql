-- ============================================
-- FASE 1: Habilitar RLS nas 8 tabelas vazias
-- Risco: ZERO (tabelas estão vazias/não usadas)
-- ============================================

-- 1. agent_logs - logs de agentes
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view agent logs"
ON public.agent_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert agent logs"
ON public.agent_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. files - arquivos genéricos
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own files"
ON public.files
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
ON public.files
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. mcp_tools_logs - logs de ferramentas MCP
ALTER TABLE public.mcp_tools_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mcp logs"
ON public.mcp_tools_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert mcp logs"
ON public.mcp_tools_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. metrics - métricas do sistema
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metrics"
ON public.metrics
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert metrics"
ON public.metrics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. minimax_responses - respostas do MiniMax
ALTER TABLE public.minimax_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own minimax responses"
ON public.minimax_responses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert minimax responses"
ON public.minimax_responses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. sessions - sessões genéricas
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. system_config - configurações do sistema (somente admins)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system config"
ON public.system_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage system config"
ON public.system_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

-- 8. users - tabela de usuários legada
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own user record"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own user record"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid());