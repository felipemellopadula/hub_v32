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
    
    // Define token limits for different models - Tier 2 limits (OTIMIZADO)
    const getModelLimits = (modelName: string) => {
      // GPT-5 series (400k context window)
      if (modelName.includes('gpt-5-nano')) return { input: 200000, output: 8192 };     // +300%
      if (modelName.includes('gpt-5-mini')) return { input: 400000, output: 16384 };    // +300%
      if (modelName.includes('gpt-5')) return { input: 400000, output: 100000 };        // +100%
      
      // GPT-4.1 series (1M context window!)
      if (modelName.includes('gpt-4.1-mini')) return { input: 400000, output: 16384 };  // +300%
      if (modelName.includes('gpt-4.1')) return { input: 1000000, output: 32768 };      // +900% 🚀
      
      // O3/O4 reasoning models (200k context)
      if (modelName.includes('o4-mini')) return { input: 200000, output: 100000 };      // +300%
      if (modelName.includes('o3') || modelName.includes('o4')) return { input: 200000, output: 100000 };
      
      // Legacy models (128k context)
      if (modelName.includes('gpt-4o')) return { input: 128000, output: 16384 };
      
      return { input: 128000, output: 16384 }; // Default conservador
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
      console.log('Building conversation context with', conversationHistory.length, 'previous messages');
      
      const mainMessageTokens = estimateTokenCount(finalMessage);
      
      // Se o documento é grande (será processado em chunks) - OTIMIZADO: 80%
      if (mainMessageTokens > limits.input * 0.8) {
        // Filtrar apenas mensagens de contexto de documentos anteriores
        const documentContextMessages = conversationHistory.filter((msg: any) => 
          msg.content?.includes('[CONTEXTO DO DOCUMENTO]')
        );
        
        // Manter apenas o contexto de documento mais recente (se houver)
        if (documentContextMessages.length > 0) {
          messages = [documentContextMessages[documentContextMessages.length - 1]];
          console.log('📚 Contexto de documento anterior preservado');
        }
      } else {
        // Documento pequeno: comportamento normal
        const recentHistory = conversationHistory.slice(-3);
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

    // Validar tamanho máximo do documento
    const MAX_DOCUMENT_TOKENS: { [key: string]: number } = {
      'gpt-5': 1200000,        // ~1.2M (3x context window)
      'gpt-5-mini': 1200000,   // ~1.2M (3x context window)
      'gpt-5-nano': 600000,    // ~600k (3x context window)
      'gpt-4.1': 3000000,      // ~3M (3x context window) 🚀
      'gpt-4.1-mini': 1200000, // ~1.2M (3x context window)
      'o3': 600000,            // ~600k (3x context window)
      'o4': 600000,            // ~600k (3x context window)
      'default': 384000        // ~384k (3x 128k default)
    };

    const modelKey = Object.keys(MAX_DOCUMENT_TOKENS).find(key => model.includes(key)) || 'default';
    const maxTokens = MAX_DOCUMENT_TOKENS[modelKey];

    if (estimatedTokens > maxTokens) {
      console.error('❌ Documento excede limite máximo:', estimatedTokens, 'tokens');
      return new Response(JSON.stringify({ 
        error: `Documento muito grande: ${Math.ceil(estimatedTokens/1000)}k tokens. Máximo permitido para ${model}: ${Math.ceil(maxTokens/1000)}k tokens.`,
        estimatedTokens,
        maxTokens,
        model
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedMessages = messages;
    let responsePrefix = '';
    let chunkResponses: string[] = [];

    // 📊 Diagnostic logging (APRIMORADO)
    // Calcula chunks com base nos novos thresholds (90% e chunks de 70%/60%)
    let maxChunkTokensForEstimate;
    if (model.includes('gpt-5')) {
      maxChunkTokensForEstimate = Math.floor(limits.input * 0.7);
    } else if (model.includes('gpt-4.1')) {
      maxChunkTokensForEstimate = Math.floor(limits.input * 0.6);
    } else {
      maxChunkTokensForEstimate = Math.floor(limits.input * 0.6);
    }
    
    const estimatedChunks = estimatedTokens > limits.input * 0.9
      ? Math.ceil(estimatedTokens / maxChunkTokensForEstimate)
      : 1;

    console.log('📊 DIAGNÓSTICO DE PROCESSAMENTO:', {
      model,
      estimatedTokens,
      inputLimit: limits.input,
      outputLimit: limits.output,
      maxDocumentTokens: maxTokens,
      usedPercentage: ((estimatedTokens / limits.input) * 100).toFixed(1) + '%',
      usedPercentageOfMax: ((estimatedTokens / maxTokens) * 100).toFixed(1) + '%',
      willChunk: estimatedTokens > limits.input * 0.9, // OTIMIZADO: 90%
      estimatedChunks,
      tier: 'Tier 2',
      tpmLimit: model.includes('gpt-5') ? '1M TPM' : 'Variable',
      hasFiles: files?.length > 0,
      fileTypes: files?.map(f => f.type).join(', '),
      conversationHistorySize: conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    // OTIMIZAÇÃO 4: Validação de TPM estimado (Tier 2 = 1M TPM)
    if (estimatedChunks > 1) {
      const avgSecondsPerChunk = 8; // Tempo médio por chunk (conservador)
      const estimatedProcessingMinutes = (estimatedChunks * avgSecondsPerChunk) / 60;
      const estimatedTPM = (estimatedTokens + (estimatedChunks * limits.output)) / estimatedProcessingMinutes;
      
      console.log('⏱️ ESTIMATIVA DE PROCESSAMENTO:', {
        chunks: estimatedChunks,
        estimatedMinutes: estimatedProcessingMinutes.toFixed(2),
        estimatedTPM: Math.ceil(estimatedTPM).toLocaleString(),
        tier2Limit: '1,000,000 TPM',
        withinLimits: estimatedTPM < 1000000
      });

      // Aviso se exceder 2 minutos
      if (estimatedProcessingMinutes > 2) {
        console.warn('⚠️ Documento grande: processamento estimado em', estimatedProcessingMinutes.toFixed(1), 'minutos');
      }
      
      // Erro se exceder 5 minutos (risco de timeout ou rate limit)
      if (estimatedProcessingMinutes > 5) {
        console.error('❌ Documento muito grande para processar em tempo razoável');
        return new Response(JSON.stringify({ 
          error: `Documento muito grande: estimado ${estimatedProcessingMinutes.toFixed(1)} minutos de processamento (${estimatedChunks} chunks). Considere reduzir o tamanho ou usar um modelo mais rápido.`,
          estimatedMinutes: estimatedProcessingMinutes,
          estimatedChunks,
          model
        }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // If message is too large, split into chunks and process ALL chunks
    // Comparações podem usar 20% mais do limite
    const comparisonMultiplier = isComparison ? 1.2 : 1.0;
    
    if (estimatedTokens > limits.input * 0.9 * comparisonMultiplier) { // OTIMIZADO: 90% (era 60%)
      console.log('Message too large, processing in chunks...');
      
      // OTIMIZADO: Chunks muito maiores para máximo aproveitamento (70%/60% do contexto)
      let maxChunkTokens;
      if (model.includes('gpt-5')) {
        maxChunkTokens = Math.floor(limits.input * 0.7); // 280k chunks (era 200k)
      } else if (model.includes('gpt-4.1')) {
        maxChunkTokens = Math.floor(limits.input * 0.6); // 600k chunks (era 400k) 🚀
      } else {
        maxChunkTokens = Math.floor(limits.input * 0.6); // 120k+ chunks
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
        
        // Adicionar mensagem de sistema para contexto futuro
        processedMessages.push({
          role: 'system',
          content: `[CONTEXTO DO DOCUMENTO]
Arquivo(s): ${files?.map(f => f.name).join(', ') || 'Documento'}
Tamanho: ${estimatedTokens.toLocaleString()} tokens (${chunks.length} seções)
Pergunta original: ${message}

Este documento foi processado em múltiplas partes. Use este contexto para responder perguntas de follow-up.`
        });
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

    // Criar contexto de documento para follow-ups (se foi processado em chunks)
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
      
      console.log('📄 Contexto de documento criado para follow-ups:', {
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
  } catch (error) {
    console.error('Erro na função openai-chat:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});