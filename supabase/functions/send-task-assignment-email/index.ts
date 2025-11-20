import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskAssignmentEmailRequest {
  assignedUserName: string;
  projectName: string;
  taskName: string;
  dueDate: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assignedUserName, projectName, taskName, dueDate }: TaskAssignmentEmailRequest = await req.json()

    console.log('Task assignment email request:', { assignedUserName, projectName, taskName, dueDate })

    // Validate input
    if (!assignedUserName || !projectName || !taskName || !dueDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'All fields are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get current timestamp
    const currentTime = new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'full',
      timeStyle: 'long'
    })

    // Format due date
    const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Email configuration - send to Sourabh Verma (Admin)
    const adminEmail = 'sourabh.verman23@gmail.com'
    
    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not found in environment variables')
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create email HTML content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .info-row {
              margin: 15px 0;
              padding: 10px;
              background-color: #f5f5f5;
              border-left: 4px solid #4CAF50;
            }
            .info-label {
              font-weight: bold;
              color: #555;
            }
            .info-value {
              color: #333;
              margin-left: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #777;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Task Assignment Notification</h1>
            </div>
            <div class="content">
              <p>Hello Admin,</p>
              <p>A new task has been assigned in the zHeight AI system. Here are the details:</p>
              
              <div class="info-row">
                <span class="info-label">Assigned To:</span>
                <span class="info-value">${assignedUserName}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Project Name:</span>
                <span class="info-value">${projectName}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Task Name:</span>
                <span class="info-value">${taskName}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Due Date:</span>
                <span class="info-value">${formattedDueDate}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Assignment Time:</span>
                <span class="info-value">${currentTime}</span>
              </div>
              
              <p style="margin-top: 30px;">This is an automated notification from the zHeight AI project management system.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} zHeight AI. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email using Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'zHeight AI <onboarding@resend.dev>',
        to: [adminEmail],
        subject: `New Task Assignment: ${taskName} - ${projectName}`,
        html: emailHtml,
      }),
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text()
      console.error('Resend API error:', errorData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send email notification' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const emailResult = await emailResponse.json()
    console.log('Email sent successfully:', emailResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Task assignment notification sent successfully',
        recipient: adminEmail,
        details: {
          assignedUserName,
          projectName,
          taskName,
          dueDate: formattedDueDate,
          sentAt: currentTime
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
