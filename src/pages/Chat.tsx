import { ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModelSelector } from "@/components/ModelSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfile } from "@/components/UserProfile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTokens } from "@/hooks/useTokens";
import { supabase } from "@/integrations/supabase/client";
import { PdfProcessor } from "@/utils/PdfProcessor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

// --- INTERFACES ---
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  reasoning?: string;
  isStreaming?: boolean;
  files?: { name: string; type: string }[];
}

interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// --- COMPONENTE DA BARRA LATERAL DE CONVERSAS (REUTILIZÁVEL) ---
interface ConversationSidebarProps {
  conversations: ChatConversation[];
  currentConversationId: string | null;
  onSelectConversation: (conv: ChatConversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onToggleFavorite: (conv: ChatConversation) => void;
  isMobile?: boolean; // Para lógica de fechar o Sheet no mobile
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onToggleFavorite,
  isMobile = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderItem = (conv: ChatConversation) => (
    <div
      key={conv.id}
      className={`group w-full text-left px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-200 ${
        currentConversationId === conv.id ? "bg-muted" : "hover:bg-muted/50"
      }`}
      onClick={() => onSelectConversation(conv)}
    >
      <span className="truncate text-sm font-medium">{conv.title}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(conv); }}
              >
                <Star
                  className={`h-4 w-4 transition-colors ${conv.is_favorite ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`}
                  fill={conv.is_favorite ? 'currentColor' : 'none'}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{conv.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Excluir conversa</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );

  const favorites = filteredConversations.filter(c => c.is_favorite);
  const recents = filteredConversations.filter(c => !c.is_favorite);

  const renderItemWithWrapper = (conv: ChatConversation) => {
    if (isMobile) {
      return (
        <SheetClose key={conv.id} asChild>
          {renderItem(conv)}
        </SheetClose>
      );
    }
    return renderItem(conv);
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      <div className="p-3 border-b border-border">
        <input
          placeholder="Pesquisar conversas..."
          className="w-full h-9 rounded-md border bg-background px-3 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {favorites.length > 0 && (
            <>
              <h4 className="px-2 py-2 text-xs font-semibold text-muted-foreground">Favoritos</h4>
              <div className="space-y-1">
                {favorites.map(conv => renderItemWithWrapper(conv))}
              </div>
            </>
          )}
          <h4 className="px-2 pt-4 pb-2 text-xs font-semibold text-muted-foreground">Recentes</h4>
          <div className="space-y-1">
             {recents.map(conv => renderItemWithWrapper(conv))}
          </div>
          {filteredConversations.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};


