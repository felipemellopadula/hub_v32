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
        "bytedance:seedance@1",
        "google:veo-3@fast",
        "minimax:hailuo@2",
        "klingai:2@1",
      ]);
      const normalizeModel = (input?: string): string => {
        if (typeof input === "string" && ALLOWED_MODELS.has(input)) return input;
        if (input?.startsWith("bytedance:seedance")) return "bytedance:seedance@1";
        if (input?.startsWith("google:veo-3")) return "google:veo-3@fast";
        if (input?.startsWith("minimax:hailuo")) return "minimax:hailuo@2";
        if (input?.startsWith("klingai")) return "klingai:2@1";
        return "bytedance:seedance@1";
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
          numberResults,
          outputType: "URL",
          outputFormat,
          deliveryMethod: "async",
        },
      ];

      const frameImages: any[] = [];
      if (frameStartUrl) frameImages.push({ inputImageURL: frameStartUrl, frame: "first" });
      if (frameEndUrl) frameImages.push({ inputImageURL: frameEndUrl, frame: "last" });
      if (frameImages.length > 0) {
        tasks[1].frameImages = frameImages;
      }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });

      const json = await res.json();

      if (!res.ok || json.errors) {
        return new Response(JSON.stringify({ error: json.errors?.[0]?.message || "Runware error", details: json }), {
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

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });
      const json = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: json.errors?.[0]?.message || "Runware error", details: json }), {
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
    return new Response(JSON.stringify({ error: (err as Error).message || "Unexpected error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
