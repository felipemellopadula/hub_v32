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
    const { section, targetSize, aggressive } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    
    const finalTargetSize = targetSize || Math.floor(section.length * 0.4);
    const mode = aggressive ? "EXTREMAMENTE AGRESSIVA" : "INTELIGENTE";

    console.log(`[RAG Compress] Compressão ${mode}: ${section.length} → ${finalTargetSize} caracteres`);

    const prompt = aggressive 
      ? `Você é um especialista em COMPRESSÃO EXTREMAMENTE AGRESSIVA de conteúdo.

SEÇÃO PARA COMPRIMIR:
${section}

TAREFA: Reduza para EXATAMENTE ${finalTargetSize} caracteres, mantendo:
- APENAS os 3-5 pontos mais importantes
- Dados numéricos críticos
- Conclusão principal
- REMOVA: exemplos, detalhes secundários, repetições

Use Markdown. Seja EXTREMAMENTE conciso.`
      : `Você é um especialista em CONDENSAÇÃO INTELIGENTE de conteúdo.

SEÇÃO PARA CONDENSAR:
${section}

TAREFA: Condense esta seção para ~${finalTargetSize} caracteres, preservando:
1. ✅ TODOS os tópicos e subtópicos principais
2. ✅ TODOS os dados numéricos, estatísticas e exemplos importantes
3. ✅ TODOS os conceitos técnicos e terminologia específica
4. ✅ Conclusões, insights e recomendações chave
5. ❌ Remova APENAS redundâncias óbvias e detalhes triviais

IMPORTANTE: Esta é uma CONDENSAÇÃO, não um resumo extremo. Preserve o máximo de informação útil possível.

Use Markdown. Seja completo dentro do limite de caracteres.`;

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
          content: prompt
        }],
        max_tokens: Math.min(8000, Math.floor(finalTargetSize / 2.5))
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[RAG Compress] OpenAI error:', response.status, error);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const compressed = data.choices[0].message.content;

    console.log(`[RAG Compress] ✅ Comprimido: ${section.length} → ${compressed.length} chars`);

    return new Response(
      JSON.stringify({ compressed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RAG Compress] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
