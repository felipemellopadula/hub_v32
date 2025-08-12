import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      } = body;

      const ALLOWED_MODELS = new Set([
        "google:veo-3@fast",
        "minimax:1@1",
        "klingai:5@3",
      ]);
      const normalizeModel = (input?: string): string => {
        if (typeof input === "string" && ALLOWED_MODELS.has(input)) return input;
        if (input?.startsWith("google:veo-3")) return "google:veo-3@fast";
        // Fallback seguro
        return "minimax:1@1";
      };

      if (!positivePrompt || !width || !height) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const taskUUID = crypto.randomUUID();

      const tasks: any[] = [
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "videoInference",
          taskUUID,
          model: normalizeModel(modelId || model),
          positivePrompt,
          duration,
          width,
          height,
          fps: 24,
          numberResults,
          outputType: "URL",
          outputFormat,
          deliveryMethod: "async",
        },
      ];

      console.log("[runware-video] start -> tasks:", tasks);


      const frameImages: any[] = [];
      if (frameStartUrl) frameImages.push({ inputImage: frameStartUrl, frame: "first" });
      if (frameEndUrl) frameImages.push({ inputImage: frameEndUrl, frame: "last" });
      if (frameImages.length > 0) {
        tasks[1].frameImages = frameImages;
      }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });

      const json = await res.json().catch(async (e) => {
        const text = await res.text().catch(() => "<no body>");
        console.error("[runware-video] start -> JSON parse error:", e, text);
        throw new Error("Invalid JSON from Runware (start)");
      });

      console.log("[runware-video] start -> response:", res.status, json);


      if (!res.ok || json.errors) {
        const message = json.errors?.[0]?.message || json.error || `Runware error (${res.status})`;
        console.error("[runware-video] start -> error:", message, json);
        return new Response(JSON.stringify({ error: message, details: json, status: res.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
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

      console.log("[runware-video] status -> tasks:", tasks);

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

      console.log("[runware-video] status -> response:", res.status, json);

      if (!res.ok || json.errors) {
        const message = json.errors?.[0]?.message || json.error || `Runware error (${res.status})`;
        console.error("[runware-video] status -> error:", message, json);
        return new Response(JSON.stringify({ error: message, details: json, status: res.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      // Extract first successful video item if present
      const dataItem = Array.isArray(json.data)
        ? json.data.find((d: any) => d.status === "success" && (d.videoURL || d.url)) || json.data[0]
        : null;

      return new Response(JSON.stringify({ raw: json, result: dataItem || null }), {
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
