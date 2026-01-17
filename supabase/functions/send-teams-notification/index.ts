import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamsNotificationPayload {
  taskId: string;
  taskName: string;
  projectName: string;
  projectId?: string;
  arName: string;
  pmName?: string;
  newStatus: string;
  previousStatus?: string;
  comment?: string;
  approvalStatus?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookUrl = Deno.env.get("MS_TEAMS_WEBHOOK_URL");
    if (!webhookUrl) {
      console.error("MS_TEAMS_WEBHOOK_URL not configured");
      return new Response(
        JSON.stringify({ error: "Teams webhook URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: TeamsNotificationPayload = await req.json();
    console.log("Received notification payload:", payload);

    const { taskId, taskName, projectName, projectId, arName, pmName, newStatus, previousStatus, comment, approvalStatus } = payload;

    // Format status for display
    const formatStatus = (status: string) => {
      if (!status) return "Unknown";
      return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // Determine status emoji
    const getStatusEmoji = (status: string) => {
      switch (status?.toLowerCase()) {
        case "completed": return "✅";
        case "started": return "🚀";
        case "in_queue": return "📋";
        case "blocked": return "🚫";
        default: return "📋";
      }
    };

    // Determine theme color based on status
    const getThemeColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case "completed": return "00C853"; // Green
        case "started": return "2196F3"; // Blue
        case "blocked": return "F44336"; // Red
        default: return "FF9800"; // Orange
      }
    };

    // Build positive, professional greeting
    const greeting = pmName ? `Hi ${pmName},` : "Hi Team,";
    
    // Build positive status message
    const getStatusMessage = (status: string, taskName: string, arName: string) => {
      switch (status?.toLowerCase()) {
        case "completed":
          return `Great news! **${arName}** has completed the task "${taskName}". 🎉`;
        case "started":
          return `**${arName}** has started working on "${taskName}". Work is in progress! 💪`;
        case "blocked":
          return `**${arName}** has flagged "${taskName}" as blocked and needs attention. ⚠️`;
        default:
          return `Task "${taskName}" has been updated by **${arName}**.`;
      }
    };

    // Build Microsoft Teams Adaptive Card with professional greeting
    const teamsMessage = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor: getThemeColor(newStatus),
      summary: `Task Update: ${taskName}`,
      sections: [
        {
          activityTitle: greeting,
          activitySubtitle: getStatusMessage(newStatus, taskName, arName || "An AR"),
          markdown: true,
        },
        {
          activityTitle: `${getStatusEmoji(newStatus)} Task Status Update`,
          facts: [
            { name: "📁 Project", value: `**${projectName}**` },
            { name: "📌 Task", value: taskName },
            { name: "👤 Updated By", value: arName || "Unknown" },
            { name: "📊 New Status", value: `${getStatusEmoji(newStatus)} ${formatStatus(newStatus)}` },
            ...(previousStatus ? [{ name: "📋 Previous Status", value: `${getStatusEmoji(previousStatus)} ${formatStatus(previousStatus)}` }] : []),
          ],
          markdown: true,
        },
        ...(comment ? [{
          activityTitle: "💬 AR Comment",
          text: `> ${comment}`,
          markdown: true,
        }] : []),
        ...(newStatus === 'completed' ? [{
          activityTitle: "⏳ Action Required",
          text: "Please review and approve this task completion.",
          markdown: true,
        }] : []),
      ],
      potentialAction: [
        {
          "@type": "OpenUri",
          name: "View in Dashboard",
          targets: [
            { os: "default", uri: `https://zheight-ai.lovable.app/team-activity` }
          ]
        }
      ]
    };

    console.log("Sending Teams message:", JSON.stringify(teamsMessage, null, 2));

    // Send to Teams webhook
    const teamsResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teamsMessage),
    });

    if (!teamsResponse.ok) {
      const errorText = await teamsResponse.text();
      console.error("Teams webhook error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send Teams notification", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Teams notification sent successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Teams notification sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending Teams notification:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
