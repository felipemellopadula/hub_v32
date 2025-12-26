import { useState, useRef, useCallback, Suspense, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload, Download, X, Sparkles, UserCircle, Wand2, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useButtonDebounce } from "@/hooks/useButtonDebounce";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserProfile from "@/components/UserProfile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SavedAvatar {
  id: string;
  image_path: string;
  style: string | null;
  prompt: string | null;
  created_at: string;
}

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
  const { debounce, isDebouncing } = useButtonDebounce(1500);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("professional");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedAvatars, setSavedAvatars] = useState<SavedAvatar[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved avatars
  useEffect(() => {
    if (user) {
      loadSavedAvatars();
    } else {
      setSavedAvatars([]);
      setIsLoadingAvatars(false);
    }
  }, [user]);

  const loadSavedAvatars = async () => {
    if (!user) return;
    
    setIsLoadingAvatars(true);
    try {
      const { data, error } = await supabase
        .from("user_avatars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedAvatars(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar avatares:", error);
    } finally {
      setIsLoadingAvatars(false);
    }
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

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

  const saveAvatarToStorage = async (base64Image: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Convert base64 to blob
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "image/png" });

      // Upload to storage
      const fileName = `${user.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Erro ao salvar no storage:", error);
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error("Por favor, faça upload de uma foto primeiro");
      return;
    }

    setIsProcessing(true);

    try {
      const stylePrompt = AVATAR_STYLES.find(s => s.id === selectedStyle)?.prompt || "";
      const finalPrompt = customPrompt.trim() 
        ? `${stylePrompt}. Additional instructions: ${customPrompt}` 
        : stylePrompt;

      const base64Image = uploadedImage.split(",")[1] || uploadedImage;

      const { data, error } = await supabase.functions.invoke("edit-image", {
        body: {
          model: "google:4@2",
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

        // Auto-save if user is logged in
        if (user) {
          setIsSaving(true);
          const storedUrl = await saveAvatarToStorage(avatarUrl);
          if (storedUrl) {
            const { error: insertError } = await supabase
              .from("user_avatars")
              .insert({
                user_id: user.id,
                image_path: storedUrl,
                style: selectedStyle,
                prompt: customPrompt || null,
              });

            if (!insertError) {
              loadSavedAvatars();
              toast.success("Avatar salvo na galeria!");
            }
          }
          setIsSaving(false);
        }
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

  const handleDeleteAvatar = async (avatarId: string, imagePath: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from("user_avatars")
        .delete()
        .eq("id", avatarId);

      if (error) throw error;

      // Try to delete from storage
      const pathMatch = imagePath.match(/images\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from("images").remove([pathMatch[1]]);
      }

      setSavedAvatars(prev => prev.filter(a => a.id !== avatarId));
      toast.success("Avatar removido!");
    } catch (error: any) {
      console.error("Erro ao deletar avatar:", error);
      toast.error("Erro ao remover avatar");
    }
  };

  const handleSelectSavedAvatar = (avatar: SavedAvatar) => {
    setGeneratedAvatar(avatar.image_path);
    if (avatar.style) {
      setSelectedStyle(avatar.style);
    }
    if (avatar.prompt) {
      setCustomPrompt(avatar.prompt);
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
              {(isProcessing || isSaving) && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      {isSaving ? "Salvando..." : "Gerando avatar..."}
                    </p>
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
        <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-muted/30 flex flex-col max-h-[calc(100vh-65px)]">
          <ScrollArea className="flex-1">
            <div className="p-4 lg:p-6 space-y-6">
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
                onClick={() => debounce(handleGenerate)}
                disabled={!uploadedImage || isProcessing || isDebouncing}
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

              {/* Gallery Section */}
              {user && (
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Meus Avatares ({savedAvatars.length})
                  </h3>
                  
                  {isLoadingAvatars ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : savedAvatars.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum avatar salvo ainda
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {savedAvatars.map((avatar) => (
                        <div
                          key={avatar.id}
                          className="relative group aspect-square rounded-lg overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors"
                          onClick={() => handleSelectSavedAvatar(avatar)}
                        >
                          <img
                            src={avatar.image_path}
                            alt="Saved avatar"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAvatar(avatar.id, avatar.image_path);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {avatar.style && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 px-2 truncate">
                              {AVATAR_STYLES.find(s => s.id === avatar.style)?.label || avatar.style}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!user && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground text-center">
                    Faça login para salvar seus avatares
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
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
