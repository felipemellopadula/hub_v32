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

const models: Model[] = [
  // OpenAI Models
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', category: 'premium' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', category: 'fast' },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', category: 'fast' },
  
  // Anthropic Models - Claude 4 generation
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', provider: 'Anthropic', category: 'premium' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', category: 'premium' },
  
  // DeepSeek Models
  { id: 'deepseek-chat', name: 'DeepSeek Chat V3', provider: 'DeepSeek', category: 'premium' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek', category: 'premium' },
  
  // APILLM Models  
  { id: 'Llama-4-Maverick-17B-128E-Instruct-FP8', name: 'Llama 4 Maverick', provider: 'APILLM', category: 'premium' },
  { id: 'Llama-4-Scout-17B-16E-Instruct-FP8', name: 'Llama 4 Scout', provider: 'APILLM', category: 'standard' },
  
  // xAI Models
  { id: 'grok-beta', name: 'Grok Beta', provider: 'xAI', category: 'standard' },
  
  // Google Models
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'Google', category: 'fast' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', category: 'standard' },
  
  // Meta Models (via OpenAI)
  { id: 'llama', name: 'Llama', provider: 'Meta', category: 'standard' },
];

interface ModelSelectorProps {
  onModelSelect: (modelId: string) => void;
  selectedModel?: string;
}

const getCategoryColor = (category: Model['category']) => {
  switch (category) {
    case 'premium': return 'bg-primary text-primary-foreground';
    case 'standard': return 'bg-secondary text-secondary-foreground';
    case 'fast': return 'bg-success text-success-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getProviderIcon = (provider: string) => {
  const iconMap: Record<string, string> = {
    'OpenAI': '/logos/openai.svg',
    'Anthropic': '/logos/anthropic.svg', 
    'Google': '/logos/google.svg',
    'DeepSeek': '/logos/deepseek.svg',
    'xAI': '/logos/xai.svg',
    'Meta': '/logos/meta.svg',
    'APILLM': '/logos/apillm.svg',
  };
  return iconMap[provider] || '/logos/openai.svg';
};

export const ModelSelector = ({ onModelSelect, selectedModel }: ModelSelectorProps) => {
  return (
    <div className="w-full max-w-sm">
      <Select onValueChange={onModelSelect} value={selectedModel} defaultValue="">
        <SelectTrigger className="w-full bg-card border-border">
          <SelectValue placeholder="Modelo de I.A" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border max-h-60">
          {models.map((model) => (
            <SelectItem 
              key={model.id} 
              value={model.id}
              className="cursor-pointer hover:bg-accent"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img 
                      src={getProviderIcon(model.provider)} 
                      alt={`${model.provider} logo`}
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-medium text-sm truncate">{model.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{model.provider}</span>
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
        </SelectContent>
      </Select>
    </div>
  );
};