import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client com service role para operações admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Verificar se usuário já existe
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      console.log("Usuário já existe, atualizando...");
      userId = existingUser.id;
      
      // Atualizar senha se necessário
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true
      });
    } else {
      // 2. Criar novo usuário
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Confirmar email automaticamente
        user_metadata: { name: name || "Admin User" }
      });

      if (createError) {
        console.error("Erro ao criar usuário:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      console.log("Usuário criado:", userId);
    }

    // 3. Aguardar trigger criar o profile (se não existir)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Verificar se profile existe
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!profile) {
      // Criar profile manualmente se o trigger não funcionou
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
          email,
          name: name || "Admin User",
          subscription_type: "admin",
          tokens_remaining: 999999,
          is_legacy_user: true, // Legacy = sem limite de créditos
          is_password_set: true
        });

      if (insertError) {
        console.error("Erro ao criar profile:", insertError);
      }
    } else {
      // 5. Atualizar profile para plano máximo
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_type: "admin",
          tokens_remaining: 999999,
          is_legacy_user: true, // Legacy users têm acesso ilimitado
          is_password_set: true
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Erro ao atualizar profile:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Adicionar como admin_user
    const { error: adminError } = await supabaseAdmin
      .from("admin_users")
      .upsert({
        user_id: userId,
        created_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (adminError) {
      console.log("Nota: Erro ao adicionar admin_users (pode já existir):", adminError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Usuário criado/atualizado com sucesso!",
        user_id: userId,
        email,
        plan: "admin",
        credits: 999999,
        is_legacy: true
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});