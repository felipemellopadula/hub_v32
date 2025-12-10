import React, { useState, useMemo, useCallback } from "react";
import { Star, Trash2, Plus, MoreHorizontal, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatConversation, formatPtBR } from "./types";

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

export const ConversationSidebar: React.FC<ConversationSidebarProps> = React.memo(
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

    const favorites = useMemo(() => filteredConversations.filter((c) => c.is_favorite), [filteredConversations]);
    const recents = useMemo(() => filteredConversations.filter((c) => !c.is_favorite), [filteredConversations]);

    const handleRename = useCallback(
      (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newTitle = prompt("Digite o novo título da conversa:");
        if (newTitle && newTitle.trim()) {
          onRenameConversation(id, newTitle.trim());
        }
      },
      [onRenameConversation],
    );

    const renderItem = useCallback(
      (conv: ChatConversation) => {
        const card = (
          <div
            key={conv.id}
            className={`group relative rounded-lg p-3 cursor-pointer transition-colors duration-200 ${
              currentConversationId === conv.id ? "bg-muted" : "hover:bg-muted/50"
            }`}
            onClick={() => onSelectConversation(conv)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground truncate">{conv.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{formatPtBR.format(new Date(conv.updated_at))}</p>
              </div>
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
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
                      <Star className={`h-4 w-4 mr-2 ${conv.is_favorite ? "text-yellow-500" : ""}`} />
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
      [currentConversationId, onDeleteConversation, onSelectConversation, onToggleFavorite, handleRename, isMobile],
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
                <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">Favoritos</h4>
                {favorites.map(renderItem)}
              </>
            )}
            <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground">Recentes</h4>
            {recents.map(renderItem)}

            {filteredConversations.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  },
);

ConversationSidebar.displayName = "ConversationSidebar";
