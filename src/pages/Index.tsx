import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, FileCheck, Folder, Calculator, Zap, ArrowRight } from "lucide-react";

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-header py-16 md:py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-header-foreground mb-6 leading-tight">
              AI-Powered Building Code
              <span className="text-primary block">Compliance & Project Management</span>
            </h1>
            <p className="text-xl text-header-foreground/70 mb-8 leading-relaxed">
              Streamline your architectural workflow with intelligent tools for code compliance verification and project tracking.
            </p>
            
            {!user && (
              <Link to="/auth">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <main className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Available Tools</h2>
          <p className="text-muted-foreground">Select a tool to get started with your workflow</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Project Management Tool */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
            <CardHeader className="pb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Folder className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg text-foreground">Project Management</CardTitle>
              <CardDescription className="text-muted-foreground">
                Comprehensive project setup, milestone tracking, and AR assignment system
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/project-mgmt">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group-hover:shadow-primary transition-shadow">
                  Open Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* AI Agent 1 */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
            <CardHeader className="pb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg text-foreground">Agent 1: Checklist Extractor</CardTitle>
              <CardDescription className="text-muted-foreground">
                Extract compliance checklists from plan check documents using AI
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/ai-plan-checker">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group-hover:shadow-primary transition-shadow">
                  Extract Checklist
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* AI Agent 2 */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
            <CardHeader className="pb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg text-foreground">Agent 2: Plan Checker</CardTitle>
              <CardDescription className="text-muted-foreground">
                Verify architectural plans against extracted requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/ai-plan-checker">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group-hover:shadow-primary transition-shadow">
                  Check Plans
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* AI Agent 3 */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
            <CardHeader className="pb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg text-foreground">Agent 3: Feasibility Checker</CardTitle>
              <CardDescription className="text-muted-foreground">
                AI-powered residential single-family house feasibility analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/ai-feasibility">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group-hover:shadow-primary transition-shadow">
                  Analyze Feasibility
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* AI Agent 4 - Coming Soon */}
          <Card className="group border-border/30 opacity-60">
            <CardHeader className="pb-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-3">
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg text-muted-foreground">Agent 4: Title 24</CardTitle>
              <CardDescription className="text-muted-foreground">
                California Title 24 energy compliance analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full" variant="secondary" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
