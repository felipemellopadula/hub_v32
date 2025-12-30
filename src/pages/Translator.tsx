import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Languages, ArrowUpDown, Sparkles, Copy, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import UserProfile from "@/components/UserProfile";
import { useToast } from "@/hooks/use-toast";
import { useTokens } from "@/hooks/useTokens";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TranslatorPage = () => {
  const { toast } = useToast();
  const { checkTokenBalance, consumeTokens, getModelDisplayName } = useTokens();
  
  useEffect(() => {
    document.title = "Tradutor e Humanizar com Ia";
  }, []);
  
  // Translation state
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [translationModel] = useState("gpt-4o-mini");
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Humanization state
  const [humanizeInput, setHumanizeInput] = useState("");
  const [humanizedOutput, setHumanizedOutput] = useState("");
  const [isHumanizing, setIsHumanizing] = useState(false);

  const languages = [
    { code: "auto", name: "Detectar automaticamente", flag: "🌐" },
    { code: "pt", name: "Português (Brasil)", flag: "🇧🇷" },
    { code: "en", name: "English (USA)", flag: "🇺🇸" },
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "it", name: "Italiano", flag: "🇮🇹" },
    { code: "ja", name: "日本語", flag: "🇯🇵" },
    { code: "ko", name: "한국어", flag: "🇰🇷" },
    { code: "zh", name: "中文", flag: "🇨🇳" },
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "ar", name: "العربية", flag: "🇸🇦" }
  ];

  const getLanguageName = (code: string) => {
    const lang = languages.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast({
        title: "Erro",
        description: "Digite um texto para traduzir.",
        variant: "destructive"
      });
      return;
    }

    const hasTokens = await checkTokenBalance(translationModel);
    if (!hasTokens) return;

    setIsTranslating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Traduza o seguinte texto ${sourceLanguage === 'auto' ? 'detectando automaticamente o idioma de origem' : `do ${getLanguageName(sourceLanguage)}`} para ${getLanguageName(targetLanguage)}. Mantenha o tom, contexto e significado original. Responda APENAS com a tradução, sem explicações adicionais:\n\n${sourceText}`,
          model: translationModel
        }
      });

      if (error) throw error;

      if (data?.response) {
        setTranslatedText(data.response);
        await consumeTokens(translationModel, sourceText);
      }
    } catch (error) {
      console.error('Erro na tradução:', error);
      toast({
        title: "Erro na tradução",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleHumanize = async () => {
    if (!humanizeInput.trim()) {
      toast({
        title: "Erro",
        description: "Digite um texto para humanizar.",
        variant: "destructive"
      });
      return;
    }

    const hasTokens = await checkTokenBalance("gpt-4o-mini");
    if (!hasTokens) return;

    setIsHumanizing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `You are an expert in humanizing AI-generated texts.

CRITICAL RULE - LANGUAGE: You MUST respond in the EXACT SAME LANGUAGE as the input text. If the text is in English, respond in English. If it is in Portuguese, respond in Portuguese. If it is in Spanish, respond in Spanish. NEVER translate or change the language. This is mandatory.

Your task is to rewrite the provided text to sound more natural and human while keeping it in its original language.

Make the following improvements:
1. Add variations in tone and sentence rhythm
2. Use contractions and colloquial language appropriate for the detected language
3. Include natural connectors and smooth transitions
4. Vary sentence length to create flow
5. Add personal touches and more human expressions
6. Improve punctuation to create natural pauses
7. Remove robotic repetitions and AI patterns
8. Maintain the meaning and important information

The text should sound as if it were written by a real person, not a machine.
REMEMBER: Output MUST be in the same language as the input. Do NOT translate.

Text to humanize:
${humanizeInput}`,
          model: "gpt-4o-mini"
        }
      });

      if (error) throw error;

      if (data?.response) {
        setHumanizedOutput(data.response);
        await consumeTokens("gpt-4o-mini", humanizeInput);
      }
    } catch (error) {
      console.error('Erro na humanização:', error);
      toast({
        title: "Erro na humanização",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setIsHumanizing(false);
    }
  };

  const swapLanguages = () => {
    if (sourceLanguage === "auto") return;
    
    const newSource = targetLanguage;
    const newTarget = sourceLanguage;
    const newSourceText = translatedText;
    const newTranslatedText = sourceText;
    
    setSourceLanguage(newSource);
    setTargetLanguage(newTarget);
    setSourceText(newSourceText);
    setTranslatedText(newTranslatedText);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência."
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 pt-1 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Languages className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">
                Tradutor / Humanizar
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <UserProfile />
            
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Translation Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Tradutor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Selection */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1">
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={swapLanguages}
                      disabled={sourceLanguage === "auto"}
                      className="shrink-0"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Trocar idiomas</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex-1">
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.filter(lang => lang.code !== "auto").map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Translation Boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {getLanguageName(sourceLanguage)}
                  </span>
                  {sourceText && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(sourceText)}
                            className="h-7 w-7 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Textarea
                  placeholder="Digite o texto para traduzir..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  className="min-h-[200px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {getLanguageName(targetLanguage)}
                  </span>
                  {translatedText && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(translatedText)}
                            className="h-7 w-7 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Textarea
                  placeholder="A tradução aparecerá aqui..."
                  value={translatedText}
                  readOnly
                  className="min-h-[200px] resize-none bg-muted/30"
                />
              </div>
            </div>

            <Button
              onClick={handleTranslate}
              disabled={!sourceText.trim() || isTranslating}
              className="w-full sm:w-auto"
            >
              {isTranslating ? "Traduzindo..." : "Traduzir"}
            </Button>
          </CardContent>
        </Card>

        {/* Humanization Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Humanizar Texto de IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Texto gerado por IA</label>
                {humanizeInput && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(humanizeInput)}
                          className="h-7 w-7 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Textarea
                placeholder="Cole aqui o texto gerado por IA que deseja humanizar..."
                value={humanizeInput}
                onChange={(e) => setHumanizeInput(e.target.value)}
                className="min-h-[150px] resize-none"
              />
            </div>

            {humanizedOutput && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Texto humanizado</label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(humanizedOutput)}
                          className="h-7 w-7 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  value={humanizedOutput}
                  readOnly
                  className="min-h-[150px] resize-none bg-muted/30"
                />
              </div>
            )}

            <Button
              onClick={handleHumanize}
              disabled={!humanizeInput.trim() || isHumanizing}
              className="w-full sm:w-auto"
            >
              {isHumanizing ? "Humanizando..." : "Humanizar Texto"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TranslatorPage;