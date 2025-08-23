import { useState } from "react";
import { Header } from "@/components/Header";
import { ChecklistExtractor } from "@/components/ChecklistExtractor";
import { PlanChecker } from "@/components/PlanChecker";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
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