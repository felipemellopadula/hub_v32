import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/AuthModal";
import { ContactForm } from "@/components/ContactForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  ThumbsUp,
  Activity,
  Stars,
  BrainCircuit,
  Layers,
  FileText,
  FolderKanban,
  LineChart,
  ShieldCheck,
  Users,
  Globe,
  Server,
  Zap,
  Check,
  ArrowRight,
  MessageSquare,
  Image,
  FileAudio,
  Languages,
  PenTool,
  Play,
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [annual, setAnnual] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsSubscribing(true);
    try {
      console.log('[Frontend] Iniciando checkout para:', planId);
      
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId }
      });

      console.log('[Frontend] Resposta recebida:', { data, error });

      if (error) {
        console.error('[Frontend] Erro da função:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('[Frontend] Redirecionando para:', data.url);
        // Usar window.open para abrir em nova aba (mais confiável)
        const newWindow = window.open(data.url, '_blank');
        
        if (!newWindow) {
          // Se popup blocker impediu, tentar redirect na mesma aba
          console.log('[Frontend] Popup bloqueado, redirecionando na mesma aba');
          window.location.href = data.url;
        } else {
          // Resetar estado se abriu com sucesso em nova aba
          setIsSubscribing(false);
          toast({
            title: "Checkout aberto",
            description: "Complete o pagamento na nova aba que foi aberta.",
          });
        }
      } else {
        console.error('[Frontend] URL não recebida:', data);
        throw new Error("URL de checkout não recebida");
      }
    } catch (error) {
      console.error('[Frontend] Erro ao criar checkout:', error);
      setIsSubscribing(false);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível iniciar o checkout. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handlePrimaryCta = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      setShowAuthModal(true);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-2" aria-label="Synergy AI">
            <img
              src="/synergy-uploads/75b65017-8e97-493c-85a8-fe1b0f60ce9f.png"
              alt="Synergy AI logo"
              className="h-8 w-auto"
            />
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#modelos" className="hover:text-foreground transition-colors">
              Soluções
            </a>
            <a href="#planos" className="hover:text-foreground transition-colors">
              Planos
            </a>
            <a href="#contato" className="hover:text-foreground transition-colors">
              Contato
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Button
                onClick={() => navigate("/dashboard")}
                size="sm"
                className="text-xs sm:text-sm"
              >
                Dashboard
              </Button>
            ) : (
              <Button
                onClick={() => setShowAuthModal(true)}
                size="sm"
                className="text-xs sm:text-sm"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section id="hero" className="border-b border-border bg-gradient-subtle">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Inovação em Inteligência Artificial
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground">
                Acesso{" "}
                <span className="text-primary">
                  aos melhores
                  <br />
                  modelos
                </span>{" "}
                de Inteligência
                <br />
                Artificial <span className="text-primary">do mundo</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Nosso hub de IA combina os melhores modelos de inteligência
                artificial para potencializar seus projetos de forma simples e
                eficiente.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => scrollToSection("planos")} className="shadow-glow">
                  Começar Agora
                </Button>
                <Button variant="outline" onClick={() => scrollToSection("modelos")}>
                  Ver Modelos
                </Button>
              </div>

              <div className="pt-8">
                <p className="text-sm text-muted-foreground mb-4">
                  Empresas que confiam em nosso hub
                </p>
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-sm">Marca Um</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm">Marca Dois</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars className="h-4 w-4 hover:text-primary" />
                    <span className="text-sm">Marca Três</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Modelos Section */}
        <section id="modelos" className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-16">
            <header className="mb-10 max-w-2xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold">
                Principais Modelos de IA
              </h2>
              <p className="text-muted-foreground mt-2">
                Trabalhamos com as inteligências artificiais mais avançadas
                do mercado para oferecer soluções inovadoras.
              </p>
            </header>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-center h-12">
                    <img
                      src="/images/logos/chatgpt.svg"
                      alt="Logo ChatGPT"
                      className="h-10 w-auto"
                    />
                  </div>
                  <CardTitle className="text-center">ChatGPT</CardTitle>
                  <CardDescription className="text-center">
                    Desenvolvido pela OpenAI, o ChatGPT é um modelo avançado
                    de linguagem natural capaz de gerar textos coerentes.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-center h-12">
                    <img
                      src="/images/logos/claude.svg"
                      alt="Logo Claude"
                      className="h-10 w-auto"
                    />
                  </div>
                  <CardTitle className="text-center">Claude</CardTitle>
                  <CardDescription className="text-center">
                    Criado pela Anthropic, o Claude é um assistente de IA
                    projetado para ser útil, inofensivo e honesto.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-center h-12">
                    <img
                      src="/images/logos/gemini.svg"
                      alt="Logo Google Gemini"
                      className="h-10 w-auto"
                    />
                  </div>
                  <CardTitle className="text-center">Gemini</CardTitle>
                  <CardDescription className="text-center">
                    Desenvolvido pelo Google, o Gemini é um modelo
                    multimodal de próxima geração.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-center h-12">
                    <div className="text-4xl font-bold text-primary">∞</div>
                  </div>
                  <CardTitle className="text-center">E muito mais</CardTitle>
                  <CardDescription className="text-center">
                    Integração com diversos outros modelos e ferramentas de IA.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Recursos Section */}
        <section id="recursos" className="border-b border-border bg-muted/30">
          <div className="container mx-auto px-4 py-16">
            <header className="mb-10 max-w-2xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold">
                Recursos Disponíveis
              </h2>
              <p className="text-muted-foreground mt-2">
                Explore todas as funcionalidades do nosso hub de IA.
              </p>
            </header>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-card border-border">
                <CardHeader>
                  <MessageSquare className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Chat Inteligente</CardTitle>
                  <CardDescription>
                    Converse com diferentes modelos de IA em uma interface única
                    e intuitiva.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <Image className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Geração de Imagens</CardTitle>
                  <CardDescription>
                    Crie imagens impressionantes usando tecnologia de IA
                    avançada.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <FileAudio className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Transcrição de Áudio</CardTitle>
                  <CardDescription>
                    Converta áudio em texto com alta precisão e velocidade.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <Languages className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Tradutor</CardTitle>
                  <CardDescription>
                    Traduza textos entre diversos idiomas com qualidade
                    profissional.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <PenTool className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Assistente de Escrita</CardTitle>
                  <CardDescription>
                    Melhore seus textos com sugestões inteligentes de IA.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <Play className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Geração de Vídeos</CardTitle>
                  <CardDescription>
                    Crie vídeos únicos usando inteligência artificial.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Planos Section */}
        <section id="planos" className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-16">
            <header className="mb-10 max-w-2xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold">
                Planos Simples e Transparentes
              </h2>
              <p className="text-muted-foreground mt-2">
                Escolha o plano ideal para suas necessidades.
              </p>
              
              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-3 mt-8">
                <span className={`text-sm ${!annual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Mensal
                </span>
                <button
                  onClick={() => setAnnual(!annual)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    annual ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  aria-label="Toggle billing period"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      annual ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm ${annual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Anual
                </span>
              </div>
            </header>

            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              <Card className="bg-card border-border">
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Básico</CardTitle>
                  <div className="text-3xl font-bold text-primary">
                    R$ 1,00<span className="text-sm text-muted-foreground">/{annual ? 'ano' : 'mês'}</span>
                  </div>
                  <CardDescription>
                    Perfeito para uso pessoal e projetos pequenos.
                  </CardDescription>
                </CardHeader>
                <div className="p-6 pt-0">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      100.000 tokens mensais
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Acesso a todos os modelos
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Suporte por email
                    </li>
                  </ul>
                  <Button 
                    onClick={() => handleSubscribe(annual ? 'basic_annual' : 'basic_monthly')} 
                    className="w-full mt-6"
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? "Processando..." : "Começar Agora"}
                  </Button>
                </div>
              </Card>

              <Card className="bg-card border-border border-primary shadow-lg relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                    Mais Popular
                  </span>
                </div>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Pro</CardTitle>
                  <div className="text-3xl font-bold text-primary">
                    R$ 1,00<span className="text-sm text-muted-foreground">/{annual ? 'ano' : 'mês'}</span>
                  </div>
                  <CardDescription>
                    Ideal para profissionais e equipes pequenas.
                  </CardDescription>
                </CardHeader>
                <div className="p-6 pt-0">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      500.000 tokens mensais
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Acesso prioritário aos modelos
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Suporte prioritário
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      API personalizada
                    </li>
                  </ul>
                  <Button 
                    onClick={() => handleSubscribe(annual ? 'pro_annual' : 'pro_monthly')} 
                    className="w-full mt-6"
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? "Processando..." : "Começar Agora"}
                  </Button>
                </div>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Enterprise</CardTitle>
                  <div className="text-3xl font-bold text-primary">
                    Personalizado
                  </div>
                  <CardDescription>
                    Para empresas com necessidades específicas.
                  </CardDescription>
                </CardHeader>
                <div className="p-6 pt-0">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Tokens ilimitados
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Integração personalizada
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Suporte dedicado
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      SLA garantido
                    </li>
                  </ul>
                  <Button variant="outline" className="w-full mt-6">
                    Falar com Vendas
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contato" className="bg-muted/30">
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Pronto para começar?
              </h2>
              <p className="text-muted-foreground mb-8">
                Junte-se a milhares de usuários que já estão transformando seus
                projetos com IA.
              </p>
              <Button onClick={handlePrimaryCta} size="lg" className="shadow-glow">
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Separator */}
            <div className="max-w-4xl mx-auto my-16">
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
            </div>

            {/* Contact Form */}
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-xl md:text-2xl font-bold mb-2">
                  Entre em Contato
                </h3>
                <p className="text-muted-foreground">
                  Tem dúvidas ou sugestões? Envie uma mensagem para nós.
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6 md:p-8 shadow-sm">
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="md:col-span-1">
              <h3 className="font-bold text-lg mb-3">Synergy IA Hub</h3>
              <p className="text-sm text-muted-foreground">
                Capacitando desenvolvedores e empresas com recursos de IA de ponta.
              </p>
            </div>

            {/* Empresa Links */}
            <div>
              <h4 className="font-semibold mb-3">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Carreiras
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Imprensa
                  </a>
                </li>
              </ul>
            </div>

            {/* Recursos Links */}
            <div>
              <h4 className="font-semibold mb-3">Recursos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Documentação
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Referência da API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Tutoriais
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Comunidade
                  </a>
                </li>
              </ul>
            </div>

            {/* Contato */}
            <div>
              <h4 className="font-semibold mb-3">Contato</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="block">Email: contato@synergyia.com.br</span>
                </li>
                <li>
                  <span className="block">Telefone: +55 (11) 4567-8901</span>
                </li>
                <li>
                  <span className="block">Endereço: Av. Paulista, 1000, São Paulo/SP</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div>© 2025 Synergy IA Hub. Todos os direitos reservados.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">
                Política de Privacidade
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Termos de Serviço
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Política de Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default Index;