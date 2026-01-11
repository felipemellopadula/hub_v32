import { User, LogOut, Settings, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface UserProfileProps {
  tokens?: number;
}

const UserProfile = ({ tokens }: UserProfileProps) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const avatarSrc = (profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || (user?.user_metadata?.picture as string) || '') as string;

  if (!user || !profile) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const isLegacy = profile.is_legacy_user;
  const balanceLabel = isLegacy ? "tokens" : "créditos";
  const balanceValue = profile.tokens_remaining ?? 0;

  // Estado do saldo para feedback visual (apenas novos usuários)
  const isLow = !isLegacy && balanceValue <= 5 && balanceValue > 2;
  const isCritical = !isLegacy && balanceValue <= 2 && balanceValue > 0;
  const isEmpty = !isLegacy && balanceValue <= 0;

  const getBadgeClasses = () => {
    if (isLegacy) return "bg-secondary text-secondary-foreground";
    if (isEmpty) return "bg-red-500/20 text-red-400 border border-red-500/50";
    if (isCritical) return "bg-orange-500/20 text-orange-400 border border-orange-500/50";
    if (isLow) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50";
    return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  };

  const getTextColorClass = () => {
    if (isEmpty) return "text-red-400";
    if (isCritical) return "text-orange-400";
    if (isLow) return "text-yellow-400";
    return "text-emerald-400";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium">{profile.name}</span>
            {isLegacy ? (
              <Badge variant="secondary" className="text-xs">
                {balanceValue.toLocaleString()} {balanceLabel}
              </Badge>
            ) : (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors",
                getBadgeClasses()
              )}>
                <Coins className="h-3 w-3" />
                <span>{balanceValue.toLocaleString()}</span>
              </div>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 p-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{profile.name}</span>
            <span className="text-sm text-muted-foreground">{profile.email}</span>
            <div className={cn(
              "flex items-center gap-1 mt-1 text-xs font-medium",
              isLegacy ? "text-muted-foreground" : getTextColorClass()
            )}>
              <Coins className="h-3 w-3" />
              <span>
                {balanceValue.toLocaleString()} {isLegacy ? 'tokens' : `crédito${balanceValue !== 1 ? 's' : ''}`}
              </span>
              {isEmpty && <span className="text-red-400 ml-1">(vazio)</span>}
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserProfile;