-- Fix 1: Revoke the permissive policies on miniagent_files that allow anon access
DROP POLICY IF EXISTS "Permitir insercao de arquivos via edge function" ON public.miniagent_files;
DROP POLICY IF EXISTS "Permitir atualizacao de arquivos via edge function" ON public.miniagent_files;

-- Create new secure policies for miniagent_files
-- Allow insert only for authenticated users or service_role (edge functions)
CREATE POLICY "Allow insert for authenticated users or service_role"
ON public.miniagent_files
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role' 
  OR (auth.role() = 'authenticated' AND owns_miniagent_session(session_id))
);

-- Allow update only for session owners or service_role
CREATE POLICY "Allow update for session owners or service_role"
ON public.miniagent_files
FOR UPDATE
USING (
  auth.role() = 'service_role' 
  OR owns_miniagent_session(session_id)
);

-- Allow delete only for session owners
CREATE POLICY "Allow delete for session owners"
ON public.miniagent_files
FOR DELETE
USING (owns_miniagent_session(session_id));

-- Fix 2: Create has_admin_role function for secure admin checks
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
  )
$$;