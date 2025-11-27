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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    console.log('🌅 Starting daily task digest generation at', new Date().toISOString())

    // Call the generate_daily_task_digest function
    const { data, error } = await supabaseAdmin.rpc('generate_daily_task_digest')

    if (error) {
      console.error('❌ Error generating daily digest:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to generate daily digest',
          details: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Daily task digest generated successfully')

    // Get count of emails queued
    const { data: queuedEmails, error: countError } = await supabaseAdmin
      .from('email_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('email_type', 'daily_task_digest')
      .eq('status', 'pending')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

    const emailCount = queuedEmails?.length || 0

    console.log(`📧 ${emailCount} daily digest email(s) queued for delivery`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily task digest generated successfully',
        emails_queued: emailCount,
        generated_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Exception in daily digest generation:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Exception occurred',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
