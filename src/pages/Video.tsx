// Video.tsx — versão otimizada para carregamento MUITO mais rápido
// Principais otimizações, mantendo todas as funcionalidades do ByteDance:
// 1) **Somente ByteDance visível** no seletor de modelos (Veo e Kling foram comentados para não renderizar).
// 2) **Lazy-load** de componentes pesados (ThemeToggle, UserProfile, Dialog, ícones abaixo da dobra).
// 3) **Mini-virtualização de thumbs**: os cards do histórico só montam o <video> quando entram no viewport (IntersectionObserver).
// 4) <video> em thumbs com **preload="none"** e **poster** (usa frame inicial se existir) para reduzir rede antes do hover/scroll.
// 5) Upload de referências com **compressão WebP** (já existia), mantendo feedback e validações.
// 6) Polling com **backoff exponencial** e limpeza confiável de timeouts.
// 7) Pequenos ajustes de UI e re-render (memo/useCallback/useMemo/startTransition) para manter a interface fluida.

// --- IMPORTS (acima da dobra apenas o essencial) ---
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  startTransition,
  memo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VideoIcon, ArrowLeft } from "lucide-react"; // ícones do topo (acima da dobra)
import imageCompression from "browser-image-compression";
import { useAuth } from "@/contexts/AuthContext";
import { useButtonDebounce } from "@/hooks/useButtonDebounce";

// Lazy (reduz bundle inicial)
const ThemeToggleLazy = lazy(() => import("@/components/ThemeToggle").then(m => ({ default: m.ThemeToggle })));
const UserProfileLazy = lazy(() => import("@/components/UserProfile"));

// Lazy dos ícones abaixo da dobra
const DownloadIcon = lazy(() => import("lucide-react").then(m => ({ default: m.Download })));
const Link2Icon = lazy(() => import("lucide-react").then(m => ({ default: m.Link2 })));
const Share2Icon = lazy(() => import("lucide-react").then(m => ({ default: m.Share2 })));
const RotateCcwIcon = lazy(() => import("lucide-react").then(m => ({ default: m.RotateCcw })));
const UploadIcon = lazy(() => import("lucide-react").then(m => ({ default: m.Upload })));
const PlayIcon = lazy(() => import("lucide-react").then(m => ({ default: m.Play })));
const PauseIcon = lazy(() => import("lucide-react").then(m => ({ default: m.Pause })));
const MaximizeIcon = lazy(() => import("lucide-react").then(m => ({ default: m.Maximize })));
const XIcon = lazy(() => import("lucide-react").then(m => ({ default: m.X })));
const Trash2Icon = lazy(() => import("lucide-react").then(m => ({ default: m.Trash2 })));

// Dialog em lazy para carregar apenas ao abrir o compartilhamento
const DialogLazy = lazy(async () => {
  const m = await import("@/components/ui/dialog");
  return { default: m.Dialog };
});
const DialogContentLazy = lazy(async () => {
  const m = await import("@/components/ui/dialog");
  return { default: m.DialogContent };
});

// --- TIPOS ---
interface SavedVideoData {
  id: string;
  video_url: string;
  prompt: string;
  model: string;
  resolution: string;
  duration: number;
  aspect_ratio: string;
  initial_frame_url?: string;
  final_frame_url?: string;
  format: string;
  created_at: string;
}

type Resolution = { id: string; label: string; w: number; h: number };

// --- MODELOS ---
// IMPORTANTE: por pedido, Veo e Kling **comentados** para não renderizarem ao usuário.
// Mantenho os objetos auxiliares também comentados, caso sejam reativados depois.

const MODELS = [
  { id: "bytedance:seedance@1.5-pro", label: "Seedance 1.5 Pro", provider: "bytedance" as const },
  { id: "google:3@3", label: "Veo 3.1 Fast", provider: "google" as const },
  { id: "klingai:kling-video@2.6-pro", label: "Kling VIDEO 2.6 Pro", provider: "klingai" as const },
  // { id: "klingai:kling@o1-standard", label: "Kling O1 Standard", provider: "klingai" as const }, // API com problema
];

const RESOLUTIONS_BY_MODEL: Record<string, Resolution[]> = {
  "bytedance:seedance@1.5-pro": [
    // 480p resolutions
    { id: "16:9-480p", label: "16:9 (Wide / Landscape) - 480p", w: 854, h: 480 },
    { id: "4:3-480p", label: "4:3 (Standard / Landscape) - 480p", w: 640, h: 480 },
    { id: "1:1-480p", label: "1:1 (Square) - 480p", w: 480, h: 480 },
    { id: "3:4-480p", label: "3:4 (Standard / Portrait) - 480p", w: 480, h: 640 },
    { id: "9:16-480p", label: "9:16 (Tall / Portrait) - 480p", w: 480, h: 854 },
    { id: "21:9-480p", label: "21:9 (Ultra-Wide / Landscape) - 480p", w: 1120, h: 480 },
    // 720p resolutions
    { id: "16:9-720p", label: "16:9 (Wide / Landscape) - 720p", w: 1280, h: 720 },
    { id: "4:3-720p", label: "4:3 (Standard / Landscape) - 720p", w: 960, h: 720 },
    { id: "1:1-720p", label: "1:1 (Square) - 720p", w: 720, h: 720 },
    { id: "3:4-720p", label: "3:4 (Standard / Portrait) - 720p", w: 720, h: 960 },
    { id: "9:16-720p", label: "9:16 (Tall / Portrait) - 720p", w: 720, h: 1280 },
    { id: "21:9-720p", label: "21:9 (Ultra-Wide / Landscape) - 720p", w: 1680, h: 720 },
  ],
  "google:3@3": [{ id: "16:9-720p", label: "16:9 (Wide / Landscape) - 720p (1280×720)", w: 1280, h: 720 }],
  "klingai:kling-video@2.6-pro": [
    { id: "16:9-1080p", label: "16:9 (Wide / Landscape) - 1080p", w: 1920, h: 1080 },
    { id: "1:1-1440p", label: "1:1 (Square) - 1440p", w: 1440, h: 1440 },
    { id: "9:16-1080p", label: "9:16 (Tall / Portrait) - 1080p", w: 1080, h: 1920 },
  ],
};

