import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, parseISO } from "date-fns";

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  comment: string;
  created_at: string;
}

interface TaskCommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskName: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isMandatory?: boolean;
  mandatoryPrompt?: string;
  onCommentSubmitted?: () => void;
}

export const TaskCommentDialog = ({
  open,
  onOpenChange,
  taskId,
  taskName,
  currentUserId,
  currentUserName,
  currentUserRole,
  isMandatory = false,
  mandatoryPrompt = "",
  onCommentSubmitted,
}: TaskCommentDialogProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && taskId) {
      fetchComments();
    }
  }, [open, taskId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      
      // Fetch comments from the notes table
      const { data: notesData, error } = await supabase
        .from('notes')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error fetching notes:", error);
        // Fallback to localStorage
        const storedComments = localStorage.getItem(`task_comments_${taskId}`);
        if (storedComments) {
          setComments(JSON.parse(storedComments));
        } else {
          setComments([]);
        }
      } else if (notesData) {
        // Transform notes data to comments format
        const transformedComments: Comment[] = notesData.map(note => ({
          id: note.comment_id,
          task_id: note.task_id || '',
          user_id: note.user_id || '',
          user_name: 'AR', // Will be fetched separately if needed
          user_role: 'ar1_planning',
          comment: note.notes_tasks,
          created_at: note.created_at || new Date().toISOString(),
        }));
        setComments(transformedComments);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching comments:", error);
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Insert comment into the notes table
      const { data: insertedNote, error: insertError } = await supabase
        .from('notes')
        .insert({
          task_id: taskId,
          user_id: currentUserId,
          notes_tasks: newComment.trim(),
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting note:", insertError);
        // Fallback to localStorage
        const comment: Comment = {
          id: `comment_${Date.now()}`,
          task_id: taskId,
          user_id: currentUserId,
          user_name: currentUserName,
          user_role: currentUserRole,
          comment: newComment.trim(),
          created_at: new Date().toISOString(),
        };

        const storedComments = localStorage.getItem(`task_comments_${taskId}`);
        const existingComments = storedComments ? JSON.parse(storedComments) : [];
        const updatedComments = [...existingComments, comment];
        localStorage.setItem(`task_comments_${taskId}`, JSON.stringify(updatedComments));
        setComments(updatedComments);
      } else {
        // Also update the notes_tasks_ar field on the task
        await supabase
          .from('project_tasks')
          .update({ notes_tasks_ar: newComment.trim() })
          .eq('task_id', taskId);

        // Refresh comments
        await fetchComments();
      }

      setNewComment("");

      // Send notification to task assignee
      await sendNotification({
        id: insertedNote?.comment_id || `comment_${Date.now()}`,
        task_id: taskId,
        user_id: currentUserId,
        user_name: currentUserName,
        user_role: currentUserRole,
        comment: newComment.trim(),
        created_at: new Date().toISOString(),
      });

      toast({
        title: "Comment Posted",
        description: "Your comment has been added and saved.",
      });

      // Call the callback if provided (for mandatory comments)
      if (onCommentSubmitted) {
        onCommentSubmitted();
      }

      // Close dialog if mandatory (after status update will happen)
      if (isMandatory) {
        setTimeout(() => onOpenChange(false), 500);
      }

      setSubmitting(false);
    } catch (error) {
      console.error("Error posting comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const sendNotification = async (comment: Comment) => {
    try {
      // Get task details including assigned AR
      const { data: task } = await supabase
        .from('project_tasks')
        .select('assigned_ar_id, task_name, project_id')
        .eq('task_id', taskId)
        .single();

      if (task && task.assigned_ar_id) {
        // In production, you would insert into a notifications table
        // For now, we'll just log it
        console.log('Notification would be sent to:', task.assigned_ar_id);
        
        // Store notification in localStorage
        const notificationKey = `notifications_${task.assigned_ar_id}`;
        const storedNotifications = localStorage.getItem(notificationKey);
        const notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
        
        notifications.push({
          id: `notif_${Date.now()}`,
          type: 'comment',
          task_id: taskId,
          task_name: taskName,
          message: `${comment.user_name} commented on "${taskName}"`,
          comment: comment.comment,
          created_at: new Date().toISOString(),
          read: false,
        });
        
        localStorage.setItem(notificationKey, JSON.stringify(notifications));
      }
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'pm' || role === 'admin') {
      return <Badge variant="default" className="text-xs">PM</Badge>;
    } else if (role.includes('ar')) {
      return <Badge variant="outline" className="text-xs">AR</Badge>;
    }
    return null;
  };

  // Handle cancel - allows closing without comment, task stays in old status
  const handleCancel = () => {
    setNewComment("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Always allow closing - the status change will be cancelled in the parent component
      if (!isOpen) {
        setNewComment("");
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {isMandatory ? "Add Required Comment" : "Task Comments"}
          </DialogTitle>
          <DialogDescription>
            {taskName}
            {isMandatory && (
              <span className="block mt-2 text-orange-600 font-medium">
                ⚠️ {mandatoryPrompt || "You must add a comment to proceed"}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isMandatory && (
            <div className="border rounded-lg">
              <ScrollArea className="h-[300px] p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-muted-foreground">Loading comments...</div>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No comments yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Be the first to comment!</p>
                  </div>
                ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{comment.user_name}</span>
                            {getRoleBadge(comment.user_role)}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {comment.comment}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          )}

          {/* New Comment Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isMandatory ? "Your Comment (Required)" : "Add Comment"}
            </label>
            <Textarea
              placeholder={
                isMandatory 
                  ? "Describe what you did or what you're working on... (Required)"
                  : "Type your comment here... (PMs can provide feedback, ARs can add updates)"
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className={`min-h-[100px] resize-none ${isMandatory ? 'border-orange-500 focus:border-orange-600' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleSubmitComment();
                }
              }}
              autoFocus={isMandatory}
            />
            <p className="text-xs text-muted-foreground">
              {isMandatory ? "This comment is required to proceed" : "Press Ctrl+Enter to submit quickly"}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isMandatory && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="text-muted-foreground"
            >
              Cancel (Keep Current Status)
            </Button>
          )}
          {!isMandatory && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
          <Button
            onClick={handleSubmitComment}
            disabled={submitting || !newComment.trim()}
            className={`flex items-center gap-2 ${isMandatory ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
          >
            <Send className="h-4 w-4" />
            {submitting ? "Posting..." : isMandatory ? "Submit & Continue" : "Post Comment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
