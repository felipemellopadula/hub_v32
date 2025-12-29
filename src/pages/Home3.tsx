import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
  Settings,
  LayoutDashboard,
} from 'lucide-react';

// Types
interface NavItem {
  label: string;
  href: string;
  isNew?: boolean;
}

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
}

interface ToolCard {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  isNew?: boolean;
  isPro?: boolean;
  path: string;
}

// Data
const navItems: NavItem[] = [
  { label: 'Explorar', href: '#tools' },
  { label: 'Imagem', href: '/image2' },
  { label: 'Vídeo', href: '/video' },
  { label: 'Editar', href: '/image-editor' },
  { label: 'Personagem', href: '/ai-avatar' },
  { label: 'Inpaint', href: '/inpaint' },
  { label: 'Cinema Studio', href: '/video', isNew: true },
];

const heroSlides: HeroSlide[] = [
  {
    id: '1',
    title: 'SEEDANCE 1.5 PRO',
    subtitle: 'Narrativas Multi-shot com Áudio',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    ctaText: 'Experimentar',
  },
  {
    id: '2',
    title: 'MOTION CONTROL 2.6',
    subtitle: 'Controle preciso de expressões',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    ctaText: 'Animar',
  },
  {
    id: '3',
    title: 'CINEMA STUDIO',
    subtitle: 'Lentes e Câmeras Reais',
    imageUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
    ctaText: 'Criar Cena',
  },
  {
    id: '4',
    title: 'NANO BANANA UNLIMITED',
    subtitle: 'Geração Ultra Rápida',
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80',
    ctaText: 'Gerar',
  },
];

