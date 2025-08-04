import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, User } from "lucide-react";

interface UserProfileProps {
  userImage?: string;
  userName?: string;
  tokens: number;
}

export const UserProfile = ({ 
  userImage, 
  userName = "Usuário", 
  tokens = 10000 
}: UserProfileProps) => {
  return (
    <div className="p-3 bg-gradient-card">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
          <AvatarImage src={userImage} alt={userName} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{userName}</h3>
          <div className="flex items-center gap-1 mt-1">
            <Coins className="h-4 w-4 text-warning" />
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {tokens.toLocaleString()} tokens
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};