import { supabase } from "@/integrations/supabase/client";
import { RAGCache } from "./RAGCache";
import { ChunkingStrategies, type DocType } from "./ChunkingStrategies";
import type { ExtractedTable, LayoutElement } from "./PdfProcessor";

interface ChunkProgress {
  current: number;
  total: number;
  status: string;
}

export class AgenticRAG {
  private cache = new RAGCache();
  private docType: DocType = 'general';
  private tables: ExtractedTable[] = [];
  private layout: LayoutElement[] = [];

  /**
   * FASE 2: Detectar tipo do documento (se não fornecido)
   */
  async detectDocumentType(content: string, fileName: string): Promise<DocType> {
    try {
      const { data, error } = await supabase.functions.invoke('detect-doc-type', {
        body: { contentSample: content.substring(0, 5000), fileName }
      });
      
      if (error) {
        console.warn('⚠️ Doc type detection failed, using general:', error);
        return 'general';
      }
      
      this.docType = data.type;
      console.log(`📋 Document type: ${data.type} (${data.confidence}% confidence)`);
      console.log(`💡 Reasoning: ${data.reasoning}`);
      
      return data.type;
    } catch (error) {
      console.warn('⚠️ Doc type detection error:', error);
      return 'general';
    }
  }

  /**
   * FASE 3: Armazenar tabelas extraídas
   */
  setExtractedTables(tables: ExtractedTable[]) {
    this.tables = tables;
    console.log(`📊 ${tables.length} tables stored for RAG context`);
  }

  /**
   * Armazenar layout extraído (para Word docs)
   */
  setExtractedLayout(layout: LayoutElement[]) {
    this.layout = layout;
    console.log(`📐 ${layout.length} layout elements stored for RAG context`);
  }

