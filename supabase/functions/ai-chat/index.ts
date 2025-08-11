import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  model: string;
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

const callOpenAI = async (message: string, model: string): Promise<string> => {
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
      max_completion_tokens: 1000,
      // Remove temperature for GPT-5 models as they only support default (1)
      ...(model.includes('gpt-5') ? {} : { temperature: 0.7 }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const callAnthropic = async (message: string, model: string): Promise<string> => {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
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
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: message }]
      }]
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
      max_tokens: 1000,
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
    max_tokens: 1000,
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

    const { message, model }: ChatRequest = await req.json();
    console.log('Received message:', message?.substring(0, 100) + '...');
    console.log('Received model:', model);

    if (!message || !model) {
      console.error('Missing required fields - message:', !!message, 'model:', !!model);
      throw new Error('Message and model are required');
    }

    console.log(`Processing chat request for model: ${model}`);

    let response: string;

    // Route to appropriate API based on model
    if (model.includes('gpt-5')) {
      console.log('Routing to OpenAI');
      response = await callOpenAI(message, model);
    } else if (model.includes('claude')) {
      console.log('Routing to Anthropic');
      response = await callAnthropic(message, model);
    } else if (model.includes('gemini')) {
      console.log('Routing to Google AI');
      response = await callGoogleAI(message, model);
    } else if (model.includes('grok')) {
      console.log('Routing to XAI');
      response = await callXAI(message, model);
    } else if (model.includes('deepseek')) {
      console.log('Routing to DeepSeek');
      response = await callDeepSeek(message, model);
    } else if (model.includes('Llama-4')) {
      console.log('Routing to APILLM');
      response = await callAPILLM(message, model);
    } else {
      console.log('Using default OpenAI model for:', model);
      // Default to OpenAI with a valid model
      response = await callOpenAI(message, 'gpt-5-mini');
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