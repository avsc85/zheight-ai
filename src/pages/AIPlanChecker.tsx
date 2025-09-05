import { Header } from "@/components/Header";
import { ChecklistExtractor } from "@/components/ChecklistExtractor";
import { PlanChecker } from "@/components/PlanChecker";
import { PromptEditor } from "@/components/PromptEditor";

const AIPlanChecker = () => {
  const handlePromptChange = (prompt: string) => {
    console.log("Prompt updated:", prompt);
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
            <PromptEditor onPromptChange={handlePromptChange} />
          </div>
        </div>

        {/* Agent 2 Interface */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Agent 2: Plan Checker</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PlanChecker />
            <PromptEditor onPromptChange={handlePromptChange} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIPlanChecker;