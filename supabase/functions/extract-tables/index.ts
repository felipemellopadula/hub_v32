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

    console.log(`[TABLE-EXTRACT] Processing page ${pageNumber}...`);

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
            content: `You are a table extraction specialist. Extract ALL tables from PDF pages as structured JSON.

Return JSON:
{
  "tables": [
    {
      "id": "table_1",
      "headers": ["Column 1", "Column 2", ...],
      "rows": [
        ["Value 1", "Value 2", ...],
        ["Value 3", "Value 4", ...]
      ],
      "caption": "table title/caption if present",
      "position": "top" | "middle" | "bottom"
    }
  ]
}

Rules:
- Extract ALL tables found
- Preserve column-row relationships EXACTLY
- Handle merged cells by repeating values
- Include table captions/titles
- If no tables: return {"tables": []}
- Keep numeric precision
- Preserve formatting hints (bold, italic) in parentheses if critical`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all tables from page ${pageNumber}. Return structured JSON.`
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
      console.error('[TABLE-EXTRACT] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const tablesData = jsonMatch ? JSON.parse(jsonMatch[0]) : { tables: [] };

    console.log(`[TABLE-EXTRACT] Page ${pageNumber}: ${tablesData.tables.length} tables found`);

    return new Response(JSON.stringify(tablesData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TABLE-EXTRACT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
