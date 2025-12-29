import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
    if (!RUNWARE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing RUNWARE_API_KEY secret" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    const body = await req.json();
    const action = body.action as "start" | "status";
    console.log("[runware-video] Incoming action:", action, { hasPrompt: !!body?.positivePrompt, width: body?.width, height: body?.height, modelId: body?.modelId, taskUUID: body?.taskUUID });

    const API_URL = "https://api.runware.ai/v1";

    if (action === "start") {
      const {
        modelId,
        model,
        positivePrompt,
        width,
        height,
        duration = 6,
        numberResults = 1,
        frameStartUrl,
        frameEndUrl,
        outputFormat = "MP4",
        // Motion Transfer (Kling 2.6 Pro)
        referenceVideoUrl,
        characterOrientation = "imageOrientation",
        keepOriginalSound = false,
      } = body;

      // Usar exatamente o AIR informado pelo cliente, sem remapeamentos
      // A validação de formato será feita antes de enviar para a Runware

      const resolvedModel = (modelId || model) as string | undefined;
      if (!resolvedModel || typeof resolvedModel !== 'string' || !resolvedModel.includes(':') || !resolvedModel.includes('@')) {
        return new Response(JSON.stringify({ error: "Invalid or missing 'model' AIR. Use provider:id@version (ex: bytedance:seedance@1-lite, klingai:5@3, minimax:hailuo@2)." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const taskUUID = crypto.randomUUID();

      // ✅ Motion Transfer: Kling 2.6 Pro suporta referenceVideoUrl para capturar movimentos
      const isMotionTransfer = referenceVideoUrl && resolvedModel.includes('klingai');
      
      let tasks: any[];
      
      if (isMotionTransfer) {
        // Modo Motion Transfer: usa video como referência de movimento + imagem do personagem
        console.log("[runware-video] 🎬 Motion Transfer mode activated");
        tasks = [
          { taskType: "authentication", apiKey: RUNWARE_API_KEY },
          {
            taskType: "videoInference",
            taskUUID,
            model: resolvedModel,
            positivePrompt,
            duration,
            width,
            height,
            fps: 24,
            numberResults,
            outputFormat: "mp4",
            includeCost: true,
            deliveryMethod: "async",
            // ✅ Motion Control Request parameters
            motionReference: {
              videoUrl: referenceVideoUrl,
              characterOrientation: characterOrientation, // "imageOrientation" ou "videoOrientation"
              keepOriginalSound: keepOriginalSound,
            },
          },
        ];
        
        // Adiciona a imagem do personagem (frameStartUrl) como inputImage para o motion transfer
        if (frameStartUrl) {
          tasks[1].inputImage = frameStartUrl;
        }
      } else {
        // Modo padrão: videoInference normal
        tasks = [
          { taskType: "authentication", apiKey: RUNWARE_API_KEY },
          {
            taskType: "videoInference",
            taskUUID,
            model: resolvedModel,
            positivePrompt,
            duration,
            width,
            height,
            fps: 24,
            numberResults,
            outputFormat: "mp4",
            includeCost: true,
            deliveryMethod: "async",
          },
        ];
      }

      // Adiciona configurações específicas do provider para bytedance
      if (resolvedModel.includes('bytedance')) {
        tasks[1].providerSettings = {
          bytedance: {
            cameraFixed: false
          }
        };
      }

      console.log("[runware-video] start -> resolvedModel", resolvedModel, "motionTransfer:", isMotionTransfer);
      console.log("[runware-video] start -> tasks:", JSON.stringify(tasks, null, 2));

      // Frames de referência (apenas para modo normal, não motion transfer)
      if (!isMotionTransfer) {
        const frameImages: any[] = [];
        if (frameStartUrl) frameImages.push({ inputImage: frameStartUrl, frame: "first" });
        if (frameEndUrl) frameImages.push({ inputImage: frameEndUrl, frame: "last" });
        if (frameImages.length > 0) {
          tasks[1].frameImages = frameImages;
        }
      }

      const makeRequest = async (modelAir: string) => {
        const t = JSON.parse(JSON.stringify(tasks));
        t[1].model = modelAir;
        const r = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t),
        });
        const j = await r.json().catch(async (e) => {
          const text = await r.text().catch(() => "<no body>");
          console.error("[runware-video] start -> JSON parse error:", e, text);
          throw new Error("Invalid JSON from Runware (start)");
        });
        return { r, j };
      };

      // Fazer a requisição inicial com tratamento de erro robusto
      console.log("[runware-video] Calling makeRequest with model:", resolvedModel);
      let res: Response;
      let json: any;
      
      try {
        const result = await makeRequest(resolvedModel);
        if (!result || !result.r || !result.j) {
          console.error("[runware-video] makeRequest returned invalid result:", result);
          return new Response(
            JSON.stringify({ 
              error: "Falha na comunicação com a API de vídeo",
              details: "Resposta inválida do servidor"
            }),
            { status: 500, headers: corsHeaders }
          );
        }
        res = result.r;
        json = result.j;
        console.log("[runware-video] makeRequest succeeded, status:", res.status);
      } catch (makeRequestError) {
        console.error("[runware-video] Error in makeRequest:", makeRequestError);
        return new Response(
          JSON.stringify({ 
            error: "Falha ao conectar com API de vídeo",
            details: makeRequestError instanceof Error ? makeRequestError.message : String(makeRequestError)
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log("[runware-video] start -> response:", res.status, json);

      // ❌ REMOVIDO: fallback automático silencioso
      // Se o modelo falhar, retornar erro claro para o usuário

      if (!res.ok || json.errors) {
        const message = json.errors?.[0]?.message || json.error || `Runware error (${res.status})`;
        console.error("[runware-video] start -> error:", message, json);
        return new Response(JSON.stringify({ error: message, details: json, status: res.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      // ✅ Registrar uso no banco de dados quando vídeo iniciado com sucesso
      try {
        const authHeader = req.headers.get("authorization");
        if (authHeader) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            
            // Extrair user_id do token JWT
            const token = authHeader.replace("Bearer ", "");
            const { data: { user } } = await supabase.auth.getUser(token);
            
            if (user) {
              // Registrar uso de vídeo no token_usage
              await supabase.from("token_usage").insert({
                user_id: user.id,
                model_name: resolvedModel,
                message_content: positivePrompt || "Video generation",
                ai_response_content: "Video generation started successfully",
                tokens_used: 1, // 1 token = 1 vídeo
                input_tokens: 1,
                output_tokens: 1,
              });
              
              console.log("[runware-video] ✅ Uso registrado no banco de dados para user:", user.id);
            }
          }
        }
      } catch (dbError) {
        // Não falhar a request se o registro falhar, apenas logar
        console.error("[runware-video] ⚠️ Erro ao registrar uso no banco:", dbError);
      }

      return new Response(JSON.stringify({ taskUUID, ack: json.data?.[0] || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "status") {
      const { taskUUID } = body;
      if (!taskUUID) {
        return new Response(JSON.stringify({ error: "Missing taskUUID" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const tasks = [
        { taskType: "authentication", apiKey: RUNWARE_API_KEY },
        { taskType: "getResponse", taskUUID },
      ];

      console.log("[runware-video] status -> tasks:", JSON.stringify(tasks, null, 2));

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });
      const json = await res.json().catch(async (e) => {
        const text = await res.text().catch(() => "<no body>");
        console.error("[runware-video] status -> JSON parse error:", e, text);
        throw new Error("Invalid JSON from Runware (status)");
      });

      // ✅ Log detalhado do status
      const dataItem = Array.isArray(json.data) ? json.data[0] : null;
      console.log("[runware-video] status -> response:", res.status, {
        status: dataItem?.status,
        hasVideoURL: !!(dataItem?.videoURL || dataItem?.url),
        taskType: dataItem?.taskType,
        fullData: JSON.stringify(json.data, null, 2)
      });

      if (!res.ok || json.errors) {
        const message = json.errors?.[0]?.message || json.error || `Runware error (${res.status})`;
        console.error("[runware-video] status -> error:", message, json);
        return new Response(JSON.stringify({ error: message, details: json, status: res.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      // ✅ Detectar status de falha explícita da Runware
      if (dataItem?.status === "failed" || dataItem?.status === "error") {
        console.error("[runware-video] status -> VIDEO GENERATION FAILED:", dataItem);
        return new Response(JSON.stringify({ 
          error: "Video generation failed", 
          details: dataItem?.errorMessage || dataItem?.error || "A geração do vídeo falhou no servidor.",
          failed: true 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      // Extract first successful video item if present
      const successItem = Array.isArray(json.data)
        ? json.data.find((d: any) => d.status === "success" && (d.videoURL || d.url)) || dataItem
        : null;

      return new Response(JSON.stringify({ raw: json, result: successItem || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (err) {
    console.error("runware-video function error:", err);
    const message = (err as Error)?.message || "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
