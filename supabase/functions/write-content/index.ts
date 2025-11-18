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

    console.log('🌐 Calling OpenAI API with GPT-4.1 Mini...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          { role: 'system', content: 'Você é um assistente de escrita especializado em criar conteúdo em português do Brasil.' },
          { role: 'user', content: enhancedPrompt }
        ],
        max_completion_tokens: 2048
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
    const usage = data.usage || {};
    console.log('✅ Successfully generated text:', generatedText?.substring(0, 100) + '...');
    console.log('📊 Token usage:', usage);

    // Record actual token usage
    console.log('💰 Recording token usage in database...');
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        // Import supabase client
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.53.0');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Get user from authorization header
        const authHeader = req.headers.get('authorization');
        let userId = null;
        
        if (authHeader) {
          try {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id;
          } catch (e) {
            console.log('Could not extract user from token:', e);
          }
        }
        
        if (userId) {
          const { error: insertError } = await supabase
            .from('token_usage')
            .insert({
              user_id: userId,
              model_name: 'gpt-4.1-mini-2025-04-14',
              message_content: `Geração de texto: ${format} - ${tone} - ${length}`,
              ai_response_content: generatedText.substring(0, 500),
              tokens_used: usage.total_tokens || usage.prompt_tokens + usage.completion_tokens || 0,
              input_tokens: usage.prompt_tokens || 0,
              output_tokens: usage.completion_tokens || 0,
            });

          if (insertError) {
            console.error('Error recording token usage:', insertError);
          } else {
            console.log('✅ Token usage recorded successfully');
          }
        }
      }
    } catch (tokenError) {
      console.log('⚠️ Warning: Token recording failed:', tokenError instanceof Error ? tokenError.message : 'Erro desconhecido');
      // Continue anyway, don't block content generation
    }

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('💥 Error in write-content function:', error);
    return new Response(JSON.stringify({ 
      error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      details: error instanceof Error ? error.toString() : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});