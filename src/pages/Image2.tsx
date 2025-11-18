import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from "browser-image-compression";
import {
  Download,
  Share2,
  Loader2,
  X,
  ArrowLeft,
  Trash2,
  Paperclip,
  Sparkles,
  Maximize2,
  Image as ImageIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import UserProfile from "@/components/UserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const QUALITY_SETTINGS = [
  { id: "standard", label: "Padrão (1024x1024)", width: 1024, height: 1024, steps: 15 },
  { id: "landscape", label: "Paisagem (1536x1024)", width: 1536, height: 1024, steps: 15 },
  { id: "portrait", label: "Retrato (1024x1536)", width: 1024, height: 1536, steps: 15 },
  { id: "fast", label: "Rápido (512x512)", width: 512, height: 512, steps: 10 },
];

const KONTEXT_QUALITY_SETTINGS = [
  { id: "1:1", label: "1:1 (Square)", width: 1024, height: 1024, steps: 15 },
  { id: "21:9", label: "21:9 (Ultra-Wide / Landscape)", width: 1568, height: 672, steps: 15 },
  { id: "16:9", label: "16:9 (Wide / Landscape)", width: 1392, height: 752, steps: 15 },
  { id: "4:3", label: "4:3 (Standard / Landscape)", width: 1184, height: 880, steps: 15 },
  { id: "3:2", label: "3:2 (Classic / Landscape)", width: 1248, height: 832, steps: 15 },
  { id: "2:3", label: "2:3 (Classic / Portrait)", width: 832, height: 1248, steps: 15 },
  { id: "3:4", label: "3:4 (Standard / Portrait)", width: 880, height: 1184, steps: 15 },
  { id: "9:16", label: "9:16 (Tall / Portrait)", width: 752, height: 1392, steps: 15 },
  { id: "9:21", label: "9:21 (Ultra-Tall / Portrait)", width: 672, height: 1568, steps: 15 },
];

const SEEDREAM_QUALITY_SETTINGS = [
  { id: "1:1-1k", label: "1:1 (1K / Square)", width: 1024, height: 1024, steps: 15 },
  { id: "1:1-2k", label: "1:1 (2K / Square)", width: 2048, height: 2048, steps: 15 },
  { id: "1:1-4k", label: "1:1 (4K / Square)", width: 4096, height: 4096, steps: 15 },
  { id: "4:3-2k", label: "4:3 (2K / Landscape)", width: 2304, height: 1728, steps: 15 },
  { id: "4:3-4k", label: "4:3 (4K / Landscape)", width: 4608, height: 3456, steps: 15 },
  { id: "16:9-2k", label: "16:9 (2K / Landscape)", width: 2560, height: 1440, steps: 15 },
  { id: "16:9-4k", label: "16:9 (4K / Landscape)", width: 5120, height: 2880, steps: 15 },
  { id: "3:2-2k", label: "3:2 (2K / Landscape)", width: 2496, height: 1664, steps: 15 },
  { id: "3:2-4k", label: "3:2 (4K / Landscape)", width: 4992, height: 3328, steps: 15 },
  { id: "21:9-2k", label: "21:9 (2K / Landscape)", width: 3024, height: 1296, steps: 15 },
  { id: "21:9-4k", label: "21:9 (4K / Landscape)", width: 5120, height: 2194, steps: 15 },
  { id: "3:4-2k", label: "3:4 (2K / Portrait)", width: 1728, height: 2304, steps: 15 },
  { id: "3:4-4k", label: "3:4 (4K / Portrait)", width: 3072, height: 4096, steps: 15 },
  { id: "9:16-2k", label: "9:16 (2K / Portrait)", width: 1440, height: 2560, steps: 15 },
  { id: "9:16-4k", label: "9:16 (4K / Portrait)", width: 2880, height: 5120, steps: 15 },
  { id: "2:3-2k", label: "2:3 (2K / Portrait)", width: 1664, height: 2496, steps: 15 },
  { id: "2:3-4k", label: "2:3 (4K / Portrait)", width: 2730, height: 4096, steps: 15 },
];

