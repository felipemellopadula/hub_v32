import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Trash2, 
  Clock, 
  Video, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  GripVertical,
  Download,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Maximize
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StoryboardScene } from '@/hooks/useStoryboard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// Helper para converter paths relativos em URLs públicas
const getSceneImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from('images').getPublicUrl(url);
  return data.publicUrl;
};

interface SceneCardProps {
  scene: StoryboardScene;
  index: number;
  onUpdatePrompt: (sceneId: string, prompt: string) => void;
  onUpdateDuration: (sceneId: string, duration: number) => void;
  onDelete: (sceneId: string) => void;
  onGenerateImage: (scene: StoryboardScene) => void;
  onGenerateVideo: (scene: StoryboardScene) => void;
  onPreviewVideo: (videoUrl: string) => void;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  hasReferences: boolean;
  isDragging?: boolean;
}

const DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

const imageStatusConfig = {
  pending: {
    label: 'Sem imagem',
    icon: ImageIcon,
    className: 'bg-muted text-muted-foreground',
  },
  generating: {
    label: 'Gerando...',
    icon: Loader2,
    className: 'bg-blue-500/20 text-blue-600',
  },
  completed: {
    label: 'Imagem pronta',
    icon: CheckCircle,
    className: 'bg-green-500/20 text-green-600',
  },
  failed: {
    label: 'Erro',
    icon: AlertCircle,
    className: 'bg-destructive/20 text-destructive',
  },
};

const videoStatusConfig = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'bg-muted text-muted-foreground',
  },
  generating: {
    label: 'Gerando...',
    icon: Loader2,
    className: 'bg-yellow-500/20 text-yellow-600',
  },
  completed: {
    label: 'Pronto',
    icon: CheckCircle,
    className: 'bg-green-500/20 text-green-600',
  },
  failed: {
    label: 'Erro',
    icon: AlertCircle,
    className: 'bg-destructive/20 text-destructive',
  },
};

export const SceneCard: React.FC<SceneCardProps> = memo(({
  scene,
  index,
  onUpdatePrompt,
  onUpdateDuration,
  onDelete,
  onGenerateImage,
  onGenerateVideo,
  onPreviewVideo,
  isGeneratingImage,
  isGeneratingVideo,
  hasReferences,
  isDragging,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [promptValue, setPromptValue] = useState(scene.prompt || '');
  const [promptFocused, setPromptFocused] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const imageStatus = imageStatusConfig[scene.image_status] || imageStatusConfig.pending;
  const videoStatus = videoStatusConfig[scene.video_status];
  const ImageStatusIcon = imageStatus.icon;
  const VideoStatusIcon = videoStatus.icon;

  const hasImage = scene.image_status === 'completed' && (scene.generated_image_url || scene.image_url);
  const canGenerateImage = hasReferences && scene.prompt && scene.image_status !== 'generating';
  const canGenerateVideo = hasImage && scene.video_status !== 'generating';

  const displayImageUrl = scene.generated_image_url || scene.image_url;

  const handlePlayPause = () => {
    if (!videoRef.current || !scene.video_url) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!scene.video_url) return;
    const a = document.createElement('a');
    a.href = scene.video_url;
    a.download = `scene-${index + 1}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };


  const handlePromptBlur = () => {
    setPromptFocused(false);
    if (promptValue !== scene.prompt) {
      onUpdatePrompt(scene.id, promptValue);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "relative group bg-card border rounded-xl overflow-hidden transition-all",
        isDragging && "opacity-50 scale-105 shadow-xl",
        isHovered && "ring-2 ring-primary/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Scene Number Badge */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
        <div className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
          <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
          {index + 1}
        </div>
      </div>

      {/* Status Badge */}
      <div className="absolute top-2 right-2 z-20">
        {hasImage ? (
          <Badge className={cn("gap-1", videoStatus.className)}>
            <VideoStatusIcon className={cn("h-3 w-3", scene.video_status === 'generating' && "animate-spin")} />
            {videoStatus.label}
          </Badge>
        ) : (
          <Badge className={cn("gap-1", imageStatus.className)}>
            <ImageStatusIcon className={cn("h-3 w-3", scene.image_status === 'generating' && "animate-spin")} />
            {imageStatus.label}
          </Badge>
        )}
      </div>

      {/* Image/Video Preview */}
      <div className="aspect-video relative bg-muted">
        {scene.video_url && scene.video_status === 'completed' ? (
          <>
            <video
              ref={videoRef}
              src={scene.video_url}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
              poster={getSceneImageUrl(displayImageUrl)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* Video Controls Overlay */}
            <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/50 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Top: Download + Fullscreen buttons */}
              <div className="flex justify-end gap-1 p-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white"
                  onClick={handleDownload}
                  title="Baixar vídeo"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (scene.video_url) onPreviewVideo(scene.video_url);
                  }}
                  title="Ampliar"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>

              {/* Center: Play/Pause */}
              <div 
                className="flex-1 flex items-center justify-center cursor-pointer"
                onClick={handlePlayPause}
              >
                <Button variant="ghost" size="icon" className="h-12 w-12 bg-background/50 hover:bg-background/70">
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
              </div>

              {/* Bottom spacer */}
              <div className="h-6" />
            </div>
          </>
        ) : hasImage ? (
          <img
            src={getSceneImageUrl(displayImageUrl)}
            alt={scene.prompt || `Cena ${index + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-2" />
            <span className="text-xs text-center px-4">
              {scene.image_status === 'generating' 
                ? 'Gerando imagem...' 
                : 'Descreva a cena e clique em "Criar Imagem"'}
            </span>
          </div>
        )}

        {/* Delete Button */}
        <Button
          variant="destructive"
          size="icon"
          className="absolute bottom-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={() => onDelete(scene.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-3">
        {/* Scene Description */}
        <Textarea
          placeholder="Descreva a cena em detalhes...
Ex: The man (IMG1) is holding a bottle (IMG2), extreme close up with cinematic lighting, shallow depth of field."
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          onFocus={() => setPromptFocused(true)}
          onBlur={handlePromptBlur}
          className={cn(
            "text-xs min-h-[80px] resize-none transition-all",
            promptFocused && "ring-2 ring-primary"
          )}
        />

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Duration Select */}
          <Select
            value={String(scene.duration)}
            onValueChange={(v) => onUpdateDuration(scene.id, Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Generate Image Button */}
          {!hasImage && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1 bg-primary/10 hover:bg-primary/20 border-primary/30"
              onClick={() => onGenerateImage(scene)}
              disabled={isGeneratingImage || !canGenerateImage}
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="h-3 w-3" />
                  Criar Imagem
                </>
              )}
            </Button>
          )}

          {/* Generate Video Button */}
          {hasImage && scene.video_status !== 'completed' && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1"
              onClick={() => onGenerateVideo(scene)}
              disabled={isGeneratingVideo || !canGenerateVideo}
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Video className="h-3 w-3" />
                  Gerar Vídeo
                </>
              )}
            </Button>
          )}

          {/* Video Complete Actions */}
          {scene.video_status === 'completed' && scene.video_url && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleDownload}
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs gap-1"
                onClick={() => onPreviewVideo(scene.video_url!)}
              >
                <Play className="h-3 w-3" />
                Assistir
              </Button>
            </>
          )}
        </div>

        {/* Helper Text */}
        {!hasReferences && !hasImage && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            ⚠️ Adicione referências no painel lateral primeiro
          </p>
        )}
      </div>
    </motion.div>
  );
});

SceneCard.displayName = 'SceneCard';
