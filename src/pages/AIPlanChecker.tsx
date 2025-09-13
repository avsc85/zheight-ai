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

const AIPlanChecker = () => {
  const [analysisIssues, setAnalysisIssues] = useState<ArchitecturalIssueReport[]>([]);
  
  const handlePromptChange = (prompt: string) => {
    console.log("Prompt updated:", prompt);
  };

  const handleIssuesUpdate = (issues: ArchitecturalIssueReport[]) => {
    setAnalysisIssues(issues);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            AI Plan Checker
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Extract compliance checklists and verify architectural plans with AI-powered tools
          </p>
        </div>

        {/* Agent 1 Interface */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Agent 1: Checklist Extractor</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ChecklistExtractor />
            <PromptEditor onPromptChange={handlePromptChange} agentType="agent1" />
          </div>
        </div>

        {/* Agent 2 Interface */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Agent 2: Plan Checker</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <PlanChecker onIssuesUpdate={handleIssuesUpdate} />
            <PromptEditor onPromptChange={handlePromptChange} agentType="agent2" />
          </div>
          
          {/* Full-width Analysis Results */}
          <AnalysisResults issues={analysisIssues} />
        </div>
      </main>
    </div>
  );
};

export default AIPlanChecker;