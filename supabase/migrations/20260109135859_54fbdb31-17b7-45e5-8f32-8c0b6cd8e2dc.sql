-- Corrigir política de INSERT para ser mais restritiva (apenas service role pode inserir via webhook)
DROP POLICY IF EXISTS "Service role can insert purchases" ON public.credit_purchases;

-- Não precisamos de política de INSERT para service role, pois ele bypassa RLS automaticamente