import { ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<{ [key: string]: boolean }>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Load user conversations when authenticated
  useEffect(() => {
    if (!loading && user) {
      (async () => {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('*')
          .order('updated_at', { ascending: false });
        if (error) {
          console.error('Erro ao carregar conversas:', error);
        } else if (data) {
          setConversations(data as any);
        }
      })();
    }
  }, [user, loading]);

  // Auto scroll to bottom when messages change and handle scroll button visibility
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle scroll detection for scroll-to-bottom button
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollToBottom(!isNearBottom && messages.length > 0);
    };
    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Select default model on page load if none
  useEffect(() => {
    if (!selectedModel) {
      setSelectedModel('synergy-ia');
    }
  }, [selectedModel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      // Validate file types and sizes
      const isValidType = file.type.startsWith('image/') ||
        file.type.includes('pdf') ||
        file.type.includes('word') ||
        file.type.includes('document') ||
        file.name.endsWith('.doc') ||
        file.name.endsWith('.docx');
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit for PDFs
      if (!isValidType) {
        continue;
      }
      if (!isValidSize) {
        continue;
      }
      // Add file to attached files first
      setAttachedFiles(prev => [...prev, file]);
      // Process PDF files in background
      if (file.type === 'application/pdf') {
        try {
          const result = await PdfProcessor.processPdf(file);
          if (result.success) {
            setProcessedPdfs(prev => new Map(prev).set(file.name, result.content || ''));
          } else {
            toast({
              title: "Erro ao processar PDF",
              description: result.error || `Não foi possível processar o arquivo ${file.name}.`,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Erro ao processar PDF:', error);
          toast({
            title: "Erro ao processar PDF",
            description: `Não foi possível processar o arquivo ${file.name}.`,
            variant: "destructive",
          });
        }
      }
    }
    // Reset the input after processing all files to allow re-uploading the same files
    if (event.target) {
      event.target.value = '';
    }
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
      // Enforce max 30s recording
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, 30000);
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
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
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
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível transcrever o áudio.",
        variant: "destructive",
      });
    }
  };

  const toSerializable = (msgs: Message[]) => msgs.map(m => ({
    id: m.id,
    content: m.content,
    sender: m.sender,
    timestamp: m.timestamp.toISOString(),
    model: m.model,
    reasoning: m.reasoning,
  }));

  const fromSerializable = (msgs: any[]): Message[] =>
    (msgs || []).map((m) => ({
      id: m.id,
      content: m.content,
      sender: m.sender,
      timestamp: new Date(m.timestamp),
      model: m.model,
      reasoning: m.reasoning,
    }));

  const deriveTitle = (msgs: Message[]) => {
    const firstUser = msgs.find(m => m.sender === 'user');
    const base = firstUser?.content?.trim() || 'Nova conversa';
    return base.slice(0, 60);
  };

  const openConversation = (conv: ChatConversation) => {
    setCurrentConversationId(conv.id);
    setMessages(fromSerializable(conv.messages));
  };

  const createNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const upsertConversation = async (finalMessages: Message[]) => {
    try {
      const serial = toSerializable(finalMessages);
      if (!currentConversationId) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: user.id,
            title: deriveTitle(finalMessages),
            messages: serial,
          })
          .select('*')
          .single();
        if (error) {
          console.error('Erro ao criar conversa:', error);
        } else if (data) {
          setCurrentConversationId(data.id);
          setConversations((prev) => [data as any, ...prev]);
        }
      } else {
        const currentConv = conversations.find(c => c.id === currentConversationId);
        const shouldRename =
          !currentConv ||
          currentConv.title === 'Nova conversa' ||
          (Array.isArray(currentConv.messages) && (currentConv.messages as any[]).length === 0);
        const updatePayload: any = { messages: serial };
        if (shouldRename && finalMessages.some(m => m.sender === 'user')) {
          updatePayload.title = deriveTitle(finalMessages);
        }
        const { data, error } = await supabase
          .from('chat_conversations')
          .update(updatePayload)
          .eq('id', currentConversationId)
          .select('*')
          .single();
        if (error) {
          console.error('Erro ao atualizar conversa:', error);
        } else if (data) {
          setConversations((prev) => {
            const without = prev.filter(c => c.id !== data.id);
            return [data as any, ...without];
          });
        }
      }
    } catch (e) {
      console.error('Erro ao salvar conversa:', e);
    }
  };

  const toggleFavoriteConversation = async (conv: ChatConversation) => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .update({ is_favorite: !conv.is_favorite })
      .eq('id', conv.id)
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar favorito.', variant: 'destructive' });
    } else if (data) {
      setConversations((prev) => prev.map(c => c.id === data.id ? (data as any) : c));
    }
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir a conversa.', variant: 'destructive' });
      return;
    }
    setConversations((prev) => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  };

  const toggleWebSearchMode = () => {
    setIsWebSearchMode(prev => !prev);
  };

  const performWebSearch = async (query: string) => {
    try {
      setIsLoading(true);
      const base = messages;
      const baseTime = Date.now();
      const userMessage: Message = {
        id: baseTime.toString(),
        content: query,
        sender: 'user',
        timestamp: new Date(),
      };
      const loadingId = (baseTime + 1).toString();
      const loadingMessage: Message = {
        id: loadingId,
        content: 'Buscando na web',
        sender: 'bot',
        timestamp: new Date(),
        model: 'Busca Web',
      };
      setMessages([...base, userMessage, loadingMessage]);
      const response = await supabase.functions.invoke('web-search', {
        body: { query, numResults: 3 }
      });
      let searchContent = 'Sem resultados.';
      if (response.data?.results) {
        const searchResults = response.data.results
          .map((result: any) => `${result.title}: ${result.content}`)
          .join('\n\n');
        searchContent = `[Resultados da busca na web para "${query}"]\n\n${searchResults}`;
      }
      const searchMessage: Message = {
        id: loadingId,
        content: searchContent,
        sender: 'bot',
        timestamp: new Date(),
        model: 'Busca Web',
      };
      const withLoading = [...base, userMessage, loadingMessage];
      const finalMessages = withLoading.map(m => (m.id === loadingId ? searchMessage : m));
      setMessages(finalMessages);
      await upsertConversation(finalMessages);
      toast({
        title: 'Busca concluída',
        description: response.data?.results ? 'Resultados da busca na web encontrados' : 'Nenhum resultado encontrado.',
        variant: response.data?.results ? undefined : 'destructive',
      });
    } catch (error) {
      console.error('Web search error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível realizar a busca na web.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return;
    const currentInput = inputValue;
    const currentFiles = [...attachedFiles];
    setInputValue('');
    setAttachedFiles([]);
    setProcessedPdfs(new Map());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (isWebSearchMode) {
      await performWebSearch(currentInput);
      return;
    }
    const canProceed = await consumeTokens(selectedModel, currentInput);
    if (!canProceed) {
      return;
    }
    const fileData = await Promise.all(
      currentFiles.map(async (file) => {
        const baseData = {
          name: file.name,
          type: file.type,
          data: await fileToBase64(file),
        };
        if (file.type === 'application/pdf') {
          const pdfContent = processedPdfs.get(file.name);
          return {
            ...baseData,
            pdfContent: pdfContent || '',
          };
        }
        return baseData;
      })
    );
    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentInput,
      sender: 'user',
      timestamp: new Date(),
      files: currentFiles.length > 0 ? currentFiles.map(f => ({ name: f.name, type: f.type })) : undefined,
    };
    const messagesAfterUser = [...messages, userMessage];
    setMessages(messagesAfterUser);
    setIsLoading(true);
    try {
      const internalModel = selectedModel === 'synergy-ia' ? 'gpt-4o-mini' : selectedModel;
      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: currentInput,
          model: internalModel,
          files: fileData.length > 0 ? fileData : undefined,
        },
      });
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
        content = data.response || 'Desculpe, não consegui processar sua mensagem.';
      }
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content,
        sender: 'bot',
        timestamp: new Date(),
        model: selectedModel,
        reasoning: reasoning || undefined,
      };
      const finalMessages = [...messagesAfterUser, botMessage];
      setMessages(finalMessages);
      await upsertConversation(finalMessages);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
      await upsertConversation(messagesAfterUser);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelSelect = async (newModel: string) => {
    if (newModel === selectedModel) return;
    if (messages.length > 0) {
      await upsertConversation(messages);
    }
    setSelectedModel(newModel);
    setMessages([]);
    setInputValue('');
    setAttachedFiles([]);
    setProcessedPdfs(new Map());
    setExpandedReasoning({});
    setIsWebSearchMode(false);
    setCurrentConversationId(null);
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: 'Nova conversa',
          messages: [],
        })
        .select('*')
        .single();
      if (error) {
        console.error('Erro ao criar nova conversa ao trocar de modelo:', error);
      } else if (data) {
        setCurrentConversationId(data.id);
        setConversations((prev) => [data as any, ...prev]);
      }
    } catch (err) {
      console.error('Erro inesperado ao criar nova conversa:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 py-1">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold text-foreground">Synergy Chat</h1>
            <Button variant="outline" size="sm" className="ml-2 hidden md:inline-flex" onClick={createNewConversation}>
              <Plus className="h-4 w-4 mr-1" /> Novo chat
            </Button>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <ModelSelector onModelSelect={handleModelSelect} selectedModel={selectedModel} />
            <ThemeToggle />
            <UserProfile />
          </div>
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 sm:w-80">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <SheetClose asChild>
                    <Button className="w-full" onClick={createNewConversation}>
                      <Plus className="h-4 w-4 mr-2" /> Novo chat
                    </Button>
                  </SheetClose>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Modelo</div>
                    <ModelSelector onModelSelect={handleModelSelect} selectedModel={selectedModel} />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Histórico</div>
                    <div className="mb-3">
                      <input placeholder="Pesquisar conversas..." className="w-full h-9 rounded-md border bg-background px-3 text-sm" onChange={() => { }} />
                    </div>
                    <ScrollArea className="max-h-[60vh] pr-2">
                      {conversations.filter(c => c.is_favorite).map((c) => (
                        <SheetClose asChild key={c.id}>
                          <button onClick={() => openConversation(c)} className={`w-full text-left px-2 py-2 flex items-center justify-between hover:bg-muted ${currentConversationId === c.id ? 'bg-muted' : ''}`}>
                            <span className="truncate text-sm">{c.title}</span>
                            <span className="flex items-center gap-2">
                              <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); toggleFavoriteConversation(c); }}>
                                <Star className="h-4 w-4 transition-colors transform-none text-yellow-500" fill="currentColor" strokeWidth={0} />
                              </button>
                              <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>
                                <Trash2 className="h-4 w-4 transition-colors group-hover:text-red-500" />
                              </button>
                            </span>
                          </button>
                        </SheetClose>
                      ))}
                      <div className="px-1 pt-3 pb-2 text-xs text-muted-foreground">Recentes</div>
                      {conversations.filter(c => !c.is_favorite).map((c) => (
                        <SheetClose asChild key={c.id}>
                          <button onClick={() => openConversation(c)} className={`w-full text-left px-2 py-2 flex items-center justify-between hover:bg-muted ${currentConversationId === c.id ? 'bg-muted' : ''}`}>
                            <span className="truncate text-sm">{c.title}</span>
                            <span className="flex items-center gap-2">
                              <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); toggleFavoriteConversation(c); }}>
                                <Star className={`h-4 w-4 transition-colors transform-none ${c.is_favorite ? 'text-yellow-500' : 'text-muted-foreground group-hover:text-yellow-500'}`} fill={c.is_favorite ? 'currentColor' : 'none'} strokeWidth={c.is_favorite ? 0 : 2} />
                              </button>
                              <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>
                                <Trash2 className="h-4 w-4 transition-colors group-hover:text-red-500" />
                              </button>
                            </span>
                          </button>
                        </SheetClose>
                      ))}
                    </ScrollArea>
                  </div>
                  <div>
                    <UserProfile />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      {/* Main Body (Sidebar + Chat Area) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations Sidebar */}
        <aside className="w-72 border-r border-border bg-background hidden md:flex md:flex-col">
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border shrink-0">
              <input placeholder="Pesquisar conversas..." className="w-full h-9 rounded-md border bg-background px-3 text-sm" onChange={() => { }} />
            </div>
            <ScrollArea className="flex-1 pr-2">
              <div className="p-3">
                <div className="pb-2 text-xs text-muted-foreground">Favoritos</div>
                {conversations.filter(c => c.is_favorite).length === 0 && (
                  <div className="py-2 text-xs text-muted-foreground">Nenhum favorito</div>
                )}
                {conversations.filter(c => c.is_favorite).map((c) => (
                  <button key={c.id} onClick={() => openConversation(c)} className={`w-full text-left px-3 py-2 mb-1 rounded flex items-center justify-between hover:bg-muted ${currentConversationId === c.id ? 'bg-muted' : ''}`}>
                    <span className="truncate text-sm">{c.title}</span>
                    <span className="flex items-center gap-2">
                      <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); toggleFavoriteConversation(c); }}>
                        <Star className="h-4 w-4 transition-colors transform-none text-yellow-500" fill="currentColor" strokeWidth={0} />
                      </button>
                      <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>
                        <Trash2 className="h-4 w-4 transition-colors group-hover:text-red-500" />
                      </button>
                    </span>
                  </button>
                ))}
                <div className="pt-3 pb-2 text-xs text-muted-foreground">Recentes</div>
                {conversations.filter(c => !c.is_favorite).map((c) => (
                  <button key={c.id} onClick={() => openConversation(c)} className={`w-full text-left px-3 py-2 mb-1 rounded flex items-center justify-between hover:bg-muted ${currentConversationId === c.id ? 'bg-muted' : ''}`}>
                    <span className="truncate text-sm">{c.title}</span>
                    <span className="flex items-center gap-2">
                      <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); toggleFavoriteConversation(c); }}>
                        <Star className={`h-4 w-4 transition-colors transform-none ${c.is_favorite ? 'text-yellow-500' : 'text-muted-foreground group-hover:text-yellow-500'}`} fill={c.is_favorite ? 'currentColor' : 'none'} strokeWidth={c.is_favorite ? 0 : 2} />
                      </button>
                      <button className="group relative h-6 w-6 flex items-center justify-center hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>
                        <Trash2 className="h-4 w-4 transition-colors group-hover:text-red-500" />
                      </button>
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </aside>
        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                  <div className="text-center">
                    <h3 className="text-lg font-medium mb-2">Olá, {profile.name}!</h3>
                    <p>Você tem {tokenBalance.toLocaleString()} tokens disponíveis</p>
                    <p className="mt-2">Faça uma pergunta para começar a conversar com a IA</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.sender === 'bot' && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 ${message.sender === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'}`}>
                      <div className="space-y-2">
                        {message.files && message.sender === 'user' && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {message.files.map((file, idx) => (
                              <div key={idx} className="bg-background/50 px-3 py-1 rounded-full text-xs">
                                📎 {file.name}
                              </div>
                            ))}
                          </div>
                        )}
                        {message.reasoning && message.sender === 'bot' && (
                          <div className="border-b border-border pb-2">
                            <Button variant="ghost" size="sm" onClick={() => setExpandedReasoning(prev => ({ ...prev, [message.id]: !prev[message.id] }))} className="h-auto p-1 text-xs opacity-70 hover:opacity-100">
                              {expandedReasoning[message.id] ? (<><ChevronUp className="h-3 w-3 mr-1" /> Ocultar raciocínio</>) : (<><ChevronDown className="h-3 w-3 mr-1" /> Mostrar raciocínio</>)}
                            </Button>
                            {expandedReasoning[message.id] && (<div className="mt-2 text-xs opacity-80 bg-background/50 rounded p-2 whitespace-pre-wrap">{message.reasoning}</div>)}
                          </div>
                        )}
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ node, ...props }) => <h1 className="font-bold text-lg mb-3 mt-4 first:mt-0 text-foreground" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="font-bold text-base mb-2 mt-4 first:mt-0 text-foreground" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="font-bold text-sm mb-2 mt-3 first:mt-0 text-foreground" {...props} />,
                              p: ({ node, ...props }) => <p className="mb-2 text-foreground leading-relaxed" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-3 space-y-1 text-foreground" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-3 space-y-1 text-foreground" {...props} />,
                              code: ({ node, ...props }) => <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono text-foreground" {...props} />,
                              pre: ({ node, ...props }) => <pre className="bg-muted p-3 rounded text-sm font-mono text-foreground overflow-x-auto mb-3" {...props} />,
                            }}
                          >{message.content}</ReactMarkdown>
                          {message.isStreaming && (<span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />)}
                        </div>
                        {message.model && message.sender === 'bot' && (
                          <p className="text-xs opacity-70 mt-1">{getModelDisplayName(message.model)} • {getTokenCost(message.model).toLocaleString()} tokens</p>
                        )}
                        {message.sender === 'bot' && (
                          <div className="mt-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(message.content); toast({ title: "Copiado", description: "Resposta copiada para a área de transferência." }); }} className="group h-7 w-7 p-0 hover:bg-muted hover-scale transition-colors">
                                    <Copy className="h-3 w-3 transition-transform group-hover:scale-110" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
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
                    <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
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
              <div ref={messagesEndRef} />
            </div>
          </div>
          {showScrollToBottom && (
            <Button onClick={scrollToBottom} className="absolute bottom-24 right-6 h-10 w-10 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-10" size="sm">
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
          <div className="border-t border-border bg-background p-4">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <div className="flex-1 relative">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted rounded-full">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="start" className="mb-2 bg-background border border-border shadow-lg z-50 min-w-[180px]">
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted">
                          <Paperclip className="h-4 w-4" />
                          <span>Anexar arquivo</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={toggleWebSearchMode} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted">
                          <Globe className="h-4 w-4" />
                          <span>{isWebSearchMode ? 'Desativar busca web' : 'Buscar na web'}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isWebSearchMode ? "Digite para buscar na web..." : "Pergunte alguma coisa"}
                    disabled={isLoading}
                    className="w-full pl-12 pr-24 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none min-h-[44px] max-h-32"
                    rows={1}
                    style={{ height: 'auto', minHeight: '44px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                      }
                    }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" onClick={isRecording ? stopRecording : startRecording} className={`h-8 w-8 p-0 hover:bg-muted rounded-full ${isRecording ? 'text-red-500' : ''}`}>
                            <Mic className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Grave uma mensagem de até 30s</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button type="submit" disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)} size="sm" className="h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90">
                      <ArrowUp className="h-4 w-4 text-primary-foreground" />
                    </Button>
                  </div>
                </div>
              </form>
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="bg-muted px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      📎 {file.name}
                      <button onClick={() => { setAttachedFiles(prev => prev.filter((_, i) => i !== idx)); if (file.type === 'application/pdf') { setProcessedPdfs(prev => { const newMap = new Map(prev); newMap.delete(file.name); return newMap; }); } }} className="text-red-500 hover:text-red-700 ml-1">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;