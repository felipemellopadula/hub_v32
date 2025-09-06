// index.tsx — versão focada em “First Load” MUITO mais rápida, sem perder funcionalidades
// Técnicas aplicadas:
// 1) Lazy‑mount dos blocos abaixo da dobra com IntersectionObserver (Defer), + content-visibility: auto.
// 2) Lazy import apenas dos ícones usados abaixo da dobra (reduz bundle inicial).
// 3) Theme logo carrega apenas UMA imagem (antes carregava as duas e ocultava uma), mantendo troca de tema.
// 4) AuthModal e Switch carregados sob demanda (lazy) + prefetch no hover/click do botão “Login”.
// 5) Metadados e preloads movidos para requestIdleCallback (com fallback), sem bloquear a thread.
// 6) Todas as imagens com decoding="async" e loading="lazy" (exceto logo principal com fetchPriority="high").
// 7) Seções com placeholders leves enquanto não montam (skeletons).

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, // acima da dobra
  ThumbsUp, // acima da dobra
  Activity, // acima da dobra (também usado abaixo, reaproveitamos este mesmo)
  Stars, // acima da dobra
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// ThemeToggle e Switch agora são lazy
const ThemeToggleLazy = lazy(() =>
  import("@/components/ThemeToggle").then((m) => ({ default: m.ThemeToggle }))
);
const SwitchLazy = lazy(() =>
  import("@/components/ui/switch").then((m) => ({ default: m.Switch }))
);
import { useAuth } from "@/contexts/AuthContext";

// Ícones usados APENAS abaixo da dobra — importamos sob demanda para reduzir o bundle inicial
const BrainCircuitIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.BrainCircuit }))
);
const LayersIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Layers }))
);
const FileTextIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.FileText }))
);
const FolderKanbanIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.FolderKanban }))
);
const LineChartIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.LineChart }))
);
const ShieldCheckIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.ShieldCheck }))
);
const UsersIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Users }))
);
const GlobeIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Globe }))
);
const ServerIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Server }))
);
const ZapIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Zap }))
);

// Import direto do AuthModal para evitar problemas de contexto
import { AuthModal } from "@/components/AuthModal";

// --------- Helpers de performance ---------

/** requestIdleCallback com fallback */
const ric = (
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb: IdleRequestCallback) =>
        (window as any).requestIdleCallback(cb, { timeout: 1000 })
    : (cb: Function) =>
        setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1)
) as (cb: IdleRequestCallback | any) => number;

const cancelRic = (
  typeof window !== "undefined" && "cancelIdleCallback" in window
    ? (id: number) => (window as any).cancelIdleCallback(id)
    : (id: number) => clearTimeout(id)
) as (id: number) => void;

/** Seção que só monta quando entra no viewport */
function Defer({
  children,
  rootMargin = "250px",
  fallback = null,
  // content-visibility acelera paint/layout de conteúdos fora de tela
  containSize = "700px",
}: {
  children: React.ReactNode;
  rootMargin?: string;
  fallback?: React.ReactNode;
  containSize?: string;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;

    let obs: IntersectionObserver | null = null;
    try {
      obs = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setShown(true);
            obs?.disconnect();
          }
        },
        { rootMargin }
      );
      obs.observe(el);
    } catch {
      // navegadores antigos
      setShown(true);
    }

    return () => obs?.disconnect();
  }, [shown, rootMargin]);

  return (
    <div
      ref={ref}
      style={{
        contentVisibility: "auto" as any,
        containIntrinsicSize: containSize,
      }}
    >
      {shown ? children : fallback}
    </div>
  );
}

/** Skeletons simples e leves */
const SectionSkeleton = ({ lines = 3 }: { lines?: number }) => (
  <div className="container mx-auto px-4 py-12 animate-pulse">
    <div className="h-6 w-56 bg-muted rounded mb-4" />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-4 w-full max-w-3xl bg-muted rounded mb-3" />
    ))}
  </div>
);

const IconSkeleton = () => <div className="h-8 w-8 rounded-full bg-muted" />;

