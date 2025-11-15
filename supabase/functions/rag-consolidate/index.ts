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
    const { sections: rawSections, userMessage, fileName, totalPages, tablesContext } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');

    // SANITIZAR: Garantir que sections são strings puras
    const sections = rawSections.map((s: any) => {
      if (typeof s === 'string') return s;
      if (typeof s === 'object' && s.content) return String(s.content);
      return String(s);
    });

    console.log(`[RAG Consolidate] Recebido: "${fileName}" (${totalPages}p, ${sections.length} seções)`);
    
    // DEBUG: Ver estrutura REAL das seções
    console.log(`[DEBUG] Tipo de sections[0]:`, typeof sections[0]);
    console.log(`[DEBUG] sections[0] preview:`, JSON.stringify(sections[0]).substring(0, 500));
    console.log(`[DEBUG] Todas as seções:`, sections.map((s: any, i: number) => ({
      index: i,
      type: typeof s,
      length: typeof s === 'string' ? s.length : JSON.stringify(s).length,
      preview: typeof s === 'string' ? s.substring(0, 100) : JSON.stringify(s).substring(0, 100)
    })));
    
    // VALIDAÇÃO CRÍTICA: Verificar tamanho REAL das seções recebidas
    const totalCharsInSections = sections.reduce((sum: number, s: string) => sum + s.length, 0);
    const sectionsTokens = Math.floor(totalCharsInSections / 2.5);
    
    console.log(`[RAG] Total seções: ${totalCharsInSections} chars (~${sectionsTokens} tokens)`);
    
    // Validação: se as seções são gigantes, algo deu errado no frontend
    if (sectionsTokens > 20000) {
      console.error(`❌ SEÇÕES MUITO GRANDES: ${sectionsTokens} tokens (limite: 20000)`);
      console.error(`❌ Tamanho individual das seções:`);
      sections.forEach((s: string, i: number) => {
        console.error(`   Seção ${i+1}: ${s.length} chars (~${Math.floor(s.length/2.5)} tokens)`);
      });
      return new Response(
        JSON.stringify({ error: `Seções muito grandes: ${sectionsTokens} tokens. Limite: 20K tokens.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Calcular output tokens primeiro (FASE 2: 700 tokens/página para conteúdo RICO)
    const targetPages = Math.min(Math.floor(totalPages * 0.6), 50);
    const maxOutputTokens = Math.min(16000, Math.floor(targetPages * 700)); // 700 tokens/página = conteúdo denso e detalhado
    
    // ADICIONAR LOGGING ANTES DO TEMPLATE para identificar a variável gigante
    console.log(`[PRE-TEMPLATE] fileName length: ${fileName.length}`);
    console.log(`[PRE-TEMPLATE] userMessage length: ${userMessage.length}`);
    console.log(`[PRE-TEMPLATE] totalPages: ${totalPages}`);
    console.log(`[PRE-TEMPLATE] targetPages: ${targetPages}`);
    
    // CALCULAR O PROMPT COMPLETO PRIMEIRO (mais defensivo)
    const sectionsText = sections.map((s: string, i: number) => {
      const content = String(s); // Forçar string
      return `[${i+1}] ${content}`;
    }).join('\n\n');

    // Validar antes de usar
    const sectionsTextLength = sectionsText.length;
    console.log(`[RAG] sectionsText gerado: ${sectionsTextLength} chars`);

    if (sectionsTextLength > 120000) {
      console.error(`❌ SECTIONS TEXT GIGANTE: ${sectionsTextLength} chars`);
      throw new Error('Bug detectado: sectionsText muito grande');
    }

    const promptTemplate = `Você é um ESPECIALISTA EM ANÁLISE DOCUMENTAL que produz relatórios EXTREMAMENTE DETALHADOS e COMPLETOS.

📄 DOCUMENTO: "${fileName}" (${totalPages} páginas)
${tablesContext ? '\n' + tablesContext + '\n' : ''}

📊 CONTEÚDO SINTETIZADO DO DOCUMENTO:
${sectionsText}

❓ PERGUNTA/OBJETIVO DO USUÁRIO:
"${userMessage}"

🎯 SUA MISSÃO: Produzir uma análise COMPLETA e EXTREMAMENTE DETALHADA de aproximadamente ${targetPages} páginas que:

1. **ESTRUTURA OBRIGATÓRIA:**
   - Visão geral completa do documento
   - Análise PROFUNDA de cada seção relevante (não resuma, EXPANDA!)
   - Insights e conexões entre conceitos
   - Dados, estatísticas e exemplos concretos${tablesContext ? ' (USE EXTENSIVAMENTE OS DADOS DAS TABELAS!)' : ''}
   - Implicações práticas e aplicações
   - Resposta COMPLETA ao objetivo do usuário
   - Conclusões e recomendações finais

2. **EXIGÊNCIAS DE CONTEÚDO:**
   - ⚠️ PRESERVE 90-95% dos detalhes das seções fornecidas
   - EXPANDA cada ponto importante com explicações completas
   - Inclua TODOS os exemplos, casos práticos e dados numéricos
   - Mantenha TODA a terminologia técnica e conceitos específicos
   - Use múltiplos parágrafos para cada tópico importante
   - NUNCA resuma - sempre detalhe e aprofunde!

3. **FORMATO:**
   - Use Markdown com headers (##, ###), listas, tabelas
   - Organize hierarquicamente por tópicos e subtópicos
   - Parágrafos densos e informativos (3-5 sentenças cada)
   - Seções claramente delimitadas

4. **OBJETIVO DE TAMANHO:**
   - Produza aproximadamente ${targetPages} páginas de conteúdo DENSO
   - Cada seção deve ter múltiplos parágrafos detalhados
   - NÃO ECONOMIZE em detalhes - seja COMPLETO!

⚠️ CRÍTICO: Esta é uma análise COMPLETA E APROFUNDADA. Não um resumo! Preserve máxima informação e detalhe.`;

    // VALIDAÇÃO com o prompt REAL
    const promptTokens = Math.floor(promptTemplate.length / 2.5);
    console.log(`[RAG Consolidate] Prompt total: ${promptTokens} tokens (${promptTemplate.length} chars)`);

    // HARD LIMIT baseado no prompt REAL (FASE 1: aumentado para 20K)
    if (promptTokens > 20000) {
      console.error(`❌ PROMPT MUITO GRANDE: ${promptTokens} tokens (limite: 20000)`);
      return new Response(
        JSON.stringify({ 
          error: `Prompt muito grande: ${promptTokens} tokens. Reduza o conteúdo antes de enviar.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalEstimatedTokens = promptTokens + maxOutputTokens;
    console.log(`[RAG Consolidate] Total estimado: ${totalEstimatedTokens} tokens (prompt: ${promptTokens}, output: ${maxOutputTokens})`);

    if (totalEstimatedTokens > 36000) {
      console.error(`❌ TOTAL EXCEDE LIMITE: ${totalEstimatedTokens} tokens`);
      return new Response(
        JSON.stringify({ 
          error: `Total de tokens excede limite: ${totalEstimatedTokens}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RAG Consolidate] ✅ Validação OK, chamando OpenAI (gpt-4.1, max_completion_tokens: ${maxOutputTokens})`);

    const prompt = promptTemplate;


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
