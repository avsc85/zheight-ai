import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ChecklistExtractor } from "@/components/ChecklistExtractor";
import { PlanChecker } from "@/components/PlanChecker";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to auth page
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              AI-Powered Building Code Compliance
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Automate your building code compliance and QA review process with two specialized AI agents 
              that extract requirements from historical data and analyze new plans for compliance gaps.
            </p>
          </div>

          <Tabs defaultValue="extractor" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="extractor" className="text-sm font-medium">
                Agent-1: Checklist Extractor
              </TabsTrigger>
              <TabsTrigger value="checker" className="text-sm font-medium">
                Agent-2: Plan Checker
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="extractor" className="space-y-6">
              <ChecklistExtractor />
            </TabsContent>
            
            <TabsContent value="checker" className="space-y-6">
              <PlanChecker />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;