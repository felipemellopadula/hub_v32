import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const { prompt, imageBase64 } = await req.json();

    if (!prompt) {
      throw new Error('Prompt é obrigatório');
    }

    console.log('🎨 Editando imagem com Nano Banana 2 Pro (Gemini 3 Pro Image)');

    // Preparar URL da imagem
    const imageUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/png;base64,${imageBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da API Lovable:', errorText);
      throw new Error(`Erro da API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Resposta recebida do Nano Banana 2 Pro');

    // Extrair imagem gerada
    const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!editedImageUrl) {
      console.error('❌ Nenhuma imagem retornada');
      throw new Error('Nenhuma imagem foi gerada pela API');
    }

    // Retornar apenas o base64 (sem data:image/png;base64,)
    const base64Image = editedImageUrl.replace(/^data:image\/\w+;base64,/, '');

    return new Response(
      JSON.stringify({ 
        image: base64Image
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Erro ao editar imagem:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao editar imagem'
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
