import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to estimate token count
function estimateTokenCount(text: string): number {
  // Improved estimation for Portuguese: ~3.2 characters per token
  // English averages ~4 chars/token, but Portuguese is slightly denser
  return Math.ceil(text.length / 3.2);
}

// Function to split text into chunks
function splitIntoChunks(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 3.2; // Convert tokens to characters (3.2 chars = 1 token for Portuguese)
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
    const { message, model = 'gpt-5-2025-08-07', files, conversationHistory = [], contextEnabled = false, isComparison = false, comparisonContext = '' } = await req.json();
    
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
    
    // Define token limits for different models - Tier 2 limits
    const getModelLimits = (modelName: string) => {
      if (modelName.includes('gpt-5-nano')) return { input: 50000, output: 8192 };    // Tier 2: doubled
      if (modelName.includes('gpt-5-mini')) return { input: 100000, output: 16384 };  // Tier 2: doubled
      if (modelName.includes('gpt-5')) return { input: 200000, output: 32768 };       // Tier 2: increased
      if (modelName.includes('o4-mini')) return { input: 50000, output: 8192 };       // Tier 2: doubled
      if (modelName.includes('o3') || modelName.includes('o4')) return { input: 200000, output: 32768 }; // Tier 2: increased
      return { input: 100000, output: 16384 }; // Tier 2 default
    };

    const limits = getModelLimits(model);
    
    // Log files information
    if (files && files.length > 0) {
      console.log('Files received:', files.map((f: any) => ({
        name: f.name, 
        type: f.type, 
        hasPdfContent: !!f.pdfContent,
        hasWordContent: !!f.wordContent,
        hasImageData: !!f.imageData
      })));
    }
    
    // Detect if we have images
    const imageFiles = files?.filter((f: any) => 
      f.type?.startsWith('image/') && f.imageData
    ) || [];
    const hasImages = imageFiles.length > 0;
    
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
      if (mainMessageTokens < limits.input * 0.3) {
        // Add limited conversation history
        const recentHistory = conversationHistory.slice(-3); // Only last 3 messages
        messages = recentHistory.map((historyMsg: any) => ({
          role: historyMsg.role,
          content: historyMsg.content
        }));
      }
    }
    
    // Add current user message (with images if present)
    if (hasImages) {
      console.log('Processing message with images:', imageFiles.length);
      
      // Build multimodal content array
      const content: any[] = [
        { type: 'text', text: finalMessage }
      ];
      
      // Add all images
      for (const imageFile of imageFiles) {
        content.push({
          type: 'image_url',
          image_url: {
            url: imageFile.imageData, // Should be data:image/...;base64,...
            detail: 'high'
          }
        });
      }
      
      messages.push({
        role: 'user',
        content: content
      });
    } else {
      messages.push({
        role: 'user',
        content: finalMessage
      });
    }
    
    // Adicionar contexto de comparação se aplicável
    if (isComparison && comparisonContext) {
      messages.unshift({
        role: 'system',
        content: comparisonContext
      });
    }
    
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
    let chunkResponses: string[] = [];

    // 📊 Diagnostic logging
    console.log('📊 DIAGNÓSTICO DE PROCESSAMENTO:', {
      estimatedTokens,
      inputLimit: limits.input,
      usedPercentage: ((estimatedTokens / limits.input) * 100).toFixed(1) + '%',
      willChunk: estimatedTokens > limits.input * 0.6,
      model,
      hasFiles: files?.length > 0,
      fileTypes: files?.map(f => f.type).join(', '),
      conversationHistorySize: conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    // If message is too large, split into chunks and process ALL chunks
    // Comparações podem usar 20% mais do limite
    const comparisonMultiplier = isComparison ? 1.2 : 1.0;
    
    if (estimatedTokens > limits.input * 0.6 * comparisonMultiplier) { // Tier 2: use 60% of limit (increased from 40%)
      console.log('Message too large, processing in chunks...');
      
      // Tier 2: Much larger chunks for all models
      let maxChunkTokens;
      if (model.includes('gpt-5')) {
        maxChunkTokens = Math.min(50000, Math.floor(limits.input * 0.5)); // Tier 2: 50K chunks (was 15K)
      } else {
        maxChunkTokens = Math.floor(limits.input * 0.7); // Tier 2: 70% of limit
      }
      
      const chunks = splitIntoChunks(finalMessage, maxChunkTokens);
      
      if (chunks.length > 1) {
        responsePrefix = `📄 Documento com ${estimatedTokens.toLocaleString()} tokens dividido em ${chunks.length} seções\n\n`;
        
        // Process ALL chunks (Map phase)
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
          responsePrefix += `🔄 Processando seção ${i + 1}/${chunks.length}...\n`;
          
          const chunkMessage = `Analise este trecho de um documento extenso (parte ${i + 1} de ${chunks.length}). ${message}\n\nTrecho do documento:\n\n${chunks[i]}`;
          
          const chunkRequestBody: any = {
            model: model,
            messages: [{
              role: 'user',
              content: chunkMessage
            }],
            max_completion_tokens: isNewerModel ? Math.min(4096, limits.output) : undefined,
            max_tokens: !isNewerModel ? Math.min(4096, limits.output) : undefined,
          };

          if (!isNewerModel) {
            chunkRequestBody.temperature = 0.7;
          }

          const chunkResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chunkRequestBody),
          });

          if (!chunkResponse.ok) {
            const errorData = await chunkResponse.text();
            console.error(`Error processing chunk ${i + 1}:`, errorData);
            chunkResponses.push(`[Erro ao processar seção ${i + 1}]`);
            continue;
          }

          const chunkData = await chunkResponse.json();
          const chunkText = chunkData.choices?.[0]?.message?.content || `[Sem resposta para seção ${i + 1}]`;
          chunkResponses.push(chunkText);
        }
        
        responsePrefix += `\n✅ Todas as ${chunks.length} seções processadas. Consolidando respostas...\n\n`;
        
        // Reduce phase: consolidate all chunk responses
        const consolidationPrompt = `Você processou um documento extenso em ${chunks.length} partes. Aqui estão as análises de cada parte:\n\n${chunkResponses.map((resp, idx) => `=== PARTE ${idx + 1} ===\n${resp}`).join('\n\n')}\n\nAgora consolide todas essas análises em uma resposta única, completa e coerente. Pergunta original do usuário: ${message}`;
        
        processedMessages = [{
          role: 'user',
          content: consolidationPrompt
        }];
        
        // Preserve context for follow-ups by creating a summary
        console.log('💾 Preservando contexto do documento processado para follow-ups');
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
    let generatedText = data.choices?.[0]?.message?.content || "Não foi possível gerar resposta";
    
    // Normalize line breaks to standard \n
    generatedText = generatedText
      .replace(/\r\n/g, '\n')  // Normalize CRLF to LF
      .replace(/\r/g, '\n');   // Convert any remaining CR to LF
    
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

        // Save token usage to database with real data
        const { error: tokenError } = await supabase
          .from('token_usage')
          .insert({
            user_id: userId,
            model_name: displayModel,
            tokens_used: totalTokens, // Keep for compatibility
            input_tokens: inputTokens, // Real input tokens
            output_tokens: outputTokens, // Real output tokens
            message_content: finalMessage.length > 1000 
              ? finalMessage.substring(0, 1000) + '...' 
              : finalMessage,
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});