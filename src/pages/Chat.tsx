import { ArrowLeft, Paperclip, Mic, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModelSelector } from "@/components/ModelSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfile } from "@/components/UserProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWebSearchMode, setIsWebSearchMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
    
    // Show files in input
    const fileNames = files.map(f => f.name).join(', ');
    setInputValue(prev => prev + (prev ? ' ' : '') + `[Arquivos: ${fileNames}]`);
    
    toast({
      title: "Arquivos anexados",
      description: `${files.length} arquivo(s) anexado(s)`,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Gravando",
        description: "Fale sua mensagem...",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const response = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (response.data?.text) {
        setInputValue(prev => prev + (prev ? ' ' : '') + response.data.text);
        toast({
          title: "Transcrição concluída",
          description: "Áudio convertido para texto",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível transcrever o áudio.",
        variant: "destructive",
      });
    }
  };

  const toggleWebSearchMode = () => {
    setIsWebSearchMode(prev => !prev);
    toast({
      title: isWebSearchMode ? "Modo busca web desativado" : "Modo busca web ativado",
      description: isWebSearchMode ? "Agora as mensagens serão enviadas para a IA" : "Agora as mensagens serão buscadas na web",
    });
  };

  const performWebSearch = async (query: string) => {
    try {
      setIsLoading(true);
      
      const response = await supabase.functions.invoke('web-search', {
        body: { query, numResults: 3 }
      });

      if (response.data?.results) {
        const searchResults = response.data.results
          .map((result: any) => 
            `${result.title}: ${result.content}`
          )
          .join('\n\n');
        
        const searchContent = `[Resultados da busca na web para "${query}"]\n\n${searchResults}`;
        
        // Add user message
        const userMessage: Message = {
          id: Date.now().toString(),
          content: query,
          sender: 'user',
          timestamp: new Date(),
        };

        // Add search results as bot message
        const searchMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: searchContent,
          sender: 'bot',
          timestamp: new Date(),
          model: 'Busca Web',
        };

        setMessages(prev => [...prev, userMessage, searchMessage]);
        
        toast({
          title: "Busca concluída",
          description: "Resultados da busca na web encontrados",
        });
      } else {
        toast({
          title: "Nenhum resultado",
          description: "Não foram encontrados resultados para sua busca.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Web search error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível realizar a busca na web.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const currentInput = inputValue;
    setInputValue('');
    setAttachedFiles([]);

    // If web search mode is active, perform web search instead
    if (isWebSearchMode) {
      await performWebSearch(currentInput);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentInput,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE'}`,
        },
        body: JSON.stringify({
          message: currentInput,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'Desculpe, não consegui processar sua mensagem.',
        sender: 'bot',
        timestamp: new Date(),
        model: selectedModel,
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 py-1">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector onModelSelect={setSelectedModel} selectedModel={selectedModel} />
            <ThemeToggle />
            <UserProfile tokens={10000} />
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">Inicie uma conversa</h3>
                  <p>Faça uma pergunta para começar a conversar com a IA</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'bot' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.model && message.sender === 'bot' && (
                      <p className="text-xs opacity-70 mt-1">{message.model}</p>
                    )}
                  </div>
                  {message.sender === 'user' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    AI
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message Input - Fixed at bottom */}
        <div className="border-t border-border bg-background p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={isWebSearchMode ? "Digite para buscar na web..." : "Digite sua mensagem..."}
                  disabled={isLoading}
                  className="w-full pl-4 pr-32 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 w-8 p-0 hover:bg-muted"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`h-8 w-8 p-0 hover:bg-muted ${isRecording ? 'text-red-500' : ''}`}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleWebSearchMode}
                    className={`h-8 w-8 p-0 hover:bg-muted ${isWebSearchMode ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={isLoading || !inputValue.trim()} size="lg">
                Enviar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;