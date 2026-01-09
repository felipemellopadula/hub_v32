import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAndDeductCredits, createInsufficientCreditsResponse } from "../_shared/credit-validation.ts";

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

    // ✅ VALIDAÇÃO DE CRÉDITOS (1 crédito por skin enhancement)
    const creditCost = 1;
    const creditResult = await validateAndDeductCredits(
      supabaseAdmin,
      user.id,
      creditCost,
      'skin-enhancer',
      'Skin enhancement'
    );

    if (!creditResult.isValid) {
      console.log('[skin-enhancer] ❌ Créditos insuficientes');
      return createInsufficientCreditsResponse(creditResult.creditsRemaining, creditCost, corsHeaders);
    }

    console.log(`[skin-enhancer] ✅ Créditos validados. isLegacy=${creditResult.isLegacyUser}, remaining=${creditResult.creditsRemaining}`);

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
    console.log("Full Freepik response:", JSON.stringify(freepikData, null, 2));

    // Extract result - check multiple possible response formats
    let result = null;
    const taskId = freepikData.data?.task_id;
    
    // Check all possible locations where the image URL might be
    if (freepikData.data?.generated?.[0]) {
      console.log("Found result in data.generated[0]");
      result = freepikData.data.generated[0];
    } else if (freepikData.data?.image) {
      console.log("Found result in data.image");
      result = freepikData.data.image;
    } else if (freepikData.data?.url) {
      console.log("Found result in data.url");
      result = freepikData.data.url;
    } else if (typeof freepikData.data === 'string' && freepikData.data.startsWith('http')) {
      console.log("Found result as data string URL");
      result = freepikData.data;
    } else if (freepikData.generated?.[0]) {
      console.log("Found result in generated[0] (top level)");
      result = freepikData.generated[0];
    } else if (freepikData.image) {
      console.log("Found result in image (top level)");
      result = freepikData.image;
    } else if (taskId) {
      console.log("Got task_id, need to poll:", taskId);
      
      // Poll for result - use URL WITHOUT /creative based on Freepik API patterns
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Correct polling URL: /v1/ai/skin-enhancer/{taskId} (no /creative)
        const statusUrl = `https://api.freepik.com/v1/ai/skin-enhancer/${taskId}`;
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
          
          // Check multiple formats in poll response
          if (statusData.data?.status === "COMPLETED") {
            result = statusData.data?.generated?.[0] || statusData.data?.image || statusData.data?.url;
            if (result) break;
          } else if (statusData.data?.status === "FAILED") {
            throw new Error("Skin enhancement task failed");
          }
        } else {
          const errorText = await statusResponse.text();
          console.error(`Status check failed: ${statusResponse.status}`, errorText);
        }

        attempts++;
      }
    } else {
      // Log all keys to help debug
      console.log("Unknown response format. Keys in freepikData:", Object.keys(freepikData));
      console.log("Keys in freepikData.data:", freepikData.data ? Object.keys(freepikData.data) : 'no data');
    }

    if (!result) {
      throw new Error(`No result from skin enhancement. Response structure: ${JSON.stringify(Object.keys(freepikData))}, data keys: ${freepikData.data ? JSON.stringify(Object.keys(freepikData.data)) : 'none'}`);
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
