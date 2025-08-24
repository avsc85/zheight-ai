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
}

export const PromptEditor = ({ onPromptChange, isReadonly = false }: PromptEditorProps) => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const defaultPrompt = "You are an AI assistant specialized in analyzing architectural plans and city correction letters to extract compliance checklists.";

  // Fetch the default prompt on component mount
  useEffect(() => {
    const fetchDefaultPrompt = async () => {
      try {
        const { data, error } = await supabase
          .from('agent_prompts')
          .select('prompt')
          .eq('name', 'default_checklist_extractor')
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error fetching prompt:', error);
        }
        
        const fetchedPrompt = data?.prompt || defaultPrompt;
        setPrompt(fetchedPrompt);
        onPromptChange(fetchedPrompt);
      } catch (error) {
        console.error('Error fetching prompt:', error);
        setPrompt(defaultPrompt);
        onPromptChange(defaultPrompt);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDefaultPrompt();
  }, [onPromptChange]);

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
    onPromptChange(newPrompt);
  };

  const savePrompt = async () => {
    setIsSaving(true);
    try {
      // First try to update existing prompt
      const { error: updateError } = await supabase
        .from('agent_prompts')
        .update({ prompt, updated_at: new Date().toISOString() })
        .eq('name', 'default_checklist_extractor');

      // If no rows were updated (prompt doesn't exist), create it
      if (updateError && updateError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('agent_prompts')
          .insert({
            name: 'default_checklist_extractor',
            prompt: prompt
          });

        if (insertError) {
          throw insertError;
        }
      } else if (updateError) {
        throw updateError;
      }

      toast({
        title: "Prompt saved",
        description: "Default extraction prompt has been updated successfully.",
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
            ? "This is the current AI prompt used for extracting compliance checklists from documents."
            : "Customize the AI prompt to improve the quality and accuracy of extracted compliance items. This prompt will be used by OpenAI to analyze uploaded documents."
          }
        </p>
        
        <Textarea
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="Enter the AI prompt for document analysis..."
          className="min-h-[200px] resize-none"
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