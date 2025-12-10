import { useState, useRef, useCallback, useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/components/chat/types";

// Helper to determine edge function based on model
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

export interface StreamingChatOptions {
  onTokenReceived?: (content: string, fullContent: string) => void;
  onStreamStart?: () => void;
  onStreamEnd?: (finalContent: string, reasoning?: string) => void;
  onError?: (error: Error) => void;
  onStatusUpdate?: (status: string) => void;
  onReasoningUpdate?: (reasoning: string) => void;
}

export interface SendMessageParams {
  message: string;
  model: string;
  files?: any[];
  conversationHistory?: any[];
  contextEnabled?: boolean;
}

export function useStreamingChat(options: StreamingChatOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [isDeepSeekThinking, setIsDeepSeekThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  
  const [, startTransition] = useTransition();
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingRafRef = useRef<number | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingRafRef.current) {
      cancelAnimationFrame(streamingRafRef.current);
      streamingRafRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
    setProcessingStatus("");
    setIsDeepSeekThinking(false);
    setThinkingContent("");
  }, []);

  const sendMessage = useCallback(
    async (params: SendMessageParams): Promise<{ content: string; reasoning?: string } | null> => {
      const { message, model, files, conversationHistory = [], contextEnabled = true } = params;

      // Cancel any previous streaming
      if (streamingRafRef.current) {
        cancelAnimationFrame(streamingRafRef.current);
        streamingRafRef.current = null;
      }

      const internalModel = model === "synergy-ia" ? "gpt-4o-mini" : model;
      const functionName = getEdgeFunctionName(internalModel);

      setIsLoading(true);
      setProcessingStatus("");
      setThinkingContent("");
      options.onStreamStart?.();

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const CHAT_URL = `https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/${functionName}`;

        const requestBody = {
          message,
          model: internalModel,
          files: files && files.length > 0 ? files : undefined,
          conversationHistory,
          contextEnabled,
          hasLargeDocument: false,
        };

        abortControllerRef.current = new AbortController();
        const timeoutId = setTimeout(() => {
          abortControllerRef.current?.abort();
        }, 600000); // 10 minutes

        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cWdubnFsdGVtZnB6ZHh3eWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODc3NjIsImV4cCI6MjA2OTQ2Mzc2Mn0.X0jHc8AkyZNZbi3kg5Qh6ngg7aAbijFXchM6bYsAnlE",
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });

        // Handle error responses
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error?.code === "insufficient_quota") {
            throw new Error("API credits insufficient. Please recharge your account.");
          } else {
            throw new Error("Rate limit exceeded. Please wait 1-2 minutes.");
          }
        }

        if (response.status === 402) {
          throw new Error("Insufficient credits. Add funds in Settings → Workspace.");
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        // Check response type
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");

        let accumulatedContent = "";
        let accumulatedReasoning = "";

        if (isJson) {
          // JSON response (non-streaming)
          const responseText = await response.text();
          const jsonData = JSON.parse(responseText);
          accumulatedContent = jsonData.response || jsonData.message || jsonData.text || "";
          
          setIsLoading(false);
          options.onStreamEnd?.(accumulatedContent);
          return { content: accumulatedContent };
        }

        // SSE streaming response
        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        startTransition(() => {
          setIsStreaming(true);
          setIsLoading(false);
        });

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

              // Handle progress events
              if (parsed.status) {
                setProcessingStatus(parsed.status);
                options.onStatusUpdate?.(parsed.status);
                continue;
              }

              // DeepSeek Reasoner format - reasoning in real-time
              if (parsed.type === "reasoning" && parsed.reasoning) {
                setIsDeepSeekThinking(true);
                accumulatedReasoning += parsed.reasoning;
                setThinkingContent(accumulatedReasoning);
                options.onReasoningUpdate?.(accumulatedReasoning);
                continue;
              }

              // DeepSeek Reasoner format - content in real-time
              if (parsed.type === "content" && parsed.content) {
                accumulatedContent += parsed.content;
                if (isDeepSeekThinking) {
                  setIsDeepSeekThinking(false);
                }
                options.onTokenReceived?.(parsed.content, accumulatedContent);
                continue;
              }

              // OpenAI/Gemini format
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;

              if (content) {
                accumulatedContent += content;

                if (processingStatus) {
                  setProcessingStatus("");
                }

                options.onTokenReceived?.(content, accumulatedContent);
              }
            } catch {
              // Incomplete JSON - put back in buffer
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remaining buffer
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw || raw.startsWith(":") || !raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                options.onTokenReceived?.(content, accumulatedContent);
              }
            } catch {
              /* ignore */
            }
          }
        }

        startTransition(() => {
          setIsStreaming(false);
          setProcessingStatus("");
          setIsDeepSeekThinking(false);
          setThinkingContent("");
        });

        options.onStreamEnd?.(accumulatedContent, accumulatedReasoning || undefined);
        return { content: accumulatedContent, reasoning: accumulatedReasoning || undefined };
      } catch (error: any) {
        console.error("Streaming error:", error);
        
        setIsLoading(false);
        setIsStreaming(false);
        setProcessingStatus("");
        setIsDeepSeekThinking(false);
        setThinkingContent("");

        options.onError?.(error);
        return null;
      }
    },
    [options, processingStatus, isDeepSeekThinking]
  );

  return {
    // States
    isLoading,
    isStreaming,
    processingStatus,
    isDeepSeekThinking,
    thinkingContent,
    
    // Actions
    sendMessage,
    stopGeneration,
    
    // Setters for external control
    setProcessingStatus,
    setIsLoading,
    setIsStreaming,
    setIsDeepSeekThinking,
    setThinkingContent,
  };
}
