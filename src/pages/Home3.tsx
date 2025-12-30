import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import seedanceVideo from "@/assets/videos/seedance-hero.mp4";
import { LazyVideo } from "@/components/LazyVideo";
import { ContactForm } from "@/components/ContactForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Menu,
  X,
  ChevronDown,
  Play,
  Sparkles,
  Gift,
  ArrowRight,
  User,
  LogOut,
  LayoutDashboard,
  Settings,
  Check,
  Crown,
  Star,
  Zap,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";

// Types
interface NavItem {
  label: string;
  href: string;
  isNew?: boolean;
}

interface ToolCard {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  video?: string;
  animated?: boolean;
  speed?: number;
  isNew?: boolean;
  isPro?: boolean;
  path: string;
}

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  videoUrl?: string;
  images?: string[];
  ctaText: string;
  path: string;
}

// Navigation items
const navItems: NavItem[] = [
  { label: "Imagem", href: "/image2" },
  { label: "Vídeo", href: "/video" },
  { label: "Editar", href: "/image-editor" },
  { label: "Personagem", href: "/ai-avatar" },
  { label: "Inpaint", href: "/inpaint" },
  { label: "Preços", href: "#pricing" },
  { label: "Contato", href: "#contact" },
];

// Hero slides - seedanceVideo is imported at top of file
const heroSlides: HeroSlide[] = [
  {
    id: "1",
    title: "SEEDANCE 1.5 PRO",
    subtitle: "Narrativas Multi-shot com Áudio",
    videoUrl: seedanceVideo,
    ctaText: "Experimentar",
    path: "/video",
  },
  {
    id: "2",
    title: "MOTION CONTROL 2.6",
    subtitle: "Controle preciso de movimento",
    imageUrl: "",
    videoUrl: "https://videos.pexels.com/video-files/2795730/2795730-uhd_2560_1440_25fps.mp4",
    ctaText: "Animar",
    path: "/video?model=klingai:kling-video@2.6-pro",
  },
  {
    id: "3",
    title: "INPAINT",
    subtitle: "Pinte diretamente na imagem e edite suas imagens de forma intuitiva",
    imageUrl:
      "https://images.pexels.com/photos/29645160/pexels-photo-29645160/free-photo-of-caneta-para-tablet-grafico-ferramenta-de-design-tinta-escrita-nota-estudio-interior.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
    ctaText: "Editar",
    path: "/inpaint",
  },
  {
    id: "4",
    title: "NANO BANANA",
    subtitle: "Geração Ultra Rápida",
    images: ["/images/banana-1.png", "/images/banana-2.png", "/images/banana-3.png", "/images/banana-4.png"],
    ctaText: "Gerar",
    path: "/image2",
  },
];

// Tools data
const tools: ToolCard[] = [
  {
    id: "1",
    title: "Criar Imagem",
    description: "Texto para imagem",
    images: [
      "/images/criar-imagem-1.png",
      "/images/criar-imagem-2.png",
      "/images/criar-imagem-3.png",
      "/images/criar-imagem-4.png",
      "/images/criar-imagem-5.jpeg",
    ],
    animated: true,
    speed: 600,
    path: "/image2",
  },
  {
    id: "2",
    title: "Criar Vídeo",
    description: "Texto/Imagem para vídeo",
    video: "https://videos.pexels.com/video-files/4309834/4309834-uhd_2560_1440_24fps.mp4",
    path: "/video",
  },
  {
    id: "3",
    title: "Editar Imagem",
    description: "Inpaint & Outpaint",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop",
    path: "/image-editor",
  },
  {
    id: "4",
    title: "Inpaint",
    description: "Edição precisa",
    imageUrl:
      "https://images.pexels.com/photos/29645160/pexels-photo-29645160/free-photo-of-caneta-para-tablet-grafico-ferramenta-de-design-tinta-escrita-nota-estudio-interior.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=1",
    path: "/inpaint",
  },
  {
    id: "5",
    title: "Upscale",
    description: "Até 4K de resolução",
    imageUrl: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=400&fit=crop",
    path: "/upscale",
  },
  {
    id: "6",
    title: "Nano Banana Pro",
    description: "Modelo exclusivo",
    images: ["/images/banana-1.png", "/images/banana-2.png", "/images/banana-3.png", "/images/banana-4.png"],
    animated: true,
    speed: 400,
    isPro: true,
    path: "/image2",
  },
  {
    id: "7",
    title: "Skin Enhancer",
    description: "Melhore a pele",
    imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&h=400&fit=crop",
    path: "/skin-enhancer",
  },
  {
    id: "8",
    title: "AI Avatar",
    description: "Crie seu avatar",
    images: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=400&fit=crop",
    ],
    animated: true,
    speed: 1500,
    isNew: true,
    path: "/ai-avatar",
  },
];

