import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  user_name: string;
  user_email: string;
  plan_name: string;
  tokens_included: number;
}

const createEmailTemplate = (data: WelcomeEmailRequest) => {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bem-vindo ao Synergy AI</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- Header with Logo -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">
                    Synergy AI
                  </h1>
                  <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                    Bem-vindo à nova era da IA
                  </p>
                </td>
              </tr>
              
              <!-- Welcome Message -->
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 28px; font-weight: bold;">
                    Olá, ${data.user_name}! 🎉
                  </h2>
                  <p style="color: #4a4a4a; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                    Estamos muito felizes em ter você conosco! Sua assinatura foi confirmada com sucesso.
                  </p>
                </td>
              </tr>
              
              <!-- Plan Details Box -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border: 2px solid #667eea30; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
                    <h3 style="color: #667eea; margin: 0 0 16px 0; font-size: 20px; font-weight: bold;">
                      📦 Seu Plano
                    </h3>
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #4a4a4a; font-size: 15px;">
                          <strong>Plano:</strong>
                        </td>
                        <td style="color: #1a1a1a; font-size: 15px; text-align: right;">
                          ${data.plan_name}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #4a4a4a; font-size: 15px;">
                          <strong>Tokens:</strong>
                        </td>
                        <td style="color: #1a1a1a; font-size: 15px; text-align: right;">
                          ${data.tokens_included.toLocaleString('pt-BR')} tokens/mês
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>
              
              <!-- Features -->
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <h3 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px; font-weight: bold;">
                    🚀 O que você pode fazer agora:
                  </h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #667eea; font-size: 18px; margin-right: 10px;">💬</span>
                        <span style="color: #4a4a4a; font-size: 15px;">Chat com IA avançada</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #667eea; font-size: 18px; margin-right: 10px;">🎥</span>
                        <span style="color: #4a4a4a; font-size: 15px;">Geração de vídeos incríveis</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #667eea; font-size: 18px; margin-right: 10px;">🖼️</span>
                        <span style="color: #4a4a4a; font-size: 15px;">Criação de imagens com IA</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #667eea; font-size: 18px; margin-right: 10px;">🌐</span>
                        <span style="color: #4a4a4a; font-size: 15px;">Tradutor e humanizador de textos</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #667eea; font-size: 18px; margin-right: 10px;">✍️</span>
                        <span style="color: #4a4a4a; font-size: 15px;">Criação de conteúdo profissional</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #667eea; font-size: 18px; margin-right: 10px;">🎙️</span>
                        <span style="color: #4a4a4a; font-size: 15px;">Transcrição de áudio</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- CTA Button -->
              <tr>
                <td style="padding: 0 40px 40px 40px; text-align: center;">
                  <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || 'https://app.synergyai.com.br'}/dashboard" 
                     style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                    Acessar Dashboard →
                  </a>
                </td>
              </tr>
              
              <!-- Support Info -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px; text-align: center;">
                    Precisa de ajuda? Entre em contato conosco:
                  </p>
                  <p style="color: #667eea; margin: 0; font-size: 14px; text-align: center;">
                    <a href="mailto:contato@synergyia.com.br" style="color: #667eea; text-decoration: none;">
                      contato@synergyia.com.br
                    </a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px; text-align: center; background-color: #1a1a1a;">
                  <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                    © ${new Date().getFullYear()} Synergy AI. Todos os direitos reservados.
                  </p>
                  <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 12px;">
                    Este email foi enviado para ${data.user_email}
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_name, user_email, plan_name, tokens_included }: WelcomeEmailRequest = await req.json();

    console.log("[Welcome Email] Enviando email para:", { user_email, plan_name });

    const emailResponse = await resend.emails.send({
      from: "Synergy AI <noreply@synergyia.com.br>",
      to: [user_email],
      subject: `🎉 Bem-vindo ao Synergy AI - ${plan_name}`,
      html: createEmailTemplate({ user_name, user_email, plan_name, tokens_included }),
    });

    console.log("[Welcome Email] Email enviado com sucesso:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("[Welcome Email] Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
