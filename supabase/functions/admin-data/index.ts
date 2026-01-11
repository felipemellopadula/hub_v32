import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized: No authorization header' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with user's JWT to verify their identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized: Invalid token' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} (${user.email}) attempting to access admin data`);

    // Create admin client with service role key to check admin status
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user is an admin by checking the admin_users table
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('Error checking admin status:', adminError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error verifying admin status' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!adminCheck) {
      console.warn(`User ${user.email} attempted admin access but is not an admin`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: Admin access required' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Admin access granted for user ${user.email}`);

    // Fetch all token usage data bypassing RLS (admin is authorized)
    const { data: tokenUsage, error } = await supabaseAdmin
      .from('token_usage')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching token usage:', error);
      throw error;
    }

    console.log(`Fetched ${tokenUsage?.length || 0} token usage records for admin ${user.email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: tokenUsage || [] 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-data function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
