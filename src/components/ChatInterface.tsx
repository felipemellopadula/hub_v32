import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSelector } from "./ModelSelector";
import { Send, Bot, User, Paperclip, Image, Camera, ArrowDown, Save, Brain } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PdfProcessor } from "@/utils/PdfProcessor";
import { WordProcessor } from "@/utils/WordProcessor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTokens } from '@/hooks/useTokens';
import { useConversationPersistence } from '@/hooks/useConversationPersistence';
import { PagePreview } from './PagePreview';
import CleanMarkdownRenderer from './CleanMarkdownRenderer';
import { DeepSeekThinkingIndicator } from './DeepSeekThinkingIndicator';
import { DeepSeekReasoningHistory } from './DeepSeekReasoningHistory';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  reasoning?: string;
  files?: Array<{
    name: string;
    type: string;
    url: string;
  }>;
}


interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatInterface = ({ isOpen, onClose }: ChatInterfaceProps) => {
  const { checkTokenBalance, consumeTokens } = useTokens();
  const { saveMessages, currentConversationId, isSaving } = useConversationPersistence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [filePages, setFilePages] = useState<number>(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isDeepSeekThinking, setIsDeepSeekThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Models that support OpenAI Reasoning (Responses API)
  const reasoningCapableModels = ['gpt-5.1', 'gpt-5-mini', 'gpt-5-nano', 'o4-mini'];
  const isReasoningCapable = selectedModel ? reasoningCapableModels.includes(selectedModel) : false;

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isCallingRef = useRef(false); // ✅ Proteção contra múltiplas chamadas simultâneas

  // Auto-save messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages, currentConversationId || undefined);
    }
  }, [messages, currentConversationId, saveMessages]);

  // Handle clipboard paste for images - enhanced version
  const handlePaste = async (event: ClipboardEvent) => {
    console.log('🖼️ PASTE EVENT TRIGGERED!');
    
    const items = Array.from(event.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length > 0) {
      console.log('✅ Image found! Processing...');
      event.preventDefault();
      
      if (attachedFiles.length + imageItems.length > 1) {
        toast.error('Máximo de 1 imagem por vez.');
        return;
      }

      setIsProcessingFile(true);
      
      try {
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `screenshot-${timestamp}.${file.type.split('/')[1]}`;
            
            // Create a new File object with the custom name
            const renamedFile = new File([file], fileName, { type: file.type });
            
            setAttachedFiles([renamedFile]);
            setFileName(fileName);
            console.log('🎉 Image pasted successfully:', fileName);
            toast.success(`📸 Imagem colada: ${fileName}`);
          }
        }
      } catch (error) {
        console.error('Error processing pasted image:', error);
        toast.error('Erro ao processar imagem colada.');
      } finally {
        setIsProcessingFile(false);
      }
    }
  };

  // Capture screenshot function
  const captureScreenshot = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast.error('Screenshot não é suportado neste navegador.');
        return;
      }

      setIsProcessingFile(true);
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const fileName = `screenshot-${timestamp}.png`;
              
              if (attachedFiles.length >= 1) {
                toast.error('Máximo de 1 arquivo por vez.');
                return;
              }
              
              // Create File from blob
              const file = new File([blob], fileName, { type: 'image/png' });
              
              setAttachedFiles([file]);
              setFileName(fileName);
              
              toast.success('📸 Screenshot capturado com sucesso!');
            }
          }, 'image/png');
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        setIsProcessingFile(false);
      };
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      toast.error('Erro ao capturar screenshot. Verifique as permissões.');
      setIsProcessingFile(false);
    }
  };

  // Check if user is at bottom of scroll
  const checkScrollPosition = () => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isAtBottom);
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'smooth' });
    }
  };

  // Add scroll listener
  useEffect(() => {
    if (!isOpen) return;
    
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScrollPosition);
      return () => scrollElement.removeEventListener('scroll', checkScrollPosition);
    }
  }, [isOpen, messages]);

  // Add global paste listener with immediate setup
  useEffect(() => {
    if (!isOpen) return;
    
    console.log('🔧 Setting up paste listener...');
    
    const pasteHandler = (e: ClipboardEvent) => {
      console.log('🎯 Global paste detected');
      handlePaste(e);
    };
    
    // Add multiple listeners to catch all cases
    document.addEventListener('paste', pasteHandler, true);
    window.addEventListener('paste', pasteHandler, true);
    
    // Focus the paste area to ensure it can receive events
    if (pasteAreaRef.current) {
      pasteAreaRef.current.focus();
      console.log('🎯 Paste area focused');
    }
    
    return () => {
      console.log('🧹 Cleaning up paste listeners');
      document.removeEventListener('paste', pasteHandler, true);
      window.removeEventListener('paste', pasteHandler, true);
    };
  }, [isOpen]);

  // Helper function to convert file to base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.type === 'application/msword';

    if (!isImage && !isPdf && !isWord) {
      toast.error('Apenas arquivos PDF, Word e imagens são suportados');
      return;
    }

    setIsProcessingFile(true);
    
    try {
      if (isImage) {
        // Para imagens, apenas armazenar o arquivo
        setAttachedFiles([file]);
        setFileName(file.name);
        toast.success(`Imagem anexada: ${file.name}`);
      } else if (isPdf) {
        const result = await PdfProcessor.processPdf(file);
        
        if (result.success && result.content) {
          console.log('PDF processado com sucesso:', {
            fileName: file.name,
            pageCount: result.pageCount,
            contentLength: result.content.length,
            contentPreview: result.content.substring(0, 200) + '...'
          });
          setFileContent(result.content);
          setFileName(file.name);
          setFilePages(result.pageCount || 0);
          toast.success(`PDF processado com sucesso! ${result.pageCount} páginas (${result.fileSize}MB)`);
        } else {
          let errorMessage = result.error || "Erro desconhecido";
          
          if (result.isPasswordProtected) {
            errorMessage = "PDF protegido por senha. Não é possível processar arquivos protegidos.";
          }

          toast.error(errorMessage);
          clearFileData();
        }
      } else if (isWord) {
        const result = await WordProcessor.processWord(file);
        
        if (result.success && result.content) {
          setFileContent(result.content);
          setFileName(file.name);
          toast.success(`Documento Word processado: ${file.name} (${result.wordCount} palavras)`);
        } else {
          toast.error(result.error || 'Erro ao processar documento Word');
          clearFileData();
        }
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro interno ao processar arquivo');
      clearFileData();
    } finally {
      setIsProcessingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearFileData = () => {
    setFileContent('');
    setFileName('');
    setFilePages(0);
    setAttachedFiles([]);
  };

  const handleSendMessage = async () => {
    // ✅ PROTEÇÃO: Prevenir múltiplas chamadas simultâneas (race condition fix)
    if (isCallingRef.current) {
      console.log('⚠️ handleSendMessage já está em execução, ignorando chamada duplicada');
      return;
    }
    
    isCallingRef.current = true;
    
    console.log('=== HANDLE SEND MESSAGE START ===');
    console.log('handleSendMessage called:', {
      inputValue: inputValue.trim(),
      fileContent: fileContent ? `${fileContent.length} chars` : 'none',
      attachedFiles: attachedFiles.length,
      fileName,
      filePages,
      selectedModel
    });
    
    if ((!inputValue.trim() && !fileContent && !attachedFiles.length) || !selectedModel) {
      console.log('Exiting early - missing input or model');
      isCallingRef.current = false; // ✅ Resetar flag antes de sair
      return;
    }

    // Check token balance first
    const hasTokens = await checkTokenBalance(selectedModel);
    if (!hasTokens) {
      isCallingRef.current = false; // ✅ Resetar flag antes de sair
      return;
    }

    // Check if we have images and should use image analysis
    const hasImages = attachedFiles.some(file => file.type.startsWith('image/'));
    
    let messageContent = inputValue;
    let displayMessage = inputValue || (hasImages ? `Análise da imagem: ${fileName}` : `Análise do arquivo: ${fileName}`);
    console.log('=== IMAGE ANALYSIS CHECK ===');
    console.log('hasImages:', hasImages);
    console.log('attachedFiles details:', attachedFiles.map(f => ({ name: f.name, type: f.type })));
    console.log('selectedModel:', selectedModel);
    console.log('hasImages:', hasImages);
    console.log('attachedFiles:', attachedFiles);
    console.log('selectedModel:', selectedModel);
    
    // Lista de modelos que suportam visão
    const visionModels = [
      'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', // OpenAI vision models
      'claude-opus-4-1-20250805', 'claude-sonnet-4-5', 'claude-haiku-4-5', // Anthropic
      'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', // Google
      'grok-4', 'grok-3', 'grok-3-mini' // xAI - todos suportam visão
    ];
    
    const isVisionModel = visionModels.includes(selectedModel);
    console.log('isVisionModel:', isVisionModel);
    console.log('Will use image analysis?', hasImages && isVisionModel);
    
    if (hasImages && isVisionModel) {
      // Use image analysis function for vision models
      console.log('Using image analysis function for vision model');
      const imageFile = attachedFiles.find(file => file.type.startsWith('image/'));
      if (imageFile) {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          content: displayMessage,
          sender: 'user',
          timestamp: new Date(),
          files: [{
            name: imageFile.name,
            type: imageFile.type,
            url: URL.createObjectURL(imageFile)
          }]
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsLoading(true);
        clearFileData();

        try {
          const base64 = await convertFileToBase64(imageFile);
          const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
          
          let aiProvider = 'openai';
          if (selectedModel === 'synergy-ia') aiProvider = 'openai'; // SynergyIA usa OpenAI
          else if (selectedModel.includes('claude')) aiProvider = 'claude';
          else if (selectedModel.includes('gemini')) aiProvider = 'gemini';
          else if (selectedModel.includes('grok')) aiProvider = 'grok';
          else if (selectedModel.includes('deepseek')) aiProvider = 'deepseek';
          
          console.log('=== CALLING IMAGE ANALYSIS ===');
          console.log('aiProvider:', aiProvider);
          console.log('base64Data length:', base64Data.length);
          console.log('prompt:', inputValue || 'Analise esta imagem e descreva o que você vê.');
          
          const response = await supabase.functions.invoke('image-analysis', {
            body: {
              imageBase64: base64Data,
              prompt: inputValue || 'Analise esta imagem e descreva o que você vê.',
              aiProvider,
              analysisType: 'general'
            },
          });

          console.log('Image analysis response:', response);
          
          if (response.error) {
            throw new Error(response.error.message || 'Erro na análise da imagem');
          }

          const aiMessage: Message = {
            id: crypto.randomUUID(),
            content: response.data.analysis,
            sender: 'bot',
            timestamp: new Date(),
            model: selectedModel,
          };

          setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
          console.error('=== IMAGE ANALYSIS ERROR ===');
          console.error('Error analyzing image:', error);
          console.error('Error details:', error.message, error.stack);
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            content: 'Desculpe, ocorreu um erro ao analisar a imagem. Verifique se as chaves API estão configuradas corretamente.',
            sender: 'bot',
            timestamp: new Date(),
            model: selectedModel,
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          isCallingRef.current = false; // ✅ Resetar flag antes do return
          setIsLoading(false);
          setIsDeepSeekThinking(false);
          setThinkingContent('');
        }
        return;
      }
    }

    // Se há arquivo de texto anexado, criar prompts otimizados
    if (fileContent && filePages) {
      console.log('Text file detected, creating optimized prompt');
      if (inputValue.toLowerCase().includes('resumo') || inputValue.toLowerCase().includes('resume') || !inputValue.trim()) {
        // Usar prompt de resumo automático
        messageContent = PdfProcessor.createSummaryPrompt(fileContent, filePages);
        displayMessage = `Resumo do arquivo: ${fileName}`;
      } else {
        // Usar prompt de análise detalhada
        messageContent = PdfProcessor.createAnalysisPrompt(fileContent, filePages, inputValue);
        displayMessage = `Análise sobre: ${inputValue}`;
      }
      console.log('Final messageContent length:', messageContent.length);
      console.log('Message preview:', messageContent.substring(0, 500) + '...');
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: displayMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    
    // Check if using DeepSeek model for thinking indicator
    const isDeepSeekModel = selectedModel.includes('deepseek');
    if (isDeepSeekModel) {
      setIsDeepSeekThinking(true);
      setThinkingContent('');
    }

    // Create a temporary message for streaming
    const botMessageId = crypto.randomUUID();
    const tempBotMessage: Message = {
      id: botMessageId,
      content: '',
      sender: 'bot',
      timestamp: new Date(),
      model: selectedModel,
    };
    
    setMessages(prev => [...prev, tempBotMessage]);

    try {
      // Check if OpenAI Reasoning mode is enabled for capable models
      const isOpenAIReasoningMode = reasoningEnabled && reasoningCapableModels.includes(selectedModel);
      
      // Determine which edge function to use based on the selected model
      const getEdgeFunctionName = (model: string) => {
        if (isOpenAIReasoningMode) {
          return 'openai-reasoning';
        }
        if (model.includes('gpt-') || model.includes('o3') || model.includes('o4')) {
          return 'openai-chat';
        }
        if (model.includes('gemini')) {
          return 'gemini-chat';
        }
        if (model.includes('claude')) {
          return 'anthropic-chat';
        }
        if (model.includes('deepseek')) {
          return 'deepseek-chat';
        }
        if (model.includes('grok')) {
          return 'grok-chat';
        }
        if (model.includes('llama')) {
          return 'apillm-chat';
        }
        return 'ai-chat';
      };

      const functionName = getEdgeFunctionName(selectedModel);
      console.log(`Using edge function: ${functionName} for model: ${selectedModel}`);
      console.log('Sending message to function:', {
        messageLength: messageContent.length,
        messagePreview: messageContent.substring(0, 300) + '...',
        isOpenAIReasoningMode,
      });

      // Check if this is a DeepSeek Reasoner model that supports streaming reasoning
      const isDeepSeekReasonerModel = selectedModel === 'deepseek-reasoner' || selectedModel === 'deepseek-reasoner-thinking-only';
      
      console.log('🧠 DeepSeek check:', {
        selectedModel,
        isDeepSeekReasonerModel,
        isDeepSeekModel,
      });
      
      // Prepare files for sending if we have PDF/Word content
      const requestBody: any = {
        message: messageContent,
        model: selectedModel,
        hasLargeDocument: filePages > 20,
        streamReasoning: isDeepSeekReasonerModel, // Enable streaming reasoning for reasoner models
      };
      
      console.log('📤 Request body streamReasoning:', requestBody.streamReasoning);

      // Add files if we processed any PDF/Word documents
      if (attachedFiles.length > 0 && (fileName?.endsWith('.pdf') || fileName?.endsWith('.docx') || fileName?.endsWith('.doc'))) {
        requestBody.files = attachedFiles.map(file => ({
          name: file.name,
          type: file.type,
          pdfContent: fileContent,
          wordContent: fileContent
        }));
      }

      console.log('Sending request to function:', {
        functionName,
        model: selectedModel,
        messageLength: messageContent.length,
        hasFiles: !!requestBody.files,
        filesCount: requestBody.files?.length || 0,
        streamReasoning: requestBody.streamReasoning,
        isDeepSeekReasonerModel
      });

      // For OpenAI Reasoning mode with SSE streaming
      if (isOpenAIReasoningMode) {
        console.log('🧠🧠🧠 OPENAI REASONING MODE - SSE STREAMING 🧠🧠🧠');
        setIsDeepSeekThinking(true);
        setThinkingContent('');
        
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        
        const supabaseUrl = 'https://myqgnnqltemfpzdxwybj.supabase.co';
        const fetchUrl = `${supabaseUrl}/functions/v1/openai-reasoning`;
        
        console.log('📡 Fetching OpenAI Reasoning SSE from:', fetchUrl);
        
        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: messageContent,
            model: selectedModel,
            reasoningEffort: 'medium',
          }),
        });

        console.log('📡 Response status:', response.status);
        const contentType = response.headers.get('content-type');
        console.log('📡 Content-Type:', contentType);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ OpenAI Reasoning Error:', errorText);
          throw new Error(`Erro na requisição: ${response.status}`);
        }

        if (contentType?.includes('text/event-stream') && response.body) {
          console.log('🔥 OpenAI Reasoning SSE STREAM DETECTADO');
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';
          let fullReasoning = '';
          let buffer = '';
          let eventCount = 0;
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('✅ OpenAI Reasoning Stream finalizado - Total eventos:', eventCount);
                break;
              }
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
                
                const data = trimmedLine.slice(6);
                if (data === '[DONE]') {
                  console.log('🏁 [DONE] signal');
                  continue;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  eventCount++;
                  
                  // 🧠 Reasoning em tempo real
                  if ((parsed.type === 'reasoning' || parsed.type === 'reasoning_final') && parsed.reasoning) {
                    if (parsed.type === 'reasoning_final') {
                      fullReasoning = parsed.reasoning;
                    } else {
                      fullReasoning += parsed.reasoning;
                    }
                    setThinkingContent(fullReasoning);
                    
                    if (eventCount <= 5 || eventCount % 25 === 0) {
                      console.log(`🧠 OpenAI Reasoning #${eventCount}: total ${fullReasoning.length} chars`);
                    }
                  }
                  
                  // 📝 Content em tempo real
                  if (parsed.type === 'content' && parsed.content) {
                    fullContent += parsed.content;
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === botMessageId 
                          ? { ...msg, content: fullContent }
                          : msg
                      )
                    );
                    
                    if (eventCount <= 5 || eventCount % 25 === 0) {
                      console.log(`📝 OpenAI Content #${eventCount}: total ${fullContent.length} chars`);
                    }
                  }
                } catch (e) {
                  // JSON incompleto
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
          
          console.log('📊 OpenAI Reasoning SSE completo:', { reasoning: fullReasoning.length, content: fullContent.length, events: eventCount });
          
          // Final update
          const finalContent = fullContent || 'Resposta vazia.';
          setMessages(prev => 
            prev.map(msg => 
              msg.id === botMessageId 
                ? { ...msg, content: finalContent, reasoning: fullReasoning || undefined }
                : msg
            )
          );
          
          setIsDeepSeekThinking(false);
          setThinkingContent('');
          await consumeTokens(selectedModel, messageContent, finalContent);
        } else {
          // JSON fallback
          console.log('📦 OpenAI Reasoning JSON fallback');
          const data = await response.json();
          
          const aiMessageContent = data.response || data.message || data.text || 'Resposta vazia.';
          const reasoningContent = data.reasoning || null;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === botMessageId 
                ? { ...msg, content: aiMessageContent, reasoning: reasoningContent }
                : msg
            )
          );
          
          setIsDeepSeekThinking(false);
          setThinkingContent('');
          await consumeTokens(selectedModel, messageContent, aiMessageContent);
        }
      } else if (isDeepSeekReasonerModel) {
        // For DeepSeek Reasoner with streaming, use fetch directly to handle SSE
        console.log('🧠🧠🧠 DEEPSEEK REASONER - SSE STREAMING v2 🧠🧠🧠');
        setIsDeepSeekThinking(true);
        setThinkingContent('');
        
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        
        // Use direct Supabase URL (not env var which may be undefined)
        const supabaseUrl = 'https://myqgnnqltemfpzdxwybj.supabase.co';
        const fetchUrl = `${supabaseUrl}/functions/v1/${functionName}`;
        
        console.log('📡 Fetching SSE from:', fetchUrl);
        
        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
        });

        console.log('📡 Response status:', response.status);
        const contentType = response.headers.get('content-type');
        console.log('📡 Content-Type:', contentType);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ SSE Error:', errorText);
          throw new Error(`Erro na requisição: ${response.status}`);
        }

        // 🔥 Check if it's SSE stream
        if (contentType?.includes('text/event-stream') && response.body) {
          console.log('🔥🔥🔥 SSE STREAM DETECTADO - PROCESSANDO REAL-TIME 🔥🔥🔥');
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';
          let fullReasoning = '';
          let buffer = '';
          let eventCount = 0;
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('✅ Stream finalizado - Total eventos:', eventCount);
                break;
              }
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
                
                const data = trimmedLine.slice(6);
                if (data === '[DONE]') {
                  console.log('🏁 [DONE] signal');
                  continue;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  eventCount++;
                  
                  // 🧠 Reasoning em tempo real
                  if (parsed.type === 'reasoning' && parsed.reasoning) {
                    fullReasoning += parsed.reasoning;
                    setThinkingContent(fullReasoning);
                    
                    if (eventCount <= 5 || eventCount % 25 === 0) {
                      console.log(`🧠 Reasoning #${eventCount}: total ${fullReasoning.length} chars`);
                    }
                  }
                  
                  // 📝 Content em tempo real
                  if (parsed.type === 'content' && parsed.content) {
                    fullContent += parsed.content;
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === botMessageId 
                          ? { ...msg, content: fullContent }
                          : msg
                      )
                    );
                    
                    if (eventCount <= 5 || eventCount % 25 === 0) {
                      console.log(`📝 Content #${eventCount}: total ${fullContent.length} chars`);
                    }
                  }
                } catch (e) {
                  // JSON incompleto
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
          console.log('📊 SSE completo:', { reasoning: fullReasoning.length, content: fullContent.length, events: eventCount });
          
          // Final update
          const finalContent = fullContent || (fullReasoning ? `🧠 **Raciocínio:**\n\n${fullReasoning}` : 'Resposta vazia.');
          setMessages(prev => 
            prev.map(msg => 
              msg.id === botMessageId 
                ? { ...msg, content: finalContent, reasoning: fullReasoning || undefined }
                : msg
            )
          );
          
          setIsDeepSeekThinking(false);
          setThinkingContent('');
          await consumeTokens(selectedModel, messageContent, finalContent);
        } else {
          // JSON fallback
          console.log('📦 JSON fallback (Content-Type:', contentType, ')');
          const data = await response.json();
          
          const aiMessageContent = data.response || data.message || data.text || 'Resposta vazia.';
          const reasoningContent = data.reasoning || null;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === botMessageId 
                ? { ...msg, content: aiMessageContent, reasoning: reasoningContent }
                : msg
            )
          );
          
          setIsDeepSeekThinking(false);
          setThinkingContent('');
          await consumeTokens(selectedModel, messageContent, aiMessageContent);
        }
      } else {
        // Non-reasoner models use normal invoke
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: requestBody
        });

        console.log('=== FUNCTION RESPONSE DEBUG ===');
        console.log('data:', data);
        console.log('error:', error);
        console.log('data type:', typeof data);
        console.log('data keys:', data ? Object.keys(data) : 'null');
        console.log('data.response exists?', data?.response ? 'YES' : 'NO');
        console.log('data.message exists?', data?.message ? 'YES' : 'NO');
        console.log('data.reasoning exists?', data?.reasoning ? 'YES' : 'NO');
        
        if (error) {
          console.error('Function error details:', error);
          throw new Error(error.message || 'Erro ao enviar mensagem');
        }

        if (!data) {
          console.error('No data received from function');
          throw new Error('Nenhuma resposta recebida da função');
        }

        const aiMessageContent = data.response || data.message || data.text || 'Resposta vazia recebida.';
        const reasoningContent = data.reasoning || null;
        
        console.log('=== AI MESSAGE CONTENT ===');
        console.log('aiMessageContent length:', aiMessageContent.length);
        console.log('aiMessageContent preview:', aiMessageContent.substring(0, 200));
        console.log('reasoningContent length:', reasoningContent?.length || 0);
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, content: aiMessageContent, reasoning: reasoningContent }
              : msg
          )
        );
        
        // Pass AI response to consumeTokens for database logging
        await consumeTokens(selectedModel, messageContent, aiMessageContent);
      }
      
      // Limpar dados do arquivo após o envio
      clearFileData();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('=== CHAT ERROR ===');
      console.error('Error sending message:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: `Desculpe, ocorreu um erro ao processar sua mensagem: ${error?.message || 'Erro desconhecido'}. Verifique se as chaves API estão configuradas corretamente.`,
        sender: 'bot',
        timestamp: new Date(),
        model: selectedModel,
      };
      
      // Remove the temporary message and add error message
      setMessages(prev => 
        prev.filter(msg => msg.id !== botMessageId).concat(errorMessage)
      );
    } finally {
      isCallingRef.current = false; // ✅ Sempre resetar flag, mesmo em caso de erro
      setIsLoading(false);
      setIsDeepSeekThinking(false);
      setThinkingContent('');
    }
  };

  if (!isOpen) return null;

  const hasAttachedFile = fileContent || attachedFiles.length > 0;

  return (
    <div 
      ref={chatContainerRef}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      <Card className="w-full max-w-4xl h-[80vh] bg-card border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Chat com IA</h2>
            {isSaving && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                <Save className="h-3 w-3" />
                Salvando...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector onModelSelect={setSelectedModel} selectedModel={selectedModel} />
            
            {/* Reasoning Toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    isReasoningCapable 
                      ? reasoningEnabled 
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-400' 
                        : 'bg-muted border-border text-muted-foreground hover:border-violet-500/30'
                      : 'bg-muted/50 border-border/50 text-muted-foreground/50 cursor-not-allowed'
                  }`}>
                    <Brain className="h-4 w-4" />
                    <span className="text-xs font-medium hidden sm:inline">Reasoning</span>
                    <Switch
                      checked={reasoningEnabled}
                      onCheckedChange={setReasoningEnabled}
                      disabled={!isReasoningCapable}
                      className="scale-75"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {isReasoningCapable 
                      ? 'Ativar modo de raciocínio para ver o processo de pensamento do modelo'
                      : 'Disponível apenas para GPT-5.1, GPT-5 Mini, GPT-5 Nano e o4 Mini'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 relative">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p>Selecione um modelo e comece a conversar!</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'bot' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={message.sender === 'user' ? 'ml-auto flex flex-col max-w-[70%]' : 'max-w-[70%]'}>
                  <div
                    className={`p-3 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <CleanMarkdownRenderer content={message.content} isUser={message.sender === 'user'} />
                    {message.files && message.files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.files.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded text-xs border border-white/20">
                            {file.type.startsWith('image/') ? (
                              <Image className="h-3 w-3 text-white/80" />
                            ) : (
                              <Paperclip className="h-3 w-3 text-white/80" />
                            )}
                            <span className="truncate max-w-[200px] text-white/90">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {message.model && (
                      <p className="text-xs opacity-70 mt-1">
                        Modelo: {message.model}
                      </p>
                    )}
                  </div>
                  
                  {/* DeepSeek Reasoning History */}
                  {message.sender === 'bot' && message.reasoning && (
                    <DeepSeekReasoningHistory reasoning={message.reasoning} />
                  )}
                  
                  {message.sender === 'user' && (
                    <PagePreview />
                  )}
                </div>

                {message.sender === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && !isDeepSeekThinking && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* DeepSeek Thinking Indicator */}
            {isDeepSeekThinking && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-violet-600 text-white">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 max-w-2xl">
                  <DeepSeekThinkingIndicator 
                    isVisible={isDeepSeekThinking} 
                    thinkingContent={thinkingContent}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Scroll to bottom button */}
          {showScrollButton && (
            <div className="fixed bottom-24 right-8 z-50">
              <Button
                onClick={scrollToBottom}
                size="icon"
                className="rounded-full h-12 w-12 shadow-lg hover:scale-110 transition-transform"
                aria-label="Rolar para o final"
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border">
          {/* Área para colar imagens */}
          <div 
            ref={pasteAreaRef}
            className="mb-3 p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer"
            tabIndex={0}
            onClick={() => pasteAreaRef.current?.focus()}
            onPaste={(e) => {
              console.log('🔥 PASTE AREA EVENT!');
              handlePaste(e.nativeEvent);
            }}
            style={{ outline: 'none' }}
          >
            <div className="text-center text-sm text-muted-foreground">
              {hasAttachedFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Image className="h-4 w-4" />
                  <span className="font-medium">{fileName}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <Image className="h-4 w-4" />
                    <span>Clique aqui e pressione <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+V</kbd></span>
                  </div>
                  <div className="text-xs">
                    ou clique com botão direito e escolha "Colar" para anexar screenshot
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile || isLoading}
              className="shrink-0"
              title="Anexar arquivo (PDF, Word, Imagem)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={captureScreenshot}
              disabled={isProcessingFile || isLoading}
              className="shrink-0"
              title="Capturar Screenshot"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={(e) => {
                console.log('🔥 INPUT PASTE EVENT!');
                handlePaste(e.nativeEvent);
              }}
              placeholder={
                isLoading || isCallingRef.current
                  ? "Processando..." // ✅ Feedback claro durante processamento
                  : isProcessingFile
                  ? "Processando arquivo..."
                  : hasAttachedFile && fileName
                  ? `Arquivo anexado: ${fileName}. Digite sua pergunta...`
                  : selectedModel
                  ? "Digite sua mensagem ou anexe um arquivo (PDF, Word, imagem). Use Ctrl+V para colar screenshots..."
                  : "Selecione um modelo primeiro"
              }
              disabled={!selectedModel || isProcessingFile}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isProcessingFile && !isCallingRef.current) {
                  e.preventDefault();
                  e.stopPropagation(); // ✅ Prevenir propagação para outros handlers
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-background border-border"
            />
            <Button 
              onClick={(e) => {
                e.preventDefault(); // ✅ Prevenir comportamento padrão
                e.stopPropagation(); // ✅ Parar propagação do evento
                if (!isCallingRef.current) {
                  handleSendMessage();
                }
              }}
              disabled={
                (!inputValue.trim() && !hasAttachedFile && !attachedFiles.length) || 
                !selectedModel || 
                isLoading || 
                isProcessingFile ||
                isCallingRef.current // ✅ Desabilitar durante execução
              }
              className="bg-primary hover:bg-primary-glow text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2 text-center">
            Suporte para PDF, Word e imagens (JPEG, PNG, GIF, WEBP) • 
            <strong> Faça screenshot → clique na área acima → Ctrl+V ou botão direito → Colar</strong>
          </div>
        </div>
      </Card>
    </div>
  );
};