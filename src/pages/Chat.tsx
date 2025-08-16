import { MessageCircle, ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown, MoreHorizontal, Edit3, X } from "lucide-react";
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
interface FileAttachment {
  name: string;
  type: string;
  content?: string; // Conteúdo processado, ex: texto extraído de PDF
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  reasoning?: string;
  isStreaming?: boolean;
  files?: FileAttachment[];
}

interface ChatConversation {
  id:string;
  user_id: string;
  title: string;
  messages: Message[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// --- SUBCOMPONENTES (para melhor organização) ---

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.sender === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'items-start'}`}>
      {!isUser && (
        <Avatar className="mt-1">
          <AvatarFallback>IA</AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-xl p-3 rounded-lg relative group ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose dark:prose-invert prose-p:my-0">
          {message.content}
        </ReactMarkdown>
        {message.files && message.files.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs font-semibold">Anexos:</p>
            <ul className="text-sm list-disc list-inside">
              {message.files.map((file, index) => <li key={index}>{file.name}</li>)}
            </ul>
          </div>
        )}
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

const ChatInputFooter: React.FC<{
  input: string;
  setInput: (value: string) => void;
  attachedFiles: File[];
  setAttachedFiles: (files: File[]) => void;
  isSending: boolean;
  onSendMessage: () => void;
}> = ({ input, setInput, attachedFiles, setAttachedFiles, isSending, onSendMessage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setAttachedFiles([...attachedFiles, ...Array.from(event.target.files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  return (
    <footer className="p-4 border-t">
      {attachedFiles.length > 0 && (
        <div className="mb-2 p-2 border rounded-md">
          <p className="text-sm font-medium mb-1">Anexos:</p>
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-muted p-1 rounded-md text-xs">
                <span>{file.name}</span>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleRemoveFile(index)}>
                  <X className="h-3 w-3"/>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="relative">
        <Textarea
          placeholder="Digite sua mensagem ou anexe um arquivo..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          className="pr-32"
          rows={1}
          disabled={isSending}
        />
        <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Anexar Arquivo</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple/>
          <Button onClick={onSendMessage} disabled={isSending || (!input.trim() && attachedFiles.length === 0)}>
            {isSending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </footer>
  );
};


// --- COMPONENTES FILHOS (Sidebar) ---

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
  const { tokens, spendTokens, fetchTokens } = useTokens();
  const isMobile = useIsMobile();
  
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchConversations();
    fetchTokens(); // busca os tokens do usuário ao carregar
  }, [fetchConversations, fetchTokens]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSelectConversation = (conv: ChatConversation) => {
    setCurrentConversation(conv);
    setMessages(conv.messages || []);
    navigate(`/chat/${conv.id}`);
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setInput('');
    setAttachedFiles([]);
    navigate('/chat');
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming) return;
    if (!user) {
      return toast({ title: "Erro de Autenticação", description: "Você precisa estar logado.", variant: "destructive" });
    }
    if (tokens !== null && tokens < 1) {
      return toast({ title: "Créditos Insuficientes", description: "Você não tem tokens para enviar uma mensagem.", variant: "destructive" });
    }
    
    setIsLoading(true);

    const processedFiles: FileAttachment[] = [];
    for (const file of attachedFiles) {
        if (file.type === "application/pdf") {
            const textContent = await PdfProcessor.extractText(file);
            processedFiles.push({ name: file.name, type: file.type, content: textContent });
        } else {
            processedFiles.push({ name: file.name, type: file.type });
        }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input,
      sender: 'user',
      timestamp: new Date(),
      files: processedFiles,
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setAttachedFiles([]);
    
    let conversationId = currentConversation?.id;

    try {
      // Cria a conversa se não existir
      if (!conversationId) {
        const title = input.substring(0, 30) || "Nova Conversa";
        const { data: newConvData, error } = await supabase
            .from('conversations')
            .insert({ user_id: user.id, title, messages: [userMessage] })
            .select()
            .single();
        if (error) throw error;
        conversationId = newConvData.id;
        setCurrentConversation(newConvData);
        setConversations(prev => [newConvData, ...prev]);
      }

      // Adiciona a mensagem de bot vazia para o streaming
      const botMessageId = `bot-${Date.now()}`;
      const botMessagePlaceholder: Message = {
          id: botMessageId,
          content: '▍',
          sender: 'bot',
          timestamp: new Date(),
          isStreaming: true,
      };
      setMessages(prev => [...prev, botMessagePlaceholder]);
      setIsStreaming(true);

      // --- LÓGICA DE STREAMING (SIMULAÇÃO) ---
      // No mundo real, você usaria fetch com um ReadableStream ou Server-Sent Events
      const responseStream = ["Esta ", "é ", "uma ", "resposta ", "em ", "tempo ", "real, ", "simulando ", "o ", "streaming ", "de ", "uma ", "API ", "de ", "IA. "];
      let fullResponse = "";
      for (const chunk of responseStream) {
          await new Promise(res => setTimeout(res, 50)); // Simula latência de rede
          fullResponse += chunk;
          setMessages(prev => prev.map(m => 
              m.id === botMessageId ? { ...m, content: fullResponse + '▍' } : m
          ));
      }

      const finalBotMessage: Message = {
          ...botMessagePlaceholder,
          content: fullResponse,
          isStreaming: false,
      };

      const finalMessages = [...newMessages, finalBotMessage];
      setMessages(finalMessages);

      // Atualizar conversa no Supabase
      await supabase
        .from('conversations')
        .update({ messages: finalMessages, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      spendTokens(1); // Deduz 1 token (ou a lógica de custo que preferir)

    } catch (error: any) {
        toast({ title: "Erro ao enviar mensagem", description: error.message, variant: "destructive" });
        setMessages(messages); // Reverte para o estado anterior em caso de erro
    } finally {
        setIsLoading(false);
        setIsStreaming(false);
    }
  };

  // Funções de CRUD para conversas
  const handleDeleteConversation = async (id: string) => {
    try {
      const { error } = await supabase.from('conversations').delete().eq('id', id);
      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) handleNewConversation();
      toast({ title: "Sucesso", description: "Conversa deletada." });
    } catch (error: any) {
      toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
    }
  };
  
  const handleToggleFavorite = async (conv: ChatConversation) => {
    // Implementar lógica de favoritar
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
        const { error } = await supabase.from('conversations').update({ title: newTitle }).eq('id', id);
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
        <header className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft />
              </Button>
            )}
            <h2 className="text-lg font-semibold truncate">{currentConversation?.title || "Nova Conversa"}</h2>
          </div>
          <div className="flex items-center gap-4">
            <ModelSelector />
            <ThemeToggle />
            <UserProfile />
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Envie uma mensagem para começar.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
              </div>
            )}
          </ScrollArea>
        </div>

        <ChatInputFooter
          input={input}
          setInput={setInput}
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
          isSending={isLoading || isStreaming}
          onSendMessage={handleSendMessage}
        />
      </main>
    </div>
  );
};

export default Chat;