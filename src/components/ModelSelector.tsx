import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Model {
  id: string;
  name: string;
  provider: string;
  category: 'premium' | 'standard' | 'fast';
}

const modelsByProvider = {
  'Synergy': [
    { id: 'synergy-ia', name: 'SynergyIA', provider: 'Synergy', category: 'fast' as const },
  ],
  'OpenAI': [
    { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI', category: 'premium' as const },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', category: 'standard' as const },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', category: 'fast' as const },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', category: 'premium' as const },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', category: 'standard' as const },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', category: 'fast' as const },
    { id: 'o4-mini', name: 'o4 Mini', provider: 'OpenAI', category: 'fast' as const },
  ],
  'Anthropic': [
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', provider: 'Anthropic', category: 'premium' as const },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', category: 'premium' as const },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic', category: 'fast' as const },
  ],
  'DeepSeek': [
    { id: 'deepseek-chat', name: 'DeepSeek Chat V3', provider: 'DeepSeek', category: 'premium' as const },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek', category: 'premium' as const },
  ],
  'META': [
    { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'APILLM', category: 'premium' as const },
    { id: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'APILLM', category: 'premium' as const },
    { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'APILLM', category: 'premium' as const },
    { id: 'llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', provider: 'APILLM', category: 'standard' as const },
    { id: 'llama-3.2-11b-instruct', name: 'Llama 3.2 11B Instruct', provider: 'APILLM', category: 'standard' as const },
    { id: 'llama-3.2-8b-instruct', name: 'Llama 3.2 8B Instruct', provider: 'APILLM', category: 'fast' as const },
    { id: 'llama-3.2-3b-instruct', name: 'Llama 3.2 3B Instruct', provider: 'APILLM', category: 'fast' as const },
    { id: 'llama-3.2-1b-instruct', name: 'Llama 3.2 1B Instruct', provider: 'APILLM', category: 'fast' as const },
  ],
  'xAI': [
    { id: 'grok-4', name: 'Grok 4', provider: 'xAI', category: 'premium' as const },
    { id: 'grok-3', name: 'Grok 3', provider: 'xAI', category: 'standard' as const },
    { id: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xAI', category: 'fast' as const },
  ],
  'Google': [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', category: 'premium' as const },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', category: 'standard' as const },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: 'Google', category: 'fast' as const },
  ],
};

interface ModelSelectorProps {
  onModelSelect: (modelId: string) => void;
  selectedModel?: string;
}

const getCategoryColor = (category: Model['category']) => {
  switch (category) {
    case 'premium': return 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground';
    case 'standard': return 'bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground';
    case 'fast': return 'bg-success text-success-foreground hover:bg-success hover:text-success-foreground';
    default: return 'bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground';
  }
};

const getProviderIcon = (provider: string) => {
  const iconMap: Record<string, string> = {
    'Synergy': '/images/synergy-icon.webp',
    'OpenAI': '/images/logos/openai.svg',
    'Anthropic': '/images/logos/anthropic.svg',
    'Google': '/images/logos/gemini.svg',
    'DeepSeek': '/images/logos/deepseek.svg',
    'xAI': '/images/logos/xai.svg',
    'Meta': '/images/logos/meta.svg',
    'APILLM': '/images/logos/apillm.svg',
  };
  return iconMap[provider] || '/images/logos/openai.svg';
};

export const ModelSelector = ({ onModelSelect, selectedModel }: ModelSelectorProps) => {

  useEffect(() => {
    const uniqueIconUrls = new Set<string>();
    Object.values(modelsByProvider).flat().forEach(model => {
      uniqueIconUrls.add(getProviderIcon(model.provider));
    });
    uniqueIconUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  return (
    <div className="w-full max-w-sm">
      <Select onValueChange={onModelSelect} value={selectedModel}>
        <SelectTrigger className="w-full bg-card border-border">
          <SelectValue placeholder="Modelos de IA" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border max-h-60">
          {Object.entries(modelsByProvider).map(([provider, models]) => (
            <div key={provider}>
              <div className="px-2 py-1.5 text-sm font-semibold text-foreground border-b border-border/50">
                {provider}
              </div>
              {models.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  className="cursor-pointer pl-6"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex flex-1 items-center space-x-3 min-w-0">
                      {model.id !== 'synergy-ia' && (
                        <div className="w-6 h-6 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                          {/* --- ALTERAÇÃO 1: img -> div com background-image --- */}
                          <div
                            role="img"
                            aria-label={`${model.provider} logo`}
                            className="w-4 h-4"
                            style={{
                              backgroundImage: `url(${getProviderIcon(model.provider)})`,
                              backgroundSize: 'contain',
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'center',
                            }}
                          />
                        </div>
                      )}
                      <div className="flex flex-col items-start min-w-0">
                        {model.id === 'synergy-ia' ? (
                          <span className="text-sm truncate font-bold flex items-center">
                            <div className="w-5 h-5 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden mr-2">
                              {/* --- ALTERAÇÃO 2: img -> div com background-image --- */}
                              <div
                                role="img"
                                aria-label="Ícone SynergyIA"
                                className="w-3.5 h-3.5"
                                style={{
                                  backgroundImage: `url(/images/synergy-icon.webp)`,
                                  backgroundSize: 'contain',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'center',
                                }}
                              />
                            </div>
                            SynergyIA
                          </span>
                        ) : (
                          <span className="font-medium text-sm truncate">{model.name}</span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`ml-2 text-xs flex-shrink-0 ${getCategoryColor(model.category)}`}
                    >
                      {model.category}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};