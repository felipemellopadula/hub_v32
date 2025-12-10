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

// Dynamic Map-Reduce threshold based on model capabilities
function getMapReduceThreshold(model: string): number {
  if (model.includes('gemini-3')) return 900000; // ~1.260 páginas (Gemini 3 Pro: 1M tokens)
  if (model.includes('gemini-2.5')) return 900000; // ~1.260 páginas
  if (model.includes('gemini-2.0')) return 750000; // ~1.050 páginas
  if (model.includes('gemini-1.5')) return 600000; // ~840 páginas
  return 500000; // ~700 páginas para modelos menores
}

// Check if model supports thinking/reasoning
function supportsThinking(model: string): boolean {
  // Gemini 2.5 and 3 Pro support thinking
  return model.includes('gemini-2.5') || model.includes('gemini-3');
}

// Process grounding metadata to extract citations
function processGroundingMetadata(metadata: any, fullText: string): any[] {
  const citations: any[] = [];
  const chunks = metadata.groundingChunks || [];
  const supports = metadata.groundingSupports || [];
  
  // Extract unique sources from grounding chunks
  const seenUrls = new Set<string>();
  
  for (const chunk of chunks) {
    if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
      seenUrls.add(chunk.web.uri);
      citations.push({
        url: chunk.web.uri,
        title: chunk.web.title || 'Fonte',
        // Map supports to this citation
        segments: supports
          .filter((s: any) => s.groundingChunkIndices?.includes(chunks.indexOf(chunk)))
          .map((s: any) => s.segment?.text)
          .filter(Boolean)
      });
    }
  }
  
  return citations;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      model = 'gemini-2.0-flash-exp', 
      files, 
      conversationHistory = [], 
      contextEnabled = false,
      reasoningEnabled = false, // New parameter for enabling thinking
      webSearchEnabled = false // New parameter for enabling Google Search grounding
    } = await req.json();
    
    // Map frontend model names to correct Gemini API model names
    const modelMapping: Record<string, string> = {
      'gemini-3-pro': 'gemini-2.5-pro-preview-06-05',
      'gemini-2.5-pro': 'gemini-2.5-pro-preview-06-05',
      'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20', 
      'gemini-2.5-flash-lite': 'gemini-2.0-flash-exp'
    };
    
    const actualModel = modelMapping[model] || model;
    const useThinking = reasoningEnabled && supportsThinking(actualModel);
    
    console.log('Gemini Chat - Request received:', {
      model,
      actualModel,
      messageLength: message?.length || 0,
      messagePreview: message?.substring(0, 200) + '...',
      hasMessage: !!message,
      contextEnabled,
      reasoningEnabled,
      useThinking,
      webSearchEnabled,
      historyLength: conversationHistory.length
    });
    
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    // Log files information
    if (files && files.length > 0) {
      console.log('📄 Files received:', files.map((f: any) => ({ 
        name: f.name, 
        type: f.type, 
        hasPdfContent: !!f.pdfContent,
        hasWordContent: !!f.wordContent
      })));
    }
    
    // Process PDF and DOC files if present
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
        console.log('📊 Final message with files:', finalMessage.length, 'characters');
      }
    }

    // Define token limits based on model
    const limits = actualModel.includes('gemini-3') || actualModel.includes('gemini-2.5')
      ? { input: 1048576, output: 65536 }  // Gemini 2.5/3: 1M in, 65K out
      : { input: 1000000, output: 8192 };  // Gemini 2.0 Flash default
    const estimatedTokens = estimateTokenCount(finalMessage);
    const mapReduceThreshold = getMapReduceThreshold(actualModel);
    
    console.log('🎯 CAPACIDADES DO MODELO:', {
      modelo: actualModel,
      inputMaximo: '1.048.576 tokens (1.400 páginas)',
      inputAtual: `${estimatedTokens} tokens (${Math.ceil(estimatedTokens/714)} páginas)`,
      outputMaximo: `${limits.output} tokens`,
      thresholdMapReduce: `${mapReduceThreshold} tokens (${Math.ceil(mapReduceThreshold/714)} páginas)`,
      usaraMapReduce: estimatedTokens > mapReduceThreshold,
      thinkingEnabled: useThinking,
      margemSeguranca: `${((1048576 - estimatedTokens) / 1048576 * 100).toFixed(1)}% disponível`
    });

    // Validar tamanho dos arquivos (limite Google: 500MB)
    if (files && files.length > 0) {
      const MAX_FILE_SIZE_MB = 500;
      
      for (const file of files) {
        const content = file.pdfContent || file.wordContent || '';
        const fileSizeMB = new Blob([content]).size / (1024 * 1024);
        
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          console.error(`❌ Arquivo ${file.name} muito grande:`, fileSizeMB.toFixed(1), 'MB');
          return new Response(JSON.stringify({ 
            error: `Arquivo "${file.name}" excede o limite de 500MB (tamanho: ${fileSizeMB.toFixed(1)}MB). Por favor, divida o documento em arquivos menores.`,
            fileSizeMB: fileSizeMB.toFixed(1),
            maxSizeMB: MAX_FILE_SIZE_MB
          }), {
            status: 413,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Check absolute maximum limit
    const MAX_DOCUMENT_TOKENS = 950000;
    if (estimatedTokens > MAX_DOCUMENT_TOKENS) {
      console.error('❌ Documento excede limite:', estimatedTokens, 'tokens');
      return new Response(JSON.stringify({ 
        error: `Documento muito grande: ${Math.ceil(estimatedTokens/1000)}k tokens. Máximo permitido: 950k tokens (~1.330 páginas de PDF).`,
        estimatedTokens,
        maxTokens: MAX_DOCUMENT_TOKENS
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build contents array with conversation history if context is enabled
    let contents = [];
    let chunkResponses: string[] = [];
    let cachedTokens = 0;
    
    // If document is large, process in chunks with Map-Reduce (disable thinking for chunks)
    if (estimatedTokens > mapReduceThreshold) {
      console.log('📄 Large document detected, processing in chunks...');
      const chunks = splitIntoChunks(finalMessage, Math.floor(limits.input * 0.25));
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`🔄 Processing chunk ${i+1}/${chunks.length}...`);
        
        const chunkContents = [
          {
            role: 'user',
            parts: [{
              text: `Analise esta parte (${i+1}/${chunks.length}) do documento:\n\n${chunks[i]}`
            }]
          }
        ];
        
        const chunkResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: chunkContents,
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
              }
            }),
          }
        );
        
        if (!chunkResponse.ok) {
          const errorData = await chunkResponse.text();
          console.error(`❌ Chunk ${i+1} error:`, errorData);
          throw new Error(`Erro no chunk ${i+1}: ${chunkResponse.status}`);
        }
        
        const chunkData = await chunkResponse.json();
        const chunkText = chunkData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        chunkResponses.push(chunkText);
        console.log(`✅ Chunk ${i+1} processed:`, chunkText.length, 'characters');
      }
      
      // Consolidate all chunk responses
      const consolidationPrompt = `Consolidar as análises das ${chunks.length} partes do documento:\n\n${
        chunkResponses.map((r, i) => `PARTE ${i+1}:\n${r}`).join('\n\n---\n\n')
      }\n\nPergunta original: ${message}`;
      
      contents.push({
        role: 'user',
        parts: [{ text: consolidationPrompt }]
      });
    } else {
      // Normal processing - use context if enabled
      if (contextEnabled && conversationHistory.length > 0) {
        const mainMessageTokens = estimateTokenCount(finalMessage);
        
        if (mainMessageTokens > limits.input * 0.6) {
          const documentContextMessages = conversationHistory.filter((msg: any) => 
            msg.content?.includes('[CONTEXTO DO DOCUMENTO]')
          );
          
          if (documentContextMessages.length > 0) {
            const lastDocContext = documentContextMessages[documentContextMessages.length - 1];
            contents.push({
              role: 'user',
              parts: [{ text: lastDocContext.content }]
            });
          }
        } else {
          const recentHistory = conversationHistory.slice(-3);
          recentHistory.forEach((historyMsg: any, index: number) => {
            const role = historyMsg.role === 'assistant' ? 'model' : 'user';
            const messageContent = historyMsg.content;
            
            if (index === recentHistory.length - 1 && role === 'user') {
              cachedTokens = estimateTokenCount(messageContent);
            }
            
            contents.push({
              role: role,
              parts: [{ text: messageContent }]
            });
          });
        }
      }
      
      // Add current user message
      contents.push({
        role: 'user',
        parts: [{ text: finalMessage }]
      });
    }

    console.log('Sending request to Gemini with model:', actualModel, 'and', contents.length, 'messages');

    // Build generation config with optional thinking
    const generationConfig: any = {
      temperature: useThinking ? 1.0 : 0.7, // Higher temp recommended for thinking
      topK: 40,
      topP: 0.95,
      maxOutputTokens: Math.min(Math.floor(limits.output * 0.8), limits.output),
    };

    // Add thinking config if enabled
    if (useThinking) {
      generationConfig.thinkingConfig = {
        includeThoughts: true,
        // Use thinkingBudget for Gemini 2.5, thinkingLevel for Gemini 3
        ...(actualModel.includes('gemini-3') 
          ? { thinkingLevel: 'high' }
          : { thinkingBudget: 8192 }) // Medium budget for balanced response
      };
      console.log('🧠 Thinking mode enabled with config:', generationConfig.thinkingConfig);
    }

    // Build tools array for web search
    const tools: any[] = [];
    if (webSearchEnabled) {
      tools.push({ google_search: {} });
      console.log('🌐 Web Search (Google Search Grounding) enabled');
    }

    // Use streaming for thinking mode or web search to get real-time updates
    if (useThinking || webSearchEnabled) {
      const modeName = useThinking ? '🧠 Thinking' : '🌐 Web Search';
      console.log(`${modeName} mode - Using streaming...`);
      
      const requestPayload: any = {
        contents: contents,
        generationConfig
      };
      
      // Add tools if web search is enabled
      if (tools.length > 0) {
        requestPayload.tools = tools;
      }
      
      const streamResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        }
      );

      if (!streamResponse.ok) {
        const errorData = await streamResponse.text();
        console.error('Gemini API streaming error:', errorData);
        throw new Error(`Erro da API Gemini: ${streamResponse.status} - ${errorData}`);
      }

      // Create SSE stream for client
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = streamResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullThoughts = '';
          let fullContent = '';
          let groundingMetadata: any = null;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const jsonStr = trimmed.slice(6);
                if (jsonStr === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const candidate = parsed.candidates?.[0];
                  const parts = candidate?.content?.parts || [];
                  
                  // Capture grounding metadata from web search
                  if (candidate?.groundingMetadata) {
                    groundingMetadata = candidate.groundingMetadata;
                    console.log('🌐 Grounding metadata received:', {
                      hasSearchQueries: !!groundingMetadata.webSearchQueries,
                      queriesCount: groundingMetadata.webSearchQueries?.length || 0,
                      hasChunks: !!groundingMetadata.groundingChunks,
                      chunksCount: groundingMetadata.groundingChunks?.length || 0
                    });
                    
                    // Send search status to client
                    if (groundingMetadata.webSearchQueries?.length > 0) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'web_search_status',
                        status: 'completed',
                        queries: groundingMetadata.webSearchQueries
                      })}\n\n`));
                    }
                  }

                  for (const part of parts) {
                    if (!part.text) continue;

                    if (part.thought) {
                      // This is reasoning/thinking content
                      fullThoughts += part.text;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'reasoning',
                        reasoning: part.text
                      })}\n\n`));
                    } else {
                      // This is regular content
                      fullContent += part.text;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'content',
                        content: part.text
                      })}\n\n`));
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }

            // Send final reasoning summary if we have thoughts
            if (fullThoughts) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'reasoning_final',
                reasoning: fullThoughts
              })}\n\n`));
            }
            
            // Send grounding metadata with citations at the end
            if (groundingMetadata && webSearchEnabled) {
              const citations = processGroundingMetadata(groundingMetadata, fullContent);
              if (citations.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'citations',
                  citations: citations,
                  webSearchQueries: groundingMetadata.webSearchQueries || []
                })}\n\n`));
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // Record token usage
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
                  const outputTokens = Math.ceil((fullContent.length + fullThoughts.length) / 3.2);
                  const totalTokens = inputTokens + outputTokens;
                  
                  console.log('Recording Gemini thinking token usage:', {
                    userId,
                    model: actualModel,
                    inputTokens,
                    outputTokens,
                    thoughtTokens: Math.ceil(fullThoughts.length / 3.2),
                    totalTokens
                  });

                  await supabase
                    .from('token_usage')
                    .insert({
                      user_id: userId,
                      model_name: actualModel,
                      tokens_used: totalTokens,
                      input_tokens: inputTokens,
                      output_tokens: outputTokens,
                      message_content: message?.length > 1000 
                        ? message.substring(0, 1000) + '...' 
                        : message,
                      ai_response_content: fullContent.length > 2000
                        ? fullContent.substring(0, 2000) + '...'
                        : fullContent,
                      created_at: new Date().toISOString()
                    });
                }
              } catch (tokenRecordError) {
                console.error('Error recording token usage:', tokenRecordError);
              }
            }

          } catch (error) {
            console.error('Stream processing error:', error);
            controller.error(error);
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

    // Non-streaming mode: regular request (no thinking, no web search)
    const requestPayload: any = {
      contents: contents,
      generationConfig
    };
    
    // Add tools if any are configured
    if (tools.length > 0) {
      requestPayload.tools = tools;
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error(`Erro da API Gemini: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar resposta';
    
    // Normalize line breaks
    generatedText = generatedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    console.log('Gemini response received successfully');

    // Record token usage
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
          const regularInputTokens = inputTokens - cachedTokens;
          const effectiveInputTokens = regularInputTokens + Math.ceil(cachedTokens * 0.25);
          const totalTokens = effectiveInputTokens + outputTokens;
          
          console.log('Recording Gemini token usage:', {
            userId,
            model: actualModel,
            inputTokens,
            cachedTokens,
            effectiveInputTokens,
            outputTokens,
            totalTokens
          });

          await supabase
            .from('token_usage')
            .insert({
              user_id: userId,
              model_name: actualModel,
              tokens_used: totalTokens,
              input_tokens: effectiveInputTokens,
              output_tokens: outputTokens,
              message_content: message?.length > 1000 
                ? message.substring(0, 1000) + '...' 
                : message,
              ai_response_content: generatedText.length > 2000
                ? generatedText.substring(0, 2000) + '...'
                : generatedText,
              created_at: new Date().toISOString()
            });
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
    }

    return new Response(JSON.stringify({ 
      response: generatedText,
      documentContext 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função gemini-chat:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
