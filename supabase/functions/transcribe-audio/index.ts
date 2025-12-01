import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

async function splitAudioIntoChunks(binaryAudio: Uint8Array, fileName: string): Promise<Blob[]> {
  const chunkSize = 20 * 1024 * 1024; // 20MB per chunk
  const chunks: Blob[] = [];
  
  for (let i = 0; i < binaryAudio.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, binaryAudio.length);
    const chunk = binaryAudio.slice(i, end);
    chunks.push(new Blob([chunk], { type: 'audio/webm' }));
  }
  
  console.log(`📦 Audio split into ${chunks.length} chunks`);
  return chunks;
}

async function transcribeAudioChunk(
  audioBlob: Blob, 
  fileName: string, 
  chunkIndex: number, 
  totalChunks: number
): Promise<any> {
  const formData = new FormData();
  formData.append('file', audioBlob, `${fileName}_part${chunkIndex + 1}`);
  formData.append('model', 'whisper-1');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('response_format', 'verbose_json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Whisper API error for chunk ${chunkIndex + 1}: ${await response.text()}`);
  }

  const result = await response.json();
  console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} transcribed`);
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audio, fileName } = await req.json()
    
    if (!audio) {
      throw new Error('No audio data provided')
    }

    console.log('Transcribing audio file:', fileName)
    
    const binaryAudio = processBase64Chunks(audio)
    const audioSizeMB = binaryAudio.length / (1024 * 1024);
    console.log(`📊 Audio size: ${audioSizeMB.toFixed(2)}MB`);
    
    let allTranscriptions: any[] = [];
    let timeOffset = 0;
    
    // Check if we need to split into chunks (larger than 25MB)
    if (audioSizeMB > 25) {
      console.log('🔄 Large file detected, using chunking strategy...');
      const chunks = await splitAudioIntoChunks(binaryAudio, fileName || 'audio.webm');
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkResult = await transcribeAudioChunk(chunks[i], fileName || 'audio.webm', i, chunks.length);
        
        // Adjust timestamps based on chunk position
        if (chunkResult.segments) {
          const adjustedSegments = chunkResult.segments.map((seg: any) => ({
            ...seg,
            start: seg.start + timeOffset,
            end: seg.end + timeOffset
          }));
          allTranscriptions.push(...adjustedSegments);
          
          // Update time offset for next chunk (use last segment's end time)
          if (chunkResult.segments.length > 0) {
            const lastSegment = chunkResult.segments[chunkResult.segments.length - 1];
            timeOffset = lastSegment.end + timeOffset;
          }
        }
      }
    } else {
      // Process as single file (original logic)
      console.log('📝 Single file processing');
      const formData = new FormData();
      const blob = new Blob([binaryAudio], { type: 'audio/webm' });
      formData.append('file', blob, fileName || 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('timestamp_granularities[]', 'segment');
      formData.append('response_format', 'verbose_json');

      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        throw new Error(`OpenAI Whisper API error: ${await transcriptionResponse.text()}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      allTranscriptions = transcriptionResult.segments || [];
      console.log('✅ Single file transcription completed');
    }

    // Build raw text from all transcriptions
    let rawText = '';
    if (allTranscriptions.length > 0) {
      rawText = allTranscriptions.map((segment: any) => 
        `[${Math.floor(segment.start)}s] ${segment.text}`
      ).join('\n');
    }
    
    console.log(`📝 Total segments: ${allTranscriptions.length}`);

    // Use GPT-4.1-mini for speaker separation and formatting
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em transcrição de áudio. Sua tarefa é analisar a transcrição bruta e:

1. Identificar diferentes interlocutores/falantes
2. Separar as falas por interlocutor (Interlocutor 1, Interlocutor 2, etc.)
3. Manter os timestamps quando possível
4. Formatar o texto de forma clara e legível
5. Usar formatação markdown com títulos em negrito para os interlocutores

Formato de saída:
**Interlocutor 1** (tempo)
Texto da fala...

**Interlocutor 2** (tempo)
Texto da fala...

Se não conseguir identificar múltiplos interlocutores claramente, mantenha como um único falante mas melhore a formatação.`
          },
          {
            role: 'user',
            content: `Por favor, analise esta transcrição e separe por interlocutores com formatação adequada:\n\n${rawText}`
          }
        ],
        max_completion_tokens: 2048,
      }),
    })

    if (!gptResponse.ok) {
      throw new Error(`OpenAI GPT API error: ${await gptResponse.text()}`)
    }

    const gptResult = await gptResponse.json()
    const formattedTranscription = gptResult.choices[0].message.content
    const gptUsage = gptResult.usage || {}

    console.log('GPT formatting completed')
    console.log('📊 GPT Token usage:', gptUsage)

    // Record token usage
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.53.0');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Get user from authorization header
      const authHeader = req.headers.get('authorization');
      let userId = null;
      
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id;
        } catch (e) {
          console.log('Could not extract user from token:', e);
        }
      }
      
      if (userId) {
        // Record Whisper-1 usage (audio transcription)
        const audioLength = Math.ceil(audio.length / 1024); // KB
        await supabase.from('token_usage').insert({
          user_id: userId,
          model_name: 'whisper-1',
          message_content: `Transcrição de áudio: ${fileName || 'audio.webm'}`,
          ai_response_content: rawText.substring(0, 500),
          tokens_used: 1, // Whisper charges per minute, we use 1 as placeholder
          input_tokens: 1,
          output_tokens: 1,
        });

        // Record GPT-4.1-mini usage (formatting)
        await supabase.from('token_usage').insert({
          user_id: userId,
          model_name: 'gpt-4.1-mini-2025-04-14',
          message_content: 'Formatação de transcrição',
          ai_response_content: formattedTranscription.substring(0, 500),
          tokens_used: gptUsage.total_tokens || gptUsage.prompt_tokens + gptUsage.completion_tokens || 0,
          input_tokens: gptUsage.prompt_tokens || 0,
          output_tokens: gptUsage.completion_tokens || 0,
        });

        console.log('✅ Token usage recorded');
      }
    } catch (error) {
      console.error('Failed to record token usage:', error);
    }

    return new Response(
      JSON.stringify({ transcription: formattedTranscription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Transcription error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})