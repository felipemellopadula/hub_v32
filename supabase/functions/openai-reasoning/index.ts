import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map model names to OpenAI API model names
function mapModelToOpenAI(model: string): string {
  const modelMap: Record<string, string> = {
    'gpt-5.1': 'gpt-5-2025-08-07',
    'gpt-5-mini': 'gpt-5-mini-2025-08-07',
    'gpt-5-nano': 'gpt-5-nano-2025-08-07',
    'o4-mini': 'o4-mini-2025-04-16',
  };
  return modelMap[model] || model;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, model, reasoningEffort = 'medium' } = await req.json();

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mappedModel = mapModelToOpenAI(model);
    console.log(`🧠 OpenAI Reasoning - Model: ${model} -> ${mappedModel}`);
    console.log(`🧠 Reasoning Effort: ${reasoningEffort}`);
    console.log(`🧠 Message length: ${message.length}`);

    // Use the Responses API for reasoning
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: mappedModel,
        input: message,
        reasoning: {
          effort: reasoningEffort,
          summary: 'detailed'
        },
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Reasoning API error:', response.status, errorText);
      
      // If Responses API fails, try fallback to chat completions
      console.log('🔄 Falling back to chat completions API...');
      
      const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: mappedModel,
          messages: [
            { 
              role: 'system', 
              content: 'You are a helpful AI assistant. Think step by step and explain your reasoning process before providing the final answer. Start with "## Reasoning Process" section, then provide "## Answer" section.' 
            },
            { role: 'user', content: message }
          ],
          max_completion_tokens: 16000,
          stream: true,
        }),
      });

      if (!fallbackResponse.ok) {
        const fallbackError = await fallbackResponse.text();
        console.error('Fallback API error:', fallbackResponse.status, fallbackError);
        return new Response(
          JSON.stringify({ error: `OpenAI API error: ${fallbackResponse.status}` }),
          { status: fallbackResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Stream the fallback response using SSE format
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      (async () => {
        try {
          const reader = fallbackResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  // Send as content type
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`));
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          }

          // Parse the full content to extract reasoning if structured
          let reasoning = '';
          let answer = fullContent;
          
          if (fullContent.includes('## Reasoning Process') && fullContent.includes('## Answer')) {
            const reasoningMatch = fullContent.match(/## Reasoning Process\s*([\s\S]*?)(?=## Answer|$)/i);
            const answerMatch = fullContent.match(/## Answer\s*([\s\S]*?)$/i);
            
            if (reasoningMatch) reasoning = reasoningMatch[1].trim();
            if (answerMatch) answer = answerMatch[1].trim();
          }

          // Send final reasoning if extracted
          if (reasoning) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'reasoning_final', reasoning })}\n\n`));
          }

          await writer.write(encoder.encode('data: [DONE]\n\n'));
          await writer.close();
        } catch (e) {
          console.error('Stream processing error:', e);
          await writer.abort(e);
        }
      })();

      return new Response(stream.readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Process the Responses API streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let reasoningSummary = '';
        let contentText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              // Handle response.output_item.added for reasoning
              if (parsed.type === 'response.output_item.added') {
                const item = parsed.item;
                if (item?.type === 'reasoning') {
                  console.log('🧠 Reasoning item detected');
                }
              }
              
              // Handle response.reasoning_summary_part.added
              if (parsed.type === 'response.reasoning_summary_part.added') {
                const text = parsed.part?.text || '';
                if (text) {
                  reasoningSummary += text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'reasoning', reasoning: text })}\n\n`));
                }
              }
              
              // Handle response.reasoning_summary_text.delta
              if (parsed.type === 'response.reasoning_summary_text.delta') {
                const text = parsed.delta || '';
                if (text) {
                  reasoningSummary += text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'reasoning', reasoning: text })}\n\n`));
                }
              }
              
              // Handle response.output_text.delta for content
              if (parsed.type === 'response.output_text.delta') {
                const text = parsed.delta || '';
                if (text) {
                  contentText += text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`));
                }
              }
              
              // Handle response.content_part.added
              if (parsed.type === 'response.content_part.added') {
                const text = parsed.part?.text || '';
                if (text) {
                  contentText += text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`));
                }
              }

            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }

        console.log(`🧠 Reasoning complete - Summary: ${reasoningSummary.length} chars, Content: ${contentText.length} chars`);
        await writer.write(encoder.encode('data: [DONE]\n\n'));
        await writer.close();
      } catch (e) {
        console.error('Stream processing error:', e);
        await writer.abort(e);
      }
    })();

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in openai-reasoning function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
