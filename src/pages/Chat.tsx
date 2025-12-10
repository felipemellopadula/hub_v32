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
  Plus,
  Menu,
  ArrowUp,
  ArrowDown,
  Square,
  Check,
  FileText,
  File,
  Image as ImageIcon,
  Camera,
  FileSpreadsheet,
  FileCode2,
  Loader2,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import React, { useState, useRef, useEffect, useCallback, useTransition, lazy, Suspense } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
const ModelSelectorLazy = lazy(() =>
  import("@/components/ModelSelector").then((m) => ({
    default: m.ModelSelector,
  })),
);
const ThemeToggleLazy = lazy(() => import("@/components/ThemeToggle").then((m) => ({ default: m.ThemeToggle })));
const UserProfileLazy = lazy(() => import("@/components/UserProfile"));
// Temporarily use static import to debug
import MarkdownRendererLazy from "@/components/CleanMarkdownRenderer";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { WordTablesPreview } from "@/components/WordTablesPreview";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RAGProgressIndicator } from "@/components/RAGProgressIndicator";
import { useRAGProgress } from "@/hooks/useRAGProgress";
import { DeepSeekThinkingIndicator } from "@/components/DeepSeekThinkingIndicator";

// Importar tipos e componentes do chat
import { Message, ChatConversation, FileStatus, formatPtBR, ConversationSidebar, UserMessage, BotMessage } from "@/components/chat";

// =====================
// Utils
// =====================
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

const isPdfFile = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const isPythonFile = (file: File) =>
  file.type === "text/x-python" || file.type === "application/x-python-code" || file.name.toLowerCase().endsWith(".py");

const isExcelFile = (file: File) =>
  file.type.includes("spreadsheet") ||
  file.type.includes("excel") ||
  file.name.toLowerCase().endsWith(".xlsx") ||
  file.name.toLowerCase().endsWith(".xls");

