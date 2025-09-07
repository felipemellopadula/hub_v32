// Heavy sections below the fold - loaded lazily
import { lazy, Suspense, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Lazy load Button to reduce initial bundle
const Button = lazy(() => import("@/components/ui/button").then(m => ({ default: m.Button })));

// Lazy load icons used below the fold
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

// Lazy load Switch for pricing toggle
const SwitchLazy = lazy(() =>
  import("@/components/ui/switch").then((m) => ({ default: m.Switch }))
);

const IconSkeleton = () => <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />;

const LandingSections = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <>
      {/* Principais Modelos de IA */}
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
                    loading="lazy"
                    decoding="async"
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
                    loading="lazy"
                    decoding="async"
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
                    loading="lazy"
                    decoding="async"
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
                  <img
                    src="/images/logos/deepseek.svg"
                    alt="Logo DeepSeek"
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-auto"
                  />
                </div>
                <CardTitle className="text-center">DeepSeek</CardTitle>
                <CardDescription className="text-center">
                  Modelo avançado especializado em raciocínio lógico
                  e resolução de problemas complexos.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Ferramentas */}
      <section id="ferramentas" className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <header className="mb-10 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold">
              Ferramentas Poderosas
            </h2>
            <p className="text-muted-foreground mt-2">
              Recursos avançados para maximizar sua produtividade com IA
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Suspense fallback={<IconSkeleton />}>
                    <BrainCircuitIcon className="h-8 w-8 text-primary" />
                  </Suspense>
                  <CardTitle>Chat Inteligente</CardTitle>
                </div>
                <CardDescription>
                  Converse com múltiplos modelos de IA em uma única interface.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Suspense fallback={<IconSkeleton />}>
                    <FileTextIcon className="h-8 w-8 text-primary" />
                  </Suspense>
                  <CardTitle>Criação de Conteúdo</CardTitle>
                </div>
                <CardDescription>
                  Gere textos, artigos e documentos profissionais.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Suspense fallback={<IconSkeleton />}>
                    <LayersIcon className="h-8 w-8 text-primary" />
                  </Suspense>
                  <CardTitle>Geração de Imagens</CardTitle>
                </div>
                <CardDescription>
                  Crie imagens incríveis com modelos de IA avançados.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-16">
          <header className="mb-10 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold">
              Planos Simples e Transparentes
            </h2>
            <p className="text-muted-foreground mt-2">
              Escolha o plano ideal para suas necessidades
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className={annual ? "text-muted-foreground" : "font-semibold"}>
                Mensal
              </span>
              <Suspense fallback={<div className="h-6 w-11 bg-muted rounded-full" />}>
                <SwitchLazy
                  checked={annual}
                  onCheckedChange={setAnnual}
                />
              </Suspense>
              <span className={annual ? "font-semibold" : "text-muted-foreground"}>
                Anual
              </span>
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            <Card className="bg-card border-border">
              <CardHeader className="text-center">
                <CardTitle>Básico</CardTitle>
                <div className="text-3xl font-bold">
                  R$ {annual ? "29" : "39"}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{annual ? "mês" : "mês"}
                  </span>
                </div>
                <CardDescription>
                  Ideal para uso pessoal e projetos pequenos
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-primary text-primary-foreground border-primary">
              <CardHeader className="text-center">
                <CardTitle>Pro</CardTitle>
                <div className="text-3xl font-bold">
                  R$ {annual ? "59" : "79"}
                  <span className="text-sm opacity-80 font-normal">
                    /{annual ? "mês" : "mês"}
                  </span>
                </div>
                <CardDescription className="text-primary-foreground/80">
                  Para profissionais e empresas
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="text-center">
                <CardTitle>Enterprise</CardTitle>
                <div className="text-3xl font-bold">
                  R$ {annual ? "199" : "249"}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{annual ? "mês" : "mês"}
                  </span>
                </div>
                <CardDescription>
                  Soluções personalizadas para grandes equipes
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-xl font-bold mb-4">
              Pronto para começar?
            </h3>
            <p className="text-muted-foreground mb-6">
              Junte-se a milhares de usuários que já potencializaram seus projetos com IA
            </p>
            <Suspense fallback={<div className="h-10 w-24 bg-muted rounded animate-pulse" />}>
              <Button size="lg" className="shadow-glow">
                Começar Gratuitamente
              </Button>
            </Suspense>
          </div>
        </div>
      </footer>
    </>
  );
};

export default LandingSections;