import { MessageCircle, ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown, MoreHorizontal, Edit3 } from "lucide-react";
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

// --- COMPONENTES FILHOS ---

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  currentConversationId: string | null;
  onSelectConversation: (conv: ChatConversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onToggleFavorite: (conv: ChatConversation) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
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

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favoriteConversations = filteredConversations.filter(conv => conv.is_favorite);
  const regularConversations = filteredConversations.filter(conv => !conv.is_favorite);

  const handleRename = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setEditingId(id);
      setEditingTitle(conversation.title);
    }
  };

  const handleSubmitRename = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editingTitle.trim()) {
      onRenameConversation(editingId!, editingTitle.trim());
      setEditingId(null);
      setEditingTitle('');
    }
    if (e.key === 'Escape') {
      setEditingId(null);
      setEditingTitle('');
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent, conv: ChatConversation) => {
    e.stopPropagation();
    onToggleFavorite(conv);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteConversation(id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Hoje';
    if (diffInDays === 1) return 'Ontem';
    if (diffInDays < 7) return `${diffInDays} dias atrás`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} semanas atrás`;
    return date.toLocaleDateString();
  };

  const ConversationItem = ({ conv }: { conv: ChatConversation }) => (
    <div
      key={conv.id}
      className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
        currentConversationId === conv.id
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted'
      }`}
      onClick={() => onSelectConversation(conv)}
    >
      <div className="flex-1 min-w-0">
        {editingId === conv.id ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={handleSubmitRename}
            onBlur={() => {
              setEditingId(null);
              setEditingTitle('');
            }}
            className="w-full bg-transparent border-none outline-none text-sm"
            autoFocus
          />
        ) : (
          <>
            <p className="text-sm font-medium truncate">{conv.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(conv.created_at)}</p>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => handleToggleFavorite(e, conv)}
          className={`h-7 w-7 p-0 ${conv.is_favorite ? 'text-yellow-500' : ''}`}
        >
          <Star className="h-3 w-3" fill={conv.is_favorite ? 'currentColor' : 'none'} />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => handleRename(e, conv.id)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => handleDelete(e, conv.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button
          onClick={onNewConversation}
          className="w-full mb-4"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Conversa
        </Button>
        
        <input
          type="text"
          placeholder="Buscar conversas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {favoriteConversations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Favoritos</h3>
              <div className="space-y-1">
                {favoriteConversations.map(conv => <ConversationItem key={conv.id} conv={conv} />)}
              </div>
            </div>
          )}
          
          {regularConversations.length > 0 && (
            <div>
              {favoriteConversations.length > 0 && (
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Conversas</h3>
              )}
              <div className="space-y-1">
                {regularConversations.map(conv => <ConversationItem key={conv.id} conv={conv} />)}
              </div>
            </div>
          )}
          
          {filteredConversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {conversations.length === 0 ? 'Nenhuma conversa ainda' : 'Nenhuma conversa encontrada'}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tokens, updateTokens } = useTokens();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showReasoning, setShowReasoning] = useState<{ [key: string]: boolean }>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive",
      });
    }
  };

  const createNewConversation = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: 'Nova Conversa',
          messages: [],
          is_favorite: false
        })
        .select()
        .single();

      if (error) throw error;

      setConversations(prev => [data, ...prev]);
      setCurrentConversationId(data.id);
      setMessages([]);
      setShowSidebar(false);
      
      toast({
        title: "Nova conversa criada",
        description: "Você pode começar a conversar agora!",
      });
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar uma nova conversa",
        variant: "destructive",
      });
    }
  };

  const updateConversationMessages = async (conversationId: string, newMessages: Message[]) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          messages: newMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, messages: newMessages, updated_at: new Date().toISOString() }
          : conv
      ));
    } catch (error) {
      console.error('Erro ao salvar mensagens:', error);
    }
  };

  const selectConversation = (conversation: ChatConversation) => {
    setCurrentConversationId(conversation.id);
    setMessages(conversation.messages || []);
    setShowSidebar(false);
  };

  const deleteConversation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setConversations(prev => prev.filter(conv => conv.id !== id));
      
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }

      toast({
        title: "Conversa excluída",
        description: "A conversa foi removida com sucesso",
      });
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conversa",
        variant: "destructive",
      });
    }
  };

  const toggleFavorite = async (conversation: ChatConversation) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ is_favorite: !conversation.is_favorite })
        .eq('id', conversation.id);

      if (error) throw error;

      setConversations(prev => prev.map(conv =>
        conv.id === conversation.id
          ? { ...conv, is_favorite: !conv.is_favorite }
          : conv
      ));

      toast({
        title: conversation.is_favorite ? "Removido dos favoritos" : "Adicionado aos favoritos",
        description: `A conversa foi ${conversation.is_favorite ? 'removida dos' : 'adicionada aos'} favoritos`,
      });
    } catch (error) {
      console.error('Erro ao alterar favorito:', error);
    }
  };

  const renameConversation = async (id: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ title: newTitle })
        .eq('id', id);

      if (error) throw error;

      setConversations(prev => prev.map(conv =>
        conv.id === id ? { ...conv, title: newTitle } : conv
      ));

      toast({
        title: "Conversa renomeada",
        description: "O título da conversa foi atualizado",
      });
    } catch (error) {
      console.error('Erro ao renomear conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível renomear a conversa",
        variant: "destructive",
      });
    }
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const processedFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.type === 'application/pdf') {
        try {
          const text = await PdfProcessor.extractText(file);
          processedFiles.push({
            name: file.name,
            type: file.type,
            data: text
          });
        } catch (error) {
          console.error('Erro ao processar PDF:', error);
          toast({
            title: "Erro",
            description: `Não foi possível processar o arquivo ${file.name}`,
            variant: "destructive",
          });
        }
      } else if (file.type.startsWith('text/') || file.type.startsWith('application/json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          processedFiles.push({
            name: file.name,
            type: file.type,
            data: e.target?.result as string
          });
        };
        reader.readAsText(file);
      } else {
        toast({
          title: "Tipo de arquivo não suportado",
          description: `O arquivo ${file.name} não é suportado`,
          variant: "destructive",
        });
      }
    }

    setAttachedFiles(prev => [...prev, ...processedFiles]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() && attachedFiles.length === 0) return;
    if (isLoading) return;
    if (!user) return;

    let conversationId = currentConversationId;

    if (!conversationId) {
      try {
        const { data, error } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: user.id,
            title: inputMessage.slice(0, 50) + (inputMessage.length > 50 ? '...' : ''),
            messages: [],
            is_favorite: false
          })
          .select()
          .single();

        if (error) throw error;

        conversationId = data.id;
        setCurrentConversationId(conversationId);
        setConversations(prev => [data, ...prev]);
      } catch (error) {
        console.error('Erro ao criar conversa:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar a conversa",
          variant: "destructive",
        });
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      files: attachedFiles.map(f => ({ name: f.name, type: f.type }))
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage("");
    setAttachedFiles([]);
    setIsLoading(true);

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "",
      sender: 'bot',
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true,
    };

    setMessages(prev => [...prev, botMessage]);

    try {
      let content = inputMessage;
      if (attachedFiles.length > 0) {
        content += "\n\n--- Arquivos anexados ---\n";
        attachedFiles.forEach(file => {
          content += `\n**${file.name}** (${file.type}):\n${file.data}\n`;
        });
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          message: content,
          model: selectedModel,
          conversation_history: messages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Erro na resposta da API');
      }

      const data = await response.json();
      
      botMessage.content = data.response;
      botMessage.reasoning = data.reasoning;
      botMessage.isStreaming = false;
      
      const finalMessages = [...newMessages, botMessage];
      setMessages(finalMessages);
      
      if (conversationId) {
        await updateConversationMessages(conversationId, finalMessages);
      }

      if (data.tokens_used) {
        updateTokens(-data.tokens_used);
      }
      
    } catch (error) {
      console.error('Erro:', error);
      botMessage.content = "Desculpe, ocorreu um erro. Tente novamente.";
      botMessage.isStreaming = false;
      setMessages(prev => [...prev.slice(0, -1), botMessage]);
      
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copiado!",
      description: "Mensagem copiada para a área de transferência",
    });
  };

  const toggleReasoning = (messageId: string) => {
    setShowReasoning(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const SidebarContent = () => (
    <ConversationSidebar
      conversations={conversations}
      currentConversationId={currentConversationId}
      onSelectConversation={selectConversation}
      onNewConversation={createNewConversation}
      onDeleteConversation={deleteConversation}
      onToggleFavorite={toggleFavorite}
      onRenameConversation={renameConversation}
      isMobile={isMobile}
    />
  );

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="w-80 border-r bg-card flex-shrink-0">
          <SidebarContent />
        </div>
      )}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Conversas</SheetTitle>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
              </Sheet>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {!isMobile && "Voltar"}
            </Button>
            
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h1 className="font-semibold">
                {currentConversation?.title || 'Chat AI'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
            <ThemeToggle />
            <UserProfile />
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-4">
                  Olá, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'}!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Selecione uma conversa ou inicie uma nova.
                </p>
                <p className="text-sm text-muted-foreground">
                  Você tem {tokens} tokens disponíveis.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-4">
              <div className="max-w-4xl mx-auto py-6 space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.sender === 'bot' && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          AI
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`flex flex-col gap-2 max-w-[80%] ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`rounded-lg px-4 py-3 ${
                          message.sender === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.files && message.files.length > 0 && (
                          <div className="mb-2 p-2 rounded border-l-2 border-primary/30 bg-primary/5">
                            <p className="text-xs font-medium mb-1">Arquivos anexados:</p>
                            {message.files.map((file, index) => (
                              <div key={index} className="flex items-center gap-2 text-xs">
                                <Paperclip className="h-3 w-3" />
                                <span>{file.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content || (message.isStreaming ? "Pensando..." : "")}
                          </ReactMarkdown>
                        </div>
                        
                        {message.reasoning && (
                          <div className="mt-3 pt-3 border-t border-primary/20">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleReasoning(message.id)}
                              className="h-7 px-2 text-xs"
                            >
                              {showReasoning[message.id] ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Ocultar Raciocínio
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Mostrar Raciocínio
                                </>
                              )}
                            </Button>
                            
                            {showReasoning[message.id] && (
                              <div className="mt-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                                <h4 className="text-xs font-semibold mb-2">Raciocínio da AI:</h4>
                                <div className="text-xs text-muted-foreground">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {message.reasoning}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{message.timestamp.toLocaleTimeString()}</span>
                        {message.model && (
                          <span className="px-2 py-1 rounded-md bg-muted text-xs">
                            {message.model}
                          </span>
                        )}
                        {message.sender === 'bot' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyMessage(message.content)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copiar mensagem</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                    
                    {message.sender === 'user' && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback>
                          {user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 flex-shrink-0">
          <div className="max-w-4xl mx-auto p-4">
            {attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-xs">
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachedFile(index)}
                      className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Pergunte alguma coisa..."
                  className="min-h-[50px] max-h-[120px] resize-none pr-20"
                  disabled={isLoading}
                />
                
                <div className="absolute right-2 top-2 flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleFileAttach}
                          className="h-8 w-8 p-0"
                          disabled={isLoading}
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
                          onClick={() => {
                            setIsRecording(!isRecording);
                            toast({
                              title: "Gravação de áudio",
                              description: "Funcionalidade em desenvolvimento",
                            });
                          }}
                          className={`h-8 w-8 p-0 ${isRecording ? 'text-destructive' : ''}`}
                          disabled={isLoading}
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Gravar áudio</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={(!inputMessage.trim() && attachedFiles.length === 0) || isLoading}
                className="h-[50px] px-4"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </form>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.json,.md,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;