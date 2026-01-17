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
  visual_consistency: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoryboardScene {
  id: string;
  project_id: string;
  order_index: number;
  source_image_id: string | null;
  image_url: string;
  generated_image_url: string | null;
  image_status: 'pending' | 'generating' | 'completed' | 'failed';
  prompt: string | null;
  motion_prompt: string | null;
  duration: number;
  video_url: string | null;
  video_status: 'pending' | 'generating' | 'completed' | 'failed';
  created_at: string;
}

export interface StoryboardReference {
  id: string;
  project_id: string;
  name: string;
  image_url: string;
  created_at: string;
}

export function useStoryboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<StoryboardProject[]>([]);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [references, setReferences] = useState<StoryboardReference[]>([]);
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

  // Create project with AI-generated scenes
  const createProjectWithScenes = useCallback(async (
    name: string, 
    aspectRatio: string = '16:9', 
    videoModel: string = 'bytedance:seedance@1.5-pro',
    generatedScenes: { sceneNumber: number; visualDescription: string; motionPrompt: string; duration: number }[]
  ) => {
    if (!user) return null;
    try {
      // Create project first
      const { data: projectData, error: projectError } = await supabase
        .from('storyboard_projects')
        .insert({
          user_id: user.id,
          name,
          aspect_ratio: aspectRatio,
          video_model: videoModel,
        })
        .select()
        .single();

      if (projectError) throw projectError;
      
      const newProject = projectData as StoryboardProject;
      
      // Create scenes
      const scenesToInsert = generatedScenes.map((scene, index) => ({
        project_id: newProject.id,
        order_index: index,
        image_url: '',
        prompt: scene.visualDescription,
        motion_prompt: scene.motionPrompt || null,
        duration: scene.duration || 5,
        image_status: 'pending' as const,
        video_status: 'pending' as const,
      }));

      const { data: scenesData, error: scenesError } = await supabase
        .from('storyboard_scenes')
        .insert(scenesToInsert)
        .select();

      if (scenesError) {
        console.error('Error creating scenes:', scenesError);
        // Project was created, continue anyway
      }

      setProjects(prev => [newProject, ...prev]);
      if (scenesData) {
        setScenes(scenesData as StoryboardScene[]);
      }
      
      toast({
        title: 'Projeto criado!',
        description: `"${name}" foi criado com ${generatedScenes.length} cenas.`,
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

  // Fetch references for a project
  const fetchReferences = useCallback(async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('storyboard_references')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReferences((data || []) as StoryboardReference[]);
      return data as StoryboardReference[];
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar referências',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    }
  }, [toast]);

  // Add reference
  const addReference = useCallback(async (projectId: string, imageUrl: string, name?: string) => {
    try {
      // Auto-generate name based on current count
      const autoName = name || `IMG${references.length + 1}`;
      
      const { data, error } = await supabase
        .from('storyboard_references')
        .insert({
          project_id: projectId,
          image_url: imageUrl,
          name: autoName,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newReference = data as StoryboardReference;
      setReferences(prev => [...prev, newReference]);
      
      toast({
        title: 'Referência adicionada',
        description: `${autoName} foi adicionada ao projeto.`,
      });
      return newReference;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar referência',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [references.length, toast]);

  // Update reference
  const updateReference = useCallback(async (referenceId: string, updates: Partial<StoryboardReference>) => {
    try {
      const { data, error } = await supabase
        .from('storyboard_references')
        .update(updates)
        .eq('id', referenceId)
        .select()
        .single();

      if (error) throw error;
      
      const updatedReference = data as StoryboardReference;
      setReferences(prev => prev.map(r => r.id === referenceId ? updatedReference : r));
      return updatedReference;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar referência',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Delete reference
  const deleteReference = useCallback(async (referenceId: string) => {
    try {
      const { error } = await supabase
        .from('storyboard_references')
        .delete()
        .eq('id', referenceId);

      if (error) throw error;
      
      setReferences(prev => prev.filter(r => r.id !== referenceId));
      toast({
        title: 'Referência removida',
        description: 'A referência foi removida do projeto.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao remover referência',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Add scene (now without requiring image - will be AI-generated)
  const addScene = useCallback(async (projectId: string, imageUrl?: string, prompt?: string, sourceImageId?: string) => {
    try {
      // Get current max order_index
      const maxOrder = scenes.reduce((max, s) => Math.max(max, s.order_index), -1);
      
      const { data, error } = await supabase
        .from('storyboard_scenes')
        .insert({
          project_id: projectId,
          image_url: imageUrl || '', // Can be empty - will be generated
          prompt: prompt || null,
          source_image_id: sourceImageId || null,
          order_index: maxOrder + 1,
          duration: 5,
          video_status: 'pending',
          image_status: imageUrl ? 'completed' : 'pending',
          generated_image_url: imageUrl || null,
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

  // Select project and load its scenes and references
  const selectProject = useCallback(async (project: StoryboardProject | null) => {
    setCurrentProject(project);
    if (project) {
      await Promise.all([
        fetchScenes(project.id),
        fetchReferences(project.id),
      ]);
    } else {
      setScenes([]);
      setReferences([]);
    }
  }, [fetchScenes, fetchReferences]);

  // Load projects on mount
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  return {
    projects,
    scenes,
    references,
    loading,
    currentProject,
    fetchProjects,
    createProject,
    createProjectWithScenes,
    updateProject,
    deleteProject,
    fetchScenes,
    fetchReferences,
    addReference,
    updateReference,
    deleteReference,
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
    selectProject,
  };
}