// Pricing plans mapped to stripe_products table
const pricingPlans = [
  {
    name: "Start",
    monthlyPrice: 1,
    annualPrice: 1,
    description: "Perfeito para começar",
    icon: Star,
    features: ["1.000 tokens/mês", "Modelos básicos de imagem", "Geração de vídeo limitada", "Suporte por email"],
    monthlyPlanId: "basic_monthly",
    annualPlanId: "basic_annual",
    popular: false,
  },
  {
    name: "Pro",
    monthlyPrice: 1,
    annualPrice: 1,
    description: "Para criadores sérios",
    icon: Crown,
    features: [
      "5.000 tokens/mês",
      "Todos os modelos de imagem",
      "Vídeos em alta qualidade",
      "Skin Enhancer & Upscale",
      "Suporte prioritário",
    ],
    monthlyPlanId: "pro_monthly",
    annualPlanId: "pro_annual",
    popular: true,
  },
  {
    name: "Creator",
    monthlyPrice: 1,
    annualPrice: 1,
    description: "Para profissionais",
    icon: Zap,
    features: [
      "15.000 tokens/mês",
      "Acesso ilimitado a modelos",
      "Vídeos 4K",
      "API access",
      "Suporte 24/7",
      "Early access a novos recursos",
    ],
    monthlyPlanId: "pro_monthly",
    annualPlanId: "pro_annual",
    popular: false,
  },
];

