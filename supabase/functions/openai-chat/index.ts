import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de IDs de modelos para nomes oficiais da OpenAI API
const mapModelToOpenAI = (model: string): string => {
  const modelMap: Record<string, string> = {
    'gpt-5.1': 'gpt-5',
    'gpt-5-mini': 'gpt-5-mini',
    'gpt-5-nano': 'gpt-5-nano',
    'gpt-4.1': 'gpt-4.1',
    'gpt-4.1-mini': 'gpt-4.1-mini',
    'gpt-4.1-nano': 'gpt-4.1-nano',
    'o4-mini': 'o4-mini',
    'o3': 'o3',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4o': 'gpt-4o',
  };
  
  const mapped = modelMap[model] || model;
  console.log(`🔄 Model mapping: ${model} → ${mapped}`);
  return mapped;
};

// Função auxiliar para estimar tokens
const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

// ✅ TIER-2-MAXOUT: Limites de output por modelo (max_completion_tokens)
const getModelOutputLimits = (model: string): number => {
  // GPT-5 family - máximo output de 128k
  if (model.includes('gpt-5') && !model.includes('mini') && !model.includes('nano')) return 128000;
  
  // GPT-5 Mini - máximo output de 32k
  if (model.includes('gpt-5-mini')) return 32768;
  
  // GPT-5 Nano - máximo output de 16k
  if (model.includes('gpt-5-nano')) return 16384;
  
  // GPT-4.1 family - máximo output de 32k
  if (model.includes('gpt-4.1')) return 32768;
  
  // o3 e o4-mini - máximo output de 100k
  if (model.includes('o3') || model.includes('o4-mini')) return 100000;
  
  // GPT-4o family (legacy) - máximo output de 16k
  if (model.includes('gpt-4o')) return 16384;
  
  return 16384; // Default fallback
};

// ✅ TIER-2-MAXOUT: Limites de input/context por modelo
const getModelInputLimits = (model: string): number => {
  if (model.includes('gpt-5') && !model.includes('mini') && !model.includes('nano')) return 400000;
  if (model.includes('gpt-5-mini')) return 200000;
  if (model.includes('gpt-5-nano')) return 100000;
  if (model.includes('gpt-4.1')) return 1047576; // 1M+ tokens!
  if (model.includes('o3') || model.includes('o4-mini')) return 200000;
  if (model.includes('gpt-4o')) return 128000;
  return 128000;
};

// ✅ TIER-2-MAXOUT: Threshold dinâmico baseado no contexto do modelo
const getMapReduceThreshold = (model: string): number => {
  // GPT-4.1 tem contexto de 1M tokens - threshold altíssimo
  if (model.includes('gpt-4.1')) return 500000;
  
  // GPT-5 tem contexto de 400k - threshold alto
  if (model.includes('gpt-5') && !model.includes('mini') && !model.includes('nano')) return 200000;
  
  // GPT-5 Mini/o3/o4-mini - contexto de 200k
  if (model.includes('gpt-5-mini') || model.includes('o3') || model.includes('o4')) return 100000;
  
  // GPT-4o family
  if (model.includes('gpt-4o')) return 60000;
  
  return 50000;
};

// ✅ TIER-2-MAXOUT: Chunk size dinâmico baseado no modelo
const getChunkSize = (model: string): number => {
  if (model.includes('gpt-4.1')) return 200000; // Chunks enormes para 1M context
  if (model.includes('gpt-5') && !model.includes('mini') && !model.includes('nano')) return 100000;
  if (model.includes('gpt-5-mini') || model.includes('o3') || model.includes('o4')) return 50000;
  return 20000;
};

// ✅ TIER-2-MAXOUT: Função para dividir texto em chunks inteligentes com tamanho dinâmico
const chunkText = (text: string, model: string): string[] => {
  const maxChunkTokens = getChunkSize(model);
  const estimatedTokens = estimateTokens(text);
  const numChunks = Math.ceil(estimatedTokens / maxChunkTokens);
  
  if (numChunks <= 1) return [text];
  
  const chunkSize = Math.ceil(text.length / numChunks);
  const chunks: string[] = [];
  
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
  }
  
  console.log(`📚 TIER-2-MAXOUT: Divided into ${chunks.length} chunks (${maxChunkTokens} tokens each, model: ${model})`);
  return chunks;
};

