import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { modelName, message } = await req.json()
    
    if (!modelName || !message) {
      throw new Error('Model name and message are required')
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    
    if (userError || !user) {
      throw new Error('Invalid authentication')
    }

    // Model token costs - 12k tokens for all models
    const MODEL_COSTS: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 12000,
      'claude-3-opus-20240229': 12000,
      'claude-3-haiku-20240307': 12000,
      'grok-beta': 12000,
      'gpt-4o': 12000,
      'gpt-4o-mini': 12000,
      'gpt-4-turbo': 12000,
      'gemini-2.5-flash-002': 12000,
      'gemini-2.5-pro-002': 12000,
      'gemini-pro': 12000,
    }

    const cost = MODEL_COSTS[modelName] || 12000

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens_remaining')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Profile not found')
    }

    // Check if user has enough tokens
    if (profile.tokens_remaining < cost) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient tokens',
          required: cost,
          available: profile.tokens_remaining
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Deduct tokens from user profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        tokens_remaining: profile.tokens_remaining - cost 
      })
      .eq('id', user.id)

    if (updateError) {
      throw new Error('Failed to update tokens')
    }

    // Log token usage
    await supabase
      .from('token_usage')
      .insert({
        user_id: user.id,
        model_name: modelName,
        tokens_used: cost,
        message_content: message.substring(0, 1000), // Limit message length
      })

    return new Response(
      JSON.stringify({ 
        success: true,
        tokensConsumed: cost,
        remainingTokens: profile.tokens_remaining - cost
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Consume tokens error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})