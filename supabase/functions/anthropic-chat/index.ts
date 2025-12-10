import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to estimate token count (optimized for Portuguese)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3.2);
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

// Check if model supports Extended Thinking
function supportsExtendedThinking(model: string): boolean {
  return model.includes('claude-sonnet-4-5') || 
         model.includes('claude-3-7-sonnet') || 
         model.includes('claude-opus-4');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      model = 'claude-sonnet-4-5', 
      files, 
      conversationHistory = [], 
      contextEnabled = false,
      reasoningEnabled = false 
    } = await req.json();
    
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada');
    }

    // Define token limits for different Claude models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('claude-opus-4')) return { input: 200000, output: 32768 };
      if (modelName.includes('claude-sonnet-4')) return { input: 200000, output: 65536 };
      if (modelName.includes('claude-haiku-4')) return { input: 200000, output: 65536 };
      if (modelName.includes('claude-3-7-sonnet')) return { input: 200000, output: 65536 };
      if (modelName.includes('claude-3-5-haiku')) return { input: 200000, output: 8192 };
      if (modelName.includes('claude-3-5-sonnet')) return { input: 200000, output: 8192 };
      if (modelName.includes('claude-3-opus')) return { input: 200000, output: 4096 };
      return { input: 200000, output: 65536 };
    };

    const limits = getModelLimits(model);
    const useExtendedThinking = reasoningEnabled && supportsExtendedThinking(model);
    
    console.log('Extended Thinking:', { enabled: useExtendedThinking, model, reasoningEnabled });
    
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
    
    // Build messages array with conversation history
    let messages: any[] = [];
    let cachedTokens = 0;
    
    if (contextEnabled && conversationHistory.length > 0) {
      console.log('Building conversation context with', conversationHistory.length, 'previous messages');
      const recentHistory = conversationHistory.slice(-4);
      
      messages = recentHistory.map((historyMsg: any, index: number) => {
        const msg: any = {
          role: historyMsg.role,
          content: historyMsg.content
        };
        
        if (index === recentHistory.length - 1 && historyMsg.role === 'user') {
          msg.cache_control = { type: "ephemeral" };
          cachedTokens = Math.ceil((historyMsg.content?.length || 0) / 3.2);
          console.log('🔄 Cache enabled for conversation history:', cachedTokens, 'tokens');
        }
        
        return msg;
      });
    }
    
    messages.push({
      role: 'user',
      content: finalMessage
    });
    
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
    let responsePrefix = '';

    // If message is too large, process with Map-Reduce
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
        
        console.log('🔄 Consolidating', chunkResponses.length, 'chunk responses...');
        const consolidationPrompt = `Consolidar as análises das ${chunks.length} partes:\n\n${
          chunkResponses.map((r, i) => `PARTE ${i+1}:\n${r}`).join('\n\n---\n\n')
        }\n\nPergunta original: ${message}`;
        
        processedMessages = [{
          role: 'user',
          content: consolidationPrompt
        }];
        
        responsePrefix = `📊 Documento processado em ${chunks.length} partes e consolidado.\n\n`;
      }
    }
    
    // Calculate dynamic max_tokens
    const maxTokens = chunkResponses.length > 0 
      ? Math.min(Math.floor(limits.output * 0.5), limits.output)
      : Math.min(Math.floor(limits.output * 0.8), limits.output);
    
    // Build request body based on whether Extended Thinking is enabled
    let requestBody: any;
    
    if (useExtendedThinking) {
      // Extended Thinking mode with streaming
      requestBody = {
        model: model,
        max_tokens: 16000, // Required for extended thinking
        thinking: {
          type: "enabled",
          budget_tokens: 10000 // Budget for thinking process
        },
        messages: processedMessages,
        stream: true
      };
      console.log('🧠 Extended Thinking enabled with streaming');
    } else {
      requestBody = {
        model: model,
        max_tokens: maxTokens,
        messages: processedMessages
      };
    }

    const bodySize = JSON.stringify(requestBody).length;
    console.log('📤 Request body size:', bodySize, 'bytes');
    console.log('📤 Messages count:', requestBody.messages.length);

    console.log('Sending request to Anthropic with model:', model);
    console.log('Request config:', { 
      model, 
      maxTokens: requestBody.max_tokens,
      messageCount: processedMessages.length,
      extendedThinking: useExtendedThinking
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

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

      // Handle streaming for Extended Thinking
      if (useExtendedThinking && response.body) {
        console.log('🔄 Processing Extended Thinking stream...');
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let thinkingContent = '';
            let textContent = '';
            let inputTokens = 0;
            let outputTokens = 0;

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (!line.trim() || line.startsWith(':')) continue;
                  
                  if (line.startsWith('event: ')) {
                    continue;
                  }
                  
                  if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') continue;

                    try {
                      const data = JSON.parse(jsonStr);
                      
                      // Handle different event types
                      if (data.type === 'content_block_start') {
                        if (data.content_block?.type === 'thinking') {
                          console.log('🧠 Thinking block started');
                          // Send thinking start marker
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reasoning', content: '' })}\n\n`));
                        }
                      } else if (data.type === 'content_block_delta') {
                        if (data.delta?.type === 'thinking_delta') {
                          // Thinking content
                          const thinking = data.delta.thinking || '';
                          thinkingContent += thinking;
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reasoning', content: thinking })}\n\n`));
                        } else if (data.delta?.type === 'text_delta') {
                          // Main text content
                          const text = data.delta.text || '';
                          textContent += text;
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`));
                        }
                      } else if (data.type === 'content_block_stop') {
                        // Block finished
                        if (thinkingContent && !textContent) {
                          // Thinking finished, text will start
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reasoning_final', content: thinkingContent })}\n\n`));
                        }
                      } else if (data.type === 'message_delta') {
                        // Message metadata
                        if (data.usage) {
                          outputTokens = data.usage.output_tokens || 0;
                        }
                      } else if (data.type === 'message_start') {
                        if (data.message?.usage) {
                          inputTokens = data.message.usage.input_tokens || 0;
                        }
                      }
                    } catch (e) {
                      console.error('Error parsing SSE data:', e);
                    }
                  }
                }
              }

              // Send done marker
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();

              // Record token usage
              const authHeader = req.headers.get('authorization');
              if (authHeader) {
                const token = authHeader.replace('Bearer ', '');
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
                const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
                
                const { data: userData } = await supabaseClient.auth.getUser(token);
                
                if (userData.user) {
                  const totalTokens = inputTokens + outputTokens;
                  console.log('📊 Extended Thinking token usage:', { inputTokens, outputTokens, total: totalTokens });
                  
                  await supabaseClient.from('token_usage').insert({
                    user_id: userData.user.id,
                    tokens_used: totalTokens,
                    model_name: model,
                    input_tokens: inputTokens,
                    output_tokens: outputTokens,
                  });
                }
              }
            } catch (e) {
              console.error('Stream error:', e);
              controller.error(e);
            }
          }
        });

        return new Response(stream, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          },
        });
      }

      // Non-streaming response (no extended thinking)
      console.log('📥 Anthropic API response status:', response.status);
      console.log('🔄 Iniciando parse do JSON...');
      
      const data = await response.json();
      console.log('✅ JSON parseado com sucesso');
      console.log('📊 Data structure:', { 
        hasContent: !!data.content, 
        contentLength: data.content?.length,
        hasUsage: !!data.usage 
      });
      
      let generatedText = data.content?.[0]?.text || "Não foi possível gerar resposta";
      console.log('📝 Texto gerado, comprimento:', generatedText.length);
      
      generatedText = generatedText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      console.log('🔧 Texto normalizado, comprimento final:', generatedText.length);
      
      const finalResponse = responsePrefix + generatedText;

      console.log('✨ Anthropic response received successfully', {
        responseLength: finalResponse.length,
        hadPrefix: !!responsePrefix
      });

      console.log('💾 Iniciando gravação de token usage...');
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: userData } = await supabaseClient.auth.getUser(token);
        
        if (userData.user) {
          const inputTokens = data.usage?.input_tokens || 0;
          const outputTokens = data.usage?.output_tokens || 0;
          const cacheCreationTokens = data.usage?.cache_creation_input_tokens || 0;
          const cacheReadTokens = data.usage?.cache_read_input_tokens || 0;
          
          const regularInputTokens = inputTokens - cacheReadTokens;
          const effectiveInputTokens = regularInputTokens + Math.ceil(cacheReadTokens * 0.1);
          const totalEffectiveTokens = effectiveInputTokens + outputTokens;
          
          console.log('📊 Token usage:', { 
            inputTokens, 
            outputTokens, 
            cacheCreationTokens,
            cacheReadTokens,
            effectiveInputTokens,
            total: totalEffectiveTokens,
            savedTokens: cacheReadTokens > 0 ? Math.ceil(cacheReadTokens * 0.9) : 0
          });
          
          await supabaseClient.from('token_usage').insert({
            user_id: userData.user.id,
            tokens_used: totalEffectiveTokens,
            model_name: model,
            input_tokens: effectiveInputTokens,
            output_tokens: outputTokens,
          });
          
          console.log('✅ Token usage gravado com sucesso');
        }
      }

      console.log('🎉 Retornando resposta final para o cliente...');
      
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
