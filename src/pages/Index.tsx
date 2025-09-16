import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Bot, FileCheck, Folder, Calculator } from "lucide-react";

const Index = () => {
  const { user } = useAuth();

  const handlePromptChange = (prompt: string) => {
    console.log("Prompt updated:", prompt);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            zHeight Internal AI Applications
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Streamline your architectural workflow with AI-powered code compliance tools and project management
          </p>
          
          {!user && (
            <div className="mt-8">
              <Link to="/auth">
                <Button size="lg" className="mr-4">
                  Sign In to Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Project Management Tool */}
          <Card className="hover:shadow-lg transition-shadow border-primary/20 flex flex-col h-full">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Project Management Tool
              </CardTitle>
              <CardDescription>
                Comprehensive project setup, milestone tracking, and AR assignment system
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-4 flex-1">
                Manage projects, assign tasks to ARs, and track progress through Kanban boards and detailed reporting.
              </p>
              <Link to="/project-mgmt">
                <Button className="w-full">
                  Access Project Management
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* AI Agent 1 */}
          <Card className="hover:shadow-lg transition-shadow border-primary/20 flex flex-col h-full">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Agent 1: Checklist Extractor
              </CardTitle>
              <CardDescription>
                Extract compliance checklists from plan check documents
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-4 flex-1">
                AI-powered analysis of architectural documents to extract compliance requirements.
              </p>
              <Link to="/ai-plan-checker">
                <Button className="w-full">
                  Access Checklist Extractor
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* AI Agent 2 */}
          <Card className="hover:shadow-lg transition-shadow border-primary/20 flex flex-col h-full">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                AI Agent 2: Plan Checker
              </CardTitle>
              <CardDescription>
                Verify architectural plans against extracted requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-4 flex-1">
                Compare your architectural plans against compliance requirements for quality assurance.
              </p>
              <Link to="/ai-plan-checker">
                <Button className="w-full">
                  Access Plan Checker
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* AI Agent 3 - Feasibility Checker */}
        <div className="max-w-md mb-12">
          <Card className="hover:shadow-lg transition-shadow border-primary/20 flex flex-col h-full">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                AI Agent 3: Feasibility Checker
              </CardTitle>
              <CardDescription>
                AI-powered residential single-family house feasibility analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-4 flex-1">
                Analyze lot details, zoning, and jurisdiction data against local ordinance requirements for residential projects.
              </p>
              <Link to="/ai-feasibility">
                <Button className="w-full">
                  Access the Feasibility Checker
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
};

export default Index;