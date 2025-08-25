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

// Intelligent chunking function that respects sentence and paragraph boundaries
function chunkText(text: string, maxTokensPerChunk: number): string[] {
  const maxCharsPerChunk = maxTokensPerChunk * 3; // Convert tokens to approximate characters
  
  if (text.length <= maxCharsPerChunk) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit
    if ((currentChunk + paragraph).length > maxCharsPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    // If a single paragraph is too large, split by sentences
    if (paragraph.length > maxCharsPerChunk) {
      // Add any existing chunk first
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      const sentences = paragraph.split(/[.!?]+\s+/);
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i] + (i < sentences.length - 1 ? '. ' : '');
        
        if ((currentChunk + sentence).length > maxCharsPerChunk && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

// Create optimized prompt for PDF processing
function createOptimizedPdfPrompt(content: string, userMessage: string, chunkIndex?: number, totalChunks?: number): string {
  const isMultiChunk = totalChunks && totalChunks > 1;
  
  if (isMultiChunk) {
    return `ANÁLISE DE DOCUMENTO EXTENSO (PARTE ${chunkIndex! + 1}/${totalChunks})

Você está analisando a parte ${chunkIndex! + 1} de ${totalChunks} de um documento extenso.

INSTRUÇÃO ORIGINAL DO USUÁRIO: "${userMessage}"

CONTEÚDO DA PARTE ${chunkIndex! + 1}:
${content}

INSTRUÇÕES:
1. Analise este trecho focando na instrução original do usuário
2. Extraia informações relevantes para responder à pergunta/solicitação
3. Mantenha o contexto de que isso é parte de um documento maior
4. Seja específico sobre o que encontrou nesta seção`;
  }
  
  return `${userMessage}\n\nCONTEÚDO DO DOCUMENTO:\n${content}`;
}

// Combine multiple responses into a cohesive final response
function combineResponses(responses: string[], originalMessage: string): string {
  if (responses.length === 1) {
    return responses[0];
  }
  
  const separator = '\n\n---\n\n';
  const combinedContent = responses.join(separator);
  
  return `📄 ANÁLISE COMPLETA DO DOCUMENTO (${responses.length} partes processadas)

${combinedContent}

---

✅ Análise completa finalizada com base em todas as ${responses.length} partes do documento.`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, model = 'gpt-5-2025-08-07' } = await req.json();
    
    console.log('OpenAI Chat - Request received:', {
      model,
      messageLength: message?.length || 0,
      messagePreview: message?.substring(0, 200) + '...',
      hasMessage: !!message
    });
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Check if it's a newer model that uses max_completion_tokens
    const isNewerModel = model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o3') || model.includes('o4');
    
    // Define token limits for different models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('gpt-5-nano')) return { input: 25000, output: 2048 };
      if (modelName.includes('gpt-5-mini')) return { input: 50000, output: 4096 };
      if (modelName.includes('gpt-5')) return { input: 120000, output: 8192 };
      if (modelName.includes('o4-mini')) return { input: 25000, output: 2048 };
      if (modelName.includes('o3') || modelName.includes('o4')) return { input: 120000, output: 8192 };
      return { input: 30000, output: 4096 }; // Default for older models
    };

    const limits = getModelLimits(model);
    const estimatedTokens = estimateTokenCount(message);
    
    console.log('Token estimation:', { 
      estimatedTokens, 
      inputLimit: limits.input, 
      model,
      messageLength: message.length 
    });

    // Detect if this is likely a PDF document based on content patterns
    const isPdfContent = message.length > 5000 && (
      message.includes('ANÁLISE COMPARATIVA') ||
      message.includes('CONTEÚDO DO DOCUMENTO') ||
      message.includes('documento') ||
      message.includes('análise') ||
      estimatedTokens > limits.input * 0.3
    );

    console.log('Content analysis:', {
      isPdfContent,
      shouldChunk: estimatedTokens > limits.input * 0.3,
      estimatedTokens,
      messageLength: message.length
    });

    // If message is too large or is PDF content, process with complete chunking
    if (isPdfContent || estimatedTokens > limits.input * 0.3) {
      console.log('Processing large document with chunking system...');
      
      // Extract user message from the content if it contains PDF analysis patterns
      let userMessage = message;
      let contentToAnalyze = message;
      
      // Try to extract user instruction from structured prompts
      const analysisMatch = message.match(/INSTRUÇÃO ORIGINAL DO USUÁRIO:\s*"([^"]+)"/);
      if (analysisMatch) {
        userMessage = analysisMatch[1];
      } else if (message.includes('CONTEÚDO DO DOCUMENTO:')) {
        const parts = message.split('CONTEÚDO DO DOCUMENTO:');
        if (parts.length > 1) {
          userMessage = parts[0].trim();
          contentToAnalyze = parts[1].trim();
        }
      }

      // Configure chunk size based on model - ultra conservative for GPT-5 mini
      let maxChunkTokens;
      let delayBetweenChunks;
      
      if (model.includes('gpt-5-nano')) {
        maxChunkTokens = 2000;  // Ultra small chunks for nano
        delayBetweenChunks = 3000; // 3 second delay
      } else if (model.includes('gpt-5-mini')) {
        maxChunkTokens = 2500;  // Ultra small chunks for mini to avoid TPM issues
        delayBetweenChunks = 5000; // 5 second delay to respect 200k TPM limit
      } else if (model.includes('gpt-5')) {
        maxChunkTokens = 4000;  // Small chunks for regular GPT-5
        delayBetweenChunks = 3000; // 3 second delay
      } else {
        maxChunkTokens = Math.floor(limits.input * 0.6); // Legacy models
        delayBetweenChunks = 300;
      }

      const chunks = chunkText(contentToAnalyze, maxChunkTokens);
      console.log(`Split into ${chunks.length} chunks for processing`);

      if (chunks.length === 1) {
        // Single chunk - process normally
        const prompt = createOptimizedPdfPrompt(chunks[0], userMessage);
        
        const requestBody: any = {
          model: model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_completion_tokens: isNewerModel ? limits.output : undefined,
          max_tokens: !isNewerModel ? limits.output : undefined,
        };

        // Only add temperature for legacy models
        if (!isNewerModel) {
          requestBody.temperature = 0.7;
        }

        console.log('Sending single chunk request to OpenAI with model:', model);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('OpenAI API error:', errorData);
          throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        const finalResponse = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta';

        console.log('Single chunk response received successfully');
        return new Response(JSON.stringify({ response: finalResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } else {
        // Multiple chunks - process sequentially
        const responses: string[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Processing chunk ${i + 1}/${chunks.length}`);
          
          try {
            const chunkPrompt = createOptimizedPdfPrompt(chunks[i], userMessage, i, chunks.length);
            
            const requestBody: any = {
              model: model,
              messages: [{
                role: 'user',
                content: chunkPrompt
              }],
              max_completion_tokens: isNewerModel ? limits.output : undefined,
              max_tokens: !isNewerModel ? limits.output : undefined,
            };

            // Only add temperature for legacy models
            if (!isNewerModel) {
              requestBody.temperature = 0.7;
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.text();
              console.error(`OpenAI API error for chunk ${i + 1}:`, errorData);
              responses.push(`❌ Erro ao processar parte ${i + 1}: ${errorData}`);
            } else {
              const data = await response.json();
              const chunkResponse = data.choices?.[0]?.message?.content || `Erro ao processar parte ${i + 1}`;
              responses.push(chunkResponse);
            }

            // Add delay between chunks to respect TPM limits (especially for GPT-5)
            if (i < chunks.length - 1) {
              console.log(`Waiting ${delayBetweenChunks}ms before next chunk...`);
              await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
            }

          } catch (chunkError) {
            console.error(`Error processing chunk ${i + 1}:`, chunkError);
            responses.push(`❌ Erro ao processar parte ${i + 1}: ${chunkError.message}`);
          }
        }

        // Combine all responses
        const finalResponse = combineResponses(responses, userMessage);
        
        console.log('Multi-chunk processing completed successfully');
        return new Response(JSON.stringify({ response: finalResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Single request processing (small documents)
    const requestBody: any = {
      model: model,
      messages: [{
        role: 'user',
        content: message
      }],
      max_completion_tokens: isNewerModel ? limits.output : undefined,
      max_tokens: !isNewerModel ? limits.output : undefined,
    };

    // Only add temperature for legacy models
    if (!isNewerModel) {
      requestBody.temperature = 0.7;
    }

    console.log('Sending single request to OpenAI with model:', model);
    console.log('Request config:', { 
      model, 
      hasMaxCompletionTokens: !!requestBody.max_completion_tokens,
      hasMaxTokens: !!requestBody.max_tokens,
      hasTemperature: !!requestBody.temperature 
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const finalResponse = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta';

    console.log('OpenAI response received successfully');

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função openai-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});