const tools: ToolCard[] = [
  { id: '1', title: 'Criar Imagem', description: 'Texto para imagem', imageUrl: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&q=80', path: '/image2' },
  { id: '2', title: 'Criar Vídeo', description: 'Texto/Imagem para vídeo', imageUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&q=80', path: '/video' },
  { id: '3', title: 'Editar Imagem', description: 'Inpaint & Outpaint', imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80', path: '/inpaint' },
  { id: '4', title: 'Edição de Vídeo', description: 'Motion brush', imageUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&q=80', path: '/video' },
  { id: '5', title: 'Upscale', description: 'Até 4K de resolução', imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80', path: '/upscale' },
  { id: '6', title: 'Nano Banana Pro', description: 'Modelo exclusivo', imageUrl: 'https://images.unsplash.com/photo-1633412802994-5c058f151b66?w=400&q=80', isPro: true, path: '/image2' },
  { id: '7', title: 'Skin Enhancer', description: 'Melhore a pele', imageUrl: 'https://images.unsplash.com/photo-1588528402605-bb21e12e5b9e?w=400&q=80', path: '/skin-enhancer' },
  { id: '8', title: 'AI Avatar', description: 'Crie seu avatar', imageUrl: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=400&q=80', isNew: true, path: '/ai-avatar' },
];

const Home3: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          isScrolled
            ? 'bg-background/90 backdrop-blur-md border-border py-3'
            : 'bg-transparent border-transparent py-5'
        }`}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Left Side: Logo & Links */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group">
                <img
                  src="/lovable-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
                  alt="Synergy AI"
                  className="h-8 w-auto"
                />
              </Link>

              <div className="hidden xl:flex items-center gap-6">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group py-2"
                  >
                    {item.label}
                    {item.isNew && (
                      <span className="absolute -top-1 -right-6 text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm uppercase">
                        New
                      </span>
                    )}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
                  </Link>
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
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {profile?.name ? getInitials(profile.name) : <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{profile?.name?.split(' ')[0] || 'Usuário'}</span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate('/dashboard-novo')}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setShowAuthModal(true)}>
                    Entrar
                  </Button>
                  <Button onClick={() => setShowAuthModal(true)}>
                    CRIAR CONTA
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="xl:hidden text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden absolute top-full left-0 w-full bg-background border-b border-border py-4 px-4 flex flex-col gap-4 shadow-2xl">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="text-lg font-medium text-muted-foreground hover:text-foreground flex items-center justify-between"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
                {item.isNew && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm uppercase">
                    New
                  </span>
                )}
              </Link>
            ))}
            <div className="h-px bg-border my-2"></div>
            {user ? (
              <>
                <Link to="/dashboard-novo" className="py-2 text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="py-2 text-left text-muted-foreground">
                  Sair
                </button>
              </>
            ) : (
              <Button onClick={() => { setShowAuthModal(true); setMobileMenuOpen(false); }} className="w-full">
                Entrar / Criar Conta
              </Button>
            )}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="pt-24 pb-8">
        <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4 px-4 sm:px-6 lg:px-8 snap-x">
          {heroSlides.map((slide) => (
            <div
              key={slide.id}
              className="snap-center shrink-0 w-[85vw] md:w-[600px] lg:w-[800px] h-[300px] md:h-[400px] relative rounded-2xl overflow-hidden group cursor-pointer border border-border hover:border-primary/50 transition-colors"
            >
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col items-start">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="text-primary w-4 h-4" />
                  <span className="text-primary text-xs font-bold tracking-widest uppercase">Destaque</span>
                </div>
                <h2 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter mb-2">
                  {slide.title}
                </h2>
                <p className="text-gray-300 text-sm md:text-base mb-6 max-w-md">
                  {slide.subtitle}
                </p>
                <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                  {slide.ctaText}
                  <Play size={14} fill="currentColor" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Promo Banner */}
        <div className="w-full relative overflow-hidden rounded-2xl my-8 group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-r from-red-900 to-red-700">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            ></div>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between px-8 py-6 md:py-10 gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                  Oferta Limitada
                </span>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
                Desbloqueie o Synergy Pro
              </h2>
              <p className="text-red-100 text-sm md:text-base max-w-xl">
                Tenha acesso a gerações ilimitadas, modelos exclusivos (Nano Banana Pro) e renderização 4K rápida. Oferta termina em breve.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block w-24 h-24 relative">
                <Gift
                  size={80}
                  className="text-primary drop-shadow-lg transform -rotate-12 group-hover:rotate-0 transition-transform duration-300"
                />
              </div>
              <Button size="lg" className="shadow-xl shadow-black/20">
                Assinar Agora
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div id="tools" className="py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl md:text-5xl font-black text-foreground uppercase tracking-tight leading-none mb-2">
                O que você vai <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500">
                  criar hoje?
                </span>
              </h2>
              <p className="text-muted-foreground mt-2 max-w-lg">
                Crie imagens autênticas e vídeos com texturas naturais e estilo fácil.
              </p>
            </div>
            <Button className="self-start md:self-auto" onClick={() => navigate('/dashboard-novo')}>
              Explorar todas as ferramentas
              <SparkleIcon />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {tools.map((tool) => (
              <Link
                key={tool.id}
                to={user ? tool.path : '#'}
                onClick={(e) => {
                  if (!user) {
                    e.preventDefault();
                    setShowAuthModal(true);
                  }
                }}
                className="group relative bg-card rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 border border-border hover:border-primary/50"
              >
                <div className="aspect-square overflow-hidden relative">
                  <img
                    src={tool.imageUrl}
                    alt={tool.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
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
                    {tool.description && (
                      <span className="text-xs text-muted-foreground mt-1">{tool.description}</span>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all transform group-hover:rotate-[-45deg]">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-20 bg-background py-12">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/lovable-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
                  alt="Synergy AI"
                  className="h-6 w-auto"
                />
              </div>
              <p className="text-muted-foreground text-sm max-w-sm">
                Potencializando a criatividade humana com inteligência artificial avançada. Crie vídeos, imagens e histórias sem limites.
              </p>
            </div>

            <div>
              <h4 className="text-foreground font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="#" className="hover:text-primary">Features</Link></li>
                <li><Link to="#" className="hover:text-primary">Preços</Link></li>
                <li><Link to="#" className="hover:text-primary">API</Link></li>
                <li><Link to="#" className="hover:text-primary">Showcase</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-foreground font-bold mb-4">Comunidade</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Discord</a></li>
                <li><a href="#" className="hover:text-primary">Twitter / X</a></li>
                <li><a href="#" className="hover:text-primary">Blog</a></li>
                <li><a href="#" className="hover:text-primary">Ajuda</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
            <p>© 2024 Synergy IA Hub. Todos os direitos reservados.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-foreground">Privacidade</a>
              <a href="#" className="hover:text-foreground">Termos</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Hide Scrollbar Style */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

// Sparkle Icon for button
const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="ml-2">
    <path
      d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export default Home3;
