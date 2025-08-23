import { useState } from "react";
import { AgentCard } from "./AgentCard";
import { DocumentUpload } from "./DocumentUpload";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle, Search, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

    // Simulate AI analysis
    const totalSteps = 4;
    for (let i = 0; i <= totalSteps; i++) {
      setTimeout(() => {
        setProgress((i / totalSteps) * 100);
        if (i === totalSteps) {
          setIsProcessing(false);
          // Simulate compliance issues
          const mockIssues: ComplianceIssue[] = [
            {
              id: "1",
              category: "Structural",
              issue: "Foundation reinforcement schedule missing",
              severity: "high",
              location: "Foundation Plan - Sheet A1",
              recommendation: "Add detailed rebar schedule with sizes and spacing",
              checklistItem: "Foundation details must include reinforcement schedule"
            },
            {
              id: "2",
              category: "Fire Safety", 
              issue: "Smoke detector not shown in master bedroom",
              severity: "medium",
              location: "Floor Plan - Sheet A2",
              recommendation: "Add smoke detector symbol in master bedroom ceiling",
              checklistItem: "Smoke detectors required in all bedrooms and hallways"
            },
            {
              id: "3",
              category: "Accessibility",
              issue: "Entry door width appears to be 30 inches",
              severity: "high",
              location: "Floor Plan - Sheet A2", 
              recommendation: "Increase door width to minimum 32 inches",
              checklistItem: "Door width minimum 32 inches for primary entrance"
            },
            {
              id: "4",
              category: "Electrical",
              issue: "Kitchen island outlet location unclear",
              severity: "low",
              location: "Electrical Plan - Sheet E1",
              recommendation: "Clarify outlet locations on kitchen island",
              checklistItem: "GFCI outlets required within 6 feet of sinks"
            }
          ];
          setIssues(mockIssues);
          
          const highSeverity = mockIssues.filter(i => i.severity === "high").length;
          toast({
            title: "Analysis complete",
            description: `Found ${mockIssues.length} issues (${highSeverity} high priority)`,
            variant: highSeverity > 0 ? "destructive" : "default"
          });
        }
      }, i * 2000);
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