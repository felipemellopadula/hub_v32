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
      
      if (result.success) {
        const pdfMessage = `[Arquivo: ${file.name}]\n\n${result.content}`;
        setInputValue(pdfMessage);
        toast.success(`PDF processado com sucesso! ${result.pageCount} páginas lidas.`);
      } else {
        toast.error(result.error || 'Erro ao processar PDF');
      }
    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      toast.error('Erro interno ao processar PDF');
    } finally {
      setIsProcessingPdf(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedModel) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: inputValue,
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
      const response = await fetch('https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE`,
          'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      // Check if response is streaming (for OpenAI models) or regular JSON
      const contentType = response.headers.get('content-type');
      const isStreaming = contentType?.includes('text/event-stream');

      if (isStreaming) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') break;
                
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  
                  if (delta) {
                    accumulatedContent += delta;
                    
                    // Update the bot message with accumulated content
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === botMessageId 
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        }
      } else {
        // Handle regular JSON response (non-OpenAI models)
        const data = await response.json();
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, content: data.response }
              : msg
          )
        );
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
              disabled={!inputValue.trim() || !selectedModel || isLoading || isProcessingPdf}
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