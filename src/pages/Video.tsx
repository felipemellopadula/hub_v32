import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Link2, Share2, VideoIcon, RotateCcw, Upload, Play, Pause, Maximize, X, ArrowLeft, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfile } from "@/components/UserProfile";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Modelos suportados e suas capacidades (conforme docs Runware).
 * ATENÇÃO: 'klingai:5@3' é "KlingAI 2.1 Master" nos docs oficiais (algumas fontes chamam de 2.0 Master).
 */
type Resolution = { id: string; label: string; w: number; h: number };

const MODELS = [
  { id: "bytedance:1@1", label: "ByteDance Seedance 1.0 Lite", provider: "bytedance" as const },
  { id: "google:3@1", label: "Googke Veo 3 Fast", provider: "google" as const },
  { id: "klingai:5@3", label: "KlingAI 2.1 Master", provider: "klingai" as const }, // Código solicitado pelo cliente
];

const RESOLUTIONS_BY_MODEL: Record<string, Resolution[]> = {
  // ByteDance Seedance Lite (várias opções 16:9 do provedor)
  "bytedance:1@1": [
    { id: "16:9-480p", label: "16:9 (Wide / Landscape) - 480p (864×480)", w: 864, h: 480 },
    { id: "16:9-704p", label: "16:9 (Wide / Landscape) - 1248×704", w: 1248, h: 704 },
  ],
  // Veo 3 Fast requer 1280×720
  "google:3@1": [
    { id: "16:9-720p", label: "16:9 (Wide / Landscape) - 720p (1280×720)", w: 1280, h: 720 },
  ],
  // KlingAI 2.1 Master suporta 1080p
  "klingai:5@3": [
    { id: "16:9-1080p", label: "16:9 (Wide / Landscape) - 1080p (1920×1080)", w: 1920, h: 1080 },
  ],
};

const DURATIONS_BY_MODEL: Record<string, number[]> = {
  "bytedance:1@1": [5, 10],
  "google:3@1": [8], // fixo a 8s
  "klingai:5@3": [5, 10],
};

// suporte a frame final (last) por modelo
const SUPPORTS_LAST_FRAME: Record<string, boolean> = {
  "bytedance:1@1": true,
  "google:3@1": false, // Veo 3 só primeiro frame
  "klingai:5@3": false, // Kling Master: só primeiro frame
};

// áudio nativo disponível apenas no Veo 3
const SUPPORTS_AUDIO: Record<string, boolean> = {
  "bytedance:1@1": false,
  "google:3@1": true,
  "klingai:5@3": false,
};

const FORMATS = ["mp4", "webm", "mov"]; // mov será normalizado p/ mp4 ao enviar

const MAX_VIDEOS = 12;

/** Checagem/Limpeza de localStorage (mantida do seu código) */
const ensureLocalStorageSpace = () => {
  try {
    const testKey = "localStorage_test_key";
    const testData = "test";
    localStorage.setItem(testKey, testData);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    try {
      const stored = localStorage.getItem("savedVideos");
      if (stored) {
        const savedVideos = JSON.parse(stored);
        const reducedVideos = savedVideos.slice(0, 6);
        localStorage.setItem("savedVideos", JSON.stringify(reducedVideos));

        const keysToCheck: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key !== "savedVideos" && (key.startsWith("video_") || key.startsWith("temp_"))) {
            keysToCheck.push(key);
          }
        }
        keysToCheck.forEach((key) => {
          try {
            localStorage.removeItem(key);
          } catch {}
        });

        return true;
      }
    } catch {
      try {
        localStorage.removeItem("savedVideos");
      } catch {}
    }
    return false;
  }
};

