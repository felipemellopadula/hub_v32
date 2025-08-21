// APAGUE TUDO E COLE ESTE CÓDIGO NO SEU ARQUIVO Chat.tsx

import {
  MessageCircle, ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown, MoreHorizontal, Edit3, Square, FileText, Loader2, Bot, User
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

// --- COMPONENTE SIDEBAR ---
const ConversationSidebar: React.FC<{ conversations: ChatConversation[]; currentConversationId: string | null; onSelectConversation: (conv: ChatConversation) => void; onNewConversation: () => void; onDeleteConversation: (id: string) => void; onToggleFavorite: (conv: ChatConversation) => void; onRenameConversation: (id: string, newTitle: string) => void; isMobile?: boolean; }> = ({ conversations, currentConversationId, onSelectConversation, onNewConversation, onDeleteConversation, onToggleFavorite, onRenameConversation, isMobile = false }) => { const handleRename = (e: React.MouseEvent, id: string) => { e.stopPropagation(); const newTitle = prompt("Digite o novo título da conversa:"); if (newTitle && newTitle.trim()) onRenameConversation(id, newTitle.trim()); }; const renderItem = (conv: ChatConversation) => ( <div key={conv.id} className={`group relative rounded-lg p-3 cursor-pointer transition-colors duration-200 ${currentConversationId === conv.id ? "bg-muted" : "hover:bg-muted/50"}`} onClick={() => onSelectConversation(conv)}> <div className="flex items-start justify-between"><div className="flex-1 min-w-0"><h3 className="text-sm font-medium text-foreground truncate">{conv.title}</h3><p className="text-xs text-muted-foreground mt-1">{new Date(conv.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p></div><div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(conv); }}><Star className={`h-4 w-4 mr-2 ${conv.is_favorite ? 'text-yellow-500 fill-current' : ''}`} />{conv.is_favorite ? 'Desfavoritar' : 'Favoritar'}</DropdownMenuItem><DropdownMenuItem onClick={(e) => handleRename(e, conv.id)}><Edit3 className="h-4 w-4 mr-2" />Renomear</DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Deletar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div> </div> ); const favorites = conversations.filter(c => c.is_favorite); const recents = conversations.filter(c => !c.is_favorite); return ( <div className="flex flex-col h-full bg-background border-r border-border"><div className="p-4 border-b border-border"><Button onClick={onNewConversation} size="lg" className="w-full"><Plus className="w-4 h-4 mr-2" />Novo Chat</Button></div><ScrollArea className="flex-1 p-2"><div className="space-y-1">{favorites.length > 0 && (<><h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">Favoritos</h4>{favorites.map(conv => isMobile ? <SheetClose asChild key={conv.id}>{renderItem(conv)}</SheetClose> : renderItem(conv))}</>)}{recents.length > 0 && (<><h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">Recentes</h4>{recents.map(conv => isMobile ? <SheetClose asChild key={conv.id}>{renderItem(conv)}</SheetClose> : renderItem(conv))}</>)}</div></ScrollArea></div> ); };

// --- COMPONENTE PRINCIPAL ---
const Chat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();
  const { consumeTokens, getModelDisplayName, tokenBalance } = useTokens();
  const isMobile = useIsMobile();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | undefined>('synergy-ia');
  
  const [pdfContent, setPdfContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [pdfInfo, setPdfInfo] = useState<{ pages?: number; size?: number } | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/');
    if (user && !loading) fetchConversations();
  }, [user, loading, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchConversations = async () => {
    const { data, error } = await supabase.from('chat_conversations').select('*').order('updated_at', { ascending: false });
    if (error) console.error('Erro ao carregar conversas:', error);
    else setConversations((data as any) || []);
  };

  const toSerializable = (msgs: Message[]) => msgs.map(m => ({ content: m.content, sender: m.sender, timestamp: m.timestamp.toISOString(), model: m.model }));
  const fromSerializable = (msgs: any[]): Message[] => (msgs || []).map((m, index) => ({ ...m, id: `${new Date(m.timestamp).getTime()}-${index}`, timestamp: new Date(m.timestamp) }));
  const deriveTitle = (msgs: Message[]) => (msgs.find(m => m.sender === 'user')?.content?.trim() || 'Nova conversa').slice(0, 50);

  const openConversation = (conv: ChatConversation) => {
    setCurrentConversationId(conv.id);
    setMessages(fromSerializable(conv.messages));
    setPdfContent(''); setFileName(''); setPdfInfo(null);
  };

  const upsertConversation = async (finalMessages: Message[]) => {
    if (!user || finalMessages.length === 0) return;
    const serialMessages = toSerializable(finalMessages);
    const title = deriveTitle(finalMessages);
    let convId = currentConversationId;

    if (convId) {
      await supabase.from('chat_conversations').update({ messages: serialMessages, title, updated_at: new Date().toISOString() }).eq('id', convId);
    } else {
      const { data } = await supabase.from('chat_conversations').insert({ user_id: user.id, title, messages: serialMessages }).select().single();
      if (data) setCurrentConversationId(data.id);
    }
    await fetchConversations();
  };

  const createNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInputValue('');
    setPdfContent(''); setFileName(''); setPdfInfo(null);
  };
  
  const deleteConversation = async (id: string) => {
    await supabase.from('chat_conversations').delete().eq('id', id);
    if (currentConversationId === id) createNewConversation();
    await fetchConversations();
  };
  
  const toggleFavoriteConversation = async (conv: ChatConversation) => {
    await supabase.from('chat_conversations').update({ is_favorite: !conv.is_favorite }).eq('id', conv.id);
    await fetchConversations();
  };
  
  const renameConversation = async (id: string, newTitle: string) => {
    await supabase.from('chat_conversations').update({ title: newTitle }).eq('id', id);
    await fetchConversations();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: "Erro de Arquivo", description: "Por favor, selecione apenas arquivos PDF.", variant: "destructive" });
      return;
    }
    setIsProcessingPdf(true);
    try {
      const result = await PdfProcessor.processPdf(file);
      if (result.success && result.content) {
        setPdfContent(result.content);
        setFileName(file.name);
        setPdfInfo({ pages: result.pageCount, size: result.fileSize });
        toast({ title: "PDF Processado", description: `${file.name} está pronto para análise.` });
      } else {
        toast({ title: "Erro ao Processar PDF", description: result.error || "Erro desconhecido", variant: "destructive" });
        setPdfContent(''); setFileName(''); setPdfInfo(null);
      }
    } catch (error) {
      toast({ title: "Erro Crítico", description: "Ocorreu um erro interno ao processar o PDF.", variant: "destructive" });
    } finally {
      setIsProcessingPdf(false);
      if(event.target) event.target.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !pdfContent) || isLoading) return;
    
    await consumeTokens(selectedModel, inputValue);

    const displayMessage = inputValue || `Analisar o arquivo: ${fileName}`;
    const userMessage: Message = { id: Date.now().toString(), content: displayMessage, sender: 'user', timestamp: new Date() };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    const userInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      let promptParaBackend = userInput;

      // Se há um PDF, o frontend constrói o prompt completo
      if (pdfContent) {
        if (userInput.toLowerCase().includes('resumo') || !userInput.trim()) {
            promptParaBackend = `Por favor, forneça um resumo executivo completo e bem estruturado do seguinte documento chamado "${fileName}":\n\n"""\n${pdfContent}\n"""`;
        } else {
            promptParaBackend = `Use o seguinte conteúdo do documento "${fileName}" como contexto principal para responder à pergunta do usuário.\n\nCONTEÚDO DO DOCUMENTO:\n"""\n${pdfContent}\n"""\n\nPERGUNTA DO USUÁRIO:\n"""\n${userInput}\n"""`;
        }
      }

      const payload = {
          message: promptParaBackend,
          model: selectedModel,
          files: undefined // Não enviamos mais a estrutura 'files', pois o prompt já está completo
      };

      const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: payload
      });

      if (error) throw error;
      
      // **AJUSTE AQUI: Esperando uma resposta simples**
      const responseContent = data.response || "Não recebi uma resposta válida.";

      const aiMessage: Message = { id: (Date.now() + 1).toString(), content: responseContent, sender: 'bot', timestamp: new Date(), model: selectedModel };
      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
      
      await upsertConversation(finalMessages);

      setPdfContent(''); setFileName(''); setPdfInfo(null);

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({ title: "Erro", description: error.message || "A função do Supabase pode estar com erro.", variant: "destructive" });
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <div className="h-screen bg-background flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  if (!user || !profile) return null;

  return (
    <div className="h-screen max-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
         <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3 md:gap-4"><Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:bg-muted"><ArrowLeft className="h-4 w-4" />Voltar</Button><div className="h-6 w-px bg-border hidden sm:block" /><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-blue-500" /><h1 className="text-lg font-semibold text-foreground">Chat</h1></div></div>
            <div className="hidden md:flex items-center gap-4"><ModelSelector onModelSelect={setSelectedModel} selectedModel={selectedModel} /><UserProfile /><ThemeToggle /></div>
            <div className="md:hidden flex items-center gap-1"><ThemeToggle /><Sheet><SheetTrigger asChild><Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="w-[320px] p-0 flex flex-col"><SheetHeader className="p-4 border-b"><SheetTitle>Menu</SheetTitle></SheetHeader><div className="p-4 space-y-4 border-b"><UserProfile /><ModelSelector onModelSelect={setSelectedModel} selectedModel={selectedModel} /></div><div className="flex-1 flex flex-col overflow-hidden"><ConversationSidebar conversations={conversations} currentConversationId={currentConversationId} onSelectConversation={openConversation} onNewConversation={createNewConversation} onDeleteConversation={deleteConversation} onToggleFavorite={toggleFavoriteConversation} onRenameConversation={renameConversation} isMobile={true} /></div></SheetContent></Sheet></div>
        </div>
      </header>
      <div className="flex-1 flex flex-row overflow-hidden">
        <aside className="w-80 flex-shrink-0 hidden md:flex flex-col bg-background"><ConversationSidebar conversations={conversations} currentConversationId={currentConversationId} onSelectConversation={openConversation} onNewConversation={createNewConversation} onDeleteConversation={deleteConversation} onToggleFavorite={toggleFavoriteConversation} onRenameConversation={renameConversation} /></aside>
        <main className="flex-1 flex flex-col bg-background">
          <ScrollArea className="flex-1"><div className="max-w-4xl mx-auto p-4 space-y-6">{messages.length === 0 ? (<div className="flex items-center justify-center h-full text-muted-foreground" style={{minHeight: 'calc(100vh - 300px)'}}><div className="text-center"><Bot className="h-12 w-12 mx-auto mb-4 opacity-50" /><h3 className="text-2xl font-bold mb-2">Olá, {profile.name}!</h3><p>Selecione uma conversa ou comece uma nova.</p><p className="mt-2 text-sm">Tokens disponíveis: {tokenBalance.toLocaleString()}</p></div></div>) : (messages.map((message) => (<div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}>{message.sender === 'bot' ? (<Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback></Avatar>) : null}<div className={`max-w-[85%] rounded-lg px-4 py-3 ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}><div className="text-sm prose prose-sm dark:prose-invert max-w-none break-words"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div></div>{message.sender === 'user' ? (<Avatar className="h-8 w-8 shrink-0"><AvatarFallback>{profile.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback></Avatar>) : null}</div>)))}
              {isLoading && <div className="flex gap-3"><Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback></Avatar><div className="bg-muted rounded-lg px-4 py-2 flex items-center"><div className="flex space-x-1"><div className="w-2 h-2 bg-current rounded-full animate-bounce delay-75"></div><div className="w-2 h-2 bg-current rounded-full animate-bounce delay-150"></div><div className="w-2 h-2 bg-current rounded-full animate-bounce delay-300"></div></div></div></div>}
              <div ref={messagesEndRef} /></div>
          </ScrollArea>
          <div className="flex-shrink-0 border-t border-border bg-background px-4 pt-4 pb-8">
            <div className="max-w-4xl mx-auto space-y-3">
               {fileName && (
                <Card className="bg-muted/50"><CardContent className="p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm overflow-hidden"><FileText className="h-4 w-4 text-primary shrink-0" /><div className="truncate"><span className="text-foreground font-medium" title={fileName}>{fileName}</span>{pdfInfo && <span className="text-xs text-muted-foreground ml-2">{pdfInfo.pages} pgs • {pdfInfo.size}MB</span>}</div></div><Button variant="ghost" size="sm" onClick={() => { setPdfContent(''); setFileName(''); setPdfInfo(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-muted-foreground hover:text-foreground">Remover</Button></div></CardContent></Card>
              )}
              {isProcessingPdf && (
                <Card className="bg-muted/50"><CardContent className="p-3"><div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-secondary" /><div><span className="text-foreground font-medium">Processando PDF...</span><div className="text-xs text-muted-foreground mt-1">Aguarde, arquivos grandes podem levar alguns segundos.</div></div></div></CardContent></Card>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
                <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isProcessingPdf || isLoading}><Paperclip className="h-4 w-4" /></Button>
                <Textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={fileName ? `Pergunte sobre ${fileName}...` : "Pergunte alguma coisa..."} disabled={isLoading || isProcessingPdf} className="w-full resize-none min-h-[52px]" rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !isMobile && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); }}}/>
                <Button type="submit" disabled={isLoading || isProcessingPdf || (!inputValue.trim() && !pdfContent)} size="icon" className="h-full px-4"><ArrowUp className="h-4 w-4" /></Button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Chat;