import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSelector } from "./ModelSelector";
import { Send, Bot, User, Paperclip, Image } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PdfProcessor } from "@/utils/PdfProcessor";
import { WordProcessor } from "@/utils/WordProcessor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTokens } from '@/hooks/useTokens';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  files?: Array<{
    name: string;
    type: string;
    url: string;
  }>;
}

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatInterface = ({ isOpen, onClose }: ChatInterfaceProps) => {
  const { checkTokenBalance, consumeTokens } = useTokens();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [filePages, setFilePages] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to convert file to base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.type === 'application/msword';

    if (!isImage && !isPdf && !isWord) {
      toast.error('Apenas arquivos PDF, Word e imagens são suportados');
      return;
    }

    setIsProcessingFile(true);
    
    try {
      if (isImage) {
        // Para imagens, apenas armazenar o arquivo
        setAttachedFiles([file]);
        setFileName(file.name);
        toast.success(`Imagem anexada: ${file.name}`);
      } else if (isPdf) {
        const result = await PdfProcessor.processPdf(file);
        
        if (result.success && result.content) {
          console.log('PDF processado com sucesso:', {
            fileName: file.name,
            pageCount: result.pageCount,
            contentLength: result.content.length,
            contentPreview: result.content.substring(0, 200) + '...'
          });
          setFileContent(result.content);
          setFileName(file.name);
          setFilePages(result.pageCount || 0);
          toast.success(`PDF processado com sucesso! ${result.pageCount} páginas (${result.fileSize}MB)`);
        } else {
          let errorMessage = result.error || "Erro desconhecido";
          
          if (result.isPasswordProtected) {
            errorMessage = "PDF protegido por senha. Não é possível processar arquivos protegidos.";
          }

          toast.error(errorMessage);
          clearFileData();
        }
      } else if (isWord) {
        const result = await WordProcessor.processWord(file);
        
        if (result.success && result.content) {
          setFileContent(result.content);
          setFileName(file.name);
          toast.success(`Documento Word processado: ${file.name} (${result.wordCount} palavras)`);
        } else {
          toast.error(result.error || 'Erro ao processar documento Word');
          clearFileData();
        }
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro interno ao processar arquivo');
      clearFileData();
    } finally {
      setIsProcessingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearFileData = () => {
    setFileContent('');
    setFileName('');
    setFilePages(0);
    setAttachedFiles([]);
  };

  const handleSendMessage = async () => {
    console.log('=== HANDLE SEND MESSAGE START ===');
    console.log('handleSendMessage called:', {
      inputValue: inputValue.trim(),
      fileContent: fileContent ? `${fileContent.length} chars` : 'none',
      attachedFiles: attachedFiles.length,
      fileName,
      filePages,
      selectedModel
    });
    
    if ((!inputValue.trim() && !fileContent && !attachedFiles.length) || !selectedModel) {
      console.log('Exiting early - missing input or model');
      return;
    }

    // Check token balance first
    const hasTokens = await checkTokenBalance(selectedModel);
    if (!hasTokens) {
      return;
    }

    // Check if we have images and should use image analysis
    const hasImages = attachedFiles.some(file => file.type.startsWith('image/'));
    
    let messageContent = inputValue;
    let displayMessage = inputValue || (hasImages ? `Análise da imagem: ${fileName}` : `Análise do arquivo: ${fileName}`);
    console.log('=== IMAGE ANALYSIS CHECK ===');
    console.log('hasImages:', hasImages);
    console.log('attachedFiles details:', attachedFiles.map(f => ({ name: f.name, type: f.type })));
    console.log('selectedModel:', selectedModel);
    console.log('hasImages:', hasImages);
    console.log('attachedFiles:', attachedFiles);
    console.log('selectedModel:', selectedModel);
    
    // Lista de modelos que suportam visão
    const visionModels = [
      'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', // OpenAI vision models
      'claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', // Anthropic  
      'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', // Google
      'grok-4-0709', 'grok-3', 'grok-3-mini' // xAI - agora todos suportam visão
    ];
    
    const isVisionModel = visionModels.includes(selectedModel);
    console.log('isVisionModel:', isVisionModel);
    console.log('Will use image analysis?', hasImages && isVisionModel);
    
    if (hasImages && isVisionModel) {
      // Use image analysis function for vision models
      console.log('Using image analysis function for vision model');
      const imageFile = attachedFiles.find(file => file.type.startsWith('image/'));
      if (imageFile) {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          content: displayMessage,
          sender: 'user',
          timestamp: new Date(),
          files: [{
            name: imageFile.name,
            type: imageFile.type,
            url: URL.createObjectURL(imageFile)
          }]
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsLoading(true);
        clearFileData();

        try {
          const base64 = await convertFileToBase64(imageFile);
          const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
          
          let aiProvider = 'openai';
          if (selectedModel === 'synergy-ia') aiProvider = 'openai'; // SynergyIA usa OpenAI
          else if (selectedModel.includes('claude')) aiProvider = 'claude';
          else if (selectedModel.includes('gemini')) aiProvider = 'gemini';
          else if (selectedModel.includes('grok')) aiProvider = 'grok';
          else if (selectedModel.includes('deepseek')) aiProvider = 'deepseek';
          
          console.log('=== CALLING IMAGE ANALYSIS ===');
          console.log('aiProvider:', aiProvider);
          console.log('base64Data length:', base64Data.length);
          console.log('prompt:', inputValue || 'Analise esta imagem e descreva o que você vê.');
          
          const response = await supabase.functions.invoke('image-analysis', {
            body: {
              imageBase64: base64Data,
              prompt: inputValue || 'Analise esta imagem e descreva o que você vê.',
              aiProvider,
              analysisType: 'general'
            },
          });

          console.log('Image analysis response:', response);
          
          if (response.error) {
            throw new Error(response.error.message || 'Erro na análise da imagem');
          }

          const aiMessage: Message = {
            id: crypto.randomUUID(),
            content: response.data.analysis,
            sender: 'bot',
            timestamp: new Date(),
            model: selectedModel,
          };

          setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
          console.error('=== IMAGE ANALYSIS ERROR ===');
          console.error('Error analyzing image:', error);
          console.error('Error details:', error.message, error.stack);
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            content: 'Desculpe, ocorreu um erro ao analisar a imagem. Verifique se as chaves API estão configuradas corretamente.',
            sender: 'bot',
            timestamp: new Date(),
            model: selectedModel,
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
        }
        return;
      }
    }

    // Se há arquivo de texto anexado, criar prompts otimizados
    if (fileContent && filePages) {
      console.log('Text file detected, creating optimized prompt');
      if (inputValue.toLowerCase().includes('resumo') || inputValue.toLowerCase().includes('resume') || !inputValue.trim()) {
        // Usar prompt de resumo automático
        messageContent = PdfProcessor.createSummaryPrompt(fileContent, filePages);
        displayMessage = `Resumo do arquivo: ${fileName}`;
      } else {
        // Usar prompt de análise detalhada
        messageContent = PdfProcessor.createAnalysisPrompt(fileContent, filePages, inputValue);
        displayMessage = `Análise sobre: ${inputValue}`;
      }
      console.log('Final messageContent length:', messageContent.length);
      console.log('Message preview:', messageContent.substring(0, 500) + '...');
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: displayMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Create a temporary message for streaming
    const botMessageId = crypto.randomUUID();
    const tempBotMessage: Message = {
      id: botMessageId,
      content: '',
      sender: 'bot',
      timestamp: new Date(),
      model: selectedModel,
    };
    
    setMessages(prev => [...prev, tempBotMessage]);

    try {
      // Determine which edge function to use based on the selected model
      const getEdgeFunctionName = (model: string) => {
        if (model.includes('gpt-') || model.includes('o3') || model.includes('o4')) {
          return 'openai-chat';
        }
        if (model.includes('gemini')) {
          return 'gemini-chat';
        }
        if (model.includes('claude')) {
          return 'anthropic-chat';
        }
        if (model.includes('deepseek')) {
          return 'deepseek-chat';
        }
        if (model.includes('grok')) {
          return 'grok-chat';
        }
        if (model.includes('llama')) {
          return 'apillm-chat';
        }
        return 'ai-chat';
      };

      const functionName = getEdgeFunctionName(selectedModel);
      console.log(`Using edge function: ${functionName} for model: ${selectedModel}`);
      console.log('Sending message to function:', {
        messageLength: messageContent.length,
        messagePreview: messageContent.substring(0, 300) + '...'
      });

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          message: messageContent,
          model: selectedModel,
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao enviar mensagem');
      }

      const aiMessageContent = data.response || data.message || 'Resposta vazia recebida.';
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: aiMessageContent }
            : msg
        )
      );
      
      // Consume tokens after successful response
      await consumeTokens(selectedModel, messageContent);
      
      // Limpar dados do arquivo após o envio
      clearFileData();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Verifique se as chaves API estão configuradas corretamente.',
        sender: 'bot',
        timestamp: new Date(),
        model: selectedModel,
      };
      
      // Remove the temporary message and add error message
      setMessages(prev => 
        prev.filter(msg => msg.id !== botMessageId).concat(errorMessage)
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasAttachedFile = fileContent || attachedFiles.length > 0;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] bg-card border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Chat com IA</h2>
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector onModelSelect={setSelectedModel} selectedModel={selectedModel} />
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p>Selecione um modelo e comece a conversar!</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'bot' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.files.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded text-xs border border-white/20">
                          {file.type.startsWith('image/') ? (
                            <Image className="h-3 w-3 text-white/80" />
                          ) : (
                            <Paperclip className="h-3 w-3 text-white/80" />
                          )}
                          <span className="truncate max-w-[200px] text-white/90">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {message.model && (
                    <p className="text-xs opacity-70 mt-1">
                      Modelo: {message.model}
                    </p>
                  )}
                </div>

                {message.sender === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile || isLoading}
              className="shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isProcessingFile
                  ? "Processando arquivo..."
                  : hasAttachedFile && fileName
                  ? `Arquivo anexado: ${fileName}. Digite sua pergunta...`
                  : selectedModel
                  ? "Digite sua mensagem ou anexe um arquivo (PDF, Word, imagem)..."
                  : "Selecione um modelo primeiro"
              }
              disabled={!selectedModel || isProcessingFile}
              onKeyPress={(e) => {
                console.log('Key pressed:', e.key);
                if (e.key === 'Enter' && !isProcessingFile) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-background border-border"
            />
            <Button 
              onClick={() => {
                console.log('Send button clicked!');
                handleSendMessage();
              }}
              disabled={(!inputValue.trim() && !hasAttachedFile && !attachedFiles.length) || !selectedModel || isLoading || isProcessingFile}
              className="bg-primary hover:bg-primary-glow text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Suporte para PDF, Word e imagens (JPEG, PNG, GIF, WEBP)
          </div>
        </div>
      </Card>
    </div>
  );
};