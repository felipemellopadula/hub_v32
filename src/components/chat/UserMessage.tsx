import React from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Message } from "./types";

interface UserMessageProps {
  message: Message;
  onCopy: (markdownText: string, isUser: boolean, messageId: string) => void;
  renderFileIcon: (fileName: string, fileType: string, fileUrl?: string) => JSX.Element;
}

export const UserMessage: React.FC<UserMessageProps> = React.memo(
  ({ message, onCopy, renderFileIcon }) => {
    return (
      <div className="flex items-start justify-end w-full gap-2">
        {/* Botão copiar */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mt-1 opacity-60 hover:opacity-100"
                onClick={() => onCopy(message.content, true, message.id)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Mensagem do usuário */}
        <div className="max-w-[85%] rounded-lg px-4 py-3 bg-primary text-primary-foreground">
          {message.files && message.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.files.map((file, idx) => (
                <div key={idx}>{renderFileIcon(file.name, file.type, file.url)}</div>
              ))}
            </div>
          )}
          {/* Texto direto */}
          <div className="text-sm break-words whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">U</AvatarFallback>
        </Avatar>
      </div>
    );
  },
);

UserMessage.displayName = "UserMessage";
