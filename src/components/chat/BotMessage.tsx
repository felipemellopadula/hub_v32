import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Copy, Check, Share, RefreshCw, Brain, Loader2, Sparkles, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownRendererLazy from "@/components/CleanMarkdownRenderer";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "./types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Fallback suggestions when AI fails
const getFallbackSuggestions = (content: string): string[] => {
  const contentLower = content.toLowerCase();
  
  if (contentLower.includes("código") || contentLower.includes("function")) {
    return ["Explique linha por linha", "Como otimizar?", "Mostre alternativas"];
  }
  if (contentLower.includes("lista") || contentLower.includes("passos")) {
    return ["Detalhe o primeiro ponto", "Quais desafios comuns?", "Dê exemplos práticos"];
  }
  return ["Explique mais", "Dê um exemplo", "Resuma em tópicos"];
};

interface BotMessageProps {
  message: Message;
  getModelDisplayName: (model?: string) => string;
  expandedReasoning: { [key: string]: boolean };
  toggleReasoning: (id: string) => void;
  isCopied: boolean;
  onCopy: (markdownText: string, isUser: boolean, messageId: string) => void;
  onShare: (messageId: string, content: string) => void;
  sharedMessageId: string | null;
  comparingModels: { [messageId: string]: string[] };
  compareWithModel: (messageId: string, modelToCompare: string, originalUserMessage: string) => Promise<void>;
  immediateUserMessage: Message | null;
  scrollToBottom: () => void;
  processingStatus?: string;
  onRegenerate: (messageId: string, originalUserContent: string) => Promise<void>;
  toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  onFollowUpClick?: (suggestion: string) => void;
  isLastMessage?: boolean;
}

