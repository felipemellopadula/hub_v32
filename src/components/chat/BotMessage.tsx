import React, { useState, useEffect } from "react";
import { Copy, Check, Share, RefreshCw, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MarkdownRendererLazy from "@/components/CleanMarkdownRenderer";
import { Message } from "./types";

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
  }) => {
    const hasAttachments = immediateUserMessage?.files && immediateUserMessage.files.length > 0;

    // Hook para animação de digitação
    const [displayedContent, setDisplayedContent] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);

    useEffect(() => {
      setDisplayedContent(message.content);
      setIsTyping(!!message.isStreaming);
    }, [message.content, message.isStreaming]);

    const handleRegenerate = async () => {
      if (!immediateUserMessage || isRegenerating) return;
      setIsRegenerating(true);
      try {
        await onRegenerate(message.id, immediateUserMessage.content);
      } finally {
        setIsRegenerating(false);
      }
    };

    // [FIX] Não renderiza a bolha se não houver conteúdo ainda
    const hasText = (displayedContent || "").trim().length > 0;
    if (!hasText) return null;

    return (
      <>
        <Avatar className="h-8 w-8 shrink-0 mr-0.5">
          <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
        </Avatar>
        {/* Bolha ocupa toda a largura disponível no mobile */}
        <div className="flex-1 min-w-0">
          <div className="inline-block w-full sm:w-auto sm:max-w-[85%] rounded-lg px-4 py-3 bg-muted">
            {/* Status de processamento Map-Reduce */}
            {processingStatus && (
              <div className="mb-3 flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{processingStatus}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Resposta da IA */}
              <div className="text-sm max-w-full break-words whitespace-pre-wrap overflow-x-auto">
                <MarkdownRendererLazy content={displayedContent} isUser={false} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2 flex-wrap">
                <p className="text-xs opacity-70">{getModelDisplayName(message.model)}</p>

                <div className="flex items-center gap-1">
                  {/* Botão de raciocínio - abre modal */}
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

                  {/* Botão Regenerar Resposta */}
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

              {/* Modal de Raciocínio com botão copiar e contador */}
              {!!message.reasoning && expandedReasoning[message.id] && (
                <Dialog open={expandedReasoning[message.id]} onOpenChange={() => toggleReasoning(message.id)}>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        Raciocínio do Modelo
                      </DialogTitle>
                      <DialogDescription className="flex items-center justify-between">
                        <span>Processo de pensamento utilizado para gerar a resposta</span>
                        <span className="text-xs text-muted-foreground">
                          {message.reasoning.split(/\s+/).length} palavras
                        </span>
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 max-h-[60vh] pr-4">
                      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {message.reasoning}
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
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copiar raciocínio
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Comparação entre modelos — quando a mensagem anterior do usuário não tem anexos */}
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
            </div>
          </div>
        </div>
      </>
    );
  },
);

BotMessage.displayName = "BotMessage";
