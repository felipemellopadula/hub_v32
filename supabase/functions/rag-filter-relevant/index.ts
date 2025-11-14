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
    const { sections, userMessage, maxSections = 35 } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');

    console.log(`[RAG Filter] Filtrando ${sections.length} seções para objetivo do usuário (max: ${maxSections})`);

    // Criar sumário compacto das seções para o LLM analisar
    const sectionsSummary = sections.map((s: any, i: number) => {
      const keywords = Array.isArray(s.keywords) ? s.keywords.join(', ') : 'N/A';
      const content = s.content || '';
      return `[${i}] "${s.title || 'Sem título'}" (${keywords}) - ${content.slice(0, 200)}...`;
    }).join('\n\n');

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [{
          role: "user",
          content: `Você é um especialista em RECUPERAÇÃO DE INFORMAÇÃO (RAG).

PERGUNTA/OBJETIVO DO USUÁRIO:
"${userMessage}"

SEÇÕES DISPONÍVEIS:
${sectionsSummary}

🎯 MISSÃO: Identifique APENAS os índices das seções ESSENCIAIS para responder/cumprir o objetivo do usuário.

Critérios de seleção:
- Seções diretamente relacionadas ao objetivo
- Seções com dados/exemplos necessários
- Seções com contexto crítico
- Máximo de ${maxSections} seções (priorize as mais importantes)

FORMATO DE RESPOSTA (JSON):
{
  "relevant_indices": [0, 2, 5, 7],
  "reasoning": "Breve explicação da seleção"
}

⚠️ Retorne APENAS o JSON, sem texto adicional.`
        }],
        max_completion_tokens: 1500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[RAG Filter] OpenAI error:', response.status, error);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Retornar APENAS as seções filtradas
    const relevantSections = result.relevant_indices.map((i: number) => sections[i]);

    console.log(`[RAG Filter] ✅ Filtrado: ${sections.length} → ${relevantSections.length} seções`);
    console.log(`[RAG Filter] Raciocínio: ${result.reasoning}`);

    return new Response(
      JSON.stringify({ 
        sections: relevantSections,
        reasoning: result.reasoning 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RAG Filter] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
