import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CreditValidationResult {
  isValid: boolean;
  isLegacyUser: boolean;
  userId: string;
  creditsRemaining: number;
  error?: string;
}

/**
 * Valida se o usuário tem créditos suficientes e deduz o custo
 * Para usuários legados (is_legacy_user = true), apenas registra uso sem deduzir
 * Para novos usuários (is_legacy_user = false), valida e deduz créditos
 */
export async function validateAndDeductCredits(
  supabase: SupabaseClient,
  userId: string,
  cost: number,
  actionType: string,
  description?: string
): Promise<CreditValidationResult> {
  try {
    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_legacy_user, tokens_remaining")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[credit-validation] Erro ao buscar perfil:", profileError);
      return {
        isValid: false,
        isLegacyUser: false,
        userId,
        creditsRemaining: 0,
        error: "Perfil não encontrado",
      };
    }

    const isLegacyUser = profile.is_legacy_user ?? false;
    const creditsRemaining = profile.tokens_remaining ?? 0;

    console.log(`[credit-validation] User ${userId}: isLegacy=${isLegacyUser}, credits=${creditsRemaining}, cost=${cost}`);

    // Para usuários legados, apenas registra uso (mantém comportamento antigo)
    if (isLegacyUser) {
      console.log("[credit-validation] ✅ Usuário legado - permitindo sem dedução de créditos");
      return {
        isValid: true,
        isLegacyUser: true,
        userId,
        creditsRemaining,
      };
    }

    // Para novos usuários, verificar se tem créditos suficientes
    if (creditsRemaining < cost) {
      console.log(`[credit-validation] ❌ Créditos insuficientes: ${creditsRemaining} < ${cost}`);
      return {
        isValid: false,
        isLegacyUser: false,
        userId,
        creditsRemaining,
        error: `Créditos insuficientes. Você tem ${creditsRemaining} créditos, mas precisa de ${cost}.`,
      };
    }

    // Deduzir créditos
    const newBalance = creditsRemaining - cost;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ tokens_remaining: newBalance })
      .eq("id", userId);

    if (updateError) {
      console.error("[credit-validation] Erro ao deduzir créditos:", updateError);
      return {
        isValid: false,
        isLegacyUser: false,
        userId,
        creditsRemaining,
        error: "Erro ao deduzir créditos",
      };
    }

    console.log(`[credit-validation] ✅ Créditos deduzidos: ${creditsRemaining} - ${cost} = ${newBalance}`);

    // Registrar uso
    await supabase.from("token_usage").insert({
      user_id: userId,
      model_name: actionType,
      message_content: description || actionType,
      ai_response_content: `Credit consumption: ${cost}`,
      tokens_used: cost,
      input_tokens: cost,
      output_tokens: 0,
    });

    return {
      isValid: true,
      isLegacyUser: false,
      userId,
      creditsRemaining: newBalance,
    };
  } catch (error) {
    console.error("[credit-validation] Erro inesperado:", error);
    return {
      isValid: false,
      isLegacyUser: false,
      userId,
      creditsRemaining: 0,
      error: "Erro interno ao validar créditos",
    };
  }
}

/**
 * Calcula o custo de upscale baseado nas dimensões da imagem
 * ≤1K: 0.005 crédito (200 upscales por crédito)
 * ≤2K: 0.01 crédito (100 upscales por crédito)
 * ≤4K: 0.02 crédito (50 upscales por crédito)
 */
export function calculateUpscaleCost(width: number, height: number): number {
  const maxDimension = Math.max(width, height);

  if (maxDimension > 4096) {
    return -1; // Indica que deve bloquear
  }
  if (maxDimension <= 1024) {
    return 0.005; // 1K: 200 upscales por crédito
  }
  if (maxDimension <= 2048) {
    return 0.01; // 2K: 100 upscales por crédito
  }
  return 0.02; // 4K: 50 upscales por crédito
}

/**
 * Calcula o custo de vídeo baseado no modelo
 * Custos arredondados de 0.5 em 0.5:
 * - MiniMax: 0.5 créditos (2 vídeos por crédito)
 * - Seedance: 1.0 crédito
 * - Kling 2.6 Pro: 1.5 créditos
 * - Sora 2: 1.5 créditos
 * - Veo 3.1: 3.0 créditos
 * - Sora 2 Pro: 4.0 créditos
 */
export function calculateVideoCost(modelId: string): number {
  // Sora 2 Pro = 4.0 créditos
  if (modelId === 'openai:3@2') return 4.0;
  
  // Veo 3.1 = 3.0 créditos
  if (modelId.includes('google:3@')) return 3.0;
  
  // LTX-2 Pro = 2.0 créditos
  if (modelId === 'lightricks:2@0') return 2.0;
  
  // Sora 2 = 1.5 créditos
  if (modelId === 'openai:3@1') return 1.5;
  
  // Kling 2.6 Pro = 1.5 créditos
  if (modelId.includes('klingai:')) return 1.5;
  
  // LTX-2 Fast = 1.5 créditos
  if (modelId === 'lightricks:2@1') return 1.5;
  
  // Seedance (ByteDance) = 1.0 crédito
  if (modelId.includes('bytedance:') || modelId.includes('seedance')) return 1.0;
  
  // MiniMax = 0.5 créditos (2 vídeos por crédito)
  return 0.5;
}

/**
 * Cria resposta de erro 402 para créditos insuficientes
 */
export function createInsufficientCreditsResponse(
  creditsRemaining: number,
  costRequired: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: "insufficient_credits",
      message: `Créditos insuficientes. Você tem ${creditsRemaining} créditos, mas precisa de ${costRequired}.`,
      creditsRemaining,
      costRequired,
    }),
    {
      status: 402, // Payment Required
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
