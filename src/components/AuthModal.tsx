import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectPath?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, redirectPath }) => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const emailNormalized = signInData.email.trim().toLowerCase();
      const { error } = await signIn(emailNormalized, signInData.password);
      if (error) {
        let errorMessage = error.message;
        if (error.message.includes("Invalid login credentials")) {
          errorMessage =
            "Email ou senha inválidos. Verifique suas credenciais.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage =
            "Confirme seu email antes de fazer login. Verifique sua caixa de entrada.";
        } else if (error.message.includes("Too many requests")) {
          errorMessage =
            "Muitas tentativas de login. Tente novamente em alguns minutos.";
        }
        toast({
          title: "Erro no login",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando...",
      });
      
      // Redirecionar para o path desejado ou dashboard
      const targetPath = redirectPath || localStorage.getItem('pendingRedirectPath') || '/dashboard-novo';
      localStorage.removeItem('pendingRedirectPath');
      onClose();
      navigate(targetPath);
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // Salvar path no localStorage antes do OAuth redirect
      if (redirectPath) {
        localStorage.setItem('pendingRedirectPath', redirectPath);
      }
      
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Redirecionando...",
        description: "Você será redirecionado para fazer login com Google.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Acesse sua conta</DialogTitle>
          <DialogDescription>
            Faça login para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Redirecionando..." : "Entrar com Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                ou
              </span>
            </div>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="seu@email.com"
                value={signInData.email}
                onChange={(e) =>
                  setSignInData({ ...signInData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signin-password">Senha</Label>
              <div className="relative">
                <Input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={signInData.password}
                  onChange={(e) =>
                    setSignInData({
                      ...signInData,
                      password: e.target.value,
                    })
                  }
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <Button
              type="button"
              variant="link"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                const email = signInData.email.trim().toLowerCase();
                if (!email) {
                  toast({
                    title: "Informe seu email",
                    description:
                      "Preencha o campo de email para receber o link.",
                    variant: "destructive",
                  });
                  return;
                }
                setLoading(true);
                const { error } = await supabase.auth.resetPasswordForEmail(
                  email,
                  {
                    redirectTo: `${window.location.origin}/dashboard-novo`,
                  }
                );
                setLoading(false);
                if (error) {
                  toast({
                    title: "Erro ao enviar link",
                    description: error.message,
                    variant: "destructive",
                  });
                } else {
                  toast({
                    title: "Email enviado",
                    description:
                      "Verifique sua caixa de entrada para redefinir a senha.",
                  });
                }
              }}
            >
              Esqueci minha senha
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
