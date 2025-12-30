import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import UserProfile from "@/components/UserProfile";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, ArrowLeft, FileText, Mail, MessageSquare, Newspaper, Globe, Briefcase, Star, Zap, Smile, PenTool, Coffee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Write = () => {
  const [prompt, setPrompt] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("Ensaio");
  const [selectedTone, setSelectedTone] = useState("Formal");
  const [selectedLength, setSelectedLength] = useState("Médio");

  useEffect(() => {
    document.title = "Gerar textos com Ia";
  }, []);

  const formatOptions = [
    { id: "Ensaio", label: "Ensaio", icon: FileText },
    { id: "Parágrafo", label: "Parágrafo", icon: FileText },
    { id: "Email", label: "Email", icon: Mail },
    { id: "Ideia", label: "Ideia", icon: MessageSquare },
    { id: "Post de Blog", label: "Post de Blog", icon: Newspaper },
    { id: "Contorno", label: "Contorno", icon: FileText },
    { id: "Marketing", label: "Marketing", icon: Globe },
    { id: "Comentário", label: "Comentário", icon: MessageSquare },
    { id: "Mensagem", label: "Mensagem", icon: MessageSquare },
    { id: "Twitter", label: "Twitter", icon: MessageSquare }
  ];

  const toneOptions = [
    { id: "Formal", label: "Formal", icon: Briefcase },
    { id: "Casual", label: "Casual", icon: Coffee },
    { id: "Profissional", label: "Profissional", icon: Star },
    { id: "Entusiasmado", label: "Entusiasmado", icon: Zap },
    { id: "Informativo", label: "Informativo", icon: FileText },
    { id: "Engraçado", label: "Engraçado", icon: Smile }
  ];

  const lengthOptions = [
    { id: "Curto", label: "Curto" },
    { id: "Médio", label: "Médio" },
    { id: "Longo", label: "Longo" }
  ];

  const handleGenerate = async () => {
    console.log('🚀 Iniciando geração de conteúdo...');
    console.log('📝 Prompt:', prompt);
    console.log('🎨 Formato:', selectedFormat);
    console.log('🎵 Tom:', selectedTone);
    console.log('📏 Comprimento:', selectedLength);
    
    if (!prompt.trim()) {
      console.log('❌ Prompt vazio - cancelando');
      return;
    }

    setIsLoading(true);
    console.log('⏳ Loading iniciado...');
    
    try {
      console.log('🌐 Chamando edge function via Supabase...');
      
      const requestBody = {
        prompt,
        format: selectedFormat,
        tone: selectedTone,
        length: selectedLength
      };
      console.log('📦 Body da requisição:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('write-content', {
        body: requestBody
      });

      console.log('📡 Response data:', data);
      console.log('📡 Response error:', error);

      if (error) {
        console.error('❌ Erro na chamada da função:', error);
        throw new Error(`Erro ao gerar conteúdo: ${error.message}`);
      }
      
      if (!data || !data.generatedText) {
        console.error('❌ Dados inválidos recebidos:', data);
        throw new Error('Resposta inválida da função');
      }
      
      console.log('📄 Texto gerado:', data.generatedText);
      setGeneratedText(data.generatedText);
      console.log('🎉 Conteúdo gerado com sucesso!');
    } catch (error) {
      console.error('💥 Erro completo:', error);
      console.error('💥 Erro message:', error.message);
      console.error('💥 Erro stack:', error.stack);
      setGeneratedText("Desculpe, ocorreu um erro ao gerar o conteúdo. Tente novamente.");
    } finally {
      setIsLoading(false);
      console.log('🏁 Loading finalizado');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 pt-1 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <div className="flex items-center gap-2">
              <PenTool className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Escrever</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <UserProfile />
            
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Input Section */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <label htmlFor="prompt" className="block text-sm font-medium text-foreground">
                  Que tópico você quer que eu componha?
                </label>
                <Textarea
                  id="prompt"
                  placeholder="Digite Enter ou gere rascunho"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Options Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Format */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Formato
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {formatOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.id}
                        variant={selectedFormat === option.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFormat(option.id)}
                        className="justify-start text-xs h-8"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tone */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Smile className="h-4 w-4" />
                  Tom
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {toneOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.id}
                        variant={selectedTone === option.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTone(option.id)}
                        className="justify-start text-xs h-8"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Length */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Comprimento
                </h3>
                <div className="space-y-2">
                  {lengthOptions.map((option) => (
                    <Button
                      key={option.id}
                      variant={selectedLength === option.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedLength(option.id)}
                      className="w-full justify-start text-xs h-8"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Generate Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
              size="lg"
              className="px-8"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando rascunho...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Gerar rascunho
                </>
              )}
            </Button>
          </div>

          {/* Generated Content */}
          {generatedText && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Conteúdo Gerado
                  </h3>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{selectedFormat}</Badge>
                    <Badge variant="secondary">{selectedTone}</Badge>
                    <Badge variant="secondary">{selectedLength}</Badge>
                  </div>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {generatedText}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Write;