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
import { Download, Link2, Share2, VideoIcon, RotateCcw, Upload, Play, Pause, Maximize } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const RESOLUTIONS = [
  { id: "16:9-480p", label: "16:9 (Wide / Landscape) - 480p", w: 864, h: 480 },
];

const DURATIONS = [5];

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
    if (videoRef.current && videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div className="relative aspect-video border border-border rounded-md overflow-hidden">
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        loop
        muted
      />
      <div className="absolute top-2 right-2 flex gap-2">
        <Button variant="ghost" size="icon" className="bg-background/50" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <div className="absolute bottom-2 left-2 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="bg-background/50"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="bg-background/50"
          onClick={goFullscreen}
        >
          <Maximize className="h-4 w-4" />
        </Button>
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
  const savedOnceRef = useRef<boolean>(false);
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);
  const [savedVideos, setSavedVideos] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('savedVideos');
    if (stored) {
      setSavedVideos(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (videoUrl) {
      setSavedVideos(prev => {
        const newVideos = [...prev, videoUrl].slice(-MAX_VIDEOS);
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

  const handleShare = async (url: string) => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'Meu vídeo gerado com IA', url });
      } catch { }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copiado', description: 'URL do vídeo copiada para a área de transferência.' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <VideoIcon className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Gerador de Vídeo</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="lg:col-span-1 lg:row-span-2">
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
                <div className="flex items-center gap-2">
                  <Switch id="camera-fixed" checked={cameraFixed} onCheckedChange={setCameraFixed} />
                  <Label htmlFor="camera-fixed">Camera Fixed</Label>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Frame Inicial (opcional)</Label>
                  <div className="border border-border rounded-md p-2 text-center cursor-pointer hover:bg-accent/10">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="start-upload"
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], true)}
                    />
                    <Label htmlFor="start-upload" className="cursor-pointer flex flex-col items-center">
                      <Upload className="h-6 w-6 mb-1" />
                      Drag Or Upload Image
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Or paste UUID/Base64/URI/URL here</p>
                  <Input placeholder="URL da imagem" value={frameStartUrl} onChange={(e) => setFrameStartUrl(e.target.value)} />
                  {uploadingStart && <p className="text-sm text-muted-foreground">Uploading...</p>}
                </div>
                <div>
                  <Label>Frame Final (opcional)</Label>
                  <div className="border border-border rounded-md p-2 text-center cursor-pointer hover:bg-accent/10">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="end-upload"
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], false)}
                    />
                    <Label htmlFor="end-upload" className="cursor-pointer flex flex-col items-center">
                      <Upload className="h-6 w-6 mb-1" />
                      Drag Or Upload Image
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Or paste UUID/Base64/URI/URL here</p>
                  <Input placeholder="URL da imagem" value={frameEndUrl} onChange={(e) => setFrameEndUrl(e.target.value)} />
                  {uploadingEnd && <p className="text-sm text-muted-foreground">Uploading...</p>}
                </div>
              </div>
              <Button className="w-full" onClick={startGeneration} disabled={isSubmitting || !prompt}>
                {isSubmitting ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : null}
                Gerar Vídeo
              </Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 lg:row-span-1 lg:col-start-2">
            <CardContent className="pt-6">
              {videoUrl ? (
                <div className="space-y-4">
                  <video controls className="w-full rounded-md border border-border" src={videoUrl} />
                  <div className="flex gap-3 flex-wrap">
                    <Button onClick={() => handleDownload(videoUrl)}><Download className="h-4 w-4 mr-2" /> Baixar</Button>
                    <Button variant="outline" onClick={() => handleShare(videoUrl)}><Share2 className="h-4 w-4 mr-2" /> Compartilhar</Button>
                    <Button variant="outline" asChild>
                      <a href={videoUrl} target="_blank" rel="noreferrer">
                        <Link2 className="h-4 w-4 mr-2" /> Abrir em nova aba
                      </a>
                    </Button>
                  </div>
                </div>
              ) : taskUUID ? (
                <div className="h-full min-h-[300px] grid place-items-center text-center text-muted-foreground">
                  <div>
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-2"></div>
                    <p>Processando</p>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[300px] grid place-items-center text-center text-muted-foreground">
                  <div>
                    <VideoIcon className="h-10 w-10 mx-auto mb-2" />
                    <p>Nenhum vídeo gerado ainda. Preencha os campos e clique em "Gerar Vídeo".</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="lg:col-span-2 lg:col-start-2">
            <h2 className="text-xl font-bold mb-4">Vídeos Salvos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedVideos.map((url, index) => (
                <SavedVideo key={index} url={url} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoPage;