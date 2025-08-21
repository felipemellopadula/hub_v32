import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Configurar o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PdfProcessResult {
  success: boolean;
  content?: string;
  error?: string;
  pageCount?: number;
  isPasswordProtected?: boolean;
  fileSize?: number;
}

export class PdfProcessor {
  // Limites removidos para PDFs grandes
  static readonly MAX_FILE_SIZE_MB = 500; // 500MB
  static readonly MAX_PAGES = 10000; // 10000 páginas
  static readonly MAX_FILE_SIZE_BYTES = PdfProcessor.MAX_FILE_SIZE_MB * 1024 * 1024;
  static readonly BATCH_SIZE = 50; // Processar em lotes de 50 páginas

  static async processPdf(file: File): Promise<PdfProcessResult> {
    try {
      // Verificar tamanho do arquivo
      if (file.size > this.MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: `Arquivo muito grande. Tamanho máximo: ${this.MAX_FILE_SIZE_MB}MB`,
          fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100
        };
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      let pdfDocument;
      try {
        // Tentar carregar o PDF
        pdfDocument = await pdfjsLib.getDocument({
          data: uint8Array,
          password: '', // Primeiro tentar sem senha
        }).promise;
      } catch (error: any) {
        // Verificar se é erro de senha
        if (error.name === 'PasswordException' || error.message?.includes('password')) {
          return {
            success: false,
            error: 'PDF protegido por senha. Não é possível processar arquivos protegidos.',
            isPasswordProtected: true,
            fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100
          };
        }
        throw error;
      }

      const numPages = pdfDocument.numPages;

      // Informar sobre o processamento de PDFs grandes
      console.log(`Processando PDF com ${numPages} páginas. Isso pode levar alguns minutos...`);

      let fullText = '';
      let hasImages = false;
      let processedPages = 0;

      // Processar páginas em lotes para PDFs grandes
      for (let batchStart = 1; batchStart <= numPages; batchStart += this.BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + this.BATCH_SIZE - 1, numPages);
        console.log(`Processando páginas ${batchStart} a ${batchEnd} de ${numPages}...`);

        for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
          const page = await pdfDocument.getPage(pageNum);
          
          // Tentar extrair texto primeiro
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .filter(str => str.trim().length > 0)
            .join(' ');

          if (pageText.trim()) {
            // Para PDFs grandes, não incluir "--- Página X ---" para economizar espaço
            fullText += `${pageText}\n`;
          } else {
            // Se não há texto, tentar OCR na imagem da página (apenas para poucas páginas)
            hasImages = true;
            if (pageNum <= 10 || pageNum % 10 === 0) { // OCR apenas em algumas páginas para economizar tempo
              try {
                const viewport = page.getViewport({ scale: 1.5 }); // Escala menor para PDFs grandes
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d')!;
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                  canvasContext: context,
                  viewport: viewport,
                }).promise;

                // Usar Tesseract para OCR
                const worker = await createWorker('por+eng');
                const { data: { text } } = await worker.recognize(canvas);
                await worker.terminate();

                if (text.trim()) {
                  fullText += `${text}\n`;
                }
              } catch (ocrError) {
                console.warn(`Erro no OCR da página ${pageNum}:`, ocrError);
              }
            }
          }
          
          processedPages++;
          
          // Pequena pausa a cada 25 páginas para não travar o browser
          if (processedPages % 25 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
        // Pausa maior entre lotes
        if (batchEnd < numPages) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      if (!fullText.trim()) {
        return {
          success: false,
          error: 'Não foi possível extrair texto do PDF. O arquivo pode estar corrompido ou ser apenas imagens.',
          pageCount: numPages,
          fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100
        };
      }

      return {
        success: true,
        content: fullText.trim(),
        pageCount: numPages,
        fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100
      };

    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      return {
        success: false,
        error: 'Erro interno ao processar o PDF. Verifique se o arquivo não está corrompido.',
        fileSize: file ? Math.round(file.size / (1024 * 1024) * 100) / 100 : 0
      };
    }
  }

  static getMaxFileInfo(): string {
    return `Suporte a PDFs grandes: até ${this.MAX_FILE_SIZE_MB}MB | Sem limite de páginas`;
  }

  // Método para criar resumo automático de PDFs grandes
  static createSummaryPrompt(content: string, pages: number): string {
    return `Este é um PDF com ${pages} páginas. Conteúdo extraído:

${content}

Por favor, forneça:
1. Um resumo executivo dos pontos principais
2. Os tópicos mais importantes abordados
3. Conclusões ou insights relevantes
4. Qualquer informação crítica que se destaque

Seja conciso mas abrangente na sua análise.`;
  }

  // Método para análise detalhada
  static createAnalysisPrompt(content: string, pages: number, question: string): string {
    return `Analisando PDF com ${pages} páginas sobre: "${question}"

Conteúdo do documento:
${content}

Com base no conteúdo acima, responda à pergunta de forma detalhada, citando partes relevantes do documento quando possível.`;
  }
}