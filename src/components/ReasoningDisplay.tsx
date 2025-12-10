import { useState, useMemo } from 'react';
import { ChevronDown, Brain, Sparkles, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReasoningDisplayProps {
  reasoning: string;
  modelName?: string;
  className?: string;
}

export const ReasoningDisplay = ({ reasoning, modelName, className }: ReasoningDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine provider for styling
  const provider = useMemo(() => {
    if (!modelName) return 'default';
    if (modelName.includes('claude')) return 'claude';
    if (modelName.includes('gemini')) return 'gemini';
    if (modelName.includes('deepseek')) return 'deepseek';
    if (modelName.includes('gpt') || modelName.includes('o4')) return 'openai';
    return 'default';
  }, [modelName]);

  const providerConfig = {
    claude: {
      bg: 'bg-amber-500/5',
      hoverBg: 'hover:bg-amber-500/10',
      border: 'border-amber-500/20',
      borderAccent: 'border-l-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      textMuted: 'text-amber-600/70 dark:text-amber-400/70',
      label: 'Claude Extended Thinking',
      icon: Brain,
      gradient: 'from-amber-500/20 to-orange-500/20',
    },
    gemini: {
      bg: 'bg-blue-500/5',
      hoverBg: 'hover:bg-blue-500/10',
      border: 'border-blue-500/20',
      borderAccent: 'border-l-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      textMuted: 'text-blue-600/70 dark:text-blue-400/70',
      label: 'Gemini Thinking',
      icon: Sparkles,
      gradient: 'from-blue-500/20 to-cyan-500/20',
    },
    deepseek: {
      bg: 'bg-violet-500/5',
      hoverBg: 'hover:bg-violet-500/10',
      border: 'border-violet-500/20',
      borderAccent: 'border-l-violet-500',
      text: 'text-violet-600 dark:text-violet-400',
      textMuted: 'text-violet-600/70 dark:text-violet-400/70',
      label: 'DeepSeek Reasoning',
      icon: Brain,
      gradient: 'from-violet-500/20 to-purple-500/20',
    },
    openai: {
      bg: 'bg-emerald-500/5',
      hoverBg: 'hover:bg-emerald-500/10',
      border: 'border-emerald-500/20',
      borderAccent: 'border-l-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
      textMuted: 'text-emerald-600/70 dark:text-emerald-400/70',
      label: 'OpenAI Reasoning',
      icon: Lightbulb,
      gradient: 'from-emerald-500/20 to-teal-500/20',
    },
    default: {
      bg: 'bg-primary/5',
      hoverBg: 'hover:bg-primary/10',
      border: 'border-primary/20',
      borderAccent: 'border-l-primary',
      text: 'text-primary',
      textMuted: 'text-primary/70',
      label: 'Reasoning',
      icon: Brain,
      gradient: 'from-primary/20 to-primary/10',
    },
  };

  const config = providerConfig[provider];
  const IconComponent = config.icon;

  if (!reasoning || reasoning.trim().length === 0) return null;

  // Count approximate steps/thoughts
  const thoughtCount = reasoning.split(/\n\n+/).filter(p => p.trim().length > 0).length;

  return (
    <div className={cn("mb-4 animate-fade-in", className)}>
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
          config.bg,
          config.hoverBg,
          "border",
          config.border
        )}
      >
        {/* Icon with gradient background */}
        <div className={cn(
          "p-1.5 rounded-lg bg-gradient-to-br",
          config.gradient,
          "transition-transform duration-200 group-hover:scale-110"
        )}>
          <IconComponent className={cn("h-4 w-4", config.text)} />
        </div>

        <div className="flex flex-col items-start flex-1">
          <span className={cn("text-sm font-medium", config.text)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {thoughtCount} {thoughtCount === 1 ? 'etapa de raciocínio' : 'etapas de raciocínio'}
          </span>
        </div>

        {/* Chevron with animation */}
        <div className={cn(
          "transition-transform duration-200",
          isExpanded ? "rotate-180" : "rotate-0"
        )}>
          <ChevronDown className={cn("h-5 w-5", config.textMuted)} />
        </div>
      </button>

      {/* Expanded Content with slide animation */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isExpanded ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
        )}
      >
        <div className={cn(
          "rounded-xl border-l-4 p-4",
          config.bg,
          config.borderAccent,
          "animate-fade-in"
        )}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3 last:mb-0">
                    {children}
                  </p>
                ),
                h1: ({ children }) => (
                  <h1 className={cn("text-lg font-bold mb-2", config.text)}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className={cn("text-base font-semibold mb-2", config.text)}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className={cn("text-sm font-semibold mb-1", config.text)}>{children}</h3>
                ),
                strong: ({ children }) => (
                  <strong className={cn("font-semibold", config.text)}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="text-muted-foreground/80 italic">{children}</em>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 my-2 ml-2">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 my-2 ml-2">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed">{children}</li>
                ),
                code: ({ className: codeClassName, children, ...props }) => {
                  const isInline = !codeClassName;
                  if (isInline) {
                    return (
                      <code className={cn(
                        "px-1.5 py-0.5 rounded text-xs font-mono",
                        config.bg,
                        config.text
                      )}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={cn("block p-3 rounded-lg text-xs font-mono overflow-x-auto", config.bg)} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className={cn(
                    "rounded-lg overflow-x-auto my-3",
                    config.bg,
                    "border",
                    config.border
                  )}>
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className={cn(
                    "border-l-2 pl-4 my-3 italic text-sm text-muted-foreground/80",
                    config.borderAccent
                  )}>
                    {children}
                  </blockquote>
                ),
                hr: () => (
                  <hr className={cn("my-4 border-t", config.border)} />
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full text-sm">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className={cn("px-3 py-2 text-left font-semibold border-b", config.border, config.text)}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className={cn("px-3 py-2 border-b", config.border)}>
                    {children}
                  </td>
                ),
              }}
            >
              {reasoning}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};
