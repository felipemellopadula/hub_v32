// Minimal landing page that loads only essential code initially
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Load components lazily with proper exports
const MinimalLanding = lazy(() => import("@/components/MinimalLanding").then(m => ({ default: m.MinimalLanding })));
const LandingHeader = lazy(() => import("@/components/LandingHeader").then(m => ({ default: m.LandingHeader })));
const LandingHero = lazy(() => import("@/components/LandingHero").then(m => ({ default: m.LandingHero })));
const LandingSections = lazy(() => import("@/components/LandingSections"));
const AuthModal = lazy(() => import("@/components/AuthModal").then(m => ({ default: m.AuthModal })));

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [enhancedVersion, setEnhancedVersion] = useState(false);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    // Set title immediately
    document.title = "Synergy AI Hub – Modelos de IA, Recursos e Planos";

    // Progressive enhancement - load full version after initial render
    const enhanceTimer = setTimeout(() => {
      setEnhancedVersion(true);
    }, 100);

    // Defer non-critical tasks
    let id: number | NodeJS.Timeout = 0;
    
    if (typeof requestIdleCallback !== 'undefined') {
      id = requestIdleCallback(() => {
        // Preload other logo for smooth theme switching
        const otherLogo = new Image();
        otherLogo.decoding = "async";
        otherLogo.src = document.documentElement.classList.contains("light")
          ? "/lovable-uploads/76f92d5d-608b-47a5-a829-bdb436a60274.png"
          : "/lovable-uploads/5e06d662-7533-4ca8-a35e-3167dc0f31e6.png";

        // Set meta description
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

        // Add canonical link
        let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.setAttribute("rel", "canonical");
          document.head.appendChild(link);
        }
        link.setAttribute("href", window.location.href);
      });
    } else {
      id = setTimeout(() => {}, 1);
    }

    return () => {
      clearTimeout(enhanceTimer);
      if (typeof requestIdleCallback !== 'undefined' && typeof id === 'number') {
        cancelIdleCallback(id as number);
      } else {
        clearTimeout(id as NodeJS.Timeout);
      }
    };
  }, []);

  // Show loading while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show minimal version first for fastest loading
  if (!enhancedVersion) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <MinimalLanding 
          user={user} 
          onShowAuth={() => setShowAuthModal(true)} 
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <LandingHeader 
          user={user} 
          onShowAuth={() => setShowAuthModal(true)} 
        />
        
        <main>
          <LandingHero
            user={user}
            onShowAuth={() => setShowAuthModal(true)}
            onScrollToSection={scrollToSection}
          />
          
          <LandingSections />
        </main>

        {/* Auth modal */}
        {showAuthModal && (
          <AuthModal 
            isOpen={showAuthModal} 
            onClose={() => setShowAuthModal(false)} 
          />
        )}
      </Suspense>
    </div>
  );
};

export default Index;