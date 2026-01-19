import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
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
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import {
  Menu,
  X,
  ChevronDown,
  Play,
  Sparkles,
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
  poster?: string;
  priority?: boolean;
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

// Supabase CDN base URL
const SUPABASE_CDN = "https://myqgnnqltemfpzdxwybj.supabase.co/storage/v1/object/public/assets";

// Hero slides with CDN URLs and posters for fast loading
const heroSlides: HeroSlide[] = [
  {
    id: "1",
    title: "SEEDANCE 1.5 PRO",
    subtitle: "Narrativas Multi-shot com Áudio",
    videoUrl: `${SUPABASE_CDN}/1.5.mp4`,
    priority: true,
    ctaText: "Experimentar",
    path: "/video",
  },
  {
    id: "2",
    title: "MOTION CONTROL 2.6",
    subtitle: "Controle preciso de movimento",
    videoUrl: "https://videos.pexels.com/video-files/2795730/2795730-hd_1280_720_25fps.mp4",
    poster: `${SUPABASE_CDN}/posters/motion-control-poster.webp`,
    ctaText: "Animar",
    path: "/video?model=klingai:kling-video@2.6-pro",
  },
  {
    id: "3",
    title: "INPAINT",
    subtitle: "Pinte diretamente na imagem e edite suas imagens de forma intuitiva",
    imageUrl: "https://images.pexels.com/photos/29645160/pexels-photo-29645160/free-photo-of-caneta-para-tablet-grafico-ferramenta-de-design-tinta-escrita-nota-estudio-interior.jpeg?auto=compress&cs=tinysrgb&w=800",
    poster: `${SUPABASE_CDN}/posters/inpaint-poster.webp`,
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
    video: "https://videos.pexels.com/video-files/4309834/4309834-hd_1280_720_24fps.mp4",
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
    title: "Storyboard",
    description: "Crie projetos sequenciais",
    imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop",
    isNew: true,
    path: "/storyboard",
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

// Pricing plans - Package-based credit model
interface PricingOption {
  quantity: number | string;
  price: number | string;
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
    features: ["Ideal para testes e pequenos projetos"],
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
    description: "Para profissionais e empresas",
    options: [
      { quantity: 500, price: 1500, planId: "creator_500" },
      { quantity: 1000, price: 3000, planId: "creator_1000" },
      { quantity: "1000+", price: "Sob consulta", planId: "contact" },
    ],
    mainPlanId: "creator_250",
    features: ["Escala profissional"],
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
        poster={slide.poster}
        priority={slide.priority}
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
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

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
      setPendingPath(path);
      localStorage.setItem('pendingRedirectPath', path);
      setShowAuthModal(true);
    } else {
      navigate(path);
    }
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    setPendingPath(null);
    localStorage.removeItem('pendingRedirectPath');
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
                  src="/images/synergy-logo.webp"
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
                  <Button onClick={scrollToPricing}>Quero Fazer Parte</Button>
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
                <button onClick={scrollToPricing} className="w-full text-left py-2 text-primary font-semibold">
                  Quero Fazer Parte
                </button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Promo Banner - Now below header */}
      <div className="pt-24 pb-4">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div
            onClick={scrollToPricing}
            className="w-full relative overflow-hidden rounded-2xl cursor-pointer
                       bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500
                       p-6 sm:p-8 lg:p-10 hover:shadow-2xl hover:shadow-orange-500/30 
                       transition-all duration-300 group"
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-8">
              {/* Texto Principal */}
              <div className="text-center lg:text-left flex-1">
                <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-black leading-tight uppercase">
                  Cansado da IA que "desaprende" no segundo prompt?
                </h2>
                <p className="text-sm sm:text-base lg:text-lg text-black/80 mt-3 sm:mt-4 max-w-2xl">
                  É sempre igual: o primeiro resultado é incrível, o segundo é médio e o terceiro é horrível. 
                  Pare de lutar contra a ferramenta. Na Synergy IA, a qualidade é constante do primeiro ao último comando.
                </p>
              </div>
              
              {/* Botão CTA */}
              <button className="bg-black text-yellow-400 font-bold 
                                 px-6 py-3 sm:px-8 sm:py-4 lg:px-10 lg:py-5 
                                 rounded-xl text-base sm:text-lg lg:text-xl
                                 hover:bg-black/90 hover:scale-105
                                 transition-all duration-300 shadow-xl
                                 whitespace-nowrap group-hover:shadow-2xl">
                Quero consistência de verdade
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section with Swipeable Cards */}
      <div className="py-8 overflow-hidden relative">
        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4 px-4 sm:px-6 lg:px-8">
            {heroSlides.map((slide) => (
              <CarouselItem 
                key={slide.id}
                className="pl-4 basis-[80vw] md:basis-[550px] lg:basis-[650px]"
              >
                <div
                  onClick={(e) => handleToolClick(slide.path, e)}
                  className="w-full h-[280px] md:h-[380px] relative rounded-2xl overflow-hidden group cursor-pointer border border-border hover:border-primary/50 transition-colors"
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
              </CarouselItem>
            ))}
          </CarouselContent>
          
          {/* Navigation Buttons - Hidden on mobile (swipe only) */}
          <CarouselPrevious className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12" />
          <CarouselNext className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12" />
        </Carousel>
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
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500">Pacote</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Compre créditos para criar imagens e vídeos incríveis com IA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => {
              const IconComponent = plan.icon;
              const selectedPlanId = selectedOptions[plan.name] || plan.mainPlanId;
              const selectedOption = plan.options.find(o => o.planId === selectedPlanId);
              const displayPrice = selectedOption ? selectedOption.price : plan.mainPrice;
              const displayQuantity = selectedOption ? selectedOption.quantity : plan.mainQuantity;
              
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-6 border transition-all duration-300 hover:shadow-xl ${
                    plan.popular
                      ? "border-primary bg-card shadow-lg shadow-primary/20 md:scale-105"
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

                  <div className="mb-2">
                    <span className="text-4xl sm:text-5xl font-black">
                      {typeof displayPrice === 'number' 
                        ? `R$ ${displayPrice.toLocaleString('pt-BR')}`
                        : displayPrice}
                    </span>
                  </div>
                  <p className="text-lg text-muted-foreground mb-4">
                    {typeof displayQuantity === 'number' 
                      ? `${displayQuantity} imagens / vídeos*`
                      : displayQuantity}
                  </p>

                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>

                  {/* Options */}
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2 uppercase font-semibold">Outras opções:</p>
                    <div className="space-y-2">
                      {/* Main option */}
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name={`option-${plan.name}`}
                          checked={selectedPlanId === plan.mainPlanId}
                          onChange={() => setSelectedOptions(prev => ({ ...prev, [plan.name]: plan.mainPlanId }))}
                          className="accent-primary"
                        />
                        <span>{plan.mainQuantity} imagens / vídeos* — R$ {plan.mainPrice.toLocaleString('pt-BR')}</span>
                      </label>
                      {/* Other options */}
                      {plan.options.map((option) => (
                        <label key={option.planId} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`option-${plan.name}`}
                            checked={selectedPlanId === option.planId}
                            onChange={() => setSelectedOptions(prev => ({ ...prev, [plan.name]: option.planId }))}
                            className="accent-primary"
                          />
                          <span>
                            {typeof option.quantity === 'number' 
                              ? `${option.quantity} imagens / vídeos* — R$ ${(option.price as number).toLocaleString('pt-BR')}`
                              : `${option.quantity}* — ${option.price}`
                            }
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check size={16} className="text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => {
                      if (selectedPlanId === 'contact') {
                        document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        handlePricingClick(selectedPlanId);
                      }
                    }}
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled={isSubscribing && selectedPlanId !== 'contact'}
                  >
                    {selectedPlanId === 'contact' 
                      ? "Fale Conosco" 
                      : isSubscribing ? "Processando..." : "Começar Agora"}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Disclaimer sobre validade */}
          <div className="text-center mt-8 space-y-1">
            <p className="text-sm text-muted-foreground">
              Os créditos dos pacotes valem por 30 dias a partir da data da compra.
            </p>
            <p className="text-xs text-muted-foreground">
              *Exceto para Veo3 e Kling
            </p>
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
                  src="/images/synergy-logo.webp"
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
              <Link to="/privacidade" className="hover:text-foreground transition-colors">
                Privacidade
              </Link>
              <Link to="/termos" className="hover:text-foreground transition-colors">
                Termos
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={handleAuthModalClose}
        redirectPath={pendingPath}
      />
    </div>
  );
};

export default Home3;
