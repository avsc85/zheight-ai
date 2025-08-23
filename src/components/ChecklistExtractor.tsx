import { useState } from "react";
import { AgentCard } from "./AgentCard";
import { DocumentUpload } from "./DocumentUpload";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileSearch, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistItem {
  id: string;
  sheet_name?: string;
  issue_to_check: string;
  location?: string;
  type_of_issue?: string;
  code_source?: string;
  code_identifier?: string;
  short_code_requirement?: string;
  long_code_requirement?: string;
  source_link?: string;
  project_type?: string;
  city?: string;
  zip_code?: string;
  reviewer_name?: string;
  type_of_correction?: string;
  created_at: string;
}

export const ChecklistExtractor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedItems, setExtractedItems] = useState<ChecklistItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const handleFilesUploaded = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const startExtraction = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files uploaded",
        description: "Please upload correction letters and plans first",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please log in to use this feature");
      }

      // Create FormData with files
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Update progress
      setProgress(25);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('agent1-extract-checklist', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      setProgress(75);

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Extraction failed');
      }

      setProgress(100);
      setExtractedItems(data.data || []);
      
      toast({
        title: "Extraction complete",
        description: `Successfully extracted and saved ${data.extractedCount || 0} compliance items`,
      });

    } catch (error: any) {
      console.error('Extraction error:', error);
      toast({
        title: "Extraction failed",
        description: error.message || "Failed to process documents",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <AgentCard
        title="Agent-1: Checklist Extractor"
        description="Extracts compliance checklists from historical correction letters and plans"
        icon={FileSearch}
        status={isProcessing ? "processing" : uploadedFiles.length > 0 ? "active" : "idle"}
        onAction={startExtraction}
        actionLabel={isProcessing ? "Processing..." : "Start Extraction"}
      >
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Analyzing documents with AI...</span>
              <span className="text-foreground font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </AgentCard>

      <DocumentUpload
        title="Upload Historical Documents"
        description="Upload city correction letters and corresponding architectural plans (PDF files only, max 20MB per file, 25MB total)"
        acceptedTypes={["application/pdf"]}
        onFilesUploaded={handleFilesUploaded}
        maxFiles={10}
      />

      {extractedItems.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Extracted Checklist</h3>
              <p className="text-muted-foreground text-sm">
                {extractedItems.length} compliance items identified and saved
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button size="sm" variant="gradient">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {extractedItems.map(item => (
              <div key={item.id} className="p-4 bg-muted rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {item.type_of_correction && (
                      <Badge variant="outline">{item.type_of_correction}</Badge>
                    )}
                    {item.type_of_issue && (
                      <Badge variant="secondary">{item.type_of_issue}</Badge>
                    )}
                    {item.city && (
                      <Badge className="bg-primary text-primary-foreground">{item.city}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-foreground font-medium mb-2">{item.issue_to_check}</p>
                {item.location && (
                  <p className="text-muted-foreground text-sm mb-1">
                    <strong>Location:</strong> {item.location}
                  </p>
                )}
                {item.code_identifier && (
                  <p className="text-muted-foreground text-sm mb-1">
                    <strong>Code:</strong> {item.code_identifier}
                  </p>
                )}
                {item.short_code_requirement && (
                  <p className="text-muted-foreground text-sm">
                    <strong>Requirement:</strong> {item.short_code_requirement}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};