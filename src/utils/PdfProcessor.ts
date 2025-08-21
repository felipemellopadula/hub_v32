// Caminho: src/utils/PdfProcessor.ts

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
  // Limites otimizados para PDFs grandes
  static readonly MAX_FILE_SIZE_MB = 500;
  static readonly MAX_PAGES = 10000;
  static readonly MAX_FILE_SIZE_BYTES = PdfProcessor.MAX_FILE_SIZE_MB * 1024 * 1024;
  static readonly BATCH_SIZE = 50; // Processar em lotes para não travar

  static async processPdf(file: File): Promise<PdfProcessResult> {
    try {
      if (file.size > this.MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: `Arquivo muito grande. Tamanho máximo: ${this.MAX_FILE_SIZE_MB}MB`,
          fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100,
        };
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let pdfDocument;

      try {
        pdfDocument = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      } catch (error: any) {
        if (error.name === 'PasswordException') {
          return {
            success: false,
            error: 'PDF protegido por senha. Não é possível processar.',
            isPasswordProtected: true,
            fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100,
          };
        }
        throw error;
      }

      const numPages = pdfDocument.numPages;
      console.log(`Processando PDF com ${numPages} páginas...`);

      let fullText = '';
      for (let i = 1; i <= numPages; i += this.BATCH_SIZE) {
        const promises = [];
        for (let j = i; j < i + this.BATCH_SIZE && j <= numPages; j++) {
          promises.push(pdfDocument.getPage(j).then(page => page.getTextContent()));
        }
        const textContents = await Promise.all(promises);
        textContents.forEach(textContent => {
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        });
        console.log(`Processou até a página ${Math.min(i + this.BATCH_SIZE - 1, numPages)}`);
        await new Promise(resolve => setTimeout(resolve, 10)); // Pausa para UI
      }
      
      if (!fullText.trim()) {
        return {
          success: false,
          error: 'Não foi possível extrair texto do PDF.',
          pageCount: numPages,
          fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100,
        };
      }

      return {
        success: true,
        content: fullText.trim(),
        pageCount: numPages,
        fileSize: Math.round(file.size / (1024 * 1024) * 100) / 100,
      };
    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      return {
        success: false,
        error: 'Erro interno ao processar o PDF.',
        fileSize: file ? Math.round(file.size / (1024 * 1024) * 100) / 100 : 0,
      };
    }
  }

  static getMaxFileInfo(): string {
    return `Suporte a PDFs grandes: até ${this.MAX_FILE_SIZE_MB}MB`;
  }

  static createSummaryPrompt(content: string, pages: number): string {
    return `Este é um PDF com ${pages} páginas. Conteúdo extraído:\n\n${content}\n\nPor favor, forneça um resumo executivo completo.`;
  }

  static createAnalysisPrompt(content: string, pages: number, question: string): string {
    return `Analisando PDF com ${pages} páginas sobre: "${question}"\n\nConteúdo do documento:\n${content}\n\nCom base no conteúdo acima, responda à pergunta de forma detalhada.`;
  }
}