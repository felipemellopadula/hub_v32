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
  Plus,
  Search,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  useEffect(() => {
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
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="hidden md:block w-64 border-r border-border bg-background/80 backdrop-blur flex-shrink-0 overflow-y-auto">
        <div className="p-4">
          <Button variant="outline" className="w-full mb-4">
            <Plus className="h-4 w-4 mr-2" /> Novo chat
          </Button>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar em chats" />
          </div>
          <div className="space-y-2 mb-4">
            <Button variant="ghost" className="w-full justify-start">
              <Image className="h-4 w-4 mr-2" /> Galeria
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <nav className="space-y-1">
              <Button variant="ghost" className="w-full justify-start text-left">
                Sora
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left">
                GPTs
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left">
                Chat Português
              </Button>
              <div className="px-3 py-2 text-xs text-muted-foreground">Chats</div>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Diagnóstico e tratamento ave
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Imagem para clínica de golfe
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Faculdade Medicina Veterinária ...
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Criar imagem de pessoas
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Erro MPE1500 CPF irregular
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Criar imagem descrição
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Imagens para oficinas de canto
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Oficinas de voz coral
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Melhorar pontuação mensagem
              </Button>
              <Button variant="ghost" className="w-full justify-start text-left truncate">
                Alessandra Vaz Cardoso
              </Button>
            </nav>
          </ScrollArea>
        </div>
      </aside>
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
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
            <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#modelos" className="hover:text-foreground transition-colors">Soluções</a>
              <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
              <a href="#contato" className="hover:text-foreground transition-colors">Contato</a>
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {user ? (
                <Button onClick={() => navigate("/chat")} className="hidden sm:inline-flex">
                  Ir para Chat
                </Button>
              ) : (
                <Button onClick={() => setShowAuthModal(true)}>Login</Button>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">
          {/* Hero */}
          <section id="hero" className="border-b border-border bg-gradient-subtle">
            <div className="container mx-auto px-4 py-16 md:py-24">
              <div className="max-w-4xl mx-auto text-center space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Inovação em Inteligência Artificial
                </div>
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground">
                  Acesso <span className="text-primary">aos melhores<br />modelos</span> de Inteligência<br />
                  Artificial <span className="text-primary">do mundo</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Nosso hub de IA combina os melhores modelos de inteligência artificial para potencializar seus projetos de forma simples e eficiente.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => scrollToSection('planos')} className="shadow-glow">
                    Começar Agora
                  </Button>
                  <Button variant="outline" onClick={() => scrollToSection('modelos')}>
                    Ver Modelos
                  </Button>
                </div>
                <div className="pt-8">
                  <p className="text-sm text-muted-foreground mb-4">Empresas que confiam em nosso hub</p>
                  <div className="flex items-center justify-center gap-8 text-muted-foreground">
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
          {/* Principais Modelos de IA */}
          <section id="modelos" className="border-b border-border bg-background">
            <div className="container mx-auto px-4 py-16">
              <header className="mb-10 max-w-2xl mx-auto text-center">
                <h2 className="text-2xl md:text-3xl font-bold">Principais Modelos de IA</h2>
                <p className="text-muted-foreground mt-2">
                  Trabalhamos com as inteligências artificiais mais avançadas do mercado para oferecer soluções inovadoras.
                </p>
              </header>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12">
                      <img src="/images/logos/chatgpt.svg" alt="Logo ChatGPT" loading="lazy" className="h-10 w-auto" />
                    </div>
                    <CardTitle className="text-center">ChatGPT</CardTitle>
                    <CardDescription className="text-center">
                      Desenvolvido pela OpenAI, o ChatGPT é um modelo avançado de linguagem natural capaz de gerar textos coerentes, responder perguntas e auxiliar em diversas tarefas de escrita e análise.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12">
                      <img src="/images/logos/claude.svg" alt="Logo Claude" loading="lazy" className="h-10 w-auto" />
                    </div>
                    <CardTitle className="text-center">Claude</CardTitle>
                    <CardDescription className="text-center">
                      Criado pela Anthropic, o Claude é um assistente de IA projetado para ser útil, inofensivo e honesto, oferecendo respostas detalhadas e com foco em segurança e precisão.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12">
                      <img src="/images/logos/gemini.svg" alt="Logo Google Gemini" loading="lazy" className="h-10 w-auto" />
                    </div>
                    <CardTitle className="text-center">Gemini</CardTitle>
                    <CardDescription className="text-center">
                      Desenvolvido pelo Google, o Gemini é um modelo multimodal de próxima geração, capaz de compreender e processar diferentes tipos de informação, incluindo texto, imagens e código.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12">
                      <div className="text-4xl font-bold text-primary">∞</div>
                    </div>
                    <CardTitle className="text-center">Llama</CardTitle>
                    <CardDescription className="text-center">
                      Criado pela Meta, é um modelo de código aberto que permite aos desenvolvedores criar aplicações de IA personalizadas com acesso a um modelo de linguagem avançado.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </section>
          {/* Ferramentas Exclusivas */}
          <section id="ferramentas" className="border-b border-border">
            <div className="container mx-auto px-4 py-16">
              <header className="mb-10 max-w-2xl mx-auto text-center">
                <h2 className="text-2xl md:text-3xl font-bold">Ferramentas Exclusivas que Transformam seu Trabalho</h2>
                <p className="text-muted-foreground mt-2">
                  Desenvolvemos um conjunto de ferramentas poderosas para maximizar seu potencial criativo.
                </p>
              </header>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12 mb-4">
                      <BrainCircuit className="h-8 w-8 text-primary"/>
                    </div>
                    <CardTitle className="text-center">Sinapse Core</CardTitle>
                    <CardDescription className="text-center">
                      Nossa IA proprietária que seleciona automaticamente o modelo mais indicado para cada tarefa. Você não precisa se preocupar com nada e tem a segurança que sempre terá a melhor IA, independente do que estiver fazendo.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12 mb-4">
                      <FileText className="h-8 w-8 text-primary"/>
                    </div>
                    <CardTitle className="text-center">Análise de Documentos</CardTitle>
                    <CardDescription className="text-center">
                      Analise, interprete, resuma e avalie informações contidas em PDFs ou arquivos Word com facilidade incomparável.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12 mb-4">
                      <Layers className="h-8 w-8 text-primary"/>
                    </div>
                    <CardTitle className="text-center">Contextos</CardTitle>
                    <CardDescription className="text-center">
                      Crie contextos que expliquem de forma mais detalhada informações que podem ajudar o chat a te responder melhor, melhorando a qualidade das respostas.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12 mb-4">
                      <Users className="h-8 w-8 text-primary"/>
                    </div>
                    <CardTitle className="text-center">Flows</CardTitle>
                    <CardDescription className="text-center">
                      Tenha um mentor especialista à sua disposição para aprender coisas novas, fazer brainstorming, escrever e-mails, fazer propostas e até mesmo programar.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12 mb-4">
                      <FolderKanban className="h-8 w-8 text-primary"/>
                    </div>
                    <CardTitle className="text-center">Organize Chats em Pastas</CardTitle>
                    <CardDescription className="text-center">
                      Mantenha suas conversas organizadas, categorize e gerencie seus chats de maneira eficiente em diferentes projetos ou equipes.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-center h-12 mb-4">
                      <LineChart className="h-8 w-8 text-primary"/>
                    </div>
                    <CardTitle className="text-center">Análise de Dados</CardTitle>
                    <CardDescription className="text-center">
                      Transforme dados em insights visuais. Analise suas planilhas e crie gráficos automaticamente, facilitando a visualização e interpretação dos dados.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </section>
          {/* Recursos Poderosos */}
          <section id="recursos" className="border-b border-border bg-gradient-subtle">
            <div className="container mx-auto px-4 py-16">
              <header className="mb-10 max-w-2xl mx-auto text-center">
                <h2 className="text-2xl md:text-3xl font-bold">Recursos Poderosos</h2>
                <p className="text-muted-foreground mt-2">Tudo o que você precisa para construir, implantar e escalar aplicações com IA.</p>
              </header>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary"/> Modelos de IA Avançados</CardTitle><CardDescription>Acesse IA de última geração para texto, imagem e áudio.</CardDescription></CardHeader></Card>
                <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary"/> Velocidade Extrema</CardTitle><CardDescription>Infra otimizada para respostas rápidas, mesmo em alto tráfego.</CardDescription></CardHeader></Card>
                <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/> Segurança Empresarial</CardTitle><CardDescription>Criptografia e medidas de segurança de nível bancário.</CardDescription></CardHeader></Card>
                <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> Análises Detalhadas</CardTitle><CardDescription>Acompanhe uso, desempenho e custos com painéis.</CardDescription></CardHeader></Card>
                <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary"/> Disponibilidade Global</CardTitle><CardDescription>Baixa latência em qualquer lugar do mundo.</CardDescription></CardHeader></Card>
                <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary"/> Infraestrutura Escalável</CardTitle><CardDescription>Escala automática do protótipo à produção.</CardDescription></CardHeader></Card>
              </div>
            </div>
          </section>
          {/* Planos */}
          <section id="planos" className="border-b border-border">
            <div className="container mx-auto px-4 py-16">
              <div className="flex items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">Simples, Transparente e Prático</h2>
                  <p className="text-muted-foreground">Escolha o plano ideal. Cancele quando quiser.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Mensal</span>
                  <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Alternar cobrança anual" />
                  <span className="text-sm font-medium">Anual</span>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
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
                      Começar agora
                    </Button>
                  </CardHeader>
                </Card>
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
                      Começar agora
                    </Button>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </section>
          {/* Footer */}
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
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};
export default Index;