import { useState } from "react";
import { Header } from "@/components/Header";
import { ChecklistExtractor } from "@/components/ChecklistExtractor";
import { PlanChecker } from "@/components/PlanChecker";
import { PromptEditor } from "@/components/PromptEditor";
import { AnalysisResults } from "@/components/AnalysisResults";

interface ArchitecturalIssueReport {
  id: string;
  checklist_item_id: string;
  analysis_session_id: string;
  plan_sheet_name: string;
  issue_description: string;
  location_in_sheet: string;
  issue_type: "Missing" | "Non-compliant" | "Inconsistent" | "Need Revision";
  compliance_source: "California Code" | "Local";
  specific_code_identifier: string;
  short_code_requirement: string;
  long_code_requirement: string;
  source_link: string;
  confidence_level: "High" | "Medium" | "Low";
  confidence_rationale: string;
  created_at: string;
}

const AIPlanChecker = () => {
  const [analysisIssues, setAnalysisIssues] = useState<ArchitecturalIssueReport[]>([]);
  
  const handlePromptChange = (prompt: string) => {
    console.log("Prompt updated:", prompt);
  };

  const handleIssuesUpdate = (issues: ArchitecturalIssueReport[]) => {
    setAnalysisIssues(issues);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            AI Plan Checker
          </h1>
          <p className="text-muted-foreground">
            Extract compliance checklists and verify architectural plans with AI-powered tools
          </p>
        </div>

        {/* Agent 1 Interface */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">1</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Checklist Extractor</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChecklistExtractor />
            <PromptEditor onPromptChange={handlePromptChange} agentType="agent1" />
          </div>
        </div>

        {/* Agent 2 Interface */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">2</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Plan Checker</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-8">
            <PlanChecker onIssuesUpdate={handleIssuesUpdate} />
            <div className="h-full">
              <PromptEditor onPromptChange={handlePromptChange} agentType="agent2" />
            </div>
          </div>
          
          {/* Full-width Analysis Results */}
          <AnalysisResults issues={analysisIssues} />
        </div>
      </main>
    </div>
  );
};

export default AIPlanChecker;
