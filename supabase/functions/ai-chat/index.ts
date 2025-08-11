import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  model: string;
  stream?: boolean;
}

const getApiKey = (model: string): string | null => {
  if (model.includes('gpt-5')) {
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

const callOpenAI = async (message: string, model: string, stream: boolean = false): Promise<string | ReadableStream> => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  
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
  
  // Define max tokens based on model
  let maxTokens = 100000; // GPT-5 can handle up to 100k output tokens
  if (model.includes('gpt-5-mini')) {
    maxTokens = 65536; // GPT-5 Mini max output
  } else if (model.includes('gpt-5-nano')) {
    maxTokens = 32768; // GPT-5 Nano max output
  }

  // Add reasoning support for o3 models
  const hasReasoning = model.includes('o3');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: 'Você é um assistente útil em português. Se receber informações da web, use-as para dar uma resposta mais completa e atual. Sempre responda em português.'
        },
        {
          role: 'user',
          content: finalMessage
        }
      ],
      max_completion_tokens: maxTokens,
      stream,
      // Add reasoning options for o3 models
      ...(hasReasoning ? { 
        reasoning_effort: 'medium',
        include_reasoning: true 
      } : {}),
      // Remove temperature for GPT-5 models as they only support default (1)
      ...(model.includes('gpt-5') ? {} : { temperature: 0.7 }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  if (stream) {
    return response.body;
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const reasoning = hasReasoning ? data.choices[0].message.reasoning : null;
  
  return reasoning ? JSON.stringify({ content, reasoning }) : content;
};

const callAnthropic = async (message: string, model: string): Promise<string> => {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  // Claude models have 200k context window and can output up to 8192 tokens max
  const maxTokens = 8192;
  
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
      messages: [{ role: 'user', content: message }],
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

const callGoogleAI = async (message: string, model: string): Promise<string> => {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  
  // Gemini models have up to 2M context window and up to 8192 output tokens
  const maxOutputTokens = 8192;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: message }]
      }],
      generationConfig: {
        maxOutputTokens: maxOutputTokens,
        temperature: 0.7
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google AI API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
};

const callXAI = async (message: string, model: string): Promise<string> => {
  const apiKey = Deno.env.get('XAI_API_KEY');
  
  // Grok models have up to 128k context and can output up to 4096 tokens
  const maxTokens = 4096;
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }],
      model,
      stream: false,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const callDeepSeek = async (message: string, model: string): Promise<string> => {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  
  // DeepSeek models can handle up to 8192 output tokens
  const maxTokens = 8192;
  
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
          content: 'Você é um assistente útil em português. Sempre responda em português.'
        },
        {
          role: 'user',
          content: message
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

const callAPILLM = async (message: string, model: string): Promise<string> => {
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
  
  const requestBody = {
    model: apiModel,
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente útil em português. Sempre responda em português.'
      },
      {
        role: 'user',
        content: message
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

    const { message, model, stream = true }: ChatRequest = await req.json();
    console.log('Received message:', message?.substring(0, 100) + '...');
    console.log('Received model:', model);
    console.log('Stream requested:', stream);

    if (!message || !model) {
      console.error('Missing required fields - message:', !!message, 'model:', !!model);
      throw new Error('Message and model are required');
    }

    console.log(`Processing chat request for model: ${model}`);

    // Route to appropriate API based on model
    if (model.includes('gpt-5') || model.includes('o3')) {
      console.log('Routing to OpenAI');
      const response = await callOpenAI(message, model, stream);
      
      if (stream && response instanceof ReadableStream) {
        return new Response(response, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked'
          },
        });
      } else {
        return new Response(JSON.stringify({ response }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (model.includes('claude')) {
      console.log('Routing to Anthropic');
      const response = await callAnthropic(message, model);
      return new Response(JSON.stringify({ response }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (model.includes('gemini')) {
      console.log('Routing to Google AI');
      const response = await callGoogleAI(message, model);
      return new Response(JSON.stringify({ response }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (model.includes('grok')) {
      console.log('Routing to XAI');
      const response = await callXAI(message, model);
      return new Response(JSON.stringify({ response }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (model.includes('deepseek')) {
      console.log('Routing to DeepSeek');
      const response = await callDeepSeek(message, model);
      return new Response(JSON.stringify({ response }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (model.includes('Llama-4')) {
      console.log('Routing to APILLM');
      const response = await callAPILLM(message, model);
      return new Response(JSON.stringify({ response }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log('Using default OpenAI model for:', model);
      const response = await callOpenAI(message, 'gpt-5-mini', stream);
      
      if (stream && response instanceof ReadableStream) {
        return new Response(response, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked'
          },
        });
      } else {
        return new Response(JSON.stringify({ response }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

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