import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  model: string;
  files?: Array<{
    name: string;
    type: string;
    data?: string; // base64 for small files
    storagePath?: string; // Storage path for large files like PDFs
    isLargeFile?: boolean; // Flag to indicate if file is stored in Storage
    pdfContent?: string; // extracted PDF text
  }>;
}

const getApiKey = (model: string): string | null => {
  if (model.includes('gpt-') || model.includes('o1')) {
    return Deno.env.get('OPENAI_API_KEY');
  }
  if (model.includes('claude')) {
    return Deno.env.get('ANTHROPIC_API_KEY');
  }
  if (model.includes('gemini')) {
    return Deno.env.get('GOOGLE_API_KEY');
  }
  if (model.includes('grok')) {
    return Deno.env.get('XAI_API_KEY');
  }
  if (model.includes('deepseek')) {
    return Deno.env.get('DEEPSEEK_API_KEY');
  }
  if (model.includes('Llama-4')) {
    return Deno.env.get('APILLM_API_KEY');
  }
  return null;
};

const handleApiError = (message: string) => {
  console.error(`ERRO NA FUNÇÃO 'ai-chat': ${message}`);
  throw new Error(message);
};

const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4); // Approximate: 4 chars = 1 token
};

const getModelLimits = (model: string) => {
  // Token limits per minute for different models
  if (model.includes('gpt-4o-mini') || model.includes('gpt-3.5')) {
    return {
      maxTokensPerChunk: 6000,
      maxTokens: 4096,
      delayMs: 1000
    };
  }
  
  if (model.includes('gpt-4o') && !model.includes('mini')) {
    return {
      maxTokensPerChunk: 7500,
      maxTokens: 4096,
      delayMs: 1000
    };
  }
  
  if (model.includes('gpt-4') || model.includes('o1')) {
    return {
      maxTokensPerChunk: 7500,
      maxTokens: 4096,
      delayMs: 1000
    };
  }
  
  if (model.includes('claude')) {
    return {
      maxTokensPerChunk: 15000,
      maxTokens: 4096,
      delayMs: 2000
    };
  }
  
  if (model.includes('gemini')) {
    return {
      maxTokensPerChunk: 12000,
      maxTokens: 8192,
      delayMs: 1500
    };
  }
  
  // Default for other models
  return {
    maxTokensPerChunk: 8000,
    maxTokens: 4096,
    delayMs: 1000
  };
};

const createOptimizedPdfPrompt = (content: string, userMessage: string): string => {
  const isSummaryRequest = userMessage.toLowerCase().includes('resumo') || 
                          userMessage.toLowerCase().includes('summary') || 
                          userMessage.trim().length === 0;
  
  if (isSummaryRequest) {
    return `Por favor, faça um resumo executivo completo e estruturado do seguinte documento:

${content}

Crie um resumo que inclua:
1. Tema principal e objetivo do documento
2. Pontos-chave e descobertas principais
3. Conclusões e recomendações importantes
4. Dados e números relevantes mencionados

Mantenha o resumo claro, objetivo e bem organizado.`;
  } else {
    return `Com base no seguinte documento:

${content}

Pergunta: ${userMessage}

Por favor, responda à pergunta usando as informações contidas no documento. Se a informação não estiver disponível no documento, mencione isso claramente.`;
  }
};

const chunkText = (text: string, maxTokensPerChunk: number): string[] => {
  const maxCharsPerChunk = maxTokensPerChunk * 4; // Approximate conversion
  const chunks: string[] = [];
  
  if (text.length <= maxCharsPerChunk) {
    return [text];
  }
  
  // Split by paragraphs first, then by sentences if needed
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= maxCharsPerChunk) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If single paragraph is too long, split by sentences
      if (paragraph.length > maxCharsPerChunk) {
        const sentences = paragraph.split(/[.!?]+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if ((sentenceChunk + sentence).length <= maxCharsPerChunk) {
            sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk.trim() + '.');
            }
            sentenceChunk = sentence;
          }
        }
        
        if (sentenceChunk) {
          currentChunk = sentenceChunk.trim() + '.';
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

const callOpenAI = async (message: string, model: string) => {
  console.log('Chamando OpenAI com modelo:', model);
  
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const modelLimits = getModelLimits(model);
  
  const requestBody: any = {
    model: model,
    messages: [
      { role: 'user', content: message }
    ],
    max_tokens: modelLimits.maxTokens,
    temperature: 0.7
  };

  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro da API OpenAI:', response.status, '-', errorData.error?.message || 'Erro desconhecido');
      throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao chamar OpenAI:', error);
    throw error;
  }
};

