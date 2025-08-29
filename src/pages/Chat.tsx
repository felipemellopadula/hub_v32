// Chat.tsx — versão otimizada E RESPONSIVA (mobile-first)
// Melhorias de performance (mantidas da versão anterior):
// - Code-splitting com React.lazy + Suspense para componentes pesados.
// - Streaming com requestAnimationFrame (menos re-renderizações).
// - Throttle de scroll com rAF.
// - Memoização de subcomponentes e callbacks.
// Melhorias de responsividade (principais):
// - Uso de unidades dinâmicas de viewport (100dvh) + min-h-0 nos containers flex para evitar "cortes" no mobile.
// - Linhas de mensagem com "w-full" e bolhas dimensionadas por "flex-1 min-w-0" (o texto quebra e ocupa todo o espaço disponível no mobile).
// - Bubbles no mobile ocupam a largura útil e em telas maiores limitamos com "sm:max-w-[80~90%]".
// - Conteúdo de mensagem com "overflow-x-auto" para evitar corte de blocos de código largos.
// - Área de input com paddings responsivos (pl/pr menores no mobile) e botões alinhados (sem sobrepor o texto).
// - Botão “voltar ao fim” com offsets menores no mobile.
// - Containers com "overscroll-contain" para evitar “overscroll bounce” empurrar o layout.

import {
  MessageCircle,
  ArrowLeft,
  Paperclip,
  Mic,
  Globe,
  Star,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Copy,
  Menu,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Edit3,
  Square,
  Check,
  FileText,
  File,
  Image as ImageIcon,
  Share,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useTransition,
  lazy,
  Suspense,
} from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
const ModelSelectorLazy = lazy(() =>
  import("@/components/ModelSelector").then((m) => ({
    default: m.ModelSelector,
  }))
);
const ThemeToggleLazy = lazy(() =>
  import("@/components/ThemeToggle").then((m) => ({ default: m.ThemeToggle }))
);
const UserProfileLazy = lazy(() =>
  import("@/components/UserProfile").then((m) => ({ default: m.UserProfile }))
);
const MarkdownRendererLazy = lazy(
  () => import("@/components/MarkdownRenderer")
);
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTokens } from "@/hooks/useTokens";
import { supabase } from "@/integrations/supabase/client";
import { PdfProcessor } from "@/utils/PdfProcessor";
import { WordProcessor } from "@/utils/WordProcessor";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

// =====================
// Tipos
// =====================
interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
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

type FileStatus = "processing" | "completed" | "error";

// =====================
// Utils
// =====================
const formatPtBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const getEdgeFunctionName = (model: string) => {
  if (model.includes("gpt-") || model.includes("o3") || model.includes("o4")) {
    return "openai-chat";
  }
  if (model.includes("gemini")) return "gemini-chat";
  if (model.includes("claude")) return "anthropic-chat";
  if (model.includes("grok")) return "grok-chat";
  if (model.includes("deepseek")) return "deepseek-chat";
  if (model.includes("llama")) return "apillm-chat";
  return "ai-chat";
};

const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const isWordFile = (file: File) =>
  file.type.includes("word") ||
  file.name.toLowerCase().endsWith(".docx") ||
  file.name.toLowerCase().endsWith(".doc");

// =====================
// Sidebar (memo)
// =====================
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

const ConversationSidebar: React.FC<ConversationSidebarProps> = React.memo(
  ({
    conversations,
    currentConversationId,
    onSelectConversation,
    onNewConversation,
    onDeleteConversation,
    onToggleFavorite,
    onRenameConversation,
    isMobile = false,
  }) => {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredConversations = useMemo(() => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return conversations;
      return conversations.filter((c) => c.title.toLowerCase().includes(term));
    }, [conversations, searchTerm]);

    const favorites = useMemo(
      () => filteredConversations.filter((c) => c.is_favorite),
      [filteredConversations]
    );
    const recents = useMemo(
      () => filteredConversations.filter((c) => !c.is_favorite),
      [filteredConversations]
    );

    const handleRename = useCallback(
      (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newTitle = prompt("Digite o novo título da conversa:");
        if (newTitle && newTitle.trim()) {
          onRenameConversation(id, newTitle.trim());
        }
      },
      [onRenameConversation]
    );

    const renderItem = useCallback(
      (conv: ChatConversation) => {
        const card = (
          <div
            key={conv.id}
            className={`group relative rounded-lg p-3 cursor-pointer transition-colors duration-200 ${
              currentConversationId === conv.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            }`}
            onClick={() => onSelectConversation(conv)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {conv.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPtBR.format(new Date(conv.updated_at))}
                </p>
              </div>
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(conv);
                      }}
                    >
                      <Star
                        className={`h-4 w-4 mr-2 ${
                          conv.is_favorite ? "text-yellow-500" : ""
                        }`}
                      />
                      {conv.is_favorite ? "Desfavoritar" : "Favoritar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleRename(e, conv.id)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );
        return isMobile ? (
          <SheetClose asChild key={conv.id}>
            {card}
          </SheetClose>
        ) : (
          card
        );
      },
      [
        currentConversationId,
        onDeleteConversation,
        onSelectConversation,
        onToggleFavorite,
        handleRename,
        isMobile,
      ]
    );

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
                <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Favoritos
                </h4>
                {favorites.map(renderItem)}
              </>
            )}
            <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">
              Recentes
            </h4>
            {recents.map(renderItem)}

            {filteredConversations.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma conversa encontrada.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }
);
ConversationSidebar.displayName = "ConversationSidebar";

