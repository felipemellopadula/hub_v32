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
import { Download, Link2, Share2, VideoIcon, RotateCcw, Upload, Play, Pause, Maximize, X, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfile } from "@/components/UserProfile";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const RESOLUTIONS = [
  { id: "16:9-480p", label: "16:9 (Wide / Landscape) - 480p", w: 864, h: 480 },
];

const DURATIONS = [5, 10];

const FORMATS = ["mp4", "webm", "mov"];

const MAX_VIDEOS = 12;

const SavedVideo = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'synergy-video.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const goFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen();
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
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<string>("16:9-480p");
  const [duration, setDuration] = useState<number>(5);
  const [outputFormat, setOutputFormat] = useState<string>("mp4");
  const [cameraFixed, setCameraFixed] = useState<boolean>(false);
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

  useEffect(() => {
    const stored = localStorage.getItem('savedVideos');
    if (stored) {
      setSavedVideos(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (videoUrl) {
      setSavedVideos(prev => {
        const newVideos = [videoUrl, ...prev.filter(v => v !== videoUrl)].slice(0, MAX_VIDEOS);
        localStorage.setItem('savedVideos', JSON.stringify(newVideos));
        return newVideos;
      });
    }
  }, [videoUrl]);

  useEffect(() => {
    document.title = "Gerar Vídeo com IA | Synergy AI";
    const desc = "Crie vídeos com Seedance 1.0 Lite. Escolha resolução, duração e referências.";
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

  const res = useMemo(() => RESOLUTIONS.find(r => r.id === resolution)!, [resolution]);
  const modelId = "bytedance:1@1";

  const uploadImage = async (file: File, isStart: boolean) => {
    const setter = isStart ? setUploadingStart : setUploadingEnd;
    const urlSetter = isStart ? setFrameStartUrl : setFrameEndUrl;
    setter(true);
    try {
      const { data, error } = await supabase.storage.from('images').upload(`${Date.now()}-${file.name}`, file);
      if (error) throw error;
      const { data: publicData } = supabase.storage.from('images').getPublicUrl(data.path);
      urlSetter(publicData.publicUrl);
      toast({ title: 'Upload concluído', description: 'Imagem carregada com sucesso.' });
    } catch (e) {
      toast({ title: 'Erro no upload', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setter(false);
    }
  };

  const startGeneration = async () => {
    setIsSubmitting(true);
    setVideoUrl(null);
    setTaskUUID(null);

    try {
      const payload = {
        action: 'start',
        modelId,
        positivePrompt: prompt,
        width: res.w,
        height: res.h,
        duration,
        fps: 24,
        outputFormat,
        numberResults: 1,
        includeCost: true,
        providerSettings: { bytedance: { cameraFixed } },
        deliveryMethod: "async",
        frameStartUrl: frameStartUrl || undefined,
        frameEndUrl: frameEndUrl || undefined,
      };
      const { data, error } = await supabase.functions.invoke('runware-video', { body: payload });
      if (error) throw error;
      if (!data?.taskUUID) throw new Error(data?.error || 'Falha ao iniciar geração');
      setTaskUUID(data.taskUUID);
      toast({ title: 'Geração iniciada', description: 'Estamos processando seu vídeo. Isso pode levar alguns minutos.' });
      beginPolling(data.taskUUID);
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Não foi possível iniciar a geração', variant: 'destructive' });
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
        const { data, error } = await supabase.functions.invoke('runware-video', {
          body: { action: 'status', taskUUID: uuid }
        });
        if (error) throw error;
        const statusItem = data?.result;
        const videoURL = statusItem?.videoURL || statusItem?.url;
        if (videoURL) {
          setVideoUrl(videoURL);
          toast({ title: 'Vídeo pronto', description: 'Seu vídeo foi gerado com sucesso.' });
          return;
        }
        const delay = Math.min(2000 * Math.pow(1.4, attempt), 12000);
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      } catch (e) {
        const delay = 5000;
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      }
    };
    pollRef.current = window.setTimeout(() => poll(0), 2000) as unknown as number;
  };

  useEffect(() => () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
  }, []);

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error('Falha ao baixar o vídeo');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `synergy-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      toast({ title: 'Não foi possível baixar automaticamente', description: 'Abrindo em nova aba. Use “Salvar como...” para baixar.' });
      window.open(url, '_blank', 'noopener,noreferrer');
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

      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        const blob = await res.blob();
        const extGuess = (blob.type?.split('/')?.[1] || '').split(';')[0] || (outputFormat || 'mp4');
        const file = new File([blob], `synergy-video-${Date.now()}.${extGuess}`, { type: blob.type || `video/${outputFormat || 'mp4'}` });
        const canShareFiles = (navigator as any).canShare?.({ files: [file] });
        if (canShareFiles && (navigator as any).share) {
          await (navigator as any).share({ title, text, files: [file] });
          return;
        }
      }
    } catch (e) {
      // segue para fallback
    }

    // Fallback: abre modal de opções de compartilhamento na própria página
    setShareData({ url, title, text });
    setShareOpen(true);
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:bg-muted">
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
          
          <Card className="order-2 lg:col-span-1 lg:row-span-2">
            <CardContent className="space-y-6 pt-6">
              <div>
                <Label htmlFor="prompt">Descrição (prompt)</Label>
                <Textarea id="prompt" placeholder="Descreva a cena, movimentos de câmera, estilo..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Resolução</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger><SelectValue placeholder="Selecione a resolução" /></SelectTrigger>
                    <SelectContent>
                      {RESOLUTIONS.map(r => (
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
                      {DURATIONS.map(d => (
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
                      {FORMATS.map(f => (
                        <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Switch id="camera-fixed" checked={cameraFixed} onCheckedChange={setCameraFixed} />
                  <Label htmlFor="camera-fixed">Camera Fixed</Label>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Frame Inicial (opcional)</Label>
                  <label htmlFor="start-upload" className="border border-border rounded-md p-4 text-center cursor-pointer hover:bg-accent flex flex-col items-center justify-center h-28">
                    <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                    <span className="text-sm">Carregar Imagem</span>
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
                  <Label>Frame Final (opcional)</Label>
                  <label htmlFor="end-upload" className="border border-border rounded-md p-4 text-center cursor-pointer hover:bg-accent flex flex-col items-center justify-center h-28">
                    <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                    <span className="text-sm">Carregar Imagem</span>
                  </label>
                  <Input type="file" accept="image/*" className="hidden" id="end-upload" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], false)} />
                  <Input placeholder="Ou cole a URL aqui" value={frameEndUrl} onChange={(e) => setFrameEndUrl(e.target.value)} className="mt-2" />
                  {uploadingEnd && <p className="text-sm text-muted-foreground mt-1">Enviando...</p>}
                  {frameEndUrl && (
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

          <Card className="order-1 lg:col-span-2">
            <CardContent className="pt-6">
              {videoUrl ? (
                <div className="space-y-4">
                  <video controls autoPlay className="w-full rounded-md border border-border aspect-video" src={videoUrl} key={videoUrl} />
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

          <div className="order-3 lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">Vídeos Salvos</h2>
            {savedVideos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {savedVideos.map((url, index) => (
                    <SavedVideo key={index} url={url} />
                ))}
                </div>
            ) : (
                <p className="text-muted-foreground">Nenhum vídeo salvo no histórico.</p>
            )}
          </div>

        </div>
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="max-w-lg">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Compartilhar</h3>
              <p className="text-sm text-muted-foreground">Escolha uma opção para compartilhar seu vídeo.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`} target="_blank" rel="noreferrer">Telegram</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`} target="_blank" rel="noreferrer">Facebook</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`} target="_blank" rel="noreferrer">X</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareData.url)}`} target="_blank" rel="noreferrer">LinkedIn</a>
                <a className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" href={`mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.text + '\n' + shareData.url)}`}>Email</a>
                <button className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm hover:bg-accent" onClick={async () => { await navigator.clipboard.writeText(shareData.url); setShareOpen(false); }}>Copiar link</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default VideoPage;