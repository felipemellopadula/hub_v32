import { useEffect, useState, useRef, useMemo } from 'react';
import { Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DeepSeekThinkingIndicatorProps {
  isVisible: boolean;
  thinkingContent?: string;
  modelName?: string;
}

export const DeepSeekThinkingIndicator = ({ 
  isVisible, 
  thinkingContent,
  modelName 
}: DeepSeekThinkingIndicatorProps) => {
  const [dots, setDots] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Determine provider for styling
  const provider = useMemo(() => {
    if (!modelName) return 'default';
    if (modelName.includes('claude')) return 'claude';
    if (modelName.includes('gemini')) return 'gemini';
    if (modelName.includes('deepseek')) return 'deepseek';
    if (modelName.includes('gpt') || modelName.includes('o4')) return 'openai';
    return 'default';
  }, [modelName]);

  const providerStyles = {
    claude: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      gradient: 'from-amber-500 to-orange-600',
      text: 'text-amber-400',
      label: 'Claude thinking',
      icon: Brain,
    },
    gemini: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      gradient: 'from-blue-500 to-cyan-600',
      text: 'text-blue-400',
      label: 'Gemini thinking',
      icon: Sparkles,
    },
    deepseek: {
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      gradient: 'from-violet-500 to-purple-600',
      text: 'text-violet-400',
      label: 'DeepSeek thinking',
      icon: Brain,
    },
    openai: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      gradient: 'from-emerald-500 to-teal-600',
      text: 'text-emerald-400',
      label: 'Reasoning',
      icon: Brain,
    },
    default: {
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      gradient: 'from-violet-500 to-purple-600',
      text: 'text-violet-400',
      label: 'Thinking',
      icon: Brain,
    },
  };

  const style = providerStyles[provider];
  const IconComponent = style.icon;

  useEffect(() => {
    if (!isVisible) return;

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);

    return () => clearInterval(dotsInterval);
  }, [isVisible]);

  // Animate content appearance
  useEffect(() => {
    if (isExpanded && thinkingContent) {
      const timer = setTimeout(() => setShowContent(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isExpanded, thinkingContent]);

  // Auto-scroll to the end when content changes
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinkingContent, isExpanded]);

  if (!isVisible) return null;

  const hasContent = thinkingContent && thinkingContent.length > 0;

  return (
    <div className="flex flex-col gap-0 animate-fade-in">
      {/* Header */}
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 backdrop-blur-sm transition-all duration-300",
          style.bg,
          "border",
          style.border,
          isExpanded && hasContent ? "rounded-t-xl" : "rounded-full",
          hasContent && "cursor-pointer hover:brightness-110"
        )}
      >
        {/* Animated icon */}
        <div className={cn(
          "p-1.5 rounded-full bg-gradient-to-br transition-transform duration-300",
          style.gradient,
          isExpanded && "scale-110"
        )}>
          <IconComponent className="w-3.5 h-3.5 text-white animate-pulse" />
        </div>
        
        <span className={cn("text-xs font-medium", style.text)}>
          {style.label}{dots}
        </span>
        
        {/* Animated dots */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                style.text.replace('text-', 'bg-'),
                i < dots.length ? "opacity-100 scale-100" : "opacity-30 scale-75"
              )}
              style={{
                animationDelay: `${i * 100}ms`
              }}
            />
          ))}
        </div>

        {hasContent && (
          <div className={cn("ml-auto transition-transform duration-200", style.text.replace('400', '400/60'))}>
            <div className={cn(
              "transition-transform duration-200",
              isExpanded ? "rotate-180" : "rotate-0"
            )}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        )}
      </button>

      {/* Expanded content with animation */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isExpanded && hasContent ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div 
          ref={contentRef}
          className={cn(
            "px-4 py-3 border border-t-0 rounded-b-xl overflow-y-auto transition-all duration-200",
            style.bg,
            style.border,
            showContent ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          )}
          style={{ maxHeight: '200px' }}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2 last:mb-0">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className={cn("font-semibold", style.text)}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="text-muted-foreground/80">{children}</em>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 my-2">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 my-2">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-xs">{children}</li>
                ),
                code: ({ children }) => (
                  <code className={cn(
                    "px-1 py-0.5 rounded text-xs font-mono",
                    style.bg,
                    style.text
                  )}>
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className={cn(
                    "border-l-2 pl-3 my-2 italic text-xs text-muted-foreground/70",
                    style.border
                  )}>
                    {children}
                  </blockquote>
                ),
              }}
            >
              {thinkingContent || ''}
            </ReactMarkdown>
            <span className={cn("animate-pulse", style.text)}>▊</span>
          </div>
        </div>
      </div>
    </div>
  );
};
