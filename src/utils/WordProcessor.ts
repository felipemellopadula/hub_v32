// Lazy load mammoth library
let mammothLib: any = null;

const loadMammoth = async () => {
  if (!mammothLib) {
    mammothLib = await import('mammoth');
  }
  return mammothLib;
};

export interface WordProcessingResult {
  success: boolean;
  content?: string;
  error?: string;
  wordCount?: number;
  fileSize?: number;
}

export class WordProcessor {
  static async processWord(
    file: File,
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<WordProcessingResult> {
    try {
      console.log('Processing Word file:', file.name, 'Size:', file.size);

      // Verificar se é um arquivo Word válido
      const isDocx = file.type.includes('word') || file.name.toLowerCase().endsWith('.docx');
      const isDoc = file.name.toLowerCase().endsWith('.doc');
      
      if (!isDocx && !isDoc) {
        return {
          success: false,
          error: 'Arquivo deve ser um documento Word (.docx ou .doc)'
        };
      }

      console.log('Convertendo Word para texto...');
      
      if (onProgress) {
        onProgress(1, 3, 'Lendo arquivo Word...');
      }

      const arrayBuffer = await file.arrayBuffer();
      
      if (onProgress) {
        onProgress(2, 3, 'Extraindo texto...');
      }
      
      let result;
      
      if (isDoc) {
        // Para arquivos .doc antigos, usar uma abordagem diferente
        try {
          // Tentar extrair texto como texto simples
          const uint8Array = new Uint8Array(arrayBuffer);
          let textContent = '';
          
          // Procurar por texto legível no arquivo .doc
          for (let i = 0; i < uint8Array.length - 1; i++) {
            const char = uint8Array[i];
            // Filtrar caracteres imprimíveis (32-126 ASCII)
            if (char >= 32 && char <= 126) {
              textContent += String.fromCharCode(char);
            } else if (char === 10 || char === 13) {
              textContent += '\n';
            }
          }
          
          // Limpar texto extraído removendo caracteres de controle e duplicados
          textContent = textContent
            .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove caracteres de controle
            .replace(/\s+/g, ' ') // Normaliza espaços
            .trim();
          
          // Se não conseguiu extrair texto suficiente, tentar mammoth mesmo assim
          if (textContent.length < 50) {
            const mammoth = await loadMammoth();
            result = await mammoth.extractRawText({ arrayBuffer });
          } else {
            result = { value: textContent, messages: [] };
          }
        } catch (docError) {
          console.warn('Erro ao processar .doc, tentando mammoth:', docError);
          const mammoth = await loadMammoth();
          result = await mammoth.extractRawText({ arrayBuffer });
        }
      } else {
        // Para arquivos .docx, usar mammoth normalmente
        const mammoth = await loadMammoth();
        result = await mammoth.extractRawText({ arrayBuffer });
      }
      
      if (!result.value || result.value.trim().length === 0) {
        return {
          success: false,
          error: 'Documento Word parece estar vazio ou não foi possível extrair texto'
        };
      }

      // Log das mensagens de warning, se houver
      if (result.messages && result.messages.length > 0) {
        const warnings = result.messages.filter(m => m.type === 'warning');
        if (warnings.length > 0) {
          console.warn('Warnings during Word processing:', warnings);
        }
      }

      const content = result.value.trim();
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      
      if (onProgress) {
        onProgress(3, 3, 'Processamento concluído!');
      }
      
      console.log('Word processed successfully:', {
        fileName: file.name,
        fileType: isDoc ? '.doc' : '.docx',
        contentLength: content.length,
        wordCount: wordCount,
        contentPreview: content.substring(0, 200) + '...'
      });

      return {
        success: true,
        content: content,
        wordCount: wordCount,
        fileSize: file.size
      };

    } catch (error: any) {
      console.error('Erro ao processar Word:', error);
      
      // Verificar se o erro é devido ao formato .doc
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

  static getMaxFileInfo(): string {
    return "Word (.doc/.docx): até 50MB por arquivo";
  }
}