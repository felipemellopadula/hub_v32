import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FREEPIK_API_KEY) {
      console.error("FREEPIK_API_KEY not configured");
      throw new Error("FREEPIK_API_KEY not configured");
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify user with Supabase
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized");
    }

    console.log("User authenticated:", user.id);

    const body = await req.json();
    const { 
      image, 
      sharpen = 0,
      smart_grain = 2
    } = body;

    if (!image) {
      throw new Error("Image is required");
    }

    console.log("Calling Freepik Skin Enhancer API with params:", { sharpen, smart_grain });
    console.log("Image size (approx):", Math.round(image.length / 1024), "KB");

    // Call Freepik Skin Enhancer API with retry logic
    let freepikResponse: Response | null = null;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt + 1}/3...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
        
        freepikResponse = await fetch("https://api.freepik.com/v1/ai/skin-enhancer/creative", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-freepik-api-key": FREEPIK_API_KEY,
          },
          body: JSON.stringify({
            image,
            sharpen,
            smart_grain,
          }),
        });
        
        if (freepikResponse.ok) {
          break;
        }
      } catch (fetchError) {
        console.error(`Attempt ${attempt + 1} failed:`, fetchError);
        lastError = fetchError as Error;
        freepikResponse = null;
      }
    }
    
    if (!freepikResponse) {
      throw lastError || new Error("Failed to connect to Freepik API after 3 attempts");
    }

    if (!freepikResponse.ok) {
      const errorText = await freepikResponse.text();
      console.error("Freepik API error:", freepikResponse.status, errorText);
      throw new Error(`Freepik API error: ${freepikResponse.status} - ${errorText}`);
    }

    const freepikData = await freepikResponse.json();
    console.log("Freepik response:", JSON.stringify(freepikData));

    // Skin Enhancer API can return results directly (synchronous) or as a task (async)
    let result = null;
    const taskId = freepikData.data?.task_id;
    
    // Check if result is already available (synchronous response)
    if (freepikData.data?.generated && freepikData.data.generated.length > 0) {
      console.log("Got synchronous result from Freepik");
      result = freepikData.data.generated[0];
    } else if (freepikData.data?.status === "COMPLETED" && freepikData.data?.generated?.[0]) {
      console.log("Got completed result from Freepik");
      result = freepikData.data.generated[0];
    } else if (taskId) {
      console.log("Got task_id, need to poll:", taskId);
      
      // Poll for result using POST to same endpoint with task_id
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try polling with POST to /v1/ai/skin-enhancer/creative/{taskId}
        const statusUrl = `https://api.freepik.com/v1/ai/skin-enhancer/creative/${taskId}`;
        console.log(`Polling URL: ${statusUrl}`);
        
        const statusResponse = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "x-freepik-api-key": FREEPIK_API_KEY,
          },
        });
        
        console.log(`Response status: ${statusResponse.status}`);
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`Poll response:`, JSON.stringify(statusData));
          
          if (statusData.data?.status === "COMPLETED" && statusData.data?.generated?.[0]) {
            result = statusData.data.generated[0];
            break;
          } else if (statusData.data?.status === "FAILED") {
            throw new Error("Skin enhancement task failed");
          }
        } else {
          const errorText = await statusResponse.text();
          console.error(`Status check failed: ${statusResponse.status}`, errorText);
        }

        attempts++;
      }
    }

    if (!result) {
      throw new Error("No result from skin enhancement - check API response format");
    }

    console.log("Skin enhancement completed:", result);

    // Try to upload to Supabase Storage
    let finalImageUrl = result;
    
    try {
      // Download the image
      const imageResponse = await fetch(result);
      if (!imageResponse.ok) {
        throw new Error("Failed to download enhanced image");
      }
      
      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();
      
      // Upload to Supabase Storage
      const fileName = `skin-enhanced/${user.id}/${Date.now()}.png`;
      
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("images")
        .upload(fileName, imageBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // Use Freepik URL as fallback
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from("images")
          .getPublicUrl(fileName);
        
        finalImageUrl = publicUrl;
        console.log("Image uploaded to Supabase:", finalImageUrl);
      }
    } catch (uploadError) {
      console.error("Error uploading to storage:", uploadError);
      // Use Freepik URL as fallback
    }

    // Log token usage
    await supabaseAdmin.from("token_usage").insert({
      user_id: user.id,
      model_name: "freepik-skin-enhancer",
      tokens_used: 50, // Estimated cost
      message_content: `Skin enhancement: sharpen=${sharpen}, smart_grain=${smart_grain}`,
      ai_response_content: "Skin enhancement completed successfully",
    });

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: finalImageUrl,
        taskId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in skin-enhancer function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
