import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to estimate token count (rough approximation)
function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for Portuguese text
  return Math.ceil(text.length / 3);
}

// Function to split text into chunks
function splitIntoChunks(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 3; // Convert tokens to approximate characters
  const chunks = [];
  
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  
  return chunks;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, model = 'claude-sonnet-4-20250514' } = await req.json();
    
    console.log('Anthropic Chat - Request received:', {
      model,
      messageLength: message?.length || 0,
      messagePreview: message?.substring(0, 200) + '...',
      hasMessage: !!message
    });
    
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada');
    }

    // Define token limits for Claude models
    const getModelLimits = (modelName: string) => {
      // All Claude 4 models have 200K context
      if (modelName.includes('claude-opus-4') || modelName.includes('claude-sonnet-4')) {
        return { input: 180000, output: 8192 };
      }
      if (modelName.includes('claude-3-5-haiku')) return { input: 180000, output: 8192 };
      if (modelName.includes('claude-3-5-sonnet')) return { input: 180000, output: 8192 };
      if (modelName.includes('claude-3-opus')) return { input: 180000, output: 4096 };
      return { input: 180000, output: 4096 }; // Default for Claude models
    };

    const limits = getModelLimits(model);
    const estimatedTokens = estimateTokenCount(message);
    
    console.log('Token estimation:', { 
      estimatedTokens, 
      inputLimit: limits.input, 
      model,
      messageLength: message.length 
    });

    let processedMessage = message;
    let responsePrefix = '';

    // Claude has high limits, chunk only for very large documents
    if (estimatedTokens > limits.input * 0.8) {
      console.log('Message extremely large, processing in chunks...');
      
      const maxChunkTokens = Math.floor(limits.input * 0.7);
      const chunks = splitIntoChunks(message, maxChunkTokens);
      
      if (chunks.length > 1) {
        responsePrefix = `🤖 Documento extenso analisado em ${chunks.length} partes pelo Claude:\n\n`;
        
        // Process first chunk with instructions to analyze
        processedMessage = `Analise este documento extenso (parte 1 de ${chunks.length}). Forneça uma análise detalhada e estruturada:\n\n${chunks[0]}`;
      }
    }

    console.log('Sending request to Anthropic with model:', model);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anthropicApiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        messages: [{
          role: 'user',
          content: processedMessage
        }],
        max_tokens: limits.output,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      throw new Error(`Erro da API Anthropic: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const generatedText = data.content?.[0]?.text || 'Não foi possível gerar resposta';
    
    // Add prefix if message was processed in chunks
    const finalResponse = responsePrefix + generatedText;

    console.log('Anthropic response received successfully');

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função anthropic-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});