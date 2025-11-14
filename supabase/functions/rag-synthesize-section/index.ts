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
    const { analyses, sectionIndex, totalSections } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');

    console.log(`[RAG Section ${sectionIndex + 1}/${totalSections}] Sintetizando ${analyses.length} análises`);

    const prompt = `Você é um sintetizador especializado em INTEGRAÇÃO DETALHADA DE INFORMAÇÕES.

SEÇÃO [${sectionIndex + 1} de ${totalSections}]

ANÁLISES DOS CHUNKS:
${analyses.join('\n\n---\n\n')}

🎯 MISSÃO: Crie uma SÍNTESE COMPLETA E DETALHADA que:
1. Una todas as análises em narrativa coerente e completa
2. Preserve TODOS os detalhes, dados e exemplos importantes
3. Mantenha TODOS os conceitos técnicos e terminologia específica
4. Elimine apenas redundâncias exatas e repetições literais
5. Organize por temas/tópicos quando possível
6. Preserve estatísticas, números, percentuais e métricas
7. Inclua todos os insights, conclusões e recomendações

⚠️ IMPORTANTE: Esta é uma SÍNTESE DETALHADA, não um resumo. Preserve 85-90% do conteúdo das análises.
Use Markdown extensivamente para organizar a informação.`;


    // Retry logic
    const MAX_RETRIES = 2;
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAIKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini-2025-04-14",
            messages: [{ role: "user", content: prompt }],
            max_completion_tokens: 16000,
          }),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000 * Math.pow(2, attempt);
          
          if (attempt < MAX_RETRIES) {
            console.log(`⏳ Section ${sectionIndex+1} rate limit, aguardando ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        if (!response.ok) {
          lastError = await response.text();
          throw new Error(`OpenAI error: ${response.status}`);
        }

        const data = await response.json();
        const synthesis = data.choices[0].message.content;

        console.log(`[RAG Section ${sectionIndex + 1}/${totalSections}] ✅ Síntese concluída`);

        return new Response(
          JSON.stringify({ synthesis }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          const delay = 3000 * Math.pow(2, attempt);
          console.log(`⚠️ Section ${sectionIndex+1} tentativa ${attempt+1} falhou, aguardando ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[RAG Section ${sectionIndex + 1}] ❌ Falhou após ${MAX_RETRIES+1} tentativas`);
    throw new Error(`Failed after ${MAX_RETRIES+1} attempts: ${lastError}`);


  } catch (error) {
    console.error('[RAG Section] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
