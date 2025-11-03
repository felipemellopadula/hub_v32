import { supabase } from "@/integrations/supabase/client";
import { RAGCache } from "./RAGCache";

interface ChunkProgress {
  current: number;
  total: number;
  status: string;
}

export class AgenticRAG {
  private cache = new RAGCache();

  // FASE 1: Chunking no frontend com validação
  createChunks(content: string, totalPages: number): string[] {
    const chunkPages = this.getChunkSize(totalPages);
    const chunkSize = chunkPages * 3500;
    const MAX_CHUNK_SIZE = 120000; // 120K chars (~30K tokens)
    
    const finalChunkSize = Math.min(chunkSize, MAX_CHUNK_SIZE);
    const overlapSize = Math.floor(finalChunkSize * 0.15);
    
    console.log(`📚 Criando chunks: ${totalPages} páginas → ${chunkPages} páginas/chunk (max ${finalChunkSize} chars)`);
    
    const chunks: string[] = [];
    let position = 0;
    
    while (position < content.length) {
      const end = Math.min(position + finalChunkSize, content.length);
      chunks.push(content.slice(position, end));
      position += (finalChunkSize - overlapSize);
      if (end === content.length) break;
    }
    
    console.log(`✅ ${chunks.length} chunks criados`);
    return chunks;
  }

  // FASE 2: Análise com retry e cache
  async analyzeChunks(
    chunks: string[],
    totalPages: number,
    onProgress: (progress: ChunkProgress) => void,
    documentHash?: string
  ): Promise<string[]> {
    // Tentar carregar do cache
    if (documentHash) {
      const cached = await this.cache.load(documentHash, 'analyses');
      if (cached) {
        console.log('✅ Análises carregadas do cache');
        onProgress({
          current: chunks.length,
          total: chunks.length,
          status: 'Carregado do cache'
        });
        return cached;
      }
    }

    const BATCH_SIZE = 2; // Reduzido para evitar rate limit
    const results: string[] = [];
    const failedChunks: number[] = [];
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      onProgress({
        current: i,
        total: chunks.length,
        status: `Analisando chunks ${i+1}-${Math.min(i+BATCH_SIZE, chunks.length)} de ${chunks.length}`
      });
      
      // Processar batch com Promise.allSettled
      const batchPromises = batch.map((chunk, idx) => 
        this.analyzeChunk(chunk, i + idx, chunks.length, totalPages)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Separar sucessos de falhas
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const chunkIndex = i + idx;
          failedChunks.push(chunkIndex);
          console.error(`❌ Chunk ${chunkIndex+1} falhou:`, result.reason);
          results.push(`[CHUNK ${chunkIndex+1} NÃO PROCESSADO: ${result.reason.message}]`);
        }
      });
      
      // Delay entre batches
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    if (failedChunks.length > 0) {
      console.warn(`⚠️ ${failedChunks.length}/${chunks.length} chunks falharam`);
    }
    
    // Salvar no cache
    if (documentHash) {
      await this.cache.save(documentHash, 'analyses', results);
    }
    
    return results;
  }

  // Análise de chunk com retry
  private async analyzeChunk(
    chunk: string,
    index: number,
    total: number,
    totalPages: number,
    retryCount = 0
  ): Promise<string> {
    const MAX_RETRIES = 3;
    const INITIAL_DELAY = 2000;
    
    try {
      const { data, error } = await supabase.functions.invoke('rag-analyze-chunk', {
        body: { chunk, chunkIndex: index, totalChunks: total, totalPages }
      });
      
      if (error) {
        // Detectar rate limit
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          if (retryCount < MAX_RETRIES) {
            const delay = INITIAL_DELAY * Math.pow(2, retryCount);
            console.log(`⏳ Rate limit no chunk ${index+1}, aguardando ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.analyzeChunk(chunk, index, total, totalPages, retryCount + 1);
          }
        }
        throw new Error(`Chunk ${index+1} failed: ${error.message}`);
      }
      
      return data.analysis;
      
    } catch (error: any) {
      if (retryCount < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(2, retryCount);
        console.log(`⚠️ Erro no chunk ${index+1}, tentativa ${retryCount+1}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.analyzeChunk(chunk, index, total, totalPages, retryCount + 1);
      }
      throw error;
    }
  }

  // FASE 3: Síntese de seções
  async synthesizeSections(
    analyses: string[],
    onProgress: (status: string) => void
  ): Promise<string[]> {
    const SECTIONS = this.groupIntoSections(analyses);
    const syntheses: string[] = [];
    
    for (let i = 0; i < SECTIONS.length; i++) {
      onProgress(`Sintetizando seção ${i+1} de ${SECTIONS.length}`);
      
      const { data, error } = await supabase.functions.invoke('rag-synthesize-section', {
        body: {
          analyses: SECTIONS[i],
          sectionIndex: i,
          totalSections: SECTIONS.length
        }
      });
      
      if (error) throw new Error(`Section ${i+1} failed: ${error.message}`);
      syntheses.push(data.synthesis);
    }
    
    return syntheses;
  }

  // FASE 4: Consolidação hierárquica melhorada com estratégia MUITO mais agressiva
  async *consolidateAndStream(
    sections: string[],
    userMessage: string,
    fileName: string,
    totalPages: number
  ): AsyncGenerator<string> {
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log(`📊 Tokens estimados: ${this.estimateTokens(sections)}`);
    
    // Consolidação hierárquica MUITO mais agressiva
    let workingSections = sections;
    let round = 1;
    
    // Reduzir até ter no máximo 2 seções E menos de 8000 tokens
    while (workingSections.length > 2 || this.estimateTokens(workingSections) > 8000) {
      console.log(`🔄 Rodada ${round}: Pré-consolidando ${workingSections.length} seções (${this.estimateTokens(workingSections)} tokens)...`);
      workingSections = await this.preConsolidate(workingSections);
      console.log(`✅ Reduzido para ${workingSections.length} seções (${this.estimateTokens(workingSections)} tokens)`);
      round++;
      
      // Limite de segurança para evitar loop infinito
      if (round > 5) {
        console.warn('⚠️ Limite de rodadas atingido, truncando seções');
        workingSections = workingSections.map(s => s.slice(0, 15000));
        break;
      }
    }
    
    const response = await fetch(
      `https://myqgnnqltemfpzdxwybj.supabase.co/functions/v1/rag-consolidate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          sections: workingSections,
          userMessage,
          fileName,
          totalPages
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na consolidação:', errorText);
      throw new Error('Consolidation failed');
    }
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {}
        }
      }
    }
  }

  // Pré-consolidar seções de forma mais agressiva
  private async preConsolidate(sections: string[]): Promise<string[]> {
    // Agrupar em grupos de 3 se houver muitas seções, senão grupos de 2
    const groupSize = sections.length > 6 ? 3 : 2;
    const pairs: string[][] = [];
    
    for (let i = 0; i < sections.length; i += groupSize) {
      const group = sections.slice(i, Math.min(i + groupSize, sections.length));
      pairs.push(group);
    }

    console.log(`🔄 Consolidando ${sections.length} seções em ${pairs.length} grupos de ~${groupSize}`);

    const consolidated = await Promise.all(
      pairs.map(async (group, idx) => {
        if (group.length === 1) return group[0];
        
        // Truncar cada seção do grupo se necessário
        const truncatedGroup = group.map(s => {
          if (s.length > 20000) {
            return s.slice(0, 20000) + '\n\n[... conteúdo truncado para limitar tokens ...]';
          }
          return s;
        });
        
        const { data, error } = await supabase.functions.invoke('rag-synthesize-section', {
          body: {
            analyses: truncatedGroup,
            sectionIndex: idx + 1,
            totalSections: pairs.length
          }
        });

        if (error) throw error;
        return data.synthesis;
      })
    );

    return consolidated;
  }

  // Estimar tokens de forma conservadora
  private estimateTokens(sections: string[]): number {
    const totalChars = sections.reduce((sum, s) => sum + s.length, 0);
    return Math.floor(totalChars / 3); // Mais conservador
  }

  // Helpers otimizados
  private getChunkSize(pages: number): number {
    // Chunks menores para evitar timeout
    if (pages <= 30) return 15;
    if (pages <= 50) return 15;
    if (pages <= 100) return 20;
    if (pages <= 200) return 20;
    if (pages <= 500) return 25;
    return 30; // Max 30 páginas (~105K chars)
  }

  private groupIntoSections(analyses: string[]): string[][] {
    const SECTION_SIZE = Math.ceil(analyses.length / 3);
    const sections: string[][] = [];
    
    for (let i = 0; i < analyses.length; i += SECTION_SIZE) {
      sections.push(analyses.slice(i, i + SECTION_SIZE));
    }
    
    return sections;
  }
}
