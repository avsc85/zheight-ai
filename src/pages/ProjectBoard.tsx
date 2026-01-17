import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Edit, Save, X, GripVertical, MessageSquare } from "lucide-react";
import { TaskCommentDialog } from "@/components/TaskCommentDialog";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Task {
  id: string;
  project: string;
  task: string;
  deadline: string;
  priority: string;
  notesAR: string;
  notesPM: string;
  status: 'in_queue' | 'started' | 'completed' | 'blocked';
  timeAllocated: number;
  arAssigned: string;
  arAssignedName?: string;
  projectId: string;
  completionDate?: string;
  milestoneNumber: number;
  arComment?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  previousStatus?: string;
}

const DroppableColumn = ({ children, id, className }: { children: React.ReactNode; id: string; className?: string }) => {
  const { setNodeRef } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
};

const SortableTaskCard = ({ task, onUpdateNotes, onUpdateStatus, currentUserId, userRole, onStatusChangeWithComment }: { 
  task: Task; 
  onUpdateNotes: (taskId: string, notes: string, type: 'ar' | 'pm') => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  currentUserId: string;
  userRole: string | null;
  onStatusChangeWithComment: (taskId: string, newStatus: Task['status']) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskCard 
        task={task} 
        onUpdateNotes={onUpdateNotes}
        onUpdateStatus={onUpdateStatus}
        currentUserId={currentUserId}
        userRole={userRole}
        dragHandleProps={listeners}
        onStatusChangeWithComment={onStatusChangeWithComment}
      />
    </div>
  );
};

