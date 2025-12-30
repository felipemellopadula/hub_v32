import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileAudio, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import UserProfile from '@/components/UserProfile';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTokens } from '@/hooks/useTokens';

export default function Transcribe() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { consumeTokens, getTokenCost } = useTokens();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    document.title = "Transcrever Audio com Ia";
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validar tipo de arquivo
    const validTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm', 'audio/ogg', 'audio/mpeg'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo de áudio válido (MP3, WAV, M4A, WebM, OGG)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (100MB - Tier 2 OpenAI com chunking automático)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 100MB",
        variant: "destructive",
      });
      return;
    }

    setAudioFile(file);
    setTranscription('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:audio/...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo de áudio para transcrever",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Consumir tokens primeiro
      const tokenConsumed = await consumeTokens('gpt-4.1-mini-2025-04-14', 'Transcrição de áudio');
      if (!tokenConsumed) {
        return;
      }

      // Converter arquivo para base64
      const audioBase64 = await convertToBase64(audioFile);

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: audioBase64,
          fileName: audioFile.name
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setTranscription(data.transcription);
      
      toast({
        title: "Transcrição concluída",
        description: "Seu áudio foi transcrito com sucesso!",
      });

    } catch (error) {
      console.error('Erro na transcrição:', error);
      toast({
        title: "Erro na transcrição",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao transcrever o áudio",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 pt-1 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar</span>
            </Button>
            <div className="flex items-center gap-2">
              <FileAudio className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground">Transcrever Áudio</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Converta seus áudios em texto com separação de interlocutores
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <UserProfile />
            
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="h-5 w-5" />
                Upload de Áudio
              </CardTitle>
              <CardDescription>
                Faça upload do arquivo de áudio que deseja transcrever (máximo 100MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-primary bg-muted' 
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-4 text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-sm sm:text-base font-medium">
                      Arraste e solte seu arquivo aqui ou clique para selecionar
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Formatos suportados: MP3, WAV, M4A, WebM, OGG
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="audio-upload"
                  />
                  <Label htmlFor="audio-upload" className="cursor-pointer">
                    <Button variant="outline" className="mt-4" asChild>
                      <span>Selecionar Arquivo</span>
                    </Button>
                  </Label>
                </div>

                {audioFile && (
                  <div className="bg-muted rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <FileAudio className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{audioFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(audioFile.size)}</p>
                    </div>
                    <Button
                      onClick={() => setAudioFile(null)}
                      variant="ghost"
                      size="sm"
                      className="self-start sm:self-center"
                    >
                      Remover
                    </Button>
                  </div>
                )}

                <Button 
                  onClick={handleTranscribe}
                  disabled={!audioFile || isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Transcrevendo...
                    </>
                  ) : (
                    <>
                      <FileAudio className="h-4 w-4 mr-2" />
                      Transcrever Áudio
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transcription Result */}
          {transcription && (
            <Card>
              <CardHeader>
                <CardTitle>Transcrição</CardTitle>
                <CardDescription>
                  Resultado da transcrição com separação de interlocutores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={transcription}
                    readOnly
                    className="min-h-[300px] sm:min-h-[400px] font-mono text-sm resize-none"
                    placeholder="A transcrição aparecerá aqui..."
                  />
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(transcription);
                        toast({
                          title: "Copiado!",
                          description: "Transcrição copiada para a área de transferência",
                        });
                      }}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      Copiar Texto
                    </Button>
                    
                    <Button
                      onClick={() => {
                        const blob = new Blob([transcription], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `transcricao_${audioFile?.name || 'audio'}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      Baixar Arquivo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm sm:text-base">Sobre a Transcrição</h3>
                <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                  <li>• Os interlocutores são separados automaticamente</li>
                  <li>• Timestamps indicam quando cada fala começou</li>
                  <li>• Suporte para múltiplos formatos de áudio</li>
                  <li>• Processamento seguro na nuvem</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}