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
  { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', provider: 'OpenAI', category: 'premium' },
  { id: 'o3-2025-04-16', name: 'o3 (Reasoning)', provider: 'OpenAI', category: 'premium' },
  { id: 'o4-mini-2025-04-16', name: 'o4 Mini', provider: 'OpenAI', category: 'fast' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', category: 'standard' },
  
  // Anthropic Models
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', category: 'premium' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'Anthropic', category: 'fast' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic', category: 'standard' },
  
  // DeepSeek Models
  { id: 'deepseek-chat', name: 'DeepSeek Chat V3', provider: 'DeepSeek', category: 'premium' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek', category: 'premium' },
  
  // APILLM Models
  { id: 'llama-4-scout-17b', name: 'LLaMA 4 Scout 17B', provider: 'APILLM', category: 'standard' },
  { id: 'mixtral-8x7b-instruct', name: 'Mixtral 8x7b Instruct', provider: 'APILLM', category: 'standard' },
  { id: 'qwen-2.5-72b-chat', name: 'Qwen 2.5 72B Chat', provider: 'APILLM', category: 'standard' },
  
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
                <div className="flex flex-col items-start">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.provider}</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`ml-2 text-xs ${getCategoryColor(model.category)}`}
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