// --- COMPONENTE PRINCIPAL ---
const Chat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();
  const { consumeTokens, getTokenCost, getModelDisplayName, tokenBalance } = useTokens();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWebSearchMode, setIsWebSearchMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [processedPdfs, setProcessedPdfs] = useState<Map<string, string>>(new Map());
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<{ [key: string]: boolean }>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && !loading) {
      (async () => {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('*')
          .order('updated_at', { ascending: false });
        if (error) console.error('Erro ao carregar conversas:', error);
        else if (data) setConversations(data as any);
      })();
    }
  }, [user, loading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 100);
    };
    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!selectedModel) setSelectedModel('synergy-ia');
  }, [selectedModel]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
  };

  const toSerializable = (msgs: Message[]) => msgs.map(m => ({...m, timestamp: m.timestamp.toISOString()}));
  const fromSerializable = (msgs: any[]): Message[] => (msgs || []).map((m) => ({...m, timestamp: new Date(m.timestamp)}));
  const deriveTitle = (msgs: Message[]) => (msgs.find(m => m.sender === 'user')?.content?.trim() || 'Nova conversa').slice(0, 50);

  const openConversation = (conv: ChatConversation) => {
    setCurrentConversationId(conv.id);
    setMessages(fromSerializable(conv.messages));
  };

  const upsertConversation = async (finalMessages: Message[], convId: string | null) => {
    try {
      const serial = toSerializable(finalMessages);
      let newConvId = convId;

      if (!newConvId || newConvId.startsWith('temp_')) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .insert({ user_id: user!.id, title: deriveTitle(finalMessages), messages: serial })
          .select('*').single();
        if (error) throw error;
        
        if (newConvId?.startsWith('temp_')) {
            setCurrentConversationId(data.id);
            setConversations(prev => prev.map(c => c.id === newConvId ? data as ChatConversation : c));
        } else {
            setCurrentConversationId(data.id);
            setConversations(prev => [data as ChatConversation, ...prev]);
        }
      } else {
        const currentConv = conversations.find(c => c.id === newConvId);
        const shouldRename = !currentConv || currentConv.title === 'Nova conversa' || (Array.isArray(currentConv.messages) && currentConv.messages.length === 0);
        const updatePayload: any = { messages: serial, updated_at: new Date().toISOString() };
        if (shouldRename) updatePayload.title = deriveTitle(finalMessages);
        
        const { data, error } = await supabase
          .from('chat_conversations')
          .update(updatePayload)
          .eq('id', newConvId)
          .select('*').single();
        if (error) throw error;
        setConversations(prev => [data as ChatConversation, ...prev.filter(c => c.id !== data.id)]);
      }
    } catch (e) { console.error('Erro ao salvar conversa:', e); }
  };

  const createNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInputValue('');
    setAttachedFiles([]);
    setProcessedPdfs(new Map());
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir a conversa.', variant: 'destructive' });
      return;
    }
    setConversations((prev) => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      createNewConversation();
    }
    toast({ title: 'Conversa excluída com sucesso!' });
  };
  
  const toggleFavoriteConversation = async (conv: ChatConversation) => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .update({ is_favorite: !conv.is_favorite })
      .eq('id', conv.id).select('*').single();
    if (error) toast({ title: 'Erro', description: 'Não foi possível atualizar favorito.', variant: 'destructive' });
    else if (data) setConversations(prev => prev.map(c => c.id === data.id ? data as ChatConversation : c).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
  };
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return;

    const currentInput = inputValue;
    const currentFiles = [...attachedFiles];
    setInputValue('');
    setAttachedFiles([]);
    setProcessedPdfs(new Map());
    if (fileInputRef.current) fileInputRef.current.value = '';

    const canProceed = await consumeTokens(selectedModel, currentInput);
    if (!canProceed) return;

    const fileData = await Promise.all(currentFiles.map(async (file) => {
        const baseData = { name: file.name, type: file.type, data: await fileToBase64(file) };
        return file.type === 'application/pdf' ? { ...baseData, pdfContent: processedPdfs.get(file.name) || '' } : baseData;
    }));

    const userMessage: Message = { id: Date.now().toString(), content: currentInput, sender: 'user', timestamp: new Date(), files: currentFiles.length > 0 ? currentFiles.map(f => ({ name: f.name, type: f.type })) : undefined };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    
    let convId = currentConversationId;
    if (!convId || conversations.find(c => c.id === convId)?.messages.length === 0) {
        const { data, error } = await supabase
            .from('chat_conversations')
            .insert({ user_id: user!.id, title: deriveTitle(newMessages), messages: toSerializable(newMessages) })
            .select('*').single();
        if (error) { console.error(error); } 
        else if (data) {
            if (convId) { 
              setConversations(prev => [data as ChatConversation, ...prev.filter(c => c.id !== convId)]);
            } else {
              setConversations(prev => [data as ChatConversation, ...prev]);
            }
            setCurrentConversationId(data.id);
            convId = data.id;
        }
    }

    try {
        const internalModel = selectedModel === 'synergy-ia' ? 'gpt-4o-mini' : selectedModel;
        const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-chat', { body: { message: currentInput, model: internalModel, files: fileData.length > 0 ? fileData : undefined } });
        if (fnError) throw fnError;
        
        const data = fnData as any;
        let content = '';
        let reasoning = '';
        if (typeof data.response === 'string') {
            try {
                const parsed = JSON.parse(data.response);
                content = parsed.content || data.response;
                reasoning = parsed.reasoning || '';
            } catch {
                content = data.response;
            }
        } else {
            content = data.response?.content || 'Desculpe, não consegui processar sua mensagem.';
            reasoning = data.response?.reasoning || '';
        }

        const botMessage: Message = { id: (Date.now() + 1).toString(), content, sender: 'bot', timestamp: new Date(), model: selectedModel, reasoning: reasoning || undefined };
        const finalMessages = [...newMessages, botMessage];
        setMessages(finalMessages);
        await upsertConversation(finalMessages, convId);
    } catch (error) {
        console.error('Error sending message:', error);
        toast({ title: "Erro", description: "Não foi possível enviar a mensagem. Tente novamente.", variant: "destructive" });
        setMessages(newMessages); 
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleModelSelect = async (newModel: string) => {
    if (newModel === selectedModel) return;
    createNewConversation();
    setSelectedModel(newModel);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newFiles = files.filter(file => {
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: `${file.name} é maior que 50MB`, variant: "destructive" });
        return false;
      }
      return true;
    });

    // Process PDFs
    for (const file of newFiles.filter(f => f.type === 'application/pdf')) {
      try {
        const result = await PdfProcessor.processPdf(file);
        if (result.success && result.content) {
          setProcessedPdfs(prev => new Map(prev.set(file.name, result.content)));
        } else {
          toast({ title: "Erro", description: result.error || `Não foi possível processar ${file.name}`, variant: "destructive" });
        }
      } catch (error) {
        console.error('Error processing PDF:', error);
        toast({ title: "Erro", description: `Não foi possível processar ${file.name}`, variant: "destructive" });
      }
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      recordingTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, 30000); // 30 seconds max

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({ title: "Erro", description: "Não foi possível iniciar a gravação", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: formData,
      });

      if (error) throw error;
      
      if (data?.text) {
        setInputValue(prev => prev + (prev ? ' ' : '') + data.text);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast({ title: "Erro", description: "Não foi possível transcrever o áudio", variant: "destructive" });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado!", description: "Texto copiado para a área de transferência" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar o texto", variant: "destructive" });
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...attachedFiles];
    const removedFile = newFiles.splice(index, 1)[0];
    setAttachedFiles(newFiles);
    
    if (removedFile.type === 'application/pdf') {
      setProcessedPdfs(prev => {
        const newMap = new Map(prev);
        newMap.delete(removedFile.name);
        return newMap;
      });
    }
  };

  // --- RENDERIZAÇÃO ---
  if (loading) return <div className="h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div></div>;
  if (!user || !profile) return null;

  return (
    <div className="h-screen max-h-screen bg-background flex flex-col">
      <header className="flex-shrink-0 border-b border-border">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <h1 className="text-lg font-semibold text-foreground">Synergy Chat</h1>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ModelSelector onModelSelect={handleModelSelect} selectedModel={selectedModel} />
            <ThemeToggle />
            <UserProfile />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <ModelSelector onModelSelect={handleModelSelect} selectedModel={selectedModel} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tema</span>
                  <ThemeToggle />
                </div>
                <UserProfile />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR DE CONVERSAS - DESKTOP */}
        <div className="hidden lg:flex w-80 flex-shrink-0">
          <div className="w-full border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <Button onClick={createNewConversation} className="w-full h-11 justify-center gap-2 text-base font-medium">
                <Plus className="h-5 w-5" />
                Novo Chat
              </Button>
            </div>
            <ConversationSidebar
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={openConversation}
              onNewConversation={createNewConversation}
              onDeleteConversation={deleteConversation}
              onToggleFavorite={toggleFavoriteConversation}
            />
          </div>
        </div>

        {/* SIDEBAR DE CONVERSAS - MOBILE */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="lg:hidden fixed top-20 left-4 z-10 bg-background/80 backdrop-blur-sm border">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle>Conversas</SheetTitle>
            </SheetHeader>
            <div className="p-4 border-b border-border">
              <SheetClose asChild>
                <Button onClick={createNewConversation} className="w-full h-11 justify-center gap-2 text-base font-medium">
                  <Plus className="h-5 w-5" />
                  Novo Chat
                </Button>
              </SheetClose>
            </div>
            <ConversationSidebar
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={openConversation}
              onNewConversation={createNewConversation}
              onDeleteConversation={deleteConversation}
              onToggleFavorite={toggleFavoriteConversation}
              isMobile={true}
            />
          </SheetContent>
        </Sheet>

        {/* ÁREA PRINCIPAL DE CHAT */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1" ref={chatContainerRef}>
            <div className="container max-w-4xl mx-auto p-4 space-y-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                  <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full p-6 mb-6">
                    <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Bem-vindo ao Synergy Chat</h2>
                  <p className="text-muted-foreground max-w-md">
                    Comece uma conversa com nossa IA avançada. Faça perguntas, peça ajuda ou explore ideias criativas!
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className={message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}>
                          {message.sender === 'user' ? 'U' : 'AI'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`rounded-lg p-4 ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {message.files && message.files.length > 0 && (
                          <div className="mb-3 space-y-1">
                            {message.files.map((file, index) => (
                              <div key={index} className="flex items-center gap-2 text-xs opacity-80">
                                <Paperclip className="h-3 w-3" />
                                <span>{file.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        {message.reasoning && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedReasoning(prev => ({
                                ...prev,
                                [message.id]: !prev[message.id]
                              }))}
                              className="text-xs h-6 px-2"
                            >
                              {expandedReasoning[message.id] ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Ocultar raciocínio
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Ver raciocínio
                                </>
                              )}
                            </Button>
                            {expandedReasoning[message.id] && (
                              <div className="mt-2 text-xs opacity-75">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {message.reasoning}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                          <div className="flex items-center gap-2 text-xs opacity-60">
                            {message.model && (
                              <span>
                                {getModelDisplayName(message.model)}
                              </span>
                            )}
                            <span>
                              {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {message.sender === 'bot' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(message.content)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[80%]">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">AI</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* BOTÃO SCROLL TO BOTTOM */}
          {showScrollToBottom && (
            <Button
              variant="outline"
              size="icon"
              className="fixed bottom-24 right-6 rounded-full shadow-lg z-10"
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}

          {/* ÁREA DE INPUT */}
          <div className="flex-shrink-0 border-t border-border bg-background">
            <div className="container max-w-4xl mx-auto p-4">
              {attachedFiles.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4" />
                      <span className="truncate max-w-32">{file.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-5 w-5 p-0">
                        <span className="text-xs">✕</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="min-h-[52px] max-h-32 resize-none pr-20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                  <div className="absolute right-2 bottom-2 flex gap-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      className="hidden"
                      accept="image/*,application/pdf,.doc,.docx,.txt"
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 w-8 p-0"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Anexar arquivo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`h-8 w-8 p-0 ${isRecording ? 'text-red-500' : ''}`}
                          >
                            <Mic className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isRecording ? 'Parar gravação' : 'Gravar áudio'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsWebSearchMode(!isWebSearchMode)}
                            className={`h-8 w-8 p-0 ${isWebSearchMode ? 'text-primary' : ''}`}
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isWebSearchMode ? 'Desativar busca web' : 'Ativar busca web'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <Button type="submit" disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)} className="px-6">
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </form>
              
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Tokens: {tokenBalance.toLocaleString()} | Custo: {getTokenCost(selectedModel)} tokens
                </span>
                {isWebSearchMode && (
                  <span className="text-primary">🌐 Busca web ativada</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;