import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningDisplayProps {
  reasoning: string;
  className?: string;
}

export const ReasoningDisplay = ({ reasoning, className }: ReasoningDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reasoning || reasoning.trim().length === 0) return null;

  return (
    <div className={cn("mb-3", className)}>
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group"
      >
        <Sparkles className="h-4 w-4" />
        <span className="font-medium">Mostrar raciocínio</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Expanded Content - Gemini Style with fade-in animation */}
      {isExpanded && (
        <div className="mt-3 pl-4 border-l-2 border-blue-400/50 dark:border-blue-500/50 animate-fade-in">
          <div className="text-sm text-muted-foreground italic leading-relaxed whitespace-pre-wrap">
            {reasoning}
          </div>
        </div>
      )}
    </div>
  );
};
