import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ANONYMOUS-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const { planId } = await req.json();
    if (!planId) throw new Error("planId is required");
    logStep("Plan ID received", { planId });

    // Initialize Supabase to get price info
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get price from stripe_products table
    const { data: product, error: productError } = await supabase
      .from("stripe_products")
      .select("stripe_price_id, plan_name, tokens_included")
      .eq("plan_id", planId)
      .eq("active", true)
      .single();

    if (productError || !product) {
      logStep("Product not found", { planId, error: productError });
      throw new Error(`Plano '${planId}' não encontrado ou inativo`);
    }
    logStep("Product found", { 
      planName: product.plan_name, 
      priceId: product.stripe_price_id 
    });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://synergy.lovable.app";
    logStep("Origin", { origin });

    // Create checkout session without requiring authentication
    // Stripe will collect email and name during checkout
    // Note: customer_creation is NOT used with mode: "subscription" - Stripe creates customer automatically
    logStep("Creating Stripe checkout session", {
      priceId: product.stripe_price_id,
      planId,
      origin,
      mode: "subscription"
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: product.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      // Collect billing address for better fraud protection
      billing_address_collection: "required",
      // Store plan info in metadata for the webhook
      metadata: {
        plan_id: planId,
        plan_name: product.plan_name,
        tokens_included: product.tokens_included.toString(),
      },
      // Allow promo codes
      allow_promotion_codes: true,
    });

    logStep("Checkout session created successfully", { 
      sessionId: session.id, 
      url: session.url?.substring(0, 50) + "..."
    });

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url 
    });

    return new Response(
      JSON.stringify({ 
        url: session.url, 
        sessionId: session.id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