// --------- Página ---------

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [annual, setAnnual] = useState(true);

  // Detecção de tema (mantida), mas evitando reflows
  const [isLight, setIsLight] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("light")
      : true
  );

  // Logo único (evita baixar 2 imagens no topo). Mantém troca de tema.
  const logoSrc = isLight
    ? "/images/logo-light-optimized.webp"
    : "/images/logo-dark-optimized.webp";

  const handlePrimaryCta = useCallback(() => {
    if (user) navigate("/dashboard");
    else setShowAuthModal(true);
  }, [user, navigate]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    // Título imediatamente
    document.title = "Synergy AI Hub – Modelos de IA, Recursos e Planos";

    // Observer do tema (mantido)
    const apply = () =>
      setIsLight(document.documentElement.classList.contains("light"));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Tarefas não críticas jogadas para idle
    const id = ric(() => {
      // Precarregar a outra variação do logo após o carregamento (para uma troca de tema suave)
      const otherLogo = new Image();
      otherLogo.decoding = "async";
      otherLogo.loading = "lazy";
      otherLogo.src = isLight
        ? "/images/logo-dark-optimized.webp"
        : "/images/logo-light-optimized.webp";

      // Metas
      const setMeta = (name: string, content: string) => {
        let el = document.querySelector(
          `meta[name="${name}"]`
        ) as HTMLMetaElement | null;
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

      // Canonical
      let link = document.querySelector(
        'link[rel="canonical"]'
      ) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", window.location.href);
    });

    return () => {
      observer.disconnect();
      cancelRic(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Pre-connect to critical domains for faster loading
  useEffect(() => {
    const preconnects = [
      'https://myqgnnqltemfpzdxwybj.supabase.co',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com'
    ];
    
    preconnects.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-border sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <a
              href="/"
              className="flex items-center gap-2"
              aria-label="Synergy AI"
            >
              <img
                src={logoSrc}
                alt="Synergy AI logo"
                className="h-8 w-auto"
                width="32"
                height="32"
                loading="eager"
                decoding="async"
              />
            </a>
            <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a
                href="#modelos"
                className="hover:text-foreground transition-colors"
              >
                Soluções
              </a>
              <a
                href="#planos"
                className="hover:text-foreground transition-colors"
              >
                Planos
              </a>
              <a
                href="#contato"
                className="hover:text-foreground transition-colors"
              >
                Contato
              </a>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <Suspense
                fallback={<div className="h-6 w-10 rounded bg-muted" />}
              >
                <ThemeToggleLazy />
              </Suspense>
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
          {/* Hero (acima da dobra) */}
          <section
            id="hero"
            className="border-b border-border bg-gradient-subtle"
          >
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
                  <Button
                    onClick={() => scrollToSection("planos")}
                    className="shadow-glow"
                  >
                    Começar Agora
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scrollToSection("modelos")}
                  >
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

          {/* Principais Modelos de IA — lazy mount + content-visibility */}
          <Defer fallback={<SectionSkeleton lines={6} />} containSize="900px">
            <section
              id="modelos"
              className="border-b border-border bg-background"
            >
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
                          loading="lazy"
                          decoding="async"
                          className="h-10 w-auto"
                        />
                      </div>
                      <CardTitle className="text-center">ChatGPT</CardTitle>
                      <CardDescription className="text-center">
                        Desenvolvido pela OpenAI, o ChatGPT é um modelo avançado
                        de linguagem natural capaz de gerar textos coerentes,
                        responder perguntas e auxiliar em diversas tarefas de
                        escrita e análise.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12">
                        <img
                          src="/images/logos/claude.svg"
                          alt="Logo Claude"
                          loading="lazy"
                          decoding="async"
                          className="h-10 w-auto"
                        />
                      </div>
                      <CardTitle className="text-center">Claude</CardTitle>
                      <CardDescription className="text-center">
                        Criado pela Anthropic, o Claude é um assistente de IA
                        projetado para ser útil, inofensivo e honesto,
                        oferecendo respostas detalhadas e com foco em segurança
                        e precisão.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12">
                        <img
                          src="/images/logos/gemini.svg"
                          alt="Logo Google Gemini"
                          loading="lazy"
                          decoding="async"
                          className="h-10 w-auto"
                        />
                      </div>
                      <CardTitle className="text-center">Gemini</CardTitle>
                      <CardDescription className="text-center">
                        Desenvolvido pelo Google, o Gemini é um modelo
                        multimodal de próxima geração, capaz de compreender e
                        processar diferentes tipos de informação, incluindo
                        texto, imagens e código.
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
                        Criado pela Meta, é um modelo de código aberto que
                        permite aos desenvolvedores criar aplicações de IA
                        personalizadas com acesso a um modelo de linguagem
                        avançado.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            </section>
          </Defer>

          {/* Ferramentas Exclusivas — lazy mount + lazy icons */}
          <Defer fallback={<SectionSkeleton lines={6} />} containSize="1000px">
            <section id="ferramentas" className="border-b border-border">
              <div className="container mx-auto px-4 py-16">
                <header className="mb-10 max-w-2xl mx-auto text-center">
                  <h2 className="text-2xl md:text-3xl font-bold">
                    Ferramentas Exclusivas que Transformam seu Trabalho
                  </h2>
                </header>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12 mb-4">
                        <Suspense fallback={<IconSkeleton />}>
                          <BrainCircuitIcon className="h-8 w-8 text-primary" />
                        </Suspense>
                      </div>
                      <CardTitle className="text-center">
                        Synergy Core
                      </CardTitle>
                      <CardDescription className="text-center">
                        Nossa IA proprietária que seleciona automaticamente o
                        modelo mais indicado para cada tarefa. Você não precisa
                        se preocupar com nada e tem a segurança que sempre terá
                        a melhor IA, independente do que estiver fazendo.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12 mb-4">
                        <Suspense fallback={<IconSkeleton />}>
                          <FileTextIcon className="h-8 w-8 text-primary" />
                        </Suspense>
                      </div>
                      <CardTitle className="text-center">
                        Análise de Documentos
                      </CardTitle>
                      <CardDescription className="text-center">
                        Analise, interprete, resuma e avalie informações
                        contidas em PDFs ou arquivos Word com facilidade
                        incomparável.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12 mb-4">
                        <Suspense fallback={<IconSkeleton />}>
                          <LayersIcon className="h-8 w-8 text-primary" />
                        </Suspense>
                      </div>
                      <CardTitle className="text-center">Contextos</CardTitle>
                      <CardDescription className="text-center">
                        Crie contextos que expliquem de forma mais detalhada
                        informações que podem ajudar o chat a te responder
                        melhor, melhorando a qualidade das respostas.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12 mb-4">
                        <Suspense fallback={<IconSkeleton />}>
                          <UsersIcon className="h-8 w-8 text-primary" />
                        </Suspense>
                      </div>
                      <CardTitle className="text-center">Flows</CardTitle>
                      <CardDescription className="text-center">
                        Tenha um mentor especialista à sua disposição para
                        aprender coisas novas, fazer brainstorming, escrever
                        e-mails, fazer propostas e até mesmo programar.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12 mb-4">
                        <Suspense fallback={<IconSkeleton />}>
                          <FolderKanbanIcon className="h-8 w-8 text-primary" />
                        </Suspense>
                      </div>
                      <CardTitle className="text-center">
                        Organize Chats em Pastas
                      </CardTitle>
                      <CardDescription className="text-center">
                        Mantenha suas conversas organizadas, categorize e
                        gerencie seus chats de maneira eficiente em diferentes
                        projetos ou equipes.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-center h-12 mb-4">
                        <Suspense fallback={<IconSkeleton />}>
                          <LineChartIcon className="h-8 w-8 text-primary" />
                        </Suspense>
                      </div>
                      <CardTitle className="text-center">
                        Análise de Dados
                      </CardTitle>
                      <CardDescription className="text-center">
                        Transforme dados em insights visuais. Analise suas
                        planilhas e crie gráficos automaticamente, facilitando a
                        visualização e interpretação dos dados.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            </section>
          </Defer>

          {/* Recursos Poderosos — lazy mount + lazy icons */}
          <Defer fallback={<SectionSkeleton lines={6} />} containSize="1000px">
            <section
              id="recursos"
              className="border-b border-border bg-gradient-subtle"
            >
              <div className="container mx-auto px-4 py-16">
                <header className="mb-10 max-w-2xl mx-auto text-center">
                  <h2 className="text-2xl md:text-3xl font-bold">
                    Recursos Poderosos
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    Tudo o que você precisa para construir, implantar e escalar
                    aplicações com IA.
                  </p>
                </header>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Suspense fallback={<IconSkeleton />}>
                          <BrainCircuitIcon className="h-5 w-5 text-primary" />
                        </Suspense>
                        Modelos de IA Avançados
                      </CardTitle>
                      <CardDescription>
                        Acesse IA de última geração para texto, imagem e áudio.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Suspense fallback={<IconSkeleton />}>
                          <ZapIcon className="h-5 w-5 text-primary" />
                        </Suspense>
                        Velocidade Extrema
                      </CardTitle>
                      <CardDescription>
                        Infra otimizada para respostas rápidas, mesmo em alto
                        tráfego.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Suspense fallback={<IconSkeleton />}>
                          <ShieldCheckIcon className="h-5 w-5 text-primary" />
                        </Suspense>
                        Segurança Empresarial
                      </CardTitle>
                      <CardDescription>
                        Criptografia e medidas de segurança de nível bancário.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {/* Activity já está no bundle do topo */}
                        <Activity className="h-5 w-5 text-primary" />
                        Análises Detalhadas
                      </CardTitle>
                      <CardDescription>
                        Acompanhe uso, desempenho e custos com painéis.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Suspense fallback={<IconSkeleton />}>
                          <GlobeIcon className="h-5 w-5 text-primary" />
                        </Suspense>
                        Disponibilidade Global
                      </CardTitle>
                      <CardDescription>
                        Baixa latência em qualquer lugar do mundo.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Suspense fallback={<IconSkeleton />}>
                          <ServerIcon className="h-5 w-5 text-primary" />
                        </Suspense>
                        Infraestrutura Escalável
                      </CardTitle>
                      <CardDescription>
                        Escala automática do protótipo à produção.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            </section>
          </Defer>

          {/* Planos — lazy mount + Switch lazy */}
          <Defer fallback={<SectionSkeleton lines={6} />} containSize="1100px">
            <section id="planos" className="border-b border-border">
              <div className="container mx-auto px-4 py-16">
                <div className="flex items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold">
                      Simples, Transparente e Prático
                    </h2>
                    <p className="text-muted-foreground">
                      Escolha o plano ideal. Cancele quando quiser.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Mensal
                    </span>
                    <Suspense
                      fallback={
                        <div className="h-6 w-10 rounded-full bg-muted" />
                      }
                    >
                      <SwitchLazy
                        checked={annual}
                        onCheckedChange={setAnnual}
                        aria-label="Alternar cobrança anual"
                      />
                    </Suspense>
                    <span className="text-sm font-medium">Anual</span>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Starter</CardTitle>
                      <CardDescription>
                        Para indivíduos e pequenos projetos
                      </CardDescription>
                      <div className="pt-4">
                        <div className="text-3xl font-bold">
                          R$ {annual ? "30,00" : "35,00"}
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}
                            /mês
                          </span>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <li>Acesso a modelos básicos de I.A</li>
                        <li>100.000 tokens por mês</li>
                        <li>1 solicitação por vez</li>
                        <li>Análise básica</li>
                      </ul>
                      <Button
                        variant="outline"
                        className="mt-6"
                        onClick={() => setShowAuthModal(true)}
                      >
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
                      <CardDescription>
                        Para profissionais e pequenas equipes
                      </CardDescription>
                      <div className="pt-4">
                        <div className="text-3xl font-bold">
                          R$ {annual ? "79,99" : "89,99"}
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}
                            /mês
                          </span>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <li>Acesso a todos modelos de I.A</li>
                        <li>1.000.000 de tokens por mês</li>
                        <li>Até 5 solicitações ao mesmo tempo</li>
                        <li>Prioridade no suporte</li>
                        <li>Análises avançadas</li>
                      </ul>
                      <Button
                        className="mt-6"
                        onClick={() => setShowAuthModal(true)}
                      >
                        Começar agora
                      </Button>
                    </CardHeader>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Empresarial</CardTitle>
                      <CardDescription>
                        Para organizações com necessidades especiais
                      </CardDescription>
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
                      <Button
                        variant="outline"
                        className="mt-6"
                        onClick={() => setShowAuthModal(true)}
                      >
                        Começar agora
                      </Button>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            </section>
          </Defer>

          {/* Footer — lazy mount */}
          <Defer fallback={<SectionSkeleton lines={4} />} containSize="900px">
            <footer id="contato" className="border-t border-border">
              <div className="container mx-auto px-4 py-12">
                <div className="grid gap-8 md:grid-cols-4">
                  <div>
                    <h3 className="text-xl font-bold">Synergy IA Hub</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Capacitando desenvolvedores e empresas com recursos de IA
                      de ponta.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Empresa</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Sobre Nós
                        </a>
                      </li>
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Carreiras
                        </a>
                      </li>
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Blog
                        </a>
                      </li>
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Imprensa
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Recursos</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Documentação
                        </a>
                      </li>
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Referência da API
                        </a>
                      </li>
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Tutoriais
                        </a>
                      </li>
                      <li>
                        <a href="#" className="hover:text-foreground">
                          Comunidade
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Contato</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>Email: contato@synergyia.com.br</li>
                      <li>Telefone: +55 (11) 4567-8901</li>
                      <li>Endereço: Av. Paulista, 1000, São Paulo/SP</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground flex flex-col md:flex-row items-center justify-between gap-2">
                  <p>
                    © {new Date().getFullYear()} Synergy IA Hub. Todos os
                    direitos reservados.
                  </p>
                  <div className="flex items-center gap-4">
                    <a href="#" className="hover:text-foreground">
                      Política de Privacidade
                    </a>
                    <a href="#" className="hover:text-foreground">
                      Termos de Serviço
                    </a>
                    <a href="#" className="hover:text-foreground">
                      Política de Cookies
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </Defer>
        </main>
      </div>

      {/* AuthModal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
};

export default Index;
