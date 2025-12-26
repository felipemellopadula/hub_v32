import { useState, useCallback, Suspense, lazy } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Download, Loader2, LogOut, Sparkles, RefreshCw, ChevronLeft, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useButtonDebounce } from "@/hooks/useButtonDebounce";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImageCompareSlider } from "@/components/ImageCompareSlider";
import { cn } from "@/lib/utils";

const UserProfile = lazy(() => import("@/components/UserProfile"));

export default function SkinEnhancer() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { debounce, isDebouncing } = useButtonDebounce(1000);
  
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Skin Enhancer settings
  const [sharpen, setSharpen] = useState([0]);
  const [smartGrain, setSmartGrain] = useState([2]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/home2");
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setEnhancedImage(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleEnhance = async () => {
    if (!originalImage) {
      toast.error("Por favor, faça upload de uma imagem primeiro");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar logado para usar esta função");
      return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("skin-enhancer", {
        body: {
          image: originalImage,
          sharpen: sharpen[0],
          smart_grain: smartGrain[0],
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const imageUrl = response.data?.imageUrl;
      if (imageUrl) {
        setEnhancedImage(imageUrl);
        toast.success("Pele aprimorada com sucesso!");
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (error: any) {
      console.error("Skin enhance error:", error);
      toast.error(error.message || "Erro ao aprimorar pele");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!enhancedImage) return;

    try {
      const response = await fetch(enhancedImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skin-enhanced-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch (error) {
      toast.error("Erro ao baixar imagem");
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setEnhancedImage(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full px-4 sm:px-6 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard-novo")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Link to="/home2" className="flex items-center gap-2">
              <img
                src="/images/logo-light-optimized.webp"
                alt="Logo"
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/images/logo-dark-optimized.webp"
                alt="Logo"
                className="h-8 w-auto hidden dark:block"
              />
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <Suspense fallback={<div className="w-8 h-8 rounded-full bg-muted animate-pulse" />}>
              <UserProfile />
            </Suspense>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4"
          >
            <User className="w-4 h-4" />
            <span className="text-sm font-medium">Skin Enhancer</span>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Aprimore a pele em suas fotos
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Use inteligência artificial para suavizar e aprimorar a pele em retratos, mantendo detalhes naturais
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <Card className="p-6 bg-card border-border/50 h-fit">
            <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Configurações
            </h2>

            <div className="space-y-6">
              {/* Sharpen */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-sm text-muted-foreground">Nitidez</Label>
                  <span className="text-sm text-foreground">{sharpen[0]}</span>
                </div>
                <Slider
                  value={sharpen}
                  onValueChange={setSharpen}
                  max={100}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Aumenta a nitidez dos detalhes da pele
                </p>
              </div>

              {/* Smart Grain */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-sm text-muted-foreground">Granulação Inteligente</Label>
                  <span className="text-sm text-foreground">{smartGrain[0]}</span>
                </div>
                <Slider
                  value={smartGrain}
                  onValueChange={setSmartGrain}
                  max={100}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Adiciona textura natural à pele
                </p>
              </div>

              {/* Enhance Button */}
              <Button
                onClick={() => debounce(handleEnhance)}
                disabled={!originalImage || isLoading || isDebouncing}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Aprimorar Pele
                  </>
                )}
              </Button>

              {originalImage && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nova Imagem
                </Button>
              )}
            </div>
          </Card>

          {/* Image Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload / Original Image */}
            <Card className="p-6 bg-card border-border/50">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                Imagem Original
              </h3>
              
              {!originalImage ? (
                <motion.div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    "relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium mb-1">
                    Arraste uma foto ou clique para selecionar
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Recomendado: Retratos com rostos visíveis
                  </p>
                </motion.div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-muted group">
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-auto max-h-[400px] object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleReset}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Card>

            {/* Image Comparison Slider */}
            <AnimatePresence>
              {(enhancedImage || isLoading) && originalImage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="p-6 bg-card border-border/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Comparação
                      </h3>
                      {enhancedImage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Baixar
                        </Button>
                      )}
                    </div>
                    
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p className="text-muted-foreground">Aprimorando pele com IA...</p>
                        <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
                      </div>
                    ) : enhancedImage ? (
                      <ImageCompareSlider
                        beforeImage={originalImage}
                        afterImage={enhancedImage}
                        beforeLabel="Original"
                        afterLabel="Aprimorada"
                      />
                    ) : null}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
