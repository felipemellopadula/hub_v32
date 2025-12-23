import { useState, useRef, useCallback, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload, Download, X, Sparkles, UserCircle, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserProfile from "@/components/UserProfile";
import { ThemeToggle } from "@/components/ThemeToggle";

const AVATAR_STYLES = [
  { id: "professional", label: "Profissional", prompt: "Transform this photo into a professional corporate headshot with studio lighting, clean background, and polished appearance" },
  { id: "artistic", label: "Artístico", prompt: "Transform this photo into an artistic portrait with creative lighting and artistic effects, like an oil painting or digital art" },
  { id: "anime", label: "Anime", prompt: "Transform this photo into a high-quality anime style portrait, with anime aesthetics, big expressive eyes, and clean linework" },
  { id: "3d", label: "3D Cartoon", prompt: "Transform this photo into a 3D Pixar-style cartoon character portrait with soft lighting and vibrant colors" },
  { id: "cyberpunk", label: "Cyberpunk", prompt: "Transform this photo into a cyberpunk style portrait with neon lights, futuristic elements, and high-tech aesthetics" },
  { id: "fantasy", label: "Fantasia", prompt: "Transform this photo into a fantasy portrait, like an epic RPG character with magical elements and dramatic lighting" },
  { id: "watercolor", label: "Aquarela", prompt: "Transform this photo into a beautiful watercolor painting portrait with soft colors and artistic brush strokes" },
  { id: "minimalist", label: "Minimalista", prompt: "Transform this photo into a minimalist vector-style portrait with clean lines and simple colors" },
];

const AIAvatar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("professional");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setGeneratedAvatar(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setUploadedImage(null);
    setGeneratedAvatar(null);
    setCustomPrompt("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleDownload = useCallback(() => {
    const imageToDownload = generatedAvatar || uploadedImage;
    if (!imageToDownload) return;

    const link = document.createElement("a");
    link.href = imageToDownload;
    link.download = `ai-avatar-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Avatar baixado com sucesso!");
  }, [generatedAvatar, uploadedImage]);

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error("Por favor, faça upload de uma foto primeiro");
      return;
    }

    setIsProcessing(true);

    try {
      // Get the base prompt from selected style
      const stylePrompt = AVATAR_STYLES.find(s => s.id === selectedStyle)?.prompt || "";
      const finalPrompt = customPrompt.trim() 
        ? `${stylePrompt}. Additional instructions: ${customPrompt}` 
        : stylePrompt;

      // Extract base64 from data URL
      const base64Image = uploadedImage.split(",")[1] || uploadedImage;

      // Use edit-image with Nano Banana 2 Pro model
      const { data, error } = await supabase.functions.invoke("edit-image", {
        body: {
          model: "google:4@2", // Nano Banana 2 Pro
          positivePrompt: finalPrompt,
          inputImage: base64Image,
          width: 1024,
          height: 1024,
        },
      });

      if (error) throw error;

      if (data?.image) {
        const avatarUrl = `data:image/png;base64,${data.image}`;
        setGeneratedAvatar(avatarUrl);
        toast.success("Avatar gerado com sucesso!");
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (error: any) {
      console.error("Erro ao gerar avatar:", error);
      toast.error(error.message || "Erro ao gerar avatar");
    } finally {
      setIsProcessing(false);
    }
  };

  const displayImage = generatedAvatar || uploadedImage;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard-novo")}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <Link to="/home2" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold">AI Avatar</h1>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {displayImage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveImage}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Remover imagem"
                >
                  <X className="h-5 w-5" />
                </Button>
              </>
            )}
            <Suspense fallback={<div className="h-8 w-8 rounded-full bg-muted animate-pulse" />}>
              <UserProfile />
            </Suspense>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Image Area */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          {displayImage ? (
            <div className="relative">
              <img
                src={displayImage}
                alt="Avatar"
                className="max-w-full max-h-[60vh] lg:max-h-[70vh] object-contain rounded-2xl shadow-2xl"
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Gerando avatar...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="w-full max-w-md aspect-square border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-foreground font-medium">Faça upload de uma foto</p>
                <p className="text-sm text-muted-foreground mt-1">PNG, JPG até 10MB</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls Sidebar */}
        <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-muted/30 p-4 lg:p-6 space-y-6 overflow-y-auto">
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Estilo do Avatar
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {AVATAR_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    selectedStyle === style.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-background hover:bg-muted border border-border"
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              Personalização (opcional)
            </h3>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Adicione detalhes extras... Ex: fundo azul, olhos verdes, cabelo curto"
              className="resize-none h-24"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!uploadedImage || isProcessing}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Gerar Avatar
              </>
            )}
          </Button>

          {generatedAvatar && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground text-center">
                Não gostou? Ajuste o estilo ou adicione detalhes e gere novamente!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default AIAvatar;
