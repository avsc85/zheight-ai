import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Admin client for user deletion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { email, userId } = await req.json()

    console.log('Delete auth user request:', { email, userId })

    if (!email && !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email or userId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify requesting user is admin
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if requesting user is admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    )

    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single()

    if (roleError || userRole?.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let targetUserId = userId

    // If we only have email, find the user first
    if (!targetUserId && email) {
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Adjust as needed
      })

      if (listError) {
        console.error('Error listing users:', listError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to find user by email' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const user = users.users.find(u => u.email === email)
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found with that email' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      targetUserId = user.id
    }

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to delete auth user: ${deleteError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Successfully deleted auth user:', targetUserId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Auth user deleted successfully',
        userId: targetUserId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})