import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  model: string;
  files?: Array<{
    name: string;
    type: string;
    data: string; // base64
    pdfContent?: string; // extracted PDF text
  }>;
}

const getApiKey = (model: string): string | null => {
  if (model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o4')) {
    return Deno.env.get('OPENAI_API_KEY');
  }
  if (model.includes('claude')) {
    return Deno.env.get('ANTHROPIC_API_KEY');
  }
  if (model.includes('gemini')) {
    return Deno.env.get('GOOGLE_API_KEY');
  }
  if (model.includes('grok')) {
    return Deno.env.get('XAI_API_KEY');
  }
  if (model.includes('deepseek')) {
    return Deno.env.get('DEEPSEEK_API_KEY');
  }
  if (model.includes('Llama-4')) {
    return Deno.env.get('APILLM_API_KEY');
  }
  return null;
};

const performWebSearch = async (query: string): Promise<string | null> => {
  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const response = await fetch(searchUrl)
    
    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`)
    }

    const data = await response.json()
    const results = []
    
    if (data.Abstract) {
      results.push(`${data.Heading || 'Informação'}: ${data.Abstract}`)
    }

    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      for (let i = 0; i < Math.min(data.RelatedTopics.length, 3); i++) {
        const topic = data.RelatedTopics[i]
        if (topic.Text) {
          results.push(topic.Text)
        }
      }
    }

    return results.length > 0 ? results.join('\n\n') : null
  } catch (error) {
    console.error('Web search error:', error)
    return null
  }
}

const callOpenAI = async (message: string, model: string, files?: Array<{name: string; type: string; data: string; pdfContent?: string}>): Promise<ReadableStream> => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  
  console.log('=== OPENAI DEBUG ===');
  console.log('Model requested:', model);
  console.log('Files count:', files?.length || 0);
  if (files && files.length > 0) {
    files.forEach((file, index) => {
      console.log(`File ${index}: ${file.name}, type: ${file.type}, has pdfContent: ${!!file.pdfContent}`);
    });
  }
  
  // Verificar se precisa de busca na web
  const searchCheckResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Use gpt-4o-mini for search check
      messages: [
        {
          role: 'system',
          content: 'Você determina se uma pergunta precisa de informações atualizadas da web. Responda apenas "SIM" se a pergunta requer informações recentes, atuais, notícias, preços, eventos, dados em tempo real. Responda "NÃO" para perguntas gerais, conceitos, explicações, programação, matemática, história estabelecida.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 10,
      temperature: 0,
    }),
  });

  let finalMessage = message
  
  if (searchCheckResponse.ok) {
    const searchCheckData = await searchCheckResponse.json()
    const needsSearch = searchCheckData.choices[0].message.content.trim().toUpperCase() === 'SIM'
    
    if (needsSearch) {
      console.log('Performing web search for:', message)
      const searchResults = await performWebSearch(message)
      
      if (searchResults) {
        finalMessage = `${message}\n\n[Informações da web encontradas]:\n${searchResults}`
      }
    }
  }
  
  // Define max tokens based on model - use conservative limits
  let maxTokens = 4096; // Safe default for all models
  if (model.includes('gpt-4o')) {
    maxTokens = 4096; // Conservative limit for GPT-4o
  } else if (model.includes('gpt-4.1')) {
    maxTokens = 16384; // GPT-4.1 series max output
  } else if (model.includes('o4-mini')) {
    maxTokens = 65536; // o4 mini max output
  }

  // Add reasoning support for o4 models
  const hasReasoning = model.includes('o4');
  
  // Prepare messages with file support
  const messages = [
    {
      role: 'system',
      content: 'Você é um assistente útil em português. Se receber informações da web, use-as para dar uma resposta mais completa e atual. Sempre responda em português. Se receber arquivos, analise-os completamente e forneça informações detalhadas sobre seu conteúdo.'
    }
  ];

  // Handle files for vision models
  if (files && files.length > 0) {
    const userMessage: any = {
      role: 'user',
      content: []
    };
    
    // Add text content
    if (finalMessage.trim()) {
      userMessage.content.push({
        type: 'text',
        text: finalMessage
      });
    }
    
    // Add files
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        userMessage.content.push({
          type: 'image_url',
          image_url: {
            url: file.data
          }
        });
      } else if (file.type.includes('pdf') && file.pdfContent) {
        // Use extracted PDF content
        userMessage.content.push({
          type: 'text',
          text: `[Conteúdo do PDF: ${file.name}]\n\n${file.pdfContent}`
        });
      } else if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) {
        // Fallback for files without extracted content
        userMessage.content.push({
          type: 'text',
          text: `[Arquivo anexado: ${file.name}]\nNota: Análise de documentos PDF/Word ainda não implementada. Por favor, converta para imagem ou texto.`
        });
      }
    }
    
    messages.push(userMessage);
  } else {
    messages.push({
      role: 'user',
      content: finalMessage
    });
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream: true, // Enable streaming
      // Remove o4 specific parameters for now as they may cause API errors
      // Remove temperature for newer models to avoid API errors
      ...(model.includes('gpt-5') || model.includes('o4') ? {} : { temperature: 0.7 }),
    }),
  });

  console.log('OpenAI request sent for model:', model);
  console.log('Response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', response.status, '-', error);
    throw new Error(`OpenAI API error: ${error}`);
  }

  console.log('OpenAI response received successfully');
  return response.body!;
};

const callAnthropic = async (message: string, model: string, files?: Array<{name: string; type: string; data: string; pdfContent?: string}>): Promise<string> => {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  // Claude models have 200k context window and can output up to 8192 tokens max
  const maxTokens = 8192;
  
  // Prepare content with file support
  let content: any = message;
  
  if (files && files.length > 0) {
    content = [];
    
    // Add text content
    if (message.trim()) {
      content.push({
        type: 'text',
        text: message
      });
    }
    
    // Add files
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const base64Data = file.data.split(',')[1]; // Remove data:image/...;base64, prefix
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.type,
            data: base64Data
          }
        });
      } else if (file.type.includes('pdf') && file.pdfContent) {
        // Use extracted PDF content
        content.push({
          type: 'text',
          text: `[Conteúdo do PDF: ${file.name}]\n\n${file.pdfContent}`
        });
      } else if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) {
        content.push({
          type: 'text',
          text: `[Arquivo anexado: ${file.name}]\nNota: Análise de documentos PDF/Word ainda não implementada diretamente. Por favor, converta para imagem ou texto.`
        });
      }
    }
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Anthropic API error: ${response.status} - ${error}`);
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
};

