import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteUserRequest {
  email: string;
  name: string;
  role: string;
}

// Helper function to get role display name
function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'admin': return '👑 Admin';
    case 'pm': return '🏢 Project Manager';
    case 'ar1_planning': return '📋 AR1 - Planning';
    case 'ar2_field': return '🔧 AR2 - Field';
    case 'user': return '👤 User';
    default: return role;
  }
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

    // Initialize regular client for RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { email, name, role }: InviteUserRequest = await req.json()

    console.log('Invite user request:', { email, name, role })

    // Validate input
    if (!email || !name || !role) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email, name, and role are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get current user to check if they're admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
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

    // Clean up any expired invitations
    await supabase.rpc('cleanup_expired_invitations')

    // Check if user already exists in auth (but allow if they had a pending/expired invitation)
    const { data: existingUser, error: existingUserError } = await supabaseAdmin.auth.admin.listUsers()
    if (!existingUserError && existingUser.users.some(u => u.email === email)) {
      // Check if there's a pending invitation - if yes, allow re-invite (user may have been deleted)
      const { data: anyInvitation } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('email', email)
        .in('status', ['pending', 'expired', 'accepted'])
        .limit(1)
      
      if (!anyInvitation || anyInvitation.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'User with this email already exists' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Mark ALL existing pending invitations for this email as expired using admin client
    const { error: expireError } = await supabaseAdmin
      .from('user_invitations')
      .update({ status: 'expired' })
      .eq('email', email)
      .eq('status', 'pending')

    if (expireError) {
      console.log('Note: Error expiring old invitations (may not exist):', expireError.message)
    } else {
      console.log('Expired any existing pending invitations for:', email)
    }

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        email,
        name,
        role,
        invited_by: user.id
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create invitation' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Send custom invitation email via email notification system
    const appUrl = 'https://zheight.tech'
    const inviteLink = `${appUrl}/invite?email=${encodeURIComponent(email)}&invitation_id=${encodeURIComponent(invitation.id)}`
    
    const emailSubject = `You've been invited to join zHeight Internal AI`
    
    const emailHtml = `
<html>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0;">Welcome to zHeight Internal AI</h1>
      <p style="margin: 10px 0 0 0;">You've been invited to join</p>
    </div>
    
    <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <p>Hi <strong>${name}</strong>,</p>
      
      <p>You have been invited to join the zHeight Internal AI project management system as:</p>
      
      <div style="background-color: #f0f0f0; padding: 12px 15px; border-radius: 5px; margin: 15px 0; font-weight: bold; color: #667eea; text-align: center;">
        ${getRoleDisplayName(role)}
      </div>
      
      <p style="text-align: center; margin: 20px 0;">
        <a href="${inviteLink}" style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Accept Invitation & Create Account
        </a>
      </p>
      
      <p style="color: #777; font-size: 14px; margin-top: 20px;">Link: <span style="background-color: #f0f0f0; padding: 5px; border-radius: 3px; word-break: break-all;">${inviteLink}</span></p>
      
      <p style="color: #999; font-size: 13px; margin-top: 20px;"><strong>Note:</strong> This invitation expires in 7 days.</p>
    </div>
  </div>
</body>
</html>
    `
    
    const emailText = `Welcome to zHeight Internal AI

Hi ${name},

You have been invited to join the zHeight Internal AI project management system as:
${getRoleDisplayName(role)}

Accept your invitation here:
${inviteLink}

This invitation expires in 7 days.

If you have any questions, please contact your administrator.
---
© 2025 zHeight AI. All rights reserved.`.trim()
    
    // Insert custom invitation email into queue
    const { error: emailError } = await supabase
      .from('email_notifications')
      .insert({
        recipient_email: email,
        email_type: 'user_invitation',
        subject: emailSubject,
        body_html: emailHtml,
        body_text: emailText,
        metadata: {
          invitation_id: invitation.id,
          invitee_name: name,
          invitee_role: role,
          invited_by: user.id,
          expires_at: invitation.expires_at
        }
      })
    
    if (emailError) {
      console.error('Error queuing invitation email:', emailError)
      
      // Clean up the invitation record if email queuing failed
      await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitation.id)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to queue invitation email: ${emailError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Successfully sent invitation to:', email)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation sent successfully',
        invitation: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          expires_at: invitation.expires_at
        }
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