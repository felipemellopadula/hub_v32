import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { synthesizedContent } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');

    console.log(`[RAG Logical Sections] Segmentando ${synthesizedContent.length} chars`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Você é um especialista em ESTRUTURAÇÃO DE DOCUMENTOS.

CONTEÚDO SINTETIZADO:
${synthesizedContent}

🎯 MISSÃO: Divida este conteúdo em SEÇÕES LÓGICAS autocontidas.

Cada seção deve:
1. Tratar de um tópico/tema específico
2. Ser independente e compreensível sozinha
3. Ter entre 1.500 e 3.000 caracteres (mais fácil de comprimir depois)
4. Incluir TODOS os detalhes importantes daquele tópico

FORMATO DE RESPOSTA (JSON):
{
  "sections": [
    {
      "title": "Título da Seção 1",
      "content": "Conteúdo completo da seção 1...",
      "keywords": ["palavra-chave1", "palavra-chave2"]
    },
    {
      "title": "Título da Seção 2",
      "content": "Conteúdo completo da seção 2...",
      "keywords": ["palavra-chave3", "palavra-chave4"]
    }
  ]
}

⚠️ Retorne APENAS o JSON, sem texto adicional.`
        }],
        max_tokens: Math.min(12000, Math.floor(synthesizedContent.length / 3)),
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[RAG Logical Sections] OpenAI error:', response.status, error);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    console.log(`[RAG Logical Sections] ✅ ${result.sections.length} seções criadas`);

    return new Response(
      JSON.stringify({ sections: result.sections }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RAG Logical Sections] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
