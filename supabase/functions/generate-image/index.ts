import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as b64encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIO GENERATE-IMAGE DEBUG ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    if (!RUNWARE_API_KEY) {
      console.error('RUNWARE_API_KEY não configurada');
      throw new Error('RUNWARE_API_KEY não configurada');
    }

    const body = await req.json().catch(() => ({}));
    console.log('Request body recebido:', JSON.stringify(body, null, 2));

    const prompt: string | undefined = body.prompt ?? body.positivePrompt;
    if (!prompt) {
      console.error('Prompt ausente no body:', body);
      return new Response(
        JSON.stringify({ error: 'Parâmetros inválidos: prompt ausente' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Obter usuário autenticado a partir do JWT para vincular a imagem
    const authHeader = req.headers.get('Authorization') ?? '';
    let userId: string | null = null;
    if (SUPABASE_URL && SUPABASE_ANON_KEY && authHeader) {
      try {
        const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        userId = user?.id ?? null;
        console.log('User ID obtido:', userId);
      } catch (e) {
        console.warn('Não foi possível obter o usuário:', e);
      }
    }

    const model: string = (typeof body.model === 'string' && body.model.trim()) ? body.model : 'runware:100@1';
    console.log('Modelo selecionado:', model);
    
    // Resolver dimensões baseado no modelo
    let width = 1024;
    let height = 1024;
    
    // Modelos Google (como google:4@1 - Gemini Flash) não suportam width/height
    const isGoogleModel = model.startsWith('google:');
    // Nano Banana 2 Pro (google:4@2) suporta dimensões customizadas, diferente do Gemini Flash (google:4@1)
    const isNanoBanana2Pro = model === 'google:4@2';
    // Modelos que suportam dimensões altas - Seedream especificamente suporta até 4096x4096
    const isHighResModel = model === 'bytedance:5@0' || model.startsWith('bytedance:seedream') || model === 'ideogram:4@1' || model === 'bfl:3@1' || model === 'google:4@2';
    // Seedream models (both old and new IDs)
    const isSeedreamModel = model === 'bytedance:5@0' || model.startsWith('bytedance:seedream');
    // Qwen-Image tem limite de pixels: máximo 1048576 pixels (1024x1024)
    const isQwenModel = model === 'runware:108@1';
    
    console.log('isGoogleModel:', isGoogleModel, 'isHighResModel:', isHighResModel, 'isSeedream:', isSeedreamModel, 'isQwen:', isQwenModel);
    
    // Apenas processar dimensões para modelos que suportam width/height
    // Nano Banana 2 Pro (google:4@2) suporta dimensões customizadas
    if (!isGoogleModel || isNanoBanana2Pro) {
      // Para Ideogram, usar dimensões específicas suportadas pela API
      if (model === 'ideogram:4@1') {
        console.log('Ideogram detectado - aplicando mapeamento de dimensões suportadas');
        
        // Calcular a proporção das dimensões solicitadas
        const requestedWidth = Number(body.width) || 1024;
        const requestedHeight = Number(body.height) || 1024;
        const requestedRatio = requestedWidth / requestedHeight;
        
        console.log('Dimensões solicitadas:', { requestedWidth, requestedHeight, ratio: requestedRatio });
        
        // Mapeamento direto para dimensões suportadas pelo Ideogram v3
        // Baseado no erro da API que lista todas as dimensões válidas
        if (requestedRatio >= 2.05 && requestedRatio <= 2.15) {
          // Formato 21:10 (2.1 ratio) - usar 1344x640
          width = 1344;
          height = 640;
          console.log('Formato 21:10 detectado - usando 1344x640');
        } else if (requestedWidth === 1600 && requestedHeight === 762) {
          // Detecção específica para 1600x762 (que é 21:10 aproximadamente)
          width = 1344;
          height = 640;
          console.log('Dimensões 1600x762 detectadas - convertendo para 1344x640 (21:10)');
        } else if (requestedRatio >= 2.95 && requestedRatio <= 3.05) {
          // Formato 3:1
          width = 1536;
          height = 512;
          console.log('Formato 3:1 detectado - usando 1536x512');
        } else if (requestedRatio >= 1.9 && requestedRatio <= 2.05) {
          // Formato 2:1
          width = 1408;
          height = 704;
          console.log('Formato ~2:1 detectado - usando 1408x704');
        } else if (requestedRatio >= 1.7 && requestedRatio <= 1.9) {
          // Formato 7:4 (1.75)
          width = 1344;
          height = 768;
          console.log('Formato ~7:4 detectado - usando 1344x768');
        } else if (requestedRatio >= 1.4 && requestedRatio <= 1.7) {
          // Formato 3:2 (1.5)
          width = 1248;
          height = 832;
          console.log('Formato ~3:2 detectado - usando 1248x832');
        } else if (requestedRatio >= 1.2 && requestedRatio <= 1.4) {
          // Formato 4:3 (1.33)
          width = 1152;
          height = 864;
          console.log('Formato ~4:3 detectado - usando 1152x864');
        } else if (requestedRatio >= 0.9 && requestedRatio <= 1.1) {
          // Formato 1:1 (square)
          width = 1024;
          height = 1024;
          console.log('Formato quadrado detectado - usando 1024x1024');
        } else if (requestedRatio >= 0.7 && requestedRatio <= 0.9) {
          // Formato 4:5 (0.8)
          width = 896;
          height = 1120;
          console.log('Formato ~4:5 detectado - usando 896x1120');
        } else if (requestedRatio >= 0.5 && requestedRatio <= 0.7) {
          // Formato 2:3 (0.67)
          width = 832;
          height = 1248;
          console.log('Formato ~2:3 detectado - usando 832x1248');
        } else {
          // Default para proporções não reconhecidas
          width = 1024;
          height = 1024;
          console.log('Proporção não reconhecida - usando default 1024x1024');
        }
        
      } else {
        // Lógica original para outros modelos
        if (typeof body.size === 'string' && /^(\d+)x(\d+)$/.test(body.size)) {
          const sizeParts = body.size.split('x');
          const w = parseInt(sizeParts[0], 10);
          const h = parseInt(sizeParts[1], 10);
          if (Number.isFinite(w) && Number.isFinite(h)) {
            width = w; 
            height = h;
          }
        } else {
          // Definir limites baseados no modelo
          let maxDimension = 2048;
          if (isSeedreamModel) {
            maxDimension = 4096; // Seedream 4.5 max is 4096, min pixels is 3.6M
            console.log('Seedream detectado - limite máximo ajustado para:', maxDimension);
          } else if (isNanoBanana2Pro) {
            maxDimension = 6144; // Suporta até 4K (6336x2688 para 21:9)
            console.log('Nano Banana 2 Pro detectado - limite máximo ajustado para:', maxDimension);
          } else if (isHighResModel) {
            maxDimension = 8192;
          }
          
          console.log('Dimensões solicitadas - width:', body.width, 'height:', body.height);
          console.log('MaxDimension para o modelo:', maxDimension);
          
          // Qwen-Image tem limite específico de pixels
          if (isQwenModel) {
            const requestedWidth = Number(body.width) || 1024;
            const requestedHeight = Number(body.height) || 1024;
            const requestedPixels = requestedWidth * requestedHeight;
            
            console.log('Qwen-Image detectado - pixels solicitados:', requestedPixels, 'limite:', 1048576);
            
            if (requestedPixels > 1048576) {
              // Manter proporção mas reduzir para o máximo permitido
              const ratio = requestedWidth / requestedHeight;
              const maxPixels = 1048576;
              
              if (ratio >= 1) {
                // Landscape ou square
                width = Math.floor(Math.sqrt(maxPixels * ratio));
                height = Math.floor(maxPixels / width);
              } else {
                // Portrait
                height = Math.floor(Math.sqrt(maxPixels / ratio));
                width = Math.floor(maxPixels / height);
              }
              
              // Garantir que não excede o limite
              if (width * height > maxPixels) {
                width = 1024;
                height = 1024;
              }
              
              console.log('Dimensões ajustadas para Qwen-Image:', { width, height, pixels: width * height });
            } else {
              width = requestedWidth;
              height = requestedHeight;
            }
          } else {
            // Para outros modelos
            if (Number.isFinite(body.width)) {
              const requestedWidth = Number(body.width);
              if (requestedWidth > maxDimension) {
                console.warn(`Width ${requestedWidth} excede limite ${maxDimension} para modelo ${model}`);
              }
              width = Math.max(64, Math.min(maxDimension, requestedWidth));
            }
            
            if (Number.isFinite(body.height)) {
              const requestedHeight = Number(body.height);
              if (requestedHeight > maxDimension) {
                console.warn(`Height ${requestedHeight} excede limite ${maxDimension} para modelo ${model}`);
              }
              height = Math.max(64, Math.min(maxDimension, requestedHeight));
            }
          }
        }
      }
    }
    
    console.log('Dimensões finais:', { width, height });

    const numberResults: number = Math.max(1, Math.min(4, Number(body.numberResults) || 1));
    // Usar WEBP para imagens grandes para economizar recursos
    let outputFormat: string = (typeof body.outputFormat === 'string' && body.outputFormat) || 'WEBP';
    
    const isGptModel = model === 'openai:1@1';
    
    if (isQwenModel) {
      outputFormat = 'WEBP';
      console.log('Qwen-Image detectado - forçando formato WEBP para reduzir tamanho do arquivo');
    }
    
    // Para GPT: forçar WEBP em paisagem/retrato (>1024px) para evitar arquivos grandes
    if (isGptModel && (width > 1024 || height > 1024)) {
      outputFormat = 'WEBP';
      console.log('GPT paisagem/retrato detectado - forçando formato WEBP para reduzir tamanho do arquivo');
    }
    
    // Para imagens grandes (2K+), forçar WEBP para reduzir tamanho do arquivo
    // Inclui Nano Banana 2 Pro para suportar 4K
    if ((width >= 2048 || height >= 2048) && (!isGoogleModel || isNanoBanana2Pro)) {
      outputFormat = 'WEBP';
      console.log('Imagem 2K+ detectada - forçando formato WEBP para reduzir tamanho do arquivo');
    }
    
    console.log('Parâmetros:', { numberResults, outputFormat });

    const taskUUID = crypto.randomUUID();
    console.log('Task UUID gerado:', taskUUID);

    // Montar payload para Runware, evitando "strength" em GPT-Image-1
    const attach: any = {};
    if (body.inputImage) {
      attach.inputImage = body.inputImage;
      // "strength" NÃO é suportado na arquitetura gpt_image_1 (GPT-Image-1)
      if (model !== 'openai:1@1' && typeof body.strength === 'number') {
        attach.strength = body.strength;
      }
      console.log('Imagem anexada, attach:', Object.keys(attach));
    }

    // Preparar o objeto de inferência baseado no modelo
    const inferenceObject: any = {
      taskType: 'imageInference',
      taskUUID,
      positivePrompt: prompt,
      model,
      numberResults,
      outputFormat,
      ...attach,
    };

    // Apenas adicionar width/height para modelos que suportam
    // Nano Banana 2 Pro (google:4@2) suporta width/height, diferente do Gemini Flash (google:4@1)
    if (!isGoogleModel || isNanoBanana2Pro) {
      inferenceObject.width = width;
      inferenceObject.height = height;
      
      // Log específico para Seedream
      if (isSeedreamModel) {
        console.log('=== SEEDREAM CONFIGURATION ===');
        console.log('Modelo Seedream detectado:', model);
        console.log('Dimensões finais:', { width, height });
        console.log('É resolução 4K?', (width >= 4096 || height >= 4096));
        console.log('Dimensões solicitadas originais:', { originalWidth: body.width, originalHeight: body.height });
      }
      
      // Log específico para Nano Banana 2 Pro
      if (isNanoBanana2Pro) {
        console.log('=== NANO BANANA 2 PRO CONFIGURATION ===');
        console.log('Modelo Nano Banana 2 Pro detectado:', model);
        console.log('Dimensões finais:', { width, height });
        console.log('É resolução 4K?', (width >= 4096 || height >= 4096));
        console.log('Dimensões solicitadas originais:', { originalWidth: body.width, originalHeight: body.height });
      }
    }
    
    console.log('Objeto de inferência final:', JSON.stringify(inferenceObject, null, 2));

    const tasks: any[] = [
      { taskType: 'authentication', apiKey: RUNWARE_API_KEY },
      inferenceObject,
    ];
    
    console.log('Tasks completas para envio:', JSON.stringify(tasks, null, 2));

    console.log('Enviando requisição para Runware...');
    const rwRes = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    });
    
    console.log('Status da resposta Runware:', rwRes.status, rwRes.statusText);

    if (!rwRes.ok) {
      const err = await rwRes.text();
      console.error('Runware error response:', err);
      console.error('Request body que causou erro:', JSON.stringify(tasks, null, 2));
      return new Response(
        JSON.stringify({ 
          error: 'Falha ao gerar imagem (Runware)', 
          details: err,
          model: model,
          dimensions: { width, height },
          requestBody: tasks
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rwData = await rwRes.json();
    console.log('Resposta completa da Runware:', JSON.stringify(rwData, null, 2));
    
    const dataArray = Array.isArray(rwData?.data) ? rwData.data : (Array.isArray(rwData) ? rwData : []);
    console.log('Data array processado:', dataArray.length, 'items');

    // Filtrar TODAS as imagens retornadas pela API
    const imageItems = dataArray.filter((d: any) => d?.taskType === 'imageInference' && (d.imageURL || d.imageUrl || d.image_url));
    console.log(`${imageItems.length} imagens encontradas na resposta`);
    
    if (imageItems.length === 0) {
      console.error('Nenhuma URL de imagem encontrada na resposta');
      return new Response(
        JSON.stringify({ error: 'Resposta inválida da Runware', details: rwData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar imagens SEQUENCIALMENTE para evitar estouro de memória
    // Promise.all processa todas ao mesmo tempo, causando pico de memória ~25-30MB
    // Loop sequencial mantém pico em ~8MB (uma imagem por vez)
    console.log(`Iniciando processamento SEQUENCIAL de ${imageItems.length} imagens...`);
    
    const processedImages: any[] = [];
    
    for (let index = 0; index < imageItems.length; index++) {
      const item = imageItems[index];
      const imageURL: string = item.imageURL || item.imageUrl || item.image_url;
      console.log(`[Imagem ${index + 1}/${imageItems.length}] Processando: ${imageURL}`);

      try {
        // Baixar imagem com retry
        let imgRes: Response | null = null;
        let lastError: string = '';
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Imagem ${index + 1}] Tentativa ${attempt}/${maxRetries} de download...`);
            imgRes = await fetch(imageURL, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ImageDownloader/1.0)',
                'Accept': 'image/*',
              }
            });
            
            if (imgRes.ok) {
              console.log(`[Imagem ${index + 1}] Download bem sucedido na tentativa ${attempt}`);
              break;
            }
            
            lastError = `Status ${imgRes.status}: ${imgRes.statusText}`;
            const responseText = await imgRes.text();
            console.warn(`[Imagem ${index + 1}] Tentativa ${attempt} falhou: ${lastError}, Body: ${responseText.slice(0, 200)}`);
            
            if (attempt < maxRetries) {
              const delay = attempt * 1000;
              console.log(`[Imagem ${index + 1}] Aguardando ${delay}ms antes de retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (fetchError) {
            lastError = fetchError instanceof Error ? fetchError.message : String(fetchError);
            console.warn(`[Imagem ${index + 1}] Tentativa ${attempt} erro de fetch: ${lastError}`);
            
            if (attempt < maxRetries) {
              const delay = attempt * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (!imgRes || !imgRes.ok) {
          console.error(`[Imagem ${index + 1}] Todas as tentativas falharam: ${lastError}`);
          console.log(`[Imagem ${index + 1}] Continuando com as próximas imagens...`);
          processedImages.push(null);
          continue;
        }

        const ab = await imgRes.arrayBuffer();
        console.log(`[Imagem ${index + 1}] ArrayBuffer size: ${ab.byteLength} bytes`);
        
        // Verificar tamanho - limites ajustados para 4K
        let maxSize = 5 * 1024 * 1024; // 5MB padrão
        if (width >= 4096 || height >= 4096) {
          maxSize = 50 * 1024 * 1024; // 50MB para 4K+
        } else if (width >= 2048 || height >= 2048) {
          maxSize = 20 * 1024 * 1024; // 20MB para 2K+
        }
        
        if (ab.byteLength > maxSize) {
          console.error(`[Imagem ${index + 1}] Muito grande:`, ab.byteLength, 'bytes');
          console.log(`[Imagem ${index + 1}] Continuando com as próximas imagens...`);
          processedImages.push(null);
          continue;
        }
        
        const b64 = b64encode(ab);
        
        // Inferir formato
        let format: string = 'webp';
        if (imageURL.endsWith('.webp')) format = 'webp';
        else if (imageURL.endsWith('.png')) format = 'png';
        else if (imageURL.endsWith('.jpg')) format = 'jpg';
        else if (imageURL.endsWith('.jpeg')) format = 'jpeg';
        
        console.log(`[Imagem ${index + 1}] Formato: ${format}, Base64 length: ${b64.length}`);

        // Salvar no Storage se usuário autenticado
        if (userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            const ext = format.toLowerCase();
            const timestamp = Date.now();
            const path = `user-images/${userId}/${timestamp}-${crypto.randomUUID()}.${ext}`;
            const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            
            const upload = await supabaseAdmin.storage.from('images').upload(path, ab, { contentType });
            if (upload.error) {
              console.error(`[Imagem ${index + 1}] Erro upload Storage:`, upload.error);
            } else {
              console.log(`[Imagem ${index + 1}] Upload OK: ${path}`);
              const { error: insertErr } = await supabaseAdmin
                .from('user_images')
                .insert({ user_id: userId, image_path: path, prompt, width, height, format: ext });
              
              if (insertErr) {
                console.error(`[Imagem ${index + 1}] Erro inserir DB:`, insertErr);
              } else {
                console.log(`[Imagem ${index + 1}] Registro inserido no banco`);
                
                // Registrar custo apenas na PRIMEIRA imagem (evitar duplicação)
                if (index === 0) {
                  try {
                    const IMAGE_COSTS: Record<string, number> = {
                      'gpt-image-1': 0.167, 'gemini-flash': 0.039, 'qwen-image': 0.0058,
                      'ideogram-3.0': 0.06, 'flux.1-kontext-max': 0.08, 'flux.2-pro': 0.045, 'seedream-4.0': 0.03,
                      'seedream-4.5': 0.03, 'runware:100@1': 0.04, 'runware:101@1': 0.04, 'openai:1@1': 0.167,
                      'google:4@1': 0.039, 'google:4@2': 0.08, 'ideogram:4@1': 0.06, 'bfl:3@1': 0.08,
                      'bfl:4@1': 0.045, 'bytedance:5@0': 0.03, 'bytedance:seedream@4.5': 0.03, 'runware:108@1': 0.0058,
                    };
                    
                    let modelCost = 0.02;
                    let modelForTracking = model || 'unknown';
                    
                    if (model === 'openai:1@1') {
                      modelForTracking = 'gpt-image-1';
                      modelCost = IMAGE_COSTS['gpt-image-1'] || 0.167;
                    } else if (model === 'google:4@1') {
                      modelForTracking = 'gemini-flash-image';
                      modelCost = IMAGE_COSTS['google:4@1'] || 0.039;
                    } else if (model === 'google:4@2') {
                      modelForTracking = 'nano-banana-2-pro';
                      modelCost = IMAGE_COSTS['google:4@2'] || 0.08;
                    } else if (model === 'runware:108@1') {
                      modelForTracking = 'qwen-image';
                      modelCost = IMAGE_COSTS['qwen-image'] || 0.0058;
                    } else if (model === 'ideogram:4@1') {
                      modelForTracking = 'ideogram-3.0';
                      modelCost = IMAGE_COSTS['ideogram-3.0'] || 0.06;
                    } else if (model === 'bfl:3@1') {
                      modelForTracking = 'flux.1-kontext-max';
                      modelCost = IMAGE_COSTS['flux.1-kontext-max'] || 0.08;
                    } else if (model === 'bfl:4@1') {
                      modelForTracking = 'flux.2-pro';
                      modelCost = IMAGE_COSTS['flux.2-pro'] || 0.045;
                    } else if (model === 'bytedance:5@0') {
                      modelForTracking = 'seedream-4.0';
                      modelCost = IMAGE_COSTS['seedream-4.0'] || 0.03;
                    } else if (model === 'bytedance:seedream@4.5' || model?.startsWith('bytedance:seedream')) {
                      modelForTracking = 'seedream-4.5';
                      modelCost = IMAGE_COSTS['seedream-4.5'] || 0.03;
                    } else if (model === 'runware:100@1' || model === 'runware:101@1') {
                      modelForTracking = 'flux-context';
                      modelCost = IMAGE_COSTS['runware:100@1'] || 0.04;
                    } else {
                      for (const [modelName, cost] of Object.entries(IMAGE_COSTS)) {
                        if (model && model.toLowerCase().includes(modelName.toLowerCase())) {
                          modelForTracking = modelName;
                          modelCost = cost;
                          break;
                        }
                      }
                    }
                    
                    console.log(`Registrando custo: ${imageItems.length}x imagens, modelo=${modelForTracking}, custo=$${modelCost * imageItems.length}`);
                    
                    const { error: usageErr } = await supabaseAdmin
                      .from('token_usage')
                      .insert({
                        user_id: userId,
                        model_name: modelForTracking,
                        message_content: `${prompt || 'Image generation request'} (${imageItems.length}x images)`,
                        ai_response_content: `${imageItems.length} image(s) generated successfully`,
                        tokens_used: imageItems.length,
                        input_tokens: imageItems.length,
                        output_tokens: imageItems.length,
                      });
                    
                    if (usageErr) {
                      console.error('Erro ao inserir token_usage:', usageErr);
                    } else {
                      console.log('Custo registrado no token_usage');
                    }
                  } catch (costErr) {
                    console.error('Erro ao calcular/registrar custo:', costErr);
                  }
                }
              }
            }
          } catch (e) {
            console.error(`[Imagem ${index + 1}] Erro ao salvar:`, e);
          }
        }

        processedImages.push({ image: b64, url: imageURL, width, height, format });
        console.log(`[Imagem ${index + 1}] Processamento completo. Total processadas: ${processedImages.filter(img => img !== null).length}`);
        
      } catch (error) {
        console.error(`[Imagem ${index + 1}] Erro no processamento:`, error);
        processedImages.push(null);
        console.log(`[Imagem ${index + 1}] Continuando com as próximas imagens...`);
      }
    }

    // Filtrar imagens que deram erro (null)
    const successfulImages = processedImages.filter(img => img !== null);
    
    if (successfulImages.length === 0) {
      console.error('Todas as imagens falharam no processamento');
      return new Response(
        JSON.stringify({ error: 'Falha ao processar todas as imagens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`=== SUCESSO - ${successfulImages.length}/${imageItems.length} imagens processadas ===`);
    return new Response(
      JSON.stringify({ 
        images: successfulImages,
        count: successfulImages.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('=== ERRO DETALHADO NA FUNÇÃO GENERATE-IMAGE ===');
    console.error('Erro capturado:', error);
    console.error('Tipo do erro:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'N/A');
    
    // Se for erro específico do Seedream em alta resolução
    if (error instanceof Error && error.message.includes('Seedream')) {
      console.error('ERRO SEEDREAM 4K detectado');
      return new Response(
        JSON.stringify({ 
          error: 'Seedream 4.0 não suporta resoluções acima de 4096x4096 pixels',
          details: 'Por favor, use resoluções menores ou tente outro modelo para imagens 4K'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro inesperado na geração de imagem',
        details: String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});