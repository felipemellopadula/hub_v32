import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crown, Zap, Star, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const pricingPlans = [
  {
    name: "Start",
    icon: Star,
    price: "R$40",
    period: "/mês",
    buttonVariant: "outline" as const,
    features: [
      "100 créditos de geração",
      "Acesso ao modelo Gemini Flash",
      "Licença de uso pessoal",
    ],
  },
  {
    name: "Pro",
    icon: Zap,
    price: "R$200",
    period: "/mês",
    buttonVariant: "default" as const,
    popular: true,
    features: [
      "Créditos ilimitados (Standard)",
      "500 créditos rápidos",
      "Licença Comercial",
    ],
  },
  {
    name: "Creator",
    icon: Crown,
    price: "R$500",
    period: "/mês",
    buttonVariant: "outline" as const,
    features: [
      "Tudo ilimitado",
      "API Access dedicado",
      "Gerente de conta",
    ],
  },
];

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireSubscription = true }) => {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const handleCloseAuthModal = () => {
    navigate('/', { replace: true });
  };

  // Timeout de fallback para evitar loading infinito
  useEffect(() => {
    if (loading || profileLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading, profileLoading]);

  // Show loading spinner while checking auth or loading profile (max 3s)
  if ((loading || profileLoading) && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, show auth modal overlay
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <AuthModal isOpen={true} onClose={handleCloseAuthModal} />
        <div className="text-center mt-4">
          <p className="text-muted-foreground">
            Você precisa estar logado para acessar esta página.
          </p>
          <Button 
            variant="link" 
            onClick={() => window.location.href = '/'}
            className="mt-2"
          >
            Voltar para a página inicial
          </Button>
        </div>
      </div>
    );
  }

  // Check subscription requirement
  console.log("🛡️ ProtectedRoute render:", { loading, hasUser: !!user, profileType: profile?.subscription_type });
  
  if (requireSubscription) {
    // Profile já deve estar carregado neste ponto devido ao check de profileLoading acima
  // Aceitar todos os tipos válidos de assinatura premium
  const validSubscriptionTypes = ['paid', 'admin', 'basic', 'plus', 'pro'];
  const hasActiveSubscription = validSubscriptionTypes.includes(profile?.subscription_type || '');
    
    if (!hasActiveSubscription) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <div className="max-w-4xl w-full">
            <div className="text-center mb-8">
              <Crown className="w-16 h-16 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Assine um Plano
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Para acessar as ferramentas de geração de imagens e vídeos, você precisa ter uma assinatura ativa.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {pricingPlans.map((plan, index) => (
                <Card 
                  key={index}
                  className={`relative p-6 ${
                    plan.popular 
                      ? "border-2 border-primary bg-card" 
                      : "border border-border bg-card/50"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">RECOMENDADO</Badge>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <plan.icon className={`w-5 h-5 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  
                  <Button 
                    variant={plan.buttonVariant}
                    className={`w-full mb-4 ${plan.popular ? "bg-primary hover:bg-primary/90" : ""}`}
                    onClick={() => window.location.href = '/#pricing'}
                  >
                    Assinar
                  </Button>
                  
                  <ul className="space-y-2">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            <div className="text-center">
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/'}
              >
                Voltar para a página inicial
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;