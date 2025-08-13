import { useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Share = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const title = useMemo(() => params.get("title") || "Compartilhar" , [params]);
  const text = useMemo(() => params.get("text") || "Veja isto!", [params]);
  const url = useMemo(() => params.get("url") || "", [params]);

  useEffect(() => {
    document.title = `${title} | Synergy AI`;
    const desc = `Compartilhar conteúdo: ${text.slice(0, 140)}`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${window.location.origin}/share`;
  }, [title, text]);

  useEffect(() => {
    const tryShare = async () => {
      if (!url) return;
      try {
        if (navigator.share) {
          await navigator.share({ title, text, url });
          // Fecha a aba caso tenha sido aberta especificamente para o compartilhamento
          if (window.opener) window.close();
        } else {
          throw new Error("Web Share API não suportada");
        }
      } catch (e) {
        // Mantém a página aberta e mostra os botões de fallback
        console.warn("Falha ao chamar share imediatamente:", e);
      }
    };
    tryShare();
  }, [title, text, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link Copiado", description: "Copiamos o link para você.", variant: "default" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar o link.", variant: "destructive" });
    }
  };

  const openLink = () => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const tryAgain = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        if (window.opener) window.close();
      } catch (e) {
        console.warn("Share cancelado ou falhou:", e);
      }
    } else {
      copy();
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <header>
              <h1 className="text-2xl font-bold text-foreground">Compartilhar</h1>
              <p className="text-muted-foreground mt-1">Use o botão abaixo para abrir o menu nativo de compartilhamento.</p>
            </header>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={tryAgain}>Abrir menu de compartilhamento</Button>
              <Button variant="outline" onClick={copy}>Copiar link</Button>
              <Button variant="outline" onClick={openLink}>Abrir link</Button>
              <Button variant="ghost" onClick={() => navigate(-1)}>Voltar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Share;