// =====================
// Mensagens
// =====================
const UserMessage = React.memo(
  ({
    message,
    onCopy,
    renderFileIcon,
  }: {
    message: Message;
    onCopy: (markdownText: string, isUser: boolean, messageId: string) => void;
    renderFileIcon: (
      fileName: string,
      fileType: string,
      fileUrl?: string
    ) => JSX.Element;
  }) => {
    return (
      <>
        {/* Wrapper do lado esquerdo cresce, mas a bubble alinha à direita */}
        <div className="flex-1 min-w-0 flex justify-end">
          <div className="inline-block w-full sm:w-auto sm:max-w-[90%] rounded-lg px-4 py-3 bg-primary text-primary-foreground">
            <div className="space-y-3">
              {message.files && (
                <div className="flex flex-wrap gap-2 mb-3 max-w-full">
                  {message.files.map((file, idx) => (
                    <div key={idx}>
                      {renderFileIcon(file.name, file.type, file.url)}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-sm max-w-full break-words whitespace-pre-wrap overflow-x-auto">
                <Suspense
                  fallback={<div className="h-4 w-24 bg-muted rounded" />}
                >
                  <MarkdownRendererLazy
                    content={message.content}
                    isUser={true}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
        <Avatar className="h-8 w-8 shrink-0 ml-0.5">
          <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
        </Avatar>
        {/* Botão copiar flutuante mantém acessibilidade sem cortar */}
        <div className="flex-shrink-0 self-start">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 mt-1 hover:bg-muted/80 hover:scale-105 transition-all duration-200"
                  onClick={() => onCopy(message.content, true, message.id)}
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </>
    );
  }
);
UserMessage.displayName = "UserMessage";

const BotMessage = React.memo(
  ({
    message,
    getModelDisplayName,
    expandedReasoning,
    toggleReasoning,
    isCopied,
    onCopy,
    onShare,
    sharedMessageId,
    comparingModels,
    compareWithModel,
    immediateUserMessage,
  }: {
    message: Message;
    getModelDisplayName: (model?: string) => string;
    expandedReasoning: { [key: string]: boolean };
    toggleReasoning: (id: string) => void;
    isCopied: boolean;
    onCopy: (markdownText: string, isUser: boolean, messageId: string) => void;
    onShare: (messageId: string, content: string) => void;
    sharedMessageId: string | null;
    comparingModels: { [messageId: string]: string[] };
    compareWithModel: (
      messageId: string,
      modelToCompare: string,
      originalUserMessage: string
    ) => Promise<void>;
    immediateUserMessage: Message | null;
  }) => {
    const hasAttachments =
      immediateUserMessage?.files && immediateUserMessage.files.length > 0;

    return (
      <>
        <Avatar className="h-8 w-8 shrink-0 mr-0.5">
          <AvatarFallback className="bg-primary text-primary-foreground">
            AI
          </AvatarFallback>
        </Avatar>
        {/* Bolha ocupa toda a largura disponível no mobile */}
        <div className="flex-1 min-w-0">
          <div className="inline-block w-full sm:w-auto sm:max-w-[85%] rounded-lg px-4 py-3 bg-muted">
            <div className="space-y-3">
              {!!message.reasoning && (
                <div className="border-b border-border/50 pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleReasoning(message.id)}
                    className="h-auto p-1 text-xs opacity-70 hover:opacity-100"
                  >
                    {expandedReasoning[message.id] ? (
                      <ChevronUp className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    )}{" "}
                    Raciocínio
                  </Button>
                  {expandedReasoning[message.id] && (
                    <div className="mt-2 text-xs opacity-80 bg-background/50 rounded p-2 whitespace-pre-wrap overflow-x-auto">
                      {message.reasoning}
                    </div>
                  )}
                </div>
              )}
              <div className="text-sm max-w-full break-words whitespace-pre-wrap overflow-x-auto">
                <Suspense
                  fallback={<div className="h-4 w-24 bg-muted rounded" />}
                >
                  <MarkdownRendererLazy
                    content={message.content}
                    isUser={false}
                  />
                </Suspense>
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2 flex-wrap">
                <p className="text-xs opacity-70">
                  {getModelDisplayName(message.model)}
                </p>

                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            onCopy(message.content, false, message.id)
                          }
                          className="h-7 w-7 hover:bg-muted/80 hover:scale-105 transition-all duration-200"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar com formatação</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={
                            sharedMessageId === message.id
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => onShare(message.id, message.content)}
                          className="flex items-center gap-2 text-xs h-8"
                        >
                          <Share className="h-3 w-3" />
                          {sharedMessageId === message.id
                            ? "Link copiado!"
                            : "Compartilhar"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Copiar link de compartilhamento
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Comparação entre modelos — quando a mensagem anterior do usuário não tem anexos */}
              {!hasAttachments && immediateUserMessage?.sender === "user" && (
                <div className="flex items-center gap-1 pt-2 border-t border-border/30 flex-wrap">
                  {["gemini-2.5-flash", "claude-opus-4-20250514", "grok-4"].map(
                    (model) => {
                      const isComparing =
                        comparingModels[message.id]?.includes(model);
                      const userMessage = immediateUserMessage.content;
                      return (
                        <TooltipProvider key={model}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  compareWithModel(
                                    message.id,
                                    model,
                                    userMessage
                                  )
                                }
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
                                    {model === "gemini-2.5-flash"
                                      ? "Gemini"
                                      : model === "claude-opus-4-20250514"
                                      ? "Claude"
                                      : "Grok"}
                                  </div>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Comparar com {model}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
);
BotMessage.displayName = "BotMessage";

// =====================
// Componente Principal
// =====================
const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();
  const { consumeTokens, getModelDisplayName, tokenBalance } = useTokens();
  const isMobile = useIsMobile();

  // Estados
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("synergy-ia");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWebSearchMode, setIsWebSearchMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<Map<string, string>>(
    new Map()
  );
  const [processedPdfs, setProcessedPdfs] = useState<Map<string, string>>(
    new Map()
  );
  const [processedWords, setProcessedWords] = useState<Map<string, string>>(
    new Map()
  );
  const [fileProcessingStatus, setFileProcessingStatus] = useState<
    Map<string, FileStatus>
  >(new Map());
  const [processedDocuments, setProcessedDocuments] = useState<
    Map<
      string,
      { content: string; type: string; pages?: number; fileSize?: number }
    >
  >(new Map());
  const [comparativeAnalysisEnabled, setComparativeAnalysisEnabled] =
    useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [expandedReasoning, setExpandedReasoning] = useState<{
    [key: string]: boolean;
  }>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sharedMessageId, setSharedMessageId] = useState<string | null>(null);
  const [comparingModels, setComparingModels] = useState<{
    [messageId: string]: string[];
  }>({});
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRafRef = useRef<number | null>(null);

  // Efeitos iniciais
  useEffect(() => {
    document.title = "Gerar textos com Ia";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [loading, user, navigate]);

  // Carregar conversas
  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar conversas:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar suas conversas.",
          variant: "destructive",
        });
        return;
      }

      const formattedConversations = (data || []).map((conv) => ({
        ...conv,
        messages: Array.isArray(conv.messages) ? conv.messages : [],
      }));

      setConversations(formattedConversations);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Scroll: throttle com rAF + inicial
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = el;
        const threshold = 100;
        const nearBottom = scrollHeight - scrollTop - clientHeight < threshold;
        setIsNearBottom(nearBottom);
        setShowScrollToBottom(!nearBottom);
        ticking = false;
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Auto-scroll quando novas mensagens chegam e não há streaming
  useEffect(() => {
    if (!isStreamingResponse && isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreamingResponse, isNearBottom]);

  // Limpeza de URLs de preview ao desmontar
  useEffect(() => {
    return () => {
      filePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [filePreviewUrls]);

  // =====================
  // Utils e ações
  // =====================
  const convertToWordFormat = (text: string) => {
    if (!text) return text;
    let cleanText = text.replace(/#+\s*/g, "").replace(/\*/g, "");
    const lines = cleanText.split("\n");
    const formatted = lines.map((line) => {
      let l = line.trim();
      l = l.replace(/\s•\s/g, " ");
      if (l.match(/^\d+\.\s+[A-Za-zÀ-ÿ]/)) return `\n${l.toUpperCase()}\n`;
      if (
        l.endsWith(":") ||
        (l.length < 50 &&
          !l.startsWith("•") &&
          !l.startsWith("-") &&
          l.match(/^[A-Z][^.!?]*$/))
      ) {
        const titleText = l.endsWith(":") ? l.slice(0, -1) : l;
        return `\n${titleText.toUpperCase()}\n`;
      }
      if (l.startsWith("•") || l.startsWith("-"))
        return `• ${l.replace(/^[•\-]\s*/, "")}`;
      return line;
    });
    return formatted.join("\n");
  };

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const copyWithFormatting = useCallback(
    async (markdownText: string, _isUser: boolean, messageId: string) => {
      try {
        setCopiedMessageId(messageId);
        await navigator.clipboard.writeText(markdownText);
      } catch (error) {
        console.error("Erro ao copiar:", error);
      } finally {
        setTimeout(() => setCopiedMessageId(null), 2000);
      }
    },
    []
  );

  const shareMessage = useCallback(
    async (messageId: string, _content: string) => {
      try {
        setSharedMessageId(messageId);
        const conversationUrl = currentConversationId
          ? `${window.location.origin}/chat?conversation=${currentConversationId}&message=${messageId}`
          : `${window.location.origin}/chat?message=${messageId}`;
        await navigator.clipboard.writeText(conversationUrl);
        toast({
          title: "Link copiado!",
          description:
            "O link da resposta foi copiado para a área de transferência.",
        });
      } catch (error) {
        console.error("Erro ao compartilhar:", error);
        toast({
          title: "Erro",
          description: "Não foi possível copiar o link.",
          variant: "destructive",
        });
      } finally {
        setTimeout(() => setSharedMessageId(null), 2000);
      }
    },
    [currentConversationId, toast]
  );

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const toSerializable = (msgs: Message[]) =>
    msgs.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
  const fromSerializable = (msgs: any[]): Message[] =>
    (msgs || []).map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  const deriveTitle = (msgs: Message[]) =>
    (
      msgs.find((m) => m.sender === "user")?.content?.trim() || "Nova conversa"
    ).slice(0, 50);

  const openConversation = useCallback((conv: ChatConversation) => {
    setCurrentConversationId(conv.id);
    setMessages(fromSerializable(conv.messages));
  }, []);

  const upsertConversation = useCallback(
    async (finalMessages: Message[], convId: string | null) => {
      try {
        const serial = toSerializable(finalMessages);
        let newConvId = convId;

        if (!newConvId || newConvId.startsWith("temp_")) {
          const { data, error } = await supabase
            .from("chat_conversations")
            .insert({
              user_id: user!.id,
              title: deriveTitle(finalMessages),
              messages: serial,
              is_favorite: false,
            })
            .select("*")
            .single();
          if (error) throw error;

          if (newConvId?.startsWith("temp_")) {
            setCurrentConversationId(data.id);
            setConversations((prev) =>
              prev.map((c) =>
                c.id === newConvId
                  ? {
                      ...data,
                      messages: Array.isArray(data.messages)
                        ? data.messages
                        : [],
                    }
                  : c
              )
            );
          } else {
            setCurrentConversationId(data.id);
            setConversations((prev) => [
              {
                ...data,
                messages: Array.isArray(data.messages) ? data.messages : [],
              },
              ...prev,
            ]);
          }
        } else {
          const currentConv = conversations.find((c) => c.id === newConvId);
          const shouldRename =
            !currentConv ||
            currentConv.title === "Nova conversa" ||
            currentConv.messages.length === 0;
          const updatePayload: any = {
            messages: serial,
            updated_at: new Date().toISOString(),
          };
          if (shouldRename) updatePayload.title = deriveTitle(finalMessages);

          const { data, error } = await supabase
            .from("chat_conversations")
            .update(updatePayload)
            .eq("id", newConvId)
            .select("*")
            .single();
          if (error) throw error;
          setConversations((prev) => [
            {
              ...data,
              messages: Array.isArray(data.messages) ? data.messages : [],
            },
            ...prev.filter((c) => c.id !== data.id),
          ]);
        }
      } catch (e) {
        console.error("Erro ao salvar conversa:", e);
      }
    },
    [conversations, user]
  );

  const createNewConversation = useCallback(async () => {
    if (messages.length > 0 && currentConversationId) {
      await upsertConversation(messages, currentConversationId);
    }
    startTransition(() => {
      setCurrentConversationId(null);
      setMessages([]);
      setInputValue("");
      setAttachedFiles([]);
      setProcessedPdfs(new Map());
      setProcessedWords(new Map());
      setProcessedDocuments(new Map());
      setFileProcessingStatus(new Map());
      setComparativeAnalysisEnabled(false);
      filePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setFilePreviewUrls(new Map());
    });
  }, [currentConversationId, messages, upsertConversation, filePreviewUrls]);

  const deleteConversation = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", id);
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível excluir a conversa.",
          variant: "destructive",
        });
        return;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        createNewConversation();
      }
    },
    [toast, currentConversationId, createNewConversation]
  );

  const toggleFavoriteConversation = useCallback(
    async (conv: ChatConversation) => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .update({ is_favorite: !conv.is_favorite })
        .eq("id", conv.id)
        .select("*")
        .single();
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar favorito.",
          variant: "destructive",
        });
      } else if (data) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === data.id
              ? {
                  ...data,
                  messages: Array.isArray(data.messages) ? data.messages : [],
                }
              : c
          )
        );
      }
    },
    [toast]
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .update({ title: newTitle })
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível renomear a conversa.",
          variant: "destructive",
        });
      } else if (data) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === data.id
              ? {
                  ...data,
                  messages: Array.isArray(data.messages) ? data.messages : [],
                }
              : c
          )
        );
        toast({ title: "Conversa renomeada!" });
      }
    },
    [toast]
  );

  const handleModelChange = useCallback(
    async (newModel: string) => {
      if (selectedModel && selectedModel !== newModel && messages.length > 0) {
        await createNewConversation();
      }
      setSelectedModel(newModel);
    },
    [selectedModel, messages.length, createNewConversation]
  );

  const renderFileIcon = useCallback(
    (fileName: string, fileType: string, fileUrl?: string) => {
      const isImage = fileType.startsWith("image/");
      const isPdf =
        fileType === "application/pdf" ||
        fileName.toLowerCase().endsWith(".pdf");
      const isWord =
        fileType.includes("word") ||
        fileName.toLowerCase().endsWith(".docx") ||
        fileName.toLowerCase().endsWith(".doc");

      return (
        <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border max-w-xs">
          <div className="flex-shrink-0">
            {isImage && fileUrl ? (
              <div className="w-16 h-16 rounded-md overflow-hidden border-2 border-white/20">
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : isImage ? (
              <div className="w-16 h-16 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border">
                <ImageIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
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
            <p
              className="text-sm font-medium text-foreground truncate"
              title={fileName}
            >
              {fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPdf ? "PDF" : isWord ? "Word" : isImage ? "Imagem" : "Arquivo"}
            </p>
          </div>
        </div>
      );
    },
    []
  );

  // =====================
  // Envio de mensagem
  // =====================
  const generateComparativePrompt = useCallback(
    (userMessage: string, documents: Map<string, any>) => {
      if (documents.size <= 1) return userMessage;
      const documentList = Array.from(documents.entries())
        .map(([fileName, doc], index) => {
          return `DOCUMENTO ${
            index + 1
          }: ${fileName} (${doc.type.toUpperCase()}${
            doc.pages ? `, ${doc.pages} páginas` : ""
          })
Conteúdo: ${doc.content.substring(0, 2000)}${
            doc.content.length > 2000 ? "..." : ""
          }`;
        })
        .join("\n\n");

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

Forneça uma resposta abrangente que integre informações de todos os documentos, destacando semelhanças, diferenças e insights únicos que emergem da análise conjunta.`;
    },
    []
  );

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading)
        return;

      const currentInput = inputValue;
      const currentFiles = [...attachedFiles];

      startTransition(() => {
        setInputValue("");
        setAttachedFiles([]);
        setProcessedPdfs(new Map());
        setProcessedWords(new Map());
        setProcessedDocuments(new Map());
        setFileProcessingStatus(new Map());
        setComparativeAnalysisEnabled(false);
        filePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        setFilePreviewUrls(new Map());
      });

      if (textareaRef.current) {
        textareaRef.current.style.height = "52px";
      }
      if (fileInputRef.current) fileInputRef.current.value = "";

      const canProceed = await consumeTokens(selectedModel, currentInput);
      if (!canProceed) return;

      const fileData = await Promise.all(
        currentFiles.map(async (file) => {
          const baseData = {
            name: file.name,
            type: file.type,
            data: await fileToBase64(file),
          } as any;
          return isPdfFile(file)
            ? { ...baseData, pdfContent: processedPdfs.get(file.name) || "" }
            : baseData;
        })
      );

      const userMessage: Message = {
        id: Date.now().toString(),
        content: currentInput,
        sender: "user",
        timestamp: new Date(),
        files: currentFiles.map((f) => ({
          name: f.name,
          type: f.type,
          url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        })),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);

      let convId = currentConversationId;
      if (!convId) {
        const tempId = `temp_${Date.now()}`;
        const newTempConv = {
          id: tempId,
          title: deriveTitle(newMessages),
          messages: toSerializable(newMessages),
          is_favorite: false,
          user_id: user!.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setConversations((prev) => [newTempConv as any, ...prev]);
        setCurrentConversationId(tempId);
        convId = tempId;
      }

      try {
        const originalModel = selectedModel;
        const internalModel =
          selectedModel === "synergy-ia" ? "gpt-4o-mini" : selectedModel;

        let messageWithFiles = currentInput;

        if (processedDocuments.size > 1 && comparativeAnalysisEnabled) {
          messageWithFiles = generateComparativePrompt(
            currentInput,
            processedDocuments
          );
        } else if (currentFiles.length > 0) {
          const pdfFiles = currentFiles.filter(isPdfFile);
          const wordFiles = currentFiles.filter(isWordFile);
          const imageFiles = currentFiles.filter((f) =>
            f.type.startsWith("image/")
          );

          const contents: string[] = [];

          if (pdfFiles.length > 0) {
            const pdfContents = pdfFiles.map((pdf) => {
              const pdfContent = processedPdfs.get(pdf.name);
              return `[Arquivo PDF: ${pdf.name}]\n\n${
                pdfContent || "Conteúdo não disponível"
              }`;
            });
            contents.push(...pdfContents);
          }

          if (wordFiles.length > 0) {
            const wordContents = wordFiles.map(
              (word) =>
                `[Arquivo Word: ${word.name}]\n\n${
                  processedWords.get(word.name) || "Conteúdo não disponível"
                }`
            );
            contents.push(...wordContents);
          }

          // Suporte à visão para alguns modelos
          if (imageFiles.length > 0) {
            const visionModels = [
              "gpt-5",
              "gpt-5-mini",
              "gpt-5-nano",
              "gpt-4.1",
              "gpt-4.1-mini",
              "gpt-4.1-nano",
              "o4-mini",
              "claude-opus-4-20250514",
              "claude-sonnet-4-20250514",
              "claude-3-5-haiku-20241022",
              "gemini-2.5-pro",
              "gemini-2.5-flash",
              "gemini-2.5-flash-lite",
              "grok-4-0709",
              "grok-3",
              "grok-3-mini",
            ];
            const isVisionModel = visionModels.includes(originalModel);

            if (isVisionModel) {
              const imageFile = imageFiles[0];
              try {
                const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(imageFile);
                });
                const base64Data = base64.split(",")[1];

                let aiProvider = "openai";
                if (originalModel.includes("claude")) aiProvider = "claude";
                else if (originalModel.includes("gemini"))
                  aiProvider = "gemini";
                else if (originalModel.includes("grok")) aiProvider = "grok";

                const { data: analysisResult, error: analysisError } =
                  await supabase.functions.invoke("image-analysis", {
                    body: {
                      imageBase64: base64Data,
                      prompt:
                        currentInput ||
                        "Analise esta imagem e descreva o que você vê.",
                      aiProvider,
                      analysisType: "general",
                    },
                  });

                if (analysisError) throw new Error(analysisError.message);

                const botMessage: Message = {
                  id: Date.now().toString(),
                  content: analysisResult.analysis,
                  sender: "bot",
                  timestamp: new Date(),
                  model: originalModel,
                };

                setMessages((prev) => [...prev, botMessage]);
                if (user?.id) {
                  await upsertConversation(
                    [...messages, userMessage, botMessage],
                    currentConversationId
                  );
                }
                setIsLoading(false);
                setInputValue("");
                return; // sai do fluxo padrão
              } catch (error) {
                console.error("Image analysis error:", error);
                toast({
                  title: "Erro na análise de imagem",
                  description:
                    "Não foi possível analisar a imagem. Verifique as chaves API.",
                  variant: "destructive",
                });
                setIsLoading(false);
                return;
              }
            } else {
              const imageContents = imageFiles.map(
                (img) => `[Imagem anexada: ${img.name}]`
              );
              contents.push(...imageContents);
            }
          }

          if (contents.length > 0) {
            messageWithFiles = `${currentInput}\n\n${contents.join(
              "\n\n---\n\n"
            )}`;
          }
        }

        const functionName = getEdgeFunctionName(internalModel);

        const conversationHistory = messages.slice(-20).map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.content,
          files: msg.files || [],
          timestamp: msg.timestamp.toISOString(),
        }));

        const { data: fnData, error: fnError } =
          await supabase.functions.invoke(functionName, {
            body: {
              message: messageWithFiles,
              model: internalModel,
              files: fileData.length > 0 ? fileData : undefined,
              conversationHistory,
              contextEnabled: true,
            },
          });
        if (fnError) throw fnError;

        const data = fnData as any;
        const fullBotText =
          typeof data.response === "string"
            ? data.response
            : data.response?.content ||
              "Desculpe, não consegui processar sua mensagem.";
        const reasoning =
          typeof data.response === "string" ? "" : data.response?.reasoning;

        // Placeholder de streaming
        const botMessageId = (Date.now() + 1).toString();
        const placeholderBotMessage: Message = {
          id: botMessageId,
          content: "",
          sender: "bot",
          timestamp: new Date(),
          model: selectedModel,
          reasoning: reasoning || undefined,
          isStreaming: true,
        };

        setMessages((prev) => [...prev, placeholderBotMessage]);
        setIsStreamingResponse(true);

        // Streaming via rAF (menos updates)
        let index = 0;
        const total = fullBotText.length;
        const updatesCount = Math.min(32, Math.max(12, Math.ceil(total / 500)));
        const chunkSize = Math.max(Math.ceil(total / updatesCount), 50);

        const step = () => {
          if (index < total) {
            const nextIndex = Math.min(index + chunkSize, total);
            const partial = fullBotText.slice(0, nextIndex);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId ? { ...msg, content: partial } : msg
              )
            );
            index = nextIndex;
            streamingRafRef.current = requestAnimationFrame(step);
          } else {
            if (streamingRafRef.current) {
              cancelAnimationFrame(streamingRafRef.current);
              streamingRafRef.current = null;
            }
            const finalBotMessage: Message = {
              ...placeholderBotMessage,
              content: fullBotText,
              isStreaming: false,
            };
            const finalMessages = [...newMessages, finalBotMessage];

            startTransition(() => {
              setMessages(finalMessages);
              setIsStreamingResponse(false);
            });

            setTimeout(() => {
              if (isNearBottom && messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
              }
            }, 80);

            upsertConversation(finalMessages, convId);
            setIsLoading(false);
          }
        };

        streamingRafRef.current = requestAnimationFrame(step);
      } catch (error: any) {
        console.error("Error sending message:", error);
        toast({
          title: "Erro",
          description: "Não foi possível enviar a mensagem.",
          variant: "destructive",
        });
        setMessages(newMessages);
        setIsLoading(false);
        setIsStreamingResponse(false);
      }
    },
    [
      inputValue,
      attachedFiles,
      isLoading,
      consumeTokens,
      selectedModel,
      processedPdfs,
      processedWords,
      processedDocuments,
      comparativeAnalysisEnabled,
      messages,
      currentConversationId,
      user,
      generateComparativePrompt,
      isNearBottom,
      toast,
      upsertConversation,
    ]
  );

  const handleStopGeneration = useCallback(() => {
    if (streamingRafRef.current) {
      cancelAnimationFrame(streamingRafRef.current);
      streamingRafRef.current = null;
    }
    setIsLoading(false);
    setIsStreamingResponse(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    );
  }, []);

  // Uploads / DnD
  const processFilesInParallel = useCallback(
    async (files: File[]) => {
      const newPreviewUrls = new Map(filePreviewUrls);

      const processingPromises = files.map(async (file) => {
        const fileName = file.name;
        setFileProcessingStatus(
          (prev) => new Map(prev.set(fileName, "processing"))
        );
        try {
          if (file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            newPreviewUrls.set(fileName, url);
            setProcessedDocuments(
              (prev) =>
                new Map(
                  prev.set(fileName, {
                    content: `Imagem anexada: ${fileName}`,
                    type: "image",
                    fileSize: file.size,
                  })
                )
            );
            setFileProcessingStatus(
              (prev) => new Map(prev.set(fileName, "completed"))
            );
            return { fileName, success: true };
          } else if (isPdfFile(file)) {
            const result = await PdfProcessor.processPdf(file);
            if (result.success && result.content) {
              setProcessedDocuments(
                (prev) =>
                  new Map(
                    prev.set(fileName, {
                      content: result.content!,
                      type: "pdf",
                      pages: result.pageCount,
                      fileSize: file.size,
                    })
                  )
              );
              setProcessedPdfs((prev) =>
                new Map(prev).set(fileName, result.content || "")
              );
              setFileProcessingStatus(
                (prev) => new Map(prev.set(fileName, "completed"))
              );
              return { fileName, success: true };
            } else {
              throw new Error(result.error || "Erro ao processar PDF");
            }
          } else if (isWordFile(file)) {
            const result = await WordProcessor.processWord(file);
            if (result.success && result.content) {
              setProcessedDocuments(
                (prev) =>
                  new Map(
                    prev.set(fileName, {
                      content: result.content!,
                      type: "word",
                      fileSize: file.size,
                    })
                  )
              );
              setProcessedWords((prev) =>
                new Map(prev).set(fileName, result.content || "")
              );
              setFileProcessingStatus(
                (prev) => new Map(prev.set(fileName, "completed"))
              );
              return { fileName, success: true };
            } else {
              throw new Error(result.error || "Erro ao processar Word");
            }
          }
          return {
            fileName,
            success: false,
            error: "Tipo de arquivo não suportado" as const,
          };
        } catch (error: any) {
          console.error(`Erro ao processar ${fileName}:`, error);
          setFileProcessingStatus(
            (prev) => new Map(prev.set(fileName, "error"))
          );
          return { fileName, success: false, error: error.message };
        }
      });

      setFilePreviewUrls(newPreviewUrls);
      const results = await Promise.all(processingPromises);
      const failed = results.filter((r) => !r.success).length;
      if (failed > 0) {
        toast({
          title: `Erro ao processar ${failed} arquivo(s)`,
          description:
            "Alguns arquivos não puderam ser processados. Verifique o formato e tente novamente.",
          variant: "destructive",
        });
      }
    },
    [filePreviewUrls, toast]
  );

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const totalFiles = attachedFiles.length + files.length;
      if (totalFiles > 5) {
        toast({
          title: "Limite de arquivos excedido",
          description: `Você pode anexar no máximo 5 arquivos. Atualmente: ${attachedFiles.length} + ${files.length} = ${totalFiles}`,
          variant: "destructive",
        });
        return;
      }

      const validFiles = files.filter((file) => {
        const isValidType =
          file.type.startsWith("image/") || isPdfFile(file) || isWordFile(file);
        return isValidType && file.size <= 50 * 1024 * 1024;
      });

      if (validFiles.length === 0) {
        toast({
          title: "Nenhum arquivo válido",
          description:
            "Arraste apenas imagens, PDFs ou documentos Word (.doc/.docx, máx. 50MB cada).",
          variant: "destructive",
        });
        return;
      }

      setAttachedFiles((prev) => [...prev, ...validFiles]);
      if (attachedFiles.length + validFiles.length > 1) {
        setComparativeAnalysisEnabled(true);
      }
      await processFilesInParallel(validFiles);
    },
    [attachedFiles.length, processFilesInParallel, toast]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const totalFiles = attachedFiles.length + files.length;
      if (totalFiles > 5) {
        toast({
          title: "Limite de arquivos excedido",
          description: `Você pode anexar no máximo 5 arquivos. Atualmente: ${attachedFiles.length} + ${files.length} = ${totalFiles}`,
          variant: "destructive",
        });
        return;
      }

      const validFiles = files.filter((file) => {
        const isValidType =
          file.type.startsWith("image/") || isPdfFile(file) || isWordFile(file);
        return isValidType && file.size <= 50 * 1024 * 1024;
      });

      if (validFiles.length === 0) {
        toast({
          title: "Nenhum arquivo válido",
          description:
            "Arraste apenas imagens, PDFs ou documentos Word (.doc/.docx, máx. 50MB cada).",
          variant: "destructive",
        });
        return;
      }

      setAttachedFiles((prev) => [...prev, ...validFiles]);
      if (attachedFiles.length + validFiles.length > 1) {
        setComparativeAnalysisEnabled(true);
      }
      await processFilesInParallel(validFiles);
    },
    [attachedFiles.length, processFilesInParallel, toast]
  );

  // Áudio
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Gravação iniciada", description: "Fale agora..." });
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({
        title: "Gravação finalizada",
        description: "Processando áudio...",
      });
    }
  }, [isRecording, toast]);

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Audio = (reader.result as string).split(",")[1];

          const { data, error } = await supabase.functions.invoke(
            "voice-to-text",
            {
              body: { audio: base64Audio },
            }
          );

          if (error) {
            console.error("Erro na transcrição:", error);
            toast({
              title: "Erro",
              description: "Falha ao transcrever áudio.",
              variant: "destructive",
            });
            return;
          }

          if (data?.text) {
            setInputValue((prev) => prev + (prev ? " " : "") + data.text);
            toast({
              title: "Transcrição concluída",
              description: "Texto adicionado ao input.",
            });
          } else {
            toast({
              title: "Aviso",
              description: "Nenhum texto foi detectado no áudio.",
              variant: "destructive",
            });
          }
        };
        reader.readAsDataURL(audioBlob);
      } catch (error) {
        console.error("Erro ao transcrever áudio:", error);
        toast({
          title: "Erro",
          description: "Falha ao processar áudio.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // Comparação
  const compareWithModel = useCallback(
    async (
      messageId: string,
      modelToCompare: string,
      _originalUserMessage: string
    ) => {
      try {
        setComparingModels((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), modelToCompare],
        }));

        const botMessageIndex = messages.findIndex((m) => m.id === messageId);
        const immediateUserMessage =
          botMessageIndex > 0 ? messages[botMessageIndex - 1] : null;

        if (!immediateUserMessage || immediateUserMessage.sender !== "user") {
          throw new Error(
            "Mensagem do usuário não encontrada ou sequência inválida"
          );
        }

        const messageToSend = immediateUserMessage.content;
        let filesToSend: any[] = [];

        if (
          immediateUserMessage.files &&
          immediateUserMessage.files.length > 0
        ) {
          filesToSend = immediateUserMessage.files.map((file) => {
            const fileData: any = {
              name: file.name,
              type: file.type,
              hasPdfContent: false,
              hasWordContent: false,
              pdfContent: "",
              wordContent: "",
            };
            if (file.type === "application/pdf") {
              const pdfContent = processedPdfs.get(file.name);
              if (pdfContent) {
                fileData.hasPdfContent = true;
                fileData.pdfContent = pdfContent;
              }
            }
            if (
              file.type.includes("word") ||
              file.name.toLowerCase().endsWith(".docx") ||
              file.name.toLowerCase().endsWith(".doc")
            ) {
              const wordContent = processedWords.get(file.name);
              if (wordContent) {
                fileData.hasWordContent = true;
                fileData.wordContent = wordContent;
              }
            }
            return fileData;
          });
        }

        const internalModel =
          modelToCompare === "synergy-ia" ? "gpt-4o-mini" : modelToCompare;
        const functionName = getEdgeFunctionName(internalModel);

        const { data: fnData, error: fnError } =
          await supabase.functions.invoke(functionName, {
            body: {
              message: messageToSend,
              model: internalModel,
              files: filesToSend,
              conversationHistory: [],
              contextEnabled: false,
            },
          });

        if (fnError) throw fnError;
        const data = fnData as any;
        const response =
          typeof data.response === "string"
            ? data.response
            : data.response?.content || "Erro ao processar mensagem.";

        const compareMessage: Message = {
          id: `compare_${Date.now()}_${modelToCompare}`,
          content: response,
          sender: "bot",
          timestamp: new Date(),
          model: modelToCompare,
        };

        setMessages((prev) => [...prev, compareMessage]);
      } catch (error) {
        console.error("Erro na comparação:", error);
        toast({
          title: "Erro",
          description: "Não foi possível fazer a comparação.",
          variant: "destructive",
        });
      } finally {
        setComparingModels((prev) => {
          const newState = { ...prev };
          if (newState[messageId]) {
            newState[messageId] = newState[messageId].filter(
              (m) => m !== modelToCompare
            );
            if (newState[messageId].length === 0) delete newState[messageId];
          }
          return newState;
        });
      }
    },
    [messages, processedPdfs, processedWords, toast]
  );

  const toggleReasoning = useCallback((id: string) => {
    setExpandedReasoning((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  // =====================
  // Render
  // =====================
  if (loading)
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  if (!user || !profile) return null;

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-background flex flex-col">
      {/* ===== CABEÇALHO ===== */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 hover:bg-muted"
            >
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
            <Suspense fallback={<div className="h-6 w-24 bg-muted rounded" />}>
              <ModelSelectorLazy
                onModelSelect={handleModelChange}
                selectedModel={selectedModel}
              />
            </Suspense>
            <Suspense
              fallback={<div className="h-6 w-6 bg-muted rounded-full" />}
            >
              <UserProfileLazy />
            </Suspense>
            <div className="flex-shrink-0">
              <Suspense
                fallback={<div className="h-6 w-10 bg-muted rounded" />}
              >
                <ThemeToggleLazy />
              </Suspense>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-1">
            <div className="flex-shrink-0">
              <Suspense
                fallback={<div className="h-6 w-10 bg-muted rounded" />}
              >
                <ThemeToggleLazy />
              </Suspense>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[320px] p-0 flex flex-col"
              >
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="p-4 space-y-4 border-b">
                  <Suspense
                    fallback={<div className="h-10 w-full bg-muted rounded" />}
                  >
                    <UserProfileLazy />
                  </Suspense>
                  <Suspense
                    fallback={<div className="h-10 w-full bg-muted rounded" />}
                  >
                    <ModelSelectorLazy
                      onModelSelect={handleModelChange}
                      selectedModel={selectedModel}
                    />
                  </Suspense>
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

      {/* ===== CORPO ===== */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
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

        <main className="flex-1 min-h-0 flex flex-col bg-background">
          <div
            ref={chatContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          >
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <div
                  className="flex items-center justify-center h-full text-muted-foreground"
                  style={{ minHeight: "calc(100vh - 250px)" }}
                >
                  <div className="text-center px-2">
                    <h3 className="text-2xl font-bold mb-2">
                      Olá, {profile.name}!
                    </h3>
                    <p>Selecione uma conversa ou inicie uma nova.</p>
                    <p className="mt-2 text-sm">
                      Você tem {tokenBalance.toLocaleString()} tokens
                      disponíveis.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => {
                  const immediateUserMessage =
                    index > 0
                      ? messages[index - 1].sender === "user"
                        ? messages[index - 1]
                        : null
                      : null;

                  return (
                    <div
                      key={message.id}
                      className={`w-full flex items-start sm:items-start gap-2 sm:gap-3 ${
                        message.sender === "user" ? "justify-end" : ""
                      }`}
                    >
                      {message.sender === "bot" ? (
                        <BotMessage
                          message={message}
                          getModelDisplayName={getModelDisplayName}
                          expandedReasoning={expandedReasoning}
                          toggleReasoning={toggleReasoning}
                          isCopied={copiedMessageId === message.id}
                          onCopy={copyWithFormatting}
                          onShare={shareMessage}
                          sharedMessageId={sharedMessageId}
                          comparingModels={comparingModels}
                          compareWithModel={compareWithModel}
                          immediateUserMessage={immediateUserMessage}
                        />
                      ) : (
                        <UserMessage
                          message={message}
                          onCopy={copyWithFormatting}
                          renderFileIcon={renderFileIcon}
                        />
                      )}
                    </div>
                  );
                })
              )}
              {isLoading && (
                <div className="flex gap-2 sm:gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
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
              className="fixed bottom-20 md:bottom-24 right-4 md:right-6 h-10 w-10 rounded-full shadow-lg bg-background hover:bg-muted border-border z-20 transition-all duration-200"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}

          {/* ===== ÁREA DE INPUT ===== */}
          <div className="flex-shrink-0 border-t border-border bg-background px-3 sm:px-4 pt-3 pb-[env(safe-area-inset-bottom)] md:pb-8">
            <div className="max-w-4xl mx-auto">
              {attachedFiles.length > 0 && (
                <div className="space-y-3 mb-4">
                  {comparativeAnalysisEnabled && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Análise Comparativa Ativa
                        </span>
                      </div>
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        {attachedFiles.length} documentos serão comparados e
                        analisados em conjunto
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {attachedFiles.map((file, idx) => {
                      const status = fileProcessingStatus.get(file.name);
                      const isProcessing = status === "processing";
                      const isCompleted = status === "completed";
                      const hasError = status === "error";

                      return (
                        <div key={idx} className="relative group">
                          <div
                            className={`relative ${
                              isProcessing ? "opacity-60" : ""
                            }`}
                          >
                            {renderFileIcon(
                              file.name,
                              file.type,
                              file.type.startsWith("image/")
                                ? filePreviewUrls.get(file.name)
                                : undefined
                            )}

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

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (file.type.startsWith("image/")) {
                                const url = filePreviewUrls.get(file.name);
                                if (url) URL.revokeObjectURL(url);
                              }

                              setAttachedFiles((prev) => {
                                const newFiles = prev.filter(
                                  (_, i) => i !== idx
                                );
                                if (newFiles.length <= 1)
                                  setComparativeAnalysisEnabled(false);
                                return newFiles;
                              });

                              setFilePreviewUrls((prev) => {
                                const newMap = new Map(prev);
                                newMap.delete(file.name);
                                return newMap;
                              });
                              setProcessedPdfs((prev) => {
                                const newMap = new Map(prev);
                                newMap.delete(file.name);
                                return newMap;
                              });
                              setProcessedWords((prev) => {
                                const newMap = new Map(prev);
                                newMap.delete(file.name);
                                return newMap;
                              });
                              setProcessedDocuments((prev) => {
                                const newMap = new Map(prev);
                                newMap.delete(file.name);
                                return newMap;
                              });
                              setFileProcessingStatus((prev) => {
                                const newMap = new Map(prev);
                                newMap.delete(file.name);
                                return newMap;
                              });
                            }}
                            className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </Button>

                          {(isProcessing || hasError) && (
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                              {isProcessing
                                ? "Processando..."
                                : hasError
                                ? "Erro no processamento"
                                : ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-2"
              >
                <div className="flex-1 relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    multiple
                    accept="image/*,.pdf,.docx,.doc"
                  />
                  {/* Botões laterais com espaçamento menor no mobile */}
                  <div className="absolute left-1.5 sm:left-2 top-2.5 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side="top"
                        align="start"
                        className="mb-2"
                      >
                        <DropdownMenuItem
                          onClick={() => fileInputRef.current?.click()}
                          className="cursor-pointer"
                        >
                          <Paperclip className="h-4 w-4 mr-2" />
                          Anexar (.pdf, .doc/.docx, imagens)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setIsWebSearchMode((p) => !p)}
                          className="cursor-pointer"
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          {isWebSearchMode
                            ? "Desativar Busca Web"
                            : "Busca Web"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputValue(val);
                      const target = e.target as HTMLTextAreaElement;
                      requestAnimationFrame(() => {
                        target.style.height = "auto";
                        target.style.height = `${Math.min(
                          target.scrollHeight,
                          128
                        )}px`;
                      });
                    }}
                    placeholder={
                      isDragOver
                        ? "Solte os arquivos aqui..."
                        : isWebSearchMode
                        ? "Digite para buscar na web..."
                        : "Pergunte alguma coisa..."
                    }
                    disabled={isLoading}
                    className={`w-full pl-12 md:pl-14 pr-16 md:pr-24 py-3 rounded-lg resize-none min-h-[52px] max-h-[128px] transition-colors ${
                      isDragOver ? "bg-accent border-primary border-dashed" : ""
                    }`}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isMobile && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                        if (textareaRef.current)
                          textareaRef.current.style.height = "52px";
                      }
                    }}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />

                  <div className="absolute right-2 sm:right-3 top-2.5 flex gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={
                              isRecording ? stopRecording : startRecording
                            }
                            className={`h-8 w-8 ${
                              isRecording ? "text-red-500" : ""
                            }`}
                          >
                            <Mic className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isRecording ? "Parar gravação" : "Gravar áudio"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {isLoading ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              onClick={handleStopGeneration}
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 bg-transparent border-0"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Parar geração</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button
                        type="submit"
                        disabled={
                          !inputValue.trim() && attachedFiles.length === 0
                        }
                        size="icon"
                        className="h-8 w-8"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
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
