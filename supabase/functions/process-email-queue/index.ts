import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',C
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get pending email notifications (limit to 10 per batch)
    const { data: pendingEmails, error: fetchError } = await supabaseAdmin
      .from('email_notifications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)

    if (fetchError) {
      console.error('Error fetching pending emails:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch pending emails' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending emails', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingEmails.length} pending email(s)`)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    let processed = 0
    let failed = 0

    for (const email of pendingEmails) {
      try {
        if (!resendApiKey) {
          // If no Resend API key, just log the email
          console.log('📧 Email to be sent:', {
            to: email.recipient_email,
            subject: email.subject,
            type: email.email_type,
            metadata: email.metadata
          })
          
          // Mark as sent (logged)
          await supabaseAdmin
            .from('email_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              attempts: email.attempts + 1
            })
            .eq('id', email.id)
          
          processed++
          continue
        }

        // Send email via Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'zHeight AI <onboarding@resend.dev>',
            to: [email.recipient_email],
            subject: email.subject,
            html: email.body_html,
            text: email.body_text,
          }),
        })

        if (emailResponse.ok) {
          const result = await emailResponse.json()
          console.log('✅ Email sent successfully:', result)
          
          // Mark as sent
          await supabaseAdmin
            .from('email_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              attempts: email.attempts + 1
            })
            .eq('id', email.id)
          
          processed++
        } else {
          const errorText = await emailResponse.text()
          console.error('❌ Failed to send email:', errorText)
          
          // Mark as failed
          await supabaseAdmin
            .from('email_notifications')
            .update({
              status: 'failed',
              error_message: errorText,
              attempts: email.attempts + 1
            })
            .eq('id', email.id)
          
          failed++
        }
      } catch (error: any) {
        console.error('Exception processing email:', error)
        
        // Mark as failed
        await supabaseAdmin
          .from('email_notifications')
          .update({
            status: 'failed',
            error_message: error.message,
            attempts: email.attempts + 1
          })
          .eq('id', email.id)
        
        failed++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} email(s), ${failed} failed`,
        processed,
        failed
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
