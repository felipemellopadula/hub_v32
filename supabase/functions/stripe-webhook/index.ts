import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Webhook error: No signature or secret", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    console.log(`[Webhook] Evento recebido: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const customerEmail = session.customer_details?.email;
        const customerName = session.customer_details?.name || "Usuário";

        console.log(`[Webhook] Checkout completo - Customer: ${customerId}, Email: ${customerEmail}`);

        // Buscar ou criar usuário
        let userId: string | null = session.client_reference_id || session.metadata?.user_id || null;

        // Se não temos userId, buscar pelo email
        if (!userId && customerEmail) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", customerEmail)
            .single();

          if (existingProfile) {
            userId = existingProfile.id;
            console.log(`[Webhook] Usuário existente encontrado: ${userId}`);
          }
        }

        // Se ainda não temos usuário, criar um novo via auth.admin
        if (!userId && customerEmail) {
          console.log(`[Webhook] Criando novo usuário para: ${customerEmail}`);
          
          // Gerar senha temporária segura
          const tempPassword = crypto.randomUUID() + "Aa1!";
          
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: customerEmail,
            password: tempPassword,
            email_confirm: false, // Enviar email de confirmação
            user_metadata: {
              name: customerName,
              created_via: "stripe_checkout"
            }
          });

          if (createError) {
            console.error(`[Webhook] Erro ao criar usuário:`, createError);
            // Tentar buscar se o usuário já existe
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users?.users?.find(u => u.email === customerEmail);
            if (existingUser) {
              userId = existingUser.id;
              console.log(`[Webhook] Usuário já existia no auth: ${userId}`);
            }
          } else if (newUser?.user) {
            userId = newUser.user.id;
            console.log(`[Webhook] Novo usuário criado: ${userId}`);
            
            // O trigger handle_new_user criará o profile automaticamente
            // Mas vamos garantir que existe com os dados corretos
            await new Promise(resolve => setTimeout(resolve, 500)); // Aguardar trigger
          }
        }

        if (!userId) {
          console.error("[Webhook] Não foi possível identificar/criar o usuário");
          // Não quebrar o webhook - logar e continuar
          break;
        }

        // Buscar detalhes da assinatura
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0].price.id;

        // Buscar plano no banco - primeiro pelo price_id, depois pelo metadata
        let product = null;
        const { data: productByPrice } = await supabase
          .from("stripe_products")
          .select("*")
          .eq("stripe_price_id", priceId)
          .single();

        if (productByPrice) {
          product = productByPrice;
        } else if (session.metadata?.plan_id) {
          // Fallback: buscar pelo plan_id do metadata
          const { data: productByPlanId } = await supabase
            .from("stripe_products")
            .select("*")
            .eq("plan_id", session.metadata.plan_id)
            .single();
          product = productByPlanId;
        }

        if (!product) {
          console.error("[Webhook] Produto não encontrado:", priceId);
          break;
        }

        console.log(`[Webhook] Plano identificado: ${product.plan_id}`);

        // Criar registro de assinatura
        const { data: subscriptionData, error: subError } = await supabase
          .from("stripe_subscriptions")
          .insert({
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            status: subscription.status,
            plan_id: product.plan_id,
            price_id: priceId,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            tokens_per_period: product.tokens_included
          })
          .select()
          .single();

        if (subError) {
          console.error("[Webhook] Erro ao criar subscription:", subError);
          break;
        }

        // Determinar subscription_type baseado no plan_id
        let subscriptionType: 'paid' | 'basic' | 'plus' | 'pro' | 'admin' = 'paid';
        const planIdLower = product.plan_id.toLowerCase();
        
        if (planIdLower.includes('plus') || planIdLower.includes('premium') || planIdLower.includes('creator')) {
          subscriptionType = 'plus';
        } else if (planIdLower.includes('pro')) {
          subscriptionType = 'pro';
        } else if (planIdLower.includes('basic') || planIdLower.includes('standard') || planIdLower.includes('start')) {
          subscriptionType = 'basic';
        }

        // Atualizar perfil com tokens, customer_id, subscription_type e current_subscription_id
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            tokens_remaining: product.tokens_included,
            stripe_customer_id: customerId,
            subscription_type: subscriptionType,
            current_subscription_id: subscriptionData?.id,
            name: customerName // Atualizar nome se veio do Stripe
          })
          .eq("id", userId);

        if (updateError) {
          console.error("[Webhook] Erro ao atualizar perfil:", updateError);
        }

        console.log(`[Webhook] ✅ Usuário ${userId} atualizado - Tokens: ${product.tokens_included}, Tipo: ${subscriptionType}`);

        // Enviar email de boas-vindas em background
        const sendWelcomeEmail = async () => {
          try {
            const { data: userProfile } = await supabase
              .from("profiles")
              .select("name, email")
              .eq("id", userId)
              .single();

            if (userProfile) {
              const emailResponse = await fetch(
                `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                  },
                  body: JSON.stringify({
                    user_name: userProfile.name,
                    user_email: userProfile.email,
                    plan_name: product.plan_name,
                    tokens_included: product.tokens_included,
                  }),
                }
              );

              if (emailResponse.ok) {
                console.log("[Webhook] Email de boas-vindas enviado com sucesso");
              } else {
                console.error("[Webhook] Erro ao enviar email:", await emailResponse.text());
              }
            }
          } catch (emailError) {
            console.error("[Webhook] Erro ao processar email de boas-vindas:", emailError);
          }
        };

        // Executar em background sem bloquear o webhook
        EdgeRuntime.waitUntil(sendWelcomeEmail());

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabase
          .from("stripe_subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString()
          })
          .eq("stripe_subscription_id", subscription.id);

        console.log(`[Webhook] Assinatura atualizada: ${subscription.id}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        const { data: sub } = await supabase
          .from("stripe_subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub) {
          await supabase
            .from("stripe_subscriptions")
            .update({ 
              status: "canceled",
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", subscription.id);

          await supabase
            .from("profiles")
            .update({ current_subscription_id: null })
            .eq("id", sub.user_id);
        }

        console.log(`[Webhook] Assinatura cancelada: ${subscription.id}`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Se for renovação (não o primeiro pagamento)
        if (invoice.billing_reason === "subscription_cycle") {
          const subscriptionId = invoice.subscription as string;
          
          const { data: sub } = await supabase
            .from("stripe_subscriptions")
            .select("user_id, tokens_per_period")
            .eq("stripe_subscription_id", subscriptionId)
            .single();

          if (sub) {
            // Creditar tokens da renovação
            const { data: profile } = await supabase
              .from("profiles")
              .select("tokens_remaining")
              .eq("id", sub.user_id)
              .single();

            if (profile) {
              await supabase
                .from("profiles")
                .update({ 
                  tokens_remaining: profile.tokens_remaining + sub.tokens_per_period
                })
                .eq("id", sub.user_id);
            }

            console.log(`[Webhook] Tokens renovados: ${sub.tokens_per_period}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        if (subscriptionId) {
          await supabase
            .from("stripe_subscriptions")
            .update({ 
              status: "past_due",
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", subscriptionId);

          console.log(`[Webhook] Pagamento falhou para: ${subscriptionId}`);
        }
        break;
      }

      default:
        console.log(`[Webhook] Evento não tratado: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[Webhook] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
});
