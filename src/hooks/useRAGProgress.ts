import { useState, useCallback } from 'react';
import { RAGProgress, RAGPhase } from '@/components/RAGProgressIndicator';

interface UseRAGProgressOptions {
  totalPages?: number;
  onComplete?: () => void;
  onCancel?: () => void;
}

export const useRAGProgress = (options: UseRAGProgressOptions = {}) => {
  const [progress, setProgress] = useState<RAGProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  // Estimativas de tempo base por fase (em segundos por página)
  const timeEstimates = {
    chunking: 0.1,
    analysis: 2.0,
    synthesis: 1.5,
    filtering: 0.8,
    consolidation: 1.0
  };

  const calculateEstimatedTime = useCallback((
    phase: RAGPhase, 
    currentProgress: number,
    totalPages?: number
  ): number => {
    if (!totalPages) return 0;
    
    const phases: RAGPhase[] = ['chunking', 'analysis', 'synthesis', 'filtering', 'consolidation'];
    const currentIndex = phases.indexOf(phase);
    
    // Tempo restante da fase atual
    const currentPhaseTime = timeEstimates[phase] * totalPages * (100 - currentProgress) / 100;
    
    // Tempo das fases futuras
    let futureTime = 0;
    for (let i = currentIndex + 1; i < phases.length; i++) {
      futureTime += timeEstimates[phases[i]] * totalPages;
    }
    
    return Math.ceil(currentPhaseTime + futureTime);
  }, []);

  const startRAG = useCallback((totalPages?: number) => {
    setIsProcessing(true);
    setProgress({
      phase: 'chunking',
      progress: 0,
      currentStep: 'Iniciando divisão do documento...',
      estimatedTimeRemaining: calculateEstimatedTime('chunking', 0, totalPages),
      totalSteps: totalPages,
      completedSteps: 0
    });
  }, [calculateEstimatedTime]);

  const updateProgress = useCallback((
    phase: RAGPhase,
    progressValue: number,
    currentStep?: string,
    completedSteps?: number,
    totalSteps?: number
  ) => {
    setProgress(prev => ({
      phase,
      progress: Math.min(100, Math.max(0, progressValue)),
      currentStep: currentStep || prev?.currentStep,
      estimatedTimeRemaining: calculateEstimatedTime(phase, progressValue, options.totalPages),
      totalSteps: totalSteps ?? prev?.totalSteps,
      completedSteps: completedSteps ?? prev?.completedSteps
    }));
  }, [calculateEstimatedTime, options.totalPages]);

  const startChunking = useCallback((totalChunks?: number) => {
    updateProgress(
      'chunking',
      0,
      'Dividindo documento em blocos processáveis...',
      0,
      totalChunks
    );
  }, [updateProgress]);

  const updateChunking = useCallback((completed: number, total: number) => {
    const progress = (completed / total) * 100;
    updateProgress(
      'chunking',
      progress,
      `Processando bloco ${completed} de ${total}...`,
      completed,
      total
    );
  }, [updateProgress]);

  const startAnalysis = useCallback((totalChunks?: number) => {
    updateProgress(
      'analysis',
      0,
      'Analisando conteúdo de cada bloco...',
      0,
      totalChunks
    );
  }, [updateProgress]);

  const updateAnalysis = useCallback((completed: number, total: number) => {
    const progress = (completed / total) * 100;
    updateProgress(
      'analysis',
      progress,
      `Analisando bloco ${completed} de ${total}...`,
      completed,
      total
    );
  }, [updateProgress]);

  const startSynthesis = useCallback((totalSections?: number) => {
    updateProgress(
      'synthesis',
      0,
      'Sintetizando seções lógicas do documento...',
      0,
      totalSections
    );
  }, [updateProgress]);

  const updateSynthesis = useCallback((completed: number, total: number) => {
    const progress = (completed / total) * 100;
    updateProgress(
      'synthesis',
      progress,
      `Sintetizando seção ${completed} de ${total}...`,
      completed,
      total
    );
  }, [updateProgress]);

  const startFiltering = useCallback((totalSections?: number) => {
    updateProgress(
      'filtering',
      0,
      'Filtrando conteúdo mais relevante...',
      0,
      totalSections
    );
  }, [updateProgress]);

  const updateFiltering = useCallback((progress: number, description?: string) => {
    updateProgress(
      'filtering',
      progress,
      description || 'Aplicando filtros de relevância...'
    );
  }, [updateProgress]);

  const startConsolidation = useCallback(() => {
    updateProgress(
      'consolidation',
      0,
      'Consolidando informações e gerando resposta final...'
    );
  }, [updateProgress]);

  const updateConsolidation = useCallback((progress: number, description?: string) => {
    updateProgress(
      'consolidation',
      progress,
      description || 'Finalizando consolidação...'
    );
  }, [updateProgress]);

  const completeRAG = useCallback(() => {
    setProgress({
      phase: 'consolidation',
      progress: 100,
      currentStep: 'Processamento concluído!',
      estimatedTimeRemaining: 0
    });
    setIsProcessing(false);
    if (options.onComplete) {
      options.onComplete();
    }
  }, [options]);

  const cancelRAG = useCallback(() => {
    setIsCancelled(true);
    setIsProcessing(false);
    setProgress(prev => prev ? {
      ...prev,
      currentStep: 'Processamento cancelado pelo usuário'
    } : null);
    if (options.onCancel) {
      options.onCancel();
    }
  }, [options]);

  const resetProgress = useCallback(() => {
    setProgress(null);
    setIsProcessing(false);
    setIsCancelled(false);
  }, []);

  return {
    progress,
    isProcessing,
    isCancelled,
    startRAG,
    startChunking,
    updateChunking,
    startAnalysis,
    updateAnalysis,
    startSynthesis,
    updateSynthesis,
    startFiltering,
    updateFiltering,
    startConsolidation,
    updateConsolidation,
    completeRAG,
    cancelRAG,
    resetProgress
  };
};