const callGoogleAI = async (message: string, model: string, files?: Array<{name: string; type: string; data: string; pdfContent?: string}>): Promise<string> => {
  console.log('=== GOOGLE AI DEBUG ===');
  console.log('Model requested:', model);
  console.log('Files count:', files?.length || 0);
  if (files) {
    files.forEach((file, index) => {
      console.log(`File ${index}: ${file.name}, type: ${file.type}, has pdfContent: ${!!file.pdfContent}`);
      if (file.pdfContent) {
        console.log(`PDF content length: ${file.pdfContent.length}`);
      }
    });
  }
  
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  console.log('Google API key exists:', !!apiKey);
  
  // Gemini models have up to 2M context window and up to 8192 output tokens
  const maxOutputTokens = 8192;
  
  // Prepare parts with file support
  const parts: any[] = [];
  
  // Add text content
  if (message.trim()) {
    parts.push({ text: message });
  }
  
  // Add files
  if (files && files.length > 0) {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const base64Data = file.data.split(',')[1]; // Remove data:image/...;base64, prefix
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: base64Data
          }
        });
      } else if (file.type.includes('pdf') && file.pdfContent) {
        // Use extracted PDF content
        parts.push({
          text: `[Conteúdo do PDF: ${file.name}]\n\n${file.pdfContent}`
        });
      } else if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) {
        parts.push({
          text: `[Arquivo anexado: ${file.name}]\nNota: Análise de documentos PDF/Word ainda não implementada diretamente. Por favor, converta para imagem ou texto.`
        });
      }
    }
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts
      }],
      generationConfig: {
        maxOutputTokens: maxOutputTokens,
        temperature: 0.7
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Google AI API error: ${response.status} - ${error}`);
    throw new Error(`Google AI API error: ${error}`);
  }

  const data = await response.json();
  console.log('Google AI response received:', !!data.candidates);
  return data.candidates[0].content.parts[0].text;
};

const callXAI = async (message: string, model: string, files?: Array<{name: string; type: string; data: string; pdfContent?: string}>): Promise<string> => {
  const apiKey = Deno.env.get('XAI_API_KEY');
  
  console.log('=== XAI/GROK DEBUG ===');
  console.log('Model requested:', model);
  console.log('API Key exists:', !!apiKey);
  console.log('API Key first 10 chars:', apiKey?.substring(0, 10) || 'none');
  
  if (!apiKey) {
    throw new Error('XAI API key not found');
  }
  
  // Grok models have up to 128k context and can output up to 4096 tokens
  const maxTokens = 4096;
  
  // Prepare content with file support
  let finalMessage = message;
  
  if (files && files.length > 0) {
    console.log('Processing files for XAI:', files.length);
    const fileContents = [];
    
    for (const file of files) {
      if (file.type.includes('pdf') && file.pdfContent) {
        fileContents.push(`[Conteúdo do PDF: ${file.name}]\n\n${file.pdfContent}`);
      } else if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) {
        fileContents.push(`[Arquivo anexado: ${file.name}]\nNota: Por favor, extraia o texto do documento e envie novamente.`);
      } else if (file.type.startsWith('image/')) {
        fileContents.push(`[Imagem anexada: ${file.name}]\nNota: Grok ainda não suporta análise de imagens.`);
      }
    }
    
    if (fileContents.length > 0) {
      finalMessage = `${message}\n\n${fileContents.join('\n\n')}`;
    }
  }
  
  const requestBody = {
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente útil em português. Sempre responda em português. Se receber conteúdo de PDFs, analise-os completamente e forneça informações detalhadas.'
      },
      {
        role: 'user', 
        content: finalMessage
      }
    ],
    model,
    stream: false,
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('XAI API error response:', errorText);
      throw new Error(`xAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('XAI response data:', JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid response structure from xAI API');
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling XAI:', error);
    throw error;
  }
};

const callDeepSeek = async (message: string, model: string, files?: Array<{name: string; type: string; data: string; pdfContent?: string}>): Promise<string> => {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  
  // DeepSeek models can handle up to 8192 output tokens
  const maxTokens = 8192;
  
  // Prepare content with file support
  let finalMessage = message;
  
  if (files && files.length > 0) {
    console.log('Processing files for DeepSeek:', files.length);
    const fileContents = [];
    
    for (const file of files) {
      if (file.type.includes('pdf') && file.pdfContent) {
        fileContents.push(`[Conteúdo do PDF: ${file.name}]\n\n${file.pdfContent}`);
      } else if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) {
        fileContents.push(`[Arquivo anexado: ${file.name}]\nNota: Por favor, extraia o texto do documento e envie novamente.`);
      } else if (file.type.startsWith('image/')) {
        fileContents.push(`[Imagem anexada: ${file.name}]\nNota: DeepSeek ainda não suporta análise de imagens.`);
      }
    }
    
    if (fileContents.length > 0) {
      finalMessage = `${message}\n\n${fileContents.join('\n\n')}`;
    }
  }
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente útil em português. Sempre responda em português. Se receber conteúdo de PDFs, analise-os completamente e forneça informações detalhadas.'
        },
        {
          role: 'user',
          content: finalMessage
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const callAPILLM = async (message: string, model: string, files?: Array<{name: string; type: string; data: string; pdfContent?: string}>): Promise<string> => {
  const apiKey = Deno.env.get('APILLM_API_KEY');
  
  console.log('=== APILLM DEBUG ===');
  console.log('Model requested:', model);
  console.log('API Key exists:', !!apiKey);
  console.log('API Key first 10 chars:', apiKey?.substring(0, 10) || 'none');
  
  if (!apiKey) {
    throw new Error('APILLM API key not found');
  }
  
  // Map model names to the correct APILLM names from documentation
  let apiModel = model;
  if (model.includes('Llama-4-Maverick')) {
    apiModel = 'llama4-maverick';
  } else if (model.includes('Llama-4-Scout')) {
    apiModel = 'llama4-scout';
  }
  
  console.log('Mapped model name:', apiModel);
  
  // Llama-4 models can handle up to 4096 output tokens
  const maxTokens = 4096;
  
  // Prepare content with file support
  let finalMessage = message;
  
  if (files && files.length > 0) {
    console.log('Processing files for APILLM:', files.length);
    const fileContents = [];
    
    for (const file of files) {
      if (file.type.includes('pdf') && file.pdfContent) {
        fileContents.push(`[Conteúdo do PDF: ${file.name}]\n\n${file.pdfContent}`);
      } else if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) {
        fileContents.push(`[Arquivo anexado: ${file.name}]\nNota: Por favor, extraia o texto do documento e envie novamente.`);
      } else if (file.type.startsWith('image/')) {
        fileContents.push(`[Imagem anexada: ${file.name}]\nNota: APILLM ainda não suporta análise de imagens.`);
      }
    }
    
    if (fileContents.length > 0) {
      finalMessage = `${message}\n\n${fileContents.join('\n\n')}`;
    }
  }
  
  const requestBody = {
    model: apiModel,
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente útil em português. Sempre responda em português. Se receber conteúdo de PDFs, analise-os completamente e forneça informações detalhadas.'
      },
      {
        role: 'user',
        content: finalMessage
      }
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  };
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  
  try {
    // Use the correct endpoint from the official documentation
    const response = await fetch('https://api.llama-api.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('APILLM API error response:', errorText);
      throw new Error(`APILLM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('APILLM response data:', JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid response structure from APILLM API');
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling APILLM:', error);
    throw error;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== AI-CHAT FUNCTION START ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    const { message, model, files }: ChatRequest = await req.json();
    console.log('Received message:', message?.substring(0, 100) + '...');
    console.log('Received model:', model);

    if (!message || !model) {
      console.error('Missing required fields - message:', !!message, 'model:', !!model);
      throw new Error('Message and model are required');
    }

    console.log(`Processing chat request for model: ${model}`);

    let response: string;

    // Map fictional models to real ones
    let actualModel = model;
    if (model === 'gpt-5') {
      actualModel = 'gpt-4o'; // Use GPT-4o as the best available model
      console.log('Mapping gpt-5 to gpt-4o');
    } else if (model === 'gpt-5-mini') {
      actualModel = 'gpt-4o-mini';
      console.log('Mapping gpt-5-mini to gpt-4o-mini');
    } else if (model === 'gpt-5-nano') {
      actualModel = 'gpt-4o-mini';
      console.log('Mapping gpt-5-nano to gpt-4o-mini');
    }

    // Route to appropriate API based on model
    if (actualModel.includes('gpt-') || actualModel.includes('o4')) {
      console.log('Routing to OpenAI with model:', actualModel);
      const stream = await callOpenAI(message, actualModel, files);
      
      // Return streaming response for OpenAI models
      return new Response(stream, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
      });
    } else if (model.includes('claude')) {
      console.log('Routing to Anthropic');
      response = await callAnthropic(message, model, files);
    } else if (model.includes('gemini')) {
      console.log('Routing to Google AI');
      response = await callGoogleAI(message, model, files);
    } else if (model.includes('grok') || model === 'grok-4-0709' || model === 'grok-3' || model === 'grok-3-mini') {
      console.log('Routing to XAI/Grok');
      response = await callXAI(message, model, files);
    } else if (model.includes('deepseek')) {
      console.log('Routing to DeepSeek');
      response = await callDeepSeek(message, model, files);
    } else if (model.includes('Llama-4')) {
      console.log('Routing to APILLM');
      response = await callAPILLM(message, model, files);
    } else {
      console.log('Using default OpenAI model for:', model);
      // Default to OpenAI with streaming for GPT models
      const stream = await callOpenAI(message, 'gpt-4.1-mini', files);
      return new Response(stream, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
      });
    }

    console.log('Response generated successfully, length:', response?.length || 0);

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});