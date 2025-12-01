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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, model = 'gemini-2.0-flash-exp', files, conversationHistory = [], contextEnabled = false } = await req.json();
    
    // Map frontend model names to correct Gemini API model names
    const modelMapping: Record<string, string> = {
      'gemini-3-pro': 'gemini-3-pro-preview',
      'gemini-2.5-pro': 'gemini-2.0-flash-exp',
      'gemini-2.5-flash': 'gemini-2.0-flash-exp', 
      'gemini-2.5-flash-lite': 'gemini-2.0-flash-exp'
    };
    
    const actualModel = modelMapping[model] || model;
    
    console.log('Gemini Chat - Request received:', {
      model,
      messageLength: message?.length || 0,
      messagePreview: message?.substring(0, 200) + '...',
      hasMessage: !!message,
      contextEnabled,
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
    const limits = actualModel.includes('gemini-3-pro') 
      ? { input: 1048576, output: 65536 }  // Gemini 3 Pro: 1M in, 65K out
      : actualModel.includes('gemini-2.5')
      ? { input: 1048576, output: 65536 }  // Gemini 2.5: 1M in, 65K out
      : { input: 1000000, output: 8192 };  // Gemini 2.0 Flash default
    const estimatedTokens = estimateTokenCount(finalMessage);
    const mapReduceThreshold = getMapReduceThreshold(actualModel);
    
    console.log('🎯 CAPACIDADES DO MODELO:', {
      modelo: actualModel,
      inputMaximo: '1.048.576 tokens (1.400 páginas)',
      inputAtual: `${estimatedTokens} tokens (${Math.ceil(estimatedTokens/714)} páginas)`,
      outputMaximo: '8.192 tokens (12 páginas)',
      thresholdMapReduce: `${mapReduceThreshold} tokens (${Math.ceil(mapReduceThreshold/714)} páginas)`,
      usaraMapReduce: estimatedTokens > mapReduceThreshold,
      margemSeguranca: `${((1048576 - estimatedTokens) / 1048576 * 100).toFixed(1)}% disponível`
    });
    
    console.log('📊 Token estimation:', { 
      estimatedTokens, 
      inputLimit: limits.input, 
      model,
      messageLength: finalMessage.length,
      hasFiles: files && files.length > 0
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
      
      console.log('✅ Validação de tamanho:', 
        files.map((f: any) => `${f.name}: ${(new Blob([f.pdfContent || f.wordContent || '']).size / (1024 * 1024)).toFixed(1)}MB`)
      );
    }

    // Check absolute maximum limit
    const MAX_DOCUMENT_TOKENS = 950000; // ~1.330 páginas (90% de 1M tokens)
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

    // Detailed diagnostic logging
    console.log('📊 DIAGNÓSTICO DE PROCESSAMENTO:', {
      caracteres: finalMessage.length,
      tokens: estimatedTokens,
      limiteTotal: limits.input, // 1M
      limiteMaximoSeguro: MAX_DOCUMENT_TOKENS, // 950k
      percentualUsado: `${((estimatedTokens / limits.input) * 100).toFixed(1)}%`,
      percentualMaximoSeguro: `${((estimatedTokens / MAX_DOCUMENT_TOKENS) * 100).toFixed(1)}%`,
      usaraMapReduce: estimatedTokens > mapReduceThreshold,
      chunks: estimatedTokens > mapReduceThreshold ? Math.ceil(estimatedTokens / 250000) : 1,
      arquivos: files?.map((f: any) => f.name).join(', ') || 'nenhum',
      tamanhosArquivos: files?.map((f: any) => 
        `${f.name}: ${(new Blob([f.pdfContent || f.wordContent || '']).size / (1024 * 1024)).toFixed(1)}MB`
      ) || []
    });

    // Build contents array with conversation history if context is enabled
    let contents = [];
    let chunkResponses: string[] = [];
    let cachedTokens = 0;
    
    // If document is large, process in chunks with Map-Reduce
    if (estimatedTokens > mapReduceThreshold) {
      console.log('📄 Large document detected, processing in chunks...');
      const chunks = splitIntoChunks(finalMessage, Math.floor(limits.input * 0.25)); // 250k tokens per chunk
      
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
      console.log('🔄 Consolidating', chunkResponses.length, 'chunk responses...');
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
          // Large document: preserve only document context
          const documentContextMessages = conversationHistory.filter((msg: any) => 
            msg.content?.includes('[CONTEXTO DO DOCUMENTO]')
          );
          
          if (documentContextMessages.length > 0) {
            const lastDocContext = documentContextMessages[documentContextMessages.length - 1];
            contents.push({
              role: 'user',
              parts: [{ text: lastDocContext.content }]
            });
            console.log('📚 Previous document context preserved');
          }
        } else {
          // Small document: normal history with caching support
          console.log('Building conversation context with', conversationHistory.length, 'previous messages');
          
          const recentHistory = conversationHistory.slice(-3);
          recentHistory.forEach((historyMsg: any, index: number) => {
            const role = historyMsg.role === 'assistant' ? 'model' : 'user';
            const messageContent = historyMsg.content;
            
            // Track tokens for caching (last message in history gets cached)
            if (index === recentHistory.length - 1 && role === 'user') {
              cachedTokens = estimateTokenCount(messageContent);
              console.log('🔄 Cache enabled for conversation history:', cachedTokens, 'tokens');
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
    console.log('Original model requested:', model, '-> Mapped to:', actualModel);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: Math.min(Math.floor(limits.output * 0.8), limits.output),
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error(`Erro da API Gemini: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar resposta';
    
    // Normalize line breaks to standard \n
    generatedText = generatedText
      .replace(/\r\n/g, '\n')  // Normalize CRLF to LF
      .replace(/\r/g, '\n');   // Convert any remaining CR to LF

    console.log('Gemini response received successfully');

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
          
          // Apply 75% discount on cached tokens (similar to Grok)
          // Cached tokens cost only 25% of normal price
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
            totalTokens,
            savedTokens: cachedTokens > 0 ? Math.ceil(cachedTokens * 0.75) : 0,
            messageLength: message?.length || 0,
            responseLength: generatedText.length
          });

          // Save token usage to database with real data
          const { error: tokenError } = await supabase
            .from('token_usage')
            .insert({
              user_id: userId,
              model_name: actualModel,
              tokens_used: totalTokens, // Keep for compatibility
              input_tokens: effectiveInputTokens, // Effective input tokens with cache discount
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

    // Create document context for follow-ups (if processed in chunks)
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
      
      console.log('📄 Document context created for follow-ups:', {
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
    console.error('Erro na função gemini-chat:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});