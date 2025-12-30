import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Download,
  Image as ImageIcon,
  Share2,
  ZoomIn,
  Loader2,
  X,
  ArrowLeft,
  Trash2,
  Wand2,
  Maximize2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import UserProfile from "@/components/UserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiCache } from "@/utils/apiCache";
import { useDebounce } from "@/hooks/useDebounce";
import imageCompression from "browser-image-compression";

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

const ImagePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [quality, setQuality] = useState(QUALITY_SETTINGS[0].id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [magicPromptEnabled, setMagicPromptEnabled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [images, setImages] = useState<DatabaseImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleModalOpen, setUpscaleModalOpen] = useState(false);
  const [upscaleFactor, setUpscaleFactor] = useState<number>(4);
  const [upscaleFormat, setUpscaleFormat] = useState<string>("WEBP");

  // Estados para upscale standalone
  const [uploadedImageForUpscale, setUploadedImageForUpscale] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [upscaledResult, setUpscaledResult] = useState<string | null>(null);
  const [isUpscalingStandalone, setIsUpscalingStandalone] = useState(false);

  // Ref para prevenir carregamentos simultâneos
  const isLoadingRef = useRef(false);

  // ✅ OTIMIZAÇÃO: Debounce do prompt para Magic Prompt
  const debouncedPrompt = useDebounce(prompt, 1500);

  // Habilita anexo para GPT, Ideogram, Kontext, Gemini-Flash e Seedream
  const canAttachImage = useMemo(
    () =>
      model === "openai:1@1" ||
      model === "ideogram:4@1" ||
      model === "bfl:3@1" ||
      model === "google:4@1" ||
      model === "bytedance:5@0",
    [model],
  );

  // Seleciona as configurações de qualidade baseado no modelo
  const availableQualitySettings = useMemo(() => {
    if (model === "bfl:3@1") return KONTEXT_QUALITY_SETTINGS;
    if (model === "ideogram:4@1") return IDEOGRAM_QUALITY_SETTINGS;
    if (model === "google:4@1") return GEMINI_QUALITY_SETTINGS;
    if (model === "bytedance:5@0") return SEEDREAM_QUALITY_SETTINGS;
    if (model === "runware:108@1") return QWEN_QUALITY_SETTINGS;
    return QUALITY_SETTINGS;
  }, [model]);

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

  // Cleanup para preview de upscale
  useEffect(() => {
    return () => {
      if (uploadedImagePreview) URL.revokeObjectURL(uploadedImagePreview);
    };
  }, [uploadedImagePreview]);

  useEffect(() => {
    if (!canAttachImage && selectedFile) {
      setSelectedFile(null);
    }
  }, [canAttachImage, selectedFile]);

  // Reset quality when model changes
  useEffect(() => {
    setQuality(availableQualitySettings[0].id);
  }, [model, availableQualitySettings]);

  const selectedQualityInfo = useMemo(
    () => availableQualitySettings.find((q) => q.id === quality)!,
    [quality, availableQualitySettings],
  );

  // ✅ OTIMIZAÇÃO: Magic Prompt automático com debounce e cache
  useEffect(() => {
    // Somente se Magic Prompt estiver ativo E prompt tiver mais de 15 chars
    if (magicPromptEnabled && debouncedPrompt.trim().length > 15 && !isGenerating) {
      const enhancePrompt = async () => {
        const cacheKey = `magic-prompt:${debouncedPrompt.trim().slice(0, 50)}`;
        const cachedPrompt = apiCache.get<string>(cacheKey);
        
        if (cachedPrompt) {
          console.log('[Cache HIT] Magic Prompt cacheado');
          if (cachedPrompt !== prompt) {
            setPrompt(cachedPrompt);
          }
          return;
        }
        
        setIsEnhancingPrompt(true);
        try {
          const { data, error } = await supabase.functions.invoke("enhance-prompt", {
            body: { prompt: debouncedPrompt.trim() },
          });
          
          if (error) {
            console.error("Error enhancing prompt:", error);
          } else if (data?.enhancedPrompt) {
            apiCache.set(cacheKey, data.enhancedPrompt, 30 * 60 * 1000); // Cache de 30min
            console.log('[Cache SET] Magic Prompt armazenado');
            setPrompt(data.enhancedPrompt);
          }
        } catch (error) {
          console.error("Error enhancing prompt:", error);
        } finally {
          setIsEnhancingPrompt(false);
        }
      };
      
      enhancePrompt();
    }
  }, [debouncedPrompt, magicPromptEnabled, isGenerating]);

  // Carrega imagens salvas
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

      // Deduplicação robusta por ID e image_path
      const uniqueImages = data ? data.filter((img, index, self) => 
        index === self.findIndex((t) => 
          t.id === img.id && t.image_path === img.image_path
        )
      ) : [];

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

  // Handler para upload de imagem para upscale
  const handleUpscaleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedImageForUpscale(file);
      setUploadedImagePreview(URL.createObjectURL(file));
      setUpscaledResult(null);
    }
  };

  // Handler para drag and drop de upscale
  const handleUpscaleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        setUploadedImageForUpscale(file);
        setUploadedImagePreview(URL.createObjectURL(file));
        setUpscaledResult(null);
      }
    }
  };

  // Handler para aplicar upscale 2x
  const handleStandaloneUpscale = async () => {
    if (!uploadedImageForUpscale) {
      return;
    }

    setIsUpscalingStandalone(true);

    try {
      // Converter imagem para base64 e extrair apenas a parte base64
      const reader = new FileReader();
      const base64ImagePromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          // Extrair apenas a parte base64 (após a vírgula)
          if (dataUrl && dataUrl.includes(",")) {
            const base64Part = dataUrl.split(",")[1];
            resolve(base64Part);
          } else {
            reject(new Error("Falha ao ler a imagem como Data URL."));
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(uploadedImageForUpscale);
      });

      const base64Image = await base64ImagePromise;

      const { data, error } = await supabase.functions.invoke("upscale-image", {
        body: {
          inputImage: base64Image,
          upscaleFactor: 2,
          outputFormat: "WEBP",
        },
      });

      if (error) throw error;

      setUpscaledResult(data.imageUrl);
    } catch (error: any) {
      console.error("Erro ao fazer upscale:", error);
    } finally {
      setIsUpscalingStandalone(false);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) {
      return;
    }
    if (!user) {
      return;
    }

    setIsGenerating(true);
    try {
      // Usa o prompt já otimizado pelo Magic Prompt (se estava ativo)
      const finalPrompt = prompt;

      let inputImageBase64: string | undefined;
      if (selectedFile) {
        let fileToProcess = selectedFile;
        
        // ✅ OTIMIZAÇÃO: Comprimir imagem se > 1MB
        if (selectedFile.size > 1 * 1024 * 1024) {
          try {
            console.log(`[Image] Comprimindo: ${selectedFile.size} bytes`);
            fileToProcess = await imageCompression(selectedFile, {
              maxSizeMB: 2,
              maxWidthOrHeight: 2048,
              useWebWorker: true,
              fileType: selectedFile.type.includes('png') ? 'image/png' : 'image/jpeg'
            });
            console.log(`[Image] Comprimido para: ${fileToProcess.size} bytes`);
          } catch (err) {
            console.error('Erro ao comprimir:', err);
            // ✅ FALLBACK: continua com arquivo original
            fileToProcess = selectedFile;
          }
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(fileToProcess);
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => resolve();
          reader.onerror = (error) => reject(error);
        });
        inputImageBase64 = (reader.result as string).split(",")[1];
      }

      // Se há uma imagem anexada, usa a edge function de edição Runware para todos os modelos
      if (inputImageBase64 && canAttachImage) {
        const editBody = {
          model,
          positivePrompt: finalPrompt,
          inputImage: inputImageBase64,
          width: selectedQualityInfo.width,
          height: selectedQualityInfo.height,
        };

        const { data: editData, error: editError } = await supabase.functions.invoke("edit-image", { body: editBody });
        if (editError) {
          toast.error("Erro ao editar imagem", {
            description: editError.message || "Ocorreu um erro ao processar a imagem"
          });
          throw editError;
        }

        if (!editData?.image) {
          toast.error("Erro ao editar imagem", {
            description: "A API não retornou uma imagem"
          });
          throw new Error("A API não retornou uma imagem.");
        }

        // Salvar a imagem editada no banco
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

        const { data: insertData } = await supabase.from("user_images").insert({
          user_id: user.id,
          prompt: finalPrompt,
          image_path: storageData.path,
          width: selectedQualityInfo.width,
          height: selectedQualityInfo.height,
          format: "png",
        }).select().single();

        // Optimistic update: adiciona imagem diretamente ao estado
        if (insertData) {
          setImages(prev => [insertData, ...prev].slice(0, MAX_IMAGES_TO_FETCH));
          toast.success("Imagem gerada com sucesso!");
        }
      } else {
        // Geração normal sem edição - todos os modelos usam Runware
        const body: any = {
            model,
            positivePrompt: finalPrompt,
            width: selectedQualityInfo.width,
            height: selectedQualityInfo.height,
            numberResults: 1,
            outputFormat: "PNG",
            ...(inputImageBase64 ? { inputImage: inputImageBase64 } : {}),
          };

          const { data: apiData, error: apiError } = await supabase.functions.invoke("generate-image", { body });
          if (apiError) {
            toast.error("Erro ao gerar imagem", {
              description: apiError.message || "Ocorreu um erro ao processar a imagem"
            });
            throw apiError;
          }

          if (!apiData?.image) {
            toast.error("Erro ao gerar imagem", {
              description: "A API não retornou uma imagem"
            });
            throw new Error("A API não retornou uma imagem.");
          }

          toast.success("Imagem gerada com sucesso!");
          // ✅ OTIMIZAÇÃO: Removido polling desnecessário
          // Optimistic update já mostra a imagem, edge function já salvou no banco
        }
    } catch (e: any) {
      console.error("Erro no processo:", e);
      if (!e.message?.includes("não retornou")) {
        toast.error("Erro ao processar imagem", {
          description: e.message || "Ocorreu um erro inesperado"
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Esta função não é mais necessária pois o Edge Function já salva as imagens
  // Mantendo aqui caso seja necessária para outras funcionalidades futuras
  /*
    const saveImageToDatabase = useCallback(async (
        imageBase64: string, 
        format: string, 
        promptText: string, 
        qualityInfo: { width: number; height: number }
    ) => {
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
            
            const { data: insertedData, error: dbError } = await supabase
                .from('user_images')
                .insert({
                    user_id: user.id,
                    prompt: promptText,
                    image_path: storageData.path,
                    width: qualityInfo.width,
                    height: qualityInfo.height,
                    format,
                })
                .select()
                .single();
            
            if (dbError) throw dbError;
            
            // Adicionar a nova imagem diretamente ao estado em vez de recarregar tudo
            if (insertedData) {
                setImages(prev => {
                    // Verificar se a imagem já existe (por path ou ID) para evitar duplicatas
                    const exists = prev.some(img => 
                        img.id === insertedData.id || 
                        img.image_path === insertedData.image_path
                    );
                    if (exists) return prev;
                    
                    // Adicionar no início da lista e limitar a MAX_IMAGES_TO_FETCH
                    return [insertedData, ...prev].slice(0, MAX_IMAGES_TO_FETCH);
                });
            }
        } catch (error) {
            console.error("Erro ao salvar imagem:", error);
        }
    }, [user]); // Só depende do user, evita recriação desnecessária
    */

  // Deletar imagem
  const deleteImage = useCallback(
    async (imageId: string, imagePath: string) => {
      if (!user) return;

      // Otimistic update
      setImages((prev) => prev.filter((img) => img.id !== imageId));

      try {
        // Deletar do storage
        const { error: storageError } = await supabase.storage.from("images").remove([imagePath]);

        if (storageError) throw storageError;

        // Deletar do database
        const { error: dbError } = await supabase.from("user_images").delete().eq("id", imageId).eq("user_id", user.id);

        if (dbError) throw dbError;
      } catch (error) {
        console.error("Erro ao deletar imagem:", error);
        // Reverter otimistic update em caso de erro
        loadSavedImages();
      }
    },
    [user, loadSavedImages],
  );

  // --- ALTERAÇÃO AQUI ---: Lógica de download corrigida para funcionar com cross-origin.
  const downloadImage = useCallback(
    async (image: DatabaseImage) => {
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
      } catch (error) {
        console.error("Erro ao baixar a imagem:", error);
        window.open(imageUrl, "_blank", "noopener,noreferrer");
      }
    },
    [],
  );

  const handleUpscale = async () => {
    if (!images[0]) return;

    setIsUpscaling(true);
    setUpscaleModalOpen(false);

    try {
      const imageUrl = getImageUrl(images[0]);

      const { data, error } = await supabase.functions.invoke("upscale-image", {
        body: {
          inputImage: imageUrl,
          upscaleFactor: upscaleFactor,
          outputFormat: upscaleFormat,
        },
      });

      if (error) throw error;

      // Recarregar imagens para mostrar a nova imagem upscalada
      await loadSavedImages();
    } catch (error) {
      console.error("Erro ao fazer upscale:", error);
    } finally {
      setIsUpscaling(false);
    }
  };

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
    }
  };

  const getImageUrl = (image: DatabaseImage) => {
    const { data: publicData } = supabase.storage.from("images").getPublicUrl(image.image_path);
    return publicData.publicUrl;
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsEnhancingPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-prompt", {
        body: { prompt: prompt.trim() },
      });

      if (error) throw error;

      setPrompt(data.enhancedPrompt);
    } catch (error) {
      console.error("Error enhancing prompt:", error);
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Drag and drop handlers for image attachment
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (canAttachImage) {
        setIsDragging(true);
      }
    },
    [canAttachImage],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!canAttachImage) {
        return;
      }

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          setSelectedFile(file);
        }
      }
    },
    [canAttachImage],
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden" role="main">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 w-full">
        <div className="container mx-auto px-4 pt-1 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 hover:bg-muted"
            >
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
            
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 overflow-x-hidden">
        <section className="max-w-7xl mx-auto mb-6 w-full">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end w-full">
                <div className="md:col-span-7 space-y-2">
                  <Label htmlFor="prompt">Descreva o que você quer ver</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Ex: retrato fotorealista de um astronauta..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-primary" />
                      <Label htmlFor="magic-prompt-toggle" className="cursor-pointer">
                        ✨ Magic Prompt
                      </Label>
                    </div>
                    <Switch
                      id="magic-prompt-toggle"
                      checked={magicPromptEnabled}
                      onCheckedChange={setMagicPromptEnabled}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Modelo</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>
                    {model === "bfl:3@1" || model === "ideogram:4@1" || model === "bytedance:5@0"
                      ? "Formato"
                      : "Qualidade"}
                  </Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableQualitySettings.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.label}
                        </SelectItem>
                      ))}
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
                          <p>
                            Disponível nos modelos GPT-Image 1, Ideogram 3.0, FLUX.1 Kontext, Gemini Flash e Seedream
                            4.0
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Label
                      htmlFor="file-upload"
                      aria-disabled={!canAttachImage}
                      onDragEnter={handleDragEnter}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`mt-2 flex h-10 w-full items-center justify-center rounded-md border px-3 py-2 text-sm ring-offset-background cursor-pointer transition-all ${
                        isDragging
                          ? "border-primary bg-primary/10 text-primary scale-105"
                          : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {isDragging ? "Solte aqui" : "Imagem"}
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
                  {isGenerating ? "Gerando..." : "Gerar Imagem"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* NOVA SEÇÃO: Upscale de Imagens 2x */}
        <section className="max-w-7xl mx-auto mb-6 w-full">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Maximize2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Upscale de Imagem 2x</h2>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Faça upload de qualquer imagem e amplie ela 2x mantendo a qualidade usando IA.
              </p>

              {/* Área de Upload */}
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={handleUpscaleDrop}
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-105"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                }`}
                onClick={() => document.getElementById("upscale-file-input")?.click()}
              >
                <Input
                  id="upscale-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleUpscaleFileChange}
                  className="sr-only"
                />

                {uploadedImagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={uploadedImagePreview}
                      alt="Preview da imagem para upscale"
                      className="max-h-40 mx-auto rounded-lg shadow-md"
                    />
                    <div className="flex gap-2 justify-center">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedImageForUpscale(null);
                          setUploadedImagePreview(null);
                          setUpscaledResult(null);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Remover</span>
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStandaloneUpscale();
                        }}
                        disabled={isUpscalingStandalone}
                        size="sm"
                      >
                        {isUpscalingStandalone ? (
                          <>
                            <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                            <span className="hidden sm:inline">Processando...</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Aplicar Upscale 2x</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-base font-medium">Arraste uma imagem aqui</p>
                      <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              {/* Resultado do Upscale */}
              {upscaledResult && (
                <div className="mt-6 p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Resultado (2x maior)</h3>
                    <Button
                      onClick={async () => {
                        try {
                          // Buscar a imagem da URL
                          const response = await fetch(upscaledResult);
                          const blob = await response.blob();

                          // Criar URL do blob e fazer download
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `upscale-2x-${Date.now()}.webp`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error("Erro ao baixar imagem:", error);
                        }
                      }}
                      variant="default"
                    >
                      <Download className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Baixar Imagem Ampliada</span>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ✓ Imagem ampliada com sucesso! Clique no botão ao lado para fazer o download.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <Card className="w-full rounded-lg sm:aspect-square flex flex-col items-center justify-center overflow-hidden relative bg-muted">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-4 text-muted-foreground aspect-square w-full justify-center">
                  <Loader2 className="h-10 w-10 animate-spin" />
                  <span className="text-lg font-medium">Processando...</span>
                </div>
              ) : images.length > 0 ? (
                <div className="w-full">
                  <div className="aspect-square relative cursor-pointer" onClick={() => setIsImageModalOpen(true)}>
                    <img
                      src={getImageUrl(images[0])}
                      alt={`Imagem gerada: ${images[0].prompt}`}
                      className="w-full h-full object-cover hover:opacity-95 transition-opacity"
                      loading="eager"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent hidden sm:flex items-center justify-between gap-2">
                      <p className="text-white text-sm truncate flex-1 mr-2">{images[0].prompt}</p>
                      <div className="flex gap-2">
                        {/* --- ALTERAÇÃO AQUI ---: Adicionado e.stopPropagation() para evitar que o modal abra ao clicar nos botões */}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(images[0]);
                          }}
                          className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            shareImage(images[0]);
                          }}
                          className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteImage(images[0].id, images[0].image_path);
                          }}
                          className="bg-red-500/20 hover:bg-red-500/30 text-white border-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsImageModalOpen(true);
                          }}
                          className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 sm:hidden">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(images[0]);
                          }}
                          className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            shareImage(images[0]);
                          }}
                          className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteImage(images[0].id, images[0].image_path);
                          }}
                          className="bg-red-500/20 hover:bg-red-500/30 text-white border-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsImageModalOpen(true);
                          }}
                          className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Dialog open={upscaleModalOpen} onOpenChange={setUpscaleModalOpen}>
                          <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                              disabled={isUpscaling}
                            >
                              {isUpscaling ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Maximize2 className="h-4 w-4" />
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <div className="space-y-4">
                              <div>
                                <h3 className="text-lg font-semibold mb-2">Upscale de Imagem</h3>
                                <p className="text-sm text-muted-foreground">Amplie sua imagem mantendo a qualidade</p>
                              </div>

                              <div className="space-y-2">
                                <Label>Fator de Ampliação</Label>
                                <Select
                                  value={upscaleFactor.toString()}
                                  onValueChange={(v) => setUpscaleFactor(Number(v))}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="2">2x - Dobro do tamanho</SelectItem>
                                    <SelectItem value="4">4x - Quatro vezes maior (Recomendado)</SelectItem>
                                    <SelectItem value="8">8x - Oito vezes maior</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Formato de Saída</Label>
                                <Select value={upscaleFormat} onValueChange={setUpscaleFormat}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="WEBP">WEBP (Menor tamanho)</SelectItem>
                                    <SelectItem value="PNG">PNG (Alta qualidade)</SelectItem>
                                    <SelectItem value="JPEG">JPEG (Compatível)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {images[0] && (
                                <div className="p-3 bg-muted rounded-lg space-y-1">
                                  <p className="text-xs text-muted-foreground">Resolução Atual</p>
                                  <p className="text-sm font-medium">
                                    {images[0].width || 1024} x {images[0].height || 1024}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2">Resolução Final (estimada)</p>
                                  <p className="text-sm font-medium text-primary">
                                    {(images[0].width || 1024) * upscaleFactor} x{" "}
                                    {(images[0].height || 1024) * upscaleFactor}
                                  </p>
                                </div>
                              )}

                              <Button onClick={handleUpscale} className="w-full" disabled={isUpscaling}>
                                {isUpscaling ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Processando...
                                  </>
                                ) : (
                                  <>
                                    <Maximize2 className="h-4 w-4 mr-2" />
                                    Aplicar Upscale
                                  </>
                                )}
                              </Button>

                              <p className="text-xs text-center text-muted-foreground">
                                Custo estimado: ~$0.002 por imagem
                              </p>
                            </div>
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

            {/* Modal de ampliação da imagem principal */}
            <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
              <DialogContent className="max-w-[95vw] md:max-w-7xl max-h-[90vh] p-2">
                <div className="relative">
                  <img
                    src={images.length > 0 ? getImageUrl(images[0]) : ""}
                    alt={images.length > 0 ? `Imagem gerada: ${images[0].prompt}` : ""}
                    className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                  />
                  {images.length > 0 && (
                    <div className="absolute bottom-4 right-4">
                      <Button
                        size="lg"
                        onClick={() => downloadImage(images[0])}
                        className="bg-primary/90 hover:bg-primary shadow-lg"
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
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
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                              <img
                                src={getImageUrl(img)}
                                alt={`Miniatura: ${img.prompt}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] md:max-w-7xl max-h-[90vh] p-2">
                            <div className="relative">
                              <img
                                src={getImageUrl(img)}
                                alt={`Imagem gerada: ${img.prompt}`}
                                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                              />
                              <div className="absolute bottom-4 right-4">
                                <Button
                                  size="lg"
                                  onClick={() => downloadImage(img)}
                                  className="bg-primary/90 hover:bg-primary shadow-lg"
                                >
                                  <Download className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">{img.prompt}</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            {new Date(img.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => downloadImage(img)} className="h-7 px-2">
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => shareImage(img)} className="h-7 px-2">
                              <Share2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteImage(img.id, img.image_path)}
                              className="h-7 px-2 text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
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
