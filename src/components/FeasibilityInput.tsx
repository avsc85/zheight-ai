import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FeasibilityAnalysis, JurisdictionOrdinance } from '@/pages/AIFeasibility';

interface FeasibilityInputProps {
  onAnalysisComplete: (analysis: FeasibilityAnalysis, ordinances: JurisdictionOrdinance[]) => void;
  onAnalysisStart: () => void;
  isLoading: boolean;
}

export function FeasibilityInput({ onAnalysisComplete, onAnalysisStart, isLoading }: FeasibilityInputProps) {
  const [projectAddress, setProjectAddress] = useState('');
  const [aiPrompt, setAiPrompt] = useState(
    'Extract the lot size, zoning designation, and jurisdiction (city/county) from this residential property address. Provide accurate information based on public records and zoning data.'
  );

  const handleRun = async () => {
    if (!projectAddress.trim()) {
      toast.error('Please enter a project address');
      return;
    }

    onAnalysisStart();

    try {
      const { data, error } = await supabase.functions.invoke('ai-feasibility-analyzer', {
        body: {
          projectAddress: projectAddress.trim(),
          prompt: aiPrompt.trim()
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('Feasibility analysis completed successfully');
      onAnalysisComplete(data.feasibilityAnalysis, data.ordinances);
      
    } catch (error) {
      console.error('Error running feasibility analysis:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run feasibility analysis');
      onAnalysisStart(); // Reset loading state
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Input</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-address">Project Address</Label>
          <Input
            id="project-address"
            placeholder="Enter the project address..."
            value={projectAddress}
            onChange={(e) => setProjectAddress(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="ai-prompt">AI Prompt</Label>
          <Textarea
            id="ai-prompt"
            placeholder="Enter AI prompt for analysis..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={4}
            disabled={isLoading}
          />
        </div>
        
        <Button 
          onClick={handleRun} 
          disabled={isLoading || !projectAddress.trim()}
          className="w-full"
        >
          {isLoading ? 'Running Analysis...' : 'RUN'}
        </Button>
      </CardContent>
    </Card>
  );
}