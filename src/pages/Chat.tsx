import { MessageCircle, ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown, MoreHorizontal, Edit3, Square, Check, FileText, File, Image, Share, RefreshCw } from "lucide-react";
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
import { WordProcessor } from "@/utils/WordProcessor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import MarkdownRenderer from "@/components/MarkdownRenderer";

// --- INTERFACES ---
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  reasoning?: string;
  isStreaming?: boolean;
  files?: { name: string; type: string; url?: string }[];
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
  
  const handleRename = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTitle = prompt("Digite o novo título da conversa:");
    if (newTitle && newTitle.trim()) {
      onRenameConversation(id, newTitle.trim());
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderItem = (conv: ChatConversation) => (
    <div
      key={conv.id}
      className={`group relative rounded-lg p-3 cursor-pointer transition-colors duration-200 ${
        currentConversationId === conv.id ? "bg-muted" : "hover:bg-muted/50"
      }`}
      onClick={() => onSelectConversation(conv)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">{conv.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(conv.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(conv); }}>
                <Star className={`h-4 w-4 mr-2 ${conv.is_favorite ? 'text-yellow-500' : ''}`} />
                {conv.is_favorite ? 'Desfavoritar' : 'Favoritar'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleRename(e, conv.id)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
  
  const favorites = filteredConversations.filter(c => c.is_favorite);
  const recents = filteredConversations.filter(c => !c.is_favorite);

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      <div className="p-4 border-b border-border flex flex-col gap-4 flex-shrink-0">
        <Button onClick={onNewConversation} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          Novo Chat
        </Button>
        <input
          placeholder="Pesquisar conversas..."
          className="w-full h-9 rounded-md border bg-muted px-3 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
            {favorites.length > 0 && (
                <>
                    <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">Favoritos</h4>
                    {favorites.map(conv => isMobile ? <SheetClose asChild key={conv.id}>{renderItem(conv)}</SheetClose> : renderItem(conv))}
                </>
            )}
            <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">Recentes</h4>
            {recents.map(conv => isMobile ? <SheetClose asChild key={conv.id}>{renderItem(conv)}</SheetClose> : renderItem(conv))}
            
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
  const { consumeTokens, getModelDisplayName, tokenBalance } = useTokens();
  const isMobile = useIsMobile();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWebSearchMode, setIsWebSearchMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<Map<string, string>>(new Map());
  const [processedPdfs, setProcessedPdfs] = useState<Map<string, string>>(new Map());
  const [processedWords, setProcessedWords] = useState<Map<string, string>>(new Map());
  const [fileProcessingStatus, setFileProcessingStatus] = useState<Map<string, 'processing' | 'completed' | 'error'>>(new Map());
  const [processedDocuments, setProcessedDocuments] = useState<Map<string, { content: string; type: string; pages?: number; fileSize?: number }>>(new Map());
  const [comparativeAnalysisEnabled, setComparativeAnalysisEnabled] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<{ [key: string]: boolean }>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sharedMessageId, setSharedMessageId] = useState<string | null>(null);
  const [comparingModels, setComparingModels] = useState<{ [messageId: string]: string[] }>({});
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Função para renderizar ícone de anexo com base no tipo
  const renderFileIcon = (fileName: string, fileType: string, fileUrl?: string) => {
    const isImage = fileType.startsWith('image/');
    const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const isWord = fileType.includes('word') || fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');

    console.log('renderFileIcon called:', { fileName, fileType, fileUrl, isImage });

    return (
      <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border max-w-xs">
        <div className="flex-shrink-0">
          {isImage && fileUrl ? (
            <div className="w-16 h-16 rounded-md overflow-hidden border-2 border-white/20">
              <img 
                src={fileUrl} 
                alt={fileName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Image load error:', e);
                }}
                onLoad={() => {
                  console.log('Image loaded successfully:', fileUrl);
                }}
              />
            </div>
          ) : isImage ? (
            <div className="w-16 h-16 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border">
              <Image className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          ) : isImage ? (
            <div className="w-16 h-16 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border">
              <Image className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          ) : isPdf ? (
            <div className="w-12 h-12 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center border">
              <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          ) : isWord ? (
            <div className="w-12 h-12 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center border">
              <File className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPdf ? 'PDF' : isWord ? 'Word' : isImage ? 'Imagem' : 'Arquivo'}
          </p>
        </div>
      </div>
    );
  };

  // --- LÓGICA DE NEGÓCIO ---
  useEffect(() => {
    document.title = "Gerar textos com Ia";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [loading, user, navigate]);

  // Função para carregar conversas do usuário
  const loadConversations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao carregar conversas:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar suas conversas.",
          variant: "destructive"
        });
        return;
      }
      
      // Garantir que messages é sempre um array
      const formattedConversations = (data || []).map(conv => ({
        ...conv,
        messages: Array.isArray(conv.messages) ? conv.messages : []
      }));
      
      setConversations(formattedConversations);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Effect para detectar scroll e mostrar/esconder botão
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      checkIfNearBottom();
    };

    chatContainer.addEventListener('scroll', handleScroll);
    
    // Verificar posição inicial
    checkIfNearBottom();

    return () => {
      chatContainer.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Auto-scroll quando há uma nova mensagem, mas não durante streaming
  useEffect(() => {
    if (!isStreamingResponse) {
      autoScrollToBottom();
    }
  }, [messages, isStreamingResponse]);
    
  const convertToWordFormat = (text: string) => {
    if (!text) return text;
    
    // Remove # and * symbols from the entire text
    let cleanText = text.replace(/#+\s*/g, '').replace(/\*/g, '');
    
    // Split into lines and process each
    const lines = cleanText.split('\n');
    const formattedLines = lines.map((line) => {
      let trimmedLine = line.trim();
      
      // Remove stray bullet points in the middle of text
      trimmedLine = trimmedLine.replace(/\s•\s/g, ' ');
      
      // Handle numbered subtitles (e.g., "1. Title", "5. Legado e vida pós-futebol")
      if (trimmedLine.match(/^\d+\.\s+[A-Za-zÀ-ÿ]/)) {
        return `\n${trimmedLine.toUpperCase()}\n`;
      }
      
      // Handle bold titles (lines that end with : or are short and descriptive)
      if (trimmedLine.endsWith(':') || (trimmedLine.length < 50 && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('-') && trimmedLine.match(/^[A-Z][^.!?]*$/))) {
        // Remove the : before making it bold and add extra line break
        const titleText = trimmedLine.endsWith(':') ? trimmedLine.slice(0, -1) : trimmedLine;
        return `\n${titleText.toUpperCase()}\n`;
      }
      
      // Handle bullet points with proper spacing
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
        return `• ${trimmedLine.replace(/^[•\-]\s*/, '')}`;
      }
      
      return line;
    });
    
    return formattedLines.join('\n');
  };

  

  // Função para scroll para o fim
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Função para verificar se está próximo do final
  const checkIfNearBottom = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const threshold = 100; // 100px do final
    const nearBottom = scrollHeight - scrollTop - clientHeight < threshold;
    
    setIsNearBottom(nearBottom);
    setShowScrollToBottom(!nearBottom);
  };

  // Auto-scroll durante o streaming da resposta
  const autoScrollToBottom = () => {
    if (isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Função para copiar texto
  const copyWithFormatting = async (markdownText: string, isUser: boolean, messageId: string) => {
    try {
      setCopiedMessageId(messageId);
      await navigator.clipboard.writeText(markdownText);
      
      // Volta ao ícone normal após 2 segundos
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
      
      // Volta ao ícone normal após 2 segundos mesmo com erro
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    }
  };

  // Função para compartilhar mensagem
  const shareMessage = async (messageId: string, content: string) => {
    try {
      setSharedMessageId(messageId);
      
      // Gerar URL da conversa
      const conversationUrl = currentConversationId 
        ? `${window.location.origin}/chat?conversation=${currentConversationId}&message=${messageId}`
        : `${window.location.origin}/chat?message=${messageId}`;
      
      await navigator.clipboard.writeText(conversationUrl);
      
      toast({
        title: "Link copiado!",
        description: "O link da resposta foi copiado para a área de transferência.",
      });
      
      // Volta ao estado normal após 2 segundos
      setTimeout(() => {
        setSharedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive"
      });
      
      setTimeout(() => {
        setSharedMessageId(null);
      }, 2000);
    }
  };

  // Função para enviar mensagem para IA (extraída da lógica principal)
  const sendToAI = async (message: string, model: string): Promise<string> => {
    const internalModel = model === 'synergy-ia' ? 'gpt-4o-mini' : model;
    
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
      if (model.includes('grok')) {
        return 'grok-chat';
      }
      if (model.includes('deepseek')) {
        return 'deepseek-chat';
      }
      if (model.includes('llama')) {
        return 'apillm-chat';
      }
      return 'ai-chat';
    };

    const functionName = getEdgeFunctionName(internalModel);
    
    const { data: fnData, error: fnError } = await supabase.functions.invoke(functionName, { 
      body: { 
        message, 
        model: internalModel,
        conversationHistory: [],
        contextEnabled: false
      }
    });
    
    if (fnError) throw fnError;
    
    const data = fnData as any;
    return typeof data.response === 'string' ? data.response : data.response?.content || 'Erro ao processar mensagem.';
  };

  // Função para enviar mensagem para IA com arquivos (para comparações)
  const sendToAIWithFiles = async (message: string, model: string, files: any[]): Promise<string> => {
    const internalModel = model === 'synergy-ia' ? 'gpt-4o-mini' : model;
    
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
      if (model.includes('grok')) {
        return 'grok-chat';
      }
      if (model.includes('deepseek')) {
        return 'deepseek-chat';
      }
      if (model.includes('llama')) {
        return 'apillm-chat';
      }
      return 'ai-chat';
    };

    const functionName = getEdgeFunctionName(internalModel);
    
    // Preparar arquivos para envio
    const preparedFiles = files.map(file => ({
      name: file.name,
      type: file.type,
      hasPdfContent: !!file.pdfContent,
      hasWordContent: !!file.wordContent,
      pdfContent: file.pdfContent || '',
      wordContent: file.wordContent || ''
    }));
    
    const { data: fnData, error: fnError } = await supabase.functions.invoke(functionName, { 
      body: { 
        message, 
        model: internalModel,
        files: preparedFiles,
        conversationHistory: [],
        contextEnabled: false
      }
    });
    
    if (fnError) throw fnError;
    
    const data = fnData as any;
    return typeof data.response === 'string' ? data.response : data.response?.content || 'Erro ao processar mensagem.';
  };

  // Função para comparar com outro modelo
  const compareWithModel = async (messageId: string, modelToCompare: string, originalUserMessage: string) => {
    try {
      // Marcar como comparando
      setComparingModels(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), modelToCompare]
      }));

      // Encontrar a mensagem do bot que estamos comparando
      const botMessage = messages.find(m => m.id === messageId);
      if (!botMessage) {
        throw new Error('Mensagem não encontrada');
      }

      // Encontrar a mensagem do usuário que originou essa resposta do bot
      const botMessageIndex = messages.findIndex(m => m.id === messageId);
      const immediateUserMessage = botMessageIndex > 0 ? messages[botMessageIndex - 1] : null;
      
      if (!immediateUserMessage || immediateUserMessage.sender !== 'user') {
        throw new Error('Mensagem do usuário não encontrada ou sequência inválida');
      }

      // Usar o conteúdo da mensagem do usuário que originou esta resposta
      const messageToSend = immediateUserMessage.content;
      let filesToSend: any[] = [];
      
      // Se a mensagem original tinha arquivos anexados, incluir no envio de comparação
      if (immediateUserMessage.files && immediateUserMessage.files.length > 0) {
        console.log('Arquivos detectados na mensagem original:', immediateUserMessage.files);
        
        // Buscar conteúdo processado dos arquivos
        filesToSend = immediateUserMessage.files.map(file => {
          const fileData: any = {
            name: file.name,
            type: file.type,
            hasPdfContent: false,
            hasWordContent: false,
            pdfContent: '',
            wordContent: ''
          };

          // Para PDFs, buscar o conteúdo processado
          if (file.type === 'application/pdf') {
            const pdfContent = processedPdfs.get(file.name);
            if (pdfContent) {
              fileData.hasPdfContent = true;
              fileData.pdfContent = pdfContent;
              console.log(`PDF content found for ${file.name}:`, pdfContent.substring(0, 200) + '...');
            } else {
              console.warn(`No PDF content found for ${file.name} in processedPdfs`);
              console.log('Available processed PDFs:', Array.from(processedPdfs.keys()));
            }
          }
          
          // Para documentos Word
          if (file.type.includes('word') || file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
            const wordContent = processedWords.get(file.name);
            if (wordContent) {
              fileData.hasWordContent = true;
              fileData.wordContent = wordContent;
              console.log(`Word content found for ${file.name}:`, wordContent.substring(0, 200) + '...');
            }
          }

          return fileData;
        });
        
        console.log('Enviando arquivos para comparação:', filesToSend.map(f => ({ 
          name: f.name, 
          type: f.type, 
          hasPdfContent: f.hasPdfContent, 
          hasWordContent: f.hasWordContent,
          contentLength: f.pdfContent?.length || f.wordContent?.length || 0
        })));
      }

      // Enviar mensagem para o modelo de comparação com arquivos
      const response = await sendToAIWithFiles(messageToSend, modelToCompare, filesToSend);
      
      if (response) {
        // Adicionar resposta de comparação às mensagens
        const compareMessage: Message = {
          id: `compare_${Date.now()}_${modelToCompare}`,
          content: response,
          sender: 'bot',
          timestamp: new Date(),
          model: modelToCompare
        };
        
        setMessages(prev => [...prev, compareMessage]);
      }
    } catch (error) {
      console.error('Erro na comparação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer a comparação.",
        variant: "destructive"
      });
    } finally {
      // Remover do estado de comparação
      setComparingModels(prev => {
        const newState = { ...prev };
        if (newState[messageId]) {
          newState[messageId] = newState[messageId].filter(m => m !== modelToCompare);
          if (newState[messageId].length === 0) {
            delete newState[messageId];
          }
        }
        return newState;
      });
    }
  };

  useEffect(() => {
    if (!selectedModel) setSelectedModel('synergy-ia');
  }, [selectedModel]);

  const handleModelChange = async (newModel: string) => {
    if (selectedModel && selectedModel !== newModel && messages.length > 0) {
      await createNewConversation();
    }
    setSelectedModel(newModel);
  };

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
          .insert({ 
            user_id: user!.id, 
            title: deriveTitle(finalMessages), 
            messages: serial,
            is_favorite: false
          })
          .select('*').single();
        if (error) throw error;
        
        if (newConvId?.startsWith('temp_')) {
            setCurrentConversationId(data.id);
            setConversations(prev => prev.map(c => c.id === newConvId ? ({ ...data, messages: Array.isArray(data.messages) ? data.messages : [] }) : c));
        } else {
            setCurrentConversationId(data.id);
            setConversations(prev => [{ ...data, messages: Array.isArray(data.messages) ? data.messages : [] }, ...prev]);
        }
      } else {
        const currentConv = conversations.find(c => c.id === newConvId);
        const shouldRename = !currentConv || currentConv.title === 'Nova conversa' || currentConv.messages.length === 0;
        const updatePayload: any = { messages: serial, updated_at: new Date().toISOString() };
        if (shouldRename) updatePayload.title = deriveTitle(finalMessages);
        
        const { data, error } = await supabase
          .from('chat_conversations')
          .update(updatePayload)
          .eq('id', newConvId)
          .select('*').single();
        if (error) throw error;
        // Mover conversa atualizada para o topo da lista
        setConversations(prev => [{ ...data, messages: Array.isArray(data.messages) ? data.messages : [] }, ...prev.filter(c => c.id !== data.id)]);
      }
    } catch (e) { console.error('Erro ao salvar conversa:', e); }
  };

  const createNewConversation = async () => {
    if (messages.length > 0 && currentConversationId) {
        await upsertConversation(messages, currentConversationId);
    }
    setCurrentConversationId(null);
    setMessages([]);
    setInputValue('');
      setAttachedFiles([]);
      setProcessedPdfs(new Map());
      setProcessedWords(new Map());
      
      // Limpar URLs de preview para evitar vazamentos de memória
      filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setFilePreviewUrls(new Map());
  };

  // --- INÍCIO DA MODIFICAÇÃO: TOAST REMOVIDO ---
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
    // A linha do toast de sucesso foi removida daqui.
  };
  // --- FIM DA MODIFICAÇÃO ---
  
  const toggleFavoriteConversation = async (conv: ChatConversation) => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .update({ is_favorite: !conv.is_favorite })
      .eq('id', conv.id).select('*').single();
    if (error) toast({ title: 'Erro', description: 'Não foi possível atualizar favorito.', variant: 'destructive' });
    else if (data) setConversations(prev => prev.map(c => c.id === data.id ? { ...data, messages: Array.isArray(data.messages) ? data.messages : [] } : c));
  };
  
  const renameConversation = async (id: string, newTitle: string) => {
    const { data, error } = await supabase
        .from('chat_conversations')
        .update({ title: newTitle })
        .eq('id', id)
        .select('*').single();
    if (error) toast({ title: 'Erro', description: 'Não foi possível renomear a conversa.', variant: 'destructive' });
    else if (data) {
        setConversations(prev => prev.map(c => c.id === data.id ? { ...data, messages: Array.isArray(data.messages) ? data.messages : [] } : c));
        toast({ title: 'Conversa renomeada!' });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return;

    const currentInput = inputValue;
    const currentFiles = [...attachedFiles];
    setInputValue('');
    
    // Resetar altura do textarea
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = '52px';
    }
    
    setAttachedFiles([]);
    setProcessedPdfs(new Map());
    setProcessedWords(new Map());
    setProcessedDocuments(new Map());
    setFileProcessingStatus(new Map());
    setComparativeAnalysisEnabled(false);
    
    // Limpar URLs de preview para evitar vazamentos de memória
    filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setFilePreviewUrls(new Map());
    
    if (fileInputRef.current) fileInputRef.current.value = '';

    const canProceed = await consumeTokens(selectedModel, currentInput);
    if (!canProceed) return;

    const fileData = await Promise.all(currentFiles.map(async (file) => {
        const baseData = { name: file.name, type: file.type, data: await fileToBase64(file) };
        return file.type === 'application/pdf' ? { ...baseData, pdfContent: processedPdfs.get(file.name) || '' } : baseData;
    }));

    const userMessage: Message = { id: Date.now().toString(), content: currentInput, sender: 'user', timestamp: new Date(), files: currentFiles.map(f => ({ 
      name: f.name, 
      type: f.type, 
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined 
    }))};
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    
    let convId = currentConversationId;
    if (!convId) {
        const tempId = `temp_${Date.now()}`;
        const newTempConv = { id: tempId, title: deriveTitle(newMessages), messages: toSerializable(newMessages), is_favorite: false, user_id: user!.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString()};
        setConversations(prev => [newTempConv, ...prev]);
        setCurrentConversationId(tempId);
        convId = tempId;
    }

    try {
        // Don't convert synergy-ia yet, we need it for vision model detection
        const originalModel = selectedModel;
        const internalModel = selectedModel === 'synergy-ia' ? 'gpt-4o-mini' : selectedModel;
        
        // Prepare message with file content
        let messageWithPdf = currentInput;
        
        // Usar análise comparativa se houver múltiplos documentos processados
        if (processedDocuments.size > 1 && comparativeAnalysisEnabled) {
          messageWithPdf = generateComparativePrompt(currentInput, processedDocuments);
        } else if (attachedFiles.length > 0) {
          const pdfFiles = attachedFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
          const wordFiles = attachedFiles.filter(f => f.type.includes('word') || f.name.toLowerCase().endsWith('.docx') || f.name.toLowerCase().endsWith('.doc'));
          const imageFiles = attachedFiles.filter(f => f.type.startsWith('image/'));
          
          if (pdfFiles.length > 0 || wordFiles.length > 0 || imageFiles.length > 0) {
            console.log('Files detected:', {
              pdfs: pdfFiles.map(f => ({ 
                name: f.name, 
                contentLength: processedPdfs.get(f.name)?.length || 0 
              })),
              words: wordFiles.map(f => ({
                name: f.name,
                contentLength: processedWords.get(f.name)?.length || 0
              })),
              images: imageFiles.map(f => ({ name: f.name, type: f.type }))
            });
            
            // Include file contents in the message
            const contents = [];
            
            if (pdfFiles.length > 0) {
              const pdfContents = pdfFiles.map(pdf => {
                const pdfContent = processedPdfs.get(pdf.name);
                return `[Arquivo PDF: ${pdf.name}]\n\n${pdfContent || 'Conteúdo não disponível'}`;
              });
              contents.push(...pdfContents);
            }
            
            if (wordFiles.length > 0) {
              const wordContents = wordFiles.map(word => 
                `[Arquivo Word: ${word.name}]\n\n${processedWords.get(word.name) || 'Conteúdo não disponível'}`
              );
              contents.push(...wordContents);
            }
            
            if (imageFiles.length > 0) {
              console.log('=== IMAGES DETECTED IN CHAT.TSX ===');
              console.log('imageFiles:', imageFiles);
              console.log('originalModel:', originalModel);
              console.log('internalModel:', internalModel);
              
              // Check if model supports vision (SynergyIA = gpt-4o-mini, que NÃO suporta visão)
              const visionModels = [
                'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', // OpenAI vision models
                'claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', // Anthropic  
                'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', // Google
                'grok-4-0709', 'grok-3', 'grok-3-mini' // xAI
              ];
              
              const isVisionModel = visionModels.includes(originalModel); // Use originalModel instead of internalModel
              console.log('isVisionModel:', isVisionModel);
              
              if (isVisionModel && imageFiles.length > 0) {
                console.log('=== USING IMAGE ANALYSIS ===');
                // Use image analysis for vision models
                const imageFile = imageFiles[0]; // Use first image
                
                try {
                  // Convert file to base64
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                  });
                  const base64Data = base64.split(',')[1];
                  
                  let aiProvider = 'openai';
                  if (originalModel === 'synergy-ia') aiProvider = 'openai';
                  else if (originalModel.includes('claude')) aiProvider = 'claude';
                  else if (originalModel.includes('gemini')) aiProvider = 'gemini';
                  else if (originalModel.includes('grok')) aiProvider = 'grok';
                  
                  console.log('Calling image-analysis with provider:', aiProvider);
                  
                  const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('image-analysis', {
                    body: {
                      imageBase64: base64Data,
                      prompt: currentInput || 'Analise esta imagem e descreva o que você vê.',
                      aiProvider,
                      analysisType: 'general'
                    },
                  });

                  if (analysisError) {
                    throw new Error(analysisError.message);
                  }

                  // Add bot response
                  const botMessage: Message = {
                    id: Date.now().toString(),
                    content: analysisResult.analysis,
                    sender: 'bot',
                    timestamp: new Date(),
                    model: originalModel, // Use originalModel for display
                  };

                  setMessages(prev => [...prev, botMessage]);
                  
                  // Save conversation 
                  if (user?.id) {
                    await upsertConversation([...messages, userMessage, botMessage], currentConversationId);
                  }
                  
                  // Clear loading state
                  setIsLoading(false);
                  setInputValue('');
                  
                  return; // Exit early, don't continue with normal flow
                } catch (error) {
                  console.error('Image analysis error:', error);
                  toast({
                    title: "Erro na análise de imagem",
                    description: "Não foi possível analisar a imagem. Verifique se as chaves API estão configuradas.",
                    variant: "destructive",
                  });
                  setIsLoading(false);
                  return;
                }
              } else {
                // For non-vision models, just show image name
                const imageContents = imageFiles.map(image => 
                  `[Imagem anexada: ${image.name}]`
                );
                contents.push(...imageContents);
              }
            }
            
            messageWithPdf = `${currentInput}\n\n${contents.join('\n\n---\n\n')}`;
            console.log('Final message length with files:', messageWithPdf.length);
          }
        }
        
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
          if (model.includes('grok')) {
            return 'grok-chat'; // Função específica para Grok com suporte a PDFs
          }
          if (model.includes('deepseek')) {
            return 'deepseek-chat'; // Função específica para DeepSeek
          }
          if (model.includes('llama')) {
            return 'apillm-chat';
          }
          return 'ai-chat'; // Fallback to original function
        };

        const functionName = getEdgeFunctionName(internalModel);
        console.log(`Using edge function: ${functionName} for model: ${internalModel}`);
        
        // Prepare conversation history for context (last 20 messages)
        const conversationHistory = messages.slice(-20).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          files: msg.files || [],
          timestamp: msg.timestamp.toISOString()
        }));

        const { data: fnData, error: fnError } = await supabase.functions.invoke(functionName, { 
          body: { 
            message: messageWithPdf, 
            model: internalModel,
            files: fileData.length > 0 ? fileData : undefined,
            conversationHistory: conversationHistory,
            contextEnabled: true
          }
        });
        if (fnError) throw fnError;
        
        const data = fnData as any;
        const fullBotText = typeof data.response === 'string' ? data.response : data.response?.content || 'Desculpe, não consegui processar sua mensagem.';
        const reasoning = typeof data.response === 'string' ? '' : data.response?.reasoning;

        const botMessageId = (Date.now() + 1).toString();
        const placeholderBotMessage: Message = { 
            id: botMessageId, 
            content: '', 
            sender: 'bot', 
            timestamp: new Date(), 
            model: selectedModel, 
            reasoning: reasoning || undefined,
            isStreaming: true 
        };
        setMessages(prev => [...newMessages, placeholderBotMessage]);
        setIsStreamingResponse(true); // Marcar que está fazendo streaming

        let charIndex = 0;
        
        // Determine typing speed based on text length
        const getChunkSize = (textLength: number) => {
            if (textLength > 5000) return 8;  // Very long texts: 8 chars at once
            if (textLength > 2000) return 5;  // Long texts: 5 chars at once
            if (textLength > 1000) return 3;  // Medium texts: 3 chars at once
            return 1;  // Short texts: 1 char at once
        };
        
        const chunkSize = Math.max(3, Math.ceil(fullBotText.length / 100)); // Chunks muito maiores
        const interval = 1;  // Mega rápido - 1ms interval
        
        typingIntervalRef.current = setInterval(() => {
            if (charIndex < fullBotText.length) {
                const nextIndex = Math.min(charIndex + chunkSize, fullBotText.length);
                 setMessages(prev => prev.map(msg => 
                     msg.id === botMessageId 
                     ? { ...msg, content: fullBotText.slice(0, nextIndex) } 
                     : msg
                 ));
                  charIndex = nextIndex;
            } else {
                if (typingIntervalRef.current) {
                    clearInterval(typingIntervalRef.current);
                    typingIntervalRef.current = null;
                }
                
                const finalBotMessage: Message = { ...placeholderBotMessage, content: fullBotText, isStreaming: false };
                const finalMessages = [...newMessages, finalBotMessage];
                setMessages(finalMessages);
                setIsStreamingResponse(false); // Streaming finalizado
                
                // Scroll final após streaming completo
                setTimeout(() => {
                  if (isNearBottom && messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                  }
                }, 100);
                
                upsertConversation(finalMessages, convId);
                setIsLoading(false);
            }
        }, interval);

    } catch (error: any) {
        console.error('Error sending message:', error);
        toast({ title: "Erro", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
        setMessages(newMessages);
        setIsLoading(false);
        setIsStreamingResponse(false); // Reset streaming state on error
    }
  };

  const handleStopGeneration = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setIsLoading(false);
    setIsStreamingResponse(false); // Reset streaming state
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    );
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    
    // Arquivos .doc e .docx são suportados
    
    // Verificar limite de 5 arquivos
    const totalFiles = attachedFiles.length + files.length;
    if (totalFiles > 5) {
      toast({
        title: "Limite de arquivos excedido",
        description: `Você pode anexar no máximo 5 arquivos. Atualmente: ${attachedFiles.length} + ${files.length} = ${totalFiles}`,
        variant: "destructive",
      });
      return;
    }
    
    // Filtrar arquivos válidos
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type === 'application/pdf' || 
                         file.type.includes('word') || 
                         file.name.toLowerCase().endsWith('.pdf') ||
                         file.name.toLowerCase().endsWith('.docx') ||
                         file.name.toLowerCase().endsWith('.doc');
      return isValidType && file.size <= 50 * 1024 * 1024; // 50MB limit
    });
    
    if (validFiles.length === 0) {
      toast({
        title: "Nenhum arquivo válido",
        description: "Arraste apenas imagens, PDFs ou documentos Word (.doc/.docx, máx. 50MB cada).",
        variant: "destructive",
      });
      return;
    }
    
    setAttachedFiles(prev => [...prev, ...validFiles]);
    
    // Ativar análise comparativa se houver mais de um arquivo
    if (attachedFiles.length + validFiles.length > 1) {
      setComparativeAnalysisEnabled(true);
    }
    
    // Processar arquivos em paralelo (sem toast de confirmação)
    await processFilesInParallel(validFiles);
  };

  // Função para processar múltiplos arquivos em paralelo
  // Funções de drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // Verificar limite de 5 arquivos
    const totalFiles = attachedFiles.length + files.length;
    if (totalFiles > 5) {
      toast({
        title: "Limite de arquivos excedido",
        description: `Você pode anexar no máximo 5 arquivos. Atualmente: ${attachedFiles.length} + ${files.length} = ${totalFiles}`,
        variant: "destructive",
      });
      return;
    }
    
    // Filtrar arquivos válidos
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type === 'application/pdf' || 
                         file.type.includes('word') || 
                         file.name.toLowerCase().endsWith('.pdf') ||
                         file.name.toLowerCase().endsWith('.docx') ||
                         file.name.toLowerCase().endsWith('.doc');
      return isValidType && file.size <= 50 * 1024 * 1024; // 50MB limit
    });
    
    if (validFiles.length === 0) {
      toast({
        title: "Nenhum arquivo válido",
        description: "Arraste apenas imagens, PDFs ou documentos Word (.doc/.docx, máx. 50MB cada).",
        variant: "destructive",
      });
      return;
    }
    
    setAttachedFiles(prev => [...prev, ...validFiles]);
    
    // Ativar análise comparativa se houver mais de um arquivo
    if (attachedFiles.length + validFiles.length > 1) {
      setComparativeAnalysisEnabled(true);
    }
    
    // Processar arquivos em paralelo
    await processFilesInParallel(validFiles);
  };

  const processFilesInParallel = async (files: File[]) => {
    // Criar URLs de preview para imagens
    const newPreviewUrls = new Map(filePreviewUrls);
    
    const processingPromises = files.map(async (file) => {
      const fileName = file.name;
      
      // Marcar como processando
      setFileProcessingStatus(prev => new Map(prev.set(fileName, 'processing')));
      
      try {
        if (file.type.startsWith('image/')) {
          // Para imagens, criar URL de preview
          const url = URL.createObjectURL(file);
          newPreviewUrls.set(fileName, url);
          setProcessedDocuments(prev => new Map(prev.set(fileName, {
            content: `Imagem anexada: ${fileName}`,
            type: 'image',
            fileSize: file.size
          })));
          setFileProcessingStatus(prev => new Map(prev.set(fileName, 'completed')));
          return { fileName, success: true };
          
        } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          console.log('Processing PDF:', fileName, 'Size:', file.size);
          const result = await PdfProcessor.processPdf(file);
          if (result.success && result.content) {
            console.log('PDF processed successfully:', {
              fileName: fileName,
              pageCount: result.pageCount,
              contentLength: result.content.length,
              contentPreview: result.content.substring(0, 200) + '...'
            });
            setProcessedDocuments(prev => new Map(prev.set(fileName, {
              content: result.content!,
              type: 'pdf',
              pages: result.pageCount,
              fileSize: file.size
            })));
            setProcessedPdfs(prev => new Map(prev).set(fileName, result.content || ''));
            setFileProcessingStatus(prev => new Map(prev.set(fileName, 'completed')));
            return { fileName, success: true };
          } else {
            throw new Error(result.error || 'Erro ao processar PDF');
          }
          
        } else if (file.type.includes('word') || file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
          console.log('Processing Word:', fileName, 'Size:', file.size);
          const result = await WordProcessor.processWord(file);
          if (result.success && result.content) {
            console.log('Word processed successfully:', {
              fileName: fileName,
              contentLength: result.content.length,
              contentPreview: result.content.substring(0, 200) + '...'
            });
            setProcessedDocuments(prev => new Map(prev.set(fileName, {
              content: result.content!,
              type: 'word',
              fileSize: file.size
            })));
            setProcessedWords(prev => new Map(prev).set(fileName, result.content || ''));
            setFileProcessingStatus(prev => new Map(prev.set(fileName, 'completed')));
            return { fileName, success: true };
          } else {
            throw new Error(result.error || 'Erro ao processar Word');
          }
        }
        
        return { fileName, success: false, error: 'Tipo de arquivo não suportado' };
        
      } catch (error: any) {
        console.error(`Erro ao processar ${fileName}:`, error);
        setFileProcessingStatus(prev => new Map(prev.set(fileName, 'error')));
        return { fileName, success: false, error: error.message };
      }
    });
    
    // Atualizar URLs de preview
    setFilePreviewUrls(newPreviewUrls);
    
    // Aguardar conclusão de todos os processamentos
    const results = await Promise.all(processingPromises);
    
    // Log silencioso dos resultados sem mostrar toast
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log('File processing results:', {
      successful,
      failed,
      details: results
    });
    
    // Mostrar toast informativo se houver arquivos que falharam
    if (failed > 0) {
      const failedFiles = results.filter(r => !r.success);
      
      toast({
        title: `Erro ao processar ${failed} arquivo(s)`,
        description: "Alguns arquivos não puderam ser processados. Verifique o formato e tente novamente.",
        variant: "destructive",
      });
      
      console.error('Failed file processing:', failedFiles);
    }
  };

  // Função para gerar prompt de análise comparativa
  const generateComparativePrompt = (userMessage: string, documents: Map<string, any>) => {
    if (documents.size <= 1) return userMessage;
    
    const documentList = Array.from(documents.entries()).map(([fileName, doc], index) => {
      return `DOCUMENTO ${index + 1}: ${fileName} (${doc.type.toUpperCase()}${doc.pages ? `, ${doc.pages} páginas` : ''})
Conteúdo: ${doc.content.substring(0, 2000)}${doc.content.length > 2000 ? '...' : ''}`;
    }).join('\n\n');
    
    return `ANÁLISE COMPARATIVA DE MÚLTIPLOS DOCUMENTOS

Você recebeu ${documents.size} documentos para análise. Realize uma análise comparativa inteligente considerando:

1. IDENTIFICAÇÃO E CONTEXTO de cada documento
2. PONTOS DE CONVERGÊNCIA entre os documentos
3. DIVERGÊNCIAS e CONTRASTES identificados
4. SÍNTESE INTEGRADA das informações
5. INSIGHTS e CONCLUSÕES baseadas na comparação

DOCUMENTOS FORNECIDOS:
${documentList}

PERGUNTA/SOLICITAÇÃO DO USUÁRIO:
${userMessage}

Por favor, forneça uma resposta abrangente que integre informações de todos os documentos, destacando semelhanças, diferenças e insights únicos que emergem da análise conjunta.`;
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        // Limpar stream
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Gravação iniciada", description: "Fale agora..." });
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({ title: "Gravação finalizada", description: "Processando áudio..." });
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke('voice-to-text', {
          body: { audio: base64Audio }
        });

        if (error) {
          console.error('Erro na transcrição:', error);
          toast({ title: "Erro", description: "Falha ao transcrever áudio.", variant: "destructive" });
          return;
        }

        if (data?.text) {
          setInputValue(prev => prev + (prev ? ' ' : '') + data.text);
          toast({ title: "Transcrição concluída", description: "Texto adicionado ao input." });
        } else {
          toast({ title: "Aviso", description: "Nenhum texto foi detectado no áudio.", variant: "destructive" });
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Erro ao transcrever áudio:', error);
      toast({ title: "Erro", description: "Falha ao processar áudio.", variant: "destructive" });
    }
  };

  // --- RENDERIZAÇÃO ---
  if (loading) return <div className="h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div></div>;
  if (!user || !profile) return null;

  return (
    <div className="h-screen max-h-screen bg-background flex flex-col">
      {/* ===== CABEÇALHO ===== */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3 md:gap-4">
               <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:bg-muted">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <div className="h-6 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-blue-500" />
                    <h1 className="text-lg font-semibold text-foreground">Chat</h1>
                </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
                <ModelSelector onModelSelect={handleModelChange} selectedModel={selectedModel} />
                <UserProfile />
                <div className="flex-shrink-0">
                  <ThemeToggle />
                </div>
            </div>
            <div className="md:hidden flex items-center gap-1">
                <div className="flex-shrink-0">
                  <ThemeToggle />
                </div>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[320px] p-0 flex flex-col">
                        <SheetHeader className="p-4 border-b">
                            <SheetTitle>Menu</SheetTitle>
                        </SheetHeader>
                        <div className="p-4 space-y-4 border-b">
                           <UserProfile />
                           <ModelSelector onModelSelect={handleModelChange} selectedModel={selectedModel} />
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <ConversationSidebar
                              conversations={conversations}
                              currentConversationId={currentConversationId}
                              onSelectConversation={openConversation}
                              onNewConversation={createNewConversation}
                              onDeleteConversation={deleteConversation}
                              onToggleFavorite={toggleFavoriteConversation}
                              onRenameConversation={renameConversation}
                              isMobile={true}
                            />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
      </header>

      {/* ===== CORPO PRINCIPAL ===== */}
      <div className="flex-1 flex flex-row overflow-hidden">
        <aside className="w-80 flex-shrink-0 hidden md:flex flex-col bg-background">
          <ConversationSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={openConversation}
            onNewConversation={createNewConversation}
            onDeleteConversation={deleteConversation}
            onToggleFavorite={toggleFavoriteConversation}
            onRenameConversation={renameConversation}
          />
        </aside>

        <main className="flex-1 flex flex-col bg-background">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground" style={{minHeight: 'calc(100vh - 250px)'}}>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">Olá, {profile.name}!</h3>
                    <p>Selecione uma conversa ou inicie uma nova.</p>
                    <p className="mt-2 text-sm">Você tem {tokenBalance.toLocaleString()} tokens disponíveis.</p>
                  </div>
                </div>
              ) : (
                /** >>> alteração aqui: capturamos também o index do map <<< */
                messages.map((message, index) => (
                  <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                    
                    {message.sender === 'bot' ? (
                      <>
                        <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback></Avatar>
                        <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted">
                          <div className="space-y-3">
                            {message.reasoning && (
                              <div className="border-b border-border/50 pb-2">
                                <Button variant="ghost" size="sm" onClick={() => setExpandedReasoning(p => ({ ...p, [message.id]: !p[message.id] }))} className="h-auto p-1 text-xs opacity-70 hover:opacity-100">
                                  {expandedReasoning[message.id] ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />} Raciocínio
                                </Button>
                                {expandedReasoning[message.id] && <div className="mt-2 text-xs opacity-80 bg-background/50 rounded p-2 whitespace-pre-wrap overflow-hidden">{message.reasoning}</div>}
                              </div>
                            )}
                             <div className="text-sm max-w-none break-words overflow-hidden">
                               <MarkdownRenderer content={message.content} isUser={false} />
                               {message.isStreaming && <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />}
                             </div>
                             <div className="flex items-center justify-between pt-2 border-t border-border/50">
                               <p className="text-xs opacity-70">{getModelDisplayName(message.model)}</p>
                                   <TooltipProvider>
                                     <Tooltip>
                                       <TooltipTrigger asChild>
                                         <Button 
                                           variant="ghost" 
                                           size="icon" 
                                           onClick={() => copyWithFormatting(message.content, false, message.id)} 
                                           className="h-7 w-7 hover:bg-muted/80 hover:scale-105 transition-all duration-200"
                                         >
                                           {copiedMessageId === message.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                         </Button>
                                       </TooltipTrigger>
                                       <TooltipContent>Copiar com formatação</TooltipContent>
                                     </Tooltip>
                                   </TooltipProvider>
                             </div>
                             {/* Botões de ação como no Poe */}
                             <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                               <TooltipProvider>
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <Button
                                       variant={sharedMessageId === message.id ? "default" : "outline"}
                                       size="sm"
                                       onClick={() => shareMessage(message.id, message.content)}
                                       className="flex items-center gap-2 text-xs h-8"
                                     >
                                       <Share className="h-3 w-3" />
                                       {sharedMessageId === message.id ? "Link copiado!" : "Compartilhar"}
                                     </Button>
                                   </TooltipTrigger>
                                   <TooltipContent>Copiar link de compartilhamento</TooltipContent>
                                 </Tooltip>
                               </TooltipProvider>
                               
                                  {/* Botões de comparação - só mostrar se não há anexos na mensagem anterior do usuário */}
                                  {(() => {
                                    // >>> alteração: usar o index do map para pegar a mensagem anterior com segurança
                                    const messageIndex = index;
                                    const immediateUserMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
                                    const hasAttachments = immediateUserMessage?.files && immediateUserMessage.files.length > 0;
                                    
                                    // Só mostrar botões se:
                                    // 1. Há uma mensagem do usuário anterior
                                    // 2. A mensagem anterior é do usuário  
                                    // 3. Não há anexos na mensagem anterior
                                    // 4. A mensagem atual é do bot
                                    if (!immediateUserMessage || 
                                        immediateUserMessage.sender !== 'user' || 
                                        hasAttachments ||
                                        message.sender !== 'bot') {
                                      return null;
                                    }
                                    
                                    return (
                                      <div className="flex items-center gap-1">
                                        {['gemini-2.5-flash', 'claude-opus-4-20250514', 'grok-4'].map((model) => {
                                         const isComparing = comparingModels[message.id]?.includes(model);
                                         const userMessage = immediateUserMessage.content;
                                         
                                         return (
                                           <TooltipProvider key={model}>
                                             <Tooltip>
                                               <TooltipTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => compareWithModel(message.id, model, userMessage)}
                                                    disabled={isComparing || !userMessage}
                                                    className="flex items-center gap-1 text-xs h-8 px-2"
                                                  >
                                                    {isComparing ? (
                                                      <div className="flex items-center gap-1">
                                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                                        <span>Processando...</span>
                                                      </div>
                                                    ) : (
                                                      <div className="flex items-center gap-1">
                                                        <RefreshCw className="h-3 w-3" />
                                                        {model === 'gemini-2.5-flash' ? 'Gemini' : 
                                                         model === 'claude-opus-4-20250514' ? 'Claude' : 'Grok'}
                                                      </div>
                                                    )}
                                                  </Button>
                                               </TooltipTrigger>
                                               <TooltipContent>
                                                 Comparar com {getModelDisplayName(model)}
                                               </TooltipContent>
                                             </Tooltip>
                                           </TooltipProvider>
                                         );
                                       })}
                                     </div>
                                   );
                                 })()}
                             </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="group flex flex-col items-end max-w-[90%]">
                          <div className="rounded-lg px-4 py-3 bg-primary text-primary-foreground">
                            <div className="space-y-3">
                              {message.files && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {message.files.map((file, idx) => (
                                    <div key={idx}>
                                      {renderFileIcon(file.name, file.type, file.url)}
                                    </div>
                                  ))}
                                </div>
                              )}
                               <div className="text-sm max-w-none break-words overflow-hidden">
                                 <MarkdownRenderer content={message.content} isUser={true} />
                               </div>
                            </div>
                          </div>
                          <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 mt-1 hover:bg-muted/80 hover:scale-105 transition-all duration-200"
                                    onClick={() => {
                                      copyWithFormatting(message.content, message.sender === 'user', message.id);
                                    }}
                                  >
                                    {copiedMessageId === message.id ? <Check className="h-3.5 w-3.5 text-muted-foreground" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        <Avatar className="h-8 w-8 shrink-0"><AvatarFallback>U</AvatarFallback></Avatar>
                      </>
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
            <Button 
              onClick={() => {
                scrollToBottom();
                setShowScrollToBottom(false);
                setIsNearBottom(true);
              }} 
              variant="outline" 
              size="icon" 
              className="absolute bottom-24 right-6 h-10 w-10 rounded-full shadow-lg bg-background hover:bg-muted border-border z-20 transition-all duration-200"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}

          {/* ===== ÁREA DE INPUT ===== */}
          <div className="flex-shrink-0 border-t border-border bg-background px-4 pt-4 pb-8">
            <div className="max-w-4xl mx-auto">
                {attachedFiles.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {/* Indicador de análise comparativa */}
                    {comparativeAnalysisEnabled && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Análise Comparativa Ativa
                          </span>
                        </div>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {attachedFiles.length} documentos serão comparados e analisados em conjunto
                        </span>
                      </div>
                    )}
                    
                    {/* Lista de arquivos */}
                    <div className="flex flex-wrap gap-3">
                      {attachedFiles.map((file, idx) => {
                        const status = fileProcessingStatus.get(file.name);
                        const isProcessing = status === 'processing';
                        const isCompleted = status === 'completed';
                        const hasError = status === 'error';
                        
                        return (
                          <div key={idx} className="relative group">
                            <div className={`relative ${isProcessing ? 'opacity-60' : ''}`}>
                              {renderFileIcon(file.name, file.type, file.type.startsWith('image/') ? filePreviewUrls.get(file.name) : undefined)}
                              
                              {/* Status overlay */}
                              {isProcessing && (
                                <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                                </div>
                              )}
                              
                              {isCompleted && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                              
                              {hasError && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs">!</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Botão de remoção */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                // Revogar URL se for uma imagem
                                if (file.type.startsWith('image/')) {
                                  const url = filePreviewUrls.get(file.name);
                                  if (url) URL.revokeObjectURL(url);
                                }
                                
                                setAttachedFiles(prev => {
                                  const newFiles = prev.filter((_, i) => i !== idx);
                                  // Desativar análise comparativa se sobrar apenas 1 arquivo
                                  if (newFiles.length <= 1) {
                                    setComparativeAnalysisEnabled(false);
                                  }
                                  return newFiles;
                                });
                                
                                // Limpar todos os estados relacionados ao arquivo
                                setFilePreviewUrls(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(file.name);
                                  return newMap;
                                });
                                setProcessedPdfs(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(file.name);
                                  return newMap;
                                });
                                setProcessedWords(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(file.name);
                                  return newMap;
                                });
                                setProcessedDocuments(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(file.name);
                                  return newMap;
                                });
                                setFileProcessingStatus(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(file.name);
                                  return newMap;
                                });
                              }}
                              className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </Button>
                            
                            {/* Status tooltip */}
                            {(isProcessing || hasError) && (
                              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                {isProcessing ? 'Processando...' : hasError ? 'Erro no processamento' : ''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,.pdf,.docx,.doc" max="5" />
                  <div className="absolute left-2 top-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="mb-2">
                            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer"><Paperclip className="h-4 w-4 mr-2" />Anexar (.pdf, .doc/.docx, imagens)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsWebSearchMode(p => !p)} className="cursor-pointer"><Globe className="h-4 w-4 mr-2" />{isWebSearchMode ? 'Desativar Busca Web' : 'Busca Web'}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
                  <Textarea
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                    }}
                    placeholder={isDragOver ? "Solte os arquivos aqui..." : isWebSearchMode ? "Digite para buscar na web..." : "Pergunte alguma coisa..."}
                    disabled={isLoading}
                    className={`w-full pl-14 pr-24 py-3 rounded-lg resize-none min-h-[52px] max-h-[128px] transition-colors ${isDragOver ? 'bg-accent border-primary border-dashed' : ''}`}
                    rows={1}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter' && !isMobile && !e.shiftKey) { 
                        e.preventDefault(); 
                        handleSendMessage(e as any);
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = '52px';
                      } 
                    }}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                  <div className="absolute right-3 top-3 flex gap-1">
                    <TooltipProvider><Tooltip><TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" onClick={isRecording ? stopRecording : startRecording} className={`h-8 w-8 ${isRecording ? 'text-red-500' : ''}`}><Mic className="h-4 w-4" /></Button>
                     </TooltipTrigger><TooltipContent>{isRecording ? 'Parar gravação' : 'Gravar áudio'}</TooltipContent></Tooltip></TooltipProvider>
                     {isLoading ? (
                       <TooltipProvider><Tooltip><TooltipTrigger asChild>
                         <Button type="button" onClick={handleStopGeneration} size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 bg-transparent border-0"><Square className="h-4 w-4" /></Button>
                       </TooltipTrigger><TooltipContent>Parar geração</TooltipContent></Tooltip></TooltipProvider>
                     ) : (
                       <Button type="submit" disabled={!inputValue.trim() && attachedFiles.length === 0} size="icon" className="h-8 w-8"><ArrowUp className="h-4 w-4" /></Button>
                     )}
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
