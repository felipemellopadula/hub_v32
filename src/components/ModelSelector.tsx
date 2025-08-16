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
    { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', category: 'premium' as const },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', category: 'standard' as const },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', category: 'fast' as const },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', category: 'premium' as const },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', category: 'standard' as const },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', category: 'fast' as const },
    { id: 'o4-mini', name: 'o4 Mini', provider: 'OpenAI', category: 'fast' as const },
  ],
  'Anthropic': [
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'Anthropic', category: 'premium' as const },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', category: 'premium' as const },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'Anthropic', category: 'fast' as const },
  ],
  'DeepSeek': [
    { id: 'deepseek-chat', name: 'DeepSeek Chat V3', provider: 'DeepSeek', category: 'premium' as const },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek', category: 'premium' as const },
  ],
  'APILLM': [
    { id: 'Llama-4-Maverick-17B-128E-Instruct-FP8', name: 'Llama 4 Maverick', provider: 'APILLM', category: 'premium' as const },
    { id: 'Llama-4-Scout-17B-16E-Instruct-FP8', name: 'Llama 4 Scout', provider: 'APILLM', category: 'standard' as const },
  ],
  'xAI': [
    { id: 'grok-4-0709', name: 'Grok 4', provider: 'xAI', category: 'premium' as const },
    { id: 'grok-3', name: 'Grok 3', provider: 'xAI', category: 'standard' as const },
    { id: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xAI', category: 'fast' as const },
  ],
  'Google': [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', category: 'premium' as const },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', category: 'standard' as const },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: 'Google', category: 'fast' as const },
  ],
  'Meta': [
    { id: 'llama', name: 'Llama', provider: 'Meta', category: 'standard' as const },
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
    'Synergy': '/lovable-uploads/3f22acfa-6c56-4617-a7f6-cfe77f357e89.png',
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
                    {/* --- ALTERAÇÃO AQUI --- */}
                    {/* Adicionamos flex-1 e min-w-0 para que esta div ocupe o espaço e empurre o badge */}
                    <div className="flex flex-1 items-center space-x-3 min-w-0">
                      {model.id !== 'synergy-ia' && (
                        <div className="w-6 h-6 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                          <img
                            src={getProviderIcon(model.provider)}
                            alt={`${model.provider} logo`}
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex flex-col items-start min-w-0">
                        {model.id === 'synergy-ia' ? (
                          <span className="text-sm truncate font-bold flex items-center">
                            <div className="w-5 h-5 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden mr-2">
                              <img
                                src="/lovable-uploads/3f22acfa-6c56-4617-a7f6-cfe77f357e89.png"
                                alt="Ícone SynergyIA"
                                className="w-3.5 h-3.5 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
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
            _message:       </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};