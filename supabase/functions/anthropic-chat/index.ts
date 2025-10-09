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
    const { message, model = 'claude-sonnet-4-5', files, conversationHistory = [], contextEnabled = false } = await req.json();
    
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada');
    }

    // Define token limits for different Claude models
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('claude-opus-4')) return { input: 200000, output: 16384 };
      if (modelName.includes('claude-sonnet-4')) return { input: 200000, output: 16384 };
      if (modelName.includes('claude-3-5-haiku')) return { input: 200000, output: 8192 };
      if (modelName.includes('claude-3-5-sonnet')) return { input: 200000, output: 8192 };
      if (modelName.includes('claude-3-opus')) return { input: 200000, output: 4096 };
      return { input: 200000, output: 16384 }; // Default for Claude 4 models
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
    
    // Build messages array with conversation history if context is enabled
    let messages = [];
    
    if (contextEnabled && conversationHistory.length > 0) {
      // Add conversation history for context (but keep it simple for large files)
      console.log('Building conversation context with', conversationHistory.length, 'previous messages');
      
      // Only add recent context if the main message isn't too large
      const mainMessageTokens = estimateTokenCount(finalMessage);
      if (mainMessageTokens < limits.input * 0.4) {
        // Add limited conversation history
        const recentHistory = conversationHistory.slice(-3); // Only last 3 messages
        messages = recentHistory.map((historyMsg: any) => ({
          role: historyMsg.role,
          content: historyMsg.content
        }));
      }
    }
    
    // Add current user message
    messages.push({
      role: 'user',
      content: finalMessage
    });
    
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
    let responsePrefix = '';

    // If message is too large, process in chunks
    if (estimatedTokens > limits.input * 0.6) {
      console.log('Message too large, processing in chunks...');
      
      // Claude models have high context window, use larger chunks
      let maxChunkTokens;
      if (model.includes('haiku')) {
        maxChunkTokens = Math.min(25000, Math.floor(limits.input * 0.4)); // Smaller chunks for Haiku
      } else {
        maxChunkTokens = Math.min(40000, Math.floor(limits.input * 0.5)); // Larger chunks for Opus/Sonnet
      }
      
      const chunks = splitIntoChunks(finalMessage, maxChunkTokens);
      
      if (chunks.length > 1) {
        responsePrefix = `⚠️ Documento muito grande para ${model}. Processando em ${chunks.length} partes:\n\n`;
        
        // Process first chunk with instructions to summarize
        const processedMessage = `Analise e resuma este trecho de um documento extenso (parte 1 de ${chunks.length}). Foque nos pontos principais:\n\n${chunks[0]}`;
        
        processedMessages = [{
          role: 'user',
          content: processedMessage
        }];
      }
    }
    
    const requestBody = {
      model: model,
      max_tokens: limits.output,
      messages: processedMessages
    };

    console.log('Sending request to Anthropic with model:', model);
    console.log('Request config:', { 
      model, 
      maxTokens: requestBody.max_tokens
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      throw new Error(`Erro da API Anthropic: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    let generatedText = data.content?.[0]?.text || "Não foi possível gerar resposta";
    
    // Normalize line breaks - keep it simple
    generatedText = generatedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    
    // Add prefix if message was processed in chunks
    const finalResponse = responsePrefix + generatedText;

    console.log('Anthropic response received successfully');

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
          // Calculate token usage - 4 characters = 1 token (user's specification)
          const inputTokens = Math.ceil((message?.length || 0) / 4);
          const outputTokens = Math.ceil(generatedText.length / 4);
          const totalTokens = inputTokens + outputTokens;
          
          console.log('Recording Claude token usage:', {
            userId,
            model,
            inputTokens,
            outputTokens,
            totalTokens,
            messageLength: message?.length || 0,
            responseLength: generatedText.length
          });

          // Save token usage to database with real data
          const { error: tokenError } = await supabase
            .from('token_usage')
            .insert({
              user_id: userId,
              model_name: model,
              tokens_used: totalTokens, // Keep for compatibility
              input_tokens: inputTokens, // Real input tokens
              output_tokens: outputTokens, // Real output tokens
              message_content: message?.length > 1000 
                ? message.substring(0, 1000) + '...' 
                : message,
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

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função claude-chat:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});