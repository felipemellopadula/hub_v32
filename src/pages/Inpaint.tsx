import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Paintbrush, 
  Eraser, 
  Hand, 
  Undo2, 
  Redo2, 
  Download, 
  X, 
  Plus, 
  Sparkles,
  Loader2,
  Upload,
  Trash2,
  LogOut
} from "lucide-react";
import { Canvas as FabricCanvas, PencilBrush, FabricImage } from "fabric";

const UserProfile = lazy(() => import("@/components/UserProfile"));

type Tool = "brush" | "eraser" | "hand";

interface ReferenceImage {
  id: string;
  dataUrl: string;
}

const Inpaint = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  
  const [canvasReady, setCanvasReady] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>("brush");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize Fabric canvas - create canvas element dynamically
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    let canvas: FabricCanvas | null = null;
    let canvasElement: HTMLCanvasElement | null = null;
    let resizeHandler: (() => void) | null = null;
    let isDisposed = false;

    const initCanvas = () => {
      if (isDisposed || !container) return;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (containerWidth === 0 || containerHeight === 0) {
        requestAnimationFrame(initCanvas);
        return;
      }

      try {
        // Create canvas element dynamically - React won't manage it
        canvasElement = document.createElement('canvas');
        canvasElement.id = 'inpaint-canvas';
        container.appendChild(canvasElement);

        canvas = new FabricCanvas(canvasElement, {
          width: containerWidth,
          height: containerHeight,
          backgroundColor: "#1a1a1a",
          isDrawingMode: true,
        });

        // Set up brush
        const brush = new PencilBrush(canvas);
        brush.color = "rgba(0, 255, 128, 0.6)";
        brush.width = 20;
        canvas.freeDrawingBrush = brush;

        fabricCanvasRef.current = canvas;
        setCanvasReady(true);

        // Handle resize
        resizeHandler = () => {
          if (canvas && container && !isDisposed) {
            canvas.setDimensions({
              width: container.clientWidth,
              height: container.clientHeight,
            });
            canvas.renderAll();
          }
        };

        window.addEventListener("resize", resizeHandler);
      } catch (err) {
        console.error("Error initializing canvas:", err);
      }
    };

    // Delay initialization slightly to ensure container is ready
    const timer = setTimeout(initCanvas, 50);

    return () => {
      isDisposed = true;
      clearTimeout(timer);
      
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      
      if (canvas) {
        try {
          canvas.dispose();
        } catch (err) {
          console.warn("Canvas dispose error:", err);
        }
      }

      fabricCanvasRef.current = null;
      
      // Remove the canvas element we created
      if (canvasElement && container.contains(canvasElement)) {
        // Fabric.js wraps the canvas, so we need to remove the wrapper
        const wrapper = canvasElement.parentElement;
        if (wrapper && wrapper !== container) {
          try {
            container.removeChild(wrapper);
          } catch (err) {
            console.warn("Wrapper removal error:", err);
          }
        }
      }
    };
  }, []);

  // Update brush settings when tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (activeTool === "brush") {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = "rgba(0, 255, 128, 0.6)";
        canvas.freeDrawingBrush.width = brushSize;
      }
    } else if (activeTool === "eraser") {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = "rgba(0, 0, 0, 1)";
        canvas.freeDrawingBrush.width = brushSize * 2;
      }
    } else if (activeTool === "hand") {
      canvas.isDrawingMode = false;
    }
  }, [activeTool, canvasReady, brushSize]);

  // Load uploaded image onto canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !uploadedImage) {
      console.log("🖼️ Aguardando canvas ou imagem:", { hasCanvas: !!canvas, hasImage: !!uploadedImage });
      return;
    }

    const container = canvasContainerRef.current;
    if (!container) {
      console.log("🖼️ Container não encontrado");
      return;
    }

    console.log("🖼️ Iniciando carregamento da imagem no canvas");

    let attempts = 0;
    const maxAttempts = 20;

    const loadImage = () => {
      attempts++;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      console.log(`🖼️ Tentativa ${attempts}: dimensões do container:`, { containerWidth, containerHeight });

      // Wait for valid dimensions
      if (containerWidth === 0 || containerHeight === 0) {
        if (attempts < maxAttempts) {
          setTimeout(loadImage, 100);
        } else {
          console.error("🖼️ Falha ao obter dimensões do container após várias tentativas");
          toast.error("Erro: não foi possível carregar o canvas");
        }
        return;
      }

      // Update canvas dimensions first
      canvas.setDimensions({
        width: containerWidth,
        height: containerHeight,
      });

      // Create an HTML image element first to ensure the image loads
      const htmlImg = new Image();
      htmlImg.crossOrigin = "anonymous";
      
      htmlImg.onload = () => {
        console.log("🖼️ HTML Image carregada:", { width: htmlImg.width, height: htmlImg.height });
        
        FabricImage.fromURL(uploadedImage, { crossOrigin: "anonymous" })
          .then((img) => {
            console.log("🖼️ FabricImage criada:", { width: img.width, height: img.height });
            
            const scale = Math.min(
              containerWidth / (img.width || 1),
              containerHeight / (img.height || 1)
            ) * 0.9;

            img.scale(scale);
            img.set({
              left: (containerWidth - (img.width || 0) * scale) / 2,
              top: (containerHeight - (img.height || 0) * scale) / 2,
              selectable: false,
              evented: false,
            });

            canvas.clear();
            canvas.backgroundColor = "#1a1a1a";
            canvas.add(img);
            canvas.sendObjectToBack(img);
            canvas.renderAll();

            console.log("🖼️ Imagem adicionada ao canvas com sucesso");
            // Save initial state
            saveToHistory();
          })
          .catch((err) => {
            console.error("🖼️ Erro ao criar FabricImage:", err);
            toast.error("Erro ao carregar imagem no canvas");
          });
      };

      htmlImg.onerror = (err) => {
        console.error("🖼️ Erro ao carregar HTML Image:", err);
        toast.error("Erro ao carregar imagem");
      };

      // Start loading
      htmlImg.src = uploadedImage;
    };

    // Use setTimeout to ensure canvas is fully initialized
    setTimeout(loadImage, 50);
  }, [uploadedImage, canvasReady]);

  const saveToHistory = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON());
    setHistory(prev => [...prev.slice(0, historyIndex + 1), json]);
    setHistoryIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    canvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      canvas.renderAll();
      setHistoryIndex(newIndex);
    });
  };

  const handleRedo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    canvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      canvas.renderAll();
      setHistoryIndex(newIndex);
    });
  };

  const handleClearMask = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    // Remove all paths (drawings), keep background image
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj.type === "path") {
        canvas.remove(obj);
      }
    });
    canvas.renderAll();
    saveToHistory();
    toast.success("Máscara limpa!");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setGeneratedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (referenceImages.length + files.length > 10) {
      toast.error("Máximo de 10 imagens de referência");
      return;
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImages(prev => [
          ...prev,
          { id: crypto.randomUUID(), dataUrl: event.target?.result as string }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeRefImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDeleteImage = () => {
    setUploadedImage(null);
    setGeneratedImage(null);
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = "#1a1a1a";
      canvas.renderAll();
    }
    setHistory([]);
    setHistoryIndex(-1);
  };

  const handleGenerate = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !uploadedImage) {
      toast.error("Por favor, faça upload de uma imagem primeiro");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Por favor, descreva as alterações desejadas");
      return;
    }

    setIsGenerating(true);

    try {
      // Get canvas with mask as data URL
      const canvasDataUrl = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
      });

      // Check if there are any drawn paths (mask)
      const hasDrawnMask = canvas.getObjects().length > 0;

      // Build inpainting-specific prompt that explains the mask to the model
      let inpaintPrompt: string;
      
      if (hasDrawnMask) {
        // User painted areas - explain the mask to the model
        inpaintPrompt = `INPAINTING TASK: In the provided image, there are areas painted with bright green/neon color (semi-transparent green, RGB approximately 0,255,128). These green painted areas are MASKS indicating exactly WHERE you must apply the following edit.

USER'S EDIT REQUEST: "${prompt}"

CRITICAL INSTRUCTIONS:
1. Identify ALL green/neon painted areas in the image - these are the ONLY areas you should modify
2. COMPLETELY REMOVE the green paint/mask color from those areas
3. REPLACE those masked areas with content that matches the user's request: "${prompt}"
4. Keep ALL other parts of the image COMPLETELY UNCHANGED - do not modify anything outside the green masked areas
5. The result should look natural with seamless blending between edited and unedited areas
6. The output image must have NO green mask visible - the mask must be replaced entirely

Generate the edited image now with the green masked areas replaced according to the instructions.`;
      } else {
        // No mask - general edit on entire image
        inpaintPrompt = `Edit this image with the following instruction: ${prompt}. Generate the edited image now.`;
      }

      const { data, error } = await supabase.functions.invoke("edit-image-nano-banana", {
        body: {
          prompt: inpaintPrompt,
          imageBase64: canvasDataUrl,
          referenceImages: referenceImages.map(img => img.dataUrl),
        },
      });

      if (error) throw error;

      if (data.image) {
        setGeneratedImage(`data:image/png;base64,${data.image}`);
        toast.success("Imagem gerada com sucesso!");
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (error: any) {
      console.error("Erro ao gerar:", error);
      toast.error(error.message || "Erro ao gerar imagem");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const imageToDownload = generatedImage || uploadedImage;
    if (!imageToDownload) return;

    const link = document.createElement("a");
    link.download = `inpaint-${Date.now()}.png`;
    link.href = imageToDownload;
    link.click();
    toast.success("Imagem baixada!");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/home2");
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link to="/dashboard-novo" className="text-muted-foreground hover:text-white transition-colors">
            ←
          </Link>
          <span className="text-sm font-medium text-primary">Nano Banana Pro Inpaint</span>
          <span className="text-muted-foreground">›</span>
        </div>
        <div className="flex items-center gap-3">
          {(uploadedImage || generatedImage) && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDownload}
                className="text-muted-foreground hover:text-white"
              >
                <Download className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDeleteImage}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-5 h-5" />
              </Button>
            </>
          )}
          <Suspense fallback={<div className="w-8 h-8 rounded-full bg-muted animate-pulse" />}>
            <UserProfile />
          </Suspense>
          <ThemeToggle />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Toolbar */}
        <div className="w-14 bg-[#111] border-r border-white/10 flex flex-col items-center py-4 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTool("brush")}
            className={`w-10 h-10 ${activeTool === "brush" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}
          >
            <Paintbrush className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTool("eraser")}
            className={`w-10 h-10 ${activeTool === "eraser" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}
          >
            <Eraser className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTool("hand")}
            className={`w-10 h-10 ${activeTool === "hand" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}
          >
            <Hand className="w-5 h-5" />
          </Button>
          
          <div className="w-8 h-px bg-white/10 my-2" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="w-10 h-10 text-muted-foreground hover:text-white disabled:opacity-30"
          >
            <Undo2 className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="w-10 h-10 text-muted-foreground hover:text-white disabled:opacity-30"
          >
            <Redo2 className="w-5 h-5" />
          </Button>
          
          <div className="w-8 h-px bg-white/10 my-2" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearMask}
            className="w-10 h-10 text-muted-foreground hover:text-white"
          >
            <Trash2 className="w-5 h-5" />
          </Button>

          {/* Brush size slider */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="text-xs text-muted-foreground">{brushSize}</span>
            <input
              type="range"
              min="5"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 -rotate-90 origin-center mt-8"
              style={{ width: "80px" }}
            />
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col">
          <div 
            ref={canvasContainerRef}
            className="flex-1 relative bg-[#0d0d0d] overflow-hidden min-h-0"
          >
            {/* Fabric.js canvas is created dynamically inside this container */}
            
            {/* Upload prompt overlay - shown when no image is uploaded */}
            {!uploadedImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#0d0d0d]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 border-dashed border-2 border-white/20 hover:border-primary/50 bg-transparent"
                >
                  <Upload className="w-5 h-5" />
                  Fazer upload de imagem
                </Button>
                <p className="text-muted-foreground text-sm mt-3">
                  Arraste uma imagem ou clique para selecionar
                </p>
              </div>
            )}
            
            {/* Generated image overlay - shown when generation is complete */}
            {generatedImage && (
              <div className="absolute inset-0 flex items-center justify-center p-4 z-20 bg-[#0d0d0d]">
                <img 
                  src={generatedImage} 
                  alt="Resultado" 
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Bottom Input Area */}
          <div className="bg-[#111] border-t border-white/10 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Pinte sobre a área para editar e descreva suas alterações..."
                    className="bg-[#1a1a1a] border-white/10 resize-none h-20 text-white placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={refImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleRefImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refImageInputRef.current?.click()}
                    disabled={referenceImages.length >= 10}
                    className="gap-1 text-xs border-white/20 hover:border-primary/50"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar ref ({referenceImages.length}/10)
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !uploadedImage}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate
                  </Button>
                </div>
              </div>

              {/* Reference Images */}
              {referenceImages.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                  {referenceImages.map((img) => (
                    <div key={img.id} className="relative flex-shrink-0">
                      <img 
                        src={img.dataUrl} 
                        alt="Referência" 
                        className="w-16 h-16 object-cover rounded-lg border border-white/10"
                      />
                      <button
                        onClick={() => removeRefImage(img.id)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inpaint;