// Função para processar um chunk individual
const processChunk = async (
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  model: string,
  openAIApiKey: string,
  retries = 1
): Promise<string> => {
  console.log(`🔍 Processing chunk ${chunkIndex + 1}/${totalChunks}...`);
  
  const isNewerModel = model.includes("gpt-5") || model.includes("gpt-4.1") || model.includes("o3") || model.includes("o4");
  const apiModel = mapModelToOpenAI(model);
  
  const maxOutputLimit = getModelOutputLimits(model);
  const chunkOutputTokens = Math.min(maxOutputLimit, Math.floor(maxOutputLimit * 0.5)); // 50% do limite para chunks
  
  const requestBody: any = {
    model: apiModel,
    messages: [
      {
        role: "system",
        content: "Você é um assistente especializado em análise profunda de documentos. Extraia insights detalhados, padrões, dados-chave e conclusões relevantes."
      },
      {
        role: "user",
        content: `Analise esta parte (${chunkIndex + 1} de ${totalChunks}) do documento completo. Seja extremamente detalhado e profundo:\n\n${chunk}`
      }
    ],
    stream: false,
  };

  if (!isNewerModel) {
    requestBody.max_tokens = chunkOutputTokens;
    requestBody.temperature = 0.7;
  } else {
    requestBody.max_completion_tokens = chunkOutputTokens;
  }
  
  console.log(`📝 TIER-2-MAXOUT chunk ${chunkIndex + 1}: max_completion_tokens=${chunkOutputTokens} (limit: ${maxOutputLimit})`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 429 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏱️ Rate limit hit, waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} processed (${estimateTokens(content)} tokens)`);
      return content;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`⚠️ Retry ${attempt + 1}/${retries} for chunk ${chunkIndex + 1}`);
    }
  }
  
  throw new Error(`Failed to process chunk ${chunkIndex + 1} after ${retries} retries`);
};

// Função para consolidar respostas e fazer streaming
const consolidateResponses = async (
  chunkResponses: string[],
  originalMessage: string,
  model: string,
  openAIApiKey: string
): Promise<ReadableStream> => {
  console.log(`🧠 Consolidating ${chunkResponses.length} chunk responses...`);
  
  const consolidationPrompt = `Você analisou um documento longo dividido em ${chunkResponses.length} partes. Aqui estão as análises de cada parte:

${chunkResponses.map((resp, i) => `\n[PARTE ${i + 1}/${chunkResponses.length}]\n${resp}\n`).join('\n---\n')}

Agora, crie uma resposta FINAL consolidada e profunda (12.000-16.000 palavras, aproximadamente 16 páginas) que:
- Resume os pontos mais importantes de TODAS as partes
- Identifica padrões e conexões entre as diferentes seções
- Fornece insights profundos e análise crítica
- Organiza a informação de forma lógica e bem estruturada
- Inclui exemplos e citações específicas do documento
- Mantenha o formato em Markdown com títulos, subtítulos e listas

Pergunta/contexto original do usuário: ${originalMessage}`;

  const isNewerModel = model.includes("gpt-5") || model.includes("gpt-4.1") || model.includes("o3") || model.includes("o4");
  const apiModel = mapModelToOpenAI(model);
  
  const maxOutputLimit = getModelOutputLimits(model);
  const consolidationOutputTokens = Math.min(maxOutputLimit, Math.floor(maxOutputLimit * 0.8)); // 80% do limite para consolidação final
  
  const requestBody: any = {
    model: apiModel,
    messages: [
      {
        role: "system",
        content: "Você é um assistente especializado em criar análises consolidadas extremamente detalhadas e profundas de documentos. Suas respostas devem ser extensas, bem estruturadas e ricas em insights."
      },
      {
        role: "user",
        content: consolidationPrompt
      }
    ],
    stream: true,
  };

  if (!isNewerModel) {
    requestBody.max_tokens = consolidationOutputTokens;
    requestBody.temperature = 0.7;
  } else {
    requestBody.max_completion_tokens = consolidationOutputTokens;
  }
  
  console.log(`📝 TIER-2-MAXOUT consolidation: max_completion_tokens=${consolidationOutputTokens} (limit: ${maxOutputLimit})`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Consolidation failed: ${response.status}`);
  }

  return response.body!;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, model = "gpt-5-mini", files = [], conversationHistory = [] } = await req.json();
    
    console.log(`🔄 Request for model: ${model}, History length: ${conversationHistory.length}`);

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    // Estimar tokens da mensagem
    const estimatedTokens = estimateTokens(message);
    console.log(`📊 Token estimation: ${estimatedTokens} tokens for model ${model}`);
    console.log(`🔍 Document size: ${estimatedTokens} tokens (${Math.ceil(estimatedTokens / 400)} páginas aprox.)`);

    // ✅ TIER-2-MAXOUT-PLUS: Threshold dinâmico baseado no modelo
    const threshold = getMapReduceThreshold(model);
    const needsMapReduce = estimatedTokens > threshold;
    console.log(`📊 Map-Reduce ${needsMapReduce ? 'ATIVADO ✅' : 'DESATIVADO ❌'} (threshold: ${threshold} tokens, modelo: ${model})`);

    if (needsMapReduce) {
      console.log(`🗂️ Large document detected (${estimatedTokens} tokens) - using Map-Reduce approach`);
      
      try {
        // MAP PHASE: Dividir em chunks e processar cada um
        const chunks = chunkText(message, model); // ✅ TIER-2-MAXOUT: Chunk size dinâmico baseado no modelo
        console.log(`📚 TIER-2-MAXOUT: Processing ${chunks.length} chunks in parallel...`);
        
        const chunkPromises = chunks.map((chunk, i) => 
          processChunk(chunk, i, chunks.length, model, openAIApiKey, 1)
        );
        
        const chunkResponses = await Promise.all(chunkPromises);
        console.log(`✅ All ${chunks.length} chunks processed successfully`);
        
        // REDUCE PHASE: Consolidar respostas e fazer streaming
        const consolidatedStream = await consolidateResponses(
          chunkResponses,
          conversationHistory.length > 0 
            ? conversationHistory[conversationHistory.length - 1].content 
            : "Analise este documento",
          model,
          openAIApiKey
        );
        
        console.log("🧠 Streaming consolidated response...");
        
        return new Response(consolidatedStream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } catch (error: any) {
        console.error("❌ Map-Reduce error:", error);
        return new Response(
          JSON.stringify({ error: `Map-Reduce processing failed: ${error.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // STREAMING DIRETO para documentos menores
    console.log("📝 Document size OK - using direct streaming");
    
    // ✅ PROMPT CACHING: OpenAI automaticamente cacheia prompts com 1024+ tokens
    // Estratégia: System prompt primeiro + histórico completo para maximizar cache hits
    const messages: any[] = [
      {
        role: "system",
        content: "Você é um assistente útil e preciso. Responda de forma clara e organizada. " +
                 "Analise cuidadosamente as mensagens anteriores para manter contexto e coerência nas respostas."
      },
    ];

    // ✅ CACHE OPTIMIZATION: Adicionar TODO o histórico antes da mensagem atual
    // Isso permite que a OpenAI cacheia o contexto completo da conversa
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
      console.log(`💾 Cache-eligible context: ${conversationHistory.length} messages in history`);
    }

    // Processar arquivos (imagens para visão)
    if (files && files.length > 0) {
      const imageFiles = files.filter((f: any) => f.type?.startsWith("image/"));
      
      if (imageFiles.length > 0) {
        // Modelo com visão - formato especial
        const content: any[] = [{ type: "text", text: message }];
        
        imageFiles.forEach((file: any) => {
          if (file.imageData) {
            content.push({
              type: "image_url",
              image_url: {
                url: file.imageData,
              },
            });
          }
        });

        messages.push({
          role: "user",
          content,
        });
      } else {
        // Sem imagens - mensagem de texto simples
        messages.push({
          role: "user",
          content: message,
        });
      }
    } else {
      messages.push({
        role: "user",
        content: message,
      });
    }

    const apiModel = mapModelToOpenAI(model);
    console.log(`🚀 Sending request to OpenAI with model: ${apiModel}`);

    // Determinar parâmetros baseado no modelo
    const isNewerModel = model.includes("gpt-5") || model.includes("gpt-4.1") || model.includes("o3") || model.includes("o4");
    
    const requestBody: any = {
      model: apiModel,
      messages,
      stream: true,
    };

    // ✅ TIER-2-MAXOUT: Output dinâmico inteligente baseado no modelo e input
    const maxOutputLimit = getModelOutputLimits(model);
    const maxInputLimit = getModelInputLimits(model);
    
    const maxOutputTokens = Math.min(
      maxOutputLimit,
      Math.max(
        Math.floor(maxOutputLimit * 0.5), // Mínimo 50% do limite do modelo
        maxOutputLimit - Math.floor(estimatedTokens * 0.1) // Reserva 10% para safety margin
      )
    );
    
    console.log(`💡 TIER-2-MAXOUT: Dynamic output=${maxOutputTokens} (limit: ${maxOutputLimit}, input: ${estimatedTokens}, context: ${maxInputLimit})`);

    // Apenas modelos antigos suportam max_tokens e temperature
    if (!isNewerModel) {
      requestBody.max_tokens = maxOutputTokens;
      requestBody.temperature = 0.7;
    } else {
      // Modelos novos usam max_completion_tokens
      requestBody.max_completion_tokens = maxOutputTokens;
    }
    
    console.log(`📝 Direct streaming config: max_completion_tokens=${requestBody.max_completion_tokens || requestBody.max_tokens}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI API error:", response.status, errorText);
      
      // Log cache-related errors if present
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.type === 'invalid_request_error' && errorData.error?.message?.includes('cache')) {
          console.error("⚠️ Cache-related error detected:", errorData.error.message);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Insufficient credits. Please add funds to your OpenAI account." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    console.log("✅ Streaming response from OpenAI");
    
    // 💾 CACHE MONITORING: Log usage headers if available
    const cacheHeader = response.headers.get('openai-cache-status');
    if (cacheHeader) {
      console.log(`💾 Cache Status: ${cacheHeader}`);
    }

    // Retornar stream SSE diretamente
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("❌ Error in openai-chat:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
