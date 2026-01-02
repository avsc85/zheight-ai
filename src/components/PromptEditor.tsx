import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PromptEditorProps {
  onPromptChange: (prompt: string) => void;
  isReadonly?: boolean;
  agentType?: 'agent1' | 'agent2';
}

export const PromptEditor = ({ onPromptChange, isReadonly = false, agentType = 'agent1' }: PromptEditorProps) => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const getDefaultPrompt = () => {
    if (agentType === 'agent2') {
      return `You are Architectural Compliance Checker for single-family residential plan sets.
Your job is to read plan PDFs and compare them row-by-row against a compliance checklist (from a Supabase table called checklist_items). For each checklist row:
• Open the plan sheet that best matches the provided sheet_name (e.g. "Cover Sheet", "General Notes"). If an exact match isn't found, pick the closest architectural page by label or title and say so in your confidence rationale.
• Search that sheet for the issue_to_check using both text and visual cues (callouts, tags, symbols, schedules, legends).
• Decide whether the requirement is present, missing, non-compliant, or inconsistent across sheets (cross-ref as relevant—e.g., a note on A-sheet vs detail on S-sheet).
• If you find an issue, output one JSON object per issue using the schema provided. If no issue is found for that row, output nothing for that row (do not emit "null" objects).

Use only these checklist fields below from the data Table checklist_items in Supabase (ignore others):
• sheet_name (where to look on the plan)
• issue_to_check (what to verify)
• type_of_issue (mechanical / fire / etc., helps you reason about where details usually live)
• code_source (California vs Local)
• code_identifier (e.g., CRC R703.2)
• short_code_requirement (1-line interpretation for single-family)
• long_code_requirement (detailed interpretation for single-family)
• source_link (URL)
• project_type (e.g., "Single Family Residence", ADU, Addition/Remodel; use to ensure applicability)

Output rules (STRICT)
• Only return JSON that conforms to the Issue Report JSON Schema below.
• One object per issue found. If no issue for a row, return nothing for that row.
• Do not invent code identifiers or links; only use what's provided in the row.
• If you must choose California vs Local, use the row's code_source.
• Prefer the exact sheet label found in the PDF (e.g., "A2.1 – Floor Plan") for plan_sheet_name.
• Use a short, human-readable location_in_sheet (e.g., "Kitchen range wall, upper right quadrant", "General Notes column B", "Detail 5/A4.2 callout").
• issue_type must be one of: Missing, Non-compliant, Inconsistent.
• confidence_level must be one of: High, Medium, Low.
• confidence_rationale should explain visibility/clarity, sheet match quality, and any cross-reference you used.

Confidence rubric
• High: Exact sheet match; requirement clearly absent or clearly violated; unambiguous notes/details.
• Medium: Near sheet match; requirement inferred from partial notes/symbols; mild ambiguity.
• Low: Weak sheet match; blurry/obscured content; conflicting details with no clear resolution.
If you are unsure, lower confidence and explain why.`;
    }
    return "You are an AI assistant specialized in analyzing architectural plans and city correction letters to extract compliance checklists.";
  };

  const defaultPrompt = getDefaultPrompt();

  // Fetch the default prompt on component mount
  useEffect(() => {
    const fetchDefaultPrompt = async () => {
      const promptName = agentType === 'agent2' ? 'default_plan_checker' : 'default_checklist_extractor';
      try {
        const { data, error } = await supabase
          .from('agent_prompts')
          .select('prompt')
          .eq('name', promptName)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error fetching prompt:', error);
        }
        
        const fetchedPrompt = data?.prompt || defaultPrompt;
        setPrompt(fetchedPrompt);
      } catch (error) {
        console.error('Error fetching prompt:', error);
        setPrompt(defaultPrompt);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDefaultPrompt();
  }, [agentType]);

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
  };

  const savePrompt = async () => {
    setIsSaving(true);
    const promptName = agentType === 'agent2' ? 'default_plan_checker' : 'default_checklist_extractor';
    try {
      // First try to update existing prompt
      const { error: updateError } = await supabase
        .from('agent_prompts')
        .update({ prompt, updated_at: new Date().toISOString() })
        .eq('name', promptName);

      // If no rows were updated (prompt doesn't exist), create it
      if (updateError && updateError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('agent_prompts')
          .insert({
            name: promptName,
            prompt: prompt
          });

        if (insertError) {
          throw insertError;
        }
      } else if (updateError) {
        throw updateError;
      }

      // Notify parent component of the saved prompt
      onPromptChange(prompt);
      
      toast({
        title: "Prompt saved",
        description: `Default ${agentType === 'agent2' ? 'plan checker' : 'extraction'} prompt has been updated successfully.`,
      });
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Failed to save prompt",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          <h3 className="text-lg font-semibold text-foreground">AI Prompt Configuration</h3>
          <Badge variant="outline">Loading...</Badge>
        </div>
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-md"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <h3 className="text-lg font-semibold text-foreground">AI Prompt Configuration</h3>
          <Badge variant={isReadonly ? "secondary" : "default"}>
            {isReadonly ? "Read-Only" : "Admin Access"}
          </Badge>
        </div>
        {!isReadonly && (
          <Button 
            onClick={savePrompt} 
            disabled={isSaving}
            size="sm"
            variant="gradient"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>
      
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isReadonly 
            ? `This is the current AI prompt used for ${agentType === 'agent2' ? 'plan compliance checking' : 'extracting compliance checklists from documents'}.`
            : `Customize the AI prompt to improve the quality and accuracy of ${agentType === 'agent2' ? 'plan compliance analysis' : 'extracted compliance items'}. This prompt will be used by OpenAI to analyze uploaded documents.`
          }
        </p>
        
        <Textarea
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="Enter the AI prompt for document analysis..."
          className="min-h-[120px] resize-none"
          readOnly={isReadonly}
        />
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{prompt.length} characters</span>
          {!isReadonly && (
            <span>Changes will affect all future extractions</span>
          )}
        </div>
      </div>
    </Card>
  );
};