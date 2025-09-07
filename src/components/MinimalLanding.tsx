// Ultra-minimal landing page component with no heavy dependencies
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface MinimalLandingProps {
  user: any;
  onShowAuth: () => void;
}

export const MinimalLanding = ({ user, onShowAuth }: MinimalLandingProps) => {
  const navigate = useNavigate();
  
  // Theme detection with minimal reflows
  const [isLight, setIsLight] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("light")
      : true
  );

  const logoSrc = isLight
    ? "/lovable-uploads/5e06d662-7533-4ca8-a35e-3167dc0f31e6.png"
    : "/lovable-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png";

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePrimaryCta = useCallback(() => {
    if (user) navigate("/dashboard");
    else onShowAuth();
  }, [user, navigate, onShowAuth]);

  useEffect(() => {
    // Theme observer
    const apply = () =>
      setIsLight(document.documentElement.classList.contains("light"));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal Header */}
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
            <button
              onClick={() => scrollToSection("modelos")}
              className="hover:text-foreground transition-colors"
            >
              Soluções
            </button>
            <button
              onClick={() => scrollToSection("planos")}
              className="hover:text-foreground transition-colors"
            >
              Planos
            </button>
            <button
              onClick={() => scrollToSection("contato")}
              className="hover:text-foreground transition-colors"
            >
              Contato
            </button>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handlePrimaryCta}
              className="px-3 py-1.5 text-xs sm:text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {user ? "Dashboard" : "Login"}
            </button>
          </div>
        </div>
      </header>

      {/* Minimal Hero */}
      <section className="border-b border-border bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground">
              <span className="h-2 w-2 bg-primary rounded-full animate-pulse"></span>
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
              <button
                onClick={() => scrollToSection("planos")}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
              >
                Começar Agora
              </button>
              <button
                onClick={() => scrollToSection("modelos")}
                className="px-6 py-3 border border-border bg-background text-foreground rounded-md hover:bg-muted/50 transition-colors"
              >
                Ver Modelos
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Placeholder for heavy sections */}
      <div id="modelos" className="py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-96 mx-auto"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-40 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div id="planos" className="py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-80 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-64 mx-auto"></div>
            <div className="grid gap-4 md:grid-cols-3 mt-8 max-w-5xl mx-auto">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-60 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div id="contato" className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-48 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-96 mx-auto"></div>
            <div className="h-12 bg-muted rounded w-48 mx-auto mt-6"></div>
          </div>
        </div>
      </div>
    </div>
  );
};