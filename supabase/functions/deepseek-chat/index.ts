import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para dividir texto em chunks otimizados para DeepSeek
function chunkText(text: string, maxChunkSize: number = 120000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        // Sentença muito longa, dividir por caracteres
        for (let i = 0; i < sentence.length; i += maxChunkSize) {
          chunks.push(sentence.slice(i, i + maxChunkSize));
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

serve(async (req) => {
  console.log('🚀🚀🚀 DEEPSEEK-CHAT v5 - BUILD 20251209-0300 🚀🚀🚀');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message, model = 'deepseek-chat', files, streamReasoning = false } = body;

    // Determine actual API model and mode
    const isThinkingOnlyMode = model === 'deepseek-reasoner-thinking-only';
    const apiModel = isThinkingOnlyMode ? 'deepseek-reasoner' : model;
    const isReasonerModel = apiModel === 'deepseek-reasoner';
    
    // SEMPRE usar SSE para modelos reasoner - simplificado!
    const useSSE = isReasonerModel;

    console.log('==========================================');
    console.log('📌 Modelo recebido:', model);
    console.log('📌 API Model:', apiModel);
    console.log('📌 Is Reasoner Model:', isReasonerModel);
    console.log('📌 streamReasoning from body:', streamReasoning);
    console.log('🔥 USE SSE (forçado para reasoner):', useSSE);
    console.log('==========================================');

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY não configurada');
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
    let processedMessage = message;
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
        processedMessage = `${message}\n\n${fileContents.join('\n\n---\n\n')}`;
        console.log('📊 Message with files:', processedMessage.length, 'characters');
      }
    }
    let chunks: string[] = [];

    // Configurar chunk size baseado no modelo
    const maxChunkSize = apiModel === 'deepseek-reasoner' ? 100000 : 120000;

    // Se a mensagem for muito longa, usar chunking
    if (message.length > maxChunkSize) {
      console.log('Mensagem longa detectada, usando chunking...');
      chunks = chunkText(message, maxChunkSize);
      console.log(`Dividido em ${chunks.length} chunks`);

      // Para mensagens longas, usar resumo progressivo
      let summary = '';
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processando chunk ${i + 1}/${chunks.length}`);
        
        const chunkPrompt = i === 0 
          ? `Analise este documento (parte ${i + 1} de ${chunks.length}). Extraia os pontos principais:\n\n${chunks[i]}`
          : `Continue a análise do documento (parte ${i + 1} de ${chunks.length}). Pontos anteriores: ${summary}\n\nNova parte:\n${chunks[i]}`;

        const chunkResponse = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${deepseekApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'Você é um assistente especializado em análise de documentos. Seja conciso e objetivo.' },
              { role: 'user', content: chunkPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.7,
            stream: false
          }),
        });

        if (!chunkResponse.ok) {
          throw new Error(`Erro no chunk ${i + 1}: ${chunkResponse.statusText}`);
        }

        const chunkData = await chunkResponse.json();
        const chunkResult = chunkData.choices[0].message.content;
        summary += (summary ? '\n\n' : '') + chunkResult;
      }

      // Usar o resumo como mensagem final
      processedMessage = `Baseado na análise completa do documento:\n\n${summary}\n\nAgora responda de forma detalhada e completa.`;
    }

    // Fazer a requisição para DeepSeek API
    console.log('📡 Enviando requisição para DeepSeek API...');
    console.log('📡 Model:', apiModel);
    console.log('📡 Stream: true');
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          { 
            role: 'system', 
            content: apiModel === 'deepseek-reasoner' 
              ? 'Você é um assistente inteligente com capacidades de raciocínio avançado. Pense profundamente sobre cada pergunta antes de responder.' 
              : 'Você é um assistente inteligente e útil. Responda de forma clara e precisa.'
          },
          { role: 'user', content: processedMessage }
        ],
        max_tokens: 8000,
        temperature: apiModel === 'deepseek-reasoner' ? undefined : 0.7,
        stream: true
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Erro da API DeepSeek:', errorData);
      throw new Error(`Erro da API DeepSeek: ${response.status} - ${errorData}`);
    }

    // 🔥🔥🔥 BLOCO SSE - STREAMING REAL-TIME 🔥🔥🔥
    if (useSSE && response.body) {
      console.log('🔥🔥🔥 ENTRANDO NO BLOCO SSE - STREAMING REAL-TIME 🔥🔥🔥');
      
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let eventCount = 0;
      let totalReasoning = '';
      let totalContent = '';
      
      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          sseBuffer += text;
          
          // Processar linha por linha
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
            
            const data = trimmedLine.slice(6);
            if (data === '[DONE]') {
              console.log('🏁 [DONE] recebido - Total eventos:', eventCount);
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta) {
                const delta = parsed.choices[0].delta;
                eventCount++;
                
                // Processar reasoning_content (pensamento)
                if (delta.reasoning_content) {
                  totalReasoning += delta.reasoning_content;
                  const sseEvent = {
                    type: 'reasoning',
                    content: '',
                    reasoning: delta.reasoning_content
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`));
                  
                  if (eventCount <= 5 || eventCount % 50 === 0) {
                    console.log(`📤 SSE #${eventCount} reasoning: +${delta.reasoning_content.length} chars`);
                  }
                }
                
                // Processar content (resposta final)
                if (delta.content) {
                  totalContent += delta.content;
                  const sseEvent = {
                    type: 'content',
                    content: delta.content,
                    reasoning: ''
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`));
                  
                  if (eventCount <= 5 || eventCount % 50 === 0) {
                    console.log(`📤 SSE #${eventCount} content: +${delta.content.length} chars`);
                  }
                }
              }
            } catch (e) {
              // JSON incompleto, vai pro buffer
              sseBuffer = trimmedLine + '\n' + sseBuffer;
            }
          }
        },
        async flush(controller) {
          // Processar buffer restante
          if (sseBuffer.trim()) {
            const trimmedBuffer = sseBuffer.trim();
            if (trimmedBuffer.startsWith('data: ') && trimmedBuffer.slice(6) !== '[DONE]') {
              try {
                const parsed = JSON.parse(trimmedBuffer.slice(6));
                if (parsed.choices?.[0]?.delta) {
                  const delta = parsed.choices[0].delta;
                  if (delta.reasoning_content) {
                    totalReasoning += delta.reasoning_content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reasoning', content: '', reasoning: delta.reasoning_content })}\n\n`));
                  }
                  if (delta.content) {
                    totalContent += delta.content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: delta.content, reasoning: '' })}\n\n`));
                  }
                }
              } catch (e) {
                console.log('⚠️ Erro no flush do buffer');
              }
            }
          }
          console.log('📊 Stream completo:');
          console.log('   - Total eventos SSE:', eventCount);
          console.log('   - Reasoning total:', totalReasoning.length, 'chars');
          console.log('   - Content total:', totalContent.length, 'chars');
        }
      });
      
      const readableStream = response.body.pipeThrough(transformStream);
      
      console.log('📤 Retornando stream SSE para cliente...');
      return new Response(readableStream, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
      });
    }

    // 📦 Fallback para JSON (modelos não-reasoner)
    console.log('📦 Usando fallback JSON (não-reasoner)...');
    
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let reasoningContent = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
            
            const data = trimmedLine.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta) {
                const delta = parsed.choices[0].delta;
                if (delta.content) fullResponse += delta.content;
                if (delta.reasoning_content) reasoningContent += delta.reasoning_content;
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      let finalResponse = fullResponse;
      if (isThinkingOnlyMode && reasoningContent) {
        finalResponse = `## 🧠 Processo de Raciocínio\n\n${reasoningContent}`;
      } else if (!fullResponse && reasoningContent) {
        finalResponse = reasoningContent;
      }
      
      finalResponse = finalResponse.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      return new Response(JSON.stringify({ 
        response: finalResponse,
        reasoning: reasoningContent || null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback final
    const data = await response.json();
    let responseText = data.choices[0].message.content;
    responseText = responseText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in deepseek-chat:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro interno do servidor',
      response: null 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
