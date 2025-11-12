// Lazy load mammoth library
let mammothLib: any = null;

const loadMammoth = async () => {
  if (!mammothLib) {
    mammothLib = await import('mammoth');
  }
  return mammothLib;
};

export interface LayoutElement {
  type: 'header' | 'paragraph' | 'table' | 'list' | 'figure';
  level?: number;
  content: string;
  position: string;
}

export interface ExtractedTable {
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  position: string;
}

export interface WordProcessingResult {
  success: boolean;
  content?: string;
  error?: string;
  wordCount?: number;
  fileSize?: number;
  layout?: LayoutElement[];
  tables?: ExtractedTable[];
  pageCount?: number;
}

export class WordProcessor {
  static async processWord(
    file: File,
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<WordProcessingResult> {
    try {
      console.log('Processing Word file:', file.name, 'Size:', file.size);

      const isDocx = file.type.includes('word') || file.name.toLowerCase().endsWith('.docx');
      const isDoc = file.name.toLowerCase().endsWith('.doc');
      
      if (!isDocx && !isDoc) {
        return {
          success: false,
          error: 'Arquivo deve ser um documento Word (.docx ou .doc)'
        };
      }

      if (onProgress) {
        onProgress(1, 5, 'Lendo arquivo Word...');
      }

      const arrayBuffer = await file.arrayBuffer();
      
      if (onProgress) {
        onProgress(2, 5, 'Convertendo Word para HTML estruturado...');
      }
      
      const mammoth = await loadMammoth();
      
      let htmlResult;
      
      if (isDoc) {
        try {
          const uint8Array = new Uint8Array(arrayBuffer);
          let textContent = '';
          
          for (let i = 0; i < uint8Array.length - 1; i++) {
            const char = uint8Array[i];
            if (char >= 32 && char <= 126) {
              textContent += String.fromCharCode(char);
            } else if (char === 10 || char === 13) {
              textContent += '\n';
            }
          }
          
          textContent = textContent
            .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (textContent.length < 50) {
            htmlResult = await mammoth.convertToHtml({ arrayBuffer });
          } else {
            htmlResult = { value: `<p>${textContent.replace(/\n/g, '</p><p>')}</p>`, messages: [] };
          }
        } catch (docError) {
          console.warn('Erro ao processar .doc, tentando mammoth:', docError);
          htmlResult = await mammoth.convertToHtml({ arrayBuffer });
        }
      } else {
        htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      }
      
      if (!htmlResult.value || htmlResult.value.trim().length === 0) {
        return {
          success: false,
          error: 'Documento Word parece estar vazio ou não foi possível extrair conteúdo'
        };
      }

      if (onProgress) {
        onProgress(3, 5, 'Extraindo estrutura do documento...');
      }

      // Parsear HTML para extrair estrutura
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlResult.value, 'text/html');
      
      const layout = this.extractLayoutFromHTML(doc);
      const tables = this.extractTablesFromHTML(doc);
      
      // Extrair texto completo combinando layouts
      const content = layout
        .map(el => el.content)
        .filter(text => text.length > 0)
        .join('\n\n');

      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const wordBasedPages = Math.ceil(wordCount / 400);
      const sizeBasedPages = Math.ceil(file.size / 30000); // 30KB por página (média com imagens/tabelas)
      const estimatedPages = Math.max(wordBasedPages, sizeBasedPages); // Usar o maior
      console.log(`📊 Estimativa: ${wordBasedPages}p (palavras) vs ${sizeBasedPages}p (tamanho) → ${estimatedPages}p`);
      
      if (onProgress) {
        onProgress(5, 5, 'Processamento concluído!');
      }
      
      console.log('Word processed with structure:', {
        fileName: file.name,
        fileType: isDoc ? '.doc' : '.docx',
        contentLength: content.length,
        wordCount,
        estimatedPages,
        layoutElements: layout.length,
        tablesFound: tables.length
      });

      return {
        success: true,
        content,
        wordCount,
        fileSize: file.size,
        layout,
        tables,
        pageCount: estimatedPages
      };

    } catch (error: any) {
      console.error('Erro ao processar Word:', error);
      
      if (error.message && error.message.includes('Could not find the body element')) {
        return {
          success: false,
          error: 'Não foi possível processar este arquivo .doc. O arquivo pode estar corrompido ou usar um formato muito antigo.'
        };
      }
      
      return {
        success: false,
        error: `Falha ao processar documento Word: ${error.message || 'Erro desconhecido'}`
      };
    }
  }

  private static extractLayoutFromHTML(doc: Document): LayoutElement[] {
    const layouts: LayoutElement[] = [];
    let elementIndex = 0;

    doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol').forEach((el) => {
      const tagName = el.tagName.toLowerCase();
      
      if (tagName.startsWith('h')) {
        layouts.push({
          type: 'header',
          level: parseInt(tagName.charAt(1)),
          content: el.textContent?.trim() || '',
          position: `element_${elementIndex++}`
        });
      } else if (tagName === 'p') {
        const text = el.textContent?.trim() || '';
        if (text.length > 10) {
          layouts.push({
            type: 'paragraph',
            content: text,
            position: `element_${elementIndex++}`
          });
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        const listItems = Array.from(el.querySelectorAll('li'))
          .map(li => `• ${li.textContent?.trim()}`)
          .join('\n');
        
        layouts.push({
          type: 'list',
          content: listItems,
          position: `element_${elementIndex++}`
        });
      }
    });

    return layouts;
  }

  private static extractTablesFromHTML(doc: Document): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    let tableIndex = 0;

    doc.querySelectorAll('table').forEach((tableEl) => {
      try {
        const headerRow = tableEl.querySelector('thead tr') || tableEl.querySelector('tr');
        const headers: string[] = [];
        
        if (headerRow) {
          headerRow.querySelectorAll('th, td').forEach((cell) => {
            headers.push(cell.textContent?.trim() || '');
          });
        }

        const rows: string[][] = [];
        const bodyRows = tableEl.querySelectorAll('tbody tr') || 
                        Array.from(tableEl.querySelectorAll('tr')).slice(1);
        
        bodyRows.forEach((row) => {
          const cells: string[] = [];
          row.querySelectorAll('td, th').forEach((cell) => {
            cells.push(cell.textContent?.trim() || '');
          });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

        if (headers.length > 0 && rows.length > 0) {
          tables.push({
            id: `table_${tableIndex}`,
            headers,
            rows,
            caption: tableEl.caption?.textContent?.trim(),
            position: `table_${tableIndex}`
          });
          tableIndex++;
        }
      } catch (err) {
        console.warn('Erro ao extrair tabela:', err);
      }
    });

    return tables;
  }

  static getMaxFileInfo(): string {
    return "Word (.doc/.docx): até 50MB por arquivo";
  }
}
