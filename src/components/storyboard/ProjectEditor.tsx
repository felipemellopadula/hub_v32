import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  ArrowLeft, 
  Plus, 
  Video, 
  Settings, 
  Play,
  Loader2,
  Image as ImageIcon,
  Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCredits, getVideoCreditCost } from '@/hooks/useCredits';
import { SceneCard } from './SceneCard';
import { ImagePicker } from './ImagePicker';
import { VideoPreviewModal } from './VideoPreviewModal';
import { StoryboardProject, StoryboardScene } from '@/hooks/useStoryboard';

interface ProjectEditorProps {
  project: StoryboardProject;
  scenes: StoryboardScene[];
  onBack: () => void;
  onUpdateProject: (projectId: string, updates: Partial<StoryboardProject>) => Promise<StoryboardProject | null>;
  onAddScene: (projectId: string, imageUrl: string, prompt?: string, sourceImageId?: string) => Promise<StoryboardScene | null>;
  onUpdateScene: (sceneId: string, updates: Partial<StoryboardScene>) => Promise<StoryboardScene | null>;
  onDeleteScene: (sceneId: string) => Promise<boolean>;
  onReorderScenes: (projectId: string, orderedIds: string[]) => Promise<boolean>;
}

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9 (Widescreen)' },
  { id: '9:16', label: '9:16 (Vertical)' },
  { id: '1:1', label: '1:1 (Quadrado)' },
  { id: '4:3', label: '4:3 (Standard)' },
];

const VIDEO_MODELS = [
  { id: 'bytedance:seedance@1.5-pro', label: 'Seedance 1.5 Pro', cost: 0.5 },
  { id: 'google:3@3', label: 'Google Veo 3.1 Fast', cost: 1 },
  { id: 'klingai:kling-video@2.6-pro', label: 'Kling Video 2.6 Pro', cost: 1.5 },
  { id: 'minimax:4@1', label: 'MiniMax Hailuo 2.3', cost: 1 },
];

