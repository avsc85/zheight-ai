import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface UserWithAuth {
  id: string
  email: string
  full_name: string | null
  company: string | null
  role: string
  created_at: string
  last_sign_in_at: string | null
  active_status: boolean | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the request is from an authenticated admin user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user has admin role
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch all profiles with their user roles
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select(`
        user_id,
        name,
        company,
        created_at,
        active_status
      `)

    if (profilesError) {
      throw profilesError
    }

    // Get all user roles
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')

    if (rolesError) {
      throw rolesError
    }

    // Get auth users data using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      throw authError
    }

    const authUsers = authData.users || []

    // Combine the data
    const usersWithAuth: UserWithAuth[] = profilesData.map(profile => {
      const userRole = rolesData.find(role => role.user_id === profile.user_id)
      const authUser = authUsers.find((u: any) => u.id === profile.user_id)
      
      return {
        id: profile.user_id,
        email: authUser?.email || 'Unknown',
        full_name: profile.name,
        company: profile.company,
        role: userRole?.role || 'user',
        created_at: profile.created_at,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        active_status: profile.active_status
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        users: usersWithAuth 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-users-with-auth function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch users',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})