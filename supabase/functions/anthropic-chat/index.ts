import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to estimate token count (optimized for Portuguese)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3.2); // More accurate for Portuguese
}

// Function to split text into chunks
function splitIntoChunks(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 3.2;
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
    const { message, model = 'claude-sonnet-4-5', files, conversationHistory = [], contextEnabled = false } = await req.json();
    
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada');
    }

    // Define token limits for different Claude models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('claude-opus-4')) return { input: 200000, output: 32768 };
      if (modelName.includes('claude-sonnet-4')) return { input: 200000, output: 65536 };
      if (modelName.includes('claude-haiku-4')) return { input: 200000, output: 65536 };
      if (modelName.includes('claude-3-5-haiku')) return { input: 200000, output: 8192 };
      if (modelName.includes('claude-3-5-sonnet')) return { input: 200000, output: 8192 };
      if (modelName.includes('claude-3-opus')) return { input: 200000, output: 4096 };
      return { input: 200000, output: 65536 }; // Default for Claude 4 models
    };

    const limits = getModelLimits(model);
    
    // Log files information
    if (files && files.length > 0) {
      console.log('Files received:', files.map((f: any) => ({ 
        name: f.name, 
        type: f.type, 
        hasPdfContent: !!f.pdfContent,
        hasWordContent: !!f.wordContent
      })));
    }
    
    // Process PDF and DOC files if present
    let finalMessage = message;
    if (files && files.length > 0) {
      const pdfFiles = files.filter((f: any) => f.type === 'application/pdf' && f.pdfContent);
      const docFiles = files.filter((f: any) => f.wordContent);
      
      const fileContents = [];
      
      if (pdfFiles.length > 0) {
        fileContents.push(...pdfFiles.map((pdf: any) => 
          `[Arquivo PDF: ${pdf.name}]\n\n${pdf.pdfContent}`
        ));
      }
      
      if (docFiles.length > 0) {
        fileContents.push(...docFiles.map((doc: any) => 
          `[Arquivo Word: ${doc.name}]\n\n${doc.wordContent}`
        ));
      }
      
      if (fileContents.length > 0) {
        finalMessage = `${message}\n\n${fileContents.join('\n\n---\n\n')}`;
        console.log('Final message with file content length:', finalMessage.length);
      }
    }
    
    // Build messages array - ONLY current message (no history for faster response)
    console.log('⚠️ Sending ONLY current message (no history) for faster response');
    const messages = [{
      role: 'user',
      content: finalMessage
    }];
    
    // Calculate total token count for the entire conversation
    const totalText = messages.map((msg: any) => msg.content).join('\n');
    const estimatedTokens = estimateTokenCount(totalText);
    
    console.log('Token estimation:', { 
      estimatedTokens, 
      inputLimit: limits.input, 
      model,
      messageLength: totalText.length,
      hasFiles: files && files.length > 0,
      contextMessages: messages.length - 1
    });

    let processedMessages = messages;
    let chunkResponses: string[] = [];

    // If message is too large, process ALL chunks with Map-Reduce
    if (estimatedTokens > limits.input * 0.4) {
      console.log('📄 Message too large, processing ALL chunks with Map-Reduce...');
      
      let maxChunkTokens;
      if (model.includes('haiku')) {
        maxChunkTokens = Math.min(25000, Math.floor(limits.input * 0.4));
      } else {
        maxChunkTokens = Math.min(40000, Math.floor(limits.input * 0.5));
      }
      
      const chunks = splitIntoChunks(finalMessage, maxChunkTokens);
      
      if (chunks.length > 1) {
        console.log(`🔄 Processing ${chunks.length} chunks...`);
        
        for (let i = 0; i < chunks.length; i++) {
          console.log(`🔄 Processing chunk ${i+1}/${chunks.length}...`);
          
          const chunkMessages = [{
            role: 'user',
            content: `Analise esta parte (${i+1}/${chunks.length}) do documento:\n\n${chunks[i]}`
          }];
          
          const chunkResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': anthropicApiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: model,
              max_tokens: 4096,
              messages: chunkMessages
            }),
          });
          
          if (!chunkResponse.ok) {
            const errorData = await chunkResponse.text();
            console.error(`❌ Chunk ${i+1} error:`, errorData);
            throw new Error(`Erro no chunk ${i+1}: ${chunkResponse.status}`);
          }
          
          const chunkData = await chunkResponse.json();
          const chunkText = chunkData.content?.[0]?.text || '';
          chunkResponses.push(chunkText);
          console.log(`✅ Chunk ${i+1} processed:`, chunkText.length, 'characters');
        }
        
        // Consolidate all responses
        console.log('🔄 Consolidating', chunkResponses.length, 'chunk responses...');
        const consolidationPrompt = `Consolidar as análises das ${chunks.length} partes:\n\n${
          chunkResponses.map((r, i) => `PARTE ${i+1}:\n${r}`).join('\n\n---\n\n')
        }\n\nPergunta original: ${message}`;
        
        processedMessages = [{
          role: 'user',
          content: consolidationPrompt
        }];
      }
    }
    
    const requestBody = {
      model: model,
      max_tokens: Math.min(4096, limits.output),
      messages: processedMessages
    };

    // Log request body details for debugging
    const bodySize = JSON.stringify(requestBody).length;
    console.log('📤 Request body size:', bodySize, 'bytes');
    console.log('📤 Messages count:', requestBody.messages.length);
    console.log('📤 First message preview:', requestBody.messages[0].content.substring(0, 100) + '...');

    console.log('Sending request to Anthropic with model:', model);
    console.log('Request config:', { 
      model, 
      maxTokens: requestBody.max_tokens,
      messageCount: processedMessages.length
    });

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout

    console.log('🚀 Iniciando fetch para Anthropic API...');
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      console.log('✅ Fetch completado, status:', response.status);
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log('❌ Response não OK, status:', response.status);
        const errorData = await response.text();
        console.error('Anthropic API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Erro da API Anthropic: ${response.status} - ${errorData}`);
      }

      console.log('📥 Anthropic API response status:', response.status);
      console.log('🔄 Iniciando parse do JSON...');
      
      // Continue processing the response
      const data = await response.json();
      console.log('✅ JSON parseado com sucesso');
      console.log('📊 Data structure:', { 
        hasContent: !!data.content, 
        contentLength: data.content?.length,
        hasUsage: !!data.usage 
      });
      
      let generatedText = data.content?.[0]?.text || "Não foi possível gerar resposta";
      console.log('📝 Texto gerado, comprimento:', generatedText.length);
      
      // Normalize line breaks and remove excessive spacing
      generatedText = generatedText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      console.log('🔧 Texto normalizado, comprimento final:', generatedText.length);
      
      // Add prefix if message was processed in chunks
      const finalResponse = responsePrefix + generatedText;

      console.log('✨ Anthropic response received successfully', {
        responseLength: finalResponse.length,
        hadPrefix: !!responsePrefix
      });

      // Record token usage in database
      console.log('💾 Iniciando gravação de token usage...');
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        
        // Create supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: userData } = await supabaseClient.auth.getUser(token);
        
        if (userData.user) {
          const inputTokens = data.usage?.input_tokens || 0;
          const outputTokens = data.usage?.output_tokens || 0;
          
          console.log('📊 Token usage:', { inputTokens, outputTokens, total: inputTokens + outputTokens });
          
          await supabaseClient.from('token_usage').insert({
            user_id: userData.user.id,
            tokens_used: inputTokens + outputTokens,
            model: model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          });
          
          console.log('✅ Token usage gravado com sucesso');
        }
      }

      console.log('🎉 Retornando resposta final para o cliente...');
      
      // Create document context for follow-ups
      let documentContext = null;
      if (chunkResponses.length > 0) {
        const compactSummary = finalResponse.length > 2000 
          ? finalResponse.substring(0, 2000) + '...\n\n[Resposta completa disponível no histórico]'
          : finalResponse;
        
        documentContext = {
          summary: compactSummary,
          totalChunks: chunkResponses.length,
          fileNames: files?.map((f: any) => f.name),
          estimatedTokens: estimateTokenCount(finalMessage),
          processedAt: new Date().toISOString()
        };
        
        console.log('📄 Document context created:', {
          fileNames: documentContext.fileNames,
          totalChunks: documentContext.totalChunks,
          tokens: documentContext.estimatedTokens
        });
      }
      
      return new Response(JSON.stringify({ 
        response: finalResponse,
        documentContext 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('❌ Erro no fetch:', fetchError);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('⏱️ Request timeout after 3 minutes');
        throw new Error('A requisição excedeu o tempo limite de 3 minutos. Por favor, tente novamente com um prompt menor.');
      }
      console.error('💥 Erro inesperado:', fetchError instanceof Error ? fetchError.message : fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('Erro na função claude-chat:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});