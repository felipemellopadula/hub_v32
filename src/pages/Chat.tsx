import { MessageCircle, ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown, MoreHorizontal, Edit3, Send } from "lucide-react";
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
import { Input } from "@/components/ui/input";

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

// --- COMPONENTES FILHOS (assumindo uma implementação para o sidebar) ---
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
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState("");

    const handleRenameClick = (conv: ChatConversation) => {
        setRenamingId(conv.id);
        setNewTitle(conv.title);
    };

    const handleRenameSubmit = (id: string) => {
        if (newTitle.trim()) {
            onRenameConversation(id, newTitle.trim());
        }
        setRenamingId(null);
    };

    return (
        <aside className="h-full bg-gray-100 dark:bg-gray-900 p-4 flex flex-col">
            <Button onClick={onNewConversation} className="mb-4 w-full">
                <Plus className="mr-2 h-4 w-4" /> Nova Conversa
            </Button>
            <ScrollArea className="flex-1">
                <div className="space-y-2">
                    {conversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => onSelectConversation(conv)}
                            className={`p-2 rounded-md cursor-pointer ${currentConversationId === conv.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        >
                            {renamingId === conv.id ? (
                                <Input
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    onBlur={() => handleRenameSubmit(conv.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(conv.id)}
                                    autoFocus
                                />
                            ) : (
                                <div className="flex justify-between items-center">
                                    <span className="truncate">{conv.title}</span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleRenameClick(conv)}>Renomear</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onDeleteConversation(conv.id)}>Deletar</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </aside>
    );
};


// --- COMPONENTE PRINCIPAL DO CHAT ---
const Chat = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { user } = useAuth(); // Exemplo, pegando usuário do contexto
    const { tokens } = useTokens(); // Exemplo, pegando tokens do hook
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    
    // Simulação de dados para a sidebar
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            content: input,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInput("");

        // TODO: Adicionar lógica para receber resposta do bot
    };
    
    // Exemplo de funções para o sidebar
    const handleNewConversation = () => {
        setMessages([]);
        setCurrentConversationId(null);
        console.log("Iniciando nova conversa");
    }

    return (
        <div className="flex h-screen bg-white dark:bg-black">
            {/* Sidebar para Desktop */}
            {!isMobile && (
                <div className="w-1/4 border-r border-gray-200 dark:border-gray-800">
                    <ConversationSidebar 
                        conversations={conversations}
                        currentConversationId={currentConversationId}
                        onSelectConversation={(conv) => setCurrentConversationId(conv.id)}
                        onNewConversation={handleNewConversation}
                        onDeleteConversation={(id) => setConversations(c => c.filter(conv => conv.id !== id))}
                        onToggleFavorite={() => {}}
                        onRenameConversation={() => {}}
                    />
                </div>
            )}

            {/* Conteúdo Principal do Chat */}
            <main className="flex flex-1 flex-col h-full">
                {/* Header */}
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-4">
                        {isMobile ? (
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon"><Menu /></Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="p-0">
                                   <ConversationSidebar 
                                        conversations={conversations}
                                        currentConversationId={currentConversationId}
                                        onSelectConversation={(conv) => setCurrentConversationId(conv.id)}
                                        onNewConversation={handleNewConversation}
                                        onDeleteConversation={(id) => setConversations(c => c.filter(conv => conv.id !== id))}
                                        onToggleFavorite={() => {}}
                                        onRenameConversation={() => {}}
                                   />
                                </SheetContent>
                            </Sheet>
                        ) : (
                            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                                <ArrowLeft />
                            </Button>
                        )}
                        <h1 className="text-lg font-semibold">Chat</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <UserProfile />
                    </div>
                </header>

                {/* Área das Mensagens - A MUDANÇA PRINCIPAL ESTÁ AQUI */}
                <div className="flex-1 overflow-y-auto p-6">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                           <MessageCircle size={48} className="mb-4" />
                            <h2 className="text-2xl font-bold">Olá, {user?.user_metadata?.name || 'Augusto Teste'}!</h2>
                            <p>Selecione uma conversa ou inicie uma nova.</p>
                            <p>Você tem {tokens ?? 4375} tokens disponíveis.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                                     {msg.sender === 'bot' && <Avatar><AvatarFallback>B</AvatarFallback></Avatar>}
                                     <div className={`max-w-xl rounded-lg p-3 ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-800'}`}>
                                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                     </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Área de Input */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                    <form onSubmit={handleSendMessage} className="relative">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Pergunte alguma coisa..."
                            className="w-full pr-20"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    handleSendMessage(e);
                                }
                            }}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                             <Button type="button" variant="ghost" size="icon"><Mic/></Button>
                            <Button type="submit" size="icon">
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default Chat;
