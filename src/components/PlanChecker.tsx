import { useState } from "react";
import { AgentCard } from "./AgentCard";
import { DocumentUpload } from "./DocumentUpload";
import { Progress } from "@/components/ui/progress";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";


interface ArchitecturalIssueReport {
  id: string;
  checklist_item_id: string;
  analysis_session_id: string;
  plan_sheet_name: string;
  issue_description: string;
  location_in_sheet: string;
  issue_type: string; // Dynamic type from database
  compliance_source: string;
  specific_code_identifier: string;
  short_code_requirement: string;
  long_code_requirement: string;
  source_link: string;
  confidence_level: "High" | "Medium" | "Low";
  confidence_rationale: string;
  created_at: string;
}

interface PlanCheckerProps {
  onIssuesUpdate?: (issues: ArchitecturalIssueReport[]) => void;
}

export const PlanChecker = ({ onIssuesUpdate }: PlanCheckerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [issues, setIssues] = useState<ArchitecturalIssueReport[]>([]);
  const [analysisSessionId, setAnalysisSessionId] = useState<string>("");
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
    setAnalysisSessionId("");

    try {
      toast({
        title: "Starting AI analysis",
        description: "Extracting project information from plans...",
      });

      // Simulate progress updates with more detailed steps
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 3000);

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

      clearInterval(progressInterval);

      if (error) {
        throw new Error(error.message || 'Analysis failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Process the results
      const analysisResults = data.data;
      
      if (analysisResults.issues && Array.isArray(analysisResults.issues)) {
        setIssues(analysisResults.issues);
        setAnalysisSessionId(analysisResults.analysis_session_id);
        onIssuesUpdate?.(analysisResults.issues);
        
        const summary = analysisResults.analysis_summary;
        const cityInfo = analysisResults.city_detected !== 'Not detected' 
          ? ` for ${analysisResults.city_detected}` 
          : '';
        
        toast({
          title: "AI Analysis Complete",
          description: `Analyzed ${summary?.total_checked || analysisResults.issues.length} checklist items${cityInfo}. Found ${analysisResults.issues.length} compliance issues.`,
          variant: analysisResults.issues.length > 0 ? "destructive" : "default"
        });
      } else {
        setIssues([]);
        onIssuesUpdate?.([]);
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
    </div>
  );
};