export const ProjectEditor: React.FC<ProjectEditorProps> = ({
  project,
  scenes,
  onBack,
  onUpdateProject,
  onAddScene,
  onUpdateScene,
  onDeleteScene,
  onReorderScenes,
}) => {
  const { toast } = useToast();
  const { isLegacyUser, creditsRemaining, checkCredits, consumeCredits, setShowPurchaseModal } = useCredits();
  
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(project.name);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Get current model cost
  const modelCost = VIDEO_MODELS.find(m => m.id === project.video_model)?.cost || 0.5;
  const pendingScenes = scenes.filter(s => s.video_status === 'pending' || s.video_status === 'failed');
  const totalCost = pendingScenes.length * modelCost;

  // Handle name update
  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== project.name) {
      await onUpdateProject(project.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  // Handle scene reorder
  const handleReorder = async (newOrder: StoryboardScene[]) => {
    const orderedIds = newOrder.map(s => s.id);
    await onReorderScenes(project.id, orderedIds);
  };

  // Handle image selection
  const handleSelectImage = async (imageUrl: string, prompt?: string, imageId?: string) => {
    await onAddScene(project.id, imageUrl, prompt, imageId);
  };

  // Generate video for a scene
  const generateVideoForScene = useCallback(async (scene: StoryboardScene) => {
    // Check credits
    if (!isLegacyUser && creditsRemaining < modelCost) {
      toast({
        title: 'Créditos insuficientes',
        description: `Você precisa de ${modelCost} créditos para gerar este vídeo.`,
        variant: 'destructive',
      });
      setShowPurchaseModal(true);
      return;
    }

    setGeneratingSceneId(scene.id);
    
    try {
      // Update scene status to generating
      await onUpdateScene(scene.id, { video_status: 'generating' });

      // Ensure we have a full public URL for the image
      const getPublicUrl = (url: string) => {
        if (url.startsWith('http')) return url;
        const { data } = supabase.storage.from('images').getPublicUrl(url);
        return data.publicUrl;
      };

      const imageUrl = getPublicUrl(scene.image_url);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('runware-video', {
        body: {
          action: 'start',
          modelId: project.video_model,
          positivePrompt: scene.prompt || 'Animate this image with smooth motion',
          frameStartUrl: imageUrl,
          durationSeconds: scene.duration,
          aspectRatio: project.aspect_ratio,
        },
      });

      if (error) throw error;
      if (!data?.taskUUID) throw new Error('No task ID returned');

      const taskUUID = data.taskUUID;

      // Poll for completion
      const poll = async () => {
        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('runware-video', {
            body: { action: 'status', taskUUID },
          });

          if (statusError) throw statusError;

          // Detectar falha explícita
          if (statusData?.failed) {
            throw new Error(statusData?.details || 'Video generation failed');
          }

          // Extrair resultado (igual a Video.tsx)
          const statusItem = statusData?.result;
          const videoURL = statusItem?.videoURL || statusItem?.url;

          if (videoURL) {
            // Success!
            await onUpdateScene(scene.id, { 
              video_status: 'completed', 
              video_url: videoURL 
            });
            
            // Consume credits
            if (!isLegacyUser) {
              await consumeCredits('video' as any, `Storyboard: ${scene.prompt?.substring(0, 50) || 'Video generation'}`);
            }

            toast({
              title: 'Vídeo gerado!',
              description: `A cena ${scenes.findIndex(s => s.id === scene.id) + 1} foi gerada com sucesso.`,
            });
            
            setGeneratingSceneId(null);
            if (pollRef.current) clearTimeout(pollRef.current);
          } else {
            // Still processing, poll again
            pollRef.current = setTimeout(poll, 5000);
          }
        } catch (pollError: any) {
          await onUpdateScene(scene.id, { video_status: 'failed' });
          toast({
            title: 'Erro na geração',
            description: pollError.message,
            variant: 'destructive',
          });
          setGeneratingSceneId(null);
          if (pollRef.current) clearTimeout(pollRef.current);
        }
      };

      // Start polling
      pollRef.current = setTimeout(poll, 5000);

    } catch (error: any) {
      await onUpdateScene(scene.id, { video_status: 'failed' });
      toast({
        title: 'Erro ao gerar vídeo',
        description: error.message,
        variant: 'destructive',
      });
      setGeneratingSceneId(null);
    }
  }, [project, scenes, isLegacyUser, creditsRemaining, modelCost, onUpdateScene, consumeCredits, toast, setShowPurchaseModal]);

  // Generate all pending videos
  const generateAllVideos = async () => {
    if (pendingScenes.length === 0) {
      toast({
        title: 'Nenhum vídeo pendente',
        description: 'Todas as cenas já têm vídeos gerados.',
      });
      return;
    }

    // Check total credits
    if (!isLegacyUser && creditsRemaining < totalCost) {
      toast({
        title: 'Créditos insuficientes',
        description: `Você precisa de ${totalCost} créditos para gerar todos os vídeos.`,
        variant: 'destructive',
      });
      setShowPurchaseModal(true);
      return;
    }

    // Generate one at a time
    for (const scene of pendingScenes) {
      await generateVideoForScene(scene);
      // Wait a bit between each to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {isEditingName ? (
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              className="text-xl font-bold w-64"
              autoFocus
            />
          ) : (
            <h2 
              className="text-xl font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingName(true)}
            >
              {project.name}
            </h2>
          )}
          
          <Badge variant="outline">{project.aspect_ratio}</Badge>
          <Badge variant="secondary">{scenes.length} cenas</Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Credits Display */}
          {!isLegacyUser && pendingScenes.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <Coins className="h-4 w-4" />
              <span>Custo: {totalCost} créditos</span>
            </div>
          )}

          {/* Settings Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Configurações do Projeto</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label>Proporção do Vídeo</Label>
                  <Select
                    value={project.aspect_ratio}
                    onValueChange={(v) => onUpdateProject(project.id, { aspect_ratio: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_RATIOS.map((ar) => (
                        <SelectItem key={ar.id} value={ar.id}>
                          {ar.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modelo de Vídeo</Label>
                  <Select
                    value={project.video_model}
                    onValueChange={(v) => onUpdateProject(project.id, { video_model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label} ({model.cost} créditos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Add Scene Button */}
          <Button onClick={() => setShowImagePicker(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Cena
          </Button>

          {/* Generate All Button */}
          {pendingScenes.length > 0 && (
            <Button 
              onClick={generateAllVideos} 
              className="gap-2"
              disabled={generatingSceneId !== null}
            >
              {generatingSceneId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Gerar Todos ({pendingScenes.length})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Scenes Grid */}
      {scenes.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-16 text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma cena ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Adicione imagens para criar seu storyboard
          </p>
          <Button onClick={() => setShowImagePicker(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Primeira Cena
          </Button>
        </div>
      ) : (
        <Reorder.Group
          axis="x"
          values={scenes}
          onReorder={handleReorder}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <AnimatePresence>
            {scenes.map((scene, index) => (
              <Reorder.Item
                key={scene.id}
                value={scene}
                className="cursor-grab active:cursor-grabbing"
              >
                <SceneCard
                  scene={scene}
                  index={index}
                  onUpdateDuration={(id, duration) => onUpdateScene(id, { duration })}
                  onDelete={onDeleteScene}
                  onGenerateVideo={generateVideoForScene}
                  onPreviewVideo={setPreviewVideo}
                  isGenerating={generatingSceneId === scene.id}
                />
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {/* Image Picker Modal */}
      <ImagePicker
        open={showImagePicker}
        onOpenChange={setShowImagePicker}
        onSelectImage={handleSelectImage}
      />

      {/* Video Preview Modal */}
      <VideoPreviewModal
        open={!!previewVideo}
        onOpenChange={() => setPreviewVideo(null)}
        videoUrl={previewVideo}
      />
    </div>
  );
};
