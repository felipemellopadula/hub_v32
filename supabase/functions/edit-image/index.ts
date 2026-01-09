import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAndDeductCredits, createInsufficientCreditsResponse } from "../_shared/credit-validation.ts";

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

    const { model, positivePrompt, inputImage, inputImage2, inputImages, width, height } = await req.json();

    // Suporte a array de imagens (inputImages) ou imagens individuais (inputImage, inputImage2)
    const allImages: string[] = inputImages && Array.isArray(inputImages) 
      ? inputImages 
      : [inputImage, inputImage2].filter(Boolean);

    if (!positivePrompt || allImages.length === 0) {
      throw new Error('Prompt e imagem de entrada são obrigatórios');
    }

    // ✅ VALIDAÇÃO DE CRÉDITOS (apenas para novos usuários)
    const authHeader = req.headers.get('Authorization');
    if (authHeader && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);

      if (user) {
        const creditCost = 1; // 1 crédito por edição
        const creditResult = await validateAndDeductCredits(
          supabaseAdmin,
          user.id,
          creditCost,
          'image-edit',
          `Edição de imagem: ${positivePrompt.substring(0, 100)}`
        );

        if (!creditResult.isValid) {
          console.log('[edit-image] ❌ Créditos insuficientes');
          return createInsufficientCreditsResponse(creditResult.creditsRemaining, creditCost, corsHeaders);
        }

        console.log(`[edit-image] ✅ Créditos validados. isLegacy=${creditResult.isLegacyUser}, remaining=${creditResult.creditsRemaining}`);
      }
    }

    console.log('Editando imagem com Runware:', { model, width, height, promptLength: positivePrompt.length, imageCount: allImages.length });

    const isGoogleModel = model && model.startsWith('google:');
    const isOpenAIModel = model && model.startsWith('openai:');
    const isSeedream = model === 'bytedance:5@0';
    const isNanoBanana2Pro = model === 'google:4@2';
    const isGPTImage15 = model === 'openai:4@1';
    
    // Seedream, Google e OpenAI precisam de upload + referenceImages
    const needsUploadFlow = isGoogleModel || isSeedream || isOpenAIModel;
    
    let runwarePayload: any[] = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY,
      }
    ];

    // Para modelos Google (Gemini), Seedream e OpenAI, precisa fazer upload da imagem primeiro
    if (needsUploadFlow) {
      const modelType = isGoogleModel ? 'Google' : isOpenAIModel ? 'OpenAI' : 'Seedream';
      console.log(`Modelo ${modelType} detectado, fazendo upload de ${allImages.length} imagem(ns)...`);
      
      // Fazer upload de todas as imagens
      for (let i = 0; i < allImages.length; i++) {
        const uploadTaskUUID = crypto.randomUUID();
        runwarePayload.push({
          taskType: "imageUpload",
          taskUUID: uploadTaskUUID,
          image: allImages[i]
        });
        console.log(`Preparando upload da imagem ${i + 1}...`);
      }

      // Faz o upload primeiro
      console.log('Enviando upload para Runware API...');
      const uploadResponse = await fetch(RUNWARE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(runwarePayload),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Erro no upload da imagem:', errorText);
        throw new Error(`Erro no upload: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload realizado:', JSON.stringify(uploadResult).substring(0, 300));

      // Pegar todos os UUIDs de imagem uploadadas
      const uploadedImages = uploadResult.data?.filter((item: any) => item.taskType === 'imageUpload');
      
      if (!uploadedImages?.length || !uploadedImages[0]?.imageUUID) {
        throw new Error('Falha ao fazer upload da imagem');
      }

      const referenceImageUUIDs = uploadedImages.map((img: any) => img.imageUUID);
      console.log('Image UUIDs obtidos:', referenceImageUUIDs);

      // Agora faz a inferência usando referenceImages
      const inferenceTaskUUID = crypto.randomUUID();
      const inferencePayload = [
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageInference",
          taskUUID: inferenceTaskUUID,
          positivePrompt,
          model: model || "google:4@1",
          referenceImages: referenceImageUUIDs,
          numberResults: 1,
          outputFormat: "PNG",
          outputType: "URL",
          includeCost: true,
          // Adicionar width/height para Nano Banana 2 Pro, Seedream e GPT Image 1.5
          ...((isNanoBanana2Pro || isSeedream || isGPTImage15) && width && height ? { width, height } : {}),
        }
      ];
      
      if (isNanoBanana2Pro || isSeedream || isGPTImage15) {
        const modelName = isNanoBanana2Pro ? 'Nano Banana 2 Pro' : isGPTImage15 ? 'GPT Image 1.5' : 'Seedream 4.0';
        console.log(`${modelName} - adicionando dimensões:`, { width, height });
      }
      console.log(`Usando ${referenceImageUUIDs.length} imagem(ns) de referência`);

      console.log('Enviando inferência para Runware API...');
      const inferenceResponse = await fetch(RUNWARE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inferencePayload),
      });

      if (!inferenceResponse.ok) {
        const errorText = await inferenceResponse.text();
        console.error('Erro da Runware API:', errorText);
        throw new Error(`Erro da Runware API: ${inferenceResponse.status} - ${errorText}`);
      }

      const result = await inferenceResponse.json();
      console.log('Resposta da Runware:', JSON.stringify(result).substring(0, 200));

      const imageResult = result.data?.find((item: any) => item.taskType === 'imageInference');
      
      if (!imageResult) {
        throw new Error('Nenhuma imagem foi gerada pela API');
      }

      const imageUrl = imageResult.imageURL;
      
      if (!imageUrl) {
        throw new Error('API não retornou URL da imagem');
      }

      // Download da imagem da URL
      console.log('Baixando imagem da URL:', imageUrl);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Erro ao baixar imagem: ${imageResponse.status}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      
      // Limitar tamanho do buffer para evitar erros de memória (máx 10MB)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (imageBuffer.byteLength > MAX_SIZE) {
        console.warn(`Imagem muito grande (${imageBuffer.byteLength} bytes), será truncada`);
      }
      
      const uint8Array = new Uint8Array(imageBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const imageBase64 = btoa(binary);
      
      if (!imageBase64) {
        throw new Error('API não retornou imagem em formato esperado');
      }

      return new Response(
        JSON.stringify({ 
          image: imageBase64,
          cost: imageResult.cost,
          seed: imageResult.seed,
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );

    } else {
      // Para outros modelos, usa seedImage diretamente
      runwarePayload.push({
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        positivePrompt,
        width: width || 1024,
        height: height || 1024,
        model: model || "runware:100@1",
        numberResults: 1,
        outputFormat: "PNG",
        seedImage: inputImage,
        outputType: "URL",
        includeCost: true,
      });

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
      console.log('Resposta da Runware:', JSON.stringify(result).substring(0, 200));

      const imageResult = result.data?.find((item: any) => item.taskType === 'imageInference');
      
      if (!imageResult) {
        throw new Error('Nenhuma imagem foi gerada pela API');
      }

      const imageUrl = imageResult.imageURL;
      
      if (!imageUrl) {
        throw new Error('API não retornou URL da imagem');
      }

      // Download da imagem da URL
      console.log('Baixando imagem da URL:', imageUrl);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Erro ao baixar imagem: ${imageResponse.status}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      
      // Limitar tamanho do buffer para evitar erros de memória (máx 10MB)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (imageBuffer.byteLength > MAX_SIZE) {
        console.warn(`Imagem muito grande (${imageBuffer.byteLength} bytes), será truncada`);
      }
      
      const uint8Array = new Uint8Array(imageBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const imageBase64 = btoa(binary);
      
      if (!imageBase64) {
        throw new Error('API não retornou imagem em formato esperado');
      }

      return new Response(
        JSON.stringify({ 
          image: imageBase64,
          cost: imageResult.cost,
          seed: imageResult.seed,
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

  } catch (error) {
    console.error('Erro ao editar imagem:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao editar imagem',
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
