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
    const { message, model = 'deepseek-chat' } = await req.json();
    
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY não configurada');
    }

    // Define token limits for different DeepSeek models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('deepseek-reasoner')) return { input: 64000, output: 8192 };
      if (modelName.includes('deepseek-chat')) return { input: 64000, output: 8192 };
      return { input: 64000, output: 8192 }; // Default for DeepSeek models
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

    // If message is too large, split into chunks and summarize
    if (estimatedTokens > limits.input * 0.5) { // Use 50% of limit for DeepSeek
      console.log('Message too large, processing in chunks...');
      
      // DeepSeek models have moderate context window, use medium chunks
      let maxChunkTokens;
      if (model.includes('deepseek-reasoner')) {
        maxChunkTokens = Math.min(15000, Math.floor(limits.input * 0.4)); // Smaller chunks for reasoner
      } else {
        maxChunkTokens = Math.min(20000, Math.floor(limits.input * 0.45)); // Medium chunks for chat
      }
      
      const chunks = splitIntoChunks(message, maxChunkTokens);
      
      if (chunks.length > 1) {
        responsePrefix = `⚠️ Documento muito grande para ${model}. Processando em ${chunks.length} partes:\n\n`;
        
        // Process first chunk with instructions to summarize
        processedMessage = `Analise e resuma este trecho de um documento extenso (parte 1 de ${chunks.length}). Foque nos pontos principais:\n\n${chunks[0]}`;
      }
    }
    
    const requestBody = {
      model: model,
      messages: [{
        role: 'user',
        content: processedMessage
      }],
      max_tokens: limits.output,
      temperature: 0.7,
      stream: false
    };

    console.log('Sending request to DeepSeek with model:', model);
    console.log('Request config:', { 
      model, 
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature 
    });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('DeepSeek API error:', errorData);
      throw new Error(`Erro da API DeepSeek: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta';
    
    // Add prefix if message was processed in chunks
    const finalResponse = responsePrefix + generatedText;

    console.log('DeepSeek response received successfully');

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função deepseek-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});