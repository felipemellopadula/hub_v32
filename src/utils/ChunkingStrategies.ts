export type DocType = 'general' | 'resume' | 'paper' | 'table' | 'qa' | 'contract' | 'manual';

export interface Chunk {
  content: string;
  metadata: {
    strategy: string;
    index: number;
    total?: number;
  };
}

export class ChunkingStrategies {
  /**
   * Get appropriate chunking strategy based on document type
   */
  static getStrategy(docType: DocType, content: string, maxChunkSize: number = 120000): Chunk[] {
    console.log(`📋 [CHUNKING] Using strategy: ${docType}`);
    
    switch (docType) {
      case 'resume':
        return this.chunkByResumeSection(content, maxChunkSize);
      case 'paper':
        return this.chunkByPaperSection(content, maxChunkSize);
      case 'table':
        return this.chunkByTableRow(content, maxChunkSize);
      case 'qa':
        return this.chunkByQAPair(content, maxChunkSize);
      case 'contract':
        return this.chunkByContractSection(content, maxChunkSize);
      case 'manual':
        return this.chunkByManualSection(content, maxChunkSize);
      default:
        return this.chunkByFixedSize(content, maxChunkSize);
    }
  }

  /**
   * Resume: Chunk by major sections (Experience, Education, Skills)
   */
  private static chunkByResumeSection(content: string, maxSize: number): Chunk[] {
    const sectionPatterns = [
      /experience|experiência|trabalho|professional/i,
      /education|educação|formação|academic/i,
      /skills|habilidades|competências|technical/i,
      /projects|projetos|portfolio/i,
      /certifications|certificações|cursos/i
    ];

    const chunks: Chunk[] = [];
    let currentChunk = '';
    const lines = content.split('\n');

    for (const line of lines) {
      const isSection = sectionPatterns.some(pattern => pattern.test(line));
      
      if (isSection && currentChunk && currentChunk.length > 1000) {
        // Nova seção e chunk atual está substancial
        chunks.push({
          content: currentChunk.trim(),
          metadata: { strategy: 'resume_section', index: chunks.length }
        });
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
        
        // Forçar split se exceder maxSize
        if (currentChunk.length > maxSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { strategy: 'resume_section', index: chunks.length }
          });
          currentChunk = '';
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { strategy: 'resume_section', index: chunks.length }
      });
    }

    console.log(`✅ Resume chunked into ${chunks.length} sections`);
    return chunks;
  }

  /**
   * Paper: Chunk by academic sections (Abstract, Intro, Methods, Results, Discussion)
   */
  private static chunkByPaperSection(content: string, maxSize: number): Chunk[] {
    const sectionPatterns = [
      /abstract|resumo/i,
      /introduction|introdução/i,
      /methodology|methods|métodos|metodologia/i,
      /results|resultados/i,
      /discussion|discussão/i,
      /conclusion|conclusão/i,
      /references|referências|bibliografia/i
    ];

    const chunks: Chunk[] = [];
    let currentChunk = '';
    const lines = content.split('\n');

    for (const line of lines) {
      const isSection = sectionPatterns.some(pattern => pattern.test(line));
      
      if (isSection && currentChunk && currentChunk.length > 2000) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: { strategy: 'paper_section', index: chunks.length }
        });
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
        
        if (currentChunk.length > maxSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { strategy: 'paper_section', index: chunks.length }
          });
          currentChunk = '';
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { strategy: 'paper_section', index: chunks.length }
      });
    }

    console.log(`✅ Paper chunked into ${chunks.length} sections`);
    return chunks;
  }

  /**
   * Table: Chunk by logical row groups (preserve table structure)
   */
  private static chunkByTableRow(content: string, maxSize: number): Chunk[] {
    const chunks: Chunk[] = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let tableHeader = '';

    // Identificar header da tabela
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].includes('|') || lines[i].includes('\t')) {
        tableHeader = lines[i] + '\n';
        break;
      }
    }

    for (const line of lines) {
      currentChunk += line + '\n';
      
      // Chunk a cada 100 linhas ou ao exceder maxSize
      if (currentChunk.split('\n').length > 100 || currentChunk.length > maxSize) {
        chunks.push({
          content: (tableHeader + currentChunk).trim(),
          metadata: { strategy: 'table_rows', index: chunks.length }
        });
        currentChunk = '';
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: (tableHeader + currentChunk).trim(),
        metadata: { strategy: 'table_rows', index: chunks.length }
      });
    }

    console.log(`✅ Table chunked into ${chunks.length} row groups`);
    return chunks;
  }

  /**
   * Q&A: Chunk by question-answer pairs
   */
  private static chunkByQAPair(content: string, maxSize: number): Chunk[] {
    const questionPatterns = [
      /^\d+\.\s/,  // "1. Question"
      /^Q\d*[:\.]?\s/i,  // "Q: Question" or "Q1: Question"
      /^pergunta/i,
      /^\?\s/,  // "? Question"
    ];

    const chunks: Chunk[] = [];
    let currentChunk = '';
    const lines = content.split('\n');

    for (const line of lines) {
      const isQuestion = questionPatterns.some(pattern => pattern.test(line.trim()));
      
      if (isQuestion && currentChunk && currentChunk.length > 500) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: { strategy: 'qa_pair', index: chunks.length }
        });
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
        
        if (currentChunk.length > maxSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { strategy: 'qa_pair', index: chunks.length }
          });
          currentChunk = '';
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { strategy: 'qa_pair', index: chunks.length }
      });
    }

    console.log(`✅ Q&A chunked into ${chunks.length} pairs`);
    return chunks;
  }

  /**
   * Contract: Chunk by numbered clauses
   */
  private static chunkByContractSection(content: string, maxSize: number): Chunk[] {
    const clausePattern = /^(\d+\.)+\s/;  // "1.", "1.1.", "2.3.4.", etc.
    
    const chunks: Chunk[] = [];
    let currentChunk = '';
    const lines = content.split('\n');

    for (const line of lines) {
      const isClause = clausePattern.test(line.trim());
      
      if (isClause && currentChunk && currentChunk.length > 1500) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: { strategy: 'contract_clause', index: chunks.length }
        });
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
        
        if (currentChunk.length > maxSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { strategy: 'contract_clause', index: chunks.length }
          });
          currentChunk = '';
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { strategy: 'contract_clause', index: chunks.length }
      });
    }

    console.log(`✅ Contract chunked into ${chunks.length} clauses`);
    return chunks;
  }

  /**
   * Manual: Chunk by chapters/steps
   */
  private static chunkByManualSection(content: string, maxSize: number): Chunk[] {
    const sectionPatterns = [
      /^chapter|capítulo/i,
      /^step|passo|etapa/i,
      /^\d+\./,  // Numbered sections
      /^section|seção/i
    ];

    const chunks: Chunk[] = [];
    let currentChunk = '';
    const lines = content.split('\n');

    for (const line of lines) {
      const isSection = sectionPatterns.some(pattern => pattern.test(line.trim()));
      
      if (isSection && currentChunk && currentChunk.length > 2000) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: { strategy: 'manual_section', index: chunks.length }
        });
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
        
        if (currentChunk.length > maxSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { strategy: 'manual_section', index: chunks.length }
          });
          currentChunk = '';
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { strategy: 'manual_section', index: chunks.length }
      });
    }

    console.log(`✅ Manual chunked into ${chunks.length} sections`);
    return chunks;
  }

  /**
   * General: Fixed-size chunks with overlap (fallback)
   */
  private static chunkByFixedSize(content: string, maxSize: number): Chunk[] {
    const overlapSize = Math.floor(maxSize * 0.15);
    const chunks: Chunk[] = [];
    let position = 0;
    
    while (position < content.length) {
      const end = Math.min(position + maxSize, content.length);
      chunks.push({
        content: content.slice(position, end),
        metadata: { strategy: 'fixed_size', index: chunks.length }
      });
      position += (maxSize - overlapSize);
      if (end === content.length) break;
    }
    
    console.log(`✅ General chunked into ${chunks.length} fixed-size chunks`);
    return chunks;
  }
}