const DURATIONS_BY_MODEL: Record<string, number[]> = {
  "bytedance:seedance@1.5-pro": [4, 5, 6, 7, 8, 9, 10, 11, 12],
  "google:3@3": [4, 6, 8],
  "klingai:kling-video@2.6-pro": [5, 10],
};

const SUPPORTS_LAST_FRAME: Record<string, boolean> = {
  "bytedance:seedance@1.5-pro": true,
  "google:3@3": false,
  "klingai:kling-video@2.6-pro": false,
};

const SUPPORTS_AUDIO: Record<string, boolean> = {
  "bytedance:seedance@1.5-pro": false,
  "google:3@3": true,
  "klingai:kling-video@2.6-pro": true,
};

// ✅ Motion Transfer: Kling 2.6 Pro suporta capturar movimentos de vídeo e aplicar em imagem
const SUPPORTS_MOTION_TRANSFER: Record<string, boolean> = {
  "bytedance:seedance@1.5-pro": false,
  "google:3@3": false,
  "klingai:kling-video@2.6-pro": true,
};

const FORMATS = ["mp4", "webm", "mov"];
const MAX_VIDEOS = 12;

// --- HOOK util: observar quando entra em viewport (para lazy-mount de vídeos do histórico) ---
function useInViewport<T extends HTMLElement>(rootMargin: string = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setInView(true);
            io?.disconnect();
          }
        },
        { rootMargin }
      );
      io.observe(el);
    } catch {
      setInView(true);
    }
    return () => io?.disconnect();
  }, [rootMargin]);

  return { ref, inView } as const;
}

