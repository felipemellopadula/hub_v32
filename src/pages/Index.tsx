import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Sparkles,
  Zap,
  Users,
  ThumbsUp,
  Activity,
  Stars,
  BrainCircuit,
  Gem,
  Layers,
  FileText,
  FolderKanban,
  LineChart,
  ShieldCheck,
  Globe,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [annual, setAnnual] = useState(true);
  const [isLight, setIsLight] = useState<boolean>(() => document.documentElement.classList.contains('light'));

  const handlePrimaryCta = () => {
    if (user) navigate("/chat");
    else setShowAuthModal(true);
  };

  useEffect(() => {
    // Basic SEO for the landing page
    document.title = "Synergy AI Hub – Modelos de IA, Recursos e Planos";

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta(
      "description",
      "Acesse os melhores modelos de IA: ChatGPT, Claude, Gemini e mais. Recursos poderosos, preços simples e dashboard intuitivo."
    );

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", window.location.href);

    // Track theme changes to swap logos
    const apply = () => setIsLight(document.documentElement.classList.contains('light'));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-2" aria-label="Synergy AI">
            {isLight ? (
              <img src="/lovable-uploads/d3026126-a31a-4979-b9d5-265db8e3f148.png" alt="Synergy AI logo" className="h-8 w-auto" />
            ) : (
              <img src="/lovable-uploads/75b65017-8e97-493c-85a8-fe1b0f60ce9f.png" alt="Synergy AI logo" className="h-8 w-auto" />
            )}
          </a>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Starter */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Starter</CardTitle>
                <CardDescription>Para indivíduos e pequenos projetos</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold">
                    R$ {annual ? "30,00" : "35,00"}
                    <span className="text-sm font-normal text-muted-foreground"> /mês</span>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>Acesso a modelos básicos de I.A</li>
                  <li>100.000 tokens por mês</li>
                  <li>1 solicitação por vez</li>
                  <li>Análise básica</li>
                </ul>
                <Button variant="outline" className="mt-6" onClick={() => setShowAuthModal(true)}>
                  Começar agora
                </Button>
              </CardHeader>
            </Card>

            {/* Professional */}
            <Card className="bg-card border-border ring-1 ring-primary/20">
              <CardHeader>
                <div className="inline-flex self-start -mb-2 translate-y-[-6px] rounded-full bg-primary/10 text-primary text-xs px-3 py-1">
                  Mais Popular
                </div>
                <CardTitle>Profissional</CardTitle>
                <CardDescription>Para profissionais e pequenas equipes</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold">
                    R$ {annual ? "79,99" : "89,99"}
                    <span className="text-sm font-normal text-muted-foreground"> /mês</span>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>Acesso a todos modelos de I.A</li>
                  <li>1.000.000 de tokens por mês</li>
                  <li>Até 5 solicitações ao mesmo tempo</li>
                  <li>Prioridade no suporte</li>
                  <li>Análises avançadas</li>
                </ul>
                <Button className="mt-6" onClick={() => setShowAuthModal(true)}>
                  Começar teste gratuito
                </Button>
              </CardHeader>
            </Card>

            {/* Enterprise */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Empresarial</CardTitle>
                <CardDescription>Para organizações com necessidades especiais</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold">Sob Consulta*</div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>Acesso a todos os modelos</li>
                  <li>Chamadas ilimitadas</li>
                  <li>Suporte 24/7</li>
                  <li>Custom model fine-tuning</li>
                  <li>Infra dedicada e SLA</li>
                </ul>
                <Button variant="outline" className="mt-6" onClick={() => setShowAuthModal(true)}>
                  Entre em contato
                </Button>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Contato/Footer simples */}
        <footer id="contato" className="border-t border-border">
          <div className="container mx-auto px-4 py-12">
            <div className="grid gap-8 md:grid-cols-4">
              <div>
                <h3 className="text-xl font-bold">IA Hub</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Capacitando desenvolvedores e empresas com recursos de IA de ponta.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Empresa</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground">Sobre Nós</a></li>
                  <li><a href="#" className="hover:text-foreground">Carreiras</a></li>
                  <li><a href="#" className="hover:text-foreground">Blog</a></li>
                  <li><a href="#" className="hover:text-foreground">Imprensa</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Recursos</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground">Documentação</a></li>
                  <li><a href="#" className="hover:text-foreground">Referência da API</a></li>
                  <li><a href="#" className="hover:text-foreground">Tutoriais</a></li>
                  <li><a href="#" className="hover:text-foreground">Comunidade</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Contato</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Email: contato@iahub.com.br</li>
                  <li>Telefone: +55 (11) 4567-8901</li>
                  <li>Endereço: Av. Paulista, 1000, São Paulo/SP</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground flex flex-col md:flex-row items-center justify-between gap-2">
              <p>© {new Date().getFullYear()} IA Hub. Todos os direitos reservados.</p>
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-foreground">Política de Privacidade</a>
                <a href="#" className="hover:text-foreground">Termos de Serviço</a>
                <a href="#" className="hover:text-foreground">Política de Cookies</a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default Index;
