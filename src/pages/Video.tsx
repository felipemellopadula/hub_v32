import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Link2, Share2, VideoIcon, RotateCcw } from "lucide-react";

const MODEL_MAP: Record<string, string> = {
  "google-veo-3-fast": "google:veo-3@fast",
  // Correção: remover sufixo inválido "-lite" para AIR id válido
  "seedance-1-lite": "bytedance:seedance@1",
  "minimax-hailuo-02": "minimax:hailuo@2",
  // Ajuste para um identificador plausível
  "klingai-2-1-pro": "klingai:2@1",
};

const RESOLUTIONS = [
  { id: "720p", label: "1280 x 720 (16:9)", w: 1280, h: 720 },
  { id: "1080p", label: "1920 x 1080 (16:9)", w: 1920, h: 1080 },
  { id: "vertical-1080", label: "1080 x 1920 (9:16)", w: 1080, h: 1920 },
  { id: "square-1024", label: "1024 x 1024 (1:1)", w: 1024, h: 1024 },
];

const DURATIONS = [4, 6, 8, 10];

const VideoPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>("seedance-1-lite");
  const [resolution, setResolution] = useState<string>("1080p");
  const [duration, setDuration] = useState<number>(6);
  const [frameStartUrl, setFrameStartUrl] = useState("");
  const [frameEndUrl, setFrameEndUrl] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskUUID, setTaskUUID] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const savedOnceRef = useRef<boolean>(false);

  // SEO
  useEffect(() => {
    document.title = "Gerar Vídeo com IA | Synergy AI";
    const desc = "Crie vídeos com Veo 3, Seedance, Hailuo e KlingAI. Escolha resolução, duração e referências.";
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
  const modelId = useMemo(() => MODEL_MAP[model], [model]);

  const startGeneration = async () => {
    setIsSubmitting(true);
    setVideoUrl(null);
    setTaskUUID(null);

    try {
      const { data, error } = await supabase.functions.invoke('runware-video', {
        body: {
          action: 'start',
          modelId,
          positivePrompt: prompt,
          width: res.w,
          height: res.h,
          duration,
          frameStartUrl: frameStartUrl || undefined,
          frameEndUrl: frameEndUrl || undefined,
        }
      });

      if (error) throw error;
      if (!data?.taskUUID) throw new Error('Falha ao iniciar geração');

      setTaskUUID(data.taskUUID);
      toast({ title: 'Geração iniciada', description: 'Estamos processando seu vídeo. Isso pode levar alguns minutos.' });
      beginPolling(data.taskUUID);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e.message || 'Não foi possível iniciar a geração', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginPolling = (uuid: string) => {
    // Clear previous
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
        const status = statusItem?.status;

        if (videoURL) {
          setVideoUrl(videoURL);
          toast({ title: 'Vídeo pronto', description: 'Seu vídeo foi gerado com sucesso.' });
          return;
        }

        // Keep polling if processing
        const delay = Math.min(2000 * Math.pow(1.4, attempt), 12000);
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      } catch (e) {
        console.error(e);
        const delay = 5000;
        pollRef.current = window.setTimeout(() => poll(attempt + 1), delay) as unknown as number;
      }
    };

    // Initial delay to avoid hammering
    pollRef.current = window.setTimeout(() => poll(0), 2000) as unknown as number;
  };

  useEffect(() => () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
  }, []);

  // Auto-salvar localmente uma vez quando o vídeo estiver pronto
  useEffect(() => {
    if (videoUrl && !savedOnceRef.current) {
      savedOnceRef.current = true;
      handleSaveLocal(true);
    }
  }, [videoUrl]);

  const handleDownload = async () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = 'synergy-video.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSaveLocal = async (auto = false) => {
    if (!videoUrl) return;
    try {
      const resp = await fetch(videoUrl);
      const blob = await resp.blob();
      const fileName = `video-ia-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
      const anyWindow = window as any;
      if (anyWindow.showSaveFilePicker && !auto) {
        const handle = await anyWindow.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      if (!auto) {
        toast({ title: 'Salvo localmente', description: 'O vídeo foi salvo no seu dispositivo.' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (!videoUrl) return;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'Meu vídeo gerado com IA', url: videoUrl });
      } catch { }
    } else {
      await navigator.clipboard.writeText(videoUrl);
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
          <Button variant="outline" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div>
                <Label htmlFor="prompt">Descrição (prompt)</Label>
                <Textarea id="prompt" placeholder="Descreva a cena, movimentos de câmera, estilo..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Modelo</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google-veo-3-fast">Google Veo 3 Fast</SelectItem>
                      <SelectItem value="seedance-1-lite">Seedance 1.0 Lite</SelectItem>
                      <SelectItem value="minimax-hailuo-02">MiniMax 02 Hailuo</SelectItem>
                      <SelectItem value="klingai-2-1-pro">KlingAI 2.1 Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              </div>

              <div className="grid md:grid-cols-2 gap-4">
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
                <div className="flex items-end">
                  <Button className="w-full" onClick={startGeneration} disabled={isSubmitting || !prompt}>
                    {isSubmitting ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Gerar Vídeo
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Frame Inicial (opcional)</Label>
                  <Input placeholder="URL da imagem" value={frameStartUrl} onChange={(e) => setFrameStartUrl(e.target.value)} />
                </div>
                <div>
                  <Label>Frame Final (opcional)</Label>
                  <Input placeholder="URL da imagem" value={frameEndUrl} onChange={(e) => setFrameEndUrl(e.target.value)} />
                </div>
              </div>

              {taskUUID && !videoUrl && (
                <p className="text-sm text-muted-foreground">Processando... tarefa {taskUUID}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {videoUrl ? (
                <div className="space-y-4">
                  <video controls className="w-full rounded-md border border-border" src={videoUrl} />
                  <div className="flex gap-3">
                    <Button onClick={handleDownload}><Download className="h-4 w-4 mr-2" /> Baixar</Button>
                    <Button variant="secondary" onClick={() => handleSaveLocal(false)}>Salvar localmente</Button>
                    <Button variant="outline" onClick={handleShare}><Share2 className="h-4 w-4 mr-2" /> Compartilhar</Button>
                    <a href={videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-primary underline">
                      <Link2 className="h-4 w-4 mr-1" /> Abrir em nova aba
                    </a>
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
        </div>
      </main>
    </div>
  );
};

export default VideoPage;