const callAnthropic = async (message: string, model: string) => {
  console.log('Chamando Anthropic com modelo:', model);
  
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const modelLimits = getModelLimits(model);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: modelLimits.maxTokens,
        messages: [
          { role: 'user', content: message }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro da API Anthropic:', response.status, '-', errorData.error?.message || 'Erro desconhecido');
      throw new Error(`Erro da API Anthropic: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Erro ao chamar Anthropic:', error);
    throw error;
  }
};

const processLargePdf = async (content: string, userMessage: string, model: string) => {
  const modelLimits = getModelLimits(model);
  const estimatedTokens = estimateTokens(content);
  
  console.log(`PDF tem aproximadamente ${estimatedTokens} tokens, limite por chunk: ${modelLimits.maxTokensPerChunk}`);
  
  if (estimatedTokens <= modelLimits.maxTokensPerChunk) {
    // PDF is small enough, process normally
    const optimizedPrompt = createOptimizedPdfPrompt(content, userMessage);
    
    if (model.includes('gpt-') || model.includes('o1')) {
      return await callOpenAI(optimizedPrompt, model);
    } else if (model.includes('claude')) {
      return await callAnthropic(optimizedPrompt, model);
    }
  }
  
  // PDF is too large, need to chunk
  console.log('PDF muito grande, dividindo em chunks...');
  const chunks = chunkText(content, modelLimits.maxTokensPerChunk);
  console.log(`Dividido em ${chunks.length} chunks`);
  
  let allResponses: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processando chunk ${i + 1}/${chunks.length}`);
    
    const chunkPrompt = `Esta é a parte ${i + 1} de ${chunks.length} de um documento. 
    
Conteúdo da parte ${i + 1}:
${chunks[i]}

${userMessage.toLowerCase().includes('resumo') || userMessage.trim().length === 0 
  ? `Faça um resumo desta parte do documento, focando nos pontos mais importantes.` 
  : `Com base nesta parte do documento, responda: ${userMessage}`}

${chunks.length > 1 ? `(Esta é apenas uma parte do documento completo)` : ''}`;

    try {
      let response: string;
      if (model.includes('gpt-') || model.includes('o1')) {
        response = await callOpenAI(chunkPrompt, model);
      } else if (model.includes('claude')) {
        response = await callAnthropic(chunkPrompt, model);
      } else {
        throw new Error('Modelo não suportado para processamento de PDF');
      }
      
      allResponses.push(`**Parte ${i + 1}:**\n${response}`);
      
      // Add delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, modelLimits.delayMs));
      }
    } catch (error) {
      console.error(`Erro no chunk ${i + 1}:`, error);
      allResponses.push(`**Parte ${i + 1}:** Erro ao processar esta seção: ${error.message}`);
    }
  }
  
  // Combine all responses
  const combinedResponse = allResponses.join('\n\n');
  
  // If it was a summary request, try to create a final summary
  if (userMessage.toLowerCase().includes('resumo') || userMessage.trim().length === 0) {
    const finalSummaryPrompt = `Com base nos seguintes resumos parciais de um documento, crie um resumo executivo final e coerente:

${combinedResponse}

Crie um resumo consolidado que:
1. Una as informações de todas as partes
2. Elimine redundâncias
3. Mantenha os pontos mais importantes
4. Seja claro e bem estruturado`;

    try {
      if (model.includes('gpt-') || model.includes('o1')) {
        return await callOpenAI(finalSummaryPrompt, model);
      } else if (model.includes('claude')) {
        return await callAnthropic(finalSummaryPrompt, model);
      }
    } catch (error) {
      console.log('Erro ao criar resumo final, retornando resumos parciais');
    }
  }
  
  return combinedResponse;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, model, files }: ChatRequest = await req.json();

    console.log('Recebido:', { message: message.substring(0, 100) + '...', model });

    if (!message || !model) {
      return new Response(
        JSON.stringify({ error: 'Message e model são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if API key is available
    const apiKey = getApiKey(model);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `Chave da API não encontrada para o modelo: ${model}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let response: string;

    // Handle PDF processing
    if (message.length > 50000) { // Likely contains PDF content
      console.log('Detectado conteúdo longo (PDF), usando processamento especial...');
      response = await processLargePdf(message, message.includes('Pergunta:') ? message.split('Pergunta:')[1] : '', model);
    } else {
      // Regular message processing
      if (model.includes('gpt-') || model.includes('o1')) {
        response = await callOpenAI(message, model);
      } else if (model.includes('claude')) {
        response = await callAnthropic(message, model);
      } else {
        throw new Error(`Modelo não suportado: ${model}`);
      }
    }

    return new Response(
      JSON.stringify({ response }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    handleApiError(error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});