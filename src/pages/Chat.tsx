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

  const ItemWrapper = isMobile ? SheetClose : React.Fragment;

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
                {favorites.map(conv => <ItemWrapper key={conv.id}>{renderItem(conv)}</ItemWrapper>)}
              </div>
            </>
          )}
          <h4 className="px-2 pt-4 pb-2 text-xs font-semibold text-muted-foreground">Recentes</h4>
          <div className="space-y-1">
             {recents.map(conv => <ItemWrapper key={conv.id}>{renderItem(conv)}</ItemWrapper>)}
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
            setConversations(prev => prev.map(c => c.id === newConvId ? data : c));
        } else {
            setCurrentConversationId(data.id);
            setConversations(prev => [data, ...prev]);
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
        setConversations(prev => [data, ...prev.filter(c => c.id !== data.id)]);
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
    else if (data) setConversations(prev => prev.map(c => c.id === data.id ? data : c).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
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
              setConversations(prev => [data, ...prev.filter(c => c.id !== convId)]);
            } else {
              setConversations(prev => [data, ...prev]);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const startRecording = async () => { /* ... */ };
  const stopRecording = () => { /* ... */ };
  const transcribeAudio = async (audioBlob: Blob) => { /* ... */ };

  // --- RENDERIZAÇÃO ---
  if (loading) return <div className="h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div></div>;
  if (!user || !profile) return null;

  return (
    <div className="h-screen max-h-screen bg-background flex flex-col">
      <header className="flex-shrink-0 border-b border-border">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <h1 className="text-lg font-semibold text-foreground">Synergy Chat</h1>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <UserProfile />
            <ThemeToggle />
          </div>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-xs p-0 flex flex-col">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="p-4 space-y-4">
                  <UserProfile />
                  <SheetClose asChild>
                    <Button className="w-full" onClick={createNewConversation}>
                      <Plus className="h-5 w-4 mr-2" /> Novo chat
                    </Button>
                  </SheetClose>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Modelo</div>
                    <ModelSelector onModelSelect={handleModelSelect} selectedModel={selectedModel} />
                  </div>
                </div>
                <div className="flex-1 flex flex-col overflow-hidden border-t">
                  <ConversationSidebar
                    conversations={conversations}
                    currentConversationId={currentConversationId}
                    onSelectConversation={openConversation}
                    onNewConversation={createNewConversation}
                    onDeleteConversation={deleteConversation}
                    onToggleFavorite={toggleFavoriteConversation}
                    isMobile={true}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-row overflow-hidden">
        <aside className="w-80 flex-shrink-0 hidden md:flex flex-col bg-background">
          <Button onClick={createNewConversation} size="lg" className="m-3">
            <Plus className="w-4 h-4 mr-2" />
            Novo Chat
          </Button>
          <ConversationSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={openConversation}
            onNewConversation={createNewConversation}
            onDeleteConversation={deleteConversation}
            onToggleFavorite={toggleFavoriteConversation}
          />
        </aside>

        <main className="flex-1 flex flex-col bg-muted/30">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 space-y-4">
              {messages.length === 0 && !isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground" style={{minHeight: 'calc(100vh - 250px)'}}>
                    <div className="text-center">
                        <h3 className="text-2xl font-bold mb-2">Olá, {profile.name}!</h3>
                        <p>Selecione uma conversa ou inicie uma nova.</p>
                        <p className="mt-2 text-sm">Você tem {tokenBalance.toLocaleString()} tokens disponíveis.</p>
                    </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                    {message.sender === 'bot' && (
                      <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback></Avatar>
                    )}
                    <div className={`max-w-[85%] rounded-lg px-4 py-3 ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background shadow-sm'}`}>
                      <div className="space-y-3">
                        {message.files && (<div className="flex flex-wrap gap-2">{message.files.map((file, idx) => (<div key={idx} className="bg-primary-foreground/10 px-3 py-1 rounded-full text-xs">📎 {file.name}</div>))}</div>)}
                        {message.reasoning && (
                          <div className="border-b border-border/50 pb-2">
                            <Button variant="ghost" size="sm" onClick={() => setExpandedReasoning(p => ({ ...p, [message.id]: !p[message.id] }))} className="h-auto p-1 text-xs opacity-70 hover:opacity-100">
                              {expandedReasoning[message.id] ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />} Raciocínio
                            </Button>
                            {expandedReasoning[message.id] && <div className="mt-2 text-xs opacity-80 bg-muted rounded p-2 whitespace-pre-wrap">{message.reasoning}</div>}
                          </div>
                        )}
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none break-words">
                           <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({ node, ...props }) => <h1 className="font-bold text-lg mb-3 mt-4 first:mt-0" {...props} />,
                                  h2: ({ node, ...props }) => <h2 className="font-bold text-base mb-2 mt-4 first:mt-0" {...props} />,
                                  h3: ({ node, ...props }) => <h3 className="font-bold text-sm mb-2 mt-3 first:mt-0" {...props} />,
                                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                  ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-3 space-y-1" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-3 space-y-1" {...props} />,
                                  code: ({ node, inline, ...props }) => 
                                    inline 
                                    ? <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props} /> 
                                    : <pre className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto my-3" {...props} />,
                                }}
                              >{message.content}</ReactMarkdown>
                          {message.isStreaming && <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />}
                        </div>
                        {message.sender === 'bot' && !isLoading && (
                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                             <p className="text-xs opacity-70">{getModelDisplayName(message.model)}</p>
                             <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(message.content); toast({ title: "Copiado!" }); }} className="h-7 w-7 text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></Button>
                             </TooltipTrigger><TooltipContent>Copiar</TooltipContent></Tooltip></TooltipProvider>
                          </div>
                        )}
                      </div>
                    </div>
                    {message.sender === 'user' && (
                      <Avatar className="h-8 w-8 shrink-0"><AvatarFallback>U</AvatarFallback></Avatar>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-3"><Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback></Avatar><div className="bg-muted rounded-lg px-4 py-2 flex items-center"><div className="flex space-x-1"><div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-current rounded-full animate-bounce"></div></div></div></div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {showScrollToBottom && (
            <Button onClick={scrollToBottom} variant="outline" size="icon" className="absolute bottom-24 right-6 h-10 w-10 rounded-full shadow-lg z-20">
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}

          <div className="flex-shrink-0 border-t border-border bg-background p-4">
            <div className="max-w-4xl mx-auto">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="bg-muted px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        📎 {file.name}
                        <button onClick={() => { setAttachedFiles(p => p.filter((_, i) => i !== idx)); if (file.type === 'application/pdf') setProcessedPdfs(p => { const n = new Map(p); n.delete(file.name); return n; }); }} className="text-muted-foreground hover:text-foreground text-lg leading-none -mr-1">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,.pdf,.doc,.docx" />
                  <div className="absolute left-2 top-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="mb-2">
                            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer"><Paperclip className="h-4 w-4 mr-2" />Anexar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsWebSearchMode(p => !p)} className="cursor-pointer"><Globe className="h-4 w-4 mr-2" />{isWebSearchMode ? 'Desativar Busca Web' : 'Busca Web'}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isWebSearchMode ? "Digite para buscar na web..." : "Pergunte alguma coisa..."}
                    disabled={isLoading}
                    className="w-full pl-14 pr-24 py-3 rounded-lg resize-none min-h-[52px]"
                    rows={1}
                    onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 128)}px`; }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isMobile && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); } }}
                  />
                  <div className="absolute right-3 top-3 flex gap-1">
                    <TooltipProvider><Tooltip><TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" onClick={isRecording ? stopRecording : startRecording} className={`h-8 w-8 ${isRecording ? 'text-red-500' : ''}`}><Mic className="h-4 w-4" /></Button>
                    </TooltipTrigger><TooltipContent>Gravar áudio</TooltipContent></Tooltip></TooltipProvider>
                    <Button type="submit" disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)} size="icon" className="h-8 w-8 rounded-full">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Chat;