const SavedVideo = ({ url, onDelete }: { url: string; onDelete: (url: string) => void }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "synergy-video.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const goFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir este vídeo?")) {
      onDelete(url);
    }
  };

  return (
    <div className="relative aspect-video border border-border rounded-md overflow-hidden group cursor-pointer">
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        loop
        muted
        playsInline
        onClick={togglePlay}
      />
      {/* Botão de excluir no canto superior direito */}
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {/* Controles de reprodução no centro */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="bg-background/50" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="bg-background/50" onClick={goFullscreen}>
            <Maximize className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="bg-background/50" onClick={handleDownload}>
            <Download className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const VideoPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // NOVO: seleção de modelo
  const [modelId, setModelId] = useState<string>("bytedance:1@1");

  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<string>("16:9-480p");
  const [duration, setDuration] = useState<number>(5);
  const [outputFormat, setOutputFormat] = useState<string>("mp4");

  // ByteDance only
  const [cameraFixed, setCameraFixed] = useState<boolean>(false);
  // Veo 3 only
  const [generateAudio, setGenerateAudio] = useState<boolean>(false);

  const [frameStartUrl, setFrameStartUrl] = useState("");
  const [frameEndUrl, setFrameEndUrl] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskUUID, setTaskUUID] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);
  const [savedVideos, setSavedVideos] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; title: string; text: string }>({ url: "", title: "", text: "" });
  const [isDragOverStart, setIsDragOverStart] = useState(false);
  const [isDragOverEnd, setIsDragOverEnd] = useState(false);

  // Listas dinâmicas conforme modelo
  const allowedResolutions = useMemo<Resolution[]>(() => RESOLUTIONS_BY_MODEL[modelId] || [], [modelId]);
  const allowedDurations = useMemo<number[]>(() => DURATIONS_BY_MODEL[modelId] || [5], [modelId]);
  const supportsLastFrame = SUPPORTS_LAST_FRAME[modelId];
  const supportsAudio = SUPPORTS_AUDIO[modelId];

  // Resolve objeto da resolução atual (com fallback ao primeiro válido)
  const res = useMemo<Resolution>(() => {
    const found = allowedResolutions.find((r) => r.id === resolution);
    return found || allowedResolutions[0];
  }, [allowedResolutions, resolution]);

  useEffect(() => {
    const stored = localStorage.getItem("savedVideos");
    if (stored) setSavedVideos(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (videoUrl) {
      setSavedVideos((prev) => {
        const newVideos = [videoUrl, ...prev.filter((v) => v !== videoUrl)].slice(0, MAX_VIDEOS);
        ensureLocalStorageSpace();
        try {
          localStorage.setItem("savedVideos", JSON.stringify(newVideos));
        } catch {
          ensureLocalStorageSpace();
          try {
            const reducedVideos = newVideos.slice(0, 4);
            localStorage.setItem("savedVideos", JSON.stringify(reducedVideos));
            return reducedVideos;
          } catch {
            return [videoUrl];
          }
        }
        return newVideos;
      });
    }
  }, [videoUrl]);

  useEffect(() => {
    document.title = "Gerar Vídeo com IA | Synergy AI";
    const desc = "Crie vídeos com ByteDance, Veo 3 Fast e KlingAI Master. Escolha resolução, duração e referências.";
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

  // Quando mudar o modelo, garantimos que resolução/duração atuais são válidas.
  useEffect(() => {
    const resList = RESOLUTIONS_BY_MODEL[modelId];
    if (resList && !resList.some((r) => r.id === resolution)) {
      setResolution(resList[0].id);
    }
    const durList = DURATIONS_BY_MODEL[modelId];
    if (durList && !durList.includes(duration)) {
      setDuration(durList[0]);
    }
    // Se o modelo não suportar frame final, limpamos a URL final (opcional)
    if (!SUPPORTS_LAST_FRAME[modelId] && frameEndUrl) {
      setFrameEndUrl("");
    }
    // Veo 3: áudio default false (ajuste aqui se quiser default true)
    if (!SUPPORTS_AUDIO[modelId] && generateAudio) {
      setGenerateAudio(false);
    }
  }, [modelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadImage = async (file: File, isStart: boolean) => {
    const setter = isStart ? setUploadingStart : setUploadingEnd;
    const urlSetter = isStart ? setFrameStartUrl : setFrameEndUrl;
    setter(true);

    try {
      // Import cleanup functions
      const { prepareStorageForUpload } = await import("@/utils/imageStore");
      
      // Proactive cleanup before upload
      await prepareStorageForUpload();
      ensureLocalStorageSpace();

      const { data, error } = await supabase.storage.from("images").upload(`${Date.now()}-${file.name}`, file);
      if (error) throw error;
      const { data: publicData } = supabase.storage.from("images").getPublicUrl(data.path);
      urlSetter(publicData.publicUrl);
    } catch (e: any) {
      console.error('Upload error:', e);
      
      // If upload fails due to storage issues, try cleanup and retry once
      if (e.message?.includes('storage') || e.message?.includes('quota') || e.message?.includes('space')) {
        try {
          const { prepareStorageForUpload } = await import("@/utils/imageStore");
          await prepareStorageForUpload();
          ensureLocalStorageSpace();
          
          // Retry upload after cleanup
          const { data, error } = await supabase.storage.from("images").upload(`${Date.now()}-retry-${file.name}`, file);
          if (error) throw error;
          const { data: publicData } = supabase.storage.from("images").getPublicUrl(data.path);
          urlSetter(publicData.publicUrl);
          
          toast({ title: "Upload realizado", description: "Imagem carregada após limpeza automática." });
          return;
        } catch (retryError) {
          console.error('Retry upload failed:', retryError);
        }
      }
      
      toast({ 
        title: "Erro no upload", 
        description: "Tente novamente. Se persistir, limpe o cache do navegador.", 
        variant: "destructive" 
      });
    } finally {
      setter(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent, isStart: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (isStart) setIsDragOverStart(true);
    else setIsDragOverEnd(true);
  };

  const handleDragLeave = (e: React.DragEvent, isStart: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      if (isStart) setIsDragOverStart(false);
      else setIsDragOverEnd(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, isStart: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    if (isStart) setIsDragOverStart(false);
    else setIsDragOverEnd(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((file) => file.type.startsWith("image/"));

    if (imageFile) {
      uploadImage(imageFile, isStart);
    } else {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, arraste apenas arquivos de imagem.",
        variant: "destructive",
      });
    }
  };

  const startGeneration = async () => {
    setIsSubmitting(true);
    setVideoUrl(null);
    setTaskUUID(null);

    // Normalização do formato (MOV => MP4 para evitar erro nos provedores)
    const normalizedFormat = outputFormat === "mov" ? "mp4" : outputFormat;

    // providerSettings corretos por modelo
    const providerSettings: Record<string, any> = {};
    if (modelId.startsWith("bytedance")) {
      providerSettings.bytedance = { cameraFixed };
    } else if (modelId.startsWith("google")) {
      providerSettings.google = { generateAudio };
    }

    try {
      const payload: any = {
        action: "start",
        modelId, // seu Edge Function usa 'modelId' (mantido)
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
        // apenas modelos que suportam frame final (ByteDance)
        frameEndUrl: supportsLastFrame ? (frameEndUrl || undefined) : undefined,
      };

      // Aviso gentil sobre MOV convertido
      if (outputFormat === "mov") {
        toast({
          title: "Formato ajustado",
          description: "MOV não é suportado pelo provedor. Usando MP4 automaticamente.",
        });
      }

      const { data, error } = await supabase.functions.invoke("runware-video", { body: payload });
      if (error) throw error;
      if (!data?.taskUUID) throw new Error(data?.error || "Falha ao iniciar geração");
      setTaskUUID(data.taskUUID);
      toast({
        title: "Geração iniciada",
        description: "Estamos processando seu vídeo. Isso pode levar alguns minutos.",
      });
      beginPolling(data.taskUUID);
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível iniciar a geração",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginPolling = (uuid: string) => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    const poll = async (attempt = 0) => {
      try {
        const { data, error } = await supabase.functions.invoke("runware-video", {
          body: { action: "status", taskUUID: uuid },
        });
        if (error) throw error;
        const statusItem = data?.result;
        const videoURL = statusItem?.videoURL || statusItem?.url;
        if (videoURL) {
          setVideoUrl(videoURL);
          toast({ title: "Vídeo pronto", description: "Seu vídeo foi gerado com sucesso." });
          return;
        }
        const delay = Math.min(2000 * Math.pow(1.4, attempt), 12000);
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      } catch {
        const delay = 5000;
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      }
    };
    pollRef.current = window.setTimeout(() => poll(0), 2000) as unknown as number;
  };

  useEffect(
    () => () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    },
    []
  );

  const handleDownload = async (url: string) => {
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
        description: "Abrindo em nova aba. Use “Salvar como...” para baixar.",
      });
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleShare = async (url: string, promptText: string) => {
    const title = "Vídeo Gerado por IA";
    const text = (promptText || "Veja este vídeo que criei!").slice(0, 280);

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }

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
      // fallback
    }

    setShareData({ url, title, text });
    setShareOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 pt-1 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="flex items-center gap-2 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <VideoIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Vídeo</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <UserProfile />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Painel de controles */}
          <Card className="order-2 lg:col-span-1 lg:row-span-2">
            <CardContent className="space-y-6 pt-6">
              {/* NOVO: Seletor de Modelo */}
              <div>
                <Label>Modelo de Vídeo</Label>
                <Select value={modelId} onValueChange={(v) => setModelId(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label} — <code className="text-xs">{m.id}</code>
                      </SelectItem>
                    ))}
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
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Resolução</Label>
                  <Select value={res?.id} onValueChange={setResolution}>
                    <SelectTrigger><SelectValue placeholder="Selecione a resolução" /></SelectTrigger>
                    <SelectContent>
                      {allowedResolutions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duração</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Duração (s)" /></SelectTrigger>
                    <SelectContent>
                      {allowedDurations.map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} segundos</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Formato</Label>
                  <Select value={outputFormat} onValueChange={setOutputFormat}>
                    <SelectTrigger><SelectValue placeholder="Selecione o formato" /></SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Controles específicos por provedor */}
                {modelId.startsWith("bytedance") && (
                  <div className="flex items-center gap-2 pt-2">
                    <Switch id="camera-fixed" checked={cameraFixed} onCheckedChange={setCameraFixed} />
                    <Label htmlFor="camera-fixed">Camera Fixed (ByteDance)</Label>
                  </div>
                )}

                {modelId.startsWith("google") && (
                  <div className="flex items-center gap-2 pt-2">
                    <Switch id="veo-audio" checked={generateAudio} onCheckedChange={setGenerateAudio} />
                    <Label htmlFor="veo-audio">Incluir áudio (Veo 3)</Label>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Frame Inicial (opcional)</Label>
                  <label
                    htmlFor="start-upload"
                    className={`border border-border rounded-md p-4 text-center cursor-pointer hover:bg-accent flex flex-col items-center justify-center h-28 transition-colors ${isDragOverStart ? "bg-accent border-primary border-dashed" : ""}`}
                    onDragEnter={(e) => handleDragEnter(e, true)}
                    onDragLeave={(e) => handleDragLeave(e, true)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, true)}
                  >
                    <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                    <span className="text-sm">{isDragOverStart ? "Solte a imagem aqui" : "Carregar ou Arrastar Imagem"}</span>
                  </label>
                  <Input type="file" accept="image/*" className="hidden" id="start-upload" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], true)} />
                  <Input placeholder="Ou cole a URL aqui" value={frameStartUrl} onChange={(e) => setFrameStartUrl(e.target.value)} className="mt-2" />
                  {uploadingStart && <p className="text-sm text-muted-foreground mt-1">Enviando...</p>}
                  {frameStartUrl && (
                    <div className="mt-2 inline-block relative">
                      <img
                        src={frameStartUrl}
                        alt="Prévia do frame inicial"
                        className="w-16 h-16 rounded border border-border object-cover"
                        loading="lazy"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background/80 hover:bg-accent"
                        onClick={() => setFrameStartUrl("")}
                        aria-label="Remover frame inicial"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label>Frame Final (opcional)</Label>
                    {!supportsLastFrame && (
                      <span className="text-xs text-muted-foreground">Não suportado pelo modelo selecionado</span>
                    )}
                  </div>
                  <label
                    htmlFor="end-upload"
                    className={`border border-border rounded-md p-4 text-center ${supportsLastFrame ? "cursor-pointer hover:bg-accent" : "opacity-60 cursor-not-allowed"} flex flex-col items-center justify-center h-28 transition-colors ${isDragOverEnd ? "bg-accent border-primary border-dashed" : ""}`}
                    onDragEnter={(e) => supportsLastFrame && handleDragEnter(e, false)}
                    onDragLeave={(e) => supportsLastFrame && handleDragLeave(e, false)}
                    onDragOver={(e) => supportsLastFrame && handleDragOver(e)}
                    onDrop={(e) => supportsLastFrame && handleDrop(e, false)}
                  >
                    <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                    <span className="text-sm">{isDragOverEnd ? "Solte a imagem aqui" : "Carregar ou Arrastar Imagem"}</span>
                  </label>
                  <Input type="file" accept="image/*" className="hidden" id="end-upload" disabled={!supportsLastFrame} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], false)} />
                  <Input placeholder="Ou cole a URL aqui" value={frameEndUrl} onChange={(e) => setFrameEndUrl(e.target.value)} className="mt-2" disabled={!supportsLastFrame} />
                  {uploadingEnd && <p className="text-sm text-muted-foreground mt-1">Enviando...</p>}
                  {supportsLastFrame && frameEndUrl && (
                    <div className="mt-2 inline-block relative">
                      <img
                        src={frameEndUrl}
                        alt="Prévia do frame final"
                        className="w-16 h-16 rounded border border-border object-cover"
                        loading="lazy"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background/80 hover:bg-accent"
                        onClick={() => setFrameEndUrl("")}
                        aria-label="Remover frame final"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Button className="w-full" onClick={startGeneration} disabled={isSubmitting || !prompt}>
                {isSubmitting ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : null}
                Gerar Vídeo
              </Button>
            </CardContent>
          </Card>

          {/* Player / Output */}
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
                      console.log('Video error:', e);
                      // Fallback: reload without crossOrigin if it fails
                      const video = e.currentTarget;
                      if (video.crossOrigin) {
                        video.crossOrigin = null;
                        video.load();
                      }
                    }}
                  />
                  <div className="flex gap-3 flex-wrap">
                    <Button onClick={() => handleDownload(videoUrl)}><Download className="h-4 w-4 mr-2" /> Baixar</Button>
                    <Button variant="outline" onClick={() => handleShare(videoUrl, prompt)}><Share2 className="h-4 w-4 mr-2" /> Compartilhar</Button>
                    <Button variant="outline" asChild>
                      <a href={videoUrl} target="_blank" rel="noreferrer">
                        <Link2 className="h-4 w-4 mr-2" /> Abrir em nova aba
                      </a>
                    </Button>
                  </div>
                </div>
              ) : taskUUID ? (
                <div className="aspect-video w-full grid place-items-center text-center text-muted-foreground bg-muted/30 rounded-md">
                  <div>
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-2"></div>
                    <p>Processando seu vídeo...</p>
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

          {/* Histórico */}
          <div className="order-3 lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">Vídeos Salvos</h2>
            {savedVideos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {savedVideos.map((url, index) => (
                  <SavedVideo 
                    key={index} 
                    url={url} 
                    onDelete={(urlToDelete) => {
                      const updatedVideos = savedVideos.filter(v => v !== urlToDelete);
                      setSavedVideos(updatedVideos);
                      localStorage.setItem("savedVideos", JSON.stringify(updatedVideos));
                      toast({
                        title: "Vídeo excluído",
                        description: "O vídeo foi removido do histórico.",
                      });
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum vídeo salvo no histórico.</p>
            )}
          </div>
        </div>

        {/* Modal de Compartilhamento */}
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="max-w-lg">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Compartilhar</h3>
              <p className="text-sm text-muted-foreground">Escolha uma opção para compartilhar seu vídeo.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.text + " " + shareData.url)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`} target="_blank" rel="noreferrer">Telegram</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`} target="_blank" rel="noreferrer">Facebook</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`} target="_blank" rel="noreferrer">X</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareData.url)}`} target="_blank" rel="noreferrer">LinkedIn</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.text + "\n" + shareData.url)}`}>Email</a>
                <button
                  className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                  onClick={async () => { await navigator.clipboard.writeText(shareData.url); setShareOpen(false); }}
                >
                  Copiar link
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default VideoPage;
