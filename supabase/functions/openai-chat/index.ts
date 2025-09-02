import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to estimate token count (4 characters = 1 token as per user requirement)
function estimateTokenCount(text: string): number {
  // User specified: 4 characters = 1 token
  return Math.ceil(text.length / 4);
}

// Function to split text into chunks
function splitIntoChunks(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4; // Convert tokens to characters (4 chars = 1 token)
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
    const { message, model = 'gpt-5-2025-08-07', files, conversationHistory = [], contextEnabled = false } = await req.json();
    
    // Get user info from JWT
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId = null;
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      } catch (error) {
        console.log('Could not get user from token:', error);
      }
    }
    
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
    
    // Log files information
    if (files && files.length > 0) {
      console.log('Files received:', files.map(f => ({ 
        name: f.name, 
        type: f.type, 
        hasPdfContent: !!f.pdfContent,
        hasWordContent: !!f.wordContent
      })));
    }
    
    // Process PDF and DOC files if present
    let finalMessage = message;
    if (files && files.length > 0) {
      const pdfFiles = files.filter(f => f.type === 'application/pdf' && f.pdfContent);
      const docFiles = files.filter(f => f.wordContent);
      
      const fileContents = [];
      
      if (pdfFiles.length > 0) {
        fileContents.push(...pdfFiles.map(pdf => 
          `[Arquivo PDF: ${pdf.name}]\n\n${pdf.pdfContent}`
        ));
      }
      
      if (docFiles.length > 0) {
        fileContents.push(...docFiles.map(doc => 
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
      if (mainMessageTokens < limits.input * 0.3) {
        // Add limited conversation history
        const recentHistory = conversationHistory.slice(-3); // Only last 3 messages
        messages = recentHistory.map((historyMsg) => ({
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
    const totalText = messages.map(msg => msg.content).join('\n');
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

    // If message is too large, split into chunks and summarize
    if (estimatedTokens > limits.input * 0.4) { // Use 40% of limit to avoid TPM limits
      console.log('Message too large, processing in chunks...');
      
      // For GPT-5 models, use smaller chunks due to TPM limits
      let maxChunkTokens;
      if (model.includes('gpt-5')) {
        maxChunkTokens = Math.min(15000, Math.floor(limits.input * 0.3)); // Much smaller chunks for GPT-5
      } else {
        maxChunkTokens = Math.floor(limits.input * 0.6);
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
    
    const requestBody: any = {
      model: model,
      messages: processedMessages,
      max_completion_tokens: isNewerModel ? limits.output : undefined,
      max_tokens: !isNewerModel ? limits.output : undefined,
    };

    // Only add temperature for legacy models
    if (!isNewerModel) {
      requestBody.temperature = 0.7;
    }

    console.log('Sending request to OpenAI with model:', model);
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
    const generatedText = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta';
    
    // Add prefix if message was processed in chunks
    const finalResponse = responsePrefix + generatedText;

    console.log('OpenAI response received successfully');

    // Record token usage in database
    if (userId) {
      try {
        // Calculate token usage - 4 characters = 1 token
        const inputTokens = estimateTokenCount(finalMessage);
        const outputTokens = estimateTokenCount(generatedText);
        const totalTokens = inputTokens + outputTokens;
        
        // Map internal model to display model (handle SynergyAi)
        const displayModel = model === 'gpt-4o-mini' ? 'synergyai' : model;
        
        console.log('Recording token usage:', {
          userId,
          model: displayModel,
          inputTokens,
          outputTokens,
          totalTokens,
          messageLength: finalMessage.length,
          responseLength: generatedText.length
        });

        // Save token usage to database
        const { error: tokenError } = await supabase
          .from('token_usage')
          .insert({
            user_id: userId,
            model_name: displayModel,
            tokens_used: totalTokens,
            message_content: finalMessage.length > 500 
              ? finalMessage.substring(0, 500) + '...' 
              : finalMessage,
            created_at: new Date().toISOString()
          });

        if (tokenError) {
          console.error('Error saving token usage:', tokenError);
        } else {
          console.log('Token usage recorded successfully');
        }
      } catch (tokenRecordError) {
        console.error('Error recording token usage:', tokenRecordError);
      }
    } else {
      console.log('No user ID available, skipping token usage recording');
    }

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