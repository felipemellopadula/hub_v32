// Caminho: supabase/functions/ai-chat/index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- FUNÇÕES AUXILIARES PARA OPENAI ---
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  const chunks = [];
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
    const { message, model } = await req.json();

    if (!model) {
      throw new Error('O nome do modelo é obrigatório.');
    }
    if (!message || !message.trim()) {
      throw new Error("A mensagem para a IA está vazia.");
    }

    let finalResponse: string;

    // --- ROTEADOR INTELIGENTE ---
    // Verifica se o modelo é do Gemini ou da OpenAI
    if (model.includes('gemini')) {
      // --- LÓGICA DO GEMINI ---
      console.log(`Roteando para Gemini com o modelo: ${model}`);
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY não configurada.');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Erro da API Gemini: ${response.status} - ${errorData}`);
      }
      const data = await response.json();
      finalResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar resposta do Gemini.';

    } else {
      // --- LÓGICA DA OPENAI (PADRÃO) ---
      console.log(`Roteando para OpenAI com o modelo: ${model}`);
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) throw new Error('OPENAI_API_KEY não configurada.');

      let apiModel = model;
      if (model.includes('gpt-5-mini') || model.includes('gpt-5-nano')) apiModel = 'gpt-4o-mini';
      else if (model.includes('gpt-5')) apiModel = 'gpt-4o';
      else if (model.includes('gpt-4.1')) apiModel = 'gpt-4-turbo';

      console.log(`Model mapping: '${model}' -> '${apiModel}'`);
      
      let processedMessage = message;
      const INPUT_TOKEN_LIMIT = 28000;
      const estimatedTokens = estimateTokenCount(message);

      if (estimatedTokens > INPUT_TOKEN_LIMIT) {
        console.log(`Mensagem grande detectada (${estimatedTokens} tokens). Fatiando.`);
        const maxChars = INPUT_TOKEN_LIMIT * 3.5;
        const chunks = splitIntoChunks(message, maxChars);
        processedMessage = `O seguinte texto é a primeira parte de um documento muito longo. O usuário pediu para "${message.substring(0, 100)}...". Analise este trecho e forneça uma resposta baseada apenas nele:\n\n"""\n${chunks[0]}\n"""`;
      }
      
      const requestBody = {
        model: apiModel,
        messages: [{ role: 'user', content: processedMessage }],
        max_tokens: 4096,
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
      finalResponse = data.choices[0]?.message?.content ?? 'Não foi possível gerar resposta da OpenAI.';
    }

    // --- RESPOSTA FINAL UNIFICADA ---
    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`Erro fatal na função [ai-chat]:`, error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});