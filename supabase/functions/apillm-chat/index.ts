import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = "https://api.apillm.com";
const CHAT_ENDPOINT = `${BASE_URL}/chat/completions`;

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
    const { message, model = 'llama-3.2-8b-instruct' } = await req.json();
    
    const apillmApiKey = Deno.env.get('APILLM_API_KEY');
    if (!apillmApiKey) {
      throw new Error('APILLM_API_KEY não configurada');
    }

    // Define token limits for APILLM models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('deepseek')) return { input: 120000, output: 4096 };
      if (modelName.includes('llama-4')) return { input: 120000, output: 4096 };
      if (modelName.includes('llama-3.3')) return { input: 120000, output: 4096 };
      if (modelName.includes('llama-3.2')) return { input: 120000, output: 4096 };
      if (modelName.includes('llama-3.1')) return { input: 120000, output: 4096 };
      return { input: 30000, output: 4096 }; // Default for other models
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

    // If message is too large, split into chunks
    if (estimatedTokens > limits.input * 0.6) {
      console.log('Message too large, processing in chunks...');
      
      const maxChunkTokens = Math.floor(limits.input * 0.5);
      const chunks = splitIntoChunks(message, maxChunkTokens);
      
      if (chunks.length > 1) {
        responsePrefix = `🦙 Documento grande processado em ${chunks.length} partes:\n\n`;
        
        // Process first chunk with instructions to summarize
        processedMessage = `Analise e resuma este documento (parte 1 de ${chunks.length}). Foque nos pontos principais:\n\n${chunks[0]}`;
      }
    }

    console.log('Sending request to APILLM with model:', model);

    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apillmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de IA prestativo, preciso e versátil.'
          },
          {
            role: 'user',
            content: processedMessage
          }
        ],
        max_tokens: limits.output,
        temperature: 0.7,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('APILLM API error:', errorData);
      throw new Error(`Erro da API APILLM: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta';
    
    // Add prefix if message was processed in chunks
    const finalResponse = responsePrefix + generatedText;

    console.log('APILLM response received successfully');

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função apillm-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});