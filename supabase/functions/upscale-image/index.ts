import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNWARE_API_URL = 'https://api.runware.ai/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RUNWARE_API_KEY) {
      throw new Error('RUNWARE_API_KEY não configurada');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { inputImage, upscaleFactor, outputFormat } = await req.json();

    if (!inputImage) {
      throw new Error('inputImage é obrigatório');
    }

    const factor = upscaleFactor || 4;
    const format = outputFormat || 'WEBP';

    // Validar fator de upscale
    if (![2, 4, 8].includes(factor)) {
      throw new Error('upscaleFactor deve ser 2, 4 ou 8');
    }

    console.log('Iniciando upscale:', { factor, format, userId: user.id });

    // Converter inputImage para base64 se for URL
    let imageBase64 = inputImage;
    if (inputImage.startsWith('http')) {
      console.log('Baixando imagem da URL:', inputImage);
      const imgResponse = await fetch(inputImage);
      if (!imgResponse.ok) {
        throw new Error(`Falha ao baixar imagem: ${imgResponse.status}`);
      }
      const arrayBuffer = await imgResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      imageBase64 = `data:image/png;base64,${base64}`;
      console.log('Imagem convertida para base64');
    }

    // Fazer requisição para Runware API
    const runwarePayload = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY,
      },
      {
        taskType: "upscaleGan",
        taskUUID: crypto.randomUUID(),
        inputImage: imageBase64,
        upscaleFactor: factor,
        outputType: "base64",
        outputFormat: format,
        includeCost: true,
      }
    ];

    console.log('Enviando requisição para Runware API...');
    const response = await fetch(RUNWARE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runwarePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da Runware API:', errorText);
      throw new Error(`Erro da Runware API: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Resposta da Runware:', JSON.stringify(result).substring(0, 300));

    // Procurar resultado do upscale
    const upscaleResult = result.data?.find((item: any) => item.taskType === 'upscaleGan');
    
    if (!upscaleResult) {
      throw new Error('Nenhuma imagem upscalada foi gerada pela API');
    }

    const upscaledImageBase64 = upscaleResult.imageBase64 || upscaleResult.imageURL;
    
    if (!upscaledImageBase64) {
      throw new Error('API não retornou imagem em formato esperado');
    }

    // Salvar imagem no storage
    let finalBase64 = upscaledImageBase64;
    if (upscaledImageBase64.startsWith('data:')) {
      finalBase64 = upscaledImageBase64.split(',')[1];
    }

    const imageBuffer = Uint8Array.from(atob(finalBase64), c => c.charCodeAt(0));
    const timestamp = Date.now();
    const fileExtension = format.toLowerCase();
    const fileName = `${timestamp}-${crypto.randomUUID()}.${fileExtension}`;
    const filePath = `user-images/${user.id}/${fileName}`;

    console.log('Salvando imagem upscalada:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, imageBuffer, {
        contentType: `image/${fileExtension}`,
        upsert: false
      });

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
      throw new Error(`Erro ao salvar imagem: ${uploadError.message}`);
    }

    console.log('Upload realizado com sucesso:', filePath);

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    // Registrar no banco de dados
    const { error: dbError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        image_path: filePath,
        prompt: `Upscale ${factor}x`,
        format: fileExtension,
        width: null, // Dimensões serão calculadas pelo cliente se necessário
        height: null,
      });

    if (dbError) {
      console.error('Erro ao salvar no banco:', dbError);
    }

    // Registrar custo no token_usage
    const cost = upscaleResult.cost || 0.002;
    await supabase
      .from('token_usage')
      .insert({
        user_id: user.id,
        model_name: 'runware-upscale',
        message_content: `Upscale ${factor}x`,
        ai_response_content: 'Upscale completed',
        tokens_used: 1,
        input_tokens: 1,
        output_tokens: 1,
      });

    console.log('Upscale concluído com sucesso');

    return new Response(
      JSON.stringify({ 
        imageUrl: urlData.publicUrl,
        cost: cost,
        upscaleFactor: factor,
        format: fileExtension,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro ao fazer upscale:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao fazer upscale da imagem',
        details: error.toString()
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
