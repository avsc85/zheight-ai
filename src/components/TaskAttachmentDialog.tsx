import { useState, useEffect } from "react";
import { Paperclip, X, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface TaskAttachmentDialogProps {
  taskId: string;
  taskName: string;
  canEdit?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const TaskAttachmentDialog = ({
  taskId,
  taskName,
  canEdit = true,
}: TaskAttachmentDialogProps) => {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAttachments();
    }
  }, [open, taskId]);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from("attachments" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error: any) {
      console.error("Error fetching attachments:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 50MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const filePath = `${taskId}/${timestamp}_${randomStr}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("attachments" as any).insert({
        task_id: taskId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type.split("/")[0],
        file_size: file.size,
        mime_type: file.type,
        description: description || null,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      toast({
        title: "Uploaded",
        description: `${file.name} uploaded successfully.`,
      });

      setDescription("");
      event.target.value = "";
      fetchAttachments();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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

  const handleDelete = async (attachment: any) => {
    if (!confirm(`Delete ${attachment.file_name}?`)) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("project-attachments")
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("attachments" as any)
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      toast({
        title: "Deleted",
        description: `${attachment.file_name} deleted.`,
      });

      fetchAttachments();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
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
          title="Attachments"
        >
          <Paperclip className="h-4 w-4" />
          {attachments.length > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {attachments.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attachments - {taskName}</DialogTitle>
          <DialogDescription>
            Upload drawings, issues, or reference documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {canEdit && (
            <div className="space-y-2">
              <Label htmlFor={`desc-${taskId}`} className="text-xs">
                Description (optional)
              </Label>
              <Input
                id={`desc-${taskId}`}
                placeholder="e.g., Floor plan issue"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-sm"
              />
              <Label htmlFor={`file-${taskId}`} className="cursor-pointer">
                <div className="flex items-center gap-2 border-2 border-dashed rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {uploading ? "Uploading..." : "Click to upload"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, images, docs (max 50MB)
                    </p>
                  </div>
                </div>
              </Label>
              <Input
                id={`file-${taskId}`}
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
          )}

          {attachments.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Files ({attachments.length})
              </Label>
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 rounded-md border bg-card"
                >
                  <Paperclip className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.file_name}
                    </p>
                    {attachment.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {attachment.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(attachment.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(attachment)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(attachment)}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No attachments yet
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
