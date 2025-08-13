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
import { Download, Image as ImageIcon, Share2, ZoomIn, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { downloadImage, shareImage, GeneratedImage, dataURIToBlob } from "@/utils/imageUtils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const QUALITY_SETTINGS = [
    { id: "standard", label: "Padrão (1024x1024)", width: 1024, height: 1024, steps: 15 },
    { id: "landscape", label: "Paisagem (1536x1024)", width: 1536, height: 1024, steps: 15 },
    { id: "portrait", label: "Retrato (1024x1536)", width: 1024, height: 1536, steps: 15 },
    { id: "fast", label: "Rápido (512x512)", width: 512, height: 512, steps: 10 },
];

const MODELS = [
    { id: "openai:1@1", label: "Gpt-Image 1" },
    { id: "bytedance:3@1", label: "Seedream 3.0" },
    { id: "runware:108@1", label: "Qwen-Image" },
];

const MAX_IMAGES_TO_FETCH = 10;

const ImagePage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [prompt, setPrompt] = useState("");
    const [model, setModel] = useState(MODELS[0].id);
    const [quality, setQuality] = useState(QUALITY_SETTINGS[0].id);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    // --- NOVO ESTADO PARA CONTROLAR O CARREGAMENTO INICIAL ---
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const selectedQualityInfo = useMemo(() => QUALITY_SETTINGS.find(q => q.id === quality)!, [quality]);

    useEffect(() => {
        document.title = "Gerar Imagens com IA | Synergy AI"; // SEO: title tag
    }, []);

    // --- LÓGICA DE BUSCA DE HISTÓRICO CORRIGIDA ---
    useEffect(() => {
        const fetchUserImages = async () => {
            // Primeiro, espera a confirmação da sessão do usuário
            const { data: { session } } = await supabase.auth.getSession();
            
            // Se não houver sessão (usuário não logado), para o carregamento e não mostra erro.
            if (!session?.user) {
                console.log("Usuário não logado. O histórico não será carregado.");
                setIsLoadingHistory(false);
                return;
            }

            // Agora que temos certeza que o usuário existe, buscamos os dados.
            const { data, error } = await supabase
                .from('user_images')
                .select('id, prompt, image_path, created_at, width, height')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(MAX_IMAGES_TO_FETCH);

            if (error) {
                console.error("Erro ao buscar histórico:", error);
                // Só mostra o erro se a falha for do banco, não por falta de login
                toast({ title: "Erro", description: "Não foi possível carregar seu histórico.", variant: "destructive" });
            } else if (data) {
                const formattedImages = data.map((dbImg) => {
                    const { data: pub } = supabase.storage.from('images').getPublicUrl(dbImg.image_path);
                    return {
                        id: dbImg.id,
                        prompt: dbImg.prompt || '',
                        originalPrompt: dbImg.prompt || '',
                        detailedPrompt: dbImg.prompt || '',
                        url: pub.publicUrl,
                        timestamp: dbImg.created_at,
                        quality: 'standard',
                        width: dbImg.width || 1024,
                        height: dbImg.height || 1024,
                        model: MODELS[0].id,
                    } as GeneratedImage;
                });
                setImages(formattedImages);
            }
            // Finaliza o estado de carregamento
            setIsLoadingHistory(false);
        };

        fetchUserImages();
    }, [toast]);

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
        const { data: { user } } = await supabase.auth.getUser();
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

            const body: any = { model, positivePrompt: prompt, width: selectedQualityInfo.width, height: selectedQualityInfo.height, numberResults: 1, outputFormat: "PNG", ...(inputImageBase64 ? { inputImage: inputImageBase64, strength: 0.8 } : {}), };
            const { data: apiData, error: apiError } = await supabase.functions.invoke('generate-image', { body });
            if (apiError) throw apiError;
            
            const imageDataURI = `data:image/${apiData?.format || 'webp'};base64,${apiData?.image}`;
            if (!apiData?.image) throw new Error("A API não retornou uma imagem.");

            setIsSaving(true);
            
            const imageBlob = dataURIToBlob(imageDataURI);
            const fileName = `${user.id}/${Date.now()}.png`;
            
            const { error: uploadError } = await supabase.storage.from('images').upload(fileName, imageBlob);
            if (uploadError) throw uploadError;

            const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);

            const { data: insertData, error: insertError } = await supabase
                .from('user_images')
                .insert({
                    user_id: user.id,
                    prompt,
                    image_path: fileName,
                    width: selectedQualityInfo.width,
                    height: selectedQualityInfo.height,
                    format: apiData?.format || 'png',
                })
                .select()
                .single();
            if (insertError) throw insertError;

            const newImageForState: GeneratedImage = {
                id: insertData.id,
                prompt: insertData.prompt || prompt,
                originalPrompt: insertData.prompt || prompt,
                detailedPrompt: insertData.prompt || prompt,
                url: pub.publicUrl,
                timestamp: insertData.created_at,
                quality,
                width: insertData.width || selectedQualityInfo.width,
                height: insertData.height || selectedQualityInfo.height,
                model,
            };

            setImages(prev => [newImageForState, ...prev].slice(0, MAX_IMAGES_TO_FETCH));
            toast({ title: 'Imagem gerada e salva!', variant: "default" });

        } catch (e: any) {
            console.error("Erro no processo:", e);
            toast({ title: 'Erro', description: e.message || 'Tente novamente.', variant: "destructive" });
        } finally {
            setIsGenerating(false);
            setIsSaving(false);
        }
    };

    const handleDownload = (img: GeneratedImage) => downloadImage(img, toast);
    const handleShare = (img: GeneratedImage) => shareImage(img, toast);

    return (
        <div className="min-h-screen bg-background" role="main">
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
                                            {MODELS.map(m => ( <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem> ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Qualidade/Tamanho</Label>
                                    <Select value={quality} onValueChange={setQuality}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {QUALITY_SETTINGS.map(q => ( <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem> ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-1">
                                    <Label>Anexar Imagem</Label>
                                    <Input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} className="sr-only"/>
                                    <Label htmlFor="file-upload" className="mt-2 flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground">
                                        Escolha o arquivo
                                    </Label>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={generate} disabled={isGenerating || isSaving} className="w-full sm:w-auto">
                                    {(isGenerating || isSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isGenerating ? 'Gerando...' : isSaving ? 'Salvando...' : 'Gerar Imagem'}
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
                                        <img src={images[0].url} alt={`Imagem gerada: ${images[0].prompt}`} className="w-full h-full object-cover" loading="eager" />
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent hidden sm:flex items-center justify-between gap-2">
                                            <Button variant="outline" className="gap-2 flex-1 bg-background/80" onClick={() => handleDownload(images[0])}><Download className="h-4 w-4" /> Baixar</Button>
                                            <Button variant="outline" className="gap-2 flex-1 bg-background/80" onClick={() => handleShare(images[0])}><Share2 className="h-4 w-4" /> Compartilhar</Button>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" className="gap-2 flex-1 bg-background/80"><ZoomIn className="h-4 w-4" /> Ampliar</Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-4xl">
                                                    <img src={images[0].url} alt={`Imagem ampliada: ${images[0].prompt}`} className="w-full h-auto" />
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                    <div className="sm:hidden flex flex-col items-stretch gap-2 p-4 border-t">
                                        <Button variant="outline" className="gap-2 w-full" onClick={() => handleDownload(images[0])}><Download className="h-4 w-4" /> Baixar</Button>
                                        <Button variant="outline" className="gap-2 w-full" onClick={() => handleShare(images[0])}><Share2 className="h-4 w-4" /> Compartilhar</Button>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="gap-2 w-full"><ZoomIn className="h-4 w-4" /> Ampliar</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-4xl">
                                                <img src={images[0].url} alt={`Imagem ampliada: ${images[0].prompt}`} className="w-full h-auto" />
                                            </DialogContent>
                                        </Dialog>
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
                        <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 9 }).map((_, index) => {
                                const img = images[index + 1];
                                if (img) {
                                    return (
                                        <Dialog key={img.id}>
                                            <Card className="relative group overflow-hidden rounded-lg aspect-square">
                                                <DialogTrigger asChild><img src={img.url} alt={`Imagem gerada: ${img.prompt}`} className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105" loading="lazy" /></DialogTrigger>
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDownload(img); }}><Download className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={(e) => { e.stopPropagation(); handleShare(img); }}><Share2 className="h-4 w-4" /></Button>
                                                </div>
                                            </Card>
                                            <DialogContent className="max-w-4xl"><img src={img.url} alt={`Imagem ampliada: ${img.prompt}`} className="w-full h-auto" /></DialogContent>
                                        </Dialog>
                                    );
                                }
                                return ( <Card key={`placeholder-${index}`} className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20" /> );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ImagePage;