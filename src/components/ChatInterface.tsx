import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSelector } from "./ModelSelector";
import { Send, Bot, User, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PdfProcessor } from "@/utils/PdfProcessor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
}

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatInterface = ({ isOpen, onClose }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfContent, setPdfContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são suportados');
      return;
    }

    setIsProcessingPdf(true);
    
    try {
      const result = await PdfProcessor.processPdf(file);
      
      if (result.success && result.content) {
        setPdfContent(result.content);
        setFileName(file.name);
        setPdfPages(result.pageCount || 0);
        toast.success(`PDF processado com sucesso! ${result.pageCount} páginas (${result.fileSize}MB)`);
      } else {
        let errorMessage = result.error || "Erro desconhecido";
        
        if (result.isPasswordProtected) {
          errorMessage = "PDF protegido por senha. Não é possível processar arquivos protegidos.";
        }

        toast.error(errorMessage);
        
        // Limpar campos em caso de erro
        setPdfContent('');
        setFileName('');
        setPdfPages(0);
      }
    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      toast.error('Erro interno ao processar PDF');
      
      setPdfContent('');
      setFileName('');
      setPdfPages(0);
    } finally {
      setIsProcessingPdf(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !pdfContent) || !selectedModel) return;

    let messageContent = inputValue;
    let displayMessage = inputValue || `Análise do arquivo: ${fileName}`;

    // Se há PDF anexado, criar prompts otimizados usando PdfProcessor
    if (pdfContent && pdfPages) {
      if (inputValue.toLowerCase().includes('resumo') || inputValue.toLowerCase().includes('resume') || !inputValue.trim()) {
        // Usar prompt de resumo automático
        messageContent = PdfProcessor.createSummaryPrompt(pdfContent, pdfPages);
        displayMessage = `Resumo do PDF: ${fileName}`;
      } else {
        // Usar prompt de análise detalhada
        messageContent = PdfProcessor.createAnalysisPrompt(pdfContent, pdfPages, inputValue);
        displayMessage = `Análise sobre: ${inputValue}`;
      }
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
        if (model.includes('llama') || model.includes('deepseek')) {
          return 'apillm-chat';
        }
        return 'ai-chat'; // Fallback to original function
      };

      const functionName = getEdgeFunctionName(selectedModel);
      console.log(`Using edge function: ${functionName} for model: ${selectedModel}`);

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
      
      // Limpar PDF após o envio
      setPdfContent('');
      setFileName('');
      setPdfPages(0);
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
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingPdf || isLoading}
              className="shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isProcessingPdf
                  ? "Processando PDF..."
                  : pdfContent && fileName
                  ? `PDF anexado: ${fileName}. Digite 'resumo' ou faça perguntas específicas...`
                  : selectedModel
                  ? "Digite sua mensagem ou anexe um PDF..."
                  : "Selecione um modelo primeiro"
              }
              disabled={!selectedModel || isProcessingPdf}
              onKeyPress={(e) => e.key === 'Enter' && !isProcessingPdf && handleSendMessage()}
              className="flex-1 bg-background border-border"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={(!inputValue.trim() && !pdfContent) || !selectedModel || isLoading || isProcessingPdf}
              className="bg-primary hover:bg-primary-glow text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {PdfProcessor.getMaxFileInfo()}
          </div>
        </div>
      </Card>
    </div>
  );
};