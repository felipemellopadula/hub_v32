import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔥 write-content function called');
    
    const { prompt, format, tone, length } = await req.json();
    console.log('📝 Received params:', { prompt, format, tone, length });

    if (!prompt || !prompt.trim()) {
      console.log('❌ Empty prompt provided');
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('❌ OpenAI API key not found');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the enhanced prompt with context
    const enhancedPrompt = `Você é um assistente de escrita especializado. Crie um texto em português com as seguintes especificações:

FORMATO: ${format}
TOM: ${tone}
COMPRIMENTO: ${length}

TÓPICO: ${prompt}

INSTRUÇÕES IMPORTANTES:
- Escreva APENAS em português do Brasil
- Use o formato "${format}" especificado
- Mantenha o tom "${tone}" durante todo o texto
- O comprimento deve ser "${length}"
- Para "Curto": 1-2 parágrafos (100-200 palavras)
- Para "Médio": 3-5 parágrafos (300-500 palavras)  
- Para "Longo": 6+ parágrafos (600+ palavras)
- Seja criativo e envolvente
- Use estrutura clara com títulos quando apropriado
- Para emails, inclua assunto, saudação e despedida
- Para posts de blog, inclua título atrativo
- Para anúncios, foque em call-to-action

Texto:`;

    console.log('🌐 Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um assistente de escrita especializado em criar conteúdo em português do Brasil.' },
          { role: 'user', content: enhancedPrompt }
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    console.log('📡 OpenAI API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📦 OpenAI API response received');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid response structure from OpenAI API:', data);
      throw new Error('Invalid response from OpenAI API');
    }

    const generatedText = data.choices[0].message.content;
    console.log('✅ Successfully generated text');

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('💥 Error in write-content function:', error);
    return new Response(JSON.stringify({ 
      error: `Erro interno: ${error.message}`,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});