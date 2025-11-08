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
    const { contentSample, fileName } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log(`[DOC-TYPE] Detecting type for: ${fileName}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are a document classifier. Analyze the document content and classify it into ONE of these types:

- "resume": CV, curriculum vitae, job application documents
- "paper": Academic papers, research articles, scientific publications
- "table": Spreadsheets, data tables, financial reports with lots of tabular data
- "qa": Q&A documents, FAQs, interview transcripts
- "contract": Legal contracts, agreements, terms of service
- "manual": User manuals, technical documentation, how-to guides
- "general": Everything else

Return ONLY a JSON object: {"type": "category", "confidence": 0-100, "reasoning": "brief explanation"}`
          },
          {
            role: 'user',
            content: `Classify this document.

Filename: ${fileName}

Content sample (first 3000 chars):
${contentSample.substring(0, 3000)}

Return JSON.`
          }
        ],
        max_completion_tokens: 200
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DOC-TYPE] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const classification = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: 'general', confidence: 50, reasoning: 'Could not classify' };

    console.log(`[DOC-TYPE] Result: ${classification.type} (${classification.confidence}% confidence)`);

    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[DOC-TYPE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
