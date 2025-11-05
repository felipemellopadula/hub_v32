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

  // NÍVEL 2: Síntese de seções
  async synthesizeSections(analyses: string[], onProgress: (status: string) => void): Promise<string[]> {
    const SECTIONS = this.groupIntoSections(analyses);
    const syntheses: string[] = [];
    
    console.log(`🔄 [SÍNTESE] Sintetizando ${analyses.length} análises em ${SECTIONS.length} seções...`);
    
    for (let i = 0; i < SECTIONS.length; i++) {
      onProgress(`📝 Sintetizando seção ${i + 1}/${SECTIONS.length}...`);
      
      const { data, error } = await supabase.functions.invoke('rag-synthesize-section', {
        body: { 
          analyses: SECTIONS[i],
          sectionIndex: i,
          totalSections: SECTIONS.length
        }
      });
      
      if (error) throw new Error(`Section synthesis failed: ${error.message}`);
      syntheses.push(data.synthesis);
    }
    
    console.log(`✅ [SÍNTESE] ${syntheses.length} seções sintetizadas`);
    return syntheses;
  }

  // NÍVEL 3: Segmentação lógica (NOVA FASE)
  async createLogicalSections(syntheses: string[]): Promise<any[]> {
    const combinedContent = syntheses.join('\n\n---\n\n');
    
    console.log(`🧩 [SEGMENTAÇÃO] Criando seções lógicas de ${combinedContent.length} chars`);
    
    const { data, error } = await supabase.functions.invoke('rag-logical-sections', {
      body: { synthesizedContent: combinedContent }
    });
    
    if (error) throw new Error(`Logical sections failed: ${error.message}`);
    
    console.log(`✅ [SEGMENTAÇÃO] ${data.sections.length} seções lógicas criadas`);
    return data.sections;
  }

  // NÍVEL 4: Filtragem por relevância (NOVA FASE)
  async filterRelevantSections(
    sections: any[],
    userMessage: string
  ): Promise<string[]> {
    console.log(`🔍 [FILTRAGEM] Filtrando ${sections.length} seções para objetivo do usuário`);
    
    const { data, error } = await supabase.functions.invoke('rag-filter-relevant', {
      body: {
        sections,
        userMessage
      }
    });
    
    if (error) throw new Error(`Filtering failed: ${error.message}`);
    
    const filteredSections = data.sections.map((s: any) => s.content);
    
    console.log(`✅ [FILTRAGEM] ${sections.length} → ${filteredSections.length} seções relevantes`);
    console.log(`💡 [RACIOCÍNIO] ${data.reasoning}`);
    
    return filteredSections;
  }

  // NÍVEL 5: Consolidação final hierárquica via streaming (REFATORADO)
  async *consolidateAndStream(
    sections: string[],
    userMessage: string,
    fileName: string,
    totalPages: number
  ): AsyncGenerator<string> {
    console.log(`🎯 [CONSOLIDAÇÃO] Iniciando com ${sections.length} seções sintetizadas`);
    
    // NOVA ETAPA 1: Criar seções lógicas
    const logicalSections = await this.createLogicalSections(sections);
    
    // NOVA ETAPA 2: Filtrar apenas seções relevantes
    const relevantSections = await this.filterRelevantSections(logicalSections, userMessage);
    
    console.log(`✅ [FILTRAGEM] ${relevantSections.length} seções relevantes selecionadas`);
    
    // ✨ NOVA ETAPA 2.5: COMPRESSÃO OBRIGATÓRIA E AGRESSIVA
    console.log(`🗜️ [COMPRESSÃO OBRIGATÓRIA] Comprimindo ${relevantSections.length} seções...`);
    
    const compressedSections = await Promise.all(
      relevantSections.map(async (section, idx) => {
        const targetSize = 2500; // FIXO: max 2500 chars por seção
        console.log(`  📉 Seção ${idx + 1}: ${section.length} → ${targetSize} chars`);
        
        const { data, error } = await supabase.functions.invoke('rag-compress-section', {
          body: { 
            section,
            targetSize,
            aggressive: true
          }
        });
        
        if (error) {
          console.error(`❌ Erro ao comprimir seção ${idx + 1}:`, error);
          // Fallback: truncar agressivamente
          return section.slice(0, 2000) + '\n\n[... truncado devido a erro ...]';
        }
        
        return data.compressed;
      })
    );
    
    const totalChars = compressedSections.reduce((sum, s) => sum + s.length, 0);
    const estimatedTokens = Math.floor(totalChars / 3.5);
    
    console.log(`✅ [COMPRESSÃO] ${relevantSections.length} seções: ${totalChars} chars (~${estimatedTokens} tokens)`);
    
    // VALIDAÇÃO HARD
    if (estimatedTokens > 8000) {
      throw new Error(`ERRO: Mesmo com compressão, ainda temos ${estimatedTokens} tokens (limite: 8000)`);
    }
    
    let workingSections = compressedSections;
    
    const finalTokens = this.estimateTokens(workingSections);
    const finalChars = workingSections.reduce((sum, s) => sum + s.length, 0);
    console.log(`📊 [FINAL] ${workingSections.length} seções, ~${finalTokens} tokens (${finalChars} chars) → Enviando para consolidação`);
    
    if (finalTokens > 12000) {
      throw new Error(`ERRO CRÍTICO: Após filtragem ainda temos ${finalTokens} tokens (limite: 12000)! Sistema falhou.`);
    }
    
    // Chamar backend para consolidação final
    const { data: { session } } = await supabase.auth.getSession();
    
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
      console.error('❌ [CONSOLIDAÇÃO] Erro:', errorText);
      
      if (errorText.includes('too large') || errorText.includes('Input muito grande')) {
        throw new Error('Documento muito grande mesmo após filtragem. Tente um arquivo menor.');
      }
      
      throw new Error('Consolidation failed');
    }
    
    console.log('✅ [CONSOLIDAÇÃO] Streaming iniciado');
    
    // Stream da resposta
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
          } catch (e) {
            // Ignora erros de parse parcial
          }
        }
      }
    }
  }

  // Método auxiliar para comprimir seções grandes
  private async compressSection(section: string): Promise<string> {
    console.log(`🗜️ Comprimindo seção de ${section.length} chars...`);
    
    const { data, error } = await supabase.functions.invoke('rag-compress-section', {
      body: { section }
    });
    
    if (error) {
      console.warn('⚠️ Compressão falhou, usando truncamento:', error);
      return section.slice(0, 12000);
    }
    
    console.log(`✅ Seção comprimida: ${section.length} → ${data.compressed.length} chars`);
    return data.compressed;
  }
  
  // Estima tokens de múltiplas seções
  private estimateTokens(sections: string[]): number {
    const totalChars = sections.reduce((sum, s) => sum + s.length, 0);
    return Math.floor(totalChars / 2.5); // Estimativa MUITO conservadora
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
