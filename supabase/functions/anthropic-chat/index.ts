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
      maxTokens: requestBody.max_tokens,
      messageCount: processedMessages.length
    });

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

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

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Anthropic API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Erro da API Anthropic: ${response.status} - ${errorData}`);
      }

      console.log('Anthropic API response status:', response.status);
      
      // Continue processing the response
      const data = await response.json();
      console.log('Response data received, parsing...');
      
      let generatedText = data.content?.[0]?.text || "Não foi possível gerar resposta";
      
      // Normalize line breaks and remove excessive spacing
      generatedText = generatedText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      // Add prefix if message was processed in chunks
      const finalResponse = responsePrefix + generatedText;

      console.log('Anthropic response received successfully', {
        responseLength: finalResponse.length,
        hadPrefix: !!responsePrefix
      });

      // Record token usage in database
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: userData } = await supabaseClient.auth.getUser(token);
        
        if (userData.user) {
          const inputTokens = data.usage?.input_tokens || 0;
          const outputTokens = data.usage?.output_tokens || 0;
          
          await supabaseClient.from('token_usage').insert({
            user_id: userData.user.id,
            tokens_used: inputTokens + outputTokens,
            model: model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          });
        }
      }

      return new Response(JSON.stringify({ response: finalResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Request timeout after 2 minutes');
        throw new Error('A requisição excedeu o tempo limite de 2 minutos. Por favor, tente novamente com um prompt menor.');
      }
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