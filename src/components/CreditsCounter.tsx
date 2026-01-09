import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, AlertTriangle, TrendingDown } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { PurchaseCreditsModal } from './PurchaseCreditsModal';

interface CreditsCounterProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export const CreditsCounter: React.FC<CreditsCounterProps> = ({ 
  variant = 'default',
  className 
}) => {
  const { 
    creditsRemaining, 
    isLegacyUser, 
    showPurchaseModal, 
    setShowPurchaseModal 
  } = useCredits();

  // Não mostrar para usuários legados
  if (isLegacyUser) {
    return null;
  }

  // Determinar nível de alerta
  const isLow = creditsRemaining <= 5 && creditsRemaining > 0;
  const isCritical = creditsRemaining <= 2;
  const isEmpty = creditsRemaining <= 0;

  // Cores baseadas no estado
  const getColorClasses = () => {
    if (isEmpty) return 'text-red-400 bg-red-500/20 border-red-500/50';
    if (isCritical) return 'text-orange-400 bg-orange-500/20 border-orange-500/50';
    if (isLow) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  // Ícone baseado no estado
  const getIcon = () => {
    if (isEmpty || isCritical) return <AlertTriangle className="w-4 h-4" />;
    if (isLow) return <TrendingDown className="w-4 h-4" />;
    return <Coins className="w-4 h-4" />;
  };

  // Mensagem de tooltip
  const getTooltipMessage = () => {
    if (isEmpty) return 'Sem créditos! Compre mais para continuar usando.';
    if (isCritical) return 'Créditos quase acabando! Considere comprar mais.';
    if (isLow) return 'Créditos baixos. Compre mais em breve.';
    return `Você tem ${creditsRemaining} crédito${creditsRemaining !== 1 ? 's' : ''} disponível`;
  };

  if (variant === 'compact') {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowPurchaseModal(true)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all duration-300 hover:scale-105",
                  getColorClasses(),
                  className
                )}
              >
                {getIcon()}
                <span className="font-mono font-bold text-sm">
                  {creditsRemaining}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p>{getTooltipMessage()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PurchaseCreditsModal
          open={showPurchaseModal}
          onOpenChange={setShowPurchaseModal}
        />
      </>
    );
  }

  return (
    <>
      <div className={cn("relative", className)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={creditsRemaining}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-sm transition-colors duration-300",
              getColorClasses()
            )}
          >
            {/* Ícone animado */}
            <motion.div
              animate={isLow || isEmpty ? { 
                scale: [1, 1.2, 1],
                rotate: [0, -10, 10, 0]
              } : {}}
              transition={{ 
                repeat: isLow || isEmpty ? Infinity : 0, 
                duration: 2,
                repeatDelay: 3
              }}
            >
              {getIcon()}
            </motion.div>

            {/* Contador */}
            <div className="flex flex-col">
              <span className="text-xs opacity-70 uppercase tracking-wider font-medium">
                Créditos
              </span>
              <div className="flex items-baseline gap-1">
                <motion.span
                  key={creditsRemaining}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="font-mono font-bold text-lg leading-none"
                >
                  {creditsRemaining.toLocaleString('pt-BR')}
                </motion.span>
              </div>
            </div>

            {/* Indicador de alerta */}
            {(isLow || isEmpty) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-1"
              >
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPurchaseModal(true)}
                  className={cn(
                    "h-7 px-2 text-xs font-semibold",
                    isEmpty 
                      ? "text-red-400 hover:text-red-300 hover:bg-red-500/20" 
                      : "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20"
                  )}
                >
                  + Comprar
                </Button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Barra de progresso visual (opcional) */}
        {creditsRemaining > 0 && creditsRemaining <= 10 && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(creditsRemaining * 10, 100)}%` }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className={cn(
                "h-full rounded-full",
                isEmpty ? "bg-red-500" : isCritical ? "bg-orange-500" : "bg-yellow-500"
              )}
            />
          </div>
        )}
      </div>

      <PurchaseCreditsModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
      />
    </>
  );
};

export default CreditsCounter;
