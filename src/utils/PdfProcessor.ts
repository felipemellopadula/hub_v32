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
  // Limites de tamanho
  static readonly MAX_FILE_SIZE_MB = 50; // 50MB
  static readonly MAX_PAGES = 1000; // 2000 páginas
  static readonly MAX_FILE_SIZE_BYTES = PdfProcessor.MAX_FILE_SIZE_MB * 1024 * 1024;

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

      // Verificar número de páginas
      if (numPages > this.MAX_PAGES) {
        return {
          success: false,
          error: `PDF tem muitas páginas. Máximo permitido: ${this.MAX_PAGES} páginas`,
          pageCount: numPages,
          fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100
        };
      }

      let fullText = '';
      let hasImages = false;

      // Processar cada página
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        
        // Tentar extrair texto primeiro
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .filter(str => str.trim().length > 0)
          .join(' ');

        if (pageText.trim()) {
          fullText += `\n--- Página ${pageNum} ---\n${pageText}\n`;
        } else {
          // Se não há texto, tentar OCR na imagem da página
          hasImages = true;
          try {
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            // Usar Tesseract para OCR
            const worker = await createWorker('por+eng'); // Português e Inglês
            const { data: { text } } = await worker.recognize(canvas);
            await worker.terminate();

            if (text.trim()) {
              fullText += `\n--- Página ${pageNum} (OCR) ---\n${text}\n`;
            }
          } catch (ocrError) {
            console.warn(`Erro no OCR da página ${pageNum}:`, ocrError);
            fullText += `\n--- Página ${pageNum} ---\n[Página contém imagens/gráficos que não puderam ser processados]\n`;
          }
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
    return `Tamanho máximo: ${this.MAX_FILE_SIZE_MB}MB | Páginas máximas: ${this.MAX_PAGES}`;
  }
}