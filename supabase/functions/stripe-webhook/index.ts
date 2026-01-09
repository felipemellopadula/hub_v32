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
    console.log("[Webhook] Recebendo evento do Stripe...");
    
    // IMPORTANTE: Usar constructEventAsync em vez de constructEvent no Deno/Edge Functions
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    
    console.log(`[Webhook] ✅ Assinatura validada - Evento: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const customerEmail = session.customer_details?.email;
        const customerName = session.customer_details?.name || "Usuário";
        const mode = session.mode; // "payment" ou "subscription"

        console.log(`[Webhook] Checkout completo - Mode: ${mode}, Customer: ${customerId}, Email: ${customerEmail}`);

        // ========== PAGAMENTO ÚNICO (ONE-TIME PAYMENT) ==========
        if (mode === "payment") {
          console.log(`[Webhook] Processando pagamento único`);
          
          // Buscar plan_id do metadata
          const planId = session.metadata?.plan_id;
          if (!planId) {
            console.error(`[Webhook] plan_id não encontrado no metadata`);
            break;
          }

          // Buscar produto na tabela stripe_products
          const { data: product, error: productError } = await supabase
            .from("stripe_products")
            .select("*")
            .eq("plan_id", planId)
            .single();

          if (productError || !product) {
            console.error(`[Webhook] Produto não encontrado para plan_id=${planId}:`, productError);
            break;
          }

          console.log(`[Webhook] Produto encontrado: ${product.plan_name}, tokens=${product.tokens_included}`);

          // Buscar ou criar usuário
          let userId: string | null = session.client_reference_id || session.metadata?.user_id || null;

          // Se não temos userId, buscar pelo email
          if (!userId && customerEmail) {
            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("id, tokens_remaining")
              .eq("email", customerEmail)
              .single();

            if (existingProfile) {
              userId = existingProfile.id;
              console.log(`[Webhook] Usuário existente encontrado: ${userId}`);
              
              // SOMAR tokens ao existente (permite comprar múltiplos pacotes)
              const newTokens = (existingProfile.tokens_remaining || 0) + product.tokens_included;
              
              // Determinar subscription_type baseado no plan_id
              let subscriptionType: 'basic' | 'plus' | 'pro' = 'basic';
              const planIdLower = planId.toLowerCase();
              if (planIdLower.includes('creator')) {
                subscriptionType = 'plus';
              } else if (planIdLower.includes('pro')) {
                subscriptionType = 'pro';
              }
              
              const { error: updateError } = await supabase
                .from("profiles")
                .update({
                  tokens_remaining: newTokens,
                  stripe_customer_id: customerId,
                  subscription_type: subscriptionType,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

              if (updateError) {
                console.error(`[Webhook] Erro ao atualizar perfil:`, updateError);
              } else {
                console.log(`[Webhook] ✅ Créditos adicionados: +${product.tokens_included} (total: ${newTokens}), tipo: ${subscriptionType}`);
                
                // Registrar compra no histórico
                const { error: purchaseError } = await supabase
                  .from("credit_purchases")
                  .insert({
                    user_id: userId,
                    stripe_session_id: session.id,
                    plan_id: planId,
                    plan_name: product.plan_name,
                    tokens_credited: product.tokens_included,
                    amount_paid: session.amount_total,
                    currency: session.currency || 'brl',
                  });
                
                if (purchaseError) {
                  console.error(`[Webhook] Erro ao registrar compra:`, purchaseError);
                } else {
                  console.log(`[Webhook] ✅ Compra registrada no histórico`);
                }
              }
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
              email_confirm: true,
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
              // Aguardar trigger criar o profile
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (userId) {
              // Determinar subscription_type baseado no plan_id
              let subscriptionType: 'basic' | 'plus' | 'pro' = 'basic';
              const planIdLower = planId.toLowerCase();
              if (planIdLower.includes('creator')) {
                subscriptionType = 'plus';
              } else if (planIdLower.includes('pro')) {
                subscriptionType = 'pro';
              }
              
              // Atualizar perfil com tokens e stripe_customer_id
              const { error: profileError } = await supabase
                .from("profiles")
                .update({
                  tokens_remaining: product.tokens_included,
                  stripe_customer_id: customerId,
                  subscription_type: subscriptionType,
                  is_password_set: false,
                  name: customerName,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

              if (profileError) {
                console.error(`[Webhook] Erro ao atualizar perfil do novo usuário:`, profileError);
              } else {
                console.log(`[Webhook] ✅ Novo usuário configurado com ${product.tokens_included} tokens, tipo: ${subscriptionType}`);
                
                // Registrar compra no histórico
                const { error: purchaseError } = await supabase
                  .from("credit_purchases")
                  .insert({
                    user_id: userId,
                    stripe_session_id: session.id,
                    plan_id: planId,
                    plan_name: product.plan_name,
                    tokens_credited: product.tokens_included,
                    amount_paid: session.amount_total,
                    currency: session.currency || 'brl',
                  });
                
                if (purchaseError) {
                  console.error(`[Webhook] Erro ao registrar compra:`, purchaseError);
                } else {
                  console.log(`[Webhook] ✅ Compra registrada no histórico`);
                }
              }

              // Enviar email de boas-vindas em background
              const sendWelcomeEmail = async () => {
                try {
                  const emailResponse = await fetch(
                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                      },
                      body: JSON.stringify({
                        user_name: customerName,
                        user_email: customerEmail,
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
                } catch (emailError) {
                  console.error("[Webhook] Erro ao processar email de boas-vindas:", emailError);
                }
              };

              EdgeRuntime.waitUntil(sendWelcomeEmail());
            }
          }

          if (!userId) {
            console.error("[Webhook] Não foi possível identificar/criar o usuário");
          }

          console.log(`[Webhook] ✅ Pagamento único processado com sucesso`);
          break;
        }

        // ========== ASSINATURA (SUBSCRIPTION) - FLUXO LEGADO ==========
        const subscriptionId = session.subscription as string;
        console.log(`[Webhook] Processando assinatura: ${subscriptionId}`);

        if (!subscriptionId) {
          console.log(`[Webhook] No subscription ID, skipping`);
          break;
        }

        // Buscar ou criar usuário (fluxo legado para assinaturas)
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
            email_confirm: false,
            user_metadata: {
              name: customerName,
              created_via: "stripe_checkout"
            }
          });

          if (createError) {
            console.error(`[Webhook] Erro ao criar usuário:`, createError);
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users?.users?.find(u => u.email === customerEmail);
            if (existingUser) {
              userId = existingUser.id;
              console.log(`[Webhook] Usuário já existia no auth: ${userId}`);
            }
          } else if (newUser?.user) {
            userId = newUser.user.id;
            console.log(`[Webhook] Novo usuário criado: ${userId}`);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await supabase
              .from("profiles")
              .update({ is_password_set: false })
              .eq("id", userId);
            
            console.log(`[Webhook] Profile marcado com is_password_set = false`);
          }
        }

        if (!userId) {
          console.error("[Webhook] Não foi possível identificar/criar o usuário");
          break;
        }

        // Buscar detalhes da assinatura
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0].price.id;
        
        console.log(`[Webhook] Subscription periods - start: ${subscription.current_period_start}, end: ${subscription.current_period_end}`);

        // Buscar plano no banco
        let product = null;
        const { data: productByPrice } = await supabase
          .from("stripe_products")
          .select("*")
          .eq("stripe_price_id", priceId)
          .single();

        if (productByPrice) {
          product = productByPrice;
        } else if (session.metadata?.plan_id) {
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

        const periodStart = subscription.current_period_start 
          ? new Date(subscription.current_period_start * 1000).toISOString() 
          : null;
        const periodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString() 
          : null;

        const { data: subscriptionData, error: subError } = await supabase
          .from("stripe_subscriptions")
          .upsert({
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            status: subscription.status,
            plan_id: product.plan_id,
            price_id: priceId,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
            tokens_per_period: product.tokens_included,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'stripe_subscription_id',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (subError) {
          console.error("[Webhook] Erro ao criar/atualizar subscription:", subError);
          const { data: existingSub } = await supabase
            .from("stripe_subscriptions")
            .select("id")
            .eq("stripe_subscription_id", subscriptionId)
            .single();
          
          if (existingSub) {
            console.log(`[Webhook] Subscription já existia, continuando com ID: ${existingSub.id}`);
          }
        } else {
          console.log(`[Webhook] Subscription criada/atualizada: ${subscriptionData?.id}`);
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

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            tokens_remaining: product.tokens_included,
            stripe_customer_id: customerId,
            subscription_type: subscriptionType,
            current_subscription_id: subscriptionData?.id,
            name: customerName
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

        EdgeRuntime.waitUntil(sendWelcomeEmail());

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Converter datas com segurança
        const updPeriodStart = subscription.current_period_start 
          ? new Date(subscription.current_period_start * 1000).toISOString() 
          : null;
        const updPeriodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString() 
          : null;
        
        await supabase
          .from("stripe_subscriptions")
          .update({
            status: subscription.status,
            current_period_start: updPeriodStart,
            current_period_end: updPeriodEnd,
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
