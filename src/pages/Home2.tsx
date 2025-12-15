import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Star, ArrowRight } from "lucide-react";

// Sample video URLs for hero cards (royalty-free from Pexels)
const heroCards = [
  {
    video: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
    title: "PROMOÇÃO DE FIM DE ANO",
    description: "Até 67% off em todos os planos + 1 ano de gerações ilimitadas",
    badge: "-67% OFF",
    badgeColor: "bg-red-500",
  },
  {
    video: "https://videos.pexels.com/video-files/5377684/5377684-uhd_2560_1440_25fps.mp4",
    title: "INPAINT",
    description: "Pincel para editar áreas específicas ou transformar imagens inteiras",
    badge: "NANO BANANA",
    badgeColor: "bg-primary",
  },
  {
    video: "https://videos.pexels.com/video-files/4625518/4625518-uhd_2560_1440_30fps.mp4",
    title: "SHOTS",
    description: "Uma imagem se torna 9 shots. Escolha e melhore seus favoritos",
    badge: null,
    badgeColor: "",
  },
  {
    video: "https://videos.pexels.com/video-files/5752729/5752729-uhd_2560_1440_30fps.mp4",
    title: "SKIN ENHANCER",
    description: "Transforme pele artificial em textura natural e realista",
    badge: "INTRODUZINDO",
    badgeColor: "bg-primary",
  },
];

const tools = [
  { name: "CRIAR IMAGEM", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=300&fit=crop" },
  { name: "CRIAR VÍDEO", image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300&h=300&fit=crop", hasArrow: true },
  { name: "EDITAR IMAGEM", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop" },
  { name: "VEO EDITOR", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop" },
  { name: "UPSCALE 4K", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&h=300&fit=crop" },
  { name: "AVATAR IA", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop" },
];

const recentCreations = [
  { image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=500&fit=crop", size: "small" },
  { image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=600&fit=crop", size: "large" },
  { image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&h=400&fit=crop", size: "small" },
  { image: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=400&h=500&fit=crop", size: "small" },
  { image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=500&fit=crop", size: "large" },
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
    features: [
      "100 créditos de geração",
      "Acesso ao modelo Gemini Flash",
      "Licença de uso pessoal",
      "Upscale HD",
    ],
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="/images/logo-light-optimized.webp" 
                alt="Synergy" 
                className="h-8 w-auto"
              />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/home2" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Explorar</Link>
              <Link to="/image" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Imagem</Link>
              <Link to="/video" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Vídeo</Link>
              <Link to="/image2" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Editar</Link>
              <Link to="/chat" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Personagens</Link>
              <Link to="/settings" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Preços</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">Entrar</Button>
            <Button size="sm">CRIAR CONTA</Button>
          </div>
        </div>
      </header>

      {/* Hero Section - 4 Video Cards */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {heroCards.map((card, index) => (
            <div 
              key={index}
              className="relative rounded-xl overflow-hidden aspect-[4/3] group cursor-pointer"
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              >
                <source src={card.video} type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              {/* Badge */}
              {card.badge && (
                <div className="absolute top-4 right-4">
                  <Badge className={`${card.badgeColor} text-white font-semibold`}>
                    {card.badge}
                  </Badge>
                </div>
              )}
              
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-lg font-bold text-white mb-1">{card.title}</h3>
                <p className="text-sm text-white/80">{card.description}</p>
              </div>
              
              {/* Logo overlay */}
              <div className="absolute top-4 left-4 opacity-60 group-hover:opacity-100 transition-opacity">
                <img 
                  src="/images/logo-light-optimized.webp" 
                  alt="Synergy" 
                  className="h-5 w-auto"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What Will You Create Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold">
              O QUE VOCÊ VAI <span className="text-primary">CRIAR HOJE?</span>
            </h2>
            <p className="text-muted-foreground mt-2">
              Crie imagens e vídeos autênticos com textura natural e estilo fácil.
            </p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 gap-2">
            <Zap className="w-4 h-4" />
            Explorar todas as ferramentas
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tools.map((tool, index) => (
            <div 
              key={index}
              className="group relative rounded-xl overflow-hidden aspect-square cursor-pointer bg-card hover:ring-2 hover:ring-primary/50 transition-all"
            >
              <img
                src={tool.image}
                alt={tool.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{tool.name}</span>
                {tool.hasArrow && <ArrowRight className="w-4 h-4 text-white" />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground text-sm uppercase tracking-widest">
          CONFIADO POR 700.000 EQUIPES CRIATIVAS
        </p>
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
          {recentCreations.map((creation, index) => (
            <div 
              key={index}
              className="break-inside-avoid rounded-xl overflow-hidden cursor-pointer group"
            >
              <img
                src={creation.image}
                alt={`Creation ${index + 1}`}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
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
                plan.popular 
                  ? "border-2 border-primary bg-card" 
                  : "border border-border bg-card/50"
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
              <img 
                src="/images/logo-light-optimized.webp" 
                alt="Synergy" 
                className="h-8 w-auto mb-4"
              />
              <p className="text-sm text-muted-foreground">
                A maior biblioteca do mundo de conteúdo gerado por IA.
                Descubra fotos, vídeos e vetores de alta qualidade
                criados por nossos modelos de ponta, incluindo Gemini e Veo.
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
                <li><a href="#" className="hover:text-foreground transition-colors">Novos ativos</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Mais populares</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Tendências de busca</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Informações</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Sobre nós</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Carreiras</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Venda seu conteúdo</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Política de privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Política de cookies</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Copyright</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 Synergy AI / Freepik Clone. Todos os direitos reservados.
            </p>
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