// Animated Tool Card Component
const AnimatedToolCardContent: React.FC<{
  tool: ToolCard;
}> = ({ tool }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!tool.animated || !tool.images) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tool.images!.length);
    }, tool.speed || 1000);

    return () => clearInterval(interval);
  }, [tool.animated, tool.images, tool.speed]);

  if (tool.video) {
    return (
      <video
        ref={videoRef}
        src={tool.video}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  if (tool.animated && tool.images) {
    return (
      <div className="relative w-full h-full">
        {tool.images.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt={tool.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              idx === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <img
      src={tool.imageUrl}
      alt={tool.title}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
};

// Animated Hero Slide Content Component
const AnimatedHeroSlideContent: React.FC<{
  slide: HeroSlide;
}> = ({ slide }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!slide.images || slide.images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slide.images!.length);
    }, 400); // Same speed as Nano Banana Pro card

    return () => clearInterval(interval);
  }, [slide.images]);

  if (slide.videoUrl) {
    return (
      <LazyVideo
        src={slide.videoUrl}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
    );
  }

  if (slide.images && slide.images.length > 0) {
    return (
      <div className="absolute inset-0 w-full h-full">
        {slide.images.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt={slide.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              idx === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <img
      src={slide.imageUrl}
      alt={slide.title}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
    />
  );
};

const Home3: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);

  // Usuários autenticados podem ver a Home3 normalmente
  // O header mostra opção de ir ao Dashboard quando logado

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const openLogin = () => {
    setAuthMode("login");
    setShowAuthModal(true);
  };

  const openSignup = () => {
    setAuthMode("signup");
    setShowAuthModal(true);
  };

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      setMobileMenuOpen(false);
    } else if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
    }
  };

  const handleToolClick = (path: string, e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
    } else {
      navigate(path);
    }
  };

  const [isSubscribing, setIsSubscribing] = useState(false);

  const handlePricingClick = async (planId: string) => {
    // Não precisa mais verificar se o usuário está logado
    // O checkout anônimo permite pagamento primeiro, cadastro depois
    
    setIsSubscribing(true);
    try {
      console.log("[Home3] Iniciando checkout anônimo para:", planId);

      // Usar a nova função pública que não requer autenticação
      const { data, error } = await supabase.functions.invoke("create-anonymous-checkout", {
        body: { planId },
      });

      console.log("[Home3] Resposta recebida:", { data, error });

      if (error) {
        console.error("[Home3] Erro da função:", error);
        throw error;
      }

      if (data?.url) {
        console.log("[Home3] Redirecionando para Stripe:", data.url);
        // Abrir na mesma aba para melhor experiência
        window.location.href = data.url;
      } else {
        console.error("[Home3] URL não recebida:", data);
        throw new Error("URL de checkout não recebida");
      }
    } catch (error) {
      console.error("[Home3] Erro ao criar checkout:", error);
      setIsSubscribing(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o checkout. Tente novamente.");
    }
  };

  const scrollToPricing = () => {
    const element = document.querySelector("#pricing");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          isScrolled ? "bg-background/90 backdrop-blur-md border-border py-3" : "bg-transparent border-transparent py-5"
        }`}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Left Side: Logo & Links */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group">
                <img
                  src="/synergy-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
                  alt="Synergy AI"
                  className="h-8 w-auto"
                />
              </Link>

              <div className="hidden xl:flex items-center gap-6">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => handleNavClick(item.href, e)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group py-2"
                  >
                    {item.label}
                    {item.isNew && (
                      <span className="absolute -top-1 -right-6 text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm uppercase">
                        New
                      </span>
                    )}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
                  </a>
                ))}
              </div>
            </div>

            {/* Right Side: Actions */}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.user_metadata?.avatar_url} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate("/dashboard-novo")}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="ghost" onClick={openLogin}>
                    Entrar
                  </Button>
                  <Button onClick={openSignup}>CRIAR CONTA</Button>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button className="xl:hidden text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden absolute top-full left-0 w-full bg-background border-b border-border py-4 px-4 flex flex-col gap-4 shadow-2xl">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(item.href, e)}
                className="text-lg font-medium text-muted-foreground hover:text-foreground flex items-center justify-between"
              >
                {item.label}
                {item.isNew && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm uppercase">
                    New
                  </span>
                )}
              </a>
            ))}
            <div className="h-px bg-border my-2"></div>
            {user ? (
              <>
                <button
                  onClick={() => navigate("/dashboard-novo")}
                  className="w-full text-left py-2 text-muted-foreground"
                >
                  Dashboard
                </button>
                <button onClick={handleLogout} className="w-full text-left py-2 text-muted-foreground">
                  Sair
                </button>
              </>
            ) : (
              <>
                <button onClick={openLogin} className="w-full text-left py-2 text-muted-foreground">
                  Entrar
                </button>
                <button onClick={openSignup} className="w-full text-left py-2 text-primary font-semibold">
                  Criar Conta
                </button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="pt-24 pb-8 overflow-hidden">
        <div className="w-full overflow-x-auto hide-scrollbar">
          <div className="flex gap-4 pb-4 px-4 sm:px-6 lg:px-8 snap-x snap-mandatory" style={{ width: "max-content" }}>
            {heroSlides.map((slide) => (
              <div
                key={slide.id}
                onClick={(e) => handleToolClick(slide.path, e)}
                className="snap-center shrink-0 w-[80vw] md:w-[550px] lg:w-[650px] h-[280px] md:h-[380px] relative rounded-2xl overflow-hidden group cursor-pointer border border-border hover:border-primary/50 transition-colors"
              >
                <AnimatedHeroSlideContent slide={slide} />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />

                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="text-primary w-4 h-4" />
                    <span className="text-primary text-xs font-bold tracking-widest uppercase">Destaque</span>
                  </div>

                  <h2 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter mb-2">
                    {slide.title}
                  </h2>

                  <p className="text-gray-300 text-sm md:text-base mb-6 max-w-md">{slide.subtitle}</p>

                  <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                    {slide.ctaText}
                    <Play size={14} fill="currentColor" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promo Banner */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div
          onClick={scrollToPricing}
          className="w-full relative overflow-hidden rounded-2xl my-8 group cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-yellow-500">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            ></div>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between px-8 py-6 md:py-10 gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-amber-800 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                  Oferta Limitada
                </span>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
                Desbloqueie o Synergy Pro
              </h2>
              <p className="text-yellow-100 text-sm md:text-base max-w-xl">
                Tenha acesso a gerações ilimitadas, modelos exclusivos (Nano Banana Pro) e renderização 4K rápida.
                Oferta termina em breve.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:block w-24 h-24 relative">
                <Gift
                  size={80}
                  className="text-primary drop-shadow-lg transform -rotate-12 group-hover:rotate-0 transition-transform duration-300"
                />
              </div>
              <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-transform hover:scale-105 shadow-xl shadow-black/20">
                Assinar Agora
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-none mb-2">
            O que você vai <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500">
              criar hoje?
            </span>
          </h2>
          <p className="text-muted-foreground mt-2 max-w-lg">
            Crie imagens autênticas e vídeos com texturas naturais e estilo fácil.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {tools.map((tool) => (
            <div
              key={tool.id}
              onClick={(e) => handleToolClick(tool.path, e)}
              className="group relative bg-card rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 border border-border hover:border-primary/50"
            >
              <div className="aspect-square overflow-hidden relative">
                <AnimatedToolCardContent tool={tool} />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />

                <div className="absolute top-3 left-3 flex gap-2">
                  {tool.isNew && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase">
                      Novo
                    </span>
                  )}
                  {tool.isPro && (
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase">
                      Pro
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 flex items-center justify-between bg-muted/50 border-t border-border group-hover:bg-muted">
                <div className="flex flex-col">
                  <h3 className="text-foreground font-bold text-sm md:text-base leading-tight group-hover:text-primary transition-colors">
                    {tool.title}
                  </h3>
                  {tool.description && <span className="text-xs text-muted-foreground mt-1">{tool.description}</span>}
                </div>
                <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all transform group-hover:rotate-[-45deg]">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Section */}
      <section id="pricing" className="scroll-mt-20 py-20 bg-muted/30">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
              Escolha seu{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500">Plano</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comece gratuitamente e evolua conforme suas necessidades. Cancele quando quiser.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center gap-2 mb-10">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all ${
                !isAnnual
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all ${
                isAnnual
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Anual
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => {
              const IconComponent = plan.icon;
              const currentPrice = isAnnual ? plan.annualPrice : plan.monthlyPrice;
              const currentPlanId = isAnnual ? plan.annualPlanId : plan.monthlyPlanId;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-6 border transition-all duration-300 hover:shadow-xl ${
                    plan.popular
                      ? "border-primary bg-card shadow-lg scale-105"
                      : "border-border bg-card/50 hover:border-primary/50"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase">
                        Mais Popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        plan.popular ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <IconComponent size={20} />
                    </div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>

                  <div className="mb-4">
                    <span className="text-4xl font-black">R$ {currentPrice}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>

                  <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check size={16} className="text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handlePricingClick(currentPlanId)}
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? "Processando..." : "Começar Agora"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="scroll-mt-20 py-20">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
              Entre em{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500">Contato</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tem alguma dúvida? Fale conosco e responderemos o mais rápido possível.
            </p>
          </div>

          <div className="max-w-xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20 bg-background py-12">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/synergy-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
                  alt="Synergy AI"
                  className="h-8 w-auto"
                />
              </div>
              <p className="text-muted-foreground text-sm max-w-sm">
                Potencializando a criatividade humana com inteligência artificial avançada. Crie vídeos, imagens e
                histórias sem limites.
              </p>

              {/* Social Icons */}
              <div className="flex gap-3 mt-4">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-muted/50 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-muted/50 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href="https://tiktok.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-muted/50 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-muted/50 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-primary transition-colors">
                    Preços
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Showcase
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Comunidade</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Discord
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Twitter / X
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-primary transition-colors">
                    Ajuda
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
            <p>© 2026 Synergy IA Hub. Todos os direitos reservados.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacidade
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Termos
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default Home3;
