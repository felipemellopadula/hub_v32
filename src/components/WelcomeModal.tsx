import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Video,
  Image,
  Languages,
  PenTool,
  FileAudio,
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export const WelcomeModal = ({ isOpen, onClose, userName }: WelcomeModalProps) => {
  const navigate = useNavigate();
  const [isClosing, setIsClosing] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const features = [
    { icon: MessageCircle, name: "Chat com IA", color: "text-blue-500" },
    { icon: Video, name: "Geração de Vídeos", color: "text-purple-500" },
    { icon: Image, name: "Criação de Imagens", color: "text-green-500" },
    { icon: Languages, name: "Tradutor/Humanizar", color: "text-orange-500" },
    { icon: PenTool, name: "Escrever Conteúdo", color: "text-indigo-500" },
    { icon: FileAudio, name: "Transcrever Áudio", color: "text-red-500" },
  ];

  const plans = [
    {
      id: "basic-monthly",
      planId: "basic_monthly",
      name: "Básico Mensal",
      price: "R$ 1,00",
      period: "/mês",
      features: ["50.000 tokens/mês", "Todos os modelos de IA", "Suporte prioritário"],
    },
    {
      id: "basic-yearly",
      planId: "basic_yearly",
      name: "Básico Anual",
      price: "R$ 1,00",
      period: "/ano",
      badge: "Economize 17%",
      features: ["50.000 tokens/mês", "Todos os modelos de IA", "Suporte prioritário"],
    },
    {
      id: "pro-monthly",
      planId: "pro_monthly",
      name: "Pro Mensal",
      price: "R$ 1,00",
      period: "/mês",
      popular: true,
      features: ["150.000 tokens/mês", "Todos os modelos de IA", "Suporte VIP", "Funcionalidades exclusivas"],
    },
    {
      id: "pro-yearly",
      planId: "pro_yearly",
      name: "Pro Anual",
      price: "R$ 1,00",
      period: "/ano",
      badge: "Economize 17%",
      popular: true,
      features: ["150.000 tokens/mês", "Todos os modelos de IA", "Suporte VIP", "Funcionalidades exclusivas"],
    },
  ];

  const handleClose = async () => {
    setIsClosing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ has_seen_welcome_modal: true })
          .eq("id", user.id);

        if (error) {
          console.error("Erro ao atualizar modal:", error);
        }
      }
    } catch (error) {
      console.error("Erro ao fechar modal:", error);
    } finally {
      setIsClosing(false);
      setShowPlans(false);
      onClose();
    }
  };

  const handleCheckout = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para fazer upgrade");
        setLoadingPlan(null);
        return;
      }

      console.log("Iniciando checkout para plano:", planId);
      
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { planId },
      });

      console.log("Resposta do checkout:", data, error);

      if (error) {
        console.error("Erro na edge function:", error);
        throw error;
      }

      if (data?.url) {
        console.log("Abrindo URL do Stripe:", data.url);
        // Abre em nova aba para evitar bloqueio de popup
        const stripeWindow = window.open(data.url, '_blank');
        if (!stripeWindow) {
          toast.error("Popup bloqueado! Por favor, permita popups e tente novamente.");
        } else {
          toast.success("Redirecionando para o checkout...");
        }
      } else {
        console.error("URL não encontrada na resposta:", data);
        throw new Error("URL de checkout não recebida");
      }
    } catch (error) {
      console.error("Erro ao criar checkout:", error);
      toast.error("Erro ao processar checkout. Tente novamente.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img
                src="/lovable-uploads/5e06d662-7533-4ca8-a35e-3167dc0f31e6.png"
                alt="Synergy AI"
                className="h-16 w-auto block dark:hidden"
              />
              <img
                src="/lovable-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
                alt="Synergy AI"
                className="h-16 w-auto hidden dark:block"
              />
              <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-primary animate-pulse" />
            </div>
          </div>
          <DialogTitle className="text-3xl text-center">
            Bem-vindo ao <span className="text-primary">Synergy AI</span>, {userName}!
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            Estamos muito felizes em ter você aqui! 🎉
          </DialogDescription>
        </DialogHeader>

        {!showPlans ? (
          /* Tela inicial de boas-vindas */
          <div className="space-y-6 mt-4">
            {/* Tokens de Teste */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold text-foreground">
                  1.000 Tokens de Teste Grátis!
                </h3>
              </div>
              <p className="text-muted-foreground">
                Comece agora mesmo a explorar todas as funcionalidades da nossa plataforma
                sem compromisso.
              </p>
            </div>

            {/* Funcionalidades */}
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-4 text-center">
                O que você pode fazer:
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Icon className={`h-5 w-5 ${feature.color}`} />
                      <span className="text-sm font-medium text-foreground">
                        {feature.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Planos */}
            <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-foreground mb-2 text-center">
                Quer mais tokens?
              </h4>
              <p className="text-muted-foreground text-center mb-4">
                Confira nossos planos com muito mais tokens e funcionalidades ilimitadas!
              </p>
              <Button
                onClick={() => setShowPlans(true)}
                className="w-full"
                size="lg"
                disabled={isClosing}
              >
                Ver Planos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Botão de Começar */}
            <div className="pt-4 border-t">
              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isClosing}
              >
                Começar a Usar Agora
              </Button>
            </div>
          </div>
        ) : (
          /* Tela de seleção de planos */
          <div className="space-y-6 mt-4">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Escolha seu plano
              </h3>
              <p className="text-muted-foreground">
                Selecione o plano ideal para suas necessidades
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative ${plan.popular ? "border-primary border-2" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                        Mais Popular
                      </span>
                    </div>
                  )}
                  {plan.badge && !plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span className="text-sm text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      onClick={() => handleCheckout(plan.planId)}
                      disabled={loadingPlan !== null}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {loadingPlan === plan.planId ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        "Assinar agora"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Botão de voltar */}
            <div className="pt-4 border-t flex gap-3">
              <Button
                onClick={() => setShowPlans(false)}
                variant="outline"
                className="flex-1"
                disabled={loadingPlan !== null}
              >
                Voltar
              </Button>
              <Button
                onClick={handleClose}
                variant="ghost"
                className="flex-1"
                disabled={loadingPlan !== null}
              >
                Começar com plano gratuito
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