const isWordFile = (file: File) =>
  file.type.includes("word") || file.name.toLowerCase().endsWith(".docx") || file.name.toLowerCase().endsWith(".doc");

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
  const [wordVisionDialog, setWordVisionDialog] = useState<{ show: boolean; file: File | null }>({
    show: false,
    file: null
  });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<Map<string, string>>(new Map());
  const [processedPdfs, setProcessedPdfs] = useState<Map<string, string>>(new Map());
  const [processedWords, setProcessedWords] = useState<Map<string, string>>(new Map());
  const [processedPython, setProcessedPython] = useState<Map<string, string>>(new Map());
  const [processedExcel, setProcessedExcel] = useState<Map<string, string>>(new Map());
  const [fileProcessingStatus, setFileProcessingStatus] = useState<Map<string, FileStatus>>(new Map());
  const [processedDocuments, setProcessedDocuments] = useState<
    Map<string, { content: string; type: string; pages?: number; fileSize?: number; sheets?: any[]; layout?: any[]; tables?: any[] }>
  >(new Map());
  const [comparativeAnalysisEnabled, setComparativeAnalysisEnabled] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
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
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isDeepSeekThinking, setIsDeepSeekThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  
  // Models that support OpenAI Reasoning (Responses API)
  const reasoningCapableModels = ['gpt-5.1', 'gpt-5-mini', 'gpt-5-nano', 'o4-mini'];
  const isReasoningCapable = selectedModel ? reasoningCapableModels.includes(selectedModel) : false;
  
  // RAG Progress hook com cancelamento
  const {
    progress: ragProgress,
    isProcessing: isRAGProcessing,
    isCancelled: isRAGCancelled,
    startRAG,
    startChunking,
    updateChunking,
    startAnalysis,
    updateAnalysis,
    startSynthesis,
    updateSynthesis,
    startFiltering,
    updateFiltering,
    startConsolidation,
    updateConsolidation,
    completeRAG,
    cancelRAG,
    resetProgress
  } = useRAGProgress({
    totalPages: (() => {
      const pdfFile = attachedFiles.find(f => isPdfFile(f));
      if (pdfFile) {
        const doc = processedDocuments.get(pdfFile.name);
        return doc?.pages;
      }
      const wordFile = attachedFiles.find(f => isWordFile(f));
      if (wordFile) {
        const doc = processedDocuments.get(wordFile.name);
        return doc?.pages;
      }
      return undefined;
    })(),
    onComplete: () => {
      console.log('✅ RAG processamento concluído');
      setProcessingStatus('');
    },
    onCancel: () => {
      console.log('🛑 RAG processamento cancelado');
      setProcessingStatus('');
      setIsLoading(false);
    }
  });

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
    if (!isStreamingResponse && messagesEndRef.current) {
      // Rola automaticamente para o final sempre que mensagens mudam e não está streaming
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreamingResponse]);

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
      if (l.endsWith(":") || (l.length < 50 && !l.startsWith("•") && !l.startsWith("-") && l.match(/^[A-Z][^.!?]*$/))) {
        const titleText = l.endsWith(":") ? l.slice(0, -1) : l;
        return `\n${titleText.toUpperCase()}\n`;
      }
      if (l.startsWith("•") || l.startsWith("-")) return `• ${l.replace(/^[•\-]\s*/, "")}`;
      return line;
    });
    return formatted.join("\n");
  };

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const copyWithFormatting = useCallback(async (markdownText: string, _isUser: boolean, messageId: string) => {
    try {
      setCopiedMessageId(messageId);

      // Convert markdown to plain text with proper formatting for Word
      const plainText = markdownText
        // Convert headers to plain text with proper line breaks
        .replace(/^#{1}\s+(.+)$/gm, "$1\r\n") // H1
        .replace(/^#{2}\s+(.+)$/gm, "$1\r\n") // H2
        .replace(/^#{3}\s+(.+)$/gm, "$1\r\n") // H3
        .replace(/^#{4,6}\s+(.+)$/gm, "$1\r\n") // H4-H6

        // Convert bullet points to proper bullets
        .replace(/^-\s+(.+)$/gm, "• $1")
        .replace(/^\*\s+(.+)$/gm, "• $1")

        // Convert numbered lists (keep numbers)
        .replace(/^\d+\.\s+(.+)$/gm, (match, p1, offset, string) => {
          const lineNumber = (string.substring(0, offset).match(/^\d+\.\s+/gm) || []).length + 1;
          return `${lineNumber}. ${p1}`;
        })

        // Remove bold/italic markers but keep the text
        .replace(/\*\*(.+?)\*\*/g, "$1") // Remove **bold**
        .replace(/\*(.+?)\*/g, "$1") // Remove *italic*
        .replace(/__(.+?)__/g, "$1") // Remove __bold__
        .replace(/_(.+?)_/g, "$1") // Remove _italic_

        // Convert line breaks to Windows format
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n/g, "\r\n");

      await navigator.clipboard.writeText(plainText);
    } catch (error) {
      console.error("Erro ao copiar:", error);
    } finally {
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  }, []);

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
          description: "O link da resposta foi copiado para a área de transferência.",
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
    [currentConversationId, toast],
  );

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const toSerializable = (msgs: Message[]) => msgs.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
  const fromSerializable = (msgs: any[]): Message[] =>
    (msgs || []).map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  const deriveTitle = (msgs: Message[]) =>
    (msgs.find((m) => m.sender === "user")?.content?.trim() || "Nova conversa").slice(0, 50);

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
                      messages: Array.isArray(data.messages) ? data.messages : [],
                    }
                  : c,
              ),
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
            !currentConv || currentConv.title === "Nova conversa" || currentConv.messages.length === 0;
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
    [conversations, user],
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
      const { error } = await supabase.from("chat_conversations").delete().eq("id", id);
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
    [toast, currentConversationId, createNewConversation],
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
              : c,
          ),
        );
      }
    },
    [toast],
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
              : c,
          ),
        );
        toast({ title: "Conversa renomeada!" });
      }
    },
    [toast],
  );

  const handleModelChange = useCallback(
    async (newModel: string) => {
      if (selectedModel && selectedModel !== newModel && messages.length > 0) {
        await createNewConversation();
      }
      setSelectedModel(newModel);
    },
    [selectedModel, messages.length, createNewConversation],
  );

  const renderFileIcon = useCallback((fileName: string, fileType: string, fileUrl?: string) => {
    const isImage = fileType.startsWith("image/");
    const isPdf = fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
    const isWord =
      fileType.includes("word") || fileName.toLowerCase().endsWith(".docx") || fileName.toLowerCase().endsWith(".doc");
    const isPython = fileName.toLowerCase().endsWith(".py");
    const isExcel = fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls");

    return (
      <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border max-w-xs">
        <div className="flex-shrink-0">
          {isImage && fileUrl ? (
            <div className="w-16 h-16 rounded-md overflow-hidden border-2 border-white/20">
              <img src={fileUrl} alt={fileName} className="w-full h-full object-cover" />
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
          ) : isExcel ? (
            <div className="w-12 h-12 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center border">
              <FileSpreadsheet className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          ) : isPython ? (
            <div className="w-12 h-12 rounded-md bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center border">
              <FileCode2 className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
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
            {isPdf ? "PDF" : isWord ? "Word" : isImage ? "Imagem" : "Arquivo"}
          </p>
        </div>
      </div>
    );
  }, []);

  // =====================
  // Envio de mensagem
  // =====================
  const generateComparativePrompt = useCallback(
    (userMessage: string, documents: Map<string, any>, modelName: string) => {
      if (documents.size <= 1) return userMessage;

      // Detectar se é modelo OpenAI com Tier 2
      const isOpenAITier2 =
        modelName.includes("gpt-5") ||
        modelName.includes("gpt-4.1") ||
        modelName.includes("o3") ||
        modelName.includes("o4");

      // Limites por modelo: Tier 2 OpenAI = 25.000 chars, Outros = 2.000 chars
      const maxCharsPerDoc = isOpenAITier2 ? 25000 : 2000;
      const useDetailedPrompt = isOpenAITier2;

      const documentList = Array.from(documents.entries())
        .map(([fileName, doc], index) => {
          const contentPreview = doc.content.substring(0, maxCharsPerDoc);
          const isTruncated = doc.content.length > maxCharsPerDoc;

          return `═══ DOCUMENTO ${index + 1} ═══
Nome: ${fileName}
Tipo: ${doc.type.toUpperCase()}
${doc.pages ? `Páginas: ${doc.pages}` : ""}
Tamanho: ${doc.content.length} caracteres${isTruncated ? ` (mostrando primeiros ${maxCharsPerDoc})` : ""}

CONTEÚDO:
${contentPreview}${isTruncated ? "\n\n[... conteúdo truncado ...]" : ""}`;
        })
        .join("\n\n" + "─".repeat(80) + "\n\n");

      if (useDetailedPrompt) {
        // Prompt detalhado para modelos Tier 2 OpenAI
        return `# ANÁLISE COMPARATIVA PROFUNDA DE DOCUMENTOS

Você recebeu ${documents.size} documentos para uma análise comparativa detalhada e abrangente.

## INSTRUÇÕES DE ANÁLISE

Como um assistente especializado em análise documental, você deve:

### 1. COMPREENSÃO INDIVIDUAL (por documento)
- Identifique o propósito e contexto de cada documento
- Reconheça o tipo, formato e estrutura
- Extraia os pontos-chave, dados relevantes e informações críticas
- Identifique o tom, estilo e público-alvo

### 2. MAPEAMENTO COMPARATIVO
- **Convergências**: Identifique onde os documentos concordam ou se complementam
- **Divergências**: Destaque diferenças, contradições ou abordagens distintas
- **Lacunas**: Identifique o que cada documento cobre que os outros não cobrem
- **Sobreposições**: Reconheça redundâncias ou repetições entre documentos

### 3. ANÁLISE CONTEXTUAL
- Compare dados quantitativos (números, estatísticas, métricas)
- Compare aspectos qualitativos (opiniões, argumentos, narrativas)
- Analise evolução temporal (se aplicável)
- Identifique padrões e tendências

### 4. SÍNTESE INTEGRADA
- Combine insights de todos os documentos
- Crie uma visão unificada quando possível
- Destaque insights únicos que emergem da comparação
- Forneça conclusões baseadas em evidências

### 5. RESPOSTA ESTRUTURADA
Organize sua resposta de forma clara:
- Use títulos e subtítulos
- Cite documentos específicos quando relevante
- Use tabelas comparativas quando apropriado
- Forneça exemplos concretos

## DOCUMENTOS FORNECIDOS

${documentList}

## SOLICITAÇÃO DO USUÁRIO

${userMessage}

---

**Forneça uma análise completa, detalhada e bem estruturada que responda à solicitação do usuário integrando todos os documentos de forma inteligente.**`;
      } else {
        // Prompt simplificado para outros modelos (Claude, Gemini, Grok, DeepSeek, APILLM)
        return `ANÁLISE COMPARATIVA DE MÚLTIPLOS DOCUMENTOS

Você recebeu ${documents.size} documentos para análise. Realize uma análise comparativa considerando:

1. IDENTIFICAÇÃO E CONTEXTO de cada documento
2. PONTOS DE CONVERGÊNCIA entre os documentos
3. DIVERGÊNCIAS e CONTRASTES identificados
4. SÍNTESE INTEGRADA das informações
5. INSIGHTS e CONCLUSÕES baseadas na comparação

DOCUMENTOS FORNECIDOS:
${documentList}

PERGUNTA/SOLICITAÇÃO DO USUÁRIO:
${userMessage}

Forneça uma resposta abrangente que integre informações de todos os documentos.`;
      }
    },
    [],
  );

  const captureScreenshot = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast({
          title: "Não suportado",
          description: "Screenshot não é suportado neste navegador.",
          variant: "destructive",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
              const fileName = `screenshot-${timestamp}.png`;

              if (attachedFiles.length >= 5) {
                toast({
                  title: "Limite excedido",
                  description: "Máximo de 5 arquivos permitidos por vez.",
                  variant: "destructive",
                });
                return;
              }

              // Criar arquivo usando Object.assign para contornar problema de tipagem
              const fileData = new Blob([blob], { type: "image/png" });
              const file = Object.assign(fileData, { name: fileName });
              const imageUrl = URL.createObjectURL(blob);

              setAttachedFiles((prev) => [...prev, file as File]);
              setFilePreviewUrls((prev) => {
                const newMap = new Map(prev);
                newMap.set(fileName, imageUrl);
                return newMap;
              });
              setFileProcessingStatus((prev) => {
                const newMap = new Map(prev);
                newMap.set(fileName, "completed");
                return newMap;
              });

              toast({
                title: "Screenshot capturado",
                description: "Screenshot anexado com sucesso!",
              });
            }
          }, "image/png");
        }

        stream.getTracks().forEach((track) => track.stop());
      };
    } catch (error) {
      console.error("Erro ao capturar screenshot:", error);
      toast({
        title: "Erro",
        description: "Erro ao capturar screenshot.",
        variant: "destructive",
      });
    }
  }, [attachedFiles.length, toast]);

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));

      if (imageItems.length > 0) {
        e.preventDefault();

        if (attachedFiles.length + imageItems.length > 5) {
          toast({
            title: "Limite excedido",
            description: "Máximo de 5 arquivos permitidos por vez.",
            variant: "destructive",
          });
          return;
        }

        try {
          for (const item of imageItems) {
            const file = item.getAsFile();
            if (file) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
              const fileName = `pasted-image-${timestamp}.${file.type.split("/")[1]}`;
              const imageUrl = URL.createObjectURL(file);

              // Criar arquivo usando Object.assign para contornar problema de tipagem
              const fileBlob = new Blob([file], { type: file.type });
              const renamedFile = Object.assign(fileBlob, { name: fileName });

              setAttachedFiles((prev) => [...prev, renamedFile as File]);
              setFilePreviewUrls((prev) => {
                const newMap = new Map(prev);
                newMap.set(fileName, imageUrl);
                return newMap;
              });
              setFileProcessingStatus((prev) => {
                const newMap = new Map(prev);
                newMap.set(fileName, "completed");
                return newMap;
              });
            }
          }

          toast({
            title: "Imagem anexada",
            description: `${imageItems.length} imagem(ns) colada(s) com sucesso!`,
          });
        } catch (error) {
          console.error("Erro ao processar imagem colada:", error);
          toast({
            title: "Erro",
            description: "Erro ao processar a imagem colada.",
            variant: "destructive",
          });
        }
      }
    },
    [attachedFiles.length, toast],
  );

  // Event listener para paste de imagens
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("paste", handlePaste as EventListener);
      return () => {
        textarea.removeEventListener("paste", handlePaste as EventListener);
      };
    }
  }, [handlePaste]);

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return;

      // [FIX] Cancela qualquer streaming anterior antes de iniciar outro
      if (streamingRafRef.current) {
        cancelAnimationFrame(streamingRafRef.current);
        streamingRafRef.current = null;
      }

      const currentInput = inputValue;
      const currentFiles = [...attachedFiles];

      startTransition(() => {
        setInputValue("");
        setAttachedFiles([]);
        setProcessedPdfs(new Map());
        setProcessedWords(new Map());
        setProcessedPython(new Map());
        setProcessedExcel(new Map());
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
          const base64Data = await fileToBase64(file);
          const baseData = {
            name: file.name,
            type: file.type,
            data: base64Data,
          } as any;

          // Para imagens, adicionar imageData no formato correto
          if (file.type.startsWith("image/")) {
            baseData.imageData = base64Data; // data:image/...;base64,...
          }

          // Para PDFs
          if (isPdfFile(file)) {
            baseData.pdfContent = processedPdfs.get(file.name) || "";
          }

          // Para Word docs
          if (isWordFile(file)) {
            baseData.wordContent = processedWords.get(file.name) || "";
          }

          // Para arquivos Python
          if (isPythonFile(file)) {
            baseData.pythonContent = processedPython.get(file.name) || "";
          }

          // Para arquivos Excel
          if (isExcelFile(file)) {
            baseData.excelContent = processedExcel.get(file.name) || "";
          }

          return baseData;
        }),
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
        const internalModel = selectedModel === "synergy-ia" ? "gpt-4o-mini" : selectedModel;

        let messageWithFiles = currentInput;

        if (processedDocuments.size > 1 && comparativeAnalysisEnabled) {
          messageWithFiles = generateComparativePrompt(currentInput, processedDocuments, originalModel);
        } else if (currentFiles.length > 0) {
          const pdfFiles = currentFiles.filter(isPdfFile);
          const wordFiles = currentFiles.filter(isWordFile);
          const imageFiles = currentFiles.filter((f) => f.type.startsWith("image/"));

          const contents: string[] = [];

          if (pdfFiles.length > 0) {
            const pdfContents = pdfFiles.map((pdf) => {
              const pdfContent = processedPdfs.get(pdf.name);
              return `[Arquivo PDF: ${pdf.name}]\n\n${pdfContent || "Conteúdo não disponível"}`;
            });
            contents.push(...pdfContents);
          }

          if (wordFiles.length > 0) {
            const wordContents = wordFiles.map(
              (word) => `[Arquivo Word: ${word.name}]\n\n${processedWords.get(word.name) || "Conteúdo não disponível"}`,
            );
            contents.push(...wordContents);
          }

          const pythonFiles = currentFiles.filter(isPythonFile);
          if (pythonFiles.length > 0) {
            const pythonContents = pythonFiles.map(
              (py) => `[Arquivo Python: ${py.name}]\n\n${processedPython.get(py.name) || "Conteúdo não disponível"}`,
            );
            contents.push(...pythonContents);
          }

          const excelFiles = currentFiles.filter(isExcelFile);
          if (excelFiles.length > 0) {
            const excelContents = excelFiles.map(
              (excel) =>
                `[Arquivo Excel: ${excel.name}]\n\n${processedExcel.get(excel.name) || "Conteúdo não disponível"}`,
            );
            contents.push(...excelContents);
          }

          // Suporte à visão para alguns modelos
          if (imageFiles.length > 0) {
            const visionModels = [
              "gpt-5.1",
              "gpt-5-mini",
              "gpt-5-nano",
              "gpt-4.1",
              "gpt-4.1-mini",
              "gpt-4.1-nano",
              "o4-mini",
              "synergy-ia", // SynergyIA agora suporta visão
              "gpt-4o-mini", // Backend model para SynergyIA
              "claude-opus-4-1-20250805",
              "claude-sonnet-4-5",
              "claude-haiku-4-5",
              "gemini-2.5-pro",
              "gemini-2.5-flash",
              "gemini-2.5-flash-lite",
              "grok-4-0709",
              "grok-3",
              "grok-3-mini",
            ];
            const isVisionModel = visionModels.includes(originalModel);

            // Para SynergyIA e modelos OpenAI, enviar imagens diretamente ao openai-chat
            const shouldUseDirect =
              originalModel === "synergy-ia" || internalModel.includes("gpt-") || internalModel.includes("o4-");

            if (isVisionModel && !shouldUseDirect) {
              let imageFile = imageFiles[0];

              try {
                // Comprimir imagem se for maior que 3MB (base64 aumenta ~33%, então 3MB * 1.33 = ~4MB)
                const maxSizeInMB = 3;
                if (imageFile.size > maxSizeInMB * 1024 * 1024) {
                  console.log(
                    `Compressing image: ${imageFile.size} bytes (${(imageFile.size / 1024 / 1024).toFixed(2)} MB)`,
                  );
                  const imageCompression = (await import("browser-image-compression")).default;
                  const options = {
                    maxSizeMB: maxSizeInMB,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: "image/jpeg",
                    initialQuality: 0.8,
                  };
                  imageFile = await imageCompression(imageFile, options);
                  console.log(
                    `Image compressed to: ${imageFile.size} bytes (${(imageFile.size / 1024 / 1024).toFixed(2)} MB)`,
                  );
                }

                const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(imageFile);
                });
                const base64Data = base64.split(",")[1];

                // Verificar tamanho do base64
                const base64SizeInMB = (base64Data.length * 0.75) / (1024 * 1024);
                console.log(`Base64 size: ${base64SizeInMB.toFixed(2)} MB`);

                if (base64SizeInMB > 5) {
                  throw new Error(
                    `Imagem muito grande após compressão (${base64SizeInMB.toFixed(2)} MB). O limite é 5MB.`,
                  );
                }

                let aiProvider = "openai";
                if (originalModel.includes("claude")) aiProvider = "claude";
                else if (originalModel.includes("gemini")) aiProvider = "gemini";
                else if (originalModel.includes("grok")) aiProvider = "grok";

                const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
                  "image-analysis",
                  {
                    body: {
                      imageBase64: base64Data,
                      prompt: currentInput || "Analise esta imagem e descreva o que você vê.",
                      aiProvider,
                      analysisType: "general",
                      model: originalModel, // Pass the specific model being used
                    },
                  },
                );

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
                  await upsertConversation([...messages, userMessage, botMessage], currentConversationId);
                }
                setIsLoading(false);
                setInputValue("");
                return; // sai do fluxo padrão
              } catch (error) {
                console.error("Image analysis error:", error);
                toast({
                  title: "Erro na análise de imagem",
                  description: "Não foi possível analisar a imagem. Verifique as chaves API.",
                  variant: "destructive",
                });
                setIsLoading(false);
                return;
              }
            } else if (isVisionModel && shouldUseDirect) {
              // Para SynergyIA e modelos OpenAI, incluir imagens diretamente
              console.log("Adding images to request for vision model:", originalModel);
              // Imagens serão enviadas via fileData abaixo
            } else {
              const imageContents = imageFiles.map((img) => `[Imagem anexada: ${img.name}]`);
              contents.push(...imageContents);
            }
          }

          if (contents.length > 0) {
            messageWithFiles = `${currentInput}\n\n${contents.join("\n\n---\n\n")}`;
          }
        }

        // 🎯 DETECÇÃO DE DOCUMENTOS GRANDES PARA HIERARCHICAL RAG
        let shouldUseHierarchicalRAG = false;
        let documentContent = "";
        let documentPageCount = 0;
        let documentFileName = "";

        // Verificar PDFs processados
        const pdfFiles = currentFiles.filter(isPdfFile);
        if (pdfFiles.length > 0) {
          const pdfName = pdfFiles[0].name;
          const pdfContent = processedPdfs.get(pdfName);
          const pdfDoc = processedDocuments.get(pdfName);
          
          if (pdfContent && pdfDoc?.pages) {
            documentPageCount = pdfDoc.pages;
            documentContent = pdfContent;
            documentFileName = pdfName;
          }
        }

        // Verificar Word processados
        const wordFiles = currentFiles.filter(isWordFile);
        if (wordFiles.length > 0 && !documentContent) {
          const wordName = wordFiles[0].name;
          const wordContent = processedWords.get(wordName);
          const wordDoc = processedDocuments.get(wordName);
          
          if (wordContent && wordDoc?.pages) {
            documentContent = wordContent;
            documentPageCount = wordDoc.pages;
            documentFileName = wordName;
            console.log(`📄 Word document: ${documentPageCount} páginas reais (armazenado)`);
          } else if (wordContent) {
            // Fallback se pages não foi armazenado
            documentContent = wordContent;
            documentPageCount = Math.ceil(wordContent.split(/\s+/).length / 400);
            documentFileName = wordName;
            console.warn(`⚠️ Word sem pageCount armazenado, estimando: ${documentPageCount} páginas`);
          }
        }

        // Ativar Hierarchical RAG se documento >= 20 páginas
        shouldUseHierarchicalRAG = documentPageCount >= 20 && documentContent.length > 0;

        let functionName: string;
        if (shouldUseHierarchicalRAG) {
          functionName = "hierarchical-rag-chat";
          const targetPages = Math.floor(documentPageCount * 0.7);
          console.log(`🔍 Documento grande detectado: ${documentPageCount} páginas → Target: ${targetPages} páginas (70%)`);
          
          const estimateTime = (pages: number): string => {
            const chunkSize = pages <= 100 ? 20 : pages <= 500 ? 25 : 30;
            const numChunks = Math.ceil(pages / chunkSize);
            const batchSize = 2;
            const numBatches = Math.ceil(numChunks / batchSize);
            
            const chunkTime = numBatches * 10;
            const synthesisTime = Math.ceil(numChunks / 3) * 8;
            const consolidationTime = 120;
            
            const totalSeconds = chunkTime + synthesisTime + consolidationTime;
            const minutes = Math.ceil(totalSeconds / 60);
            
            if (minutes <= 3) return '2-3 min';
            if (minutes <= 7) return '4-7 min';
            if (minutes <= 12) return '8-12 min';
            if (minutes <= 20) return '13-20 min';
            return `${minutes-5}-${minutes+5} min`;
          };
          
          setProcessingStatus(`🔍 Processando ${documentPageCount} páginas (${estimateTime(documentPageCount)} estimados)...`);
        } else {
          functionName = getEdgeFunctionName(internalModel);
        }

        // PROCESSAMENTO AGENTIC RAG NO FRONTEND
        if (shouldUseHierarchicalRAG) {
          console.log(`🚀 Iniciando Agentic RAG: ${documentPageCount} páginas`);
          
          try {
            const { AgenticRAG } = await import("@/utils/AgenticRAG");
            const { RAGCache } = await import("@/utils/RAGCache");
            const rag = new AgenticRAG();
            const cache = new RAGCache();
            
            // Passar tabelas e layout extraídos (PDF ou Word)
            const doc = processedDocuments.get(documentFileName);
            if (doc?.tables) {
              rag.setExtractedTables(doc.tables);
              console.log(`📊 Passing ${doc.tables.length} tables to RAG`);
            }
            if (doc?.layout) {
              rag.setExtractedLayout(doc.layout);
              console.log(`📐 Passing ${doc.layout.length} layout elements to RAG`);
            }
            
            // Gerar hash do documento para cache
            const documentHash = cache.generateHash(documentContent);
            
            // Iniciar RAG com total de páginas
            startRAG(documentPageCount);
            
            // FASE 1: Chunking (instantâneo)
            setProcessingStatus('📚 Dividindo documento em chunks...');
            startChunking();
            const chunks = rag.createChunks(documentContent, documentPageCount);
            updateChunking(chunks.length, chunks.length);
            console.log(`📊 [FASE 1] Chunks criados: ${chunks.length}`);
            
            // FASE 2: Análise de chunks (paralelo)
            setProcessingStatus(`🔍 Analisando ${chunks.length} chunks (2 paralelos)...`);
            startAnalysis(chunks.length);
            const analyses = await rag.analyzeChunks(
              chunks,
              documentPageCount,
              (progress) => {
                updateAnalysis(progress.current, progress.total);
                setProcessingStatus(`🔍 ${progress.status}`);
              },
              documentHash
            );
            console.log(`📊 [FASE 2] Análises concluídas: ${analyses.length}`);
            
            // Verificar cancelamento
            if (isRAGCancelled) {
              console.log('🛑 RAG cancelado pelo usuário');
              return;
            }
            
            // FASE 3: Síntese de seções
            setProcessingStatus('🧩 Sintetizando seções...');
            startSynthesis();
            const sections = await rag.synthesizeSections(
              analyses,
              (status) => {
                setProcessingStatus(`🧩 ${status}`);
                updateSynthesis(50, 100);
              }
            );
            console.log(`📊 [FASE 3] ${sections.length} seções sintetizadas com sucesso`);
            updateSynthesis(100, 100);
            
            // Verificar cancelamento
            if (isRAGCancelled) {
              console.log('🛑 RAG cancelado pelo usuário');
              return;
            }
            
            // FASE 4: Filtragem
            setProcessingStatus("🔍 Filtrando seções relevantes...");
            startFiltering();
            updateFiltering(50, 'Filtrando conteúdo mais relevante...');
            updateFiltering(100, 'Filtragem concluída');
            
            // Verificar cancelamento
            if (isRAGCancelled) {
              console.log('🛑 RAG cancelado pelo usuário');
              return;
            }
            
            // FASE 5: Consolidação final com streaming
            setProcessingStatus('🎯 Gerando resposta final...');
            startConsolidation();
            console.log(`🎯 [FASE 5] Iniciando consolidação final...`);
            
            const newMessage: Message = {
              id: (Date.now() + 1).toString(),
              content: '',
              sender: "bot",
              timestamp: new Date(),
              model: selectedModel,
              isStreaming: true,
            };
            
            startTransition(() => {
              setMessages((prev) => [...prev, newMessage]);
              setIsStreamingResponse(true);
              setIsLoading(false);
            });
            
            let fullContent = '';
            
            // USAR APENAS A PERGUNTA DO USUÁRIO, NÃO O DOCUMENTO COMPLETO
            for await (const chunk of rag.consolidateAndStream(
              sections,
              currentInput, // ✅ CORRIGIDO: usar pergunta original, não messageWithFiles
              documentFileName,
              documentPageCount
            )) {
              fullContent += chunk;
              
              startTransition(() => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === newMessage.id
                      ? { ...msg, content: fullContent }
                      : msg
                  )
                );
              });
            }
            
            // Finalizar streaming
            startTransition(() => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === newMessage.id
                    ? { ...msg, isStreaming: false }
                    : msg
                )
              );
              setIsStreamingResponse(false);
            });
            
            // Completar RAG
            updateConsolidation(100, 'Resposta gerada com sucesso');
            completeRAG();
            setProcessingStatus('');
            console.log('✅ Processamento Agentic RAG concluído');
            
          } catch (error: any) {
            console.error('❌ Erro no Agentic RAG:', error);
            
            // Mensagem amigável baseada no tipo de erro
            let errorTitle = "Erro no processamento";
            let errorMessage = "Não foi possível processar o documento. Por favor, tente novamente.";
            
            if (error.message.includes('too large') || error.message.includes('Input muito grande')) {
              errorTitle = "Documento muito complexo";
              errorMessage = "⚠️ O documento é muito grande para processar. Tente dividir em arquivos menores ou remover conteúdo desnecessário.";
            } else if (error.message.includes('rate limit') || error.message.includes('429')) {
              errorTitle = "Limite de requisições atingido";
              errorMessage = "⏳ Muitas requisições simultâneas. Aguarde alguns segundos e tente novamente.";
            } else if (error.message.includes('ERRO CRÍTICO')) {
              errorTitle = "Erro na consolidação";
              errorMessage = "❌ Sistema não conseguiu reduzir o documento suficientemente. Tente um documento menor.";
            }
            
            toast({
              title: errorTitle,
              description: errorMessage,
              variant: "destructive",
            });
            
            setProcessingStatus('');
            resetProgress();
            setIsLoading(false);
            setIsStreamingResponse(false);
          }
          
          return; // Não continuar com processamento normal
        }
        
        // ========== MODO REASONING (OpenAI) ==========
        if (reasoningEnabled && isReasoningCapable) {
          console.log('🧠 Reasoning mode activated for model:', selectedModel);
          setIsDeepSeekThinking(true);
          setThinkingContent('');
          
          const REASONING_URL = `https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/openai-reasoning`;
          const { data: sessionData } = await supabase.auth.getSession();
          
          try {
            const response = await fetch(REASONING_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sessionData.session?.access_token || ""}`,
                "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE",
              },
              body: JSON.stringify({
                message: messageWithFiles,
                model: selectedModel,
                reasoningEffort: 'medium',
              }),
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');
            
            const decoder = new TextDecoder();
            let buffer = '';
            let fullReasoning = '';
            let fullContent = '';
            
            const botMessageId = (Date.now() + 1).toString();
            const newBotMessage: Message = {
              id: botMessageId,
              content: '',
              sender: 'bot',
              timestamp: new Date(),
              model: selectedModel,
              reasoning: '',
              isStreaming: true,
            };
            
            setMessages((prev) => [...prev, newBotMessage]);
            setIsStreamingResponse(true);
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                
                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.type === 'reasoning') {
                    fullReasoning += parsed.reasoning || '';
                    setThinkingContent(fullReasoning);
                  }
                  
                  if (parsed.type === 'reasoning_final') {
                    fullReasoning = parsed.reasoning || fullReasoning;
                    setThinkingContent(fullReasoning);
                  }
                  
                  if (parsed.type === 'content') {
                    fullContent += parsed.content || '';
                    startTransition(() => {
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === botMessageId
                            ? { ...msg, content: fullContent, reasoning: fullReasoning }
                            : msg
                        )
                      );
                    });
                  }
                } catch (e) {
                  // Ignore JSON parse errors
                }
              }
            }
            
            // Finalizar
            setIsDeepSeekThinking(false);
            setIsStreamingResponse(false);
            startTransition(() => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, content: fullContent, reasoning: fullReasoning, isStreaming: false }
                    : msg
                )
              );
            });
            
            // Salvar conversa
            if (user?.id) {
              const finalMessages = messages.filter((m) => m.id !== botMessageId);
              const finalBotMessage: Message = {
                id: botMessageId,
                content: fullContent,
                sender: 'bot',
                timestamp: new Date(),
                model: selectedModel,
                reasoning: fullReasoning,
              };
              await upsertConversation([...finalMessages, userMessage, finalBotMessage], currentConversationId);
            }
            
            // Consumir tokens
            const estimatedTokens = Math.ceil((messageWithFiles.length + fullContent.length + fullReasoning.length) / 4);
            consumeTokens(estimatedTokens.toString(), selectedModel);
            
            setIsLoading(false);
            return;
            
          } catch (error: any) {
            console.error('🧠 Reasoning error:', error);
            setIsDeepSeekThinking(false);
            setIsStreamingResponse(false);
            toast({
              title: "Erro no Reasoning",
              description: error.message || "Não foi possível processar o raciocínio.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        }
        
        // PROCESSAMENTO NORMAL (OUTROS MODELOS)
        const conversationHistory = messages.slice(-20).map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.content,
          files: msg.files || [],
          timestamp: msg.timestamp.toISOString(),
        }));

        const CHAT_URL = `https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/${functionName}`;
        const { data: sessionData } = await supabase.auth.getSession();
        
        const requestBody = {
          message: messageWithFiles,
          model: internalModel,
          files: fileData.length > 0 ? fileData : undefined,
          conversationHistory,
          contextEnabled: true,
          hasLargeDocument: false,
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 600000); // 10 minutos

        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionData.session?.access_token || ""}`,
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });

        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}));
          
          if (errorData.error?.code === 'insufficient_quota') {
            toast({
              title: "❌ Créditos insuficientes",
              description: "A API OpenAI está sem créditos. Recarregue sua conta OpenAI.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "⏳ Limite de requisições atingido",
              description: "Aguarde 1-2 minutos antes de tentar novamente. A OpenAI limita requisições por minuto.",
              variant: "destructive",
            });
          }
          setIsLoading(false);
          setProcessingStatus("");
          return;
        }

        if (response.status === 402) {
          toast({
            title: "💳 Créditos insuficientes",
            description: "Adicione fundos em Settings → Workspace.",
            variant: "destructive",
          });
          setIsLoading(false);
          setProcessingStatus("");
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        // Verificar se é JSON (não-streaming) ou SSE (streaming)
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");

        let accumulatedContent = "";
        const botMessageId = (Date.now() + 1).toString();

        if (isJson) {
          // Resposta JSON simples (gemini-chat, deepseek-chat, etc.)
          console.log("📦 Processing JSON response (non-streaming)");
          const responseText = await response.text();
          const jsonData = JSON.parse(responseText);
          accumulatedContent = jsonData.response || jsonData.message || jsonData.text || "";
          console.log("JSON response content length:", accumulatedContent.length);
          
          // Criar e adicionar mensagem do bot imediatamente
          const botMessage: Message = {
            id: botMessageId,
            content: accumulatedContent,
            sender: "bot",
            timestamp: new Date(),
            model: selectedModel,
          };
          
          setMessages((prev) => [...prev, botMessage]);
          setIsLoading(false);
          
        } else if (response.body) {
          // Processar SSE stream token-por-token
          console.log("🌊 Processing SSE stream");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let textBuffer = "";
          let streamDone = false;
        
          const placeholderBotMessage: Message = {
            id: botMessageId,
            content: "",
            sender: "bot",
            timestamp: new Date(),
            model: selectedModel,
            isStreaming: true,
          };

          // Adicionar mensagem do bot vazia
          startTransition(() => {
            setMessages((prev) => [...prev, placeholderBotMessage]);
            setIsStreamingResponse(true);
            setIsLoading(false);
          });

          // Auto-scroll inicial
          requestAnimationFrame(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
          });

          // Processar stream linha por linha
          while (!streamDone) {
            const { done, value } = await reader.read();
            if (done) break;
            
            textBuffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
              let line = textBuffer.slice(0, newlineIndex);
              textBuffer = textBuffer.slice(newlineIndex + 1);

              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (line.startsWith(":") || line.trim() === "") continue;
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                streamDone = true;
                break;
              }

              try {
                const parsed = JSON.parse(jsonStr);
                
                // Verificar se é evento de progresso
                if (parsed.status) {
                  console.log('📊 Progress:', parsed.status);
                  setProcessingStatus(parsed.status);
                  continue;
                }
                
                // 🧠 DeepSeek Reasoner format - reasoning em tempo real
                if (parsed.type === 'reasoning' && parsed.reasoning) {
                  // Mostrar indicador de thinking
                  setIsDeepSeekThinking(true);
                  setThinkingContent(prev => prev + parsed.reasoning);
                  console.log('🧠 Reasoning chunk:', parsed.reasoning.length, 'chars');
                  continue;
                }
                
                // 📝 DeepSeek Reasoner format - content em tempo real  
                if (parsed.type === 'content' && parsed.content) {
                  accumulatedContent += parsed.content;
                  
                  // Limpar thinking indicator quando content começa
                  if (isDeepSeekThinking) {
                    setIsDeepSeekThinking(false);
                  }
                  
                  // Atualizar mensagem do bot em tempo real
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                  continue;
                }
                
                // OpenAI/Gemini format
                const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                
                if (content) {
                  accumulatedContent += content;
                  
                  // Limpar status de processamento quando conteúdo começar a chegar
                  if (processingStatus) {
                    setProcessingStatus("");
                  }
                  
                  // Atualizar mensagem do bot em tempo real
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );

                  // Auto-scroll durante streaming (throttled)
                  if (isNearBottom) {
                    requestAnimationFrame(() => {
                      if (messagesEndRef.current) {
                        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
                      }
                    });
                  }
                }
              } catch (e) {
                // JSON incompleto - recolocar no buffer
                textBuffer = line + "\n" + textBuffer;
                break;
              }
            }
          }

          // Flush final do buffer
          if (textBuffer.trim()) {
            for (let raw of textBuffer.split("\n")) {
              if (!raw || raw.startsWith(":") || !raw.startsWith("data: ")) continue;
              const jsonStr = raw.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) accumulatedContent += content;
              } catch { /* ignore */ }
            }
          }
        }

        // Preparar mensagens finais
        let finalMessages: Message[];
        
        // Finalizar stream APENAS para SSE (não para JSON que já foi processado)
        if (!isJson && accumulatedContent) {
          const fullBotText = accumulatedContent || "Desculpe, não consegui processar sua mensagem.";
          const reasoning = "";

          // Finalizar stream
          const finalBotMessage: Message = {
            id: botMessageId,
            content: fullBotText,
            sender: "bot",
            timestamp: new Date(),
            model: selectedModel,
            reasoning: reasoning || undefined,
            isStreaming: false,
          };
          
          finalMessages = [...newMessages, finalBotMessage];

          startTransition(() => {
            setMessages(finalMessages);
            setIsStreamingResponse(false);
            setProcessingStatus("");
            setIsDeepSeekThinking(false);
            setThinkingContent("");
          });

          // Scroll final
          requestAnimationFrame(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
          });
        } else {
          // Para JSON, usar as mensagens atuais
          finalMessages = messages;
        }

        // Scroll final para JSON também
        if (isJson) {
          requestAnimationFrame(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
          });
        }

        // Salvar conversa
        await upsertConversation(finalMessages, convId);
      } catch (error: any) {
        console.error("Error sending message:", error);
        
        // Detectar tipo de erro
        let errorTitle = "Erro";
        let errorDescription = "Não foi possível enviar a mensagem.";
        
        if (error.name === "AbortError" || error.message?.includes("aborted")) {
          errorTitle = "⏱️ Tempo esgotado";
          errorDescription = "O processamento demorou mais de 10 minutos. Para documentos muito grandes, tente resumir ou dividir em partes menores.";
        } else if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
          errorTitle = "🔌 Erro de conexão";
          errorDescription = "A conexão foi interrompida. Isso pode acontecer com documentos muito grandes. Tente com um documento menor ou divida em partes.";
        } else if (error.message?.includes("429")) {
          errorTitle = "⏳ Muitas requisições";
          errorDescription = "Aguarde alguns minutos antes de tentar novamente.";
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
        setMessages(newMessages);
        setIsLoading(false);
        setIsStreamingResponse(false);
        setProcessingStatus("");
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
      processedPython,
      processedExcel,
      processedDocuments,
      comparativeAnalysisEnabled,
      messages,
      currentConversationId,
      user,
      generateComparativePrompt,
      selectedModel,
      isNearBottom,
      toast,
      upsertConversation,
    ],
  );

  const handleStopGeneration = useCallback(() => {
    if (streamingRafRef.current) {
      cancelAnimationFrame(streamingRafRef.current);
      streamingRafRef.current = null;
    }
    setIsLoading(false);
    setIsStreamingResponse(false);
    setProcessingStatus("");
    setMessages((prev) => prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg)));
  }, []);

  // Uploads / DnD
  const processFilesInParallel = useCallback(
    async (files: File[]) => {
      const newPreviewUrls = new Map(filePreviewUrls);

      const processingPromises = files.map(async (file) => {
        const fileName = file.name;
        setFileProcessingStatus((prev) => new Map(prev.set(fileName, "processing")));
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
                  }),
                ),
            );
            setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed")));
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
                    }),
                  ),
              );
              setProcessedPdfs((prev) => new Map(prev).set(fileName, result.content || ""));
              setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed")));
              return { fileName, success: true };
            } else {
              throw new Error(result.error || "Erro ao processar PDF");
            }
          } else if (isWordFile(file)) {
            // Para arquivos grandes (> 1MB), oferecer escolha entre métodos
            const shouldAskVisionAPI = file.size > 1024 * 1024;
            
            if (shouldAskVisionAPI) {
              // Mostrar dialog e pausar processamento
              setWordVisionDialog({ show: true, file });
              setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed"))); // Marcar como "aguardando escolha"
              return { fileName, success: true, needsUserChoice: true };
            }
            
            // Arquivos menores: processar automaticamente com HTML parsing
            const result = await WordProcessor.processWord(file);
            if (result.success && result.content) {
              setProcessedDocuments(
                (prev) =>
                  new Map(
                    prev.set(fileName, {
                      content: result.content!,
                      type: "word",
                      fileSize: file.size,
                      pages: result.pageCount,
                      layout: result.layout,
                      tables: result.tables,
                    }),
                  ),
              );
              setProcessedWords((prev) => new Map(prev).set(fileName, result.content || ""));
              setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed")));
              return { fileName, success: true };
            } else {
              throw new Error(result.error || "Erro ao processar Word");
            }
          } else if (isPythonFile(file)) {
            // Processar arquivo Python
            const base64Data = await fileToBase64(file);
            const { data, error } = await supabase.functions.invoke("process-files", {
              body: {
                file: base64Data,
                fileName: file.name,
                fileType: file.type,
              },
            });

            if (error) {
              throw new Error(error.message || "Erro ao processar arquivo Python");
            }

            if (data?.success && data?.content) {
              setProcessedDocuments(
                (prev) =>
                  new Map(
                    prev.set(fileName, {
                      content: data.content,
                      type: "python",
                      fileSize: file.size,
                    }),
                  ),
              );
              setProcessedPython((prev) => new Map(prev).set(fileName, data.content || ""));
              setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed")));
              return { fileName, success: true };
            } else {
              throw new Error("Erro ao processar arquivo Python");
            }
          } else if (isExcelFile(file)) {
            // Processar arquivo Excel localmente
            const arrayBuffer = await file.arrayBuffer();
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            // Processar todas as planilhas
            const sheets: any[] = [];
            workbook.SheetNames.forEach((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

              sheets.push({
                name: sheetName,
                data: jsonData,
              });
            });

            // Formatar o conteúdo para texto legível
            let textContent = `Arquivo Excel: ${file.name}\n\n`;
            sheets.forEach((sheet) => {
              textContent += `=== Planilha: ${sheet.name} ===\n\n`;

              if (sheet.data.length > 0) {
                // Pegar headers (primeira linha)
                const headers = sheet.data[0] as any[];
                textContent += headers.join(" | ") + "\n";
                textContent += "-".repeat(headers.join(" | ").length) + "\n";

                // Adicionar as linhas de dados
                for (let i = 1; i < Math.min(sheet.data.length, 101); i++) {
                  const row = sheet.data[i] as any[];
                  textContent += row.join(" | ") + "\n";
                }

                if (sheet.data.length > 101) {
                  textContent += `\n... (${sheet.data.length - 101} linhas adicionais omitidas)\n`;
                }
              } else {
                textContent += "(Planilha vazia)\n";
              }

              textContent += "\n\n";
            });

            setProcessedDocuments(
              (prev) =>
                new Map(
                  prev.set(fileName, {
                    content: textContent,
                    type: "excel",
                    fileSize: file.size,
                    sheets: sheets.map((s) => ({
                      name: s.name,
                      rowCount: s.data.length,
                    })),
                  }),
                ),
            );
            setProcessedExcel((prev) => new Map(prev).set(fileName, textContent));
            setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed")));
            return { fileName, success: true };
          }
          return {
            fileName,
            success: false,
            error: "Tipo de arquivo não suportado" as const,
          };
        } catch (error: any) {
          console.error(`Erro ao processar ${fileName}:`, error);
          setFileProcessingStatus((prev) => new Map(prev.set(fileName, "error")));
          return { fileName, success: false, error: error.message };
        }
      });

      setFilePreviewUrls(newPreviewUrls);
      const results = await Promise.all(processingPromises);
      const failed = results.filter((r) => !r.success).length;
      if (failed > 0) {
        toast({
          title: `Erro ao processar ${failed} arquivo(s)`,
          description: "Alguns arquivos não puderam ser processados. Verifique o formato e tente novamente.",
          variant: "destructive",
        });
      }
    },
    [filePreviewUrls, toast],
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
          file.type.startsWith("image/") ||
          isPdfFile(file) ||
          isWordFile(file) ||
          isPythonFile(file) ||
          isExcelFile(file);
        return isValidType && file.size <= 50 * 1024 * 1024;
      });

      if (validFiles.length === 0) {
        toast({
          title: "Nenhum arquivo válido",
          description:
            "Arraste apenas imagens, PDFs, documentos Word, arquivos Python (.py) ou Excel (.xlsx/.xls, máx. 50MB cada).",
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
    [attachedFiles.length, processFilesInParallel, toast],
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
          file.type.startsWith("image/") ||
          isPdfFile(file) ||
          isWordFile(file) ||
          isPythonFile(file) ||
          isExcelFile(file);
        return isValidType && file.size <= 50 * 1024 * 1024;
      });

      if (validFiles.length === 0) {
        toast({
          title: "Nenhum arquivo válido",
          description:
            "Arraste apenas imagens, PDFs, documentos Word, arquivos Python (.py) ou Excel (.xlsx/.xls, máx. 50MB cada).",
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
    [attachedFiles.length, processFilesInParallel, toast],
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

          const { data, error } = await supabase.functions.invoke("voice-to-text", {
            body: { audio: base64Audio },
          });

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
    [toast],
  );

  // Comparação
  const compareWithModel = useCallback(
    async (messageId: string, modelToCompare: string, _originalUserMessage: string) => {
      try {
        setComparingModels((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), modelToCompare],
        }));

        const botMessageIndex = messages.findIndex((m) => m.id === messageId);
        const immediateUserMessage = botMessageIndex > 0 ? messages[botMessageIndex - 1] : null;

        if (!immediateUserMessage || immediateUserMessage.sender !== "user") {
          throw new Error("Mensagem do usuário não encontrada ou sequência inválida");
        }

        const messageToSend = immediateUserMessage.content;
        let filesToSend: any[] = [];

        if (immediateUserMessage.files && immediateUserMessage.files.length > 0) {
          filesToSend = immediateUserMessage.files.map((file) => {
            const fileData: any = {
              name: file.name,
              type: file.type,
              hasPdfContent: false,
              hasWordContent: false,
              hasPythonContent: false,
              hasExcelContent: false,
              pdfContent: "",
              wordContent: "",
              pythonContent: "",
              excelContent: "",
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
            if (
              file.type === "text/x-python" ||
              file.type === "application/x-python-code" ||
              file.name.toLowerCase().endsWith(".py")
            ) {
              const pythonContent = processedPython.get(file.name);
              if (pythonContent) {
                fileData.hasPythonContent = true;
                fileData.pythonContent = pythonContent;
              }
            }
            if (
              file.type.includes("spreadsheet") ||
              file.type.includes("excel") ||
              file.name.toLowerCase().endsWith(".xlsx") ||
              file.name.toLowerCase().endsWith(".xls")
            ) {
              const excelContent = processedExcel.get(file.name);
              if (excelContent) {
                fileData.hasExcelContent = true;
                fileData.excelContent = excelContent;
              }
            }
            return fileData;
          });
        }

        const internalModel = modelToCompare === "synergy-ia" ? "gpt-4o-mini" : modelToCompare;
        const functionName = getEdgeFunctionName(internalModel);

        const { data: fnData, error: fnError } = await supabase.functions.invoke(functionName, {
          body: {
            message: messageToSend,
            model: internalModel,
            files: filesToSend,
            conversationHistory: messages.slice(-10).map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.content,
              files: m.files || [],
            })),
            contextEnabled: true,
            isComparison: true,
            comparisonContext: `Este é um pedido de comparação com o modelo ${modelToCompare}. A mesma pergunta foi feita anteriormente a outro modelo. Forneça uma resposta completa e detalhada, focando em análise profunda e insights únicos que você pode oferecer.`,
            hasLargeDocument: false,
          },
        });

        if (fnError) throw fnError;
        const data = fnData as any;
        const response =
          typeof data.response === "string" ? data.response : data.response?.content || "Erro ao processar mensagem.";

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
            newState[messageId] = newState[messageId].filter((m) => m !== modelToCompare);
            if (newState[messageId].length === 0) delete newState[messageId];
          }
          return newState;
        });
      }
    },
    [messages, processedPdfs, processedWords, processedPython, processedExcel, toast],
  );

  const toggleReasoning = useCallback((id: string) => {
    setExpandedReasoning((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  // Função para regenerar resposta
  const regenerateResponse = useCallback(
    async (messageId: string, originalUserContent: string) => {
      // Remove a mensagem do bot que será regenerada
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      
      // Simula o envio da mensagem original novamente
      setInputValue(originalUserContent);
      
      // Aguarda um tick para o estado atualizar e então submete
      setTimeout(() => {
        const form = document.querySelector('form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, 100);
    },
    [],
  );

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
              <ModelSelectorLazy onModelSelect={handleModelChange} selectedModel={selectedModel} />
            </Suspense>
            <Suspense fallback={<div className="h-6 w-6 bg-muted rounded-full" />}>
              <UserProfileLazy />
            </Suspense>
            <div className="flex-shrink-0">
              <Suspense fallback={<div className="h-6 w-10 bg-muted rounded" />}>
                <ThemeToggleLazy />
              </Suspense>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-1">
            <div className="flex-shrink-0">
              <Suspense fallback={<div className="h-6 w-10 bg-muted rounded" />}>
                <ThemeToggleLazy />
              </Suspense>
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
                  <Suspense fallback={<div className="h-10 w-full bg-muted rounded" />}>
                    <UserProfileLazy />
                  </Suspense>
                  <Suspense fallback={<div className="h-10 w-full bg-muted rounded" />}>
                    <ModelSelectorLazy onModelSelect={handleModelChange} selectedModel={selectedModel} />
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
          <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <div
                  className="flex items-center justify-center h-full text-muted-foreground"
                  style={{ minHeight: "calc(100vh - 250px)" }}
                >
                  <div className="text-center px-4 max-w-2xl">
                    <h3 className="text-2xl font-bold mb-2 text-foreground">Olá, {profile.name}!</h3>
                    <p className="text-muted-foreground mb-6">Como posso ajudar você hoje?</p>
                    <p className="text-sm text-muted-foreground/70 mb-8">
                      Você tem {tokenBalance.toLocaleString()} tokens disponíveis
                    </p>
                    
                    {/* Sugestões de prompts iniciais */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                      {[
                        { icon: "✍️", text: "Escreva um artigo sobre IA" },
                        { icon: "💡", text: "Me dê ideias para um projeto" },
                        { icon: "📝", text: "Resuma um documento para mim" },
                        { icon: "🔍", text: "Explique um conceito técnico" },
                      ].map((suggestion, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          className="h-auto py-3 px-4 text-left justify-start gap-3 hover:bg-muted/80 transition-all duration-200 group"
                          onClick={() => setInputValue(suggestion.text)}
                        >
                          <span className="text-lg group-hover:scale-110 transition-transform">{suggestion.icon}</span>
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            {suggestion.text}
                          </span>
                        </Button>
                      ))}
                    </div>
                    
                    <p className="mt-8 text-xs text-muted-foreground/50">
                      Dica: Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> para enviar • 
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">Esc</kbd> para cancelar
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => {
                  const immediateUserMessage =
                    index > 0 ? (messages[index - 1].sender === "user" ? messages[index - 1] : null) : null;

                  return (
                    <div
                      key={message.id}
                      className={`w-full flex items-start sm:items-start gap-0 ${
                        message.sender === "user" ? "" : "gap-2 sm:gap-3"
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
                          scrollToBottom={scrollToBottom}
                          processingStatus={index === messages.length - 1 ? processingStatus : undefined}
                          onRegenerate={regenerateResponse}
                          toast={toast}
                        />
                      ) : (
                        <UserMessage message={message} onCopy={copyWithFormatting} renderFileIcon={renderFileIcon} />
                      )}
                    </div>
                  );
                })
              )}
              {isLoading && (
                <div className="flex gap-2 sm:gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
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
                        {attachedFiles.length} documentos serão comparados e analisados em conjunto
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      {attachedFiles.map((file, idx) => {
                        const status = fileProcessingStatus.get(file.name);
                        const isProcessing = status === "processing";
                        const isCompleted = status === "completed";
                        const hasError = status === "error";

                        return (
                          <div key={idx} className="relative group">
                            <div className={`relative ${isProcessing ? "opacity-60" : ""}`}>
                              {renderFileIcon(
                                file.name,
                                file.type,
                                file.type.startsWith("image/") ? filePreviewUrls.get(file.name) : undefined,
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
                                const newFiles = prev.filter((_, i) => i !== idx);
                                if (newFiles.length <= 1) setComparativeAnalysisEnabled(false);
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
                              {isProcessing ? "Processando..." : hasError ? "Erro no processamento" : ""}
                            </div>
                          )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Preview de tabelas extraídas de Word */}
                    {attachedFiles.map((file, idx) => {
                      if (!isWordFile(file)) return null;
                      const doc = processedDocuments.get(file.name);
                      if (!doc?.tables || doc.tables.length === 0) return null;
                      
                      return (
                        <WordTablesPreview 
                          key={`preview-${idx}`} 
                          tables={doc.tables} 
                          fileName={file.name} 
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* UI de Progresso do RAG */}
              {ragProgress && isRAGProcessing && (
                <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 w-[95%] sm:w-[90%] max-w-2xl z-50">
                  <RAGProgressIndicator
                    progress={ragProgress}
                    documentName={(() => {
                      const pdfFile = attachedFiles.find(f => isPdfFile(f));
                      if (pdfFile) return pdfFile.name;
                      const wordFile = attachedFiles.find(f => isWordFile(f));
                      if (wordFile) return wordFile.name;
                      return undefined;
                    })()}
                    totalPages={(() => {
                      const pdfFile = attachedFiles.find(f => isPdfFile(f));
                      if (pdfFile) {
                        const doc = processedDocuments.get(pdfFile.name);
                        return doc?.pages;
                      }
                      const wordFile = attachedFiles.find(f => isWordFile(f));
                      if (wordFile) {
                        const doc = processedDocuments.get(wordFile.name);
                        return doc?.pages;
                      }
                      return undefined;
                    })()}
                    onCancel={cancelRAG}
                  />
                </div>
              )}

              {/* DeepSeek Thinking Indicator - posicionado no topo */}
              {isDeepSeekThinking && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-[95%] sm:w-[90%] max-w-xl z-50">
                  <DeepSeekThinkingIndicator 
                    isVisible={isDeepSeekThinking} 
                    thinkingContent={thinkingContent} 
                  />
                </div>
              )}

              {/* Dialog para escolher método de processamento Word */}
              <Dialog open={wordVisionDialog.show} onOpenChange={(open) => {
                if (!open) {
                  setWordVisionDialog({ show: false, file: null });
                }
              }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Escolher Método de Processamento</DialogTitle>
                    <DialogDescription>
                      Escolha como processar o documento Word: <strong>{wordVisionDialog.file?.name}</strong>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">HTML Parsing (Recomendado)</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                        <li>⚡ Rápido (2-3 segundos)</li>
                        <li>💰 Gratuito</li>
                        <li>✅ Boa qualidade (80-90%)</li>
                        <li>📊 Detecta maioria das tabelas</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Vision API (Máxima Qualidade)</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                        <li>🐢 Lento (30-60 segundos)</li>
                        <li>💵 Pago (~$1.80 por documento)</li>
                        <li>⭐ Qualidade máxima (95-99%)</li>
                        <li>🎯 Detecta tabelas complexas e merged cells</li>
                      </ul>
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const file = wordVisionDialog.file;
                        setWordVisionDialog({ show: false, file: null });
                        
                        if (file) {
                          // Processar com HTML parsing (rápido)
                          await processFilesInParallel([file]);
                        }
                      }}
                      className="w-full sm:w-auto"
                    >
                      HTML Parsing (Rápido)
                    </Button>
                    <Button
                      onClick={async () => {
                        const file = wordVisionDialog.file;
                        setWordVisionDialog({ show: false, file: null });
                        
                        if (file) {
                          // Processar com Vision API
                          const { WordVisionProcessor } = await import('@/utils/WordVisionProcessor');
                          const fileName = file.name;
                          
                          setFileProcessingStatus((prev) => new Map(prev.set(fileName, "processing")));
                          
                          const result = await WordVisionProcessor.processWithVision(file, (current, total, status) => {
                            console.log(`[Vision] ${status} (${current}/${total})`);
                          });
                          
                          if (result.success && result.content) {
                            setProcessedDocuments(
                              (prev) =>
                                new Map(
                                  prev.set(fileName, {
                                    content: result.content!,
                                    type: "word",
                                    fileSize: file.size,
                                    pages: result.pageCount,
                                    layout: result.layout,
                                    tables: result.tables,
                                  }),
                                ),
                            );
                            setProcessedWords((prev) => new Map(prev).set(fileName, result.content || ""));
                            setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed")));
                            
                            if (!attachedFiles.some(f => f.name === fileName)) {
                              setAttachedFiles((prev) => [...prev, file]);
                            }
                            
                            toast({
                              title: "Sucesso!",
                              description: `${fileName} processado com Vision API (qualidade máxima)`,
                            });
                          } else {
                            // Fallback automático para HTML parsing
                            console.warn('⚠️ Vision API falhou, usando HTML parsing como fallback');
                            
                            const fallbackResult = await WordProcessor.processWord(file);
                            
                            if (fallbackResult.success && fallbackResult.content) {
                              setProcessedDocuments(
                                (prev) =>
                                  new Map(
                                    prev.set(fileName, {
                                      content: fallbackResult.content!,
                                      type: "word",
                                      fileSize: file.size,
                                      pages: fallbackResult.pageCount,
                                      layout: fallbackResult.layout,
                                      tables: fallbackResult.tables,
                                    }),
                                  ),
                              );
                              setProcessedWords((prev) => new Map(prev).set(fileName, fallbackResult.content || ""));
                              setFileProcessingStatus((prev) => new Map(prev.set(fileName, "completed")));
                              
                              if (!attachedFiles.some(f => f.name === fileName)) {
                                setAttachedFiles((prev) => [...prev, file]);
                              }
                              
                              toast({
                                title: "Processado com HTML parsing",
                                description: `Vision API indisponível. Usando HTML parsing (${fallbackResult.pageCount} páginas detectadas)`,
                              });
                            } else {
                              setFileProcessingStatus((prev) => new Map(prev.set(fileName, "error")));
                              toast({
                                title: "Erro no processamento",
                                description: "Ambos os métodos falharam. Tente converter para PDF primeiro.",
                                variant: "destructive",
                              });
                            }
                          }
                        }
                      }}
                      className="w-full sm:w-auto"
                    >
                      Vision API (Qualidade Máxima)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
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
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="start" className="mb-2">
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                          <Paperclip className="h-4 w-4 mr-2" />
                          Anexar (.pdf, .doc/.docx, imagens)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={captureScreenshot} className="cursor-pointer">
                          <Camera className="h-4 w-4 mr-2" />
                          Capturar Screenshot
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsWebSearchMode((p) => !p)} className="cursor-pointer">
                          <Globe className="h-4 w-4 mr-2" />
                          {isWebSearchMode ? "Desativar Busca Web" : "Busca Web"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            if (isReasoningCapable) {
                              setReasoningEnabled((p) => !p);
                            } else {
                              toast({
                                title: "Modelo não suportado",
                                description: "Reasoning está disponível apenas para GPT-5.1, GPT-5 Mini, GPT-5 Nano e o4-mini",
                                variant: "destructive"
                              });
                            }
                          }}
                          className={`cursor-pointer ${reasoningEnabled ? 'bg-violet-500/20 text-violet-400' : ''} ${!isReasoningCapable ? 'opacity-50' : ''}`}
                        >
                          <Brain className={`h-4 w-4 mr-2 ${reasoningEnabled ? 'text-violet-400' : ''}`} />
                          {reasoningEnabled ? "✓ Reasoning Ativo" : "Reasoning (GPT)"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Reasoning Badge - mostrado quando ativo */}
                  {reasoningEnabled && isReasoningCapable && (
                    <div className="absolute left-12 sm:left-14 top-2.5 z-10">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/20 border border-violet-500/50 text-violet-400 text-xs font-medium">
                        <Brain className="h-3 w-3" />
                        <span className="hidden sm:inline">Reasoning</span>
                      </div>
                    </div>
                  )}

                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputValue(val);
                      const target = e.target as HTMLTextAreaElement;
                      requestAnimationFrame(() => {
                        target.style.height = "auto";
                        target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
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
                    className={`w-full py-3 rounded-lg resize-none min-h-[52px] max-h-[128px] transition-colors ${
                      reasoningEnabled && isReasoningCapable ? 'pl-24 sm:pl-32 md:pl-36' : 'pl-12 md:pl-14'
                    } pr-16 md:pr-24 ${isDragOver ? "bg-accent border-primary border-dashed" : ""}`}
                    rows={1}
                    onKeyDown={(e) => {
                      // Escape para cancelar geração
                      if (e.key === "Escape" && isLoading) {
                        e.preventDefault();
                        handleStopGeneration();
                        return;
                      }
                      // Enter para enviar (desktop)
                      if (e.key === "Enter" && !isMobile && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                        if (textareaRef.current) textareaRef.current.style.height = "52px";
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
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`h-8 w-8 ${isRecording ? "text-red-500" : ""}`}
                          >
                            <Mic className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isRecording ? "Parar gravação" : "Gravar áudio"}</TooltipContent>
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
                        disabled={!inputValue.trim() && attachedFiles.length === 0}
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
