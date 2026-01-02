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
    // Initialize Supabase Admin client
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

    console.log('Checking for orphaned auth users...')

    // Get all auth users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (authError) {
      console.error('Error fetching auth users:', authError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch auth users' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get all profile users
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, name')

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch profiles' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const profileUserIds = new Set(profiles.map(p => p.user_id))
    
    // Find orphaned auth users (exist in auth but not in profiles)
    const orphanedUsers = authData.users.filter(user => !profileUserIds.has(user.id))
    
    // Find orphaned profiles (exist in profiles but not in auth)
    const authUserIds = new Set(authData.users.map(u => u.id))
    const orphanedProfiles = profiles.filter(profile => !authUserIds.has(profile.user_id))

    const result = {
      success: true,
      orphanedAuthUsers: orphanedUsers.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at
      })),
      orphanedProfiles: orphanedProfiles.map(profile => ({
        user_id: profile.user_id,
        name: profile.name
      })),
      totalAuthUsers: authData.users.length,
      totalProfiles: profiles.length,
      orphanedAuthCount: orphanedUsers.length,
      orphanedProfileCount: orphanedProfiles.length
    }

    console.log('Orphaned users check complete:', {
      orphanedAuth: result.orphanedAuthCount,
      orphanedProfiles: result.orphanedProfileCount
    })

    return new Response(
      JSON.stringify(result),
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