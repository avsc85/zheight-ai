import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  BarChart3,
  Calendar,
  ListTodo,
  PlayCircle,
  PauseCircle,
  Download,
  RefreshCw,
  MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { TaskCommentDialog } from "@/components/TaskCommentDialog";

interface TaskItem {
  task_id: string;
  task_name: string;
  task_status: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
  project_manager_name: string;
  priority: string | null;
  created_at: string;
}

type FilterTab = 'all' | 'in_queue' | 'in_progress' | 'completed' | 'overdue';

const getTaskStatusBadge = (status: string) => {
  const variants: Record<string, "done-soft" | "started-soft" | "queue-soft" | "blocked-soft"> = {
    completed: "done-soft",
    started: "started-soft",
    in_queue: "queue-soft",
    on_hold: "blocked-soft",
  };
  const labels: Record<string, string> = {
    completed: "Completed",
    started: "In Progress",
    in_queue: "In Queue",
    on_hold: "On Hold",
  };
  return (
    <Badge variant={variants[status] || "queue-soft"}>
      {labels[status] || status}
    </Badge>
  );
};

const getPriorityBadge = (priority: string | null) => {
  if (!priority) return <Badge variant="outline">Normal</Badge>;
  
  const variants: Record<string, any> = {
    high: "blocked",
    medium: "started",
    low: "queue",
  };
  return (
    <Badge variant={variants[priority.toLowerCase()] || "outline"}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
};

const getDueDateBadge = (dueDate: string | null) => {
  if (!dueDate) return <span className="text-sm text-muted-foreground">No due date</span>;
  
  const date = parseISO(dueDate);
  const dateStr = format(date, 'MMM dd, yyyy');
  
  if (isPast(date)) {
    return (
      <Badge variant="blocked" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {dateStr} (Overdue)
      </Badge>
    );
  }
  
  if (isToday(date)) {
    return (
      <Badge variant="started" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Today
      </Badge>
    );
  }
  
  if (isTomorrow(date)) {
    return (
      <Badge variant="queue" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Tomorrow
      </Badge>
    );
  }
  
  return <span className="text-sm font-medium">{dateStr}</span>;
};

const exportToCSV = (tasks: TaskItem[]) => {
  const headers = [
    'Task Name',
    'Project',
    'PM',
    'Status',
    'Priority',
    'Due Date',
    'Created Date'
  ];

  const rows = tasks.map(t => [
    t.task_name,
    t.project_name,
    t.project_manager_name,
    t.task_status,
    t.priority || 'Normal',
    t.due_date || 'No due date',
    t.created_at
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `my_tasks_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const ARDashboard = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedTaskForComment, setSelectedTaskForComment] = useState<TaskItem | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{taskId: string, newStatus: string} | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    inQueue: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchMyTasks();
      fetchUserRole();
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user?.id)
        .single();
      
      if (profile) {
        setUserRole(profile.role);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchMyTasks = async () => {
    try {
      setLoading(true);

      // Get user's profile ID from auth users
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) {
        toast({
          title: "Error",
          description: "Could not find your profile.",
          variant: "destructive",
        });
        return;
      }

      // Fetch tasks assigned to this AR
      const { data: tasksData, error: tasksError } = await supabase
        .from('project_tasks')
        .select(`
          task_id,
          task_name,
          task_status,
          due_date,
          project_id,
          created_at,
          projects:project_id (
            project_name,
            project_manager_name
          )
        `)
        .eq('assigned_ar_id', profile.user_id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (tasksError) throw tasksError;

      // Transform data
      const transformedTasks: TaskItem[] = (tasksData || []).map(task => ({
        task_id: task.task_id,
        task_name: task.task_name,
        task_status: task.task_status || 'in_queue',
        due_date: task.due_date,
        project_id: task.project_id,
        project_name: task.projects?.project_name || 'Unknown Project',
        project_manager_name: task.projects?.project_manager_name || 'Unassigned',
        priority: null,
        created_at: task.created_at,
      }));

      setTasks(transformedTasks);

      // Calculate stats
      const today = new Date();
      const overdueCount = transformedTasks.filter(t => 
        t.due_date && isPast(parseISO(t.due_date)) && t.task_status !== 'completed'
      ).length;

      setStats({
        total: transformedTasks.length,
        inQueue: transformedTasks.filter(t => t.task_status === 'in_queue').length,
        inProgress: transformedTasks.filter(t => t.task_status === 'started').length,
        completed: transformedTasks.filter(t => t.task_status === 'completed').length,
        overdue: overdueCount,
      });

      setLoading(false);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load your tasks.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId);
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ task_status: newStatus })
        .eq('task_id', taskId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Task marked as ${newStatus === 'started' ? 'in progress' : newStatus}.`,
      });

      fetchMyTasks();
      setPendingStatusUpdate(null);
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleStatusChangeWithComment = (task: TaskItem, newStatus: string) => {
    // Only require comment when completing a task
    if (newStatus === 'completed') {
      setSelectedTaskForComment(task);
      setPendingStatusUpdate({ taskId: task.task_id, newStatus });
      setCommentDialogOpen(true);
    } else {
      updateTaskStatus(task.task_id, newStatus);
    }
  };

  const handleCommentSubmitted = () => {
    // After comment is submitted, proceed with status update if pending
    if (pendingStatusUpdate) {
      updateTaskStatus(pendingStatusUpdate.taskId, pendingStatusUpdate.newStatus);
    }
  };

  // Filter tasks
  useEffect(() => {
    let filtered = tasks;

    // Apply status filter
    switch (activeFilter) {
      case 'in_queue':
        filtered = filtered.filter(t => t.task_status === 'in_queue');
        break;
      case 'in_progress':
        filtered = filtered.filter(t => t.task_status === 'started');
        break;
      case 'completed':
        filtered = filtered.filter(t => t.task_status === 'completed');
        break;
      case 'overdue':
        filtered = filtered.filter(t => 
          t.due_date && isPast(parseISO(t.due_date)) && t.task_status !== 'completed'
        );
        break;
      default:
        // all - no filter
        break;
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.project_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTasks(filtered);
  }, [searchTerm, tasks, activeFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading your tasks...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <LayoutDashboard className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">My Tasks</h1>
              </div>
              <p className="text-muted-foreground">View and manage your assigned tasks</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchMyTasks()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Overview - Clickable Filter Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'all' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">All Tasks</p>
                  <h3 className="text-2xl font-bold">{stats.total}</h3>
                </div>
                <ListTodo className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'in_queue' ? 'ring-2 ring-gray-500 bg-gray-50' : ''}`}
            onClick={() => setActiveFilter('in_queue')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Queue</p>
                  <h3 className="text-2xl font-bold text-gray-600">{stats.inQueue}</h3>
                </div>
                <PauseCircle className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'in_progress' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            onClick={() => setActiveFilter('in_progress')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <h3 className="text-2xl font-bold text-blue-600">{stats.inProgress}</h3>
                </div>
                <PlayCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'completed' ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <h3 className="text-2xl font-bold text-green-600">{stats.completed}</h3>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'overdue' ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
            onClick={() => setActiveFilter('overdue')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <h3 className="text-2xl font-bold text-red-600">{stats.overdue}</h3>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks or projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(filteredTasks)}
              className="flex items-center gap-2"
              disabled={filteredTasks.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Tasks Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Task Name</TableHead>
                  <TableHead className="w-[200px]">Project</TableHead>
                  <TableHead className="w-[140px]">PM</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Priority</TableHead>
                  <TableHead className="w-[180px]">Due Date</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.task_status !== 'completed';
                  return (
                    <TableRow 
                      key={task.task_id}
                      className={`hover:bg-accent ${isOverdue ? 'bg-red-50/40' : ''}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {task.task_name}
                          {isOverdue && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span 
                          className="text-sm hover:text-primary hover:underline cursor-pointer"
                          onClick={() => navigate(`/project-mgmt/dashboard/${task.project_id}`)}
                        >
                          {task.project_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{task.project_manager_name}</span>
                      </TableCell>
                      <TableCell>{getTaskStatusBadge(task.task_status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{getDueDateBadge(task.due_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTaskForComment(task);
                              setPendingStatusUpdate(null); // Regular comment, no status change
                              setCommentDialogOpen(true);
                            }}
                            className="flex items-center gap-1"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Comment
                          </Button>
                          {task.task_status === 'in_queue' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChangeWithComment(task, 'started')}
                              disabled={updatingTaskId === task.task_id}
                              className="flex items-center gap-1"
                            >
                              <PlayCircle className="h-4 w-4" />
                              Start
                            </Button>
                          )}
                          {task.task_status === 'started' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleStatusChangeWithComment(task, 'completed')}
                              disabled={updatingTaskId === task.task_id}
                              className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Complete
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => navigate(`/project-mgmt/dashboard/${task.project_id}`)}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 mt-8">
            <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tasks found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {activeFilter !== 'all' ? 'Try changing the filter' : 'You have no assigned tasks'}
            </p>
          </div>
        )}
      </div>

      {/* Comment Dialog */}
      {selectedTaskForComment && (
        <TaskCommentDialog
          open={commentDialogOpen}
          onOpenChange={setCommentDialogOpen}
          taskId={selectedTaskForComment.task_id}
          taskName={selectedTaskForComment.task_name}
          currentUserId={user?.id || ''}
          currentUserName={user?.user_metadata?.name || user?.email || 'Unknown'}
          currentUserRole={userRole}
          isMandatory={!!pendingStatusUpdate}
          mandatoryPrompt={
            pendingStatusUpdate?.newStatus === 'completed'
              ? "Describe what you completed before marking this task as done (Required)"
              : ""
          }
          onCommentSubmitted={handleCommentSubmitted}
        />
      )}
    </div>
  );
};

export default ARDashboard;
