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

    // Call the generate_ar_daily_digest function (runs at 9:00 AM IST via cron)
    const { data: arData, error: arError } = await supabaseAdmin.rpc('generate_ar_daily_digest')

    if (arError) {
      console.error('❌ Error generating AR daily digest:', arError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to generate AR daily digest',
          details: arError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ AR daily digest generated successfully')

    // Call the generate_pm_daily_digest function (runs at 9:30 AM IST via separate cron)
    const { data: pmData, error: pmError } = await supabaseAdmin.rpc('generate_pm_daily_digest')

    if (pmError) {
      console.error('❌ Error generating PM daily digest:', pmError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to generate PM daily digest',
          details: pmError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ PM daily digest generated successfully')

    // Get count of emails queued
    const { count: emailCount, error: countError } = await supabaseAdmin
      .from('email_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('email_type', 'daily_task_digest')
      .eq('status', 'pending')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

    const queuedCount = emailCount || 0

    console.log(`📧 ${queuedCount} daily digest email(s) queued for delivery`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily digest generation completed (AR at 9:00 AM IST, PM at 9:30 AM IST)',
        ar_digest: 'queued at 9:00 AM IST',
        pm_digest: 'queued at 9:30 AM IST',
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