const IDEOGRAM_QUALITY_SETTINGS = [
  { id: "1:1", label: "1:1 (Square)", width: 1024, height: 1024, steps: 15 },
  { id: "21:10", label: "21:10 (Ultra-Wide / Landscape)", width: 1600, height: 762, steps: 15 },
  { id: "16:13", label: "16:13 (Wide / Landscape)", width: 1024, height: 832, steps: 15 },
  { id: "4:3", label: "4:3 (Standard / Landscape)", width: 1024, height: 768, steps: 15 },
  { id: "3:2", label: "3:2 (Classic / Landscape)", width: 1536, height: 1024, steps: 15 },
  { id: "2:3", label: "2:3 (Classic / Portrait)", width: 1024, height: 1536, steps: 15 },
  { id: "3:4", label: "3:4 (Standard / Portrait)", width: 768, height: 1024, steps: 15 },
  { id: "13:16", label: "13:16 (Tall / Portrait)", width: 1040, height: 1280, steps: 15 },
  { id: "10:21", label: "10:21 (Ultra-Tall / Portrait)", width: 762, height: 1600, steps: 15 },
];

const GEMINI_QUALITY_SETTINGS = [{ id: "1:1", label: "1:1 (Square)", width: 1024, height: 1024, steps: 15 }];

const QWEN_QUALITY_SETTINGS = [
  { id: "1:1", label: "1:1 (Square)", width: 1024, height: 1024, steps: 15 },
  { id: "16:9", label: "16:9 (Landscape)", width: 1344, height: 768, steps: 15 },
  { id: "3:2", label: "3:2 (Photo)", width: 1024, height: 640, steps: 15 },
];

