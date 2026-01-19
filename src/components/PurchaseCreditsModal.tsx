import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Star, Zap, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PurchaseCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PricingOption {
  quantity: number;
  price: number;
  planId: string;
}

interface PricingPlan {
  name: string;
  icon: React.ElementType;
  mainPrice: number;
  mainQuantity: number;
  description: string;
  options: PricingOption[];
  mainPlanId: string;
  features: string[];
  popular: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    name: "Start",
    icon: Star,
    mainPrice: 30,
    mainQuantity: 10,
    description: "Perfeito para começar",
    options: [
      { quantity: 20, price: 60, planId: "start_20" },
      { quantity: 30, price: 90, planId: "start_30" },
    ],
    mainPlanId: "start_10",
    features: ["Ideal para testes"],
    popular: false,
  },
  {
    name: "Pro",
    icon: Crown,
    mainPrice: 120,
    mainQuantity: 40,
    description: "Para criadores sérios",
    options: [
      { quantity: 50, price: 150, planId: "pro_50" },
      { quantity: 100, price: 300, planId: "pro_100" },
    ],
    mainPlanId: "pro_40",
    features: ["Melhor custo-benefício"],
    popular: true,
  },
  {
    name: "Creator",
    icon: Zap,
    mainPrice: 750,
    mainQuantity: 250,
    description: "Para profissionais",
    options: [
      { quantity: 500, price: 1500, planId: "creator_500" },
      { quantity: 1000, price: 3000, planId: "creator_1000" },
    ],
    mainPlanId: "creator_250",
    features: ["Escala profissional"],
    popular: false,
  },
];

export const PurchaseCreditsModal = ({ open, onOpenChange }: PurchaseCreditsModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const handlePurchase = async (planId: string) => {
    if (planId === "contact") {
      window.open("mailto:contato@synergyia.com.br?subject=Pacote%20Personalizado", "_blank");
      return;
    }

    setIsLoading(true);
    setLoadingPlanId(planId);

    try {
      const { data, error } = await supabase.functions.invoke("create-anonymous-checkout", {
        body: { planId },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não recebida");
      }
    } catch (error) {
      console.error("Erro ao criar checkout:", error);
      toast.error("Não foi possível iniciar o checkout. Tente novamente.");
    } finally {
      setIsLoading(false);
      setLoadingPlanId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-4">
          <DialogTitle className="text-2xl font-bold">Seus créditos acabaram!</DialogTitle>
          <DialogDescription className="text-base">
            Escolha um pacote para continuar criando imagens e vídeos incríveis
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pricingPlans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={cn(
                  "relative rounded-xl border p-5 flex flex-col",
                  plan.popular 
                    ? "border-primary bg-primary/5 shadow-lg scale-[1.02]" 
                    : "border-border bg-card"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Mais Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn(
                    "h-5 w-5",
                    plan.popular ? "text-primary" : "text-muted-foreground"
                  )} />
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                {/* Preço principal */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black">R$ {plan.mainPrice}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.mainQuantity} créditos
                  </p>
                </div>

                {/* Features */}
                <div className="flex-1 mb-4">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Botão principal */}
                <Button
                  onClick={() => handlePurchase(plan.mainPlanId)}
                  disabled={isLoading}
                  variant={plan.popular ? "default" : "outline"}
                  className="w-full mb-3"
                >
                  {loadingPlanId === plan.mainPlanId ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Comprar {plan.mainQuantity} créditos
                </Button>

                {/* Opções alternativas */}
                {plan.options.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Outras opções:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {plan.options.map((option) => (
                        <Button
                          key={option.planId}
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePurchase(option.planId)}
                          disabled={isLoading}
                          className="text-xs h-7 px-2"
                        >
                          {loadingPlanId === option.planId ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          {typeof option.quantity === 'number' 
                            ? `${option.quantity} por R$${option.price}`
                            : option.quantity
                          }
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          1 crédito = 1 imagem. Vídeos: de 2/crédito (MiniMax) até 4 créditos (Sora 2 Pro). Pagamento seguro via Stripe.
        </p>
      </DialogContent>
    </Dialog>
  );
};
