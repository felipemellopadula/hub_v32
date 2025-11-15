const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageAnalysisRequest {
  imageBase64: string;
  prompt: string;
  aiProvider?: 'openai' | 'claude' | 'gemini' | 'grok';
  analysisType?: 'general' | 'detailed' | 'technical' | 'creative';
  model?: string; // Specific model to use (e.g., claude-sonnet-4-5, claude-opus-4-1-20250805)
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, prompt, aiProvider = 'openai', analysisType = 'general', model }: ImageAnalysisRequest = await req.json();
    
    console.log('=== IMAGE ANALYSIS DEBUG ===');
    console.log('Request received with:');
    console.log('- imageBase64 length:', imageBase64?.length || 0);
    console.log('- prompt:', prompt);
    console.log('- aiProvider:', aiProvider);
    console.log('- analysisType:', analysisType);
    console.log('- model:', model);
    
    if (!imageBase64) {
      console.log('ERROR: No image data provided');
      throw new Error('Image data is required');
    }

    console.log(`Starting image analysis with ${aiProvider} - Analysis type: ${analysisType} - Model: ${model || 'default'}`);

    let response: string;

    switch (aiProvider) {
      case 'openai':
        response = await analyzeWithOpenAI(imageBase64, prompt, analysisType);
        break;
      case 'claude':
        response = await analyzeWithClaude(imageBase64, prompt, analysisType, model);
        break;
      case 'gemini':
        response = await analyzeWithGemini(imageBase64, prompt, analysisType);
        break;
      case 'grok':
        response = await analyzeWithGrok(imageBase64, prompt, analysisType);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`);
    }

    console.log('=== IMAGE ANALYSIS SUCCESS ===');
    console.log('Analysis completed successfully');
    console.log('Response length:', response?.length || 0);
    
    return new Response(JSON.stringify({ 
      analysis: response,
      provider: aiProvider,
      analysisType 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('=== IMAGE ANALYSIS ERROR ===');
    console.error('Error in image-analysis function:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Erro desconhecido');
    console.error('Error stack:', error instanceof Error ? error.stack : 'N/A');
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeWithOpenAI(imageBase64: string, prompt: string, analysisType: string): Promise<string> {
  console.log('=== OPENAI ANALYSIS START ===');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.log('ERROR: OPENAI_API_KEY not found');
    throw new Error('OPENAI_API_KEY is not configured');
  }
  console.log('OpenAI API key found, length:', OPENAI_API_KEY.length);

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

  console.log('Making request to OpenAI with model: gpt-4o');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: systemPrompts[analysisType as keyof typeof systemPrompts] || systemPrompts.general
        },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: prompt || 'Analise esta imagem e descreva o que você vê.' },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high'
              } 
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('OpenAI API error response:', errorData);
    console.error('OpenAI API status:', response.status);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  console.log('OpenAI request successful, parsing response...');
  const data = await response.json();
  console.log('OpenAI response parsed successfully');
  return data.choices[0].message.content;
}

async function analyzeWithClaude(imageBase64: string, prompt: string, analysisType: string, model?: string): Promise<string> {
  console.log('=== CLAUDE VISION ANALYSIS START ===');
  const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');
  if (!CLAUDE_API_KEY) {
    console.log('ERROR: CLAUDE_API_KEY not found');
    throw new Error('CLAUDE_API_KEY is not configured. Please add it to use Claude for image analysis.');
  }
  console.log('Claude API key found, length:', CLAUDE_API_KEY.length);

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

  // Map common model names and default to appropriate model
  let visionModel = model || 'claude-haiku-4-5';
  
  // Support both naming conventions - CORRECT MODEL NAMES
  if (model === 'claude-sonnet-4-5') {
    visionModel = 'claude-sonnet-4-20250514'; // Modelo correto (SEM o 5 extra)
  } else if (model === 'claude-opus-4-1-20250805') {
    visionModel = 'claude-opus-4-1-20250805'; // Este já está correto
  } else if (model === 'claude-haiku-4-5') {
    visionModel = 'claude-haiku-4-5'; // Haiku 4.5 correto
  } else if (model === 'claude-3-5-haiku-20241022') {
    visionModel = 'claude-3-5-haiku-20241022'; // Legacy model
  }
  
  console.log('Using model:', visionModel, 'for image analysis');
  console.log('Image data length:', imageBase64.length);
  console.log('Analysis type:', analysisType);
  console.log('Prompt:', prompt);

  const requestBody = {
    model: visionModel,
    max_tokens: 1000,
    system: systemPrompts[analysisType as keyof typeof systemPrompts] || systemPrompts.general,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt || 'Analise esta imagem e descreva o que você vê.' },
        { 
          type: 'image', 
          source: { 
            type: 'base64', 
            media_type: 'image/jpeg', 
            data: imageBase64 
          } 
        }
      ]
    }]
  };

  console.log('Request body prepared:', {
    model: requestBody.model,
    messagesCount: requestBody.messages.length,
    hasSystemPrompt: !!requestBody.system,
    hasUserMessage: requestBody.messages[0].role === 'user',
    userContentType: Array.isArray(requestBody.messages[0].content) ? 'multimodal' : 'text',
    maxTokens: requestBody.max_tokens
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody),
  });

  console.log('Claude API response status:', response.status);
  console.log('Claude API response ok:', response.ok);
  console.log('Claude API response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorData = await response.text();
    console.error('=== CLAUDE API ERROR ===');
    console.error('Status:', response.status);
    console.error('Error response:', errorData);
    console.error('Request model used:', visionModel);
    throw new Error(`Claude Vision API error: ${response.status} - ${errorData}`);
  }

  console.log('Claude vision analysis successful, parsing response...');
  const data = await response.json();
  console.log('Claude response data structure:', {
    hasContent: !!data.content,
    contentLength: data.content?.length,
    hasText: !!data.content?.[0]?.text,
    contentType: data.content?.[0]?.type
  });
  
  const content = data.content[0].text;
  console.log('Claude analysis content length:', content?.length || 0);
  console.log('=== CLAUDE VISION ANALYSIS SUCCESS ===');
  
  return content;
}

async function analyzeWithGemini(imageBase64: string, prompt: string, analysisType: string): Promise<string> {
  console.log('=== GEMINI VISION ANALYSIS START ===');
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.log('ERROR: GEMINI_API_KEY not found');
    throw new Error('GEMINI_API_KEY is not configured. Please add it to use Gemini for image analysis.');
  }
  console.log('Gemini API key found, length:', GEMINI_API_KEY.length);

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

  // Use the correct Gemini 2.5 models for vision
  const visionModel = 'gemini-2.0-flash-exp'; // Default vision-capable model
  console.log('Using model:', visionModel, 'for image analysis');
  console.log('Image data length:', imageBase64.length);
  console.log('Analysis type:', analysisType);
  console.log('Prompt:', prompt);

  const fullPrompt = `${systemPrompts[analysisType as keyof typeof systemPrompts] || systemPrompts.general}\n\n${prompt || 'Analise esta imagem e descreva o que você vê.'}`;

  const requestBody = {
    contents: [{
      parts: [
        { text: fullPrompt },
        { 
          inline_data: { 
            mime_type: 'image/jpeg', 
            data: imageBase64 
          } 
        }
      ]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  };

  console.log('Request body prepared:', {
    model: visionModel,
    contentsLength: requestBody.contents.length,
    hasText: !!requestBody.contents[0].parts[0].text,
    hasImage: !!requestBody.contents[0].parts[1].inline_data,
    maxOutputTokens: requestBody.generationConfig.maxOutputTokens
  });

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  console.log('Gemini API response status:', response.status);
  console.log('Gemini API response ok:', response.ok);

  if (!response.ok) {
    const errorData = await response.text();
    console.error('=== GEMINI API ERROR ===');
    console.error('Status:', response.status);
    console.error('Error response:', errorData);
    console.error('Request model used:', visionModel);
    throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
  }

  console.log('Gemini vision analysis successful, parsing response...');
  const data = await response.json();
  console.log('Gemini response data structure:', {
    hasCandidates: !!data.candidates,
    candidatesLength: data.candidates?.length,
    hasContent: !!data.candidates?.[0]?.content,
    hasParts: !!data.candidates?.[0]?.content?.parts,
    hasText: !!data.candidates?.[0]?.content?.parts?.[0]?.text
  });
  
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar resposta';
  console.log('Gemini analysis content length:', content?.length || 0);
  console.log('=== GEMINI VISION ANALYSIS SUCCESS ===');
  
  return content;
}

async function analyzeWithGrok(imageBase64: string, prompt: string, analysisType: string): Promise<string> {
  console.log('=== GROK VISION ANALYSIS START ===');
  const GROK_API_KEY = Deno.env.get('GROK_API_KEY');
  if (!GROK_API_KEY) {
    console.log('ERROR: GROK_API_KEY not found');
    throw new Error('GROK_API_KEY is not configured. Please add it to use Grok for image analysis.');
  }
  console.log('Grok API key found, length:', GROK_API_KEY.length);

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

  // Use grok-2-vision-1212 model which is the correct vision model for xAI
  const visionModel = 'grok-2-vision-1212';
  console.log('Using model:', visionModel, 'for image analysis');
  console.log('Image data length:', imageBase64.length);
  console.log('Analysis type:', analysisType);
  console.log('Prompt:', prompt);

  const requestBody = {
    model: visionModel,
    messages: [
      { 
        role: 'system', 
        content: systemPrompts[analysisType as keyof typeof systemPrompts] || systemPrompts.general
      },
      { 
        role: 'user', 
        content: [
          { type: 'text', text: prompt || 'Analise esta imagem e descreva o que você vê.' },
          { 
            type: 'image_url', 
            image_url: { 
              url: `data:image/jpeg;base64,${imageBase64}` 
            } 
          }
        ]
      }
    ],
    max_tokens: 1000,
    temperature: 0.7,
  };

  console.log('Request body prepared:', {
    model: requestBody.model,
    messagesCount: requestBody.messages.length,
    hasSystemMessage: requestBody.messages[0].role === 'system',
    hasUserMessage: requestBody.messages[1].role === 'user',
    userContentType: Array.isArray(requestBody.messages[1].content) ? 'multimodal' : 'text'
  });

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  console.log('Grok API response status:', response.status);
  console.log('Grok API response ok:', response.ok);
  console.log('Grok API response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorData = await response.text();
    console.error('=== GROK API ERROR ===');
    console.error('Status:', response.status);
    console.error('Error response:', errorData);
    console.error('Request model used:', visionModel);
    throw new Error(`Grok Vision API error: ${response.status} - ${errorData}`);
  }

  console.log('Grok vision analysis successful, parsing response...');
  const data = await response.json();
  console.log('Grok response data structure:', {
    hasChoices: !!data.choices,
    choicesLength: data.choices?.length,
    hasMessage: !!data.choices?.[0]?.message,
    hasContent: !!data.choices?.[0]?.message?.content
  });
  
  const content = data.choices[0].message.content;
  console.log('Grok analysis content length:', content?.length || 0);
  console.log('=== GROK VISION ANALYSIS SUCCESS ===');
  
  return content;
}