// --- THUMBNAIL de VÍDEO LAZY (para o histórico) ---
const LazyThumbVideo: React.FC<{
  src: string;
  poster?: string;
  onTogglePlay: (el: HTMLVideoElement) => void;
  className?: string;
}> = memo(({ src, poster, onTogglePlay, className }) => {
  const { ref, inView } = useInViewport<HTMLDivElement>("200px");
  const vRef = useRef<HTMLVideoElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Força o vídeo a ir para o primeiro frame quando carregado
  const handleLoadedData = useCallback(() => {
    if (vRef.current) {
      vRef.current.currentTime = 0.1; // Vai para 0.1s para garantir que mostra um frame
      setIsLoaded(true);
    }
  }, []);

  return (
    <div ref={ref} className={className} style={{ contentVisibility: "auto" as any, containIntrinsicSize: "180px" }}>
      {/* Monta o <video> somente quando entra na viewport */}
      {inView ? (
        <>
          <video
            ref={vRef}
            src={src}
            className={`w-full h-full object-cover ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            loop
            muted
            playsInline
            preload="auto"
            poster={poster}
            onLoadedData={handleLoadedData}
            onClick={() => vRef.current && onTogglePlay(vRef.current)}
          />
          {/* Placeholder enquanto vídeo carrega */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-muted/80 flex items-center justify-center">
              <VideoIcon className="h-8 w-8 text-muted-foreground animate-pulse" />
            </div>
          )}
        </>
      ) : (
        // Mostra placeholder com cor de fundo ou poster enquanto não carrega
        <div className="w-full h-full bg-muted flex items-center justify-center">
          {poster ? (
            <img src={poster} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <VideoIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
});
LazyThumbVideo.displayName = "LazyThumbVideo";

// --- CARD de VÍDEO SALVO (histórico) ---
const SavedVideo = memo(function SavedVideo({
  video,
  onDelete,
}: {
  video: SavedVideoData;
  onDelete: (id: string, optimistic?: boolean) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const togglePlay = useCallback((el: HTMLVideoElement) => {
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play();
    setIsPlaying((s) => !s);
  }, [isPlaying]);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = video.video_url;
    a.download = "synergy-video.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [video.video_url]);

  const goFullscreen = useCallback(() => {
    // ao clicar no botão; encontra o <video> mais próximo
    const container = document.getElementById(`vid-${video.id}`);
    const el = container?.querySelector("video") as HTMLVideoElement | null;
    if (el?.requestFullscreen) el.requestFullscreen();
  }, [video.id]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDeleting(true);
      onDelete(video.id, true);  // optimistic
      setTimeout(() => onDelete(video.id, false), 0); // operação real
    },
    [onDelete, video.id]
  );

  return (
    <div
      id={`vid-${video.id}`}
      className={`relative aspect-video border border-border rounded-md overflow-hidden group cursor-pointer transition-opacity ${isDeleting ? "opacity-50" : ""}`}
    >
      <LazyThumbVideo
        src={video.video_url}
        poster={video.initial_frame_url}
        onTogglePlay={togglePlay}
        className="w-full h-full"
      />

      {/* Botão deletar */}
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="Excluir vídeo"
      >
        <Suspense fallback={<div className="h-4 w-4 rounded-full bg-muted" />}>
          {isDeleting ? <RotateCcwIcon className="h-4 w-4 animate-spin" /> : <Trash2Icon className="h-4 w-4" />}
        </Suspense>
      </Button>

      {/* Overlay de ações */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="bg-background/50" onClick={goFullscreen} aria-label="Tela cheia">
            <Suspense fallback={<div className="h-5 w-5 rounded bg-muted" />}>
              <MaximizeIcon className="h-5 w-5" />
            </Suspense>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="bg-background/50"
            onClick={(e) => {
              e.stopPropagation();
              // Procura o <video> dentro do card para dar play/pause
              const el = (e.currentTarget.closest(`#vid-${video.id}`)?.querySelector("video") ?? null) as HTMLVideoElement | null;
              if (el) togglePlay(el);
            }}
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
          >
            <Suspense fallback={<div className="h-5 w-5 rounded bg-muted" />}>
              {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            </Suspense>
          </Button>

          <Button variant="ghost" size="icon" className="bg-background/50" onClick={handleDownload} aria-label="Baixar">
            <Suspense fallback={<div className="h-5 w-5 rounded bg-muted" />}>
              <DownloadIcon className="h-5 w-5" />
            </Suspense>
          </Button>
        </div>
      </div>
    </div>
  );
});

// --- PÁGINA PRINCIPAL ---
const VideoPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { debounce, isDebouncing } = useButtonDebounce(2000);

  // Estado principal
  const [modelId, setModelId] = useState<string>("bytedance:seedance@1.5-pro");
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<string>("16:9-720p");
  const [duration, setDuration] = useState<number>(5);
  const [outputFormat, setOutputFormat] = useState<string>("mp4");
  const [cameraFixed, setCameraFixed] = useState<boolean>(false);
  const [generateAudio] = useState<boolean>(false); // off (Veo comentado)
  const [frameStartUrl, setFrameStartUrl] = useState("");
  const [frameEndUrl, setFrameEndUrl] = useState("");
  // ✅ Motion Transfer states (Kling 2.6 Pro)
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [characterOrientation, setCharacterOrientation] = useState<"imageOrientation" | "videoOrientation">("imageOrientation");
  const [keepOriginalSound, setKeepOriginalSound] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [isDragOverVideo, setIsDragOverVideo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskUUID, setTaskUUID] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);
  const [savedVideos, setSavedVideos] = useState<SavedVideoData[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; title: string; text: string }>({ url: "", title: "", text: "" });
  const [isDragOverStart, setIsDragOverStart] = useState(false);
  const [isDragOverEnd, setIsDragOverEnd] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // ✅ Flag para prevenir salvamentos simultâneos
  const savedVideoUrls = useRef(new Set<string>()); // ✅ Controle de URLs já salvas

  // Restrições por modelo (com memo para evitar recalcular)
  const allowedResolutions = useMemo<Resolution[]>(() => RESOLUTIONS_BY_MODEL[modelId] || [], [modelId]);
  const allowedDurations = useMemo<number[]>(() => DURATIONS_BY_MODEL[modelId] || [5], [modelId]);
  const supportsLastFrame = SUPPORTS_LAST_FRAME[modelId];
  const supportsAudio = SUPPORTS_AUDIO[modelId];
  const supportsMotionTransfer = SUPPORTS_MOTION_TRANSFER[modelId];

  const res = useMemo<Resolution>(() => {
    const found = allowedResolutions.find((r) => r.id === resolution);
    return found || allowedResolutions[0];
  }, [allowedResolutions, resolution]);

  // Carrega vídeos salvos (com startTransition para não travar UI)
  const loadSavedVideos = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_videos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(MAX_VIDEOS);

      if (error) throw error;

      startTransition(() => {
        setSavedVideos(data || []);
      });
    } catch (error) {
      console.error("Erro ao carregar vídeos:", error);
    } finally {
      setLoadingVideos(false);
    }
  }, [user]);

  // Salvar vídeo (upload->url pública->metadados) - SEM verificação de duplicatas aqui
  const saveVideoToDatabase = useCallback(
    async (url: string) => {
      if (!user) return;
      
      // ✅ Prevenir múltiplos salvamentos simultâneos
      if (isSaving) {
        console.log("[Video] Salvamento já em andamento, ignorando");
        return;
      }
      
      // ✅ Verificar se URL já foi salva
      if (savedVideoUrls.current.has(url)) {
        console.log("[Video] URL já foi salva anteriormente, ignorando");
        return;
      }
      
      setIsSaving(true);
      savedVideoUrls.current.add(url);
      
      try {
        const videoResponse = await fetch(url);
        const videoBlob = await videoResponse.blob();
        const fileName = `${user.id}/${Date.now()}.mp4`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from("user-videos")
          .upload(fileName, videoBlob, { cacheControl: "3600" });

        if (storageError) throw storageError;

        const { data: publicData } = supabase.storage.from("user-videos").getPublicUrl(storageData.path);

        const { error: dbError } = await supabase.from("user_videos").insert({
          user_id: user.id,
          video_url: publicData.publicUrl,
          prompt,
          model: modelId,
          resolution,
          duration,
          aspect_ratio: res.id,
          initial_frame_url: frameStartUrl || null,
          final_frame_url: frameEndUrl || null,
          format: outputFormat,
        });

        if (dbError) throw dbError;

        loadSavedVideos();
      } catch (error) {
        console.error("Erro ao salvar vídeo:", error);
        savedVideoUrls.current.delete(url); // Remove da lista se falhou
      } finally {
        setIsSaving(false);
      }
    },
    [user, isSaving, prompt, modelId, resolution, duration, res.id, frameStartUrl, frameEndUrl, outputFormat, loadSavedVideos]
  );

  // Deletar vídeo (optimistic + remoção real)
  const deleteVideo = useCallback(
    async (videoId: string, optimistic: boolean = false) => {
      if (!user) return;

      if (optimistic) {
        setSavedVideos((prev) => prev.filter((v) => v.id !== videoId));
        return;
      }

      try {
        const { data: videoData, error: fetchError } = await supabase
          .from("user_videos")
          .select("video_url")
          .eq("id", videoId)
          .single();
        if (fetchError) throw fetchError;

        const url = new URL(videoData.video_url);
        const pathParts = url.pathname.split("/");
        const fileName = pathParts.slice(-2).join("/"); // user_id/timestamp.mp4

        const [storageResult, dbResult] = await Promise.allSettled([
          supabase.storage.from("user-videos").remove([fileName]),
          supabase.from("user_videos").delete().eq("id", videoId),
        ]);

        if (dbResult.status === "rejected") throw dbResult.reason;

        toast({ title: "Sucesso", description: "Vídeo deletado com sucesso." });
      } catch (error) {
        console.error("Erro ao deletar vídeo:", error);
        loadSavedVideos(); // reverte UI
        toast({ title: "Erro", description: "Não foi possível deletar o vídeo.", variant: "destructive" });
      }
    },
    [user, toast, loadSavedVideos]
  );

  // Efeitos
  useEffect(() => {
    loadSavedVideos();
  }, [user, loadSavedVideos]);

  // ✅ Efeito melhorado: só salva se URL for nova e não estiver salvando
  useEffect(() => {
    if (videoUrl && !isSaving && !savedVideoUrls.current.has(videoUrl)) {
      saveVideoToDatabase(videoUrl);
    }
  }, [videoUrl, isSaving, saveVideoToDatabase]);

  useEffect(() => {
    document.title = "Gerar Vídeo com IA | Synergy AI";
    const desc =
      "Crie vídeos com ByteDance (Seedance). Defina resolução, duração e quadros de referência. Rápido e simples.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${window.location.origin}/video`;
  }, []);

  useEffect(() => {
    const resList = RESOLUTIONS_BY_MODEL[modelId];
    if (resList && !resList.some((r) => r.id === resolution)) {
      setResolution(resList[0].id);
    }
    const durList = DURATIONS_BY_MODEL[modelId];
    if (durList && !durList.includes(duration)) {
      setDuration(durList[0]);
    }
    if (!SUPPORTS_LAST_FRAME[modelId] && frameEndUrl) {
      setFrameEndUrl("");
    }
    if (!SUPPORTS_AUDIO[modelId] && generateAudio) {
      // apenas por consistência; Veo está desativado
      // setGenerateAudio(false);
    }
    // ✅ Limpar dados de motion transfer se modelo não suportar
    if (!SUPPORTS_MOTION_TRANSFER[modelId] && referenceVideoUrl) {
      setReferenceVideoUrl("");
      setCharacterOrientation("imageOrientation");
      setKeepOriginalSound(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Upload de imagem com compressão
  const uploadImage = useCallback(
    async (file: File, isStart: boolean) => {
      const setter = isStart ? setUploadingStart : setUploadingEnd;
      const urlSetter = isStart ? setFrameStartUrl : setFrameEndUrl;
      setter(true);

      try {
        const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!validTypes.includes(file.type)) throw new Error("Tipo de arquivo não suportado. Use JPEG, PNG ou WebP.");
        if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo muito grande. Máximo 50MB.");

        const compressionOptions = {
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: "image/webp" as any,
        };

        const compressedFile = await imageCompression(file, compressionOptions);
        const safeFileName = `${user?.id || "temp"}_${Date.now()}.webp`;

        const { data, error } = await supabase.storage.from("video-refs").upload(safeFileName, compressedFile, {
          cacheControl: "3600",
          upsert: true,
        });
        if (error) throw error;

        const { data: publicData } = supabase.storage.from("video-refs").getPublicUrl(data.path);
        if (!publicData.publicUrl) throw new Error("Falha ao gerar URL pública");

        urlSetter(publicData.publicUrl);
      } catch (e: any) {
        console.error("Upload error:", e);
        toast({
          title: "Erro no upload",
          description: e.message || "Tente novamente com uma imagem diferente.",
          variant: "destructive",
        });
      } finally {
        setter(false);
      }
    },
    [toast, user?.id]
  );

  // ✅ Upload de vídeo de referência para Motion Transfer
  const uploadReferenceVideo = useCallback(
    async (file: File) => {
      setUploadingVideo(true);

      try {
        const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/mov"];
        if (!validTypes.includes(file.type)) throw new Error("Tipo de vídeo não suportado. Use MP4, WebM ou MOV.");
        if (file.size > 100 * 1024 * 1024) throw new Error("Arquivo muito grande. Máximo 100MB.");

        const safeFileName = `${user?.id || "temp"}_motion_${Date.now()}.mp4`;

        const { data, error } = await supabase.storage.from("video-refs").upload(safeFileName, file, {
          cacheControl: "3600",
          upsert: true,
        });
        if (error) throw error;

        const { data: publicData } = supabase.storage.from("video-refs").getPublicUrl(data.path);
        if (!publicData.publicUrl) throw new Error("Falha ao gerar URL pública");

        setReferenceVideoUrl(publicData.publicUrl);
        toast({ title: "Sucesso", description: "Vídeo de referência carregado." });
      } catch (e: any) {
        console.error("Upload error:", e);
        toast({
          title: "Erro no upload",
          description: e.message || "Tente novamente com um vídeo diferente.",
          variant: "destructive",
        });
      } finally {
        setUploadingVideo(false);
      }
    },
    [toast, user?.id]
  );

  const handleDragEnter = useCallback((e: React.DragEvent, isStart: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (isStart) setIsDragOverStart(true);
    else setIsDragOverEnd(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent, isStart: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      if (isStart) setIsDragOverStart(false);
      else setIsDragOverEnd(false);
    }
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent, isStart: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      if (isStart) setIsDragOverStart(false);
      else setIsDragOverEnd(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) => f.type.startsWith("image/"));
      if (imageFile) uploadImage(imageFile, isStart);
      else
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, arraste apenas arquivos de imagem.",
          variant: "destructive",
        });
    },
    [toast, uploadImage]
  );

  // Geração com TIMEOUT e LIMITE de tentativas
  const beginPolling = useCallback((uuid: string) => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    
    const MAX_ATTEMPTS = 60; // Máximo 60 tentativas (aproximadamente 5-10 minutos)
    const startTime = Date.now();
    const MAX_DURATION = 10 * 60 * 1000; // 10 minutos timeout absoluto
    
    const poll = async (attempt = 0) => {
      try {
        // ✅ Verificar timeout absoluto
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
          setIsSubmitting(false);
          setTaskUUID(null);
          toast({
            title: "Timeout",
            description: "A geração do vídeo demorou muito. Por favor, tente novamente.",
            variant: "destructive",
          });
          return;
        }
        
        // ✅ Verificar limite de tentativas
        if (attempt >= MAX_ATTEMPTS) {
          setIsSubmitting(false);
          setTaskUUID(null);
          toast({
            title: "Timeout",
            description: `Máximo de tentativas atingido (${MAX_ATTEMPTS}). Por favor, tente novamente.`,
            variant: "destructive",
          });
          return;
        }
        
        const { data, error } = await supabase.functions.invoke("runware-video", {
          body: { action: "status", taskUUID: uuid },
        });
        
        if (error) throw error;
        
        const statusItem = data?.result;
        const videoURL = statusItem?.videoURL || statusItem?.url;
        
        if (videoURL) {
          setVideoUrl(videoURL);
          setIsSubmitting(false);
          setTaskUUID(null);
          toast({ title: "Vídeo pronto", description: "Seu vídeo foi gerado com sucesso." });
          // ✅ Salvar o vídeo automaticamente no banco
          saveVideoToDatabase(videoURL);
          return;
        }
        
        // ✅ Log de progresso a cada 10 tentativas
        if (attempt > 0 && attempt % 10 === 0) {
          console.log(`[Video] Polling tentativa ${attempt}/${MAX_ATTEMPTS}, tempo decorrido: ${Math.round(elapsed / 1000)}s`);
        }
        
        const delay = Math.min(2000 * Math.pow(1.4, attempt), 12000);
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      } catch (err) {
        console.error("[Video] Erro no polling:", err);
        
        // ✅ Limite de erros consecutivos
        if (attempt >= 5) {
          setIsSubmitting(false);
          setTaskUUID(null);
          toast({
            title: "Erro",
            description: "Falha ao verificar status do vídeo. Por favor, tente novamente.",
            variant: "destructive",
          });
          return;
        }
        
        const delay = 5000;
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      }
    };
    // ✅ OTIMIZAÇÃO: Intervalo inicial aumentado de 1200ms para 3000ms
    // Vídeos levam tempo para processar, polling mais espaçado economiza requests
    pollRef.current = window.setTimeout(() => poll(0), 3000) as unknown as number;
  }, [toast, saveVideoToDatabase]);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    },
    []
  );

  const startGeneration = useCallback(async () => {
    // ✅ VERIFICAÇÃO DE DUPLICATAS antes de gerar
    const isDuplicate = savedVideos.some(v => 
      v.prompt === prompt && 
      v.model === modelId && 
      Math.abs(new Date(v.created_at).getTime() - Date.now()) < 60000 // Gerado há menos de 1 minuto
    );
    
    if (isDuplicate) {
      toast({
        title: "Vídeo já existe",
        description: "Você já gerou um vídeo idêntico recentemente. Confira seu histórico abaixo.",
      });
      return;
    }
    
    setIsSubmitting(true);
    setVideoUrl(null);
    setTaskUUID(null);
    savedVideoUrls.current.clear(); // ✅ Limpar controle de URLs ao iniciar nova geração

    const normalizedFormat = outputFormat === "mov" ? "mp4" : outputFormat;

    const providerSettings: Record<string, any> = {};
    if (modelId.startsWith("bytedance")) {
      providerSettings.bytedance = { cameraFixed };
    }
    // if (modelId.startsWith("google")) providerSettings.google = { generateAudio }; // Veo desativado

    try {
      const payload: any = {
        action: "start",
        modelId,
        positivePrompt: prompt,
        width: res.w,
        height: res.h,
        duration,
        fps: 24,
        outputFormat: normalizedFormat,
        numberResults: 1,
        includeCost: true,
        providerSettings,
        deliveryMethod: "async",
        frameStartUrl: frameStartUrl || undefined,
        frameEndUrl: supportsLastFrame ? frameEndUrl || undefined : undefined,
        // ✅ Motion Transfer parameters (Kling 2.6 Pro)
        ...(supportsMotionTransfer && referenceVideoUrl ? {
          referenceVideoUrl,
          characterOrientation,
          keepOriginalSound,
        } : {}),
      };

      if (outputFormat === "mov") {
        toast({ title: "Formato ajustado", description: "MOV não é suportado pelo provedor. Usando MP4 automaticamente." });
      }

      const { data, error } = await supabase.functions.invoke("runware-video", { body: payload });
      
      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Erro ao chamar função de vídeo");
      }
      
      if (data?.error) {
        console.error("API error:", data.error, data.details);
        throw new Error(data.error + (data.details ? `: ${data.details}` : ""));
      }
      
      if (!data?.taskUUID) {
        console.error("No taskUUID in response:", data);
        throw new Error("Resposta inválida do servidor - taskUUID não encontrado");
      }

      setTaskUUID(data.taskUUID);
      toast({ title: "Geração iniciada", description: "Estamos processando seu vídeo. Isso pode levar alguns minutos." });
      beginPolling(data.taskUUID);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Não foi possível iniciar a geração", variant: "destructive" });
      setIsSubmitting(false);
    }
  }, [
    savedVideos,
    prompt,
    modelId,
    toast,
    beginPolling,
    cameraFixed,
    outputFormat,
    res.h,
    res.w,
    supportsLastFrame,
    supportsMotionTransfer,
    duration,
    frameEndUrl,
    frameStartUrl,
    referenceVideoUrl,
    characterOrientation,
    keepOriginalSound,
  ]);

  const handleDownload = useCallback(
    async (url: string) => {
      try {
        const res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (!res.ok) throw new Error("Falha ao baixar o vídeo");
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `synergy-video-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        toast({
          title: "Não foi possível baixar automaticamente",
          description: "Abrindo em nova aba. Use 'Salvar como...' para baixar.",
        });
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [toast]
  );

  const handleShare = useCallback(
    async (url: string, promptText: string) => {
      const title = "Vídeo Gerado por IA";
      const text = (promptText || "Veja este vídeo que criei!").slice(0, 280);
      try {
        if (navigator.share) {
          await navigator.share({ title, text, url });
          return;
        }
        // Compartilhamento com arquivo (suportado em alguns navegadores)
        const res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (res.ok) {
          const blob = await res.blob();
          const extGuess = (blob.type?.split("/")?.[1] || "").split(";")[0] || (outputFormat || "mp4");
          const file = new File([blob], `synergy-video-${Date.now()}.${extGuess}`, {
            type: blob.type || `video/${outputFormat || "mp4"}`,
          });
          const canShareFiles = (navigator as any).canShare?.({ files: [file] });
          if (canShareFiles && (navigator as any).share) {
            await (navigator as any).share({ title, text, files: [file] });
            return;
          }
        }
      } catch {
        // fallback ao modal abaixo
      }
      setShareData({ url, title, text });
      setShareOpen(true);
    },
    [outputFormat]
  );

  const isProcessing = isSubmitting || taskUUID !== null;

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 pt-1 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard-novo")}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <Link to="/home2" className="flex items-center gap-2">
              <VideoIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Vídeo</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Suspense fallback={<div className="h-6 w-6 rounded-full bg-muted" />}>
              <UserProfileLazy />
            </Suspense>
            <Suspense fallback={<div className="h-6 w-10 rounded bg-muted" />}>
              <ThemeToggleLazy />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Painel de controle */}
          <Card className="order-2 lg:col-span-1 lg:row-span-2" style={{ contentVisibility: "auto" as any, containIntrinsicSize: "900px" }}>
            <CardContent className="space-y-6 pt-6">
              <div>
                <Label>Modelo de Vídeo</Label>
                <Select value={modelId} onValueChange={setModelId} disabled={isProcessing}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Somente ByteDance visível */}
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label} — <code className="text-xs">{m.id}</code>
                      </SelectItem>
                    ))}
                    {/*
                    // Mantidos apenas em comentário por enquanto:
                    <SelectItem value="google:3@1">Google Veo 3 Fast — <code className="text-xs">google:3@1</code></SelectItem>
                    <SelectItem value="klingai:5@3">KlingAI 2.1 Master — <code className="text-xs">klingai:5@3</code></SelectItem>
                    */}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prompt">Descrição (prompt)</Label>
                <Textarea
                  id="prompt"
                  placeholder="Descreva a cena, movimentos de câmera, estilo..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Resolução</Label>
                  <Select value={res?.id} onValueChange={setResolution} disabled={isProcessing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a resolução" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedResolutions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duração</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))} disabled={isProcessing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Duração (s)" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedDurations.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} segundos
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Formato</Label>
                  <Select value={outputFormat} onValueChange={setOutputFormat} disabled={isProcessing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o formato" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Opções específicas por modelo */}
                {modelId.startsWith("bytedance") && (
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      id="camera-fixed"
                      checked={cameraFixed}
                      onCheckedChange={setCameraFixed}
                      disabled={isProcessing}
                    />
                    <Label htmlFor="camera-fixed">Camera Fixed (ByteDance)</Label>
                  </div>
                )}

                {/* Veo comentado
                {modelId.startsWith("google") && (
                  <div className="flex items-center gap-2 pt-2">
                    <Switch id="veo-audio" checked={generateAudio} onCheckedChange={setGenerateAudio} disabled={isProcessing} />
                    <Label htmlFor="veo-audio">Incluir áudio (Veo 3)</Label>
                  </div>
                )} */}
              </div>

              {/* Frames de referência */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <Label className="mb-2">Frame Inicial (opcional)</Label>
                  <label
                    htmlFor="start-upload"
                    className={`border border-border rounded-md p-4 text-center ${
                      !isProcessing ? "cursor-pointer hover:bg-accent" : "opacity-60 cursor-not-allowed"
                    } flex flex-col items-center justify-center h-28 transition-colors ${
                      isDragOverStart ? "bg-accent border-primary border-dashed" : ""
                    }`}
                    onDragEnter={(e) => !isProcessing && handleDragEnter(e, true)}
                    onDragLeave={(e) => !isProcessing && handleDragLeave(e, true)}
                    onDragOver={(e) => !isProcessing && handleDragOver(e)}
                    onDrop={(e) => !isProcessing && handleDrop(e, true)}
                  >
                    <Suspense fallback={<div className="h-6 w-6 rounded bg-muted mb-1" />}>
                      <UploadIcon className="h-6 w-6 mb-1 text-muted-foreground" />
                    </Suspense>
                    <span className="text-sm">{isDragOverStart ? "Solte a imagem aqui" : "Carregar ou Arrastar Imagem"}</span>
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="start-upload"
                    onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], true)}
                    disabled={isProcessing}
                  />
                  <Input
                    placeholder="Ou cole a URL aqui"
                    value={frameStartUrl}
                    onChange={(e) => setFrameStartUrl(e.target.value)}
                    className="mt-2"
                    disabled={isProcessing}
                  />
                  {uploadingStart && <p className="text-sm text-muted-foreground mt-1">Comprimindo e enviando...</p>}
                  {frameStartUrl && (
                    <div className="mt-2 inline-block relative">
                      <img
                        src={frameStartUrl}
                        alt="Prévia do frame inicial"
                        className="w-16 h-16 rounded border border-border object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background/80 hover:bg-accent"
                        onClick={() => setFrameStartUrl("")}
                        aria-label="Remover frame inicial"
                        disabled={isProcessing}
                      >
                        <Suspense fallback={<div className="h-4 w-4 rounded bg-muted" />}>
                          <XIcon className="h-4 w-4" />
                        </Suspense>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Frame Final (opcional)</Label>
                    {!supportsLastFrame && (
                      <span className="text-xs text-muted-foreground">Não suportado pelo modelo selecionado</span>
                    )}
                  </div>
                  <label
                    htmlFor="end-upload"
                    className={`border border-border rounded-md p-4 text-center ${
                      supportsLastFrame && !isProcessing ? "cursor-pointer hover:bg-accent" : "opacity-60 cursor-not-allowed"
                    } flex flex-col items-center justify-center h-28 transition-colors ${
                      isDragOverEnd ? "bg-accent border-primary border-dashed" : ""
                    }`}
                    onDragEnter={(e) => supportsLastFrame && !isProcessing && handleDragEnter(e, false)}
                    onDragLeave={(e) => supportsLastFrame && !isProcessing && handleDragLeave(e, false)}
                    onDragOver={(e) => supportsLastFrame && !isProcessing && handleDragOver(e)}
                    onDrop={(e) => supportsLastFrame && !isProcessing && handleDrop(e, false)}
                  >
                    <Suspense fallback={<div className="h-6 w-6 rounded bg-muted mb-1" />}>
                      <UploadIcon className="h-6 w-6 mb-1 text-muted-foreground" />
                    </Suspense>
                    <span className="text-sm">{isDragOverEnd ? "Solte a imagem aqui" : "Carregar ou Arrastar Imagem"}</span>
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="end-upload"
                    disabled={!supportsLastFrame || isProcessing}
                    onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], false)}
                  />
                  <Input
                    placeholder="Ou cole a URL aqui"
                    value={frameEndUrl}
                    onChange={(e) => setFrameEndUrl(e.target.value)}
                    className="mt-2"
                    disabled={!supportsLastFrame || isProcessing}
                  />
                  {uploadingEnd && <p className="text-sm text-muted-foreground mt-1">Comprimindo e enviando...</p>}
                  {supportsLastFrame && frameEndUrl && (
                    <div className="mt-2 inline-block relative">
                      <img
                        src={frameEndUrl}
                        alt="Prévia do frame final"
                        className="w-16 h-16 rounded border border-border object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background/80 hover:bg-accent"
                        onClick={() => setFrameEndUrl("")}
                        aria-label="Remover frame final"
                        disabled={isProcessing}
                      >
                        <Suspense fallback={<div className="h-4 w-4 rounded bg-muted" />}>
                          <XIcon className="h-4 w-4" />
                        </Suspense>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ Motion Transfer (Kling 2.6 Pro) */}
              {supportsMotionTransfer && (
                <div className="space-y-4 p-4 border border-primary/20 rounded-lg bg-primary/5">
                  <div className="flex items-center gap-2">
                    <VideoIcon className="h-5 w-5 text-primary" />
                    <Label className="text-base font-semibold">Motion Transfer</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Faça upload de um vídeo de movimentos e aplique esses movimentos na imagem do personagem (Frame Inicial).
                  </p>
                  
                  {/* Upload de vídeo de referência */}
                  <div className="flex flex-col">
                    <Label className="mb-2">Vídeo de Referência (movimentos)</Label>
                    <label
                      htmlFor="video-upload"
                      className={`border border-border rounded-md p-4 text-center ${
                        !isProcessing ? "cursor-pointer hover:bg-accent" : "opacity-60 cursor-not-allowed"
                      } flex flex-col items-center justify-center h-28 transition-colors ${
                        isDragOverVideo ? "bg-accent border-primary border-dashed" : ""
                      }`}
                      onDragEnter={(e) => {
                        if (!isProcessing) {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragOverVideo(true);
                        }
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const { clientX: x, clientY: y } = e;
                        if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
                          setIsDragOverVideo(false);
                        }
                      }}
                      onDragOver={(e) => {
                        if (!isProcessing) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      onDrop={(e) => {
                        if (!isProcessing) {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragOverVideo(false);
                          const files = Array.from(e.dataTransfer.files);
                          const videoFile = files.find((f) => f.type.startsWith("video/"));
                          if (videoFile) uploadReferenceVideo(videoFile);
                          else toast({ title: "Tipo de arquivo inválido", description: "Por favor, arraste apenas arquivos de vídeo.", variant: "destructive" });
                        }
                      }}
                    >
                      <Suspense fallback={<div className="h-6 w-6 rounded bg-muted mb-1" />}>
                        <UploadIcon className="h-6 w-6 mb-1 text-muted-foreground" />
                      </Suspense>
                      <span className="text-sm">{isDragOverVideo ? "Solte o vídeo aqui" : "Carregar ou Arrastar Vídeo (MP4, WebM)"}</span>
                    </label>
                    <Input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      id="video-upload"
                      onChange={(e) => e.target.files?.[0] && uploadReferenceVideo(e.target.files[0])}
                      disabled={isProcessing}
                    />
                    <Input
                      placeholder="Ou cole a URL do vídeo aqui"
                      value={referenceVideoUrl}
                      onChange={(e) => setReferenceVideoUrl(e.target.value)}
                      className="mt-2"
                      disabled={isProcessing}
                    />
                    {uploadingVideo && <p className="text-sm text-muted-foreground mt-1">Enviando vídeo...</p>}
                    {referenceVideoUrl && (
                      <div className="mt-2 inline-block relative">
                        <video
                          src={referenceVideoUrl}
                          className="w-24 h-16 rounded border border-border object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background/80 hover:bg-accent"
                          onClick={() => setReferenceVideoUrl("")}
                          aria-label="Remover vídeo de referência"
                          disabled={isProcessing}
                        >
                          <Suspense fallback={<div className="h-4 w-4 rounded bg-muted" />}>
                            <XIcon className="h-4 w-4" />
                          </Suspense>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Opções de Motion Transfer */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2">Orientação do Personagem</Label>
                      <Select 
                        value={characterOrientation} 
                        onValueChange={(v) => setCharacterOrientation(v as "imageOrientation" | "videoOrientation")}
                        disabled={isProcessing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a orientação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="imageOrientation">Usar orientação da imagem</SelectItem>
                          <SelectItem value="videoOrientation">Usar orientação do vídeo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        id="keep-sound"
                        checked={keepOriginalSound}
                        onCheckedChange={setKeepOriginalSound}
                        disabled={isProcessing}
                      />
                      <Label htmlFor="keep-sound">Manter áudio original do vídeo</Label>
                    </div>
                  </div>

                  {referenceVideoUrl && !frameStartUrl && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      ⚠️ Para usar Motion Transfer, você também precisa enviar uma imagem do personagem no "Frame Inicial" acima.
                    </p>
                  )}
                </div>
              )}

              <Button className="w-full" onClick={() => debounce(startGeneration)} disabled={isProcessing || isDebouncing || !prompt}>
                {isProcessing ? (
                  <span className="inline-flex items-center">
                    <span className="mr-2 inline-grid place-items-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                    </span>
                    Gerando...
                  </span>
                ) : (
                  "Gerar Vídeo"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Player / Resultado */}
          <Card className="order-1 lg:col-span-2">
            <CardContent className="pt-6">
              {videoUrl ? (
                <div className="space-y-4">
                  <video
                    controls
                    autoPlay
                    muted
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    className="w-full rounded-md border border-border aspect-video"
                    src={videoUrl}
                    key={videoUrl}
                    onError={(e) => {
                      // fallback simples
                      const video = e.currentTarget;
                      if (video.crossOrigin) {
                        (video as any).crossOrigin = null;
                        video.load();
                      }
                    }}
                  />
                  <div className="flex gap-3 flex-wrap">
                    <Button onClick={() => handleDownload(videoUrl)}>
                      <Suspense fallback={<div className="h-4 w-4 rounded bg-muted mr-2" />}>
                        <DownloadIcon className="h-4 w-4 mr-2" />
                      </Suspense>
                      Baixar
                    </Button>
                    <Button variant="outline" onClick={() => handleShare(videoUrl, prompt)}>
                      <Suspense fallback={<div className="h-4 w-4 rounded bg-muted mr-2" />}>
                        <Share2Icon className="h-4 w-4 mr-2" />
                      </Suspense>
                      Compartilhar
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={videoUrl} target="_blank" rel="noreferrer">
                        <Suspense fallback={<div className="h-4 w-4 rounded bg-muted mr-2" />}>
                          <Link2Icon className="h-4 w-4 mr-2" />
                        </Suspense>
                        Abrir em nova aba
                      </a>
                    </Button>
                  </div>
                </div>
              ) : taskUUID ? (
                <div className="aspect-video w-full grid place-items-center text-center text-muted-foreground bg-muted/30 rounded-md">
                  <div>
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-2"></div>
                    <p>Processando seu vídeo...</p>
                    <p className="text-sm mt-1">Isso pode levar alguns minutos</p>
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full grid place-items-center text-center text-muted-foreground bg-muted/30 rounded-md">
                  <div>
                    <VideoIcon className="h-10 w-10 mx-auto mb-2" />
                    <p>Seu vídeo aparecerá aqui.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico (com mini-virtualização via content-visibility + lazy thumbs) */}
          <div className="order-3 lg:col-span-2" style={{ contentVisibility: "auto" as any, containIntrinsicSize: "500px" }}>
            <h2 className="text-xl font-bold mb-4">Vídeos Salvos</h2>
            {loadingVideos ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Carregando vídeos...</p>
              </div>
            ) : savedVideos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {savedVideos.map((video) => (
                  <SavedVideo key={video.id} video={video} onDelete={deleteVideo} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum vídeo salvo no histórico.</p>
            )}
          </div>
        </div>

        {/* Modal de Compartilhamento (lazy) */}
        <Suspense
          fallback={
            shareOpen ? (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : null
          }
        >
          <DialogLazy open={shareOpen} onOpenChange={setShareOpen}>
            <DialogContentLazy className="max-w-lg">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Compartilhar</h3>
                <p className="text-sm text-muted-foreground">Escolha uma opção para compartilhar seu vídeo.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.text + " " + shareData.url)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                    href={`https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Telegram
                  </a>
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Facebook
                  </a>
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    X
                  </a>
                  <Button
                    variant="outline"
                    className="text-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(shareData.url);
                      toast({ title: "Link copiado", description: "O link foi copiado para a área de transferência." });
                    }}
                  >
                    Copiar Link
                  </Button>
                </div>
              </div>
            </DialogContentLazy>
          </DialogLazy>
        </Suspense>
      </main>
    </div>
  );
};

export default VideoPage;