const MODELS = [
  { id: "openai:1@1", label: "Gpt-Image 1" },
  { id: "ideogram:4@1", label: "Ideogram 3.0" },
  { id: "runware:108@1", label: "Qwen-Image" },
  { id: "bfl:3@1", label: "FLUX.1 Kontext [max]" },
  { id: "google:4@1", label: "Gemini Flash Image 2.5" },
  { id: "bytedance:5@0", label: "Seedream 4.0" },
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

const Image2Page = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [quality, setQuality] = useState(QUALITY_SETTINGS[0].id);
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [magicPromptEnabled, setMagicPromptEnabled] = useState(false);
  const [images, setImages] = useState<DatabaseImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedImageForModal, setSelectedImageForModal] = useState<DatabaseImage | null>(null);
  const [imageToDelete, setImageToDelete] = useState<DatabaseImage | null>(null);
  const isLoadingRef = useRef(false);

  const canAttachImage = useMemo(
    () =>
      model === "openai:1@1" ||
      model === "ideogram:4@1" ||
      model === "bfl:3@1" ||
      model === "google:4@1" ||
      model === "bytedance:5@0",
    [model],
  );

  const availableQualitySettings = useMemo(() => {
    if (model === "bfl:3@1") return KONTEXT_QUALITY_SETTINGS;
    if (model === "ideogram:4@1") return IDEOGRAM_QUALITY_SETTINGS;
    if (model === "google:4@1") return GEMINI_QUALITY_SETTINGS;
    if (model === "bytedance:5@0") return SEEDREAM_QUALITY_SETTINGS;
    if (model === "runware:108@1") return QWEN_QUALITY_SETTINGS;
    return QUALITY_SETTINGS;
  }, [model]);

  useEffect(() => {
    document.title = "Imagem";
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

  useEffect(() => {
    setQuality(availableQualitySettings[0].id);
  }, [model, availableQualitySettings]);

  const selectedQualityInfo = useMemo(
    () => availableQualitySettings.find((q) => q.id === quality)!,
    [quality, availableQualitySettings],
  );

  const loadSavedImages = useCallback(async () => {
    if (!user || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("user_images")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(MAX_IMAGES_TO_FETCH);

      if (error) throw error;

      const uniqueImages = data
        ? data.filter(
            (img, index, self) => index === self.findIndex((t) => t.id === img.id && t.image_path === img.image_path),
          )
        : [];

      setImages(uniqueImages);
    } catch (error) {
      console.error("Erro ao carregar imagens:", error);
    } finally {
      setIsLoadingHistory(false);
      isLoadingRef.current = false;
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
      toast.error("Digite um prompt para gerar a imagem");
      return;
    }
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    setIsGenerating(true);
    try {
      let finalPrompt = prompt;
      if (magicPromptEnabled) {
        try {
          const { data, error } = await supabase.functions.invoke("enhance-prompt", {
            body: { prompt: prompt.trim() },
          });

          if (error) {
            console.error("Error enhancing prompt:", error);
          } else if (data?.enhancedPrompt) {
            finalPrompt = data.enhancedPrompt;
            setPrompt(finalPrompt);
          }
        } catch (error) {
          console.error("Error enhancing prompt:", error);
        }
      }

      let inputImageBase64: string | undefined;
      if (selectedFile) {
        console.log('📸 Tamanho original da imagem:', (selectedFile.size / 1024 / 1024).toFixed(2), 'MB');
        
        // Comprimir agressivamente para evitar payload muito grande
        const options = {
          maxSizeMB: 0.4, // Máximo 400KB (gera ~533KB de base64)
          maxWidthOrHeight: 1536, // Máximo 1536px
          useWebWorker: true,
          fileType: selectedFile.type,
          initialQuality: 0.7, // Reduzir qualidade inicial
        };
        
        try {
          const compressedFile = await imageCompression(selectedFile, options);
          console.log('✅ Tamanho após compressão:', (compressedFile.size / 1024).toFixed(0), 'KB');
          
          const reader = new FileReader();
          reader.readAsDataURL(compressedFile);
          await new Promise<void>((resolve, reject) => {
            reader.onload = () => resolve();
            reader.onerror = (error) => reject(error);
          });
          inputImageBase64 = (reader.result as string).split(",")[1];
          
          const base64SizeKB = (inputImageBase64.length * 0.75 / 1024).toFixed(0);
          console.log('📦 Tamanho do base64:', base64SizeKB, 'KB');
          
          // Validar tamanho final
          if (inputImageBase64.length > 700000) { // ~525KB de base64
            toast.error("Imagem muito grande", {
              description: "A imagem anexada é muito grande. Tente uma imagem menor ou de menor resolução.",
            });
            throw new Error("Payload muito grande");
          }
        } catch (compressionError) {
          console.error('Erro ao comprimir imagem:', compressionError);
          toast.error("Erro ao processar imagem", {
            description: "Não foi possível comprimir a imagem. Tente uma imagem menor.",
          });
          throw compressionError;
        }
      }

      if (inputImageBase64 && canAttachImage) {
        // Decidir qual edge function chamar baseado no modelo
        const edgeFunction = model === "google:4@1" 
          ? "edit-image-nano-banana" 
          : "edit-image";

        const editBody = model === "google:4@1"
          ? {
              prompt: finalPrompt,
              imageBase64: inputImageBase64 // Nano Banana espera campo 'imageBase64'
            }
          : {
              model,
              positivePrompt: finalPrompt,
              inputImage: inputImageBase64, // Runware espera 'inputImage'
              width: selectedQualityInfo.width,
              height: selectedQualityInfo.height,
            };

        const { data: editData, error: editError } = await supabase.functions.invoke(edgeFunction, {
          body: editBody,
        });
        if (editError) {
          console.error("Erro detalhado ao editar imagem:", editError);
          toast.error("Erro ao editar imagem", {
            description: editError.message || "Verifique se a imagem está no formato correto (PNG/JPG/WEBP)",
          });
          throw editError;
        }

        if (!editData?.image) {
          toast.error("Erro ao editar imagem", {
            description: "A API não retornou uma imagem",
          });
          throw new Error("A API não retornou uma imagem.");
        }

        const imageDataURI = editData.image.startsWith("data:")
          ? editData.image
          : `data:image/png;base64,${editData.image}`;
        const imageResponse = await fetch(imageDataURI);
        const imageBlob = await imageResponse.blob();
        const fileName = `user-images/${user.id}/${Date.now()}-${crypto.randomUUID()}.png`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from("images")
          .upload(fileName, imageBlob, { cacheControl: "3600" });

        if (storageError) throw storageError;

        const { data: insertData } = await supabase
          .from("user_images")
          .insert({
            user_id: user.id,
            prompt: finalPrompt,
            image_path: storageData.path,
            width: selectedQualityInfo.width,
            height: selectedQualityInfo.height,
            format: "png",
          })
          .select()
          .single();

        if (insertData) {
          setImages((prev) => [insertData, ...prev].slice(0, MAX_IMAGES_TO_FETCH));
          toast.success("Imagem gerada com sucesso!");
        }
      } else {
        const body: any = {
          model,
          positivePrompt: finalPrompt,
          width: selectedQualityInfo.width,
          height: selectedQualityInfo.height,
          numberResults: numberOfImages,
          outputFormat: "PNG",
          ...(inputImageBase64 ? { inputImage: inputImageBase64 } : {}),
        };

        const { data: apiData, error: apiError } = await supabase.functions.invoke("generate-image", { body });
        if (apiError) {
          toast.error("Erro ao gerar imagem", {
            description: apiError.message || "Ocorreu um erro ao processar a imagem",
          });
          throw apiError;
        }

        if (!apiData?.images || apiData.images.length === 0) {
          toast.error("Erro ao gerar imagem", {
            description: "A API não retornou nenhuma imagem",
          });
          throw new Error("A API não retornou nenhuma imagem.");
        }

        const imageCount = apiData.images.length;
        toast.success(`${imageCount} ${imageCount === 1 ? 'imagem gerada' : 'imagens geradas'} com sucesso!`);
        setTimeout(() => loadSavedImages(), 1000);
      }
    } catch (e: any) {
      console.error("Erro no processo:", e);
      if (!e.message?.includes("não retornou")) {
        toast.error("Erro ao processar imagem", {
          description: e.message || "Ocorreu um erro inesperado",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteImage = useCallback(
    async (imageId: string, imagePath: string) => {
      if (!user) return;

      setImages((prev) => prev.filter((img) => img.id !== imageId));

      try {
        const { error: storageError } = await supabase.storage.from("images").remove([imagePath]);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from("user_images").delete().eq("id", imageId).eq("user_id", user.id);
        if (dbError) throw dbError;

        toast.success("Imagem deletada com sucesso");
      } catch (error) {
        console.error("Erro ao deletar imagem:", error);
        toast.error("Erro ao deletar imagem");
        loadSavedImages();
      }
    },
    [user, loadSavedImages],
  );

  const downloadImage = useCallback(async (image: DatabaseImage) => {
    const { data: publicData } = supabase.storage.from("images").getPublicUrl(image.image_path);
    const imageUrl = publicData.publicUrl;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Falha na resposta da rede");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `synergy-ai-${image.id}.${image.format || "png"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(objectUrl);
      toast.success("Download iniciado");
    } catch (error) {
      console.error("Erro ao baixar a imagem:", error);
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  }, []);

  const shareImage = async (image: DatabaseImage) => {
    const { data: publicData } = supabase.storage.from("images").getPublicUrl(image.image_path);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Imagem gerada por IA",
          text: image.prompt || "Confira esta imagem gerada por IA",
          url: publicData.publicUrl,
        });
      } catch (error) {
        console.log("Erro ao compartilhar:", error);
      }
    } else {
      await navigator.clipboard.writeText(publicData.publicUrl);
      toast.success("Link copiado para a área de transferência");
    }
  };

  const getImageUrl = (image: DatabaseImage) => {
    const { data: publicData } = supabase.storage.from("images").getPublicUrl(image.image_path);
    return publicData.publicUrl;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header Minimalista */}
      <header className="border-b p-4 sticky top-0 bg-background/95 backdrop-blur z-20">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-purple-500" />
              </div>
              <h1 className="text-xl font-bold">Imagem</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <UserProfile />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Grid de Imagens */}
      <main className="flex-1 overflow-auto p-4 pb-48">
        <div className="container mx-auto max-w-7xl">
          {isLoadingHistory ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="aspect-square animate-pulse bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {images.map((img) => (
                <Card
                  key={img.id}
                  className="relative aspect-square overflow-hidden group cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => setSelectedImageForModal(img)}
                >
                  <img
                    src={getImageUrl(img)}
                    alt={img.prompt || "Generated image"}
                    className="w-full h-full object-cover"
                  />

                  {/* Overlay no hover */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <p className="text-white text-sm mb-3 line-clamp-2">{img.prompt}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(img);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          shareImage(img);
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageToDelete(img);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Chat Bar Fixo (bottom) - Estilo Higgsfield */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur border-t border-white/10 shadow-2xl z-20">
        <div className="container mx-auto max-w-7xl p-4">
          {/* Preview de arquivo anexado */}
          {previewUrl && (
            <div className="mb-3 flex items-center gap-2 p-2 bg-white/10 rounded-lg">
              <img src={previewUrl} alt="Preview" className="h-12 w-12 object-cover rounded" />
              <p className="text-white text-sm flex-1 truncate">{selectedFile?.name}</p>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:text-white/80"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row items-end gap-3">
            {/* Textarea */}
            <div className="flex-1 w-full">
              <Textarea
                placeholder="Describe the scene you imagine"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={1}
                className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10 focus:border-white/20 min-h-[44px]"
                disabled={isGenerating}
              />
            </div>

            {/* Controles Inline - Estilo Higgsfield */}
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 w-full lg:w-auto">
              {/* Modelo */}
              <Select value={model} onValueChange={setModel} disabled={isGenerating}>
                <SelectTrigger className="w-full lg:w-36 bg-white/5 border-white/10 text-white hover:bg-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-white/20">
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-white hover:bg-white/10">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Qualidade */}
              <Select value={quality} onValueChange={setQuality} disabled={isGenerating}>
                <SelectTrigger className="w-full lg:w-40 bg-white/5 border-white/10 text-white hover:bg-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-white/20">
                  {availableQualitySettings.map((q) => (
                    <SelectItem key={q.id} value={q.id} className="text-white hover:bg-white/10">
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Quantidade de Imagens */}
              <Select 
                value={numberOfImages.toString()} 
                onValueChange={(value) => setNumberOfImages(parseInt(value))} 
                disabled={isGenerating}
              >
                <SelectTrigger className="w-full lg:w-24 bg-white/5 border-white/10 text-white hover:bg-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-white/20">
                  <SelectItem value="1" className="text-white hover:bg-white/10">1x</SelectItem>
                  <SelectItem value="2" className="text-white hover:bg-white/10">2x</SelectItem>
                  <SelectItem value="3" className="text-white hover:bg-white/10">3x</SelectItem>
                  <SelectItem value="4" className="text-white hover:bg-white/10">4x</SelectItem>
                </SelectContent>
              </Select>

              {/* Anexar arquivo */}
              <Button
                variant="outline"
                size="icon"
                disabled={!canAttachImage || isGenerating}
                onClick={() => document.getElementById("file-input")?.click()}
                title={canAttachImage ? "Anexar imagem" : "Modelo não suporta anexo"}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

              {/* Magic Prompt */}
              <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-white/5 border border-white/10">
                <Switch checked={magicPromptEnabled} onCheckedChange={setMagicPromptEnabled} disabled={isGenerating} />
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </div>

              {/* Botão Gerar - Estilo Neon */}
              <Button
                onClick={generate}
                disabled={isGenerating || !prompt.trim()}
                className="bg-[#8C00FF] hover:bg-[#6A42C2] text-white font-bold px-8 h-11 shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/40 transition-all disabled:opacity-50 disabled:shadow-none min-w-[140px]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  `Generate +${numberOfImages}`
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Imagem em Tela Cheia */}
      <Dialog open={!!selectedImageForModal} onOpenChange={() => setSelectedImageForModal(null)}>
        <DialogContent className="max-w-5xl p-0">
          {selectedImageForModal && (
            <div className="relative">
              <img
                src={getImageUrl(selectedImageForModal)}
                alt={selectedImageForModal.prompt || "Generated image"}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 text-white">
                <p className="text-sm">{selectedImageForModal.prompt}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="secondary" onClick={() => downloadImage(selectedImageForModal)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => shareImage(selectedImageForModal)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!imageToDelete} onOpenChange={() => setImageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A imagem será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (imageToDelete) {
                  deleteImage(imageToDelete.id, imageToDelete.image_path);
                  setImageToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Image2Page;