const TaskCard = ({ task, onUpdateNotes, onUpdateStatus, currentUserId, userRole, dragHandleProps, onStatusChangeWithComment }: { 
  task: Task; 
  onUpdateNotes: (taskId: string, notes: string, type: 'ar' | 'pm') => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  currentUserId: string;
  userRole: string | null;
  dragHandleProps?: any;
  onStatusChangeWithComment?: (taskId: string, newStatus: Task['status']) => void;
}) => {
  const [isEditingARNotes, setIsEditingARNotes] = useState(false);
  const [isEditingPMNotes, setIsEditingPMNotes] = useState(false);
  const [editedARNotes, setEditedARNotes] = useState(task.notesAR || "");
  const [editedPMNotes, setEditedPMNotes] = useState(task.notesPM || "");

  const getPriorityBadge = () => {
    if (task.priority) {
      return <Badge variant="destructive" className="mb-2 text-xs">{task.priority}</Badge>;
    }
    return null;
  };

  const getApprovalStatusBadge = () => {
    if (task.status !== 'completed') return null;
    
    const status = task.approvalStatus || 'pending';
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600 text-xs">
            ✓ Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500 text-white hover:bg-red-600 text-xs">
            ✗ Rejected
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-xs">
            ⏳ Pending Approval
          </Badge>
        );
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'started': return 'border-l-status-started';
      case 'completed': return 'border-l-status-done';
      case 'blocked': return 'border-l-status-blocked';
      default: return 'border-l-status-queue';
    }
  };

  const handleSaveARNotes = () => {
    onUpdateNotes(task.id, editedARNotes, 'ar');
    setIsEditingARNotes(false);
  };

  const handleSavePMNotes = () => {
    onUpdateNotes(task.id, editedPMNotes, 'pm');
    setIsEditingPMNotes(false);
  };

  const handleCancelAREdit = () => {
    setEditedARNotes(task.notesAR || "");
    setIsEditingARNotes(false);
  };

  const handleCancelPMEdit = () => {
    setEditedPMNotes(task.notesPM || "");
    setIsEditingPMNotes(false);
  };

  // Enhanced logging for role-based permissions  
  console.log('Role check debug:', { 
    taskId: task.id,
    taskArAssigned: task.arAssigned, 
    currentUserId,
    userRoleObject: userRole,
    userRoleString: userRole,
    isTaskAssignedToUser: task.arAssigned === currentUserId
  });
  
  // AR users can edit AR notes if task is assigned to them
  const canEditARNotes = task.arAssigned === currentUserId && 
    (userRole === 'ar1_planning' || userRole === 'ar2_field' || userRole === 'admin');
  // Only admin can edit PM notes on AR Board (PMs have view-only access here)
  const canEditPMNotes = userRole === 'admin';  
  // Only AR users assigned to the task can edit status (PMs have view-only access)
  const canEditStatus = task.arAssigned === currentUserId && 
    (userRole === 'ar1_planning' || userRole === 'ar2_field' || userRole === 'admin');

  return (
    <Card className={`mb-4 border-l-4 ${getStatusColor()} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        {/* Approval Status Badge for completed tasks */}
        {task.status === 'completed' && (
          <div className="mb-2">{getApprovalStatusBadge()}</div>
        )}
        <div className="flex items-start justify-between mb-2">
          {getPriorityBadge()}
          <div className="flex items-center gap-2">
            {canEditStatus && (
              <Select 
                value={task.status} 
                onValueChange={(value) => {
                  const newStatus = value as Task['status'];
                  // Use comment-required handler for completed/blocked
                  if ((newStatus === 'completed' || newStatus === 'blocked') && onStatusChangeWithComment) {
                    onStatusChangeWithComment(task.id, newStatus);
                  } else {
                    onUpdateStatus(task.id, newStatus);
                  }
                }}
              >
                <SelectTrigger className="h-6 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_queue">In Queue</SelectItem>
                  <SelectItem value="started">Started</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            )}
            {dragHandleProps && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 cursor-grab active:cursor-grabbing"
                {...dragHandleProps}
              >
                <GripVertical className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              {userRole === 'ar1_planning' ? (
                <p className="font-medium text-sm text-foreground">{task.project}</p>
              ) : (
                <Link 
                  to={`/project-mgmt/setup/${task.projectId}`}
                  className="font-medium text-sm text-foreground hover:text-primary hover:underline transition-colors"
                >
                  {task.project}
                </Link>
              )}
              <p className="text-sm text-muted-foreground">{task.task}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{task.deadline}</p>
          </div>
          
          {/* Show AR Assigned info for PM/Admin */}
          {(userRole === 'pm' || userRole === 'admin') && task.arAssignedName && (
            <div className="bg-primary/5 p-2 rounded border border-primary/10">
              <p className="text-xs font-medium text-primary">
                Assigned to: {task.arAssignedName}
              </p>
            </div>
          )}
          
          {task.timeAllocated > 0 && (
            <p className="text-xs text-primary font-medium">
              Total Time taken: {task.timeAllocated} Hours
            </p>
          )}
          
          {/* AR Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">AR Comment:</label>
              {canEditARNotes && !isEditingARNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingARNotes(true)}
                  className="h-6 w-6 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {isEditingARNotes && canEditARNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={editedARNotes}
                  onChange={(e) => setEditedARNotes(e.target.value)}
                  className="text-xs min-h-16 resize-none"
                  placeholder="Add AR comment..."
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveARNotes}
                    className="h-6 text-xs text-green-600 hover:text-green-700"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelAREdit}
                    className="h-6 text-xs text-red-600 hover:text-red-700"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="min-h-6">
                {task.notesAR ? (
                  <p className="text-xs text-muted-foreground italic bg-status-started/5 p-2 rounded border border-status-started/10">
                    {task.notesAR}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    {canEditARNotes ? "Click edit to add AR comment..." : "No AR comment"}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* PM Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">PM Notes:</label>
              {canEditPMNotes && !isEditingPMNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingPMNotes(true)}
                  className="h-6 w-6 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {isEditingPMNotes && canEditPMNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={editedPMNotes}
                  onChange={(e) => setEditedPMNotes(e.target.value)}
                  className="text-xs min-h-16 resize-none"
                  placeholder="Add PM notes..."
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSavePMNotes}
                    className="h-6 text-xs text-green-600 hover:text-green-700"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelPMEdit}
                    className="h-6 text-xs text-red-600 hover:text-red-700"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="min-h-6">
                {task.notesPM ? (
                  <p className="text-xs text-muted-foreground italic bg-status-done/5 p-2 rounded border border-status-done/10">
                    {task.notesPM}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    No PM notes
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProjectBoard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedARFilter, setSelectedARFilter] = useState<string>('current');
  const [allARUsers, setAllARUsers] = useState<any[]>([]);
  
  // Mandatory comment dialog state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{taskId: string; newStatus: Task['status']} | null>(null);
  const [selectedTaskForComment, setSelectedTaskForComment] = useState<Task | null>(null);
  
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchTasks();
      if (userRole?.role === 'pm' || userRole?.role === 'admin') {
        fetchAllARUsers();
      }
    }
  }, [user, userRole]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchAllARUsers = async () => {
    try {
      console.log('Fetching all AR users for PM...');
      
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['ar1_planning', 'ar2_field']);

      if (rolesError) throw rolesError;

      if (userRoles && userRoles.length > 0) {
        const userIds = userRoles.map(role => role.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        const formattedUsers = userRoles.map(userRole => {
          const profile = profiles?.find(p => p.user_id === userRole.user_id);
          return {
            id: userRole.user_id,
            name: profile?.name || 'Unknown',
            role: userRole.role
          };
        });

        setAllARUsers(formattedUsers);
        console.log('All AR users loaded:', formattedUsers);
      }
    } catch (error) {
      console.error('Error fetching AR users:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      console.log('Fetching tasks for user:', user?.id, 'Role:', userRole?.role);
      
      // Apply role-based filtering
      if (userRole?.role === 'pm') {
        // Get PM's name first
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user?.id)
          .single();
        
        const pmName = profileData?.name;
        
        // First, get accessible project IDs for this PM
        let projectsQuery = supabase
          .from('projects')
          .select('id')
          .eq('status', 'active')
          .is('deleted_at', null);
        
        if (pmName) {
          projectsQuery = projectsQuery.or(`user_id.eq.${user?.id},project_manager_name.eq.${pmName}`);
        } else {
          projectsQuery = projectsQuery.eq('user_id', user?.id);
        }
        
        const { data: accessibleProjects } = await projectsQuery;
        const projectIds = (accessibleProjects || []).map(p => p.id);
        
        if (projectIds.length === 0) {
          setTasks([]);
          setLoading(false);
          return;
        }
        
        // Then fetch only assigned AR tasks for those projects
        const { data: tasks, error } = await supabase
          .from('project_tasks')
          .select(`
            *,
            projects (
              project_name,
              user_id,
              project_manager_name
            )
          `)
          .not('assigned_ar_id', 'is', null)
          .in('project_id', projectIds)
          .neq('assigned_skip_flag', 'Skip');
        
        if (error) throw error;
        
        await processTasks(tasks);
        
      } else if (userRole?.role === 'admin') {
        // Admin can see ALL tasks
        const { data: tasks, error } = await supabase
          .from('project_tasks')
          .select(`
            *,
            projects (
              project_name,
              user_id,
              project_manager_name
            )
          `)
          .neq('assigned_skip_flag', 'Skip');
        
        if (error) throw error;
        
        await processTasks(tasks);
        
      } else {
        // AR can only see tasks assigned to them
        const { data: tasks, error } = await supabase
          .from('project_tasks')
          .select(`
            *,
            projects (
              project_name,
              user_id,
              project_manager_name
            )
          `)
          .not('assigned_ar_id', 'is', null)
          .eq('assigned_ar_id', user?.id)
          .neq('assigned_skip_flag', 'Skip');
        
        if (error) throw error;
        
        await processTasks(tasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const processTasks = async (tasks: any[]) => {
    console.log('Raw tasks from database:', tasks);

    // Get AR user names
    const assignedARIds = [...new Set((tasks || []).map(t => t.assigned_ar_id).filter(Boolean))];
    let arNames: Record<string, string> = {};
    
    if (assignedARIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', assignedARIds);
      
      arNames = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile.name || 'Unknown';
        return acc;
      }, {} as Record<string, string>);
    }

    const formattedTasks: Task[] = (tasks || []).map(task => ({
      id: task.task_id,
      project: task.projects?.project_name || 'Unknown Project',
      task: task.task_name,
      deadline: task.due_date || 'No deadline',
      priority: task.priority_exception || '',
      notesAR: task.notes_tasks_ar || '',
      notesPM: task.notes_tasks_pm || '',
      status: task.task_status as Task['status'],
      timeAllocated: 0, // This would come from time tracking
      arAssigned: task.assigned_ar_id,
      arAssignedName: task.assigned_ar_id ? arNames[task.assigned_ar_id] : undefined,
      projectId: task.project_id,
      completionDate: task.completion_date,
      milestoneNumber: task.milestone_number || 0
    }));
    
    console.log('Formatted tasks:', formattedTasks);

    setTasks(formattedTasks);
  };


  const handleUpdateNotes = async (taskId: string, notes: string, type: 'ar' | 'pm') => {
    try {
      const updateField = type === 'ar' ? 'notes_tasks_ar' : 'notes_tasks_pm';
      const { error } = await supabase
        .from('project_tasks')
        .update({ [updateField]: notes })
        .eq('task_id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { 
            ...task, 
            [type === 'ar' ? 'notesAR' : 'notesPM']: notes 
          } : task
        )
      );

      toast({
        title: "Success",
        description: `${type.toUpperCase()} notes updated successfully.`,
      });
    } catch (error) {
      console.error('Error updating notes:', error);
      toast({
        title: "Error",
        description: "Failed to update notes. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Send Microsoft Teams notification for task status updates
  const sendTeamsNotification = async (taskId: string, newStatus: string, previousStatus: string, comment?: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      console.log('Sending Teams notification for task:', taskId, 'status:', newStatus);
      
      const { data, error } = await supabase.functions.invoke('send-teams-notification', {
        body: {
          taskId,
          taskName: task.task,
          projectName: task.project,
          arName: currentUserProfile?.name || 'Unknown AR',
          newStatus,
          previousStatus,
          comment,
          approvalStatus: newStatus === 'completed' ? 'pending' : undefined,
        }
      });

      if (error) {
        console.error('Error sending Teams notification:', error);
      } else {
        console.log('Teams notification sent successfully:', data);
      }
    } catch (error) {
      console.error('Failed to send Teams notification:', error);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: Task['status'], comment?: string) => {
    try {
      console.log('Updating task status:', { taskId, status, currentUserId: user?.id, userRole: userRole?.role });
      
      // Map frontend status to database status values
      const statusMapping = {
        'in_queue': 'in_queue',
        'started': 'started', 
        'completed': 'completed',
        'blocked': 'blocked'
      };
      
      const dbStatus = statusMapping[status];
      if (!dbStatus) {
        throw new Error(`Invalid status: ${status}`);
      }
      
      // Get the current task's status to store as previous_status
      const currentTask = tasks.find(t => t.id === taskId);
      const previousStatus = currentTask?.status || 'in_queue';
      
      // Prepare update object
      const updateData: Record<string, any> = { 
        task_status: dbStatus,
        completion_date: dbStatus === 'completed' ? new Date().toISOString().split('T')[0] : null
      };
      
      // When moving to completed, store previous status and reset approval status to pending
      if (dbStatus === 'completed') {
        updateData.previous_status = previousStatus;
        updateData.approval_status = 'pending';
      }
      
      const { data, error } = await supabase
        .from('project_tasks')
        .update(updateData)
        .eq('task_id', taskId)
        .select('*')
        .single();

      if (error) {
        console.error('Database error updating status:', error);
        throw error;
      }

      console.log('Status update successful:', data);

      // Send Teams notification for completed or blocked tasks
      if (status === 'completed' || status === 'blocked') {
        sendTeamsNotification(taskId, status, previousStatus, comment);
      }

      // Update local state with completion date and approval status
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { 
            ...task, 
            status,
            completionDate: data.completion_date,
            approvalStatus: (data as any).approval_status || task.approvalStatus,
            previousStatus: (data as any).previous_status || task.previousStatus,
          } : task
        )
      );

      toast({
        title: "Success",
        description: "Task status updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Error", 
        description: `Failed to update status: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    }
  };

  // Handle status change that requires mandatory comment (completed/blocked)
  const handleStatusChangeWithComment = (taskId: string, newStatus: Task['status']) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // For completed or blocked status, require a comment
    if (newStatus === 'completed' || newStatus === 'blocked') {
      setSelectedTaskForComment(task);
      setPendingStatusChange({ taskId, newStatus });
      setCommentDialogOpen(true);
    } else {
      // For other statuses, update directly
      handleUpdateStatus(taskId, newStatus);
    }
  };

  // Called after mandatory comment is submitted
  const handleCommentSubmitted = (comment?: string) => {
    if (pendingStatusChange) {
      handleUpdateStatus(pendingStatusChange.taskId, pendingStatusChange.newStatus, comment);
      setPendingStatusChange(null);
      setSelectedTaskForComment(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = tasks.find(task => task.id === active.id);
    const overColumnId = over.id as string;
    
    console.log('Drag end:', { activeTaskId: active.id, overColumnId, activeTask });
    
    // Map column IDs to task status values
    const statusMapping: { [key: string]: Task['status'] } = {
      'in_queue': 'in_queue',
      'started': 'started', 
      'completed': 'completed',
      'blocked': 'blocked'
    };
    
    const newStatus = statusMapping[overColumnId];
    
    if (activeTask && newStatus && activeTask.status !== newStatus) {
      console.log('Updating task from drag:', { taskId: activeTask.id, oldStatus: activeTask.status, newStatus });
      // Use the comment-required handler for completed/blocked
      handleStatusChangeWithComment(activeTask.id, newStatus);
    }
  };

  // Filter tasks based on user role and selected AR filter
  const getDisplayName = () => {
    if (userRole?.role === 'pm' || userRole?.role === 'admin') {
      if (selectedARFilter === 'current') {
        return `${currentUserProfile?.name || 'Your'} Tasks (PM View)`;
      } else {
        const selectedAR = allARUsers.find(ar => ar.id === selectedARFilter);
        return `${selectedAR?.name || 'Selected AR'}'s Tasks`;
      }
    }
    return `${currentUserProfile?.name || 'Your'} Tasks`;
  };

  const getFilteredTasks = () => {
    let filteredTasks = tasks;

    // Apply AR filter based on user role and selection
    if (userRole?.role === 'pm' || userRole?.role === 'admin') {
      if (selectedARFilter === 'current') {
        filteredTasks = tasks.filter(task => task.arAssigned === user?.id);
      } else if (selectedARFilter !== 'all') {
        filteredTasks = tasks.filter(task => task.arAssigned === selectedARFilter);
      }
      // For 'all', show all tasks (no additional filtering)
    } else {
      // For regular AR users, only show their assigned tasks
      filteredTasks = tasks.filter(task => task.arAssigned === user?.id);
    }

    // Apply search filter
    if (searchTerm) {
      filteredTasks = filteredTasks.filter(task =>
        task.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filteredTasks;
  };

  // Sort tasks by due date, milestone, and project name
  const sortTasks = (tasks: Task[]) => {
    return tasks.sort((a, b) => {
      // Parse dates for comparison, handle "No deadline" case
      const getDateValue = (deadline: string) => {
        if (deadline === 'No deadline' || !deadline) return new Date('9999-12-31'); // Far future date
        return new Date(deadline);
      };
      
      const dateA = getDateValue(a.deadline);
      const dateB = getDateValue(b.deadline);
      
      // Primary sort: by due date (sooner dates first)
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // Secondary sort: by milestone number within same project
      if (a.projectId === b.projectId && a.milestoneNumber !== b.milestoneNumber) {
        return a.milestoneNumber - b.milestoneNumber;
      }
      
      // Tertiary sort: alphabetically by project name for different projects
      return a.project.localeCompare(b.project);
    });
  };

  const userTasks = getFilteredTasks();

  // Helper function to check if task was completed this week
  const isCompletedThisWeek = (task: Task) => {
    if (task.status !== 'completed') return false;
    
    // If no completion date, but status is completed, assume it was completed recently
    if (!task.completionDate) {
      console.log('Task completed but no completion date:', task.id);
      return true; // Show completed tasks even without completion date
    }
    
    try {
      const completionDate = new Date(task.completionDate);
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const isThisWeek = completionDate >= weekStart;
      console.log('Completion date check:', { 
        taskId: task.id, 
        completionDate: task.completionDate,
        weekStart: weekStart.toISOString(),
        isThisWeek 
      });
      
      return isThisWeek;
    } catch (error) {
      console.error('Error parsing completion date:', error);
      return true; // Show task if date parsing fails
    }
  };

  const columns = {
    in_queue: { title: "In Queue", color: "bg-gray-50" },
    started: { title: "Started", color: "bg-blue-50" },
    completed: { title: "Completed this week", color: "bg-green-50" },
    blocked: { title: "Blocked", color: "bg-red-50" }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-center items-center h-64">
              <p className="text-muted-foreground">Loading your tasks...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              AR Board - {getDisplayName()}
            </h1>
            <p className="text-muted-foreground mb-4">
              {userRole?.role === 'pm' || userRole?.role === 'admin' 
                ? 'View and manage AR tasks across the project' 
                : 'Manage your assigned tasks and update progress'}
            </p>
            
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              
              {/* AR Filter for PM and Admin users */}
              {(userRole?.role === 'pm' || userRole?.role === 'admin') && (
                <Select value={selectedARFilter} onValueChange={setSelectedARFilter}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select AR to view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">My Tasks</SelectItem>
                    <SelectItem value="all">All AR Tasks</SelectItem>
                    {allARUsers.map((ar) => (
                      <SelectItem key={ar.id} value={ar.id}>
                        {ar.name} ({ar.role === 'ar1_planning' ? 'AR1' : 'AR2'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {userTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No tasks assigned to you yet. Check back later or contact your project manager.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {Object.entries(columns).map(([status, { title, color }]) => {
                  const columnTasks = status === 'completed' 
                    ? sortTasks(userTasks.filter(task => isCompletedThisWeek(task)))
                    : sortTasks(userTasks.filter(task => task.status === status));
                  
                  return (
                    <DroppableColumn key={status} id={status} className="space-y-4">
                      <Card className={`${color} border-t-4 border-t-primary`}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            {title}
                            <Badge variant="secondary" className="text-xs">
                              {columnTasks.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      
                      <SortableContext
                        items={columnTasks.map(task => task.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3 min-h-32" data-column={status}>
                          {columnTasks.map(task => (
                            <SortableTaskCard 
                              key={task.id} 
                              task={task} 
                              onUpdateNotes={handleUpdateNotes}
                              onUpdateStatus={handleUpdateStatus}
                              currentUserId={user?.id || ''}
                              userRole={userRole?.role || null}
                              onStatusChangeWithComment={handleStatusChangeWithComment}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DroppableColumn>
                  );
                })}
              </div>
              
              <DragOverlay>
                {activeId ? (
                  <TaskCard 
                    task={tasks.find(task => task.id === activeId)!} 
                    onUpdateNotes={handleUpdateNotes}
                    onUpdateStatus={handleUpdateStatus}
                    currentUserId={user?.id || ''}
                    userRole={userRole?.role || null}
                    onStatusChangeWithComment={handleStatusChangeWithComment}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Mandatory Comment Dialog for Status Changes */}
        {selectedTaskForComment && (
          <TaskCommentDialog
            open={commentDialogOpen}
            onOpenChange={(open) => {
              if (!open && pendingStatusChange) {
                // If dialog is closed without submitting, cancel the status change
                setPendingStatusChange(null);
                setSelectedTaskForComment(null);
              }
              setCommentDialogOpen(open);
            }}
            taskId={selectedTaskForComment.id}
            taskName={`${selectedTaskForComment.project} - ${selectedTaskForComment.task}`}
            currentUserId={user?.id || ''}
            currentUserName={currentUserProfile?.name || 'Unknown'}
            currentUserRole={userRole?.role || 'ar1_planning'}
            isMandatory={true}
            mandatoryPrompt={
              pendingStatusChange?.newStatus === 'completed'
                ? "Please describe what work was completed on this task. This comment is required for PM/Admin approval."
                : "Please explain why this task is blocked. This helps PM/Admin understand the issue."
            }
            onCommentSubmitted={handleCommentSubmitted}
          />
        )}
      </main>
    </div>
  );
};

export default ProjectBoard;