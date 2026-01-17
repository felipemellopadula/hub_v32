-- Adicionar coluna de consistência visual ao projeto
ALTER TABLE public.storyboard_projects 
ADD COLUMN IF NOT EXISTS visual_consistency BOOLEAN DEFAULT true;

-- Comentário para documentação
COMMENT ON COLUMN public.storyboard_projects.visual_consistency IS 'Quando habilitado, usa imagens de cenas anteriores como referência automática para manter consistência visual';