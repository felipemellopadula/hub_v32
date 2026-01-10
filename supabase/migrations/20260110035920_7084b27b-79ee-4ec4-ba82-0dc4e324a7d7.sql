-- Tabela de projetos de storyboard
CREATE TABLE public.storyboard_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Novo Projeto',
  description TEXT,
  aspect_ratio TEXT DEFAULT '16:9',
  video_model TEXT DEFAULT 'bytedance:seedance@1.5-pro',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de cenas do storyboard
CREATE TABLE public.storyboard_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.storyboard_projects(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  source_image_id UUID REFERENCES public.user_images(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  prompt TEXT,
  duration INTEGER DEFAULT 5,
  video_url TEXT,
  video_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.storyboard_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyboard_scenes ENABLE ROW LEVEL SECURITY;

-- Políticas para storyboard_projects
CREATE POLICY "Users can view own projects" 
ON public.storyboard_projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" 
ON public.storyboard_projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" 
ON public.storyboard_projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" 
ON public.storyboard_projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Políticas para storyboard_scenes
CREATE POLICY "Users can view own scenes" 
ON public.storyboard_scenes 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.storyboard_projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Users can create own scenes" 
ON public.storyboard_scenes 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.storyboard_projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update own scenes" 
ON public.storyboard_scenes 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.storyboard_projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete own scenes" 
ON public.storyboard_scenes 
FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM public.storyboard_projects WHERE id = project_id AND user_id = auth.uid())
);

-- Índices para performance
CREATE INDEX idx_storyboard_projects_user ON public.storyboard_projects(user_id);
CREATE INDEX idx_storyboard_scenes_project ON public.storyboard_scenes(project_id);
CREATE INDEX idx_storyboard_scenes_order ON public.storyboard_scenes(project_id, order_index);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_storyboard_projects_updated_at
BEFORE UPDATE ON public.storyboard_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();