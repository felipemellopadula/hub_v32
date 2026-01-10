import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Upload, Search, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';

// Helper para converter image_path em URL pública
const getImageUrl = (imagePath: string) => {
  // Se já é uma URL completa, retorna direto
  if (imagePath.startsWith('http')) return imagePath;
  // Senão, converte o path relativo para URL pública
  const { data } = supabase.storage.from('images').getPublicUrl(imagePath);
  return data.publicUrl;
};

interface UserImage {
  id: string;
  image_path: string;
  prompt: string | null;
  created_at: string;
}

interface ImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (imageUrl: string, prompt?: string, imageId?: string) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
  open,
  onOpenChange,
  onSelectImage,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [images, setImages] = useState<UserImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<UserImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Fetch user images
  const fetchImages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_images')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setImages(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar imagens',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (open) {
      fetchImages();
    }
  }, [open, fetchImages]);

  // Filter images by search
  const filteredImages = images.filter((img) =>
    img.prompt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle image upload
  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);

    try {
      // Compress image
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      const fileName = `${user.id}/${Date.now()}.webp`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, compressed, {
          contentType: 'image/webp',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      // Save to database
      const { data: imageData, error: dbError } = await supabase
        .from('user_images')
        .insert({
          user_id: user.id,
          image_path: publicUrl,
          prompt: 'Uploaded image',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setImages(prev => [imageData, ...prev]);
      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi adicionada ao seu histórico.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar imagem',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleConfirm = () => {
    if (selectedImage) {
      // Sempre passa a URL pública completa
      const publicUrl = getImageUrl(selectedImage.image_path);
      onSelectImage(publicUrl, selectedImage.prompt || undefined, selectedImage.id);
      onOpenChange(false);
      setSelectedImage(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Selecionar Imagem</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="gallery" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gallery" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Galeria
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gallery" className="mt-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Images Grid */}
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Nenhuma imagem encontrada' : 'Nenhuma imagem no histórico'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  <AnimatePresence>
                    {filteredImages.map((image) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                          selectedImage?.id === image.id
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-transparent hover:border-primary/50"
                        )}
                        onClick={() => setSelectedImage(image)}
                      >
                      <img
                          src={getImageUrl(image.image_path)}
                          alt={image.prompt || 'Generated image'}
                          className="w-full h-full object-cover"
                        />
                        {selectedImage?.id === image.id && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary rounded-full p-1">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center transition-colors",
                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
                uploading && "pointer-events-none opacity-50"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Enviando imagem...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Arraste uma imagem aqui ou
                  </p>
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <Button variant="outline" asChild>
                      <span>Escolher arquivo</span>
                    </Button>
                  </Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedImage}>
            Adicionar Cena
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
