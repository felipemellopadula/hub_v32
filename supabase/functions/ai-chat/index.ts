import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// HEADERS E INTERFACES
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
interface FileData { name: string; type: string; data: string; pdfContent?: string; }
interface ChatRequest { message: string; model: string; files?: FileData[]; }

// FUNÇÃO AUXILIAR CENTRAL PARA CONSTRUIR O PROMPT
function buildPromptContent(message: string, files?: FileData[]): any[] {
  const content: any[] = [];
  if (message.trim()) { content.push({ type: 'text', text: message }); }
  if (files && files.length > 0) {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: file.type, data: file.data.split(',')[1] },
          image_url: { url: file.data }
        });
      } else if (file.type.includes('pdf')) {
        content.push({
          type: 'text',
          text: (typeof file.pdfContent === 'string' && file.pdfContent.trim() !== '')
            ? `[Conteúdo do PDF: ${file.name}]\n\n${file.pdfContent}`
            : `[Arquivo PDF anexado: ${file.name}]\n\nAVISO: Não foi possível extrair texto deste PDF.`
        });
      }
    }
  }
  return content;
}

// FUNÇÃO DE TRATAMENTO DE ERRO UNIVERSAL E ROBUSTA
async function handleApiError(provider: string, response: Response): Promise<Error> {
  const status = response.status;
  const errorText = await response.text();
  try {
    const errorJson = JSON.parse(errorText);
    const message = errorJson.error?.message || errorJson.error?.type || errorText;
    return new Error(`Erro da API ${provider}: ${status} - ${message}`);
  } catch (e) {
    return new Error(`Erro da API ${provider}: ${status} - ${errorText}`);
  }
}

// FUNÇÕES DE API (callOpenAI, callGoogleAI, etc.)
const callOpenAI = async (message: string, model: string, files?: FileData[]): Promise<string> => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('A chave de API da OpenAI (OPENAI_API_KEY) não está configurada.');

  const content = buildPromptContent(message, files).map(item => item.type === 'image' ? { type: 'image_url', image_url: item.image_url } : item);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], max_tokens: 4096 }),
  });

  if (!response.ok) throw await handleApiError('OpenAI', response);
  const data = await response.json();
  return data.choices[0].message.content;
};

const callAnthropic = async (message: string, model: string, files?: FileData[]): Promise<string> => {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('A chave de API da Anthropic (ANTHROPIC_API_KEY) não está configurada.');

  const content = buildPromptContent(message, files).map(item => item.type === 'image' ? { type: 'image', source: item.source } : item);
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content }] }),
  });

  if (!response.ok) throw await handleApiError('Anthropic', response);
  const data = await response.json();
  return data.content[0].text;
};

const callGoogleAI = async (message: string, model: string, files?: FileData[]): Promise<string> => {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) throw new Error('A chave de API do Google (GOOGLE_API_KEY) não está configurada.');

  const content = buildPromptContent(message, files);
  const geminiParts = content.map(item => item.type === 'image' ? { inlineData: { mimeType: item.source.media_type, data: item.source.data } } : { text: item.text });

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: geminiParts }] }),
  });

  if (!response.ok) throw await handleApiError('Google', response);
  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) {
    return "A resposta do modelo foi bloqueada, possivelmente devido às configurações de segurança.";
  }
  return data.candidates[0].content.parts[0].text;
};


// SERVIDOR PRINCIPAL - O "CÉREBRO" DO ROTEAMENTO
serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response(null, { headers: corsHeaders }); }
  try {
    const { message, model, files }: ChatRequest = await req.json();
    if ((!message || !message.trim()) && (!files || files.length === 0)) { throw new Error('A mensagem não pode estar vazia.'); }
    if (!model) { throw new Error('O modelo é obrigatório.'); }

    let response: string;

    // Roteamento baseado no nome do modelo recebido do frontend
    // A lógica .includes() garante que todos os modelos de um provedor sejam direcionados para a função correta.
    if (model.includes('gpt-')) {
      response = await callOpenAI(message, model, files);
    } 
    // Suporta 'claude-3-5-haiku...', 'claude-opus-4.1...', 'claude-sonnet-4...' etc.
    else if (model.includes('claude')) {
      response = await callAnthropic(message, model, files);
    } 
    else if (model.includes('gemini')) {
      response = await callGoogleAI(message, model, files);
    } 
    else if (model.includes('grok')) {
      // A função callXAI/Grok não foi incluída aqui por simplicidade, mas a lógica seria a mesma.
      throw new Error("O modelo Grok ainda não está implementado nesta versão.");
    } 
    else {
      // Um fallback seguro, caso o modelo não seja reconhecido
      response = await callOpenAI(message, 'gpt-4o-mini', files);
    }

    return new Response(JSON.stringify({ response }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(`ERRO NA FUNÇÃO 'ai-chat':`, error);
    return new Response(JSON.stringify({ error: error.message || 'Ocorreu um erro desconhecido no servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});