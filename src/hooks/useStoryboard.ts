import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface StoryboardProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  aspect_ratio: string;
  video_model: string;
  created_at: string;
  updated_at: string;
}

export interface StoryboardScene {
  id: string;
  project_id: string;
  order_index: number;
  source_image_id: string | null;
  image_url: string;
  prompt: string | null;
  duration: number;
  video_url: string | null;
  video_status: 'pending' | 'generating' | 'completed' | 'failed';
  created_at: string;
}

export function useStoryboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<StoryboardProject[]>([]);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<StoryboardProject | null>(null);

  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('storyboard_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects((data || []) as StoryboardProject[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar projetos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Create new project
  const createProject = useCallback(async (name: string, aspectRatio: string = '16:9', videoModel: string = 'bytedance:seedance@1.5-pro') => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('storyboard_projects')
        .insert({
          user_id: user.id,
          name,
          aspect_ratio: aspectRatio,
          video_model: videoModel,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newProject = data as StoryboardProject;
      setProjects(prev => [newProject, ...prev]);
      toast({
        title: 'Projeto criado',
        description: `"${name}" foi criado com sucesso.`,
      });
      return newProject;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar projeto',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [user, toast]);

  // Update project
  const updateProject = useCallback(async (projectId: string, updates: Partial<StoryboardProject>) => {
    try {
      const { data, error } = await supabase
        .from('storyboard_projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;
      
      const updatedProject = data as StoryboardProject;
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(updatedProject);
      }
      return updatedProject;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar projeto',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast, currentProject]);

  // Delete project
  const deleteProject = useCallback(async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('storyboard_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
      toast({
        title: 'Projeto excluído',
        description: 'O projeto foi removido com sucesso.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir projeto',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, currentProject]);

  // Fetch scenes for a project
  const fetchScenes = useCallback(async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('storyboard_scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setScenes((data || []) as StoryboardScene[]);
      return data as StoryboardScene[];
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar cenas',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    }
  }, [toast]);

  // Add scene
  const addScene = useCallback(async (projectId: string, imageUrl: string, prompt?: string, sourceImageId?: string) => {
    try {
      // Get current max order_index
      const maxOrder = scenes.reduce((max, s) => Math.max(max, s.order_index), -1);
      
      const { data, error } = await supabase
        .from('storyboard_scenes')
        .insert({
          project_id: projectId,
          image_url: imageUrl,
          prompt: prompt || null,
          source_image_id: sourceImageId || null,
          order_index: maxOrder + 1,
          duration: 5,
          video_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      
      const newScene = data as StoryboardScene;
      setScenes(prev => [...prev, newScene]);
      
      // Update project updated_at
      await supabase
        .from('storyboard_projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', projectId);

      return newScene;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar cena',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [scenes, toast]);

  // Update scene
  const updateScene = useCallback(async (sceneId: string, updates: Partial<StoryboardScene>) => {
    try {
      const { data, error } = await supabase
        .from('storyboard_scenes')
        .update(updates)
        .eq('id', sceneId)
        .select()
        .single();

      if (error) throw error;
      
      const updatedScene = data as StoryboardScene;
      setScenes(prev => prev.map(s => s.id === sceneId ? updatedScene : s));
      return updatedScene;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar cena',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Delete scene
  const deleteScene = useCallback(async (sceneId: string) => {
    try {
      const { error } = await supabase
        .from('storyboard_scenes')
        .delete()
        .eq('id', sceneId);

      if (error) throw error;
      
      setScenes(prev => prev.filter(s => s.id !== sceneId));
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir cena',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Reorder scenes
  const reorderScenes = useCallback(async (projectId: string, orderedIds: string[]) => {
    try {
      // Update order_index for each scene
      const updates = orderedIds.map((id, index) => ({
        id,
        order_index: index,
      }));

      for (const update of updates) {
        await supabase
          .from('storyboard_scenes')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
      }

      // Update local state
      setScenes(prev => {
        const sceneMap = new Map(prev.map(s => [s.id, s]));
        return orderedIds.map((id, index) => ({
          ...sceneMap.get(id)!,
          order_index: index,
        }));
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao reordenar cenas',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Select project and load its scenes
  const selectProject = useCallback(async (project: StoryboardProject | null) => {
    setCurrentProject(project);
    if (project) {
      await fetchScenes(project.id);
    } else {
      setScenes([]);
    }
  }, [fetchScenes]);

  // Load projects on mount
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  return {
    projects,
    scenes,
    loading,
    currentProject,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    fetchScenes,
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
    selectProject,
  };
}
