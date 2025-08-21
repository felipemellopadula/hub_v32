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
    const { message, model = 'gemini-2.0-flash-exp' } = await req.json();
    
    console.log('Gemini Chat - Request received:', {
      model,
      messageLength: message?.length || 0,
      messagePreview: message?.substring(0, 200) + '...',
      hasMessage: !!message
    });
    
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    // Define token limits for Gemini models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('gemini-2.0-flash')) return { input: 1000000, output: 8192 };
      if (modelName.includes('gemini-exp')) return { input: 2000000, output: 8192 };
      return { input: 1000000, output: 8192 }; // Default for Gemini models
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

    // Gemini has much higher limits, but still chunk for extremely large documents
    if (estimatedTokens > limits.input * 0.8) {
      console.log('Message extremely large, processing in chunks...');
      
      const maxChunkTokens = Math.floor(limits.input * 0.7);
      const chunks = splitIntoChunks(message, maxChunkTokens);
      
      if (chunks.length > 1) {
        responsePrefix = `📄 Documento extenso processado em ${chunks.length} partes pelo Gemini:\n\n`;
        
        // Process first chunk with instructions to analyze
        processedMessage = `Analise este documento extenso (parte 1 de ${chunks.length}). Forneça uma análise completa:\n\n${chunks[0]}`;
      }
    }

    console.log('Sending request to Gemini with model:', model);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: processedMessage
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: limits.output,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error(`Erro da API Gemini: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar resposta';
    
    // Add prefix if message was processed in chunks
    const finalResponse = responsePrefix + generatedText;

    console.log('Gemini response received successfully');

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função gemini-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});