export const BotMessage: React.FC<BotMessageProps> = React.memo(
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
    scrollToBottom,
    processingStatus,
    onRegenerate,
    toast,
    onFollowUpClick,
    isLastMessage = false,
  }) => {
    const hasAttachments = immediateUserMessage?.files && immediateUserMessage.files.length > 0;

    const [displayedContent, setDisplayedContent] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    useEffect(() => {
      setDisplayedContent(message.content);
      setIsTyping(!!message.isStreaming);
    }, [message.content, message.isStreaming]);

    // Fetch AI-generated follow-up suggestions
    const fetchFollowUpSuggestions = useCallback(async () => {
      if (!isLastMessage || message.isStreaming || !displayedContent || displayedContent.length < 50) {
        setFollowUpSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const conversationContext = immediateUserMessage 
          ? [{ role: 'user', content: immediateUserMessage.content }, { role: 'assistant', content: displayedContent }]
          : [{ role: 'assistant', content: displayedContent }];

        const { data, error } = await supabase.functions.invoke('generate-followups', {
          body: { 
            messages: conversationContext,
            lastResponse: displayedContent 
          }
        });

        if (error) throw error;
        
        if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setFollowUpSuggestions(data.suggestions.slice(0, 3));
        } else {
          setFollowUpSuggestions(getFallbackSuggestions(displayedContent));
        }
      } catch (error) {
        console.error('Failed to fetch follow-up suggestions:', error);
        setFollowUpSuggestions(getFallbackSuggestions(displayedContent));
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, [isLastMessage, message.isStreaming, displayedContent, immediateUserMessage]);

    // Trigger AI suggestions when message is complete
    useEffect(() => {
      if (isLastMessage && !message.isStreaming && displayedContent) {
        const timer = setTimeout(() => {
          fetchFollowUpSuggestions();
        }, 500); // Small delay to ensure streaming is complete
        return () => clearTimeout(timer);
      }
    }, [isLastMessage, message.isStreaming, displayedContent, fetchFollowUpSuggestions]);

    const handleRegenerate = async () => {
      if (!immediateUserMessage || isRegenerating) return;
      setIsRegenerating(true);
      try {
        await onRegenerate(message.id, immediateUserMessage.content);
      } finally {
        setIsRegenerating(false);
      }
    };

    const hasText = (displayedContent || "").trim().length > 0;
    if (!hasText) return null;

    return (
      <>
        <Avatar className="h-8 w-8 shrink-0 mr-0.5">
          <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="inline-block w-full sm:w-auto sm:max-w-[85%] rounded-lg px-4 py-3 bg-muted">
            {processingStatus && (
              <div className="mb-3 flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{processingStatus}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-sm max-w-full break-words whitespace-pre-wrap overflow-x-auto">
                <MarkdownRendererLazy content={displayedContent} isUser={false} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2 flex-wrap">
                <p className="text-xs opacity-70">{getModelDisplayName(message.model)}</p>

                <div className="flex items-center gap-1">
                  {!!message.reasoning && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleReasoning(message.id)}
                            className="h-7 w-7 hover:bg-muted/80 hover:scale-105 transition-all duration-200"
                          >
                            <Brain className="h-3.5 w-3.5 text-purple-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver raciocínio</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onCopy(message.content, false, message.id)}
                          className="h-7 w-7 hover:bg-muted/80 hover:scale-105 transition-all duration-200"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar com formatação</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={sharedMessageId === message.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => onShare(message.id, message.content)}
                          className="flex items-center gap-2 text-xs h-8"
                        >
                          <Share className="h-3 w-3" />
                          {sharedMessageId === message.id ? "Link copiado!" : "Compartilhar"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar link de compartilhamento</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {immediateUserMessage && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRegenerate}
                            disabled={isRegenerating || message.isStreaming}
                            className="h-7 w-7 hover:bg-muted/80 hover:scale-105 transition-all duration-200"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Regenerar resposta</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>

              {/* Modal de Raciocínio com Markdown */}
              {!!message.reasoning && expandedReasoning[message.id] && (
                <Dialog open={expandedReasoning[message.id]} onOpenChange={() => toggleReasoning(message.id)}>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-scale-in">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          message.model?.includes('claude') ? "bg-amber-500/10" :
                          message.model?.includes('gemini') ? "bg-blue-500/10" :
                          message.model?.includes('deepseek') ? "bg-violet-500/10" :
                          message.model?.includes('gpt') || message.model?.includes('o4') ? "bg-emerald-500/10" :
                          "bg-primary/10"
                        )}>
                          {message.model?.includes('gemini') ? (
                            <Sparkles className={cn(
                              "h-5 w-5",
                              "text-blue-500"
                            )} />
                          ) : message.model?.includes('gpt') || message.model?.includes('o4') ? (
                            <Lightbulb className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Brain className={cn(
                              "h-5 w-5",
                              message.model?.includes('claude') ? "text-amber-500" :
                              message.model?.includes('deepseek') ? "text-violet-500" :
                              "text-primary"
                            )} />
                          )}
                        </div>
                        <span>
                          {message.model?.includes('claude') ? 'Claude Extended Thinking' :
                           message.model?.includes('gemini') ? 'Gemini Thinking' :
                           message.model?.includes('deepseek') ? 'DeepSeek Reasoning' :
                           message.model?.includes('gpt') || message.model?.includes('o4') ? 'OpenAI Reasoning' :
                           'Raciocínio do Modelo'}
                        </span>
                      </DialogTitle>
                      <DialogDescription className="flex items-center justify-between">
                        <span>Processo de pensamento utilizado para gerar a resposta</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          {message.reasoning.split(/\s+/).length} palavras
                        </span>
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 max-h-[60vh] pr-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none animate-fade-in">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="text-sm text-muted-foreground leading-relaxed mb-3 last:mb-0">
                                {children}
                              </p>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-lg font-bold mb-2 text-foreground">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-base font-semibold mb-2 text-foreground">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-semibold mb-1 text-foreground">{children}</h3>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-foreground">{children}</strong>
                            ),
                            em: ({ children }) => (
                              <em className="text-muted-foreground/80 italic">{children}</em>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 my-2 ml-2">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 my-2 ml-2">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-sm leading-relaxed">{children}</li>
                            ),
                            code: ({ className: codeClassName, children }) => {
                              const isInline = !codeClassName;
                              if (isInline) {
                                return (
                                  <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-muted text-foreground">
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <code className="block p-3 rounded-lg text-xs font-mono overflow-x-auto bg-muted">
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="rounded-lg overflow-x-auto my-3 bg-muted border border-border">
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-primary/50 pl-4 my-3 italic text-sm text-muted-foreground/80">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {message.reasoning}
                        </ReactMarkdown>
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end pt-3 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(message.reasoning || "");
                          toast({ title: "Copiado!", description: "Raciocínio copiado para a área de transferência." });
                        }}
                        className="flex items-center gap-2 hover:scale-105 transition-transform"
                      >
                        <Copy className="h-4 w-4" />
                        Copiar raciocínio
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Comparação entre modelos */}
              {!hasAttachments && immediateUserMessage?.sender === "user" && (
                <div className="flex items-center gap-1 pt-2 border-t border-border/30 flex-wrap">
                  {["gemini-2.5-flash", "claude-opus-4-1-20250805", "grok-4"].map((model) => {
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
                                  {model === "gemini-2.5-flash"
                                    ? "Gemini"
                                    : model === "claude-opus-4-1-20250805"
                                      ? "Claude"
                                      : "Grok"}
                                </div>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Comparar com {model}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              )}

              {/* Sugestões de Follow-up - apenas na última mensagem */}
              {isLastMessage && !message.isStreaming && onFollowUpClick && (
                <div className="pt-3 border-t border-border/30">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3 w-3 text-primary/70" />
                    <span className="text-xs text-muted-foreground">Continuar conversa:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isLoadingSuggestions ? (
                      <>
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-7 w-40" />
                        <Skeleton className="h-7 w-28" />
                      </>
                    ) : followUpSuggestions.length > 0 ? (
                      followUpSuggestions.map((suggestion, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => onFollowUpClick(suggestion)}
                          className="text-xs h-7 px-3 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all duration-200"
                        >
                          {suggestion}
                        </Button>
                      ))
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  },
);

BotMessage.displayName = "BotMessage";
