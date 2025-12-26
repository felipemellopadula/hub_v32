import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook para proteger botões de cliques rápidos/duplicados
 * Previne múltiplos cliques dentro de uma janela de tempo
 * 
 * @param delay Tempo em ms que o botão permanece "debounced" após ação (padrão: 1000ms)
 * @returns { debounce, isDebouncing }
 * 
 * @example
 * const { debounce, isDebouncing } = useButtonDebounce(1500);
 * 
 * <Button 
 *   disabled={isLoading || isDebouncing}
 *   onClick={() => debounce(handleGenerate)}
 * >
 *   Gerar
 * </Button>
 */
export function useButtonDebounce(delay: number = 1000) {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounce = useCallback((fn: () => void | Promise<void>) => {
    if (isDebouncing) {
      return;
    }
    
    setIsDebouncing(true);
    
    // Executa a função
    const result = fn();
    
    // Se for uma Promise, aguarda completar antes de liberar
    if (result instanceof Promise) {
      result.finally(() => {
        timeoutRef.current = setTimeout(() => {
          setIsDebouncing(false);
        }, delay);
      });
    } else {
      timeoutRef.current = setTimeout(() => {
        setIsDebouncing(false);
      }, delay);
    }
  }, [isDebouncing, delay]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { debounce, isDebouncing };
}
