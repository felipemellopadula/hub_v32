import { ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModelSelector } from "@/components/ModelSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfile } from "@/components/UserProfile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTokens } from "@/hooks/useTokens";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  reasoning?: string;
  isStreaming?: boolean;
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

const Chat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();
  const { consumeTokens, getTokenCost, getModelDisplayName, tokenBalance } = useTokens();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWebSearchMode, setIsWebSearchMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<{ [key: string]: boolean }>({});

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Load user conversations when authenticated
  useEffect(() => {
    if (!loading && user) {
      (async () => {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('*')
          .order('updated_at', { ascending: false });
        if (error) {
          console.error('Erro ao carregar conversas:', error);
        } else if (data) {
          setConversations(data as any);
        }
      })();
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
   
    // Show files in input
    const fileNames = files.map(f => f.name).join(', ');
    setInputValue(prev => prev + (prev ? ' ' : '') + `[Arquivos: ${fileNames}]`);
   
    toast({
      title: "Arquivos anexados",
      description: `${files.length} arquivo(s) anexado(s)`,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
     
      toast({
        title: "Gravando",
        description: "Fale sua mensagem...",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
     
      const response = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });
      if (response.data?.text) {
        setInputValue(prev => prev + (prev ? ' ' : '') + response.data.text);
        toast({
          title: "Transcrição concluída",
          description: "Áudio convertido para texto",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível transcrever o áudio.",
        variant: "destructive",
      });
    }
  };

  // Helpers to serialize/deserialize messages
  const toSerializable = (msgs: Message[]) => msgs.map(m => ({
    id: m.id,
    content: m.content,
    sender: m.sender,
    timestamp: m.timestamp.toISOString(),
    model: m.model,
    reasoning: m.reasoning,
  }));

  const fromSerializable = (msgs: any[]): Message[] =>
    (msgs || []).map((m) => ({
      id: m.id,
      content: m.content,
      sender: m.sender,
      timestamp: new Date(m.timestamp),
      model: m.model,
      reasoning: m.reasoning,
    }));

  const deriveTitle = (msgs: Message[]) => {
    const firstUser = msgs.find(m => m.sender === 'user');
    const base = firstUser?.content?.trim() || 'Nova conversa';
    return base.slice(0, 60);
  };

  const openConversation = (conv: ChatConversation) => {
    setCurrentConversationId(conv.id);
    setMessages(fromSerializable(conv.messages));
  };

  const createNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const upsertConversation = async (finalMessages: Message[]) => {
    try {
      const serial = toSerializable(finalMessages);
      if (!currentConversationId) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: user.id,
            title: deriveTitle(finalMessages),
            messages: serial,
          })
          .select('*')
          .single();
        if (error) {
          console.error('Erro ao criar conversa:', error);
        } else if (data) {
          setCurrentConversationId(data.id);
          setConversations((prev) => [data as any, ...prev]);
        }
      } else {
        const { data, error } = await supabase
          .from('chat_conversations')
          .update({
            messages: serial,
          })
          .eq('id', currentConversationId)
          .select('*')
          .single();
        if (error) {
          console.error('Erro ao atualizar conversa:', error);
        } else if (data) {
          setConversations((prev) => {
            const without = prev.filter(c => c.id !== data.id);
            return [data as any, ...without];
          });
        }
      }
    } catch (e) {
      console.error('Erro ao salvar conversa:', e);
    }
  };

  const toggleFavoriteConversation = async (conv: ChatConversation) => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .update({ is_favorite: !conv.is_favorite })
      .eq('id', conv.id)
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar favorito.', variant: 'destructive' });
    } else if (data) {
      setConversations((prev) => prev.map(c => c.id === data.id ? (data as any) : c));
    }
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir a conversa.', variant: 'destructive' });
      return;
    }
    setConversations((prev) => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  };

  const toggleWebSearchMode = () => {
    setIsWebSearchMode(prev => !prev);
    toast({
      title: isWebSearchMode ? "Modo busca web desativado" : "Modo busca web ativado",
      description: isWebSearchMode ? "Agora as mensagens serão enviadas para a IA" : "Agora as mensagens serão buscadas na web",
    });
  };

  const performWebSearch = async (query: string) => {
    try {
      setIsLoading(true);
     
      const response = await supabase.functions.invoke('web-search', {
        body: { query, numResults: 3 }
      });
      let searchContent = 'Sem resultados.';
      if (response.data?.results) {
        const searchResults = response.data.results
          .map((result: any) =>
            `${result.title}: ${result.content}`
          )
          .join('\n\n');
       
        searchContent = `[Resultados da busca na web para "${query}"]\n\n${searchResults}`;
      }
     
      const userMessage: Message = {
        id: Date.now().toString(),
        content: query,
        sender: 'user',
        timestamp: new Date(),
      };
      const searchMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: searchContent,
        sender: 'bot',
        timestamp: new Date(),
        model: 'Busca Web',
      };
      const base = messages;
      const finalMessages = [...base, userMessage, searchMessage];
      setMessages(finalMessages);
      await upsertConversation(finalMessages);
     
      toast({
        title: "Busca concluída",
        description: response.data?.results ? "Resultados da busca na web encontrados" : "Nenhum resultado encontrado.",
        variant: response.data?.results ? undefined : "destructive",
      });
    } catch (error) {
      console.error('Web search error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível realizar a busca na web.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const currentInput = inputValue;
    setInputValue('');
    setAttachedFiles([]);
    // If web search mode is active, perform web search instead
    if (isWebSearchMode) {
      await performWebSearch(currentInput);
      return;
    }
    // Check and consume tokens before sending message
    const canProceed = await consumeTokens(selectedModel, currentInput);
    if (!canProceed) {
      return;
    }
    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentInput,
      sender: 'user',
      timestamp: new Date(),
    };
    const base = messages;
    const messagesAfterUser = [...base, userMessage];
    setMessages(messagesAfterUser);
    setIsLoading(true);

    // Create streaming bot message
    const streamingBotMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '',
      sender: 'bot',
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true,
    };
    
    const messagesWithStreaming = [...messagesAfterUser, streamingBotMessage];
    setMessages(messagesWithStreaming);

    try {
      const response = await fetch(`https://hcrbnxybgklhqujbfdpx.supabase.co/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          model: selectedModel,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/plain')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let reasoning = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(jsonStr);
                  const delta = parsed.choices?.[0]?.delta;
                  
                  if (delta?.content) {
                    accumulatedContent += delta.content;
                    
                    // Update streaming message
                    setMessages(prev => prev.map(msg => 
                      msg.id === streamingBotMessage.id 
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    ));
                  }

                  if (delta?.reasoning) {
                    reasoning += delta.reasoning;
                  }
                } catch (parseError) {
                  console.log('Parse error for chunk:', jsonStr);
                }
              }
            }
          }
        }

        // Final message with complete content
        const finalBotMessage: Message = {
          ...streamingBotMessage,
          content: accumulatedContent || 'Desculpe, não consegui processar sua mensagem.',
          reasoning: reasoning || undefined,
          isStreaming: false,
        };

        const finalMessages = [...messagesAfterUser, finalBotMessage];
        setMessages(finalMessages);
        await upsertConversation(finalMessages);

      } else {
        // Handle non-streaming response (fallback)
        const data = await response.json();
        let content = '';
        let reasoning = '';

        if (typeof data.response === 'string') {
          try {
            const parsed = JSON.parse(data.response);
            content = parsed.content || data.response;
            reasoning = parsed.reasoning || '';
          } catch {
            content = data.response;
          }
        } else {
          content = data.response || 'Desculpe, não consegui processar sua mensagem.';
        }

        const finalBotMessage: Message = {
          ...streamingBotMessage,
          content,
          reasoning: reasoning || undefined,
          isStreaming: false,
        };

        const finalMessages = [...messagesAfterUser, finalBotMessage];
        setMessages(finalMessages);
        await upsertConversation(finalMessages);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
      
      // Remove streaming message and persist at least the user question
      setMessages(messagesAfterUser);
      await upsertConversation(messagesAfterUser);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 py-1">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold text-foreground">Synergy Chat</h1>
            <Button variant="outline" size="sm" className="ml-2" onClick={createNewConversation}>
              <Plus className="h-4 w-4 mr-1" /> Novo chat
            </Button>
            {currentConversationId && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const conv = conversations.find(c => c.id === currentConversationId);
                    if (conv) toggleFavoriteConversation(conv);
                  }}
                  className="ml-1"
                >
                  <Star className={`h-4 w-4 ${conversations.find(c => c.id === currentConversationId)?.is_favorite ? 'text-yellow-500' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteConversation(currentConversationId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector onModelSelect={setSelectedModel} selectedModel={selectedModel} />
            <ThemeToggle />
            <UserProfile />
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Conversations Sidebar */}
        <aside className="w-72 border-r border-border bg-background hidden md:flex md:flex-col">
          <div className="p-3">
            <input
              placeholder="Pesquisar conversas..."
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              onChange={() => {}}
            />
          </div>
          <div className="px-3 pb-2 text-xs text-muted-foreground">Favoritos</div>
          <div className="flex-1 overflow-y-auto">
            {conversations.filter(c => c.is_favorite).length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum favorito</div>
            )}
            {conversations.filter(c => c.is_favorite).map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-muted ${currentConversationId === c.id ? 'bg-muted' : ''}`}
              >
                <span className="truncate text-sm">{c.title}</span>
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <Trash2 className="h-4 w-4" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} />
                </span>
              </button>
            ))}
            <div className="px-3 pt-3 pb-2 text-xs text-muted-foreground">Recentes</div>
            {conversations.filter(c => !c.is_favorite).map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-muted ${currentConversationId === c.id ? 'bg-muted' : ''}`}
              >
                <span className="truncate text-sm">{c.title}</span>
                <span className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); toggleFavoriteConversation(c); }}
                  >
                    <Star className={`h-4 w-4 ${c.is_favorite ? 'text-yellow-500' : ''}`} />
                  </Button>
                  <Trash2 className="h-4 w-4" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} />
                </span>
              </button>
            ))}
          </div>
        </aside>
        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                  <div className="text-center">
                    <h3 className="text-lg font-medium mb-2">Olá, {profile.name}!</h3>
                    <p>Você tem {tokenBalance.toLocaleString()} tokens disponíveis</p>
                    <p className="mt-2">Faça uma pergunta para começar a conversar com a IA</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.sender === 'bot' && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          AI
                        </AvatarFallback>
                      </Avatar>
                    )}
                     <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground ml-auto'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="space-y-2">
                        {message.reasoning && message.sender === 'bot' && (
                          <div className="border-b border-border pb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedReasoning(prev => ({
                                ...prev,
                                [message.id]: !prev[message.id]
                              }))}
                              className="h-auto p-1 text-xs opacity-70 hover:opacity-100"
                            >
                              {expandedReasoning[message.id] ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Ocultar raciocínio
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Mostrar raciocínio
                                </>
                              )}
                            </Button>
                            {expandedReasoning[message.id] && (
                              <div className="mt-2 text-xs opacity-80 bg-background/50 rounded p-2 whitespace-pre-wrap">
                                {message.reasoning}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                          {message.isStreaming && (
                            <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
                          )}
                        </p>
                        {message.model && message.sender === 'bot' && (
                          <p className="text-xs opacity-70 mt-1">
                            {getModelDisplayName(message.model)} • {getTokenCost(message.model).toLocaleString()} tokens
                          </p>
                        )}
                      </div>
                    </div>
                    {message.sender === 'user' && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Message Input - Fixed at bottom */}
          <div className="border-t border-border bg-background p-4">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isWebSearchMode ? "Digite para buscar na web..." : "Digite sua mensagem..."}
                    disabled={isLoading}
                    className="w-full pl-4 pr-32 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      multiple
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 w-8 p-0 hover:bg-muted"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`h-8 w-8 p-0 hover:bg-muted ${isRecording ? 'text-red-500' : ''}`}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={toggleWebSearchMode}
                      className={`h-8 w-8 p-0 hover:bg-muted ${isWebSearchMode ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                      <Globe className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button type="submit" disabled={isLoading || !inputValue.trim()} size="lg">
                  Enviar
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;