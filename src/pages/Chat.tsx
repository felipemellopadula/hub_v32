import { MessageCircle, ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown, MoreHorizontal, Edit3 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import React, { useState, useRef, useEffect, useCallback } from "react";
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
  messages: any[]; // Idealmente, seria `Message[]`, mas `any[]` para compatibilidade com Supabase
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// --- COMPONENTES FILHOS ---

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  currentConversationId: string | null;
  onSelectConversation: (conv: ChatConversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onToggleFavorite: (conv: ChatConversation) => Promise<void>;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  isMobile?: boolean;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onToggleFavorite,
  onRenameConversation,
  isMobile = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = async (id: string) => {
    if (editingTitle.trim()) {
      await onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderContent = () => (
    <div className="flex flex-col h-full bg-background p-2">
      <div className="flex justify-between items-center p-2">
        <h2 className="text-lg font-semibold">Conversas</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onNewConversation} size="icon" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Nova Conversa</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="p-2">
        <input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded-md bg-input text-foreground"
        />
      </div>
      <ScrollArea className="flex-grow">
        <ul className="space-y-1 p-2">
          {filteredConversations.map(conv => (
            <li
              key={conv.id}
              className={`group flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent ${currentConversationId === conv.id ? 'bg-accent font-semibold' : ''}`}
              onClick={() => onSelectConversation(conv)}
            >
              {editingId === conv.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleSaveRename(conv.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)}
                  className="w-full bg-transparent border-b"
                  autoFocus
                />
              ) : (
                <span className="truncate flex-1">{conv.title}</span>
              )}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => handleRename(conv.id, conv.title)}>
                      <Edit3 className="mr-2 h-4 w-4" /> Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleFavorite(conv)}>
                      <Star className="mr-2 h-4 w-4" /> Favoritar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-500" onClick={() => onDeleteConversation(conv.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-80">
          {renderContent()}
        </SheetContent>
      </Sheet>
    );
  }

  return <div className="hidden md:block w-80 border-r">{renderContent()}</div>;
};

// --- COMPONENTE PRINCIPAL ---

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { tokens, spendTokens } = useTokens();
  const isMobile = useIsMobile();
  
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao buscar conversas", description: error.message, variant: "destructive" });
    }
  }, [user, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    // Auto-scroll para a última mensagem
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectConversation = (conv: ChatConversation) => {
    setCurrentConversation(conv);
    // Lógica para buscar as mensagens da conversa selecionada
    // Exemplo:
    // const fetchedMessages = await fetchMessagesForConversation(conv.id);
    // setMessages(fetchedMessages);
    setMessages(conv.messages || []); // Simulação
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setInput('');
    setAttachedFiles([]);
    navigate('/chat'); // ou a rota base do chat
  };

  const handleSendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input,
      sender: 'user',
      timestamp: new Date(),
      files: attachedFiles.map(f => ({ name: f.name, type: f.type })),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedFiles([]);
    
    let currentConvId = currentConversation?.id;

    try {
      // Se for uma nova conversa, cria ela primeiro
      if (!currentConvId) {
        const title = input.substring(0, 30) || "Nova Conversa";
        const { data, error } = await supabase
            .from('conversations')
            .insert({ user_id: user.id, title: title, messages: [userMessage] })
            .select()
            .single();
        
        if (error) throw error;
        currentConvId = data.id;
        setCurrentConversation(data);
        setConversations(prev => [data, ...prev]);
      }

      // TODO: Implementar chamada para a API de IA (backend)
      // A API receberia a mensagem, o histórico, e retornaria uma resposta em streaming
      
      // Simulação de resposta da IA
      await new Promise(res => setTimeout(res, 1500));
      const botResponse: Message = {
        id: `bot-${Date.now()}`,
        content: `Esta é uma resposta simulada para: "${userMessage.content}". A lógica real de streaming e API seria implementada aqui.`,
        sender: 'bot',
        timestamp: new Date(),
        model: 'gemini-pro',
      };

      setMessages(prev => [...prev, botResponse]);

      // Atualizar a conversa no Supabase com as novas mensagens
      const updatedMessages = [...messages, userMessage, botResponse];
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', currentConvId);
      
      if (updateError) throw updateError;
      
    } catch (error: any) {
        toast({ title: "Erro ao enviar mensagem", description: error.message, variant: "destructive" });
        // Reverter a mensagem do usuário em caso de erro
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      const { error } = await supabase.from('conversations').delete().eq('id', id);
      if (error) throw error;

      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) {
        handleNewConversation();
      }
      toast({ title: "Sucesso", description: "Conversa deletada." });
    } catch (error: any) {
      toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
    }
  };
  
  const handleToggleFavorite = async (conv: ChatConversation) => {
    // Lógica para favoritar/desfavoritar
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
        const { error } = await supabase
            .from('conversations')
            .update({ title: newTitle })
            .eq('id', id);
        
        if (error) throw error;

        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
        if (currentConversation?.id === id) {
            setCurrentConversation(prev => prev ? { ...prev, title: newTitle } : null);
        }
        toast({ title: "Sucesso", description: "Conversa renomeada." });
    } catch (error: any) {
        toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ConversationSidebar
        conversations={conversations}
        currentConversationId={currentConversation?.id || null}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onToggleFavorite={handleToggleFavorite}
        onRenameConversation={handleRenameConversation}
        isMobile={isMobile}
      />

      <main className="flex flex-col flex-1 h-full">
        {/* Cabeçalho do Chat */}
        <header className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft />
              </Button>
            )}
            <h2 className="text-lg font-semibold">{currentConversation?.title || "Nova Conversa"}</h2>
          </div>
          <div className="flex items-center gap-4">
            <ModelSelector />
            <ThemeToggle />
            <UserProfile />
          </div>
        </header>

        {/* Área de Mensagens */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Envie uma mensagem para começar.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    {msg.sender === 'bot' && (
                      <Avatar>
                        <AvatarFallback>IA</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose dark:prose-invert">
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isLoading && (
                   <div className="flex gap-3">
                      <Avatar>
                        <AvatarFallback>IA</AvatarFallback>
                      </Avatar>
                      <div className="max-w-xl p-3 rounded-lg bg-muted">
                        Digitando...
                      </div>
                   </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Área de Input */}
        <footer className="p-4 border-t">
          <div className="relative">
            <Textarea
              placeholder="Digite sua mensagem ou anexe um arquivo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="pr-24"
              rows={1}
            />
            <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex gap-2">
              <Button variant="ghost" size="icon">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button onClick={handleSendMessage} disabled={isLoading}>
                {isLoading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Chat;