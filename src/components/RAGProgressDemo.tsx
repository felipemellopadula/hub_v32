import { useState } from 'react';
import { RAGProgressIndicator } from './RAGProgressIndicator';
import { useRAGProgress } from '@/hooks/useRAGProgress';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Play, RotateCcw } from 'lucide-react';

export const RAGProgressDemo = () => {
  const [documentName] = useState('exemplo-documento.pdf');
  const [totalPages] = useState(150);
  
  const {
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
  } = useRAGProgress({
    totalPages,
    onComplete: () => {
      console.log('RAG processing completed!');
    },
    onCancel: () => {
      console.log('RAG processing cancelled by user');
    }
  });

  const simulateRAGProcess = async () => {
    startRAG(totalPages);
    
    try {
      // Simular Chunking
      await new Promise(resolve => setTimeout(resolve, 500));
      if (isCancelled) return;
      
      const totalChunks = Math.ceil(totalPages / 20);
      startChunking(totalChunks);
      
      for (let i = 1; i <= totalChunks; i++) {
        if (isCancelled) return;
        await new Promise(resolve => setTimeout(resolve, 300));
        updateChunking(i, totalChunks);
      }
      
      // Simular Analysis
      await new Promise(resolve => setTimeout(resolve, 500));
      if (isCancelled) return;
      startAnalysis(totalChunks);
      
      for (let i = 1; i <= totalChunks; i++) {
        if (isCancelled) return;
        await new Promise(resolve => setTimeout(resolve, 800));
        updateAnalysis(i, totalChunks);
      }
      
      // Simular Synthesis
      await new Promise(resolve => setTimeout(resolve, 500));
      if (isCancelled) return;
      const totalSections = Math.ceil(totalChunks / 3);
      startSynthesis(totalSections);
      
      for (let i = 1; i <= totalSections; i++) {
        if (isCancelled) return;
        await new Promise(resolve => setTimeout(resolve, 600));
        updateSynthesis(i, totalSections);
      }
      
      // Simular Filtering
      await new Promise(resolve => setTimeout(resolve, 500));
      if (isCancelled) return;
      startFiltering(totalSections);
      
      for (let i = 0; i <= 100; i += 20) {
        if (isCancelled) return;
        await new Promise(resolve => setTimeout(resolve, 400));
        updateFiltering(i, `Analisando relevância das seções (${i}%)...`);
      }
      
      // Simular Consolidation
      await new Promise(resolve => setTimeout(resolve, 500));
      if (isCancelled) return;
      startConsolidation();
      
      for (let i = 0; i <= 100; i += 25) {
        if (isCancelled) return;
        await new Promise(resolve => setTimeout(resolve, 500));
        updateConsolidation(i, i === 100 ? 'Resposta gerada com sucesso!' : 'Consolidando informações...');
      }
      
      // Completar
      if (!isCancelled) {
        await new Promise(resolve => setTimeout(resolve, 500));
        completeRAG();
        
        // Auto-reset após 3 segundos
        setTimeout(() => {
          resetProgress();
        }, 3000);
      }
    } catch (error) {
      console.error('Error during RAG simulation:', error);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Demo: RAG Progress Indicator</CardTitle>
          <CardDescription>
            Simulação do processamento RAG com estimativas de tempo e progresso detalhado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={simulateRAGProcess}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>Processando...</>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Simulação
                </>
              )}
            </Button>
            <Button
              onClick={resetProgress}
              variant="outline"
              disabled={isProcessing}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Resetar
            </Button>
          </div>
          
          <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
            <p><strong>Documento:</strong> {documentName}</p>
            <p><strong>Total de Páginas:</strong> {totalPages}</p>
            <p><strong>Status:</strong> {isCancelled ? 'Cancelado' : isProcessing ? 'Processando...' : 'Aguardando'}</p>
          </div>
        </CardContent>
      </Card>

      {progress && (
        <RAGProgressIndicator
          progress={progress}
          documentName={documentName}
          totalPages={totalPages}
          onCancel={isProcessing ? cancelRAG : undefined}
        />
      )}
    </div>
  );
};
