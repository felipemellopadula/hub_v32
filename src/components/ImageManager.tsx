import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

export const ImageManager: React.FC = () => {
  const { user } = useAuth();
  const [images, setImages] = useState<DatabaseImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);

  // Carregar imagens do usuário
  const loadImages = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_images')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Erro ao carregar imagens:", error);
      toast.error("Erro ao carregar suas imagens");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [user]);

  // Deletar todas as imagens
  const deleteAllImages = async () => {
    if (!user) return;
    
    setIsDeletingAll(true);
    try {
      // Primeiro, deletar do storage
      const imagePaths = images.map(img => img.image_path);
      if (imagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('images')
          .remove(imagePaths);
        
        if (storageError) {
          console.warn("Erro ao deletar do storage:", storageError);
        }
      }

      // Depois, deletar do banco de dados
      const { error: dbError } = await supabase
        .from('user_images')
        .delete()
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      setImages([]);
      setSelectedImages(new Set());
      toast.success(`🗑️ Todas as ${imagePaths.length} imagens foram deletadas com sucesso!`);
      
    } catch (error) {
      console.error("Erro ao deletar todas as imagens:", error);
      toast.error("Erro ao deletar suas imagens");
      // Recarregar para ver o estado atual
      loadImages();
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllDialog(false);
    }
  };

  // Deletar imagens selecionadas
  const deleteSelectedImages = async () => {
    if (!user || selectedImages.size === 0) return;
    
    setIsDeleting(true);
    try {
      const imagesToDelete = images.filter(img => selectedImages.has(img.id));
      const imagePaths = imagesToDelete.map(img => img.image_path);
      
      // Deletar do storage
      if (imagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('images')
          .remove(imagePaths);
        
        if (storageError) {
          console.warn("Erro ao deletar do storage:", storageError);
        }
      }

      // Deletar do banco de dados
      const { error: dbError } = await supabase
        .from('user_images')
        .delete()
        .in('id', Array.from(selectedImages))
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // Atualizar estado local
      setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
      setSelectedImages(new Set());
      toast.success(`🗑️ ${imagesToDelete.length} imagens deletadas com sucesso!`);
      
    } catch (error) {
      console.error("Erro ao deletar imagens selecionadas:", error);
      toast.error("Erro ao deletar imagens selecionadas");
      loadImages();
    } finally {
      setIsDeleting(false);
      setShowDeleteSelectedDialog(false);
    }
  };

  // Toggle seleção de imagem
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  // Selecionar/deselecionar todas
  const toggleSelectAll = () => {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map(img => img.id)));
    }
  };

  const getImageUrl = (image: DatabaseImage) => {
    const { data: publicData } = supabase.storage.from('images').getPublicUrl(image.image_path);
    return publicData.publicUrl;
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando suas imagens...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Gerenciar Minhas Imagens
          </CardTitle>
          <CardDescription>
            Gerencie e delete suas imagens armazenadas no Supabase Storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {images.length} imagens totais
              </Badge>
              {selectedImages.size > 0 && (
                <Badge variant="default">
                  {selectedImages.size} selecionadas
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadImages}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Recarregar
              </Button>
              
              {images.length > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    {selectedImages.size === images.length ? 'Deselecionar Todas' : 'Selecionar Todas'}
                  </Button>
                  
                  {selectedImages.size > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setShowDeleteSelectedDialog(true)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Deletar Selecionadas ({selectedImages.size})
                    </Button>
                  )}
                  
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteAllDialog(true)}
                    disabled={isDeletingAll}
                  >
                    {isDeletingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Deletar Todas
                  </Button>
                </>
              )}
            </div>
          </div>

          {images.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Você não tem imagens armazenadas ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {images.map((image) => (
                <div 
                  key={image.id} 
                  className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                    selectedImages.has(image.id) 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleImageSelection(image.id)}
                >
                  <img
                    src={getImageUrl(image)}
                    alt={image.prompt || "Imagem gerada"}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    {selectedImages.has(image.id) && (
                      <CheckCircle className="h-8 w-8 text-primary bg-background rounded-full" />
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                    <p className="truncate" title={image.prompt || "Sem prompt"}>
                      {image.prompt || "Sem prompt"}
                    </p>
                    <p className="text-white/70">
                      {new Date(image.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            ⚠️ A deleção de imagens é permanente e não pode ser desfeita.
          </div>
        </CardContent>
      </Card>

      {/* Dialog para confirmar deleção de todas */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deletar Todas as Imagens
            </DialogTitle>
            <DialogDescription>
              Esta ação irá deletar permanentemente todas as suas {images.length} imagens do storage e do banco de dados. 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteAllImages}
              disabled={isDeletingAll}
            >
              {isDeletingAll ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Deletar Todas ({images.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar deleção das selecionadas */}
      <Dialog open={showDeleteSelectedDialog} onOpenChange={setShowDeleteSelectedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deletar Imagens Selecionadas
            </DialogTitle>
            <DialogDescription>
              Esta ação irá deletar permanentemente {selectedImages.size} imagens selecionadas do storage e do banco de dados. 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteSelectedDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteSelectedImages}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Deletar Selecionadas ({selectedImages.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};