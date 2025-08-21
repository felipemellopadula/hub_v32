import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    data?: string; // base64 for small files
    storagePath?: string; // Storage path for large files like PDFs
    isLargeFile?: boolean; // Flag to indicate if file is stored in Storage
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

// Function to process PDF from Storage
const processPdfFromStorage = async (storagePath: string): Promise<string> => {
  try {
    console.log('Downloading PDF from storage:', storagePath);
    
    // Download file from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);
    
    if (downloadError) {
      throw new Error(`Error downloading PDF: ${downloadError.message}`);
    }
    
    // Convert blob to arrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    
    console.log('PDF downloaded successfully, size:', arrayBuffer.byteLength, 'bytes');
    
    // Extract text from PDF
    try {
      const extractedText = await extractTextFromPdf(arrayBuffer);
      console.log('PDF processed successfully, content length:', extractedText.length);
      return extractedText;
    } catch (extractError) {
      console.error('Error extracting text from PDF:', extractError);
      return `PDF baixado (${arrayBuffer.byteLength} bytes) mas erro na extração de texto: ${extractError}`;
    }
    
  } catch (error) {
    console.error('Error processing PDF from storage:', error);
    throw new Error(`Failed to process PDF: ${error.message}`);
  }
};

// Function to extract text from PDF using a simple method
const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    // Convert PDF to text using a simple approach
    // This method looks for text patterns in the PDF structure
    const uint8Array = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder('latin1');
    const pdfContent = textDecoder.decode(uint8Array);
    
    // Extract text between stream markers and clean it
    const textMatches = [];
    
    // Look for text objects in PDF structure
    const streamRegex = /stream\s*(.*?)\s*endstream/gs;
    const matches = pdfContent.match(streamRegex);
    
    if (matches) {
      for (const match of matches) {
        // Remove stream markers
        let content = match.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
        
        // Try to extract readable text
        const readableText = extractReadableText(content);
        if (readableText && readableText.length > 20) {
          textMatches.push(readableText);
        }
      }
    }
    
    // Also try direct text extraction
    const directText = extractDirectText(pdfContent);
    if (directText && directText.length > 50) {
      textMatches.push(directText);
    }
    
    if (textMatches.length > 0) {
      const combinedText = textMatches.join('\n\n');
      // Clean and format the text
      const cleanedText = cleanExtractedText(combinedText);
      return cleanedText.length > 100 ? cleanedText : 'PDF processado mas conteúdo de texto limitado encontrado.';
    } else {
      return 'PDF processado com sucesso, mas não foi possível extrair texto legível. O arquivo pode conter principalmente imagens ou estar criptografado.';
    }
    
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return 'Erro na extração de texto do PDF. O arquivo pode estar corrompido ou em formato não suportado.';
  }
};

// Helper function to extract readable text from PDF content
const extractReadableText = (content: string): string => {
  // Remove binary data and control characters
  let text = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, ' ');
  
  // Look for text patterns (letters, numbers, common punctuation)
  const textPattern = /[a-zA-ZÀ-ÿ0-9\s.,;:!?()-]+/g;
  const textMatches = text.match(textPattern);
  
  if (textMatches) {
    return textMatches
      .filter(match => match.trim().length > 3)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return '';
};

// Helper function to extract direct text from PDF
const extractDirectText = (pdfContent: string): string => {
  // Look for direct text patterns in PDF
  const patterns = [
    /\((.*?)\)/g,  // Text in parentheses
    /\[(.*?)\]/g,  // Text in brackets
    /BT\s+(.*?)\s+ET/gs,  // Text between BT (Begin Text) and ET (End Text)
  ];
  
  const extractedParts = [];
  
  for (const pattern of patterns) {
    const matches = pdfContent.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleaned = match.replace(/[()[\]]/g, '').trim();
        if (cleaned.length > 5 && /[a-zA-ZÀ-ÿ]/.test(cleaned)) {
          extractedParts.push(cleaned);
        }
      }
    }
  }
  
  return extractedParts.join(' ');
};

// Helper function to clean extracted text
const cleanExtractedText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[^\w\sÀ-ÿ.,;:!?()-]/g, ' ')  // Keep only readable characters
    .replace(/\s+/g, ' ')  // Normalize whitespace again
    .trim()
    .substring(0, 50000);  // Increase limit for better processing
};

// Function to split text into chunks based on token limits
const chunkText = (text: string, maxTokens: number = 15000): string[] => {
  // Estimate ~4 characters per token (conservative estimate)
  const maxChars = maxTokens * 4;
  const chunks: string[] = [];
  
  if (text.length <= maxChars) {
    return [text];
  }
  
  // Split by paragraphs first, then sentences if needed
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If paragraph is too large, split by sentences
      if (paragraph.length > maxChars) {
        const sentences = paragraph.split(/[.!?]+/);
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxChars) {
            currentChunk += (currentChunk ? '. ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = sentence;
            } else {
              // If single sentence is still too large, split by words
              const words = sentence.split(' ');
              for (const word of words) {
                if ((currentChunk + ' ' + word).length <= maxChars) {
                  currentChunk += (currentChunk ? ' ' : '') + word;
                } else {
                  if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = word;
                  }
                }
              }
            }
          }
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

// Function to check if model has limitations
const getModelLimitations = (model: string): { isLimited: boolean; maxTokens: number; warning?: string } => {
  // Mini/Nano models have stricter limits
  if (model.includes('mini') || model.includes('nano')) {
    return {
      isLimited: true,
      maxTokens: 8000,
      warning: `⚠️ Modelo ${model} tem limitações para PDFs grandes. Para análises completas, considere usar um modelo mais potente.`
    };
  }
  
  // GPT-5 and newer models need smaller chunks due to rate limits
  if (model.includes('gpt-5') || model.includes('o4') || model.includes('gpt-4.1')) {
    return {
      isLimited: true,
      maxTokens: 15000,
      warning: `ℹ️ PDF grande detectado. Processando em partes menores para evitar limites de tokens por minuto.`
    };
  }
  
  // Claude models
  if (model.includes('claude')) {
    return {
      isLimited: true,
      maxTokens: 15000,
      warning: `ℹ️ PDF grande detectado. Processando em partes menores para evitar limites de tokens por minuto.`
    };
  }
  
  // Grok models
  if (model.includes('grok')) {
    return {
      isLimited: true,
      maxTokens: 12000,
      warning: `ℹ️ PDF grande detectado. Processando em partes menores para evitar limites de tokens por minuto.`
    };
  }
  
  return { isLimited: false, maxTokens: 30000 };
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

const callOpenAI = async (message: string, model: string, files?: Array<{name: string; type: string; data?: string; storagePath?: string; isLargeFile?: boolean; pdfContent?: string}>): Promise<string> => {
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
  
  // Define max tokens based on model - Updated based on latest OpenAI limits
  let maxTokens = 4096; // Conservative default for older models
  if (model.includes('gpt-5')) {
    maxTokens = 32768; // GPT-5 can output up to 32k tokens
  } else if (model.includes('gpt-4.1')) {
    maxTokens = 32768; // GPT-4.1 can output up to 32k tokens  
  } else if (model.includes('gpt-4o')) {
    maxTokens = 16384; // GPT-4o and gpt-4o-mini max output tokens
  } else if (model.includes('o4-mini')) {
    maxTokens = 65536; // o4-mini max output tokens
  } else if (model.includes('o4')) {
    maxTokens = 100000; // o4 max output tokens
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
      // Use max_completion_tokens for newer models, max_tokens for legacy
      ...(model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o4') ? 
        { max_completion_tokens: maxTokens } : 
        { max_tokens: maxTokens }
      ),
      stream: false,
      // Temperature not supported on newer models
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

  const data = await response.json();
  console.log('OpenAI response received successfully');
  const content = data?.choices?.[0]?.message?.content ?? '';
  return content;
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

    // Process large files from Storage if needed and implement chunking
    if (files && files.length > 0) {
      console.log('Processing files...');
      for (const file of files) {
        if (file.isLargeFile && file.storagePath && file.type.includes('pdf')) {
          console.log('Processing PDF from storage:', file.storagePath);
          try {
            const fullPdfContent = await processPdfFromStorage(file.storagePath);
            console.log('PDF processed successfully, content length:', fullPdfContent.length);
            
            // Map fictional models to real ones for processing
            let actualModel = model;
            if (model === 'gpt-5') {
              actualModel = 'gpt-4o';
            } else if (model === 'gpt-5-mini') {
              actualModel = 'gpt-4o-mini';  
            } else if (model === 'gpt-5-nano') {
              actualModel = 'gpt-4o-mini';
            }
            
            // Check model limitations and chunk if necessary
            const limitations = getModelLimitations(actualModel);
            
            if (fullPdfContent.length > limitations.maxTokens * 4) { // Estimate chars per token
              console.log('PDF is large, chunking required. Model limitations:', limitations);
              
              // Split into chunks
              const chunks = chunkText(fullPdfContent, limitations.maxTokens);
              console.log(`PDF split into ${chunks.length} chunks`);
              
              // Process each chunk and combine results
              let combinedResponse = '';
              
              if (limitations.warning) {
                combinedResponse = limitations.warning + '\n\n';
              }
              
              for (let i = 0; i < chunks.length; i++) {
                console.log(`Processing chunk ${i + 1}/${chunks.length}, length: ${chunks[i].length}`);
                
                // Create a temporary file object for this chunk
                const chunkFile = {
                  ...file,
                  pdfContent: chunks[i]
                };
                
                const chunkMessage = `${message}\n\n[IMPORTANTE: Esta é a parte ${i + 1} de ${chunks.length} do PDF "${file.name}". Analise esta parte e forneça insights relevantes.]`;
                
                try {
                  let chunkResponse: string;
                  
                  // Route to appropriate API for this chunk
                  if (actualModel.includes('gpt-') || actualModel.includes('o4')) {
                    chunkResponse = await callOpenAI(chunkMessage, actualModel, [chunkFile]);
                  } else if (model.includes('claude')) {
                    chunkResponse = await callAnthropic(chunkMessage, model, [chunkFile]);
                  } else if (model.includes('gemini')) {
                    chunkResponse = await callGoogleAI(chunkMessage, model, [chunkFile]);
                  } else if (model.includes('grok')) {
                    chunkResponse = await callXAI(chunkMessage, model, [chunkFile]);
                  } else if (model.includes('deepseek')) {
                    chunkResponse = await callDeepSeek(chunkMessage, model, [chunkFile]);
                  } else if (model.includes('Llama-4')) {
                    chunkResponse = await callAPILLM(chunkMessage, model, [chunkFile]);
                  } else {
                    chunkResponse = await callOpenAI(chunkMessage, 'gpt-4o-mini', [chunkFile]);
                  }
                  
                  combinedResponse += `\n\n### Análise da Parte ${i + 1}/${chunks.length}:\n${chunkResponse}`;
                  
                  // Add delay between chunks to respect rate limits
                  if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                  }
                  
                } catch (chunkError) {
                  console.error(`Error processing chunk ${i + 1}:`, chunkError);
                  combinedResponse += `\n\n### Erro na Parte ${i + 1}/${chunks.length}:\nNão foi possível processar esta seção do PDF.`;
                }
              }
              
              // Add final summary
              combinedResponse += '\n\n### Resumo Geral:\nEste PDF foi processado em partes devido ao seu tamanho. As análises acima cobrem todo o conteúdo disponível.';
              
              return new Response(JSON.stringify({ response: combinedResponse }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
              
            } else {
              // PDF is small enough to process normally
              file.pdfContent = fullPdfContent;
            }
            
          } catch (error) {
            console.error('Error processing PDF from storage:', error);
            file.pdfContent = `[Erro ao processar PDF: ${file.name}]\nNão foi possível extrair o conteúdo do arquivo.`;
          }
        }
      }
    }

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
      const text = await callOpenAI(message, actualModel, files);
      return new Response(JSON.stringify({ response: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      const text = await callOpenAI(message, 'gpt-4o-mini', files);
      return new Response(JSON.stringify({ response: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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