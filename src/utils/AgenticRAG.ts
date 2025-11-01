import { supabase } from "@/integrations/supabase/client";

interface ChunkProgress {
  current: number;
  total: number;
  status: string;
}

export class AgenticRAG {
  // FASE 1: Chunking no frontend (instantâneo)
  createChunks(content: string, totalPages: number): string[] {
    const chunkPages = this.getChunkSize(totalPages);
    const chunkSize = chunkPages * 3500; // chars por página
    const overlapSize = Math.floor(chunkSize * 0.15); // 15% overlap
    
    const chunks: string[] = [];
    let position = 0;
    
    while (position < content.length) {
      const end = Math.min(position + chunkSize, content.length);
      chunks.push(content.slice(position, end));
      position += (chunkSize - overlapSize);
      if (end === content.length) break;
    }
    
    return chunks;
  }

  // FASE 2: Análise paralela de chunks (3 por vez)
  async analyzeChunks(
    chunks: string[],
    totalPages: number,
    onProgress: (progress: ChunkProgress) => void
  ): Promise<string[]> {
    const BATCH_SIZE = 3;
    const results: string[] = [];
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      onProgress({
        current: i,
        total: chunks.length,
        status: `Analisando chunks ${i+1}-${Math.min(i+BATCH_SIZE, chunks.length)} de ${chunks.length}`
      });
      
      // Processar batch em paralelo
      const batchPromises = batch.map((chunk, idx) => 
        this.analyzeChunk(chunk, i + idx, chunks.length, totalPages)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  // Chamar edge function para análise de 1 chunk
  private async analyzeChunk(
    chunk: string,
    index: number,
    total: number,
    totalPages: number
  ): Promise<string> {
    const { data, error } = await supabase.functions.invoke('rag-analyze-chunk', {
      body: {
        chunk,
        chunkIndex: index,
        totalChunks: total,
        totalPages
      }
    });
    
    if (error) throw new Error(`Chunk ${index+1} failed: ${error.message}`);
    return data.analysis;
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

  // FASE 4: Consolidação final com streaming (hierárquica se necessário)
  async *consolidateAndStream(
    sections: string[],
    userMessage: string,
    fileName: string,
    totalPages: number
  ): AsyncGenerator<string> {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Estimar tokens (aproximadamente 4 chars = 1 token)
    const totalChars = sections.reduce((sum, s) => sum + s.length, 0);
    const estimatedTokens = Math.floor(totalChars / 4);
    
    console.log(`📊 Tokens estimados: ${estimatedTokens}`);
    
    // Se ultrapassar 20K tokens, fazer consolidação progressiva
    let finalSections = sections;
    if (estimatedTokens > 20000 && sections.length > 2) {
      console.log('🔄 Tokens muito altos, fazendo pré-consolidação...');
      finalSections = await this.preConsolidate(sections);
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
          sections: finalSections,
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

  // Pré-consolidar seções em grupos menores
  private async preConsolidate(sections: string[]): Promise<string[]> {
    console.log(`🔄 Pré-consolidando ${sections.length} seções em pares...`);
    
    const consolidated: string[] = [];
    
    // Consolidar em pares
    for (let i = 0; i < sections.length; i += 2) {
      if (i + 1 < sections.length) {
        // Consolidar par
        const pair = [sections[i], sections[i + 1]];
        const { data, error } = await supabase.functions.invoke('rag-synthesize-section', {
          body: {
            analyses: pair,
            sectionIndex: Math.floor(i / 2),
            totalSections: Math.ceil(sections.length / 2)
          }
        });
        
        if (error) throw new Error(`Pre-consolidation failed: ${error.message}`);
        consolidated.push(data.synthesis);
      } else {
        // Última seção ímpar
        consolidated.push(sections[i]);
      }
    }
    
    console.log(`✅ Pré-consolidação completa: ${sections.length} → ${consolidated.length} seções`);
    return consolidated;
  }

  // Helpers
  private getChunkSize(pages: number): number {
    if (pages <= 50) return 20;
    if (pages <= 100) return 25;
    if (pages <= 200) return 30;
    if (pages <= 500) return 40;
    return 50;
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
