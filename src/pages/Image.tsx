```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Image as ImageIcon, Share2, ZoomIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { downloadImage, shareImage, GeneratedImage } from "@/utils/imageUtils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const SIZES = [
  { id: "1024x1024", label: "Quadrado 1024x1024", w: 1024, h: 1024 },
  { id: "1536x1024", label: "Paisagem 1536x1024", w: 1536, h: 1024 },
  { id: "1024x1536", label: "Retrato 1024x1536", w: 1024, h: 1536 },
];

const MODELS = [
  { id: "openai:1@1", label: "GPT Image 1 (Runware)" },
];

const QUALITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const MAX_IMAGES = 10;
const STORAGE_KEY = 'synergy_ai_images';

const ImagePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [size, setSize] = useState<string>(SIZES[0].id);
  const [quality, setQuality] = useState<string>(QUALITIES[1].id); // Default to medium
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const sizeInfo = useMemo(() => SIZES.find(s => s.id === size)!, [size]);

  useEffect(() => {
    document.title = "Gerar Imagens com IA | Synergy AI";
    const desc = "Crie imagens com a API Runware. Escolha a resolução e faça download ou compartilhe.";
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
    link.href = `${window.location.origin}/image`;
  }, []);

  // Load saved images from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GeneratedImage[];
        setImages(parsed.slice(0, MAX_IMAGES));
      }
    } catch (err) {
      console.warn("Falha ao carregar imagens salvas", err);
    }
  }, []);

  // Persist images to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(images.slice(0, MAX_IMAGES)));
    } catch (err) {
      console.warn("Falha ao salvar imagens", err);
    }
  }, [images]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Escreva um prompt", description: "Descreva o que deseja gerar.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      let inputImageBase64: string | undefined;
      if (selectedFile) {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        await new Promise((resolve) => (reader.onload = resolve));
        inputImageBase64 = (reader.result as string).split(',')[1];
      }

      const taskUUID = crypto.randomUUID();
      const outputQuality = quality === "high" ? 100 : quality === "medium" ? 85 : 50;

      const body = {
        taskType: selectedFile ? "imageVariation" : "imageInference",
        model: model,
        positivePrompt: prompt,
        height: sizeInfo.h,
        width: sizeInfo.w,
        numberResults: 1,
        outputType: ["dataURI", "URL"],
        outputFormat: "PNG",
        includeCost: true,
        outputQuality,
        providerSettings: { openai: { quality } },
        taskUUID,
      };

      if (inputImageBase64) {
        body.image = inputImageBase64;
      }

      const { data, error } = await supabase.functions.invoke('generate-image', { body });
      if (error) throw error;

      const imageDataURI = data.imageDataURI as string;
      if (!imageDataURI) throw new Error('Falha ao gerar a imagem');

      const [mimePart, b64] = imageDataURI.split(';base64,');
      const mime = mimePart.replace('data:', '');

      const img: GeneratedImage = {
        id: `${Date.now()}`,
        prompt,
        originalPrompt: prompt,
        detailedPrompt: prompt,
        url: imageDataURI,
        timestamp: new Date().toISOString(),
        quality,
        width: sizeInfo.w,
        height: sizeInfo.h,
        model,
      };
      setImages(prev => [img, ...prev].slice(0, MAX_IMAGES));
      toast({ title: 'Imagem gerada', description: 'Sua imagem está pronta!' });
      setSelectedFile(null);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao gerar', description: e?.message || 'Tente novamente.', variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (img: GeneratedImage) => downloadImage(img, toast);
  const handleShare = (img: GeneratedImage) => shareImage(img, toast);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Synergy Imagem</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <section className="max-w-5xl mx-auto mb-8">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid lg:grid-cols-12 gap-4 items-end">
                <div className="lg:col-span-7">
                  <Label htmlFor="prompt">Descreva o que você quer ver</Label>
                  <Textarea id="prompt" placeholder="Ex: retrato fotorealista de um astronauta com nebulosas ao fundo, iluminação cinematográfica" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <Label>Modelo</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label>Resolução</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label>Qualidade</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Qualidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUALITIES.map(q => (
                        <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-3">
                  <Label htmlFor="file-upload">Anexar Imagem (opcional)</Label>
                  <Input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} />
                </div>
                <div className="lg:col-span-1">
                  <Button className="w-full" onClick={generate} disabled={isGenerating}>
                    {isGenerating ? 'Gerando...' : 'Gerar'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                As imagens são geradas usando a API Runware. Tamanhos suportados: 1024x1024, 1536x1024, 1024x1536.
              </p>
            </CardContent>
          </Card>
        </section>
        {images.length > 0 && (
          <section className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latest image large on left */}
            <Card className="col-span-1">
              <CardContent className="p-0">
                <img src={images[0].url} alt={`Imagem gerada: ${images[0].prompt}`} className="w-full h-auto object-cover" loading="lazy" />
                <div className="p-4 flex items-center justify-between gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => handleDownload(images[0])}>
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => handleShare(images[0])}>
                    <Share2 className="h-4 w-4" /> Compartilhar
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <ZoomIn className="h-4 w-4" /> Ampliar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <img src={images[0].url} alt={`Imagem ampliada: ${images[0].prompt}`} className="w-full h-auto" />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
            {/* History: previous 9 in 5 columns */}
            <div className="col-span-1 grid grid-cols-5 gap-2">
              {images.slice(1).map((img) => (
                <Card key={img.id} className="relative">
                  <CardContent className="p-0">
                    <img src={img.url} alt={`Imagem gerada: ${img.prompt}`} className="w-full h-auto object-cover" loading="lazy" />
                    <div className="absolute bottom-0 left-0 right-0 bg-background/80 p-1 flex justify-around">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(img)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleShare(img)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <img src={img.url} alt={`Imagem ampliada: ${img.prompt}`} className="w-full h-auto" />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default ImagePage;
```