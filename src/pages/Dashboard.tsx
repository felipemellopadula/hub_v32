import { useNavigate, Link } from "react-router-dom";
import { useEffect, Suspense, lazy, useState } from "react";
import {
  MessageCircle,
  Video,
  Image,
  Languages,
  PenTool,
  FileAudio,
  LogOut,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { WelcomeModal } from "@/components/WelcomeModal";
import { supabase } from "@/integrations/supabase/client";

// Lazy load UserProfile to improve initial render
const UserProfile = lazy(() => import("@/components/UserProfile"));

const Dashboard = () => {
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    document.title = "Synergy Ai Hub";
  }, []);

  // Check if user should see welcome modal - sempre mostrar para usuários free
  useEffect(() => {
    if (profile && profile.subscription_type === 'free') {
      setShowWelcomeModal(true);
    }
  }, [profile]);

  // Render immediately, auth check is handled by ProtectedRoute
  // No need to wait for user data to render the UI

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      navigate('/', { replace: true });
    }
  };

  const features = [
    {
      id: "chat",
      icon: MessageCircle,
      title: "Chat",
      description: "Converse com IA avançada",
      color: "bg-blue-500",
      available: true,
      onClick: () => navigate("/chat"),
    },
    {
      id: "video",
      icon: Video,
      title: "Vídeo",
      description: "Geração de vídeos",
      color: "bg-purple-500",
      available: true,
      onClick: () => navigate("/video"),
    },
    {
      id: "image",
      icon: Image,
      title: "Imagem",
      description: "Criação de imagens",
      color: "bg-green-500",
      available: true,
      onClick: () => navigate("/image2"),
    },
    {
      id: "translator",
      icon: Languages,
      title: "Tradutor / Humanizar",
      description: "Tradução e humanização de texto",
      color: "bg-orange-500",
      available: true,
      onClick: () => navigate("/translator"),
    },
    {
      id: "write",
      icon: PenTool,
      title: "Escrever",
      description: "Criação de textos e conteúdo",
      color: "bg-indigo-500",
      available: true,
      onClick: () => navigate("/write"),
    },
    {
      id: "transcribe",
      icon: FileAudio,
      title: "Transcrever",
      description: "Converta áudios em texto com IA",
      color: "bg-red-500",
      available: true,
      onClick: () => navigate("/transcribe"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        userName={profile?.name || "Usuário"}
      />

      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              aria-label="Voltar para a página inicial"
              className="flex items-center gap-2"
            >
              <h1 className="sr-only">Synergy AI</h1>

              {/* Logo para tema CLARO (mostra no light) */}
              <img
                src="/synergy-uploads/5e06d662-7533-4ca8-a35e-3167dc0f31e6.png"
                alt="Synergy AI logo escuro"
                className="h-8 w-auto block dark:hidden"
                width="32"
                height="32"
                loading="lazy"
                decoding="async"
              />
              {/* Logo para tema ESCURO (mostra no dark) */}
              <img
                src="/synergy-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
                alt="Synergy AI logo branco"
                className="h-8 w-auto hidden dark:block"
                width="32"
                height="32"
                loading="lazy"
                decoding="async"
              />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Suspense fallback={<div className="w-8 h-8 animate-pulse bg-muted rounded-full" />}>
              <UserProfile />
            </Suspense>
            
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Bem-vindo ao <span className="text-primary">Synergy AI</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            const disabled = !feature.available;
            return (
              <Card
                key={feature.id}
                className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                  disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={disabled ? undefined : feature.onClick}
              >
                <CardContent className="p-8 text-center">
                  <div
                    className={`w-16 h-16 rounded-full ${feature.color} flex items-center justify-center mx-auto mb-4`}
                  >
                    <Icon className="h-8 w-8 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {feature.title}
                  </h3>

                  <p className="text-muted-foreground mb-4">
                    {feature.description}
                  </p>

                  {!feature.available && (
                    <span className="inline-block bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                      Em breve
                    </span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
