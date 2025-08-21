// Caminho: supabase/functions/ai-chat/index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- INTERFACES ---
interface ChatFile {
  name: string;
  type: string;
  pdfContent?: string;
}

interface ChatRequest {
  message: string;
  model: string;
  files?: ChatFile[];
}

// --- FUNÇÕES AUXILIARES ---
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3.5); // Média de caracteres por token
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

// --- LÓGICA PRINCIPAL DA FUNÇÃO ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, model, files }: ChatRequest = await req.json();
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY não foi encontrada nas configurações do seu projeto Supabase.");
    }
    if (!model) {
      throw new Error('O nome do modelo é obrigatório.');
    }

    // --- TRADUÇÃO DE MODELOS ---
    let apiModel = model;
    if (model.includes('gpt-5-mini') || model.includes('gpt-5-nano')) apiModel = 'gpt-4o-mini';
    else if (model.includes('gpt-5')) apiModel = 'gpt-4o';
    else if (model.includes('gpt-4.1')) apiModel = 'gpt-4-turbo';
    console.log(`Model mapping: '${model}' -> '${apiModel}'`);

    // --- LÓGICA DE CONTEÚDO (SIMPLIFICADA) ---
    // O `fullContent` é o prompt que o frontend já preparou (seja a pergunta do user ou o prompt com o texto do PDF)
    let fullContent = (files && files.length > 0 && files[0].pdfContent) ? files[0].pdfContent : message;

    if (!fullContent || !fullContent.trim()) {
      throw new Error("A mensagem para a IA está vazia.");
    }

    // --- LÓGICA DE FATIAMENTO (CHUNK) SIMPLIFICADA ---
    const INPUT_TOKEN_LIMIT = 28000; // Limite de segurança para não estourar os 30k de TPM
    const estimatedTokens = estimateTokenCount(fullContent);
    
    let processedMessage = fullContent;
    let responsePrefix = '';

    if (estimatedTokens > INPUT_TOKEN_LIMIT) {
      const maxChars = INPUT_TOKEN_LIMIT * 3;
      const chunks = splitIntoChunks(fullContent, maxChars);
      
      responsePrefix = `⚠️ **Atenção:** O documento enviado é muito grande. A análise abaixo foi feita com base **apenas no início do documento** para fornecer uma visão geral.\n\n---\n\n`;
      
      processedMessage = `O texto a seguir é a primeira parte de um documento muito longo. O usuário pediu para "${message || 'fazer um resumo'}". Analise este trecho e forneça uma resposta baseada apenas nele:\n\n"""\n${chunks[0]}\n"""`;
    }
    
    // --- MONTAGEM E ENVIO DA REQUISIÇÃO PARA A OPENAI ---
    const requestBody = {
      model: apiModel,
      messages: [
        { role: 'system', content: 'Você é um assistente prestativo, especializado em analisar documentos e responder em português do Brasil.' },
        { role: 'user', content: processedMessage }
      ],
      max_tokens: 4096,
      temperature: 0.5,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Erro na API da OpenAI: ${errorBody}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content ?? 'Desculpe, não consegui obter uma resposta.';
    
    const finalResponse = responsePrefix + generatedText;

    // **IMPORTANTE: Retornando no formato simples que o frontend agora espera**
    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro fatal na função ai-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});