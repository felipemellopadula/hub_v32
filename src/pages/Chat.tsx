import { MessageCircle, ArrowLeft, Paperclip, Mic, Globe, Star, Trash2, Plus, ChevronDown, ChevronUp, Copy, Menu, ArrowUp, ArrowDown, MoreHorizontal, Edit3 } from "lucide-react";
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
    const newTitle = prompt('Enter new title:');
    if (newTitle) {
      onRenameConversation(id, newTitle);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-64 h-full bg-background border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <Button onClick={onNewConversation} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> New Conversation
        </Button>
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="mt-2 w-full p-2 border border-border rounded"
        />
      </div>
      <ScrollArea className="flex-1">
        {filteredConversations.map(conv => (
          <div
            key={conv.id}
            className={`p-4 border-b border-border cursor-pointer flex items-center justify-between ${conv.id === currentConversationId ? 'bg-accent' : ''}`}
            onClick={() => onSelectConversation(conv)}
          >
            <span>{conv.title}</span>
            <div className="flex space-x-2">
              <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onToggleFavorite(conv); }}>
                <Star className={`h-4 w-4 ${conv.is_favorite ? 'fill-yellow-500' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={e => handleRename(e, conv.id)}>
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onDeleteConversation(conv.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};

// Main Chat Component
const Chat: React.FC = () => {
  const { user } = useAuth(); // Assuming useAuth provides user
  const profile = {}; // Placeholder, replace with actual profile logic if needed
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<ChatConversation[]>([]); // Placeholder state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Placeholder functions - implement as needed
  const onSelectConversation = (conv: ChatConversation) => setCurrentConversationId(conv.id);
  const onNewConversation = () => {
    // Implement new conversation logic
  };
  const onDeleteConversation = (id: string) => {
    // Implement delete logic
  };
  const onToggleFavorite = (conv: ChatConversation) => {
    // Implement favorite toggle
  };
  const onRenameConversation = (id: string, newTitle: string) => {
    // Implement rename logic
  };

  if (!user || !profile) return null;

  return (
    <div className="h-screen max-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          {/* Lado Esquerdo */}
          <div className="flex items-center space-x-4">
            <Button variant="ghost"><ArrowLeft /></Button>
            <ModelSelector />
          </div>
          {/* Centro */}
          <div>Chat Title</div>
          {/* Lado Direito */}
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <UserProfile />
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={onSelectConversation}
          onNewConversation={onNewConversation}
          onDeleteConversation={onDeleteConversation}
          onToggleFavorite={onToggleFavorite}
          onRenameConversation={onRenameConversation}
          isMobile={isMobile}
        />
        {/* Main Chat Area - Placeholder */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {/* Messages would go here */}
          </ScrollArea>
          <div className="p-4 border-t border-border">
            <Textarea placeholder="Type your message..." />
            <Button>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;