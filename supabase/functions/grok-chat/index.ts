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
    const { message, model = 'grok-3', files, conversationHistory = [], contextEnabled = false } = await req.json();
    
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    if (!xaiApiKey) {
      throw new Error('XAI_API_KEY não configurada');
    }

    // Define token limits for different xAI models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('grok-4')) return { input: 128000, output: 8192 };
      if (modelName.includes('grok-3-mini')) return { input: 32000, output: 4096 };
      if (modelName.includes('grok-3')) return { input: 128000, output: 8192 };
      return { input: 128000, output: 8192 }; // Default for Grok models
    };

    const limits = getModelLimits(model);
    
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
    
    // Build messages array with conversation history if context is enabled
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
        
        // For grok-4.1-fast, add cache_control to enable prompt caching (75% discount)
        const useCache = model === 'grok-4.1-fast' && recentHistory.length > 0;
        
        messages = recentHistory.map((historyMsg: any, index: number) => {
          const msg: any = {
            role: historyMsg.role,
            content: historyMsg.content
          };
          
          // Add cache_control to the last message in history to cache the conversation
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

    let processedMessages = messages;
    
    const requestBody = {
      model: model,
      messages: processedMessages,
      max_tokens: limits.output,
      temperature: 0.7,
    };

    console.log('Sending request to xAI with model:', model);
    console.log('Request config:', { 
      model, 
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature 
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

    const data = await response.json();
    let generatedText = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta';
    
    // Normalize line breaks to standard \n
    generatedText = generatedText
      .replace(/\r\n/g, '\n')  // Normalize CRLF to LF
      .replace(/\r/g, '\n');   // Convert any remaining CR to LF

    console.log('xAI response received successfully');

    // Record token usage in database  
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      try {
        // Get user info from JWT
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: { user } } = await supabase.auth.getUser(token);
        const userId = user?.id;
        
        if (userId) {
          // Calculate token usage - 3.2 characters = 1 token (optimized for Portuguese)
          const inputTokens = Math.ceil((finalMessage?.length || 0) / 3.2);
          const outputTokens = Math.ceil(generatedText.length / 3.2);
          
          // Apply 75% discount to cached tokens for grok-4.1-fast
          // Cached tokens cost $0.05/1M (75% discount from $0.20/1M)
          const uncachedInputTokens = Math.max(0, inputTokens - cachedTokens);
          const cachedInputCost = (cachedTokens / 1000000) * 0.05; // $0.05 per 1M cached tokens
          const uncachedInputCost = (uncachedInputTokens / 1000000) * 0.20; // $0.20 per 1M regular input tokens
          
          // For billing purposes, convert cached tokens to "effective" tokens at regular price
          // effectiveTokens = (cachedCost + uncachedCost) / regularPrice
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

          // Save token usage to database
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
    console.error('Erro na função xai-chat:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});