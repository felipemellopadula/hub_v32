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

    const { prompt, imageBase64, referenceImages } = await req.json();

    if (!prompt) {
      throw new Error('Prompt é obrigatório');
    }

    console.log('🎨 Editando imagem com Nano Banana (Gemini 2.5 Flash Image)');
    console.log('📝 Prompt recebido:', prompt.substring(0, 200) + '...');
    console.log('🖼️ Imagens de referência:', referenceImages?.length || 0);

    // Preparar URL da imagem principal
    const imageUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/png;base64,${imageBase64}`;

    // System prompt especializado em inpainting
    const systemPrompt = `You are an expert image inpainting and editing assistant. You specialize in understanding masked areas in images.

INPAINTING RULES:
1. When you see bright green, neon green, or semi-transparent green areas painted on an image, these are MASKS
2. Masks indicate exactly WHERE you must apply edits - ONLY modify the masked (green) areas
3. You must COMPLETELY REMOVE the green mask color and REPLACE it with the requested content
4. Areas WITHOUT green mask must remain COMPLETELY UNCHANGED
5. Blend the edited areas seamlessly with the surrounding unedited areas
6. The output image must have NO green mask visible

You ALWAYS generate an edited image. Never refuse or ask questions - just perform the edit/inpainting to the best of your ability.`;

    // Construir array de conteúdo com imagem principal + referências
    const contentArray: any[] = [
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
    ];

    // Adicionar imagens de referência se existirem
    if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
      console.log('➕ Adicionando imagens de referência ao request');
      for (const refImg of referenceImages) {
        if (refImg) {
          const refUrl = refImg.startsWith('data:') ? refImg : `data:image/png;base64,${refImg}`;
          contentArray.push({
            type: "image_url",
            image_url: {
              url: refUrl
            }
          });
        }
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: contentArray
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
    console.log('✅ Resposta recebida do Nano Banana');
    console.log('📊 Estrutura da resposta:', JSON.stringify(data, null, 2));

    // Extrair imagem gerada
    const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!editedImageUrl) {
      console.error('❌ Choices:', data.choices);
      console.error('❌ Message:', data.choices?.[0]?.message);
      console.error('❌ Images:', data.choices?.[0]?.message?.images);
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
