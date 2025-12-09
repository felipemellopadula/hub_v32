import { useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeepSeekThinkingIndicatorProps {
  isVisible: boolean;
  thinkingContent?: string;
}

export const DeepSeekThinkingIndicator = ({ isVisible, thinkingContent }: DeepSeekThinkingIndicatorProps) => {
  const [dots, setDots] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);

    return () => clearInterval(dotsInterval);
  }, [isVisible]);

  if (!isVisible) return null;

  const hasContent = thinkingContent && thinkingContent.length > 0;

  return (
    <div className="flex flex-col gap-0">
      {/* Header compacto */}
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 backdrop-blur-sm transition-all",
          isExpanded ? "rounded-t-xl" : "rounded-full",
          hasContent && "cursor-pointer hover:bg-violet-500/15"
        )}
      >
        <div className="p-1.5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
          <Brain className="w-3.5 h-3.5 text-white animate-pulse" />
        </div>
        
        <span className="text-xs font-medium text-violet-400">
          Pensando{dots}
        </span>
        
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "w-1 h-1 rounded-full bg-violet-400 transition-all duration-300",
                i < dots.length ? "opacity-100" : "opacity-30"
              )}
            />
          ))}
        </div>

        {hasContent && (
          <div className="ml-auto text-violet-400/60">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        )}
      </button>

      {/* Conteúdo expandido */}
      {isExpanded && hasContent && (
        <div className="px-3 py-2 bg-violet-500/5 border border-t-0 border-violet-500/20 rounded-b-xl max-h-40 overflow-y-auto">
          <p className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
            {thinkingContent}
            <span className="animate-pulse text-violet-400">▊</span>
          </p>
        </div>
      )}
    </div>
  );
};
