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
    const { sections, userMessage, fileName, totalPages } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');

    console.log(`[RAG Consolidate] Documento: "${fileName}" (${totalPages} páginas, ${sections.length} seções)`);

    // VALIDAÇÃO CRÍTICA: Verificar tamanho do input
    const totalChars = sections.reduce((sum: number, s: string) => sum + s.length, 0);
    const estimatedInputTokens = Math.floor(totalChars / 2.5); // MUITO conservador
    
    console.log(`[RAG Consolidate] Input estimado: ${estimatedInputTokens} tokens (${totalChars} chars)`);
    
    // HARD LIMIT: Se exceder 12K tokens de input, REJEITAR
    if (estimatedInputTokens > 12000) {
      console.error(`❌ INPUT MUITO GRANDE: ${estimatedInputTokens} tokens (limite: 12000)`);
      return new Response(
        JSON.stringify({ 
          error: `Input muito grande: ${estimatedInputTokens} tokens. O frontend deve reduzir antes de enviar.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calcular output tokens (MUITO conservador)
    const targetPages = Math.min(Math.floor(totalPages * 0.4), 30); // Max 30 páginas
    const maxOutputTokens = Math.min(5000, Math.floor(targetPages * 80)); // ~80 tokens/página
    
    const totalEstimatedTokens = estimatedInputTokens + maxOutputTokens + 1000; // +1K para prompt
    console.log(`[RAG Consolidate] Total estimado: ${totalEstimatedTokens} tokens (input: ${estimatedInputTokens}, output: ${maxOutputTokens})`);
    
    if (totalEstimatedTokens > 25000) {
      console.error(`❌ TOTAL EXCEDE LIMITE: ${totalEstimatedTokens} tokens`);
      return new Response(
        JSON.stringify({ 
          error: `Total de tokens excede limite: ${totalEstimatedTokens}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const prompt = `Você é um especialista em ANÁLISE DOCUMENTAL PROFUNDA.

📖 DOCUMENTO: "${fileName}" (${totalPages} páginas)

SÍNTESES PRÉ-CONSOLIDADAS:
${sections.map((s: string, i: number) => `\n[SEÇÃO ${i+1}/${sections.length}]\n${s}`).join('\n\n---\n\n')}

PERGUNTA DO USUÁRIO:
${userMessage}

🎯 MISSÃO: Crie análise final de ~${targetPages} páginas com:

1. 🌍 VISÃO GERAL EXECUTIVA
2. 📋 ANÁLISE COMPLETA (todos os tópicos)
3. 🔬 INSIGHTS CRÍTICOS
4. 📊 DADOS ESTRUTURADOS
5. 🎯 RESPOSTA DIRETA à pergunta
6. 💡 CONCLUSÕES e próximos passos

⚠️ Preserve 60% do conteúdo consolidado. Use Markdown.`;

    console.log(`[RAG Consolidate] Chamando OpenAI (gpt-4.1, max_completion_tokens: ${maxOutputTokens})`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: maxOutputTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[RAG Consolidate] OpenAI error:', response.status, error);
      throw new Error(`OpenAI error: ${response.status} - ${error}`);
    }

    console.log('[RAG Consolidate] ✅ Streaming iniciado');

    // Stream da resposta
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                controller.enqueue(new TextEncoder().encode(line + '\n\n'));
              }
            }
          }
          
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
          console.log('[RAG Consolidate] ✅ Stream concluído');
        } catch (error) {
          console.error('[RAG Consolidate] Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error) {
    console.error('[RAG Consolidate] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
