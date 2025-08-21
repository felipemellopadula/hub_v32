// Salve este código como: src/utils/PdfProcessor.ts

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
  // Limites aumentados para suportar PDFs grandes
  static readonly MAX_FILE_SIZE_MB = 500; // 500MB
  static readonly MAX_PAGES = 10000; // 10000 páginas
  static readonly MAX_FILE_SIZE_BYTES = PdfProcessor.MAX_FILE_SIZE_MB * 1024 * 1024;
  static readonly BATCH_SIZE = 50; // Processar em lotes de 50 páginas para não travar a UI

  static async processPdf(file: File): Promise<PdfProcessResult> {
    try {
      // Verificar tamanho do arquivo (limite alto)
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
        pdfDocument = await pdfjsLib.getDocument({
          data: uint8Array,
          password: '', // Tenta sem senha primeiro
        }).promise;
      } catch (error: any) {
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
      console.log(`Iniciando processamento de PDF com ${numPages} páginas...`);

      let fullText = '';
      let processedPages = 0;

      // Processar em lotes (batches) para PDFs gigantes
      for (let batchStart = 1; batchStart <= numPages; batchStart += this.BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + this.BATCH_SIZE - 1, numPages);
        console.log(`Processando lote de páginas: ${batchStart} a ${batchEnd} de ${numPages}...`);

        const pagePromises = [];
        for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
            pagePromises.push(pdfDocument.getPage(pageNum));
        }

        const pages = await Promise.all(pagePromises);

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pageNum = batchStart + i;

            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');

            if (pageText.trim()) {
              // Não adicionar "--- Página X ---" para economizar tokens e espaço
              fullText += `${pageText}\n\n`;
            } else {
              // Lógica de OCR (opcional e pode ser lenta, mantida simples)
              console.warn(`Página ${pageNum} parece ser uma imagem ou vazia.`);
            }

            processedPages++;
            if (processedPages % 25 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10)); // Pausa para não congelar UI
            }
        }
        await new Promise(resolve => setTimeout(resolve, 50)); // Pausa maior entre lotes
      }

      if (!fullText.trim()) {
        return {
          success: false,
          error: 'Não foi possível extrair texto do PDF. O arquivo pode conter apenas imagens ou estar corrompido.',
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
      console.error('Erro crítico ao processar PDF:', error);
      return {
        success: false,
        error: 'Erro interno ao processar o PDF. Verifique se o arquivo não está corrompido.',
        fileSize: file ? Math.round(file.size / (1024 * 1024) * 100) / 100 : 0
      };
    }
  }

  static getMaxFileInfo(): string {
    return `Suporte a PDFs grandes: até ${this.MAX_FILE_SIZE_MB}MB`;
  }

  // Método para criar prompt de resumo (usaremos isso no Chat.tsx)
  static createSummaryPrompt(content: string, pages: number): string {
    return `Com base no conteúdo de um documento de ${pages} páginas fornecido abaixo, crie um resumo executivo detalhado. Destaque os pontos principais, as conclusões mais importantes e quaisquer dados ou estatísticas cruciais.\n\nCONTEÚDO DO DOCUMENTO:\n"""\n${content}\n"""`;
  }

  // Método para criar prompt de análise (usaremos isso no Chat.tsx)
  static createAnalysisPrompt(content: string, pages: number, question: string): string {
    return `Use o conteúdo de um documento de ${pages} páginas, fornecido abaixo, como a única fonte de verdade para responder à seguinte pergunta. Seja detalhado e preciso na sua resposta.\n\nPERGUNTA: "${question}"\n\nCONTEÚDO DO DOCUMENTO:\n"""\n${content}\n"""`;
  }
}