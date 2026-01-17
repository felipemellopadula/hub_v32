import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  ArrowLeft, 
  Plus, 
  Video, 
  Settings, 
  Loader2,
  Image as ImageIcon,
  Coins,
  Wand2,
  FileVideo,
  Play,
  Layers
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/contexts/AuthContext';
import { SceneCard } from './SceneCard';
import { ReferencePanel } from './ReferencePanel';
import { ImagePicker } from './ImagePicker';
import { VideoPreviewModal } from './VideoPreviewModal';
import { StoryPreviewModal } from './StoryPreviewModal';
import { SceneFullScreenView } from './SceneFullScreenView';
import { StoryboardProject, StoryboardScene, StoryboardReference } from '@/hooks/useStoryboard';
import { MODELS as IMAGE_MODELS } from '@/modules/image/config/models';

interface ProjectEditorProps {
  project: StoryboardProject;
  scenes: StoryboardScene[];
  references: StoryboardReference[];
  onBack: () => void;
  onUpdateProject: (projectId: string, updates: Partial<StoryboardProject>) => Promise<StoryboardProject | null>;
  onAddScene: (projectId: string, imageUrl?: string, prompt?: string, sourceImageId?: string) => Promise<StoryboardScene | null>;
  onUpdateScene: (sceneId: string, updates: Partial<StoryboardScene>) => Promise<StoryboardScene | null>;
  onDeleteScene: (sceneId: string) => Promise<boolean>;
  onReorderScenes: (projectId: string, orderedIds: string[]) => Promise<boolean>;
  onAddReference: (projectId: string, imageUrl: string, name?: string) => Promise<StoryboardReference | null>;
  onUpdateReference: (referenceId: string, updates: Partial<StoryboardReference>) => Promise<StoryboardReference | null>;
  onDeleteReference: (referenceId: string) => Promise<boolean>;
}

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9 (Widescreen)' },
  { id: '9:16', label: '9:16 (Vertical)' },
  { id: '1:1', label: '1:1 (Quadrado)' },
  { id: '4:3', label: '4:3 (Standard)' },
];

const VIDEO_MODELS = [
  { id: 'bytedance:seedance@1.5-pro', label: 'Seedance 1.5 Pro', cost: 0.5, aspectRatio: null },
  { id: 'google:3@3', label: 'Google Veo 3.1 Fast', cost: 1, aspectRatio: null },
  { id: 'klingai:kling-video@2.6-pro', label: 'Kling Video 2.6 Pro', cost: 1.5, aspectRatio: null },
  { id: 'minimax:4@1', label: 'MiniMax Hailuo 2.3', cost: 1, aspectRatio: null },
  { id: 'lightricks:2@1', label: 'LTX-2 Fast', cost: 1.5, aspectRatio: '16:9' },
  { id: 'lightricks:2@0', label: 'LTX-2 Pro', cost: 2, aspectRatio: '16:9' },
];

const IMAGE_GENERATION_COST = 0.1;

// Resoluções específicas por modelo (LTX requer 16:9 exato com resoluções específicas)
const MODEL_RESOLUTIONS: Record<string, { width: number; height: number }> = {
  'lightricks:2@1': { width: 1920, height: 1080 }, // LTX-2 Fast
  'lightricks:2@0': { width: 1920, height: 1080 }, // LTX-2 Pro
};

// FPS por modelo (copiado de Video.tsx)
const FPS_BY_MODEL: Record<string, number> = {
  'lightricks:2@1': 25,  // LTX-2 Fast default
  'lightricks:2@0': 25,  // LTX-2 Pro default
};

// Durações válidas por modelo (copiado de Video.tsx)
const DURATIONS_BY_MODEL: Record<string, number[]> = {
  'bytedance:seedance@1.5-pro': [4, 5, 6, 7, 8, 9, 10, 11, 12],
  'google:3@3': [4, 6, 8],
  'klingai:kling-video@2.6-pro': [5, 10],
  'minimax:4@1': [6, 10],
  'lightricks:2@1': [6, 8, 10],  // LTX-2 Fast
  'lightricks:2@0': [6, 8, 10],  // LTX-2 Pro
};

// Modelos de imagem que suportam consistência visual (múltiplas referências)
const CONSISTENCY_SUPPORTED_MODELS = [
  'google:4@2',              // Nano Banana 2 Pro (14 refs)
  'google:4@1',              // Nano Banana (2 refs)
  'openai:4@1',              // GPT Image 1.5 (6 refs)
  'bytedance:seedream@4.5',  // Seedream 4.5 (2 refs)
  'bfl:3@1',                 // FLUX.1 Kontext [max] (1 ref)
];

// Máximo de referências de consistência por modelo
const MAX_CONSISTENCY_REFS: Record<string, number> = {
  'google:4@2': 14,
  'google:4@1': 2,
  'openai:4@1': 6,
  'bytedance:seedream@4.5': 2,
  'bfl:3@1': 1,
};

// Helper: Get valid Runware API dimensions for aspect ratio
const getDimensionsForAspectRatio = (aspectRatio: string): { width: number; height: number } => {
  switch (aspectRatio) {
    case '9:16':
      return { width: 720, height: 1280 };  // 720p vertical
    case '1:1':
      return { width: 1024, height: 1024 };
    case '4:3':
      return { width: 960, height: 720 };
    case '16:9':
    default:
      return { width: 1280, height: 720 };  // 720p padrão
  }
};

// Helper: sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Convert image URL to base64
const imageUrlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper: Convert base64 to blob
const base64ToBlob = (base64: string, contentType: string = 'image/png'): Blob => {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(base64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: contentType });
};

export const ProjectEditor: React.FC<ProjectEditorProps> = ({
  project,
  scenes,
  references,
  onBack,
  onUpdateProject,
  onAddScene,
  onUpdateScene,
  onDeleteScene,
  onReorderScenes,
  onAddReference,
  onUpdateReference,
  onDeleteReference,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isLegacyUser, creditsRemaining, setShowPurchaseModal } = useCredits();
  
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [showStoryPreview, setShowStoryPreview] = useState(false);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<string | null>(null);
  const [generatingVideoSceneId, setGeneratingVideoSceneId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(project.name);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  
  // Image model selection - filter out models that don't support references (maxImages <= 0)
  const availableImageModels = IMAGE_MODELS.filter(m => m.maxImages > 0);
  const [selectedImageModel, setSelectedImageModel] = useState(availableImageModels[0]?.id || 'google:4@2');

  // Get current model cost
  const modelCost = VIDEO_MODELS.find(m => m.id === project.video_model)?.cost || 0.5;
  const pendingVideoScenes = scenes.filter(s => 
    s.image_status === 'completed' && (s.video_status === 'pending' || s.video_status === 'failed')
  );
  const totalVideoCost = pendingVideoScenes.length * modelCost;
  const completedVideoScenes = scenes.filter(s => s.video_status === 'completed' && s.video_url);

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

  // Handle reference selection from ImagePicker
  const handleSelectReference = async (imageUrl: string, prompt?: string, imageId?: string) => {
    await onAddReference(project.id, imageUrl);
  };

  // Handle prompt update
  const handleUpdatePrompt = async (sceneId: string, prompt: string) => {
    await onUpdateScene(sceneId, { prompt });
  };

  // Handle motion prompt update
  const handleUpdateMotionPrompt = async (sceneId: string, motionPrompt: string) => {
    await onUpdateScene(sceneId, { motion_prompt: motionPrompt } as Partial<StoryboardScene>);
  };

  // Add empty scene
  const handleAddEmptyScene = async () => {
    await onAddScene(project.id);
    toast({
      title: 'Cena adicionada',
      description: 'Descreva a cena e gere a imagem.',
    });
  };

  // Generate image for a scene using references + prompt + consistency refs
  const generateImageForScene = useCallback(async (scene: StoryboardScene): Promise<'completed' | 'failed'> => {
    if (!scene.prompt) {
      toast({
        title: 'Descrição necessária',
        description: 'Adicione uma descrição detalhada para a cena.',
        variant: 'destructive',
      });
      return 'failed';
    }

    // Check credits
    if (!isLegacyUser && creditsRemaining < IMAGE_GENERATION_COST) {
      toast({
        title: 'Créditos insuficientes',
        description: `Você precisa de ${IMAGE_GENERATION_COST} créditos para gerar esta imagem.`,
        variant: 'destructive',
      });
      setShowPurchaseModal(true);
      return 'failed';
    }

    setGeneratingImageSceneId(scene.id);

    try {
      // Update scene status
      await onUpdateScene(scene.id, { image_status: 'generating' });

      // Get valid dimensions for aspect ratio
      const dimensions = getDimensionsForAspectRatio(project.aspect_ratio || '16:9');
      console.log('[Storyboard] Using dimensions:', dimensions);

      // Prepare manual references
      const referenceImagesBase64 = await Promise.all(
        references.map(ref => imageUrlToBase64(ref.image_url))
      );

      // Prepare consistency references (previous scenes with generated images)
      let consistencyRefs: string[] = [];
      const supportsConsistency = CONSISTENCY_SUPPORTED_MODELS.includes(selectedImageModel);
      const consistencyEnabled = project.visual_consistency !== false;

      if (supportsConsistency && consistencyEnabled) {
        // Get previous scenes that already have generated images
        const previousScenes = scenes
          .filter(s => s.order_index < scene.order_index && s.generated_image_url)
          .sort((a, b) => b.order_index - a.order_index); // Most recent first

        // Limit to available slots (max refs - manual refs)
        const maxRefs = MAX_CONSISTENCY_REFS[selectedImageModel] || 2;
        const availableSlots = Math.max(0, maxRefs - referenceImagesBase64.length);
        const scenesToUse = previousScenes.slice(0, availableSlots);

        if (scenesToUse.length > 0) {
          console.log(`[Storyboard] Visual consistency: using ${scenesToUse.length} previous scenes as reference`);
          
          consistencyRefs = await Promise.all(
            scenesToUse.map(s => imageUrlToBase64(s.generated_image_url!))
          );
        }
      }

      // Combine all references: manual + consistency
      const allReferenceImages = [
        ...referenceImagesBase64,  // Manual references first
        ...consistencyRefs,        // Previous scenes after
      ];

      let data, error;

      if (allReferenceImages.length > 0) {
        // With references: use edit-image endpoint
        // Build enhanced prompt with reference names
        let enhancedPrompt = scene.prompt!;
        references.forEach((ref, index) => {
          const refPattern = new RegExp(ref.name, 'gi');
          enhancedPrompt = enhancedPrompt.replace(refPattern, `[reference image ${index + 1}]`);
        });

        console.log('[Storyboard] Generating image with references:', allReferenceImages.length);
        console.log('[Storyboard] Enhanced prompt:', enhancedPrompt);

        const result = await supabase.functions.invoke('edit-image', {
          body: {
            model: selectedImageModel,
            positivePrompt: enhancedPrompt,
            inputImage: allReferenceImages[0],
            inputImages: allReferenceImages,
            width: dimensions.width,
            height: dimensions.height,
          },
        });
        data = result.data;
        error = result.error;
      } else {
        // No references: use generate-image endpoint
        console.log('[Storyboard] Generating image from prompt only:', scene.prompt);

        const result = await supabase.functions.invoke('generate-image', {
          body: {
            model: selectedImageModel,
            positivePrompt: scene.prompt,
            width: dimensions.width,
            height: dimensions.height,
          },
        });
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      
      // Handle different response formats: edit-image returns { image }, generate-image returns { images: [] }
      let imageBase64: string;
      if (data?.image) {
        imageBase64 = data.image;
      } else if (data?.images && data.images.length > 0) {
        imageBase64 = data.images[0].image;
      } else {
        throw new Error('Nenhuma imagem gerada');
      }

      // Upload generated image to storage
      const imageBlob = base64ToBlob(imageBase64);
      const fileName = `storyboard/${project.id}/${scene.id}_generated_${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, imageBlob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      // Update scene with generated image
      await onUpdateScene(scene.id, {
        generated_image_url: publicUrl,
        image_url: publicUrl,
        image_status: 'completed',
      });

      toast({
        title: 'Imagem gerada!',
        description: consistencyRefs.length > 0 
          ? `Usando ${consistencyRefs.length} cena(s) anterior(es) para consistência.`
          : 'Agora você pode gerar o vídeo da cena.',
      });

      setGeneratingImageSceneId(null);
      return 'completed';

    } catch (error: any) {
      console.error('[Storyboard] Image generation error:', error);
      await onUpdateScene(scene.id, { image_status: 'failed' });
      toast({
        title: 'Erro ao gerar imagem',
        description: error.message,
        variant: 'destructive',
      });
      setGeneratingImageSceneId(null);
      return 'failed';
    }
  }, [project, scenes, references, isLegacyUser, creditsRemaining, onUpdateScene, toast, setShowPurchaseModal, selectedImageModel]);

  // Generate video for a scene
  const generateVideoForScene = useCallback(async (scene: StoryboardScene): Promise<'completed' | 'failed'> => {
    const MAX_ATTEMPTS = 60;
    const POLL_INTERVAL = 5000;

    if (!scene.generated_image_url && !scene.image_url) {
      toast({
        title: 'Imagem necessária',
        description: 'Gere a imagem da cena primeiro.',
        variant: 'destructive',
      });
      return 'failed';
    }

    // Check credits
    if (!isLegacyUser && creditsRemaining < modelCost) {
      toast({
        title: 'Créditos insuficientes',
        description: `Você precisa de ${modelCost} créditos para gerar este vídeo.`,
        variant: 'destructive',
      });
      setShowPurchaseModal(true);
      return 'failed';
    }

    setGeneratingVideoSceneId(scene.id);

    try {
      await onUpdateScene(scene.id, { video_status: 'generating' });

      const imageUrl = scene.generated_image_url || scene.image_url;

      // Use motion_prompt if available, otherwise fall back to prompt
      const videoPrompt = scene.motion_prompt || scene.prompt || 'Animate this image with smooth cinematic motion';

      // Determinar dimensões: usar resolução fixa do modelo se existir (LTX)
      const modelResolution = MODEL_RESOLUTIONS[project.video_model];
      let finalWidth: number;
      let finalHeight: number;

      if (modelResolution) {
        // Modelo com resolução fixa (LTX)
        finalWidth = modelResolution.width;
        finalHeight = modelResolution.height;
        
        // Avisar se aspect ratio do projeto não é 16:9
        if (project.aspect_ratio && project.aspect_ratio !== '16:9') {
          toast({
            title: 'LTX só suporta 16:9',
            description: 'O vídeo será gerado em 1920x1080.',
          });
        }
      } else {
        // Usar dimensões baseadas no aspect ratio do projeto
        const dims = getDimensionsForAspectRatio(project.aspect_ratio || '16:9');
        finalWidth = dims.width;
        finalHeight = dims.height;
      }

      // Verificar se é modelo LTX
      const isLtxModel = project.video_model.startsWith('lightricks:');
      const isByteDanceModel = project.video_model.includes('bytedance');

      // Validar duração para o modelo
      const validDurations = DURATIONS_BY_MODEL[project.video_model] || [5];
      const sceneDuration = validDurations.includes(scene.duration || 5) 
        ? scene.duration 
        : validDurations[0];

      if (sceneDuration !== scene.duration) {
        toast({
          title: 'Duração ajustada',
          description: `${project.video_model.split(':')[0]} não suporta ${scene.duration}s. Usando ${sceneDuration}s.`,
        });
      }

      const { data, error } = await supabase.functions.invoke('runware-video', {
        body: {
          action: 'start',
          modelId: project.video_model,
          positivePrompt: videoPrompt,
          frameStartUrl: imageUrl,
          duration: sceneDuration,
          width: finalWidth,
          height: finalHeight,
          outputFormat: 'mp4',
          numberResults: 1,
          // Configurações específicas para LTX
          ...(isLtxModel ? {
            customFps: FPS_BY_MODEL[project.video_model] || 25,
            generateAudio: false,
          } : {}),
          // Configurações para ByteDance
          ...(isByteDanceModel ? {
            providerSettings: {
              bytedance: {
                cameraFixed: false
              }
            }
          } : {}),
        },
      });

      if (error) throw error;
      if (!data?.taskUUID) throw new Error('No task ID returned');

      const taskUUID = data.taskUUID;
      console.log(`[Storyboard] Scene ${scene.id}: Started video generation, taskUUID=${taskUUID}`);

      // Polling loop
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL);

        const { data: statusData, error: statusError } = await supabase.functions.invoke('runware-video', {
          body: { action: 'status', taskUUID },
        });

        if (statusError) throw statusError;

        if (statusData?.failed) {
          throw new Error(statusData?.details || 'Video generation failed');
        }

        const statusItem = statusData?.result;
        const videoURL = statusItem?.videoURL || statusItem?.url;

        if (videoURL) {
          console.log(`[Storyboard] Scene ${scene.id}: Video completed!`);

          await onUpdateScene(scene.id, {
            video_status: 'completed',
            video_url: videoURL,
          });

          toast({
            title: 'Vídeo gerado!',
            description: `A cena ${scenes.findIndex(s => s.id === scene.id) + 1} foi gerada com sucesso.`,
          });

          setGeneratingVideoSceneId(null);
          return 'completed';
        }
      }

      throw new Error('Tempo limite excedido (5 minutos).');

    } catch (error: any) {
      console.error(`[Storyboard] Video error:`, error.message);
      await onUpdateScene(scene.id, { video_status: 'failed' });
      toast({
        title: 'Erro ao gerar vídeo',
        description: error.message,
        variant: 'destructive',
      });
      setGeneratingVideoSceneId(null);
      return 'failed';
    }
  }, [project, scenes, isLegacyUser, creditsRemaining, modelCost, onUpdateScene, toast, setShowPurchaseModal]);

  // Generate all pending videos
  const generateAllVideos = async () => {
    if (pendingVideoScenes.length === 0) {
      toast({
        title: 'Nenhum vídeo pendente',
        description: 'Todas as cenas já têm vídeos gerados.',
      });
      return;
    }

    if (!isLegacyUser && creditsRemaining < totalVideoCost) {
      toast({
        title: 'Créditos insuficientes',
        description: `Você precisa de ${totalVideoCost} créditos.`,
        variant: 'destructive',
      });
      setShowPurchaseModal(true);
      return;
    }

    setIsGeneratingAll(true);

    const sortedScenes = [...pendingVideoScenes].sort((a, b) => a.order_index - b.order_index);
    let successCount = 0;
    let failCount = 0;

    for (const scene of sortedScenes) {
      const result = await generateVideoForScene(scene);
      if (result === 'completed') successCount++;
      else failCount++;
      await sleep(1000);
    }

    setIsGeneratingAll(false);

    toast({
      title: failCount === 0 ? 'Todos os vídeos gerados!' : 'Geração parcial',
      description: failCount === 0
        ? `${successCount} cenas processadas.`
        : `${successCount} sucesso, ${failCount} falhas.`,
      variant: failCount > 0 ? 'destructive' : 'default',
    });
  };

  // Export all completed videos as ZIP
  const exportFullStory = async () => {
    if (completedVideoScenes.length < 2) {
      toast({
        title: 'Mínimo de 2 vídeos necessários',
        description: 'Gere pelo menos 2 cenas com vídeos para exportar a história.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Sort scenes by order_index
      const sortedScenes = [...completedVideoScenes].sort((a, b) => a.order_index - b.order_index);

      // Download each video and add to ZIP
      for (let i = 0; i < sortedScenes.length; i++) {
        const scene = sortedScenes[i];
        const response = await fetch(scene.video_url!);
        const blob = await response.blob();

        // Sequential name (01, 02, 03...)
        const paddedNumber = String(i + 1).padStart(2, '0');
        const fileName = `${paddedNumber}_cena_${scene.id.slice(0, 8)}.mp4`;

        zip.file(fileName, blob);
        setExportProgress(((i + 1) / sortedScenes.length) * 80);
      }

      // Generate ZIP file
      setExportProgress(85);
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger download
      setExportProgress(95);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_historia.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportProgress(100);

      toast({
        title: 'História exportada!',
        description: `${sortedScenes.length} vídeos baixados em ordem. Combine-os em qualquer editor de vídeo.`,
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Erro ao exportar',
        description: error.message || 'Falha ao processar vídeos.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Row 1: Back + Name + Badges (desktop) */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>

            {isEditingName ? (
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                className="text-lg sm:text-xl font-bold w-full max-w-[200px] sm:max-w-[300px]"
                autoFocus
              />
            ) : (
              <h2
                className="text-lg sm:text-xl font-bold cursor-pointer hover:text-primary transition-colors truncate max-w-[180px] sm:max-w-none"
                onClick={() => setIsEditingName(true)}
              >
                {project.name}
              </h2>
            )}

            <Badge variant="outline" className="hidden sm:flex shrink-0">{project.aspect_ratio}</Badge>
            <Badge variant="secondary" className="hidden sm:flex shrink-0">{scenes.length} cenas</Badge>
          </div>

          {/* Row 2 (mobile only): Badges */}
          <div className="flex items-center gap-2 sm:hidden">
            <Badge variant="outline">{project.aspect_ratio}</Badge>
            <Badge variant="secondary">{scenes.length} cenas</Badge>
          </div>

          {/* Row 3: Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Credits Display */}
            {!isLegacyUser && pendingVideoScenes.length > 0 && (
              <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <Coins className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Vídeos:</span>
                <span>{totalVideoCost} créditos</span>
              </div>
            )}

            {/* Settings Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
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
                      disabled={VIDEO_MODELS.find(m => m.id === project.video_model)?.aspectRatio === '16:9'}
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
                    {VIDEO_MODELS.find(m => m.id === project.video_model)?.aspectRatio && (
                      <p className="text-xs text-muted-foreground">
                        O modelo selecionado suporta apenas 16:9
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo de Vídeo</Label>
                    <Select
                      value={project.video_model}
                      onValueChange={(v) => {
                        const selectedModel = VIDEO_MODELS.find(m => m.id === v);
                        const newValidDurations = DURATIONS_BY_MODEL[v] || [5];
                        
                        // Update scenes with invalid durations
                        scenes.forEach(scene => {
                          if (!newValidDurations.includes(scene.duration || 5)) {
                            onUpdateScene(scene.id, { duration: newValidDurations[0] });
                          }
                        });
                        
                        // LTX models only support 16:9
                        if (selectedModel?.aspectRatio === '16:9' && project.aspect_ratio !== '16:9') {
                          onUpdateProject(project.id, { video_model: v, aspect_ratio: '16:9' });
                          toast({
                            title: 'Configurações ajustadas',
                            description: 'Proporção 16:9 aplicada e durações das cenas foram atualizadas.',
                          });
                        } else {
                          onUpdateProject(project.id, { video_model: v });
                          if (scenes.some(s => !newValidDurations.includes(s.duration || 5))) {
                            toast({
                              title: 'Durações ajustadas',
                              description: `Durações das cenas foram ajustadas para ${newValidDurations[0]}s (válido para este modelo).`,
                            });
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label} ({model.cost} créditos){model.aspectRatio && ` • ${model.aspectRatio}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo de Imagem</Label>
                    <Select value={selectedImageModel} onValueChange={setSelectedImageModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableImageModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Modelo usado para gerar imagens das cenas
                    </p>
                  </div>

                  {/* Visual Consistency Toggle */}
                  {CONSISTENCY_SUPPORTED_MODELS.includes(selectedImageModel) && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          Consistência Visual
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Usar cenas anteriores como referência automática
                          {MAX_CONSISTENCY_REFS[selectedImageModel] && (
                            <span className="block">
                              (até {MAX_CONSISTENCY_REFS[selectedImageModel]} referência{MAX_CONSISTENCY_REFS[selectedImageModel] > 1 ? 's' : ''})
                            </span>
                          )}
                        </p>
                      </div>
                      <Switch 
                        checked={project.visual_consistency !== false}
                        onCheckedChange={(checked) => 
                          onUpdateProject(project.id, { visual_consistency: checked })
                        }
                      />
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Add Scene Button */}
            <Button onClick={handleAddEmptyScene} variant="outline" size="sm" className="gap-1 h-8 sm:h-9">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Cena</span>
            </Button>

            {/* Preview Button - always visible, disabled if no videos */}
            <Button
              onClick={() => setShowStoryPreview(true)}
              variant="outline"
              size="sm"
              className="gap-1 h-8 sm:h-9"
              disabled={completedVideoScenes.length < 1}
            >
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>

            {/* Export Story Button - always visible, disabled if < 2 videos */}
            <Button
              onClick={exportFullStory}
              variant="outline"
              size="sm"
              className="gap-1 h-8 sm:h-9"
              disabled={completedVideoScenes.length < 2 || isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Exportando</span> {exportProgress.toFixed(0)}%
                </>
              ) : (
                <>
                  <FileVideo className="h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </>
              )}
            </Button>

            {/* Generate All Videos Button */}
            {pendingVideoScenes.length > 0 && (
              <Button
                onClick={generateAllVideos}
                size="sm"
                className="gap-1 h-8 sm:h-9"
                disabled={generatingVideoSceneId !== null || isGeneratingAll}
              >
                {isGeneratingAll || generatingVideoSceneId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Gerando</span> ({scenes.filter(s => s.video_status === 'completed').length}/{scenes.length})
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    <span className="hidden sm:inline">Gerar Vídeos</span>
                    <span className="sm:hidden">Gerar</span> ({pendingVideoScenes.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Scenes Grid */}
        {scenes.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-16 text-center">
            <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Comece seu Storyboard</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
              1. Adicione <strong>referências</strong> no painel lateral (pessoas, produtos, cenários)<br />
              2. Crie <strong>cenas</strong> com descrições detalhadas<br />
              3. A IA <strong>gera as imagens</strong> combinando suas referências<br />
              4. Depois, <strong>gere os vídeos</strong> para cada cena
            </p>
            <Button onClick={handleAddEmptyScene} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Primeira Cena
            </Button>
          </div>
        ) : (
          <Reorder.Group
            axis="x"
            values={scenes}
            onReorder={handleReorder}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
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
                    onUpdatePrompt={handleUpdatePrompt}
                    onUpdateMotionPrompt={handleUpdateMotionPrompt}
                    onUpdateDuration={(id, duration) => onUpdateScene(id, { duration })}
                    onDelete={onDeleteScene}
                    onGenerateImage={generateImageForScene}
                    onGenerateVideo={generateVideoForScene}
                    onPreviewVideo={setPreviewVideo}
                    onOpenFullScreen={() => setFullScreenIndex(index)}
                    isGeneratingImage={generatingImageSceneId === scene.id}
                    isGeneratingVideo={generatingVideoSceneId === scene.id}
                    hasReferences={references.length > 0}
                    validDurations={DURATIONS_BY_MODEL[project.video_model] || [5]}
                  />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      {/* Reference Panel */}
      <ReferencePanel
        references={references}
        onAddReference={() => setShowReferencePicker(true)}
        onUpdateReference={onUpdateReference}
        onDeleteReference={onDeleteReference}
      />

      {/* Reference Image Picker Modal */}
      <ImagePicker
        open={showReferencePicker}
        onOpenChange={setShowReferencePicker}
        onSelectImage={handleSelectReference}
      />

      {/* Video Preview Modal */}
      <VideoPreviewModal
        open={!!previewVideo}
        onOpenChange={() => setPreviewVideo(null)}
        videoUrl={previewVideo}
      />

      {/* Story Preview Modal */}
      <StoryPreviewModal
        open={showStoryPreview}
        onOpenChange={setShowStoryPreview}
        scenes={scenes}
      />

      {/* Full Screen Scene View (Mobile) */}
      {fullScreenIndex !== null && (
        <SceneFullScreenView
          scenes={scenes}
          currentIndex={fullScreenIndex}
          onClose={() => setFullScreenIndex(null)}
          onNavigate={(newIndex) => {
            if (newIndex >= 0 && newIndex < scenes.length) {
              setFullScreenIndex(newIndex);
            }
          }}
          onGenerateImage={generateImageForScene}
          onGenerateVideo={generateVideoForScene}
          onPreviewVideo={setPreviewVideo}
          isGeneratingImage={generatingImageSceneId === scenes[fullScreenIndex]?.id}
          isGeneratingVideo={generatingVideoSceneId === scenes[fullScreenIndex]?.id}
          hasReferences={references.length > 0}
        />
      )}
    </div>
  );
};
