import { useState } from "react";
import { Upload, X, File, Image, FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  description?: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface FileAttachmentProps {
  projectId?: string;
  taskId?: string;
  attachments: Attachment[];
  onAttachmentsChange: () => void;
  canEdit?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const FileAttachment = ({
  projectId,
  taskId,
  attachments,
  onAttachmentsChange,
  canEdit = true,
}: FileAttachmentProps) => {
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (mimeType === "application/pdf") return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload PDF, images, or Office documents only.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
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

      // Generate unique file path
      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const filePath = `${projectId || taskId}/${timestamp}_${randomStr}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save metadata to database
      const { error: dbError } = await supabase.from("attachments" as any).insert({
        project_id: projectId || null,
        task_id: taskId || null,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type.split("/")[0], // image, application, etc.
        file_size: file.size,
        mime_type: file.type,
        description: description || null,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      toast({
        title: "File Uploaded",
        description: `${file.name} uploaded successfully.`,
      });

      setDescription("");
      event.target.value = ""; // Reset input
      onAttachmentsChange();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("project-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download file.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete ${attachment.file_name}?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("project-attachments")
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("attachments" as any)
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      toast({
        title: "File Deleted",
        description: `${attachment.file_name} deleted successfully.`,
      });

      onAttachmentsChange();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete file.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Attachments</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Upload drawings, issues, or reference documents (PDF, images, Office files)
        </p>
      </div>
      <div className="space-y-3">
        {canEdit && (
          <div className="space-y-2">
            <div>
              <Input
                id={`desc-${projectId || taskId}`}
                placeholder="Optional: Add description (e.g., Floor plan issue)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-sm h-8"
              />
            </div>
            <div>
              <Label
                htmlFor={`file-${projectId || taskId}`}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 border-2 border-dashed rounded-md p-3 hover:bg-accent/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">
                      {uploading ? "Uploading..." : "Click to upload file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max 50MB
                    </p>
                  </div>
                </div>
              </Label>
              <Input
                id={`file-${projectId || taskId}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </div>
        )}

        {attachments.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {attachments.length} file{attachments.length > 1 ? 's' : ''}
            </Label>
            <div className="space-y-1">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors text-xs"
                >
                  <div className="flex-shrink-0">
                    {getFileIcon(attachment.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {attachment.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(attachment.file_size)}</span>
                      {attachment.description && (
                        <>
                          <span>•</span>
                          <span className="truncate">{attachment.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(attachment)}
                      className="h-7 w-7 p-0"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(attachment)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            No attachments yet
          </p>
        )}
      </div>
    </div>
  );
};
