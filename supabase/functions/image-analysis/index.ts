import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageAnalysisRequest {
  imageBase64: string;
  prompt: string;
  aiProvider?: 'openai' | 'claude' | 'gemini' | 'grok';
  analysisType?: 'general' | 'detailed' | 'technical' | 'creative';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, prompt, aiProvider = 'openai', analysisType = 'general' }: ImageAnalysisRequest = await req.json();
    
    if (!imageBase64) {
      throw new Error('Image data is required');
    }

    console.log(`Analyzing image with ${aiProvider} - Analysis type: ${analysisType}`);

    let response: string;

    switch (aiProvider) {
      case 'openai':
        response = await analyzeWithOpenAI(imageBase64, prompt, analysisType);
        break;
      case 'claude':
        response = await analyzeWithClaude(imageBase64, prompt, analysisType);
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

    return new Response(JSON.stringify({ 
      analysis: response,
      provider: aiProvider,
      analysisType 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in image-analysis function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro interno do servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeWithOpenAI(imageBase64: string, prompt: string, analysisType: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

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
    console.error('OpenAI API error:', errorData);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function analyzeWithClaude(imageBase64: string, prompt: string, analysisType: string): Promise<string> {
  const CLAUDE_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!CLAUDE_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Please add it to use Claude for image analysis.');
  }

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
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
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Claude API error:', errorData);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function analyzeWithGemini(imageBase64: string, prompt: string, analysisType: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it to use Gemini for image analysis.');
  }

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

  const fullPrompt = `${systemPrompts[analysisType as keyof typeof systemPrompts] || systemPrompts.general}\n\n${prompt || 'Analise esta imagem e descreva o que você vê.'}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
      }]
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Gemini API error:', errorData);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function analyzeWithGrok(imageBase64: string, prompt: string, analysisType: string): Promise<string> {
  const GROK_API_KEY = Deno.env.get('XAI_API_KEY');
  if (!GROK_API_KEY) {
    throw new Error('XAI_API_KEY is not configured. Please add it to use Grok for image analysis.');
  }

  const systemPrompts = {
    general: 'Você é um assistente especializado em análise de imagens. Descreva o que vê de forma clara e objetiva.',
    detailed: 'Você é um especialista em análise detalhada de imagens. Forneça uma análise completa e minuciosa da imagem.',
    technical: 'Você é um especialista técnico em análise de imagens. Foque em aspectos técnicos, composição, qualidade e elementos visuais.',
    creative: 'Você é um analista criativo de imagens. Explore aspectos artísticos, emocionais e interpretativos da imagem.'
  };

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-vision-beta',
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
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Grok API error:', errorData);
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}