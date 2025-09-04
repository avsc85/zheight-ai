import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Task {
  id: string;
  project: string;
  task: string;
  deadline: string;
  priority: string;
  notes: string;
  status: 'in_queue' | 'started' | 'completed' | 'blocked';
  timeAllocated: number;
  arAssigned: string;
  projectId: string;
}

const TaskCard = ({ task, onUpdateNotes, currentUser }: { 
  task: Task; 
  onUpdateNotes: (taskId: string, notes: string) => void;
  currentUser: string;
}) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(task.notes || "");

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

  const handleSaveNotes = () => {
    onUpdateNotes(task.id, editedNotes);
    setIsEditingNotes(false);
  };

  const handleCancelEdit = () => {
    setEditedNotes(task.notes || "");
    setIsEditingNotes(false);
  };

  const canEditTask = task.arAssigned === currentUser;

  return (
    <Card className={`mb-4 border-l-4 ${getStatusColor()} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        {getPriorityBadge()}
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
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Notes:</label>
              {canEditTask && !isEditingNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingNotes(true)}
                  className="h-6 w-6 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {isEditingNotes && canEditTask ? (
              <div className="space-y-2">
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="text-xs min-h-16 resize-none"
                  placeholder="Add notes..."
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveNotes}
                    className="h-6 text-xs text-green-600 hover:text-green-700"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="h-6 text-xs text-red-600 hover:text-red-700"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="min-h-8">
                {task.notes ? (
                  <p className="text-xs text-muted-foreground italic bg-gray-50 p-2 rounded">
                    {task.notes}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    {canEditTask ? "Click edit to add notes..." : "No notes"}
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
  const { toast } = useToast();
  const { user } = useAuth();
  
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
        .select('full_name')
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
      const { data: milestones, error } = await supabase
        .from('project_milestones')
        .select(`
          *,
          projects (
            project_name,
            user_id
          )
        `)
        .not('ar_assigned', 'is', null)
        .neq('assigned_skip', 'Skip');

      if (error) throw error;

      const formattedTasks: Task[] = (milestones || []).map(milestone => ({
        id: milestone.id,
        project: milestone.projects?.project_name || 'Unknown Project',
        task: milestone.task_name,
        deadline: milestone.due_date || 'No deadline',
        priority: milestone.priority_exception || '',
        notes: milestone.notes || '',
        status: milestone.status as Task['status'],
        timeAllocated: 0, // This would come from time tracking
        arAssigned: milestone.ar_assigned,
        projectId: milestone.project_id
      }));

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

  const handleUpdateNotes = async (taskId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({ notes })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, notes } : task
        )
      );

      toast({
        title: "Success",
        description: "Notes updated successfully.",
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

  // Filter tasks for current AR user
  const currentUserName = currentUserProfile?.full_name || '';
  const userTasks = tasks.filter(task => 
    task.arAssigned === currentUserName &&
    (searchTerm === '' || 
     task.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
     task.task.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {Object.entries(columns).map(([status, { title, color }]) => {
                const columnTasks = userTasks.filter(task => task.status === status);
                
                return (
                  <div key={status} className="space-y-4">
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
                    
                    <div className="space-y-3">
                      {columnTasks.map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onUpdateNotes={handleUpdateNotes}
                          currentUser={currentUserName}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectBoard;