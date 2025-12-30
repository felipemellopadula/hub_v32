import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Aguardar um pouco para o webhook processar
    const timer = setTimeout(async () => {
      if (refreshProfile) {
        await refreshProfile();
      }
      setIsChecking(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [refreshProfile]);

  const handleGoToDashboard = () => {
    navigate("/dashboard-novo");
  };

  const handleGoToLogin = () => {
    navigate("/?login=true");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
          <CardDescription className="text-base">
            Sua assinatura foi ativada com sucesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isChecking ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando sua conta...</span>
            </div>
          ) : user ? (
            <>
              <p className="text-muted-foreground">
                Você já está logado! Clique abaixo para acessar o dashboard e começar a criar.
              </p>
              <Button 
                onClick={handleGoToDashboard} 
                className="w-full"
                size="lg"
              >
                Ir para o Dashboard
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Verifique seu email
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Enviamos um link de confirmação para ativar sua conta. 
                      Após confirmar, você poderá fazer login.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Já confirmou seu email?
                </p>
                <Button 
                  onClick={handleGoToLogin} 
                  className="w-full"
                  size="lg"
                >
                  Fazer Login
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Não recebeu o email? Verifique a pasta de spam ou entre em contato com nosso suporte.
              </p>
            </>
          )}

          {sessionId && (
            <p className="text-xs text-muted-foreground pt-4 border-t">
              ID da sessão: {sessionId.slice(0, 20)}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
