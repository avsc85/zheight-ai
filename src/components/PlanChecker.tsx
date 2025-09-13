import { useState } from "react";
import { AgentCard } from "./AgentCard";
import { DocumentUpload } from "./DocumentUpload";
import { Progress } from "@/components/ui/progress";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ArchitecturalIssueReport {
  id: string;
  checklist_item_id: string;
  analysis_session_id: string;
  plan_sheet_name: string;
  issue_description: string;
  location_in_sheet: string;
  issue_type: "Missing" | "Non-compliant" | "Inconsistent";
  compliance_source: "California Code" | "Local";
  specific_code_identifier: string;
  short_code_requirement: string;
  long_code_requirement: string;
  source_link: string;
  confidence_level: "High" | "Medium" | "Low";
  confidence_rationale: string;
  created_at: string;
}

export const PlanChecker = () => {
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
        title: "Starting analysis",
        description: "Analyzing plans against compliance checklist...",
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 2000);

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
        
        toast({
          title: "Analysis complete",
          description: `Found ${analysisResults.issues.length} compliance issues`,
          variant: analysisResults.issues.length > 0 ? "destructive" : "default"
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
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Found {issues.length} compliance issues in the uploaded plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Sheet</TableHead>
                  <TableHead>Issue Description</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Compliance Source</TableHead>
                  <TableHead>Code Reference</TableHead>
                  <TableHead>Short Requirement</TableHead>
                  <TableHead>Long Requirement</TableHead>
                  <TableHead>Source Link</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{issue.plan_sheet_name}</TableCell>
                    <TableCell>{issue.issue_description}</TableCell>
                    <TableCell>{issue.location_in_sheet}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        issue.issue_type === 'Missing' ? 'bg-red-100 text-red-800' :
                        issue.issue_type === 'Non-compliant' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {issue.issue_type}
                      </span>
                    </TableCell>
                    <TableCell>{issue.compliance_source}</TableCell>
                    <TableCell className="font-mono text-sm">{issue.specific_code_identifier}</TableCell>
                    <TableCell className="max-w-xs truncate" title={issue.short_code_requirement}>
                      {issue.short_code_requirement}
                    </TableCell>
                    <TableCell className="max-w-sm truncate" title={issue.long_code_requirement}>
                      {issue.long_code_requirement}
                    </TableCell>
                    <TableCell>
                      {issue.source_link && (
                        <a 
                          href={issue.source_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-sm"
                        >
                          View Code
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        issue.confidence_level === 'High' ? 'bg-green-100 text-green-800' :
                        issue.confidence_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {issue.confidence_level}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};