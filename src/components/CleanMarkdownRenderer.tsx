import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CleanMarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

const CleanMarkdownRenderer: React.FC<CleanMarkdownRendererProps> = ({ content, isUser }) => {
  const [copiedStates, setCopiedStates] = React.useState<{ [key: number]: boolean }>({});

  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedStates(prev => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [index]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  let codeBlockIndex = 0;

  return (
    <div className="markdown-content text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }: any) {
            const inline = !className;
            const match = /language-(\w+)/.exec(className || '');
            const currentIndex = codeBlockIndex++;
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && match) {
              return (
                <div className="relative my-3 rounded-lg overflow-hidden border border-border/50">
                  <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border/50">
                    <span className="text-xs font-medium text-muted-foreground">{match[1]}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeString, currentIndex)}
                      className="h-7 px-2 hover:bg-background/50"
                    >
                      {copiedStates[currentIndex] ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <SyntaxHighlighter
                    style={oneDark as any}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      background: 'hsl(var(--muted))',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                    } as any}
                    {...props}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-sm" {...props}>
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-1.5 leading-relaxed last:mb-0">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-sm font-semibold mb-1 mt-2">{children}</h4>;
          },
          ul({ children }) {
            return <ul className="ml-6 mb-2 mt-1 list-disc space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="ml-6 mb-2 mt-1 list-decimal space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed pl-1 [&>p]:inline [&>p]:m-0 [&>p]:block-inline">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary/30 pl-4 my-3 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className="font-bold text-foreground">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
          hr() {
            return <hr className="my-4 border-border" />;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto">
                <table className="min-w-full border-collapse border border-border">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-muted/50">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody>{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="border-b border-border">{children}</tr>;
          },
          th({ children }) {
            return (
              <th className="px-4 py-2 text-left font-semibold text-sm border border-border">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-2 text-sm border border-border">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default CleanMarkdownRenderer;
