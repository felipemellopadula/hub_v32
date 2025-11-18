import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função auxiliar para estimar tokens
const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

// ✅ TIER-2-MAXOUT-PLUS: Threshold dinâmico baseado no modelo
const getMapReduceThreshold = (model: string): number => {
  if (model.includes('gpt-4o')) return 20000; // ~50 páginas para modelos com contexto maior
  if (model.includes('gpt-4')) return 15000;  // ~40 páginas (padrão)
  return 10000; // ~25 páginas para modelos menores
};

// Função para dividir texto em chunks inteligentes
const chunkText = (text: string, maxChunkTokens: number): string[] => {
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
  
  console.log(`📚 Divided into ${chunks.length} chunks (avg ${Math.ceil(estimateTokens(chunks[0]))} tokens each)`);
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
  
  const requestBody: any = {
    model,
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
    requestBody.max_tokens = 16384; // ✅ TIER 2: Máximo output para chunks Map-Reduce
    requestBody.temperature = 0.7;
  } else {
    requestBody.max_completion_tokens = 16384; // ✅ TIER 2: Máximo output para chunks Map-Reduce
  }
  
  console.log(`📝 Output config for chunk ${chunkIndex + 1}: max_completion_tokens=${requestBody.max_completion_tokens || requestBody.max_tokens}`);

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
  
  const requestBody: any = {
    model,
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
    requestBody.max_tokens = 16384;
    requestBody.temperature = 0.7;
  } else {
    requestBody.max_completion_tokens = 16384;
  }

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
    const { message, model = "gpt-5-mini-2025-08-07", files = [], conversationHistory = [], hasLargeDocument = false } = await req.json();

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
    const needsMapReduce = hasLargeDocument && estimatedTokens > threshold;
    
    console.log(`📊 Map-Reduce Decision:`);
    console.log(`  - Estimated tokens: ${estimatedTokens}`);
    console.log(`  - Threshold: ${threshold}`);
    console.log(`  - Has large document: ${hasLargeDocument}`);
    console.log(`  - Result: ${needsMapReduce ? 'ATIVADO ✅' : 'DESATIVADO ❌'}`);

    if (needsMapReduce) {
      console.log(`🗂️ Large document detected (${estimatedTokens} tokens) - using Map-Reduce approach`);
      
      try {
        // MAP PHASE: Dividir em chunks e processar cada um
        const chunks = chunkText(message, 20000); // ✅ TIER 2: ~20k tokens por chunk (~50 páginas)
        console.log(`📚 Processing ${chunks.length} chunks in parallel...`);
        
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
    
    // Preparar mensagens para OpenAI
    const messages: any[] = [
      {
        role: "system",
        content: "Você é um assistente útil e preciso. Responda de forma clara e organizada.",
      },
    ];

    // Adicionar histórico de conversa
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
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

    console.log(`🚀 Sending request to OpenAI with model: ${model}`);

    // Determinar parâmetros baseado no modelo
    const isNewerModel = model.includes("gpt-5") || model.includes("gpt-4.1") || model.includes("o3") || model.includes("o4");
    
    const requestBody: any = {
      model,
      messages,
      stream: true,
    };

    // ✅ TIER-2-MAXOUT-PLUS: Output dinâmico baseado no tamanho do input
    const maxOutputTokens = Math.min(
      16384, // Máximo absoluto (Tier 2)
      Math.max(
        8000,  // Mínimo garantido
        16384 - Math.floor(estimatedTokens * 1.2) // Margem de segurança para evitar overflow
      )
    );
    
    console.log(`💡 Dynamic output: ${maxOutputTokens} tokens (input: ${estimatedTokens} tokens, ratio: ${(maxOutputTokens/estimatedTokens).toFixed(1)}x)`);

    // Apenas modelos antigos suportam max_tokens e temperature
    if (!isNewerModel) {
      requestBody.max_tokens = maxOutputTokens;
      requestBody.temperature = 0.7;
    } else {
      // Modelos novos usam max_completion_tokens
      requestBody.max_completion_tokens = maxOutputTokens;
    }
    
    console.log(`📝 Direct streaming output config: max_completion_tokens=${requestBody.max_completion_tokens || requestBody.max_tokens}`);

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