  // FASE 1: Chunking adaptativo no frontend
  createChunks(content: string, totalPages: number, docType?: DocType): string[] {
    // Usar tipo de documento atual ou fornecido
    const effectiveDocType = docType || this.docType;
    
    const chunkPages = this.getChunkSize(totalPages);
    const chunkSize = chunkPages * 4500; // +1000 chars por página
    const MAX_CHUNK_SIZE = 150000; // 150K chars (~37.5K tokens) - Tier 2 aguenta!
    const finalChunkSize = Math.min(chunkSize, MAX_CHUNK_SIZE);
    
    console.log(`📚 Chunking: ${totalPages} pages | Type: ${effectiveDocType} | Max: ${finalChunkSize} chars`);
    
    // Usar estratégia adaptativa
    const chunkedResults = ChunkingStrategies.getStrategy(effectiveDocType, content, finalChunkSize);
    const chunks = chunkedResults.map(chunk => chunk.content);
    
    console.log(`✅ ${chunks.length} chunks created using ${effectiveDocType} strategy`);
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

    const BATCH_SIZE = 6; // Tier 2 aguenta! Processar em paralelo
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
    userMessage: string,
    totalPages: number
  ): Promise<string[]> {
    console.log(`🔍 [FILTRAGEM] Filtrando ${sections.length} seções para objetivo do usuário`);
    
    // FASE 4: Passar maxSections dinâmico
    const maxSections = totalPages > 100 ? 50 : totalPages > 50 ? 35 : 25;
    
    const { data, error } = await supabase.functions.invoke('rag-filter-relevant', {
      body: {
        sections,
        userMessage,
        maxSections
      }
    });
    
    if (error) throw new Error(`Filtering failed: ${error.message}`);
    
    const filteredSections = data.sections.map((s: any) => {
      const content = typeof s === 'string' ? s : s.content;
      // Garantir que é string pura, sem objetos aninhados
      return String(content);
    });
    
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
    
    // Preparar contexto de tabelas (se existirem)
    let tablesContext = '';
    if (this.tables.length > 0) {
      tablesContext = `\n\n## TABELAS EXTRAÍDAS DO DOCUMENTO\n\n`;
      this.tables.forEach(table => {
        tablesContext += `### ${table.caption || table.id}\n`;
        tablesContext += `Headers: ${table.headers.join(' | ')}\n`;
        tablesContext += `Rows: ${table.rows.length}\n`;
        tablesContext += `Sample data:\n`;
        table.rows.slice(0, 3).forEach(row => {
          tablesContext += `  ${row.join(' | ')}\n`;
        });
        tablesContext += '\n';
      });
      console.log(`📊 Added ${this.tables.length} tables to context (${tablesContext.length} chars)`);
    }
    
    // Preparar contexto de layout/hierarquia (se existir)
    let layoutContext = '';
    if (this.layout.length > 0) {
      const headers = this.layout.filter(el => el.type === 'header');
      if (headers.length > 0) {
        layoutContext = `\n\n## ESTRUTURA DO DOCUMENTO\n\n`;
        headers.forEach(h => {
          const indent = '  '.repeat((h.level || 1) - 1);
          layoutContext += `${indent}${'#'.repeat(h.level || 1)} ${h.content}\n`;
        });
        console.log(`📐 Added layout hierarchy (${headers.length} headers) to context`);
      }
    }
    
    // NOVA ETAPA 1: Criar seções lógicas
    const logicalSections = await this.createLogicalSections(sections);
    
    // NOVA ETAPA 2: Filtrar apenas seções relevantes (FASE 4: passa totalPages)
    const relevantSections = await this.filterRelevantSections(logicalSections, userMessage, totalPages);
    
    console.log(`✅ [FILTRAGEM] ${relevantSections.length} seções relevantes selecionadas`);
    
    // Seções já vêm em tamanho gerenciável de rag-logical-sections (1.5K-3K chars)
    let workingSections = relevantSections;
    
    // FASE 2: Limitar quantidade máxima de seções (dinâmico por tamanho do doc)
    const maxSections = totalPages > 50 ? 35 : 20;
    if (workingSections.length > maxSections) {
      console.log(`⚠️ Limitando de ${workingSections.length} para ${maxSections} seções (doc com ${totalPages}p)`);
      workingSections = workingSections.slice(0, maxSections);
    }
    
    const finalChars = workingSections.reduce((sum, s) => sum + s.length, 0);
    const backendEstimate = Math.floor(finalChars / 2.5);
    
    console.log(`📊 [PRÉ-ENVIO] ${workingSections.length} seções, ${finalChars} chars (~${backendEstimate} tokens)`);
    console.log(`[DEBUG] Tipos das seções:`, workingSections.map((s, i) => ({
      index: i,
      type: typeof s,
      isString: typeof s === 'string',
      constructor: s?.constructor?.name,
      length: s.length
    })));
    
    // FASE 2: HARD LIMIT aumentado para 30K tokens
    if (backendEstimate > 30000) {
      console.warn(`⚠️ Tokens estimados (${backendEstimate}) excedem 30K. Reduzindo para ${maxSections - 10} seções.`);
      workingSections = workingSections.slice(0, maxSections - 5);
      
      // Recalcular após redução
      const reducedChars = workingSections.reduce((sum, s) => sum + s.length, 0);
      const reducedEstimate = Math.floor(reducedChars / 2.5);
      console.log(`✅ Reduzido para: ${workingSections.length} seções, ${reducedChars} chars (~${reducedEstimate} tokens)`);
      
      if (reducedEstimate > 30000) {
        throw new Error(`Documento muito grande mesmo após redução: ${reducedEstimate} tokens. Limite: 30K tokens.`);
      }
    }
    
    // Log detalhado
    workingSections.forEach((section, idx) => {
      console.log(`  📄 Seção ${idx + 1}: ${section.length} chars`);
      console.log(`  📝 "${section.substring(0, 80)}..."`);
    });
    
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
          totalPages,
          tablesContext: tablesContext || undefined
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
    // Lógica progressiva: quanto mais análises, menos agrupamento
    let SECTION_SIZE: number;
    
    if (analyses.length <= 4) {
      SECTION_SIZE = 1; // 1 análise = 1 seção (docs pequenos)
    } else if (analyses.length <= 10) {
      SECTION_SIZE = 2; // 2 análises por seção (docs médios)
    } else {
      SECTION_SIZE = Math.ceil(analyses.length / 6); // Max 6 seções (docs grandes)
    }
    
    const sections: string[][] = [];
    for (let i = 0; i < analyses.length; i += SECTION_SIZE) {
      sections.push(analyses.slice(i, i + SECTION_SIZE));
    }
    
    console.log(`📊 Agrupando ${analyses.length} análises em ${sections.length} seções (${SECTION_SIZE} análises/seção)`);
    return sections;
  }
}
