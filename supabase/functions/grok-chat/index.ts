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

// Check if model supports reasoning with visible content
function supportsReasoningContent(model: string): boolean {
  return model.includes('grok-3-mini');
}

// Check if model is a reasoning model (even without visible content)
function isReasoningModel(model: string): boolean {
  return model.includes('grok-3') || model.includes('grok-4');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      model = 'grok-3', 
      files, 
      conversationHistory = [], 
      contextEnabled = false,
      reasoningEnabled = false,
      reasoningEffort = 'medium',
      webSearchEnabled = false
    } = await req.json();
    
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    if (!xaiApiKey) {
      throw new Error('XAI_API_KEY não configurada');
    }

    // Define token limits for different xAI models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('grok-4')) return { input: 128000, output: 8192 };
      if (modelName.includes('grok-3-mini')) return { input: 131072, output: 131072 };
      if (modelName.includes('grok-3')) return { input: 131072, output: 131072 };
      return { input: 128000, output: 8192 };
    };

    const limits = getModelLimits(model);
    const useReasoning = reasoningEnabled && isReasoningModel(model);
    const showReasoningContent = useReasoning && supportsReasoningContent(model);
    const useLiveSearch = webSearchEnabled;
    
    console.log('🧠 Grok Config:', { 
      reasoning: useReasoning, 
      model, 
      showContent: showReasoningContent,
      effort: reasoningEffort,
      liveSearch: useLiveSearch
    });
    
    if (files && files.length > 0) {
      console.log('📄 Files received:', files.map((f: any) => ({ 
        name: f.name, 
        type: f.type, 
        hasPdfContent: !!f.pdfContent,
        hasWordContent: !!f.wordContent
      })));
    }
    
    // Process files
    let finalMessage = message;
    if (files && files.length > 0) {
      const fileContents = [];
      
      files.forEach((file: any) => {
        if (file.pdfContent) {
          fileContents.push(`[PDF: ${file.name}]\n\n${file.pdfContent}`);
        }
        if (file.wordContent) {
          fileContents.push(`[Word: ${file.name}]\n\n${file.wordContent}`);
        }
      });
      
      if (fileContents.length > 0) {
        finalMessage = `${message}\n\n${fileContents.join('\n\n---\n\n')}`;
        console.log('📊 Message with files:', finalMessage.length, 'characters');
      }
    }
    
    const estimatedTokens = estimateTokenCount(finalMessage);
    
    console.log('📊 Token estimation:', { 
      estimatedTokens, 
      inputLimit: limits.input, 
      model,
      messageLength: finalMessage.length,
      hasFiles: files && files.length > 0
    });
    
    let messages: any[] = [];
    let chunkResponses: string[] = [];
    let cachedTokens = 0;
    
    // If document is large, process in chunks with Map-Reduce
    if (estimatedTokens > limits.input * 0.6) {
      console.log('📄 Large document detected, processing in chunks...');
      const chunks = splitIntoChunks(finalMessage, Math.floor(limits.input * 0.5));
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`🔄 Processing chunk ${i+1}/${chunks.length}...`);
        
        const chunkMessages = [{
          role: 'user',
          content: `Analise esta parte (${i+1}/${chunks.length}) do documento:\n\n${chunks[i]}`
        }];
        
        const chunkResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${xaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: chunkMessages,
            max_tokens: limits.output,
            temperature: 0.7,
          }),
        });
        
        if (!chunkResponse.ok) {
          const errorData = await chunkResponse.text();
          console.error(`❌ Chunk ${i+1} error:`, errorData);
          throw new Error(`Erro no chunk ${i+1}: ${chunkResponse.status}`);
        }
        
        const chunkData = await chunkResponse.json();
        const chunkText = chunkData.choices?.[0]?.message?.content || '';
        chunkResponses.push(chunkText);
        console.log(`✅ Chunk ${i+1} processed:`, chunkText.length, 'characters');
      }
      
      // Consolidate all responses
      console.log('🔄 Consolidating', chunkResponses.length, 'chunk responses...');
      const consolidationPrompt = `Consolidar as análises das ${chunks.length} partes:\n\n${
        chunkResponses.map((r, i) => `PARTE ${i+1}:\n${r}`).join('\n\n---\n\n')
      }\n\nPergunta original: ${message}`;
      
      messages.push({
        role: 'user',
        content: consolidationPrompt
      });
    } else {
      // Normal processing with context if enabled
      if (contextEnabled && conversationHistory.length > 0) {
        console.log('Building conversation context with', conversationHistory.length, 'previous messages');
        const recentHistory = conversationHistory.slice(-3);
        
        const useCache = model === 'grok-4.1-fast' && recentHistory.length > 0;
        
        messages = recentHistory.map((historyMsg: any, index: number) => {
          const msg: any = {
            role: historyMsg.role,
            content: historyMsg.content
          };
          
          if (useCache && index === recentHistory.length - 1) {
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
    }

    // Build request body
    const requestBody: any = {
      model: model,
      messages: messages,
      max_tokens: limits.output,
      temperature: 0.7,
    };
    
    // Add reasoning_effort for grok-3-mini only
    if (useReasoning && supportsReasoningContent(model)) {
      requestBody.reasoning_effort = reasoningEffort; // 'low', 'medium', or 'high'
      console.log('🧠 Added reasoning_effort:', reasoningEffort);
    }
    
    // Add live search parameters
    if (useLiveSearch) {
      requestBody.search_parameters = {
        mode: 'on',
        return_citations: true
      };
      console.log('🌐 Live Search enabled for Grok');
    }
    
    // Enable streaming for reasoning models or live search to get incremental updates
    if (useReasoning || useLiveSearch) {
      requestBody.stream = true;
      console.log('🌊 Streaming enabled for', useReasoning ? 'reasoning' : 'live search');
    }

    console.log('Sending request to xAI with model:', model);
    console.log('Request config:', { 
      model, 
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      reasoning: useReasoning,
      reasoningEffort: requestBody.reasoning_effort
    });

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('xAI API error:', errorData);
      throw new Error(`Erro da API xAI: ${response.status} - ${errorData}`);
    }

    // Handle streaming response for reasoning or live search
    if ((useReasoning || useLiveSearch) && response.body) {
      console.log('🔄 Processing streaming response with', useReasoning ? 'reasoning' : 'live search');
      
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let reasoningContent = '';
          let textContent = '';
          let citations: string[] = [];
          let inputTokens = 0;
          let outputTokens = 0;
          let reasoningTokens = 0;

          try {
            // Send initial status for live search
            if (useLiveSearch) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'web_search_status', 
                status: '🔍 Buscando na web...' 
              })}\n\n`));
            }

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.trim() || line.startsWith(':')) continue;
                if (!line.startsWith('data: ')) continue;

                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') continue;

                try {
                  const data = JSON.parse(jsonStr);
                  const delta = data.choices?.[0]?.delta;
                  
                  if (delta) {
                    // grok-3-mini returns reasoning_content in delta
                    if (delta.reasoning_content) {
                      reasoningContent += delta.reasoning_content;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'reasoning', 
                        content: delta.reasoning_content 
                      })}\n\n`));
                    }
                    
                    // Regular content
                    if (delta.content) {
                      textContent += delta.content;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'content', 
                        content: delta.content 
                      })}\n\n`));
                    }
                  }
                  
                  // Citations returned in final chunk with live search
                  if (data.citations) {
                    citations = data.citations;
                    console.log('🌐 Citations received:', citations.length);
                  }
                  
                  // Token usage in final chunk
                  if (data.usage) {
                    inputTokens = data.usage.prompt_tokens || 0;
                    outputTokens = data.usage.completion_tokens || 0;
                    reasoningTokens = data.usage.completion_tokens_details?.reasoning_tokens || 0;
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }

            // Send final reasoning summary if we collected any
            if (reasoningContent) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'reasoning_final', 
                content: reasoningContent 
              })}\n\n`));
            }
            
            // Send citations if we have them (from live search)
            if (citations.length > 0) {
              const formattedCitations = citations.map(url => ({
                url: url,
                title: new URL(url).hostname
              }));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'citations', 
                citations: formattedCitations
              })}\n\n`));
              console.log('🌐 Sent', formattedCitations.length, 'citations to client');
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // Record token usage
            const authHeader = req.headers.get('authorization');
            if (authHeader) {
              const token = authHeader.replace('Bearer ', '');
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
              const supabase = createClient(supabaseUrl, supabaseServiceKey);
              
              const { data: { user } } = await supabase.auth.getUser(token);
              
              if (user?.id) {
                const totalTokens = inputTokens + outputTokens;
                console.log('📊 Grok reasoning token usage:', { 
                  inputTokens, 
                  outputTokens, 
                  reasoningTokens,
                  total: totalTokens 
                });
                
                await supabase.from('token_usage').insert({
                  user_id: user.id,
                  model_name: model,
                  tokens_used: totalTokens,
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

    // Non-streaming response (no reasoning or model doesn't support it)
    const data = await response.json();
    let generatedText = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta';
    
    // Normalize line breaks
    generatedText = generatedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    console.log('xAI response received successfully');

    // Record token usage in database  
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: { user } } = await supabase.auth.getUser(token);
        const userId = user?.id;
        
        if (userId) {
          const inputTokens = Math.ceil((finalMessage?.length || 0) / 3.2);
          const outputTokens = Math.ceil(generatedText.length / 3.2);
          
          const uncachedInputTokens = Math.max(0, inputTokens - cachedTokens);
          const cachedInputCost = (cachedTokens / 1000000) * 0.05;
          const uncachedInputCost = (uncachedInputTokens / 1000000) * 0.20;
          
          const effectiveInputTokens = Math.ceil(
            ((cachedInputCost + uncachedInputCost) / 0.20) * 1000000
          );
          
          const totalTokens = effectiveInputTokens + outputTokens;
          
          console.log('Recording Grok token usage:', {
            userId,
            model,
            inputTokens,
            cachedTokens,
            effectiveInputTokens,
            outputTokens,
            totalTokens,
            savedTokens: cachedTokens > 0 ? Math.ceil(cachedTokens * 0.75) : 0
          });

          const { error: tokenError } = await supabase
            .from('token_usage')
            .insert({
              user_id: userId,
              model_name: model,
              tokens_used: totalTokens,
              input_tokens: effectiveInputTokens,
              output_tokens: outputTokens,
              message_content: messages[messages.length - 1]?.content?.length > 1000 
                ? messages[messages.length - 1]?.content.substring(0, 1000) + '...' 
                : messages[messages.length - 1]?.content,
              ai_response_content: generatedText.length > 2000
                ? generatedText.substring(0, 2000) + '...'
                : generatedText,
              created_at: new Date().toISOString()
            });

          if (tokenError) {
            console.error('Error saving token usage:', tokenError);
          } else {
            console.log('Token usage recorded successfully');
          }
        }
      } catch (tokenRecordError) {
        console.error('Error recording token usage:', tokenRecordError);
      }
    }

    // Create document context for follow-ups
    let documentContext = null;
    if (chunkResponses.length > 0) {
      const compactSummary = generatedText.length > 2000 
        ? generatedText.substring(0, 2000) + '...\n\n[Resposta completa disponível no histórico]'
        : generatedText;
      
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
      response: generatedText,
      documentContext 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função grok-chat:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
