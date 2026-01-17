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
  arName: string;
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

    const { taskId, taskName, projectName, arName, newStatus, previousStatus, comment, approvalStatus } = payload;

    // Determine status emoji and color
    const getStatusEmoji = (status: string) => {
      switch (status?.toLowerCase()) {
        case "completed": return "✅";
        case "started": return "🚀";
        case "not started": return "⏳";
        case "on hold": return "⏸️";
        default: return "📋";
      }
    };

    const getApprovalEmoji = (status: string) => {
      switch (status?.toLowerCase()) {
        case "approved": return "👍";
        case "rejected": return "👎";
        case "pending": return "⏳";
        default: return "";
      }
    };

    // Build Microsoft Teams Adaptive Card
    const teamsMessage = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor: newStatus === "completed" ? "00C853" : newStatus === "started" ? "2196F3" : "FF9800",
      summary: `Task Update: ${taskName}`,
      sections: [
        {
          activityTitle: `${getStatusEmoji(newStatus)} Task Status Update`,
          activitySubtitle: `Project: **${projectName}**`,
          facts: [
            { name: "📌 Task", value: taskName },
            { name: "👤 Updated By", value: arName || "Unknown" },
            { name: "📊 New Status", value: `${getStatusEmoji(newStatus)} ${newStatus?.charAt(0).toUpperCase() + newStatus?.slice(1) || "Unknown"}` },
            ...(previousStatus ? [{ name: "📋 Previous Status", value: `${getStatusEmoji(previousStatus)} ${previousStatus?.charAt(0).toUpperCase() + previousStatus?.slice(1)}` }] : []),
            ...(approvalStatus ? [{ name: "✔️ Approval Status", value: `${getApprovalEmoji(approvalStatus)} ${approvalStatus?.charAt(0).toUpperCase() + approvalStatus?.slice(1)}` }] : []),
          ],
          markdown: true,
        },
        ...(comment ? [{
          activityTitle: "💬 Comment",
          text: comment,
          markdown: true,
        }] : []),
      ],
      potentialAction: [
        {
          "@type": "OpenUri",
          name: "View Task Details",
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
