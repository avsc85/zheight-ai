import { useState } from "react";
import { AgentCard } from "./AgentCard";
import { DocumentUpload } from "./DocumentUpload";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle, Search, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ComplianceIssue {
  id: string;
  category: string;
  issue: string;
  severity: "high" | "medium" | "low";
  location: string;
  recommendation: string;
  checklistItem: string;
}

export const PlanChecker = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [uploadedPlans, setUploadedPlans] = useState<File[]>([]);
  const { toast } = useToast();

  const handleFilesUploaded = (files: File[]) => {
    setUploadedPlans(prev => [...prev, ...files]);
  };

  const startAnalysis = async () => {
    if (uploadedPlans.length === 0) {
      toast({
        title: "No plans uploaded",
        description: "Please upload architectural plans first",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setIssues([]);

    try {
      toast({
        title: "Starting analysis",
        description: "Analyzing plans against compliance checklist...",
      });

      // Prepare form data for the edge function
      const formData = new FormData();
      
      // Add all uploaded files
      uploadedPlans.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      // Call the agent2-plan-checker edge function
      const { data, error } = await supabase.functions.invoke('agent2-plan-checker', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message || 'Analysis failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Process the results
      const analysisResults = data.data;
      
      if (analysisResults.issues && Array.isArray(analysisResults.issues)) {
        // Convert OpenAI response to our component format
        const formattedIssues: ComplianceIssue[] = analysisResults.issues.map((issue: any, index: number) => ({
          id: `issue-${index}`,
          category: issue.code_reference || "General",
          issue: issue.issue_description,
          severity: issue.severity?.toLowerCase() || "medium",
          location: `${issue.plan_sheet_name} - ${issue.location_in_sheet}`,
          recommendation: issue.recommendation,
          checklistItem: `Checklist Item ID: ${issue.checklist_item_id}`
        }));

        setIssues(formattedIssues);
        
        const highSeverity = formattedIssues.filter(i => i.severity === "high").length;
        toast({
          title: "Analysis complete",
          description: `Found ${formattedIssues.length} compliance issues (${highSeverity} high priority)`,
          variant: highSeverity > 0 ? "destructive" : "default"
        });
      } else {
        toast({
          title: "Analysis complete",
          description: "No compliance issues found",
        });
      }

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "high":
        return {
          icon: XCircle,
          color: "text-destructive",
          badge: "bg-destructive text-destructive-foreground"
        };
      case "medium":
        return {
          icon: AlertTriangle,
          color: "text-yellow-600",
          badge: "bg-yellow-100 text-yellow-800"
        };
      case "low":
        return {
          icon: CheckCircle,
          color: "text-accent",
          badge: "bg-accent/10 text-accent"
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-muted-foreground",
          badge: "bg-muted text-muted-foreground"
        };
    }
  };

  const issueStats = {
    total: issues.length,
    high: issues.filter(i => i.severity === "high").length,
    medium: issues.filter(i => i.severity === "medium").length,
    low: issues.filter(i => i.severity === "low").length
  };

  return (
    <div className="space-y-6">
      <AgentCard
        title="Agent-2: Plan Checker"  
        description="Analyzes architectural plans for compliance gaps using extracted checklists"
        icon={Search}
        status={isProcessing ? "processing" : uploadedPlans.length > 0 ? "active" : "idle"}
        onAction={startAnalysis}
        actionLabel={isProcessing ? "Analyzing..." : "Start Analysis"}
      >
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Checking compliance...</span>
              <span className="text-foreground font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </AgentCard>

      <DocumentUpload
        title="Upload Architectural Plans"
        description="Upload residential plan sets for compliance analysis"
        acceptedTypes={[".pdf", ".dwg", ".dxf", ".rvt"]}
        onFilesUploaded={handleFilesUploaded}
        maxFiles={15}
      />

      {issues.length > 0 && (
        <>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Compliance Report</h3>
                <p className="text-muted-foreground text-sm">
                  Analysis complete - {issueStats.total} issues identified
                </p>
              </div>
              <Button size="sm" variant="gradient">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-foreground">{issueStats.total}</p>
                <p className="text-sm text-muted-foreground">Total Issues</p>
              </div>
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <p className="text-2xl font-bold text-destructive">{issueStats.high}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{issueStats.medium}</p>
                <p className="text-sm text-muted-foreground">Medium Priority</p>
              </div>
              <div className="text-center p-3 bg-accent/10 rounded-lg">
                <p className="text-2xl font-bold text-accent">{issueStats.low}</p>
                <p className="text-sm text-muted-foreground">Low Priority</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">Detailed Issues</h4>
            <div className="space-y-4">
              {issues.map(issue => {
                const config = getSeverityConfig(issue.severity);
                const Icon = config.icon;
                
                return (
                  <div key={issue.id} className="p-4 border rounded-lg">
                    <div className="flex items-start gap-4">
                      <Icon className={`w-5 h-5 mt-1 ${config.color}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{issue.category}</Badge>
                          <Badge className={config.badge}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <h5 className="font-semibold text-foreground mb-2">{issue.issue}</h5>
                        <p className="text-muted-foreground text-sm mb-2">
                          <strong>Location:</strong> {issue.location}
                        </p>
                        <p className="text-muted-foreground text-sm mb-2">
                          <strong>Recommendation:</strong> {issue.recommendation}
                        </p>
                        <p className="text-xs text-muted-foreground italic">
                          Checklist Item: {issue.checklistItem}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};