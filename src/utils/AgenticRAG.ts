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

  // FASE 4: Consolidação hierárquica MUITO mais agressiva
  async *consolidateAndStream(
    sections: string[],
    userMessage: string,
    fileName: string,
    totalPages: number
  ): AsyncGenerator<string> {
    console.log(`🎯 [CONSOLIDAÇÃO] Iniciando com ${sections.length} seções`);
    
    // NÍVEL 3: Consolidação hierárquica MUITO mais agressiva
    let workingSections = sections;
    let round = 1;
    const MAX_ROUNDS = 8;
    const TARGET_TOKENS = 10000; // Alvo de 10K tokens (margem de segurança grande)
    const TARGET_SECTIONS = 2; // Ideal: 2 seções finais
    
    while (round <= MAX_ROUNDS) {
      const currentTokens = this.estimateTokens(workingSections);
      const numSections = workingSections.length;
      
      console.log(`🔄 Rodada ${round}: ${numSections} seções, ~${currentTokens} tokens`);
      
      // Condição de parada: atingiu alvo OU não dá pra reduzir mais
      if (currentTokens <= TARGET_TOKENS && numSections <= TARGET_SECTIONS) {
        console.log(`✅ Meta atingida! ${numSections} seções, ${currentTokens} tokens`);
        break;
      }
      
      if (numSections === 1 && currentTokens > TARGET_TOKENS) {
        // Última seção muito grande: truncar forçadamente
        console.warn(`⚠️ Seção única muito grande (${currentTokens} tokens), truncando...`);
        const targetChars = Math.floor(TARGET_TOKENS * 3.5);
        workingSections = [
          workingSections[0].slice(0, targetChars) + 
          '\n\n[... Documento truncado para respeitar limites de tokens ...]'
        ];
        break;
      }
      
      // Consolidar agressivamente
      workingSections = await this.preConsolidate(workingSections);
      round++;
    }
    
    const finalTokens = this.estimateTokens(workingSections);
    const finalChars = workingSections.reduce((sum, s) => sum + s.length, 0);
    console.log(`📊 [FINAL] ${workingSections.length} seções, ~${finalTokens} tokens (${finalChars} chars) → Enviando para consolidação`);
    
    if (finalTokens > 12000) {
      throw new Error(`ERRO CRÍTICO: Ainda temos ${finalTokens} tokens (limite: 12000)! Sistema falhou.`);
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
      console.error('❌ Erro na consolidação:', errorText);
      throw new Error('Consolidation failed');
    }
    
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
          } catch {}
        }
      }
    }
  }

  // Pré-consolidação: agrupa seções de forma inteligente e agressiva
  private async preConsolidate(sections: string[]): Promise<string[]> {
    const currentTokens = this.estimateTokens(sections);
    
    // Determinar estratégia de agrupamento baseado no tamanho
    let groupSize: number;
    if (sections.length <= 2) {
      // Se já temos 2 ou menos, tentar comprimir cada uma
      groupSize = 1;
    } else if (currentTokens > 50000) {
      // Muito grande: agrupar de 4 em 4
      groupSize = 4;
    } else if (currentTokens > 30000) {
      // Grande: agrupar de 3 em 3
      groupSize = 3;
    } else {
      // Normal: agrupar de 2 em 2
      groupSize = 2;
    }
    
    console.log(`🔧 Pré-consolidando: ${sections.length} seções em grupos de ${groupSize}`);
    
    const groups: string[][] = [];
    for (let i = 0; i < sections.length; i += groupSize) {
      const group = sections.slice(i, Math.min(i + groupSize, sections.length));
      groups.push(group);
    }
    
    // Processar grupos em paralelo (máx 3 por vez para não sobrecarregar)
    const consolidated: string[] = [];
    const PARALLEL_LIMIT = 3;
    
    for (let i = 0; i < groups.length; i += PARALLEL_LIMIT) {
      const batch = groups.slice(i, i + PARALLEL_LIMIT);
      
      const results = await Promise.all(
        batch.map(async (group, idx) => {
          if (group.length === 1) {
            // Seção única: tentar comprimir
            if (group[0].length > 25000) {
              console.log(`  📉 Comprimindo seção ${i + idx + 1} (${group[0].length} chars)`);
              return this.compressSection(group[0]);
            }
            return group[0];
          }
          
          // Múltiplas seções: sintetizar
          console.log(`  🔗 Sintetizando grupo ${i + idx + 1} (${group.length} seções)`);
          
          // Truncar cada seção do grupo se necessário
          const truncatedGroup = group.map(s => {
            if (s.length > 20000) {
              return s.slice(0, 20000) + '\n\n[... conteúdo truncado ...]';
            }
            return s;
          });
          
          const { data, error } = await supabase.functions.invoke('rag-synthesize-section', {
            body: {
              analyses: truncatedGroup,
              sectionIndex: i + idx + 1,
              totalSections: groups.length
            }
          });
          
          if (error) {
            console.error(`❌ Erro ao sintetizar grupo ${i + idx + 1}:`, error);
            // Fallback: concatenar e truncar
            return truncatedGroup.join('\n\n---\n\n').slice(0, 15000) + '\n\n[... erro na síntese ...]';
          }
          
          return data.synthesis;
        })
      );
      
      consolidated.push(...results);
    }
    
    console.log(`✅ Consolidação concluída: ${sections.length} → ${consolidated.length} seções`);
    return consolidated;
  }
  
  // NOVO: Método para comprimir seções individuais grandes
  private async compressSection(section: string): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('rag-compress-section', {
        body: { section }
      });
      
      if (error) throw error;
      return data.compressed;
    } catch (error) {
      console.error('❌ Erro ao comprimir seção:', error);
      // Fallback: truncamento simples
      return section.slice(0, 15000) + '\n\n[... seção truncada devido a erro ...]';
    }
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
