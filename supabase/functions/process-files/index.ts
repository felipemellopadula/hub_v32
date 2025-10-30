// Edge function para processar arquivos Python e Excel
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as XLSX from "https://esm.sh/xlsx@0.20.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file, fileName, fileType } = await req.json();

    if (!file || !fileName) {
      return new Response(
        JSON.stringify({ error: "Arquivo e nome do arquivo são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let processedContent = "";

    // Processar arquivos Python
    if (fileName.endsWith(".py") || fileType === "text/x-python") {
      // Remover o prefixo data:text/x-python;base64, se existir
      const base64Data = file.includes(",") ? file.split(",")[1] : file;
      const decoder = new TextDecoder("utf-8");
      const binaryData = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );
      processedContent = decoder.decode(binaryData);

      return new Response(
        JSON.stringify({
          success: true,
          content: processedContent,
          type: "python",
          fileName: fileName,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Processar arquivos Excel
    if (
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      fileType.includes("spreadsheet") ||
      fileType.includes("excel")
    ) {
      // Remover o prefixo data:... se existir
      const base64Data = file.includes(",") ? file.split(",")[1] : file;
      const binaryData = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );

      // Ler o arquivo Excel
      const workbook = XLSX.read(binaryData, { type: "array" });

      // Processar todas as planilhas
      const sheets: any[] = [];
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        sheets.push({
          name: sheetName,
          data: jsonData,
        });
      });

      // Formatar o conteúdo para texto legível
      let textContent = `Arquivo Excel: ${fileName}\n\n`;
      sheets.forEach((sheet) => {
        textContent += `=== Planilha: ${sheet.name} ===\n\n`;

        if (sheet.data.length > 0) {
          // Pegar headers (primeira linha)
          const headers = sheet.data[0] as any[];
          textContent += headers.join(" | ") + "\n";
          textContent += "-".repeat(headers.join(" | ").length) + "\n";

          // Adicionar as linhas de dados
          for (let i = 1; i < Math.min(sheet.data.length, 101); i++) {
            const row = sheet.data[i] as any[];
            textContent += row.join(" | ") + "\n";
          }

          if (sheet.data.length > 101) {
            textContent += `\n... (${
              sheet.data.length - 101
            } linhas adicionais omitidas)\n`;
          }
        } else {
          textContent += "(Planilha vazia)\n";
        }

        textContent += "\n\n";
      });

      return new Response(
        JSON.stringify({
          success: true,
          content: textContent,
          type: "excel",
          fileName: fileName,
          sheets: sheets.map((s) => ({
            name: s.name,
            rowCount: s.data.length,
          })),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Tipo de arquivo não suportado",
        supportedTypes: [".py", ".xlsx", ".xls"],
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao processar arquivo:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao processar arquivo",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
