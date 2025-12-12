import { useState, useEffect } from "react";
import { Paperclip, Download, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface ProjectAttachmentDialogProps {
  projectId: string;
  projectName: string;
}

export const ProjectAttachmentDialog = ({
  projectId,
  projectName,
}: ProjectAttachmentDialogProps) => {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAttachments();
    }
  }, [open, projectId]);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from("attachments" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error: any) {
      console.error("Error fetching attachments:", error);
    }
  };

  const handleDownload = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("project-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 relative"
          title="Project Documents"
        >
          <FolderOpen className="h-4 w-4 text-blue-600" />
          {attachments.length > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-blue-500 text-white"
            >
              {attachments.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Documents - {projectName}</DialogTitle>
          <DialogDescription>
            Global project attachments (read-only view)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {attachments.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {attachments.length} file{attachments.length !== 1 ? 's' : ''} available
              </p>
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Paperclip className="h-4 w-4 flex-shrink-0 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.file_name}
                    </p>
                    {attachment.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {attachment.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>
                        {(attachment.file_size / 1024).toFixed(1)} KB
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(attachment.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(attachment)}
                    className="h-8 px-3"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                No project documents available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Project manager can upload files in Project Setup
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
