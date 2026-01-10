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
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  // Se já é URL completa, retorna direto
  if (url.startsWith('http')) return url;
  // Senão, converte o path relativo para URL pública
  const { data } = supabase.storage.from('images').getPublicUrl(url);
  return data.publicUrl;
};

interface SceneCardProps {
  scene: StoryboardScene;
  index: number;
  onUpdateDuration: (sceneId: string, duration: number) => void;
  onDelete: (sceneId: string) => void;
  onGenerateVideo: (scene: StoryboardScene) => void;
  onPreviewVideo: (videoUrl: string) => void;
  isGenerating: boolean;
  isDragging?: boolean;
}

const DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

const statusConfig = {
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
  onUpdateDuration,
  onDelete,
  onGenerateVideo,
  onPreviewVideo,
  isGenerating,
  isDragging,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const status = statusConfig[scene.video_status];
  const StatusIcon = status.icon;
  const canGenerate = scene.video_status === 'pending' || scene.video_status === 'failed';

  const handlePlayPause = () => {
    if (!videoRef.current || !scene.video_url) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!scene.video_url) return;
    const a = document.createElement('a');
    a.href = scene.video_url;
    a.download = `scene-${index + 1}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        <Badge className={cn("gap-1", status.className)}>
          <StatusIcon className={cn("h-3 w-3", scene.video_status === 'generating' && "animate-spin")} />
          {status.label}
        </Badge>
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
              poster={getSceneImageUrl(scene.image_url)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* Play/Pause Overlay */}
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handlePlayPause}
            >
              <Button variant="ghost" size="icon" className="h-12 w-12 bg-background/50 hover:bg-background/70">
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <img
            src={getSceneImageUrl(scene.image_url)}
            alt={scene.prompt || `Cena ${index + 1}`}
            className="w-full h-full object-cover"
          />
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
        {/* Prompt Preview */}
        {scene.prompt && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {scene.prompt}
          </p>
        )}

        {/* Duration & Actions */}
        <div className="flex items-center gap-2">
          <Select
            value={String(scene.duration)}
            onValueChange={(v) => onUpdateDuration(scene.id, Number(v))}
          >
            <SelectTrigger className="h-8 w-[80px] text-xs">
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

          {canGenerate && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1"
              onClick={() => onGenerateVideo(scene)}
              disabled={isGenerating}
            >
              {isGenerating ? (
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
      </div>
    </motion.div>
  );
});

SceneCard.displayName = 'SceneCard';
