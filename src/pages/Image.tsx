import { useEffect, useMemo, useState, useRef } from "react";
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

const QUALITY_SETTINGS = [
  { id: "standard", label: "Padrão (1024x1024)", width: 1024, height: 1024, steps: 15 },
  { id: "landscape", label: "Paisagem (1536x1024)", width: 1536, height: 1024, steps: 15 },
  { id: "portrait", label: "Retrato (1024x1536)", width: 1024, height: 1536, steps: 15 },
  { id: "fast", label: "Rápido (512x512)", width: 512, height: 512, steps: 10 },
];

// IDs oficiais e corretos para os modelos da Runware
const MODELS = [
  { id: "openai:1@1", label: "Gpt-Image 1" },
  { id: "bytedance:3@1", label: "Seedream 3.0" },
  { id: "runware:108@1", label: "Qwen-Image" },
];

const MAX_IMAGES = 10;
const STORAGE_KEY = 'synergy_ai_images';

const ImagePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [quality, setQuality] = useState<string>(QUALITY_SETTINGS[0].id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const storageErrorShown = useRef(false);
  
  const selectedQualityInfo = useMemo(() => QUALITY_SETTINGS.find(q => q.id === quality)!, [quality]);

  useEffect(() => {
    document.title = "Gerar Imagens com IA | Synergy AI";
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setImages(JSON.parse(raw) as GeneratedImage[]);
      }
    } catch (err) {
      console.warn("Falha ao carregar imagens salvas", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(images.slice(0, MAX_IMAGES)));
    } catch (err) {
      console.warn("Falha ao salvar imagens no localStorage:", err);
      if (!storageErrorShown.current) {
        toast({
          title: "Armazenamento local cheio",
          description: "Não foi possível salvar as imagens localmente.",
          variant: "destructive",
        });
        storageErrorShown.current = true;
      }
    }
  }, [images, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
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
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => resolve();
          reader.onerror = (error) => reject(error);
        });
        inputImageBase64 = (reader.result as string).split(',')[1];
      }

      const taskUUID = crypto.randomUUID();

      const body: any = {
        model,
        positivePrompt: prompt,
        width: selectedQualityInfo.width,
        height: selectedQualityInfo.height,
        numberResults: 1,
        outputFormat: "PNG",
        ...(inputImageBase64 ? { inputImage: inputImageBase64, strength: 0.8 } : {}),
      };

      const { data, error } = await supabase.functions.invoke('generate-image', { body });
      if (error) throw error;

      const base64 = data?.image as string | undefined;
      const format = (data?.format as string | undefined) || 'webp';
      const imageDataURI = base64 ? `data:image/${format};base64,${base64}` : undefined;
      if (!imageDataURI) throw new Error('A API não retornou uma imagem. Verifique o log da função Supabase.');

      const img: GeneratedImage = {
        id: taskUUID,
        prompt,
        originalPrompt: prompt,
        url: imageDataURI,
        timestamp: new Date().toISOString(),
        quality: quality,
        width: selectedQualityInfo.width,
        height: selectedQualityInfo.height,
        model: model,
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
        
        <section className="max-w-7xl mx-auto mb-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-7">
                    <Label htmlFor="prompt">Descreva o que você quer ver</Label>
                    <Textarea id="prompt" placeholder="Ex: retrato fotorealista de um astronauta..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Modelo</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Qualidade/Tamanho</Label>
                    <Select value={quality} onValueChange={setQuality}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUALITY_SETTINGS.map(q => (
                          <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label>Anexar Imagem</Label>
                    <Input
                        id="file-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="sr-only"
                    />
                    <Label
                        htmlFor="file-upload"
                        className="mt-2 flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground"
                    >
                        Escolha o arquivo
                    </Label>
                  </div>
                </div>
                <div className="flex justify-end">
                    <Button onClick={generate} disabled={isGenerating} className="w-full sm:w-auto">
                      {isGenerating ? 'Gerando...' : 'Gerar Imagem'}
                    </Button>
                </div>
              </CardContent>
            </Card>
        </section>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <Card className="w-full h-full min-h-[512px] flex items-center justify-center">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-lg font-medium">Processando...</span>
                </div>
              ) : images.length > 0 ? (
                <CardContent className="p-0">
                  <img src={images[0].url} alt={`Imagem gerada: ${images[0].prompt}`} className="w-full h-auto object-cover rounded-t-lg" loading="eager" />
                  <div className="p-4 flex items-center justify-between gap-2 border-t">
                    <Button variant="outline" className="gap-2 flex-1" onClick={() => handleDownload(images[0])}>
                      <Download className="h-4 w-4" /> Baixar
                    </Button>
                    <Button variant="outline" className="gap-2 flex-1" onClick={() => handleShare(images[0])}>
                      <Share2 className="h-4 w-4" /> Compartilhar
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2 flex-1">
                          <ZoomIn className="h-4 w-4" /> Ampliar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <img src={images[0].url} alt={`Imagem ampliada: ${images[0].prompt}`} className="w-full h-auto" />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-12 w-12" />
                    <span className="text-lg font-medium">Sua imagem aparecerá aqui</span>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {images.slice(1).map((img) => (
                <Dialog key={img.id}>
                  <Card className="relative group overflow-hidden rounded-lg aspect-square">
                    <DialogTrigger asChild>
                      <img src={img.url} alt={`Imagem gerada: ${img.prompt}`} className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    </DialogTrigger>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDownload(img); }}>
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={(e) => { e.stopPropagation(); handleShare(img); }}>
                            <Share2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </Card>
                   <DialogContent className="max-w-4xl">
                      <img src={img.url} alt={`Imagem ampliada: ${img.prompt}`} className="w-full h-auto" />
                   </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ImagePage;