import { useState, useEffect } from "react";
import { LazyVideo } from "@/components/LazyVideo";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Star, ArrowRight, LogOut, User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { supabase } from "@/integrations/supabase/client";
import LogoLoop from "@/components/LogoLoop";
import { AnimatedToolCard } from "@/components/AnimatedToolCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const aiLogos = [
  { src: "/images/logos/google.svg", alt: "Google", title: "Google" },
  { src: "/images/logos/openai.svg", alt: "OpenAI", title: "OpenAI" },
  { src: "/images/logos/kling.png", alt: "Kling AI", title: "Kling AI" },
  { src: "/images/logos/bytedance-blue.png", alt: "ByteDance", title: "ByteDance" },
];

interface PublicImage {
  id: string;
  image_path: string;
  prompt: string | null;
  created_at: string;
}

// Sample video URLs for hero cards - using Pexels CDN (reliable)
const heroCards = [
  {
    video: "https://videos.pexels.com/video-files/3129671/3129671-sd_640_360_30fps.mp4",
    title: "PROMOÇÃO DE LANÇAMENTO",
    description: "Até 60% off em todos os planos de +1 ano de gerações ilimitadas",
    badge: "-60% OFF",
    badgeColor: "bg-red-500",
    href: "#pricing",
  },
  {
    video: "https://videos.pexels.com/video-files/856045/856045-sd_640_360_30fps.mp4",
    title: "INPAINT",
    description: "Pincel para editar áreas específicas ou transformar imagens inteiras",
    badge: "NANO BANANA",
    badgeColor: "bg-primary",
    path: "/inpaint",
  },
  {
    video: "https://videos.pexels.com/video-files/3141207/3141207-sd_640_360_25fps.mp4",
    title: "SHOTS",
    description: "Uma imagem se torna 9 shots. Escolha e melhore seus favoritos",
    badge: null,
    badgeColor: "",
    path: "/image2",
  },
  {
    video: "https://videos.pexels.com/video-files/3195394/3195394-sd_640_360_25fps.mp4",
    title: "SKIN ENHANCER",
    description: "Transforme pele artificial em textura natural e realista",
    badge: "INTRODUZINDO",
    badgeColor: "bg-primary",
    path: "/skin-enhancer",
  },
];

const tools = [
  {
    name: "CRIAR IMAGEM",
    images: [
      "/images/criar-imagem-1.png",
      "/images/criar-imagem-2.png",
      "/images/criar-imagem-3.png",
      "/images/criar-imagem-4.png",
      "/images/criar-imagem-5.jpeg",
    ],
    animated: true,
    speed: 400,
    path: "/image2",
  },
  {
    name: "CRIAR VÍDEO",
    image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=300&h=400&fit=crop",
    hasArrow: true,
    path: "/video",
  },
  {
    name: "IMAGE EDITOR",
    images: [
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=400&fit=crop",
    ],
    animated: true,
    speed: 1200,
    path: "/image-editor",
  },
  {
    name: "SKIN ENHANCER",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&h=400&fit=crop",
    path: "/skin-enhancer",
  },
  {
    name: "UPSCALE 4K",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=400&fit=crop",
    path: "/upscale",
  },
  {
    name: "AVATAR IA",
    images: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=400&fit=crop",
    ],
    animated: true,
    speed: 1500,
    path: "/ai-avatar",
  },
];

// Fallback estático caso não haja imagens públicas
const fallbackCreations = [
  { image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=500&fit=crop" },
  { image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=600&fit=crop" },
  { image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&h=400&fit=crop" },
  { image: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=400&h=500&fit=crop" },
  { image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=500&fit=crop" },
];

const pricingPlans = [
  {
    name: "Start",
    icon: Star,
    description: "Para começar sua jornada com qualidade profissional.",
    price: "R$40",
    period: "/mês",
    buttonText: "Começar Agora",
    buttonVariant: "outline" as const,
    features: ["100 créditos de geração", "Acesso ao modelo Gemini Flash", "Licença de uso pessoal", "Upscale HD"],
  },
  {
    name: "Pro",
    icon: Zap,
    description: "Para criadores que precisam de mais poder e velocidade.",
    price: "R$200",
    period: "/mês",
    buttonText: "Assinar Agora",
    buttonVariant: "default" as const,
    popular: true,
    features: [
      "Créditos de geração ilimitados (Standard)",
      "500 créditos rápidos",
      "Acesso ao Veo Video Gen",
      "Licença Comercial",
      "Sem marca d'água",
      "Fila prioritária",
    ],
  },
  {
    name: "Creator",
    icon: Crown,
    description: "Poder máximo para agências e profissionais de elite.",
    price: "R$500",
    period: "/mês",
    buttonText: "Contatar Vendas",
    buttonVariant: "outline" as const,
    features: [
      "Tudo ilimitado",
      "Acesso antecipado a novos modelos",
      "Treinamento de modelo personalizado (LoRA)",
      "API Access dedicado",
      "Gerente de conta exclusivo",
      "Sessões de mentoria mensal",
    ],
  },
];

const Home2 = () => {
  const [activeTab, setActiveTab] = useState<"recent" | "popular">("recent");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [publicImages, setPublicImages] = useState<PublicImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Carregar imagens públicas
  useEffect(() => {
    const loadPublicImages = async () => {
      try {
        const { data, error } = await supabase
          .from("user_images")
          .select("id, image_path, prompt, created_at")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(12);

        if (error) throw error;
        setPublicImages(data || []);
      } catch (error) {
        console.error("Erro ao carregar imagens públicas:", error);
      } finally {
        setIsLoadingImages(false);
      }
    };

    loadPublicImages();
  }, []);

  const getImageUrl = (imagePath: string) => {
    const { data } = supabase.storage.from("images").getPublicUrl(imagePath);
    return data.publicUrl;
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/lovable-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
                alt="Synergy AI"
                className="h-7 w-auto"
              />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/image2"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Imagem
              </Link>
              <Link
                to="/video"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Vídeo
              </Link>
              <Link
                to="/image2"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Editar
              </Link>
              <Link
                to="/chat"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Personagens
              </Link>
              <a
                href="#pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Preços
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="text-xs">
                        {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline">{profile?.name || "Usuário"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/dashboard-novo")}>
                    <User className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>Configurações</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsAuthModalOpen(true)}>
                  Entrar
                </Button>
                <Button size="sm" onClick={() => setIsAuthModalOpen(true)}>
                  CRIAR CONTA
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - 4 Video Cards */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {heroCards.map((card, index) => {
            const handleClick = () => {
              if (card.href) {
                const element = document.querySelector(card.href);
                element?.scrollIntoView({ behavior: "smooth" });
              } else if (card.path) {
                navigate(card.path);
              }
            };

            return (
              <div
                key={index}
                onClick={handleClick}
                className="relative rounded-xl overflow-hidden aspect-[4/3] group cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
              >
                <LazyVideo src={card.video} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Badge */}
                {card.badge && (
                  <div className="absolute top-4 right-4">
                    <Badge className={`${card.badgeColor} text-white font-semibold`}>{card.badge}</Badge>
                  </div>
                )}

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-lg font-bold text-white mb-1">{card.title}</h3>
                  <p className="text-sm text-white/80">{card.description}</p>
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* What Will You Create Section */}
      <section className="bg-card/30 border-y border-border/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* Left side - Text */}
            <div className="flex-shrink-0 lg:w-[280px]">
              <h2 className="text-2xl md:text-3xl font-bold italic leading-tight">
                O QUE VOCÊ VAI
                <br />
                <span className="text-primary">CRIAR HOJE?</span>
              </h2>
              <p className="text-muted-foreground text-sm mt-3">
                Crie imagens e vídeos autênticos com textura natural e estilo fácil
              </p>
            </div>

            {/* Right side - Tool cards */}
            <div className="flex-1 overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-max">
                {tools.map((tool, index) => (
                  <AnimatedToolCard key={index} tool={tool} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof with Logo Loop */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 text-center mb-6">
          <p className="text-muted-foreground text-sm uppercase tracking-widest">
            CONFIADO POR 700.000 EQUIPES CRIATIVAS
          </p>
        </div>
        <div className="h-[60px] relative overflow-hidden">
          <LogoLoop
            logos={aiLogos}
            speed={60}
            direction="left"
            logoHeight={32}
            gap={80}
            hoverSpeed={0}
            scaleOnHover
            fadeOut
            ariaLabel="AI technology partners"
          />
        </div>
      </section>

      {/* Recent Creations Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Criações Recentes</h2>
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "recent" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("recent")}
            >
              Mais recentes
            </Button>
            <Button
              variant={activeTab === "popular" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("popular")}
            >
              Populares
            </Button>
          </div>
        </div>

        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {isLoadingImages ? (
            <div className="col-span-full flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : publicImages.length > 0 ? (
            publicImages.map((image) => (
              <div key={image.id} className="break-inside-avoid rounded-xl overflow-hidden cursor-pointer group">
                <img
                  src={getImageUrl(image.image_path)}
                  alt={image.prompt || "Criação pública"}
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))
          ) : (
            fallbackCreations.map((creation, index) => (
              <div key={index} className="break-inside-avoid rounded-xl overflow-hidden cursor-pointer group">
                <img
                  src={creation.image}
                  alt={`Creation ${index + 1}`}
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-16 scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Escolha seu poder criativo</h2>
          <p className="text-muted-foreground">
            Desbloqueie todo o potencial do Synergy AI com nossos planos flexíveis.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl p-6 ${
                plan.popular ? "border-2 border-primary bg-card" : "border border-border bg-card/50"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">MAIS POPULAR</Badge>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <plan.icon className={`w-5 h-5 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                <h3 className="text-xl font-semibold">{plan.name}</h3>
              </div>

              <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <Button
                variant={plan.buttonVariant}
                className={`w-full mb-6 ${plan.popular ? "bg-primary hover:bg-primary/90" : ""}`}
              >
                {plan.buttonText}
              </Button>

              <ul className="space-y-3">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <img src="/lovable-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png" alt="Synergy AI" className="h-8 w-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                A maior biblioteca do mundo de conteúdo gerado por IA. Descubra fotos, vídeos e vetores de alta
                qualidade criados por nossos modelos de ponta, incluindo Gemini e Veo.
              </p>
              <div className="flex gap-3 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-6 h-6 bg-muted rounded" />
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Conteúdo</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Novos ativos
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Mais populares
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Tendências de busca
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Informações</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Preços
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Sobre nós
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Carreiras
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Venda seu conteúdo
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Termos de uso
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Política de privacidade
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Política de cookies
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Copyright
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© 2026 Synergy IA. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Português (Brasil)</span>
              <span>BRL</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home2;
