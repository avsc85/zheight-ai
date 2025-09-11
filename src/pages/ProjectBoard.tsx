import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Edit, Save, X, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  projectId: string;
  completionDate?: string;
}

const DroppableColumn = ({ children, id, className }: { children: React.ReactNode; id: string; className?: string }) => {
  const { setNodeRef } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
};

const SortableTaskCard = ({ task, onUpdateNotes, onUpdateStatus, currentUserId, userRole }: { 
  task: Task; 
  onUpdateNotes: (taskId: string, notes: string, type: 'ar' | 'pm') => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  currentUserId: string;
  userRole: string | null;
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
      />
    </div>
  );
};

const TaskCard = ({ task, onUpdateNotes, onUpdateStatus, currentUserId, userRole, dragHandleProps }: { 
  task: Task; 
  onUpdateNotes: (taskId: string, notes: string, type: 'ar' | 'pm') => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  currentUserId: string;
  userRole: string | null;
  dragHandleProps?: any;
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

  const getStatusColor = () => {
    switch (task.status) {
      case 'started': return 'border-l-blue-500';
      case 'completed': return 'border-l-green-500';
      case 'blocked': return 'border-l-red-500';
      default: return 'border-l-gray-300';
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
  
  const canEditARNotes = task.arAssigned === currentUserId && 
    (userRole === 'ar1_planning' || userRole === 'ar2_field' || userRole === 'admin');
  const canEditPMNotes = userRole === 'pm' || userRole === 'admin';  
  const canEditStatus = canEditARNotes;

  return (
    <Card className={`mb-4 border-l-4 ${getStatusColor()} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          {getPriorityBadge()}
          <div className="flex items-center gap-2">
            {canEditStatus && (
              <Select value={task.status} onValueChange={(value) => onUpdateStatus(task.id, value as Task['status'])}>
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
              <p className="font-medium text-sm text-foreground">{task.project}</p>
              <p className="text-sm text-muted-foreground">{task.task}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{task.deadline}</p>
          </div>
          
          {task.timeAllocated > 0 && (
            <p className="text-xs text-primary font-medium">
              Total Time taken: {task.timeAllocated} Hours
            </p>
          )}
          
          {/* AR Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">AR Notes:</label>
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
                  placeholder="Add AR notes..."
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
                  <p className="text-xs text-muted-foreground italic bg-blue-50 p-2 rounded">
                    {task.notesAR}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    {canEditARNotes ? "Click edit to add AR notes..." : "No AR notes"}
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
                  <p className="text-xs text-muted-foreground italic bg-green-50 p-2 rounded">
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
    }
  }, [user]);

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

  const fetchTasks = async () => {
    try {
      setLoading(true);
      console.log('Fetching tasks for user:', user?.id);
      
      const { data: tasks, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          projects (
            project_name,
            user_id
          )
        `)
        .not('assigned_ar_id', 'is', null)
        .neq('assigned_skip_flag', 'Skip');

      if (error) throw error;
      
      console.log('Raw tasks from database:', tasks);

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
        projectId: task.project_id,
        completionDate: task.completion_date
      }));
      
      console.log('Formatted tasks:', formattedTasks);

      setTasks(formattedTasks);
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

  const handleUpdateStatus = async (taskId: string, status: Task['status']) => {
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
      
      const { data, error } = await supabase
        .from('project_tasks')
        .update({ 
          task_status: dbStatus,
          completion_date: dbStatus === 'completed' ? new Date().toISOString().split('T')[0] : null
        })
        .eq('task_id', taskId)
        .select('*')
        .single();

      if (error) {
        console.error('Database error updating status:', error);
        throw error;
      }

      console.log('Status update successful:', data);

      // Update local state with completion date
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { 
            ...task, 
            status,
            completionDate: data.completion_date
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
      handleUpdateStatus(activeTask.id, newStatus);
    }
  };

  // Filter tasks for current AR user
  const currentUserName = currentUserProfile?.name || '';
  const userTasks = tasks.filter(task => 
    task.arAssigned === user?.id &&
    (searchTerm === '' || 
     task.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
     task.task.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
              AR Board - {currentUserName || 'Your Tasks'}
            </h1>
            <p className="text-muted-foreground mb-4">
              Manage your assigned tasks and update progress
            </p>
            
            <div className="flex items-center gap-4">
              <Input
                placeholder="Find Board"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
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
                    ? userTasks.filter(task => isCompletedThisWeek(task))
                    : userTasks.filter(task => task.status === status);
                  
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
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectBoard;