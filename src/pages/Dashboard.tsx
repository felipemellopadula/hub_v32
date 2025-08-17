import { useNavigate, Link } from "react-router-dom";
import { MessageCircle, Video, Image, Languages, PenTool, FileAudio, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfile } from "@/components/UserProfile";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const features = [
    {
      id: 'chat',
      icon: MessageCircle,
      title: 'Chat',
      description: 'Converse com IA avançada',
      color: 'bg-blue-500',
      available: true,
      onClick: () => navigate('/chat')
    },
    {
      id: 'video',
      icon: Video,
      title: 'Vídeo',
      description: 'Geração de vídeos',
      color: 'bg-purple-500',
      available: true,
      onClick: () => navigate('/video')
    },
    {
      id: 'image',
      icon: Image,
      title: 'Imagem',
      description: 'Criação de imagens',
      color: 'bg-green-500',
      available: true,
      onClick: () => navigate('/image')
    },
    {
      id: 'translator',
      icon: Languages,
      title: 'Tradutor / Humanizar',
      description: 'Tradução e humanização de texto',
      color: 'bg-orange-500',
      available: true,
      onClick: () => navigate('/translator')
    },
    {
      id: 'write',
      icon: PenTool,
      title: 'Escrever',
      description: 'Criação de textos e conteúdo',
      color: 'bg-indigo-500',
      available: true,
      onClick: () => navigate('/write')
    },
    {
      id: 'transcribe',
      icon: FileAudio,
      title: 'Transcrever',
      description: 'Converta áudios em texto com IA',
      color: 'bg-red-500',
      available: true,
      onClick: () => navigate('/transcribe')
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link to="/" aria-label="Voltar para a página inicial" className="flex items-center gap-2">
              <h1 className="sr-only">Synergy AI</h1>
              <img
                src="/lovable-uploads/c26d1b3b-b8c2-4bbf-9902-d76ebe9534f5.png"
                alt="Synergy AI logo escuro"
                className="logo-dark-theme h-8 w-auto"
              />
              <img
                src="/lovable-uploads/95128e47-ede1-4ceb-a2f2-4d0c2ed4eb80.png"
                alt="Synergy AI logo branco"
                className="logo-light-theme h-8 w-auto"
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <UserProfile />
            <ThemeToggle />
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

      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Bem-vindo ao <span className="text-primary">Synergy AI</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Escolha uma das funcionalidades abaixo para começar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={feature.id}
                className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                  !feature.available ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={feature.available ? feature.onClick : undefined}
              >
                <CardContent className="p-8 text-center">
                  <div className={`w-16 h-16 rounded-full ${feature.color} flex items-center justify-center mx-auto mb-4`}>
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