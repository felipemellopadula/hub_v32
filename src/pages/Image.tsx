import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Image as ImageIcon, Share2, ZoomIn, Loader2, X, ArrowLeft, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfile } from "@/components/UserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const QUALITY_SETTINGS = [
    { id: "standard", label: "Padrão (1024x1024)", width: 1024, height: 1024, steps: 15 },
    { id: "landscape", label: "Paisagem (1536x1024)", width: 1536, height: 1024, steps: 15 },
    { id: "portrait", label: "Retrato (1024x1536)", width: 1024, height: 1536, steps: 15 },
    { id: "fast", label: "Rápido (512x512)", width: 512, height: 512, steps: 10 },
];

const MODELS = [
    { id: "openai:1@1", label: "Gpt-Image 1" },
    { id: "ideogram:4@1", label: "Ideogram 3.0" },
    { id: "runware:108@1", label: "Qwen-Image" },
  { id: "bfl:3@1", label: "FLUX.1 Kontext [max]" },
];

const MAX_IMAGES_TO_FETCH = 10;

interface DatabaseImage {
  id: string;
  user_id: string;
  prompt: string | null;
  image_path: string;
  width: number | null;
  height: number | null;
  format: string | null;
  created_at: string;
}

const ImagePage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [prompt, setPrompt] = useState("");
    const [model, setModel] = useState(MODELS[0].id);
    const [quality, setQuality] = useState(QUALITY_SETTINGS[0].id);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [images, setImages] = useState<DatabaseImage[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
    // Habilita anexo apenas para GPT
    const canAttachImage = useMemo(() => model === "openai:1@1", [model]);

    useEffect(() => {
        document.title = "Gerar Imagens com Ia";
    }, []);

    useEffect(() => {
        if (selectedFile) {
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    }, [selectedFile]);

    useEffect(() => {
        if (!canAttachImage && selectedFile) {
            setSelectedFile(null);
        }
    }, [canAttachImage, selectedFile]);

    const selectedQualityInfo = useMemo(() => QUALITY_SETTINGS.find(q => q.id === quality)!, [quality]);

    // Carrega imagens salvas
    const loadSavedImages = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('user_images')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(MAX_IMAGES_TO_FETCH);

            if (error) throw error;
            setImages(data || []);
        } catch (error) {
            console.error("Erro ao carregar imagens:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [user]);

    useEffect(() => {
        loadSavedImages();
    }, [loadSavedImages]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        setSelectedFile(e.target.files[0]);
      } else {
        setSelectedFile(null);
      }
    };

    const generate = async () => {
        if (!prompt.trim()) {
            toast({ title: "Escreva um prompt", variant: "destructive" });
            return;
        }
        if (!user) {
            toast({ title: "Acesso Negado", description: "Você precisa estar logado para gerar imagens.", variant: "destructive" });
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

            const body: any = { 
                model, 
                positivePrompt: prompt, 
                width: selectedQualityInfo.width, 
                height: selectedQualityInfo.height, 
                numberResults: 1, 
                outputFormat: "PNG", 
                ...(inputImageBase64 && model === "openai:1@1" ? { inputImage: inputImageBase64 } : {}), 
            };
            
            const { data: apiData, error: apiError } = await supabase.functions.invoke('generate-image', { body });
            if (apiError) throw apiError;
            
            if (!apiData?.image) throw new Error("A API não retornou uma imagem.");
            
            // Salvar imagem no storage e database
            await saveImageToDatabase(apiData.image, apiData.format || 'png');
            
            toast({ title: 'Imagem gerada e salva!', variant: "default" });

        } catch (e: any) {
            console.error("Erro no processo:", e);
            toast({ title: 'Erro', description: e.message || 'Tente novamente.', variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    // Salvar imagem no storage e database
    const saveImageToDatabase = useCallback(async (imageBase64: string, format: string) => {
        if (!user) return;
        try {
            const imageDataURI = `data:image/${format};base64,${imageBase64}`;
            const imageResponse = await fetch(imageDataURI);
            const imageBlob = await imageResponse.blob();
            const fileName = `${user.id}/${Date.now()}.${format}`;
            
            const { data: storageData, error: storageError } = await supabase.storage
                .from('images')
                .upload(fileName, imageBlob, { cacheControl: '3600' });
            
            if (storageError) throw storageError;
            
            const { error: dbError } = await supabase
                .from('user_images')
                .insert({
                    user_id: user.id,
                    prompt,
                    image_path: storageData.path,
                    width: selectedQualityInfo.width,
                    height: selectedQualityInfo.height,
                    format,
                });
            
            if (dbError) throw dbError;
            
            loadSavedImages();
        } catch (error) {
            console.error("Erro ao salvar imagem:", error);
        }
    }, [user, prompt, selectedQualityInfo, loadSavedImages]);

    // Deletar imagem
    const deleteImage = useCallback(async (imageId: string, imagePath: string) => {
        if (!user) return;
        
        // Otimistic update
        setImages(prev => prev.filter(img => img.id !== imageId));
        
        try {
            // Deletar do storage
            const { error: storageError } = await supabase.storage
                .from('images')
                .remove([imagePath]);
            
            if (storageError) throw storageError;
            
            // Deletar do database
            const { error: dbError } = await supabase
                .from('user_images')
                .delete()
                .eq('id', imageId)
                .eq('user_id', user.id);
            
            if (dbError) throw dbError;
            
            toast({ title: 'Imagem deletada', variant: "default" });
        } catch (error) {
            console.error("Erro ao deletar imagem:", error);
            toast({ title: 'Erro ao deletar', description: 'Tente novamente.', variant: "destructive" });
            // Reverter otimistic update em caso de erro
            loadSavedImages();
        }
    }, [user, toast, loadSavedImages]);

    const downloadImage = (image: DatabaseImage) => {
        const { data: publicData } = supabase.storage.from('images').getPublicUrl(image.image_path);
        const link = document.createElement('a');
        link.href = publicData.publicUrl;
        link.download = `imagem-${image.id}.${image.format || 'png'}`;
        link.click();
    };

    const shareImage = async (image: DatabaseImage) => {
        const { data: publicData } = supabase.storage.from('images').getPublicUrl(image.image_path);
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Imagem gerada por IA',
                    text: image.prompt || 'Confira esta imagem gerada por IA',
                    url: publicData.publicUrl,
                });
            } catch (error) {
                console.log('Erro ao compartilhar:', error);
            }
        } else {
            await navigator.clipboard.writeText(publicData.publicUrl);
            toast({ title: 'Link copiado!', description: 'O link da imagem foi copiado para a área de transferência.' });
        }
    };

    const getImageUrl = (image: DatabaseImage) => {
        const { data: publicData } = supabase.storage.from('images').getPublicUrl(image.image_path);
        return publicData.publicUrl;
    };

    return (
        <div className="min-h-screen bg-background" role="main">
            <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                <div className="container mx-auto px-4 pt-1 pb-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:bg-muted">
                            <ArrowLeft className="h-4 w-4" />
                            Voltar
                        </Button>
                        <div className="h-6 w-px bg-border" />
                        <div className="flex items-center gap-2">
                            <ImageIcon className="h-6 w-6 text-primary" />
                            <h1 className="text-xl font-bold text-foreground">Imagem</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <UserProfile />
                        <ThemeToggle />
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
                                            {MODELS.map(m => ( <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem> ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Qualidade</Label>
                                    <Select value={quality} onValueChange={setQuality}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {QUALITY_SETTINGS.map(q => ( <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem> ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-1">
                                    <Label>Anexar</Label>
                                    <Input
                                      id="file-upload"
                                      type="file"
                                      accept="image/*"
                                      onChange={handleFileChange}
                                      className="sr-only"
                                      disabled={!canAttachImage}
                                    />
                                    {!canAttachImage ? (
                                      <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Label
                                              htmlFor="file-upload"
                                              aria-disabled={!canAttachImage}
                                              className={`mt-2 flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background cursor-not-allowed opacity-50`}
                                            >
                                              Imagem
                                            </Label>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Disponível apenas no modelo GPT-Image 1</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <Label
                                        htmlFor="file-upload"
                                        aria-disabled={!canAttachImage}
                                        className={`mt-2 flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background cursor-pointer hover:bg-accent hover:text-accent-foreground`}
                                      >
                                        Imagem
                                      </Label>
                                    )}
                                    {previewUrl && (
                                      <div className="relative mt-2 w-20 h-20 rounded-md overflow-hidden border">
                                        <img
                                          src={previewUrl}
                                          alt="Pré-visualização da imagem anexada"
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setSelectedFile(null)}
                                          className="absolute top-1 right-1 inline-flex items-center justify-center h-6 w-6 rounded-full border bg-background text-foreground shadow hover:bg-accent"
                                          aria-label="Remover imagem anexada"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={generate} disabled={isGenerating} className="w-full sm:w-auto">
                                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isGenerating ? 'Gerando...' : 'Gerar Imagem'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3">
                        <Card className="w-full rounded-lg sm:aspect-square flex flex-col items-center justify-center overflow-hidden relative bg-muted">
                            {isGenerating ? (
                                <div className="flex flex-col items-center gap-4 text-muted-foreground aspect-square w-full justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin" />
                                    <span className="text-lg font-medium">Processando...</span>
                                </div>
                            ) : images.length > 0 ? (
                                <div className="w-full">
                                    <div className="aspect-square relative">
                                        <img src={getImageUrl(images[0])} alt={`Imagem gerada: ${images[0].prompt}`} className="w-full h-full object-cover" loading="eager" />
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent hidden sm:flex items-center justify-between gap-2">
                                            <p className="text-white text-sm truncate flex-1 mr-2">{images[0].prompt}</p>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => downloadImage(images[0])} className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={() => shareImage(images[0])} className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                                                    <Share2 className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={() => deleteImage(images[0].id, images[0].image_path)} className="bg-red-500/20 hover:bg-red-500/30 text-white border-red-500/20">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                                                            <ZoomIn className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-4xl">
                                                        <img src={getImageUrl(images[0])} alt={`Imagem gerada: ${images[0].prompt}`} className="w-full h-auto" />
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-4 left-4 right-4 sm:hidden">
                                            <div className="flex gap-2 justify-center">
                                                <Button size="sm" variant="secondary" onClick={() => downloadImage(images[0])} className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={() => shareImage(images[0])} className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                                                    <Share2 className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={() => deleteImage(images[0].id, images[0].image_path)} className="bg-red-500/20 hover:bg-red-500/30 text-white border-red-500/20">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                                                            <ZoomIn className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-4xl">
                                                        <img src={getImageUrl(images[0])} alt={`Imagem gerada: ${images[0].prompt}`} className="w-full h-auto" />
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground aspect-square w-full justify-center">
                                    {isLoadingHistory ? (
                                      <Loader2 className="h-10 w-10 animate-spin" />
                                    ) : (
                                      <>
                                        <ImageIcon className="h-12 w-12" />
                                        <span className="text-lg font-medium">Sua imagem aparecerá aqui</span>
                                      </>
                                    )}
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-foreground">Imagens anteriores</h2>
                                <span className="text-sm text-muted-foreground">
                                    {isLoadingHistory ? "Carregando..." : `${images.length} de ${MAX_IMAGES_TO_FETCH}`}
                                </span>
                            </div>

                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {isLoadingHistory ? (
                                    Array.from({ length: 3 }).map((_, index) => (
                                        <Card key={index} className="p-4">
                                            <div className="flex gap-4">
                                                <div className="w-16 h-16 bg-muted rounded-md animate-pulse" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-muted rounded animate-pulse" />
                                                    <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                ) : images.length > 1 ? (
                                    images.slice(1, MAX_IMAGES_TO_FETCH).map((img) => (
                                        <Card key={img.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                                            <div className="flex gap-4 p-4">
                                                <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                                                    <img src={getImageUrl(img)} alt={`Miniatura: ${img.prompt}`} className="w-full h-full object-cover" loading="lazy" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">{img.prompt}</p>
                                                    <p className="text-xs text-muted-foreground mb-2">
                                                        {new Date(img.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <div className="flex gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => downloadImage(img)} className="h-7 px-2">
                                                            <Download className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => shareImage(img)} className="h-7 px-2">
                                                            <Share2 className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => deleteImage(img.id, img.image_path)} className="h-7 px-2 text-red-500 hover:text-red-600">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button size="sm" variant="ghost" className="h-7 px-2">
                                                                    <ZoomIn className="h-3 w-3" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-4xl">
                                                                <img src={getImageUrl(img)} alt={`Imagem gerada: ${img.prompt}`} className="w-full h-auto" />
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <Card className="p-6 text-center">
                                        <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-muted-foreground">Nenhuma imagem anterior encontrada</p>
                                        <p className="text-sm text-muted-foreground mt-1">Suas próximas gerações aparecerão aqui</p>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ImagePage;