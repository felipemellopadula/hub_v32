import { useState, useCallback, Suspense, lazy } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Download, Loader2, LogOut, ZoomIn, Image as ImageIcon, Sparkles, RefreshCw, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImageCompareSlider } from "@/components/ImageCompareSlider";
import { cn } from "@/lib/utils";

const UserProfile = lazy(() => import("@/components/UserProfile"));

type Provider = "magnific" | "runware";

export default function Upscale() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Provider selection
  const [provider, setProvider] = useState<Provider>("magnific");
  
  // Common settings
  const [scaleFactor, setScaleFactor] = useState("2");
  
  // Magnific (Freepik) settings
  const [flavor, setFlavor] = useState("photo");
  const [ultraDetail, setUltraDetail] = useState([30]);
  const [sharpen, setSharpen] = useState([7]);
  const [smartGrain, setSmartGrain] = useState([7]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setUpscaledImage(null);
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

  const handleUpscaleMagnific = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar logado para usar esta função");
      return null;
    }

    const response = await supabase.functions.invoke("freepik-upscale", {
      body: {
        image: originalImage,
        scale_factor: parseInt(scaleFactor),
        flavor,
        ultra_detail: ultraDetail[0],
        sharpen: sharpen[0],
        smart_grain: smartGrain[0],
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data?.imageUrl;
  };

  const handleUpscaleRunware = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar logado para usar esta função");
      return null;
    }

    const response = await supabase.functions.invoke("upscale-image", {
      body: {
        inputImage: originalImage,
        upscaleFactor: parseInt(scaleFactor),
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data?.imageUrl;
  };

  const handleUpscale = async () => {
    if (!originalImage) {
      toast.error("Por favor, faça upload de uma imagem primeiro");
      return;
    }

    setIsLoading(true);
    try {
      let imageUrl: string | null = null;

      if (provider === "magnific") {
        imageUrl = await handleUpscaleMagnific();
      } else {
        imageUrl = await handleUpscaleRunware();
      }

      if (imageUrl) {
        setUpscaledImage(imageUrl);
        toast.success("Imagem ampliada com sucesso!");
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (error: any) {
      console.error("Upscale error:", error);
      toast.error(error.message || "Erro ao ampliar imagem");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!upscaledImage) return;

    try {
      const response = await fetch(upscaledImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `upscaled-${provider}-${Date.now()}.png`;
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
    setUpscaledImage(null);
  };

  // Runware only supports 2x and 4x
  const getScaleOptions = () => {
    if (provider === "runware") {
      return [
        { value: "2", label: "2x" },
        { value: "4", label: "4x" },
      ];
    }
    return [
      { value: "2", label: "2x" },
      { value: "4", label: "4x" },
      { value: "8", label: "8x" },
      { value: "16", label: "16x" },
    ];
  };

  // Reset scale factor if it's not supported by the new provider
  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    if (newProvider === "runware" && parseInt(scaleFactor) > 4) {
      setScaleFactor("4");
    }
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
            <Link to="/" className="flex items-center gap-2">
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
            <ZoomIn className="w-4 h-4" />
            <span className="text-sm font-medium">Upscale de Imagem</span>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Aumente a resolução das suas imagens
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Use inteligência artificial para ampliar suas imagens mantendo qualidade e detalhes
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
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Provedor</Label>
                <Tabs value={provider} onValueChange={(v) => handleProviderChange(v as Provider)} className="w-full">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="magnific" className="text-xs sm:text-sm">
                      Magnific
                    </TabsTrigger>
                    <TabsTrigger value="runware" className="text-xs sm:text-sm">
                      Runware
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  {provider === "magnific" 
                    ? "Melhor para fotos e arte - até 16x" 
                    : "Rápido e eficiente - até 4x"}
                </p>
              </div>

              {/* Scale Factor */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Escala</Label>
                <Select value={scaleFactor} onValueChange={setScaleFactor}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione a escala" />
                  </SelectTrigger>
                  <SelectContent>
                    {getScaleOptions().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Magnific-specific settings */}
              <AnimatePresence mode="wait">
                {provider === "magnific" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-6 overflow-hidden"
                  >
                    {/* Flavor */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Modo</Label>
                      <Select value={flavor} onValueChange={setFlavor}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione o modo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="photo">Foto (Realista)</SelectItem>
                          <SelectItem value="sublime">Sublime (Artístico)</SelectItem>
                          <SelectItem value="photo_denoiser">Foto com Denoise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Ultra Detail */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label className="text-sm text-muted-foreground">Ultra Detalhe</Label>
                        <span className="text-sm text-foreground">{ultraDetail[0]}</span>
                      </div>
                      <Slider
                        value={ultraDetail}
                        onValueChange={setUltraDetail}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>

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
                    </div>

                    {/* Smart Grain */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label className="text-sm text-muted-foreground">Granulação</Label>
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upscale Button */}
              <Button
                onClick={handleUpscale}
                disabled={!originalImage || isLoading}
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
                    <ZoomIn className="w-4 h-4 mr-2" />
                    Ampliar Imagem
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
                <ImageIcon className="w-4 h-4" />
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
                    Arraste uma imagem ou clique para selecionar
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPG, WEBP até 20MB
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
              {(upscaledImage || isLoading) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="p-6 bg-card border-border/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Comparação ({scaleFactor}x via {provider === "magnific" ? "Magnific" : "Runware"})
                      </h3>
                      {upscaledImage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                    
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                        <p className="text-lg font-medium">Processando sua imagem...</p>
                        <p className="text-sm">Isso pode levar alguns segundos</p>
                      </div>
                    ) : upscaledImage && originalImage ? (
                      <ImageCompareSlider
                        beforeImage={originalImage}
                        afterImage={upscaledImage}
                        beforeLabel="Original"
                        afterLabel={`${scaleFactor}x`}
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
