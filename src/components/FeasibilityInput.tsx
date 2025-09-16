import { useState, useEffect } from 'react';
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
  onAnalysisEnd: () => void;
  isLoading: boolean;
}

export function FeasibilityInput({ onAnalysisComplete, onAnalysisStart, onAnalysisEnd, isLoading }: FeasibilityInputProps) {
  const [projectAddress, setProjectAddress] = useState('');
  const [aiPrompt, setAiPrompt] = useState(
    'Extract the lot size, zoning designation, and jurisdiction (city/county) from this residential property address. Provide accurate information based on public records and zoning data.'
  );
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Load existing prompt from database on component mount
  useEffect(() => {
    const loadPrompt = async () => {
      try {
        const { data, error } = await supabase
          .from('agent_prompts')
          .select('prompt')
          .eq('name', 'default_Feasibility_Prompt')
          .maybeSingle();

        if (error) {
          console.error('Error loading prompt:', error);
          return;
        }

        if (data?.prompt) {
          setAiPrompt(data.prompt);
        }
      } catch (error) {
        console.error('Error loading prompt:', error);
      }
    };

    loadPrompt();
  }, []);

  const handleUpdatePrompt = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt before saving');
      return;
    }

    setIsSavingPrompt(true);

    try {
      const { error } = await supabase
        .from('agent_prompts')
        .upsert({
          name: 'default_Feasibility_Prompt',
          prompt: aiPrompt.trim()
        }, {
          onConflict: 'name'
        });

      if (error) {
        throw error;
      }

      toast.success('Prompt updated successfully');
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update prompt');
    } finally {
      setIsSavingPrompt(false);
    }
  };

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
    } finally {
      onAnalysisEnd();
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
        
        <div className="flex gap-2">
          <Button 
            onClick={handleRun} 
            disabled={isLoading || !projectAddress.trim()}
            className="flex-1"
          >
            {isLoading ? 'Running Analysis...' : 'RUN'}
          </Button>
          <Button 
            variant="outline"
            onClick={handleUpdatePrompt}
            disabled={isLoading || isSavingPrompt}
          >
            {isSavingPrompt ? 'Saving...' : 'Update Prompt'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}