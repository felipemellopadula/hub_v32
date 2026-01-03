import { useState, useRef, useCallback, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload, Camera, Eye, MessageSquare, Send, Settings, X, Download, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useButtonDebounce } from "@/hooks/useButtonDebounce";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserProfile from "@/components/UserProfile";
import { ThemeToggle } from "@/components/ThemeToggle";

type TabType = "prompt" | "visual" | "camera";

interface ClickMarker {
  x: number;
  y: number;
  comment: string;
}

const ImageEditor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { debounce, isDebouncing } = useButtonDebounce(1500);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("prompt");
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Visual mode state
  const [clickMarkers, setClickMarkers] = useState<ClickMarker[]>([]);
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null);
  const [markerComment, setMarkerComment] = useState("");

  // Camera mode state
  const [rotation, setRotation] = useState(0);
  const [verticalTilt, setVerticalTilt] = useState(0);
  const [proximity, setProximity] = useState(0);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setEditedImage(null);
      setClickMarkers([]);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setUploadedImage(null);
    setEditedImage(null);
    setClickMarkers([]);
    setPrompt("");
    setRotation(0);
    setVerticalTilt(0);
    setProximity(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleDownload = useCallback(() => {
    const imageToDownload = editedImage || uploadedImage;
    if (!imageToDownload) return;

    const link = document.createElement("a");
    link.href = imageToDownload;
    link.download = `imagem-editada-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Imagem baixada com sucesso!");
  }, [editedImage, uploadedImage]);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab !== "visual" || !uploadedImage) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newMarker: ClickMarker = { x, y, comment: "" };
    setClickMarkers(prev => [...prev, newMarker]);
    setActiveMarkerIndex(clickMarkers.length);
    setMarkerComment("");
  }, [activeTab, uploadedImage, clickMarkers.length]);

  const handleMarkerCommentSubmit = useCallback(() => {
    if (activeMarkerIndex === null || !markerComment.trim()) return;

    setClickMarkers(prev => 
      prev.map((marker, idx) => 
        idx === activeMarkerIndex 
          ? { ...marker, comment: markerComment }
          : marker
      )
    );
    setActiveMarkerIndex(null);
    setMarkerComment("");
  }, [activeMarkerIndex, markerComment]);

  const removeMarker = useCallback((index: number) => {
    setClickMarkers(prev => prev.filter((_, idx) => idx !== index));
    if (activeMarkerIndex === index) {
      setActiveMarkerIndex(null);
      setMarkerComment("");
    }
  }, [activeMarkerIndex]);

  const buildPromptFromInputs = useCallback(() => {
    let fullPrompt = prompt;

    // Add visual markers
    if (clickMarkers.length > 0) {
      const markerDescriptions = clickMarkers
        .filter(m => m.comment)
        .map((m, idx) => `Ponto ${idx + 1} (${Math.round(m.x)}%, ${Math.round(m.y)}%): ${m.comment}`)
        .join("; ");
      
      if (markerDescriptions) {
        fullPrompt += fullPrompt ? `. Edições específicas: ${markerDescriptions}` : `Edições específicas: ${markerDescriptions}`;
      }
    }

    // Add camera adjustments
    if (rotation !== 0 || verticalTilt !== 0 || proximity !== 0) {
      const cameraAdjustments: string[] = [];
      if (rotation !== 0) cameraAdjustments.push(`girar ${rotation}°`);
      if (verticalTilt !== 0) cameraAdjustments.push(`inclinação vertical ${verticalTilt}°`);
      if (proximity !== 0) cameraAdjustments.push(`ajustar proximidade em ${proximity}%`);
      
      if (cameraAdjustments.length > 0) {
        fullPrompt += fullPrompt ? `. Ajustes de câmera: ${cameraAdjustments.join(", ")}` : `Ajustes de câmera: ${cameraAdjustments.join(", ")}`;
      }
    }

    return fullPrompt;
  }, [prompt, clickMarkers, rotation, verticalTilt, proximity]);

  const handleSubmit = async () => {
    if (!uploadedImage) {
      toast.error("Por favor, faça upload de uma imagem primeiro");
      return;
    }

    const fullPrompt = buildPromptFromInputs();
    if (!fullPrompt.trim()) {
      toast.error("Por favor, adicione um prompt ou marcações visuais");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Extract base64 from data URL
      const base64Image = uploadedImage.split(",")[1] || uploadedImage;

      const { data, error } = await supabase.functions.invoke("edit-image-nano-banana", {
        body: {
          prompt: fullPrompt,
          imageBase64: base64Image,
        },
      });

      if (error) throw error;

      if (data?.image) {
        const editedImageUrl = `data:image/png;base64,${data.image}`;
        setEditedImage(editedImageUrl);
        toast.success("Imagem editada com sucesso!");
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (error: any) {
      console.error("Erro ao editar imagem:", error);
      toast.error(error.message || "Erro ao processar imagem");
    } finally {
      setIsProcessing(false);
    }
  };

  const displayImage = editedImage || uploadedImage;

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
            <div className="flex items-center gap-3">
              <img 
                src="/images/synergy-logo.webp" 
                alt="Synergy AI" 
                className="h-6 w-auto"
              />
              <span className="text-muted-foreground">|</span>
              <h1 className="text-xl font-bold">Editar Imagem</h1>
            </div>
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
            
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Image Area */}
        <div 
          ref={imageContainerRef}
          className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
          onClick={handleImageClick}
          style={{ cursor: activeTab === "visual" && uploadedImage ? "crosshair" : "default" }}
        >
          {displayImage ? (
            <div className="relative max-w-full max-h-full">
              <img
                src={displayImage}
                alt="Imagem para edição"
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl"
                style={{
                  transform: `rotate(${rotation}deg) perspective(1000px) rotateX(${verticalTilt}deg) scale(${1 + proximity / 100})`,
                  transition: "transform 0.3s ease",
                }}
              />
              
              {/* Visual Mode Markers */}
              {activeTab === "visual" && clickMarkers.map((marker, idx) => (
                <div
                  key={idx}
                  className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (marker.comment) {
                      removeMarker(idx);
                    } else {
                      setActiveMarkerIndex(idx);
                    }
                  }}
                >
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg border-2 border-white">
                    {idx + 1}
                  </div>
                  {marker.comment && (
                    <div className="absolute left-8 top-0 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-sm whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      {marker.comment}
                      <X className="inline-block ml-2 h-3 w-3 text-destructive cursor-pointer" />
                    </div>
                  )}
                </div>
              ))}

              {/* Active Marker Input */}
              {activeMarkerIndex !== null && (
                <div
                  className="absolute bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl z-10"
                  style={{
                    left: `${clickMarkers[activeMarkerIndex]?.x}%`,
                    top: `${clickMarkers[activeMarkerIndex]?.y + 5}%`,
                    transform: "translateX(-50%)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    value={markerComment}
                    onChange={(e) => setMarkerComment(e.target.value)}
                    placeholder="O que mudar aqui?"
                    className="w-48 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleMarkerCommentSubmit();
                      if (e.key === "Escape") {
                        setActiveMarkerIndex(null);
                        setMarkerComment("");
                      }
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleMarkerCommentSubmit} className="flex-1">
                      OK
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        removeMarker(activeMarkerIndex);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="w-full max-w-md aspect-square border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-foreground font-medium">Clique para fazer upload</p>
                <p className="text-sm text-muted-foreground">ou arraste uma imagem</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="bg-background/95 backdrop-blur-sm border-t border-border p-4 space-y-4">
          {/* Camera Controls (when camera tab is active) */}
          {activeTab === "camera" && (
            <div className="flex items-center justify-center gap-8 py-2">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">Girar</span>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[rotation]}
                    onValueChange={([val]) => setRotation(val)}
                    min={-180}
                    max={180}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-sm text-foreground w-12 text-right">{rotation}°</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">Vertical</span>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[verticalTilt]}
                    onValueChange={([val]) => setVerticalTilt(val)}
                    min={-45}
                    max={45}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-sm text-foreground w-12 text-right">{verticalTilt}°</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">Proximidade</span>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[proximity]}
                    onValueChange={([val]) => setProximity(val)}
                    min={-50}
                    max={100}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-sm text-foreground w-12 text-right">{proximity}</span>
                </div>
              </div>
            </div>
          )}

          {/* Visual Mode Hint */}
          {activeTab === "visual" && uploadedImage && (
            <div className="text-center text-sm text-muted-foreground py-2">
              Clique na imagem e escreva um comentário para editar
            </div>
          )}

          {/* Prompt Input */}
          <div className="relative">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="O que você quer mudar?"
              className="pr-32 bg-secondary/50 border-border/50 h-12 rounded-full"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* Tabs */}
              <div className="flex items-center bg-secondary rounded-full p-1 mr-2">
                <button
                  onClick={() => setActiveTab("prompt")}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    activeTab === "prompt"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Prompt
                </button>
                <button
                  onClick={() => setActiveTab("visual")}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    activeTab === "visual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Visual
                </button>
                <button
                  onClick={() => setActiveTab("camera")}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    activeTab === "camera"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Câmera
                </button>
              </div>

              {/* Upload Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </Button>

              {/* Settings Dropdown */}
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <Settings className="h-3 w-3" />
                Automático
              </Button>

              {/* Submit Button */}
              <Button
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => debounce(handleSubmit)}
                disabled={isProcessing || isDebouncing || !uploadedImage}
              >
                {isProcessing ? (
                  <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
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

export default ImageEditor;
