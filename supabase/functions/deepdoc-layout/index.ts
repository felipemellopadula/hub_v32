import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData, pageNumber } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log(`[LAYOUT] Analyzing page ${pageNumber}...`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are a document structure analyzer. Extract the layout structure from PDF pages.

Return JSON with this structure:
{
  "elements": [
    {
      "type": "header" | "paragraph" | "table" | "list" | "figure",
      "level": 1-6 (for headers only),
      "content": "extracted text",
      "position": "top" | "middle" | "bottom"
    }
  ]
}

Rules:
- Identify headers by font size and position
- Detect tables by gridded structure
- Detect lists by bullets/numbering
- Preserve reading order (top to bottom)
- Keep content concise but complete`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze the structure of this PDF page ${pageNumber}. Extract all layout elements with their types and content.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }
        ],
        max_completion_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LAYOUT] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const layoutData = jsonMatch ? JSON.parse(jsonMatch[0]) : { elements: [] };

    console.log(`[LAYOUT] Page ${pageNumber}: ${layoutData.elements.length} elements found`);

    return new Response(JSON.stringify({ layout: layoutData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[LAYOUT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
