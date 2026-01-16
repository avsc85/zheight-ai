import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  User,
  Calendar,
  ThumbsUp,
  MessageSquare,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { TaskCommentDialog } from "@/components/TaskCommentDialog";

interface TaskActivity {
  task_id: string;
  task_name: string;
  task_status: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
  assigned_ar_id: string | null;
  assigned_ar_name: string | null;
  created_at: string;
  updated_at: string | null;
  pm_approved: boolean;
  last_status_change: string | null;
  latest_comment?: string;
  latest_comment_by?: string;
  latest_comment_at?: string;
  notes_tasks_ar?: string;
}

interface StatusChange {
  id: string;
  task_id: string;
  task_name: string;
  project_name: string;
  ar_name: string;
  old_status: string;
  new_status: string;
  changed_at: string;
}

const getStatusBadge = (status: string) => {
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

const exportToCSV = (tasks: TaskActivity[]) => {
  const headers = [
    'Task Name',
    'Project',
    'Assigned To',
    'Status',
    'PM Approved',
    'Due Date',
    'Last Updated'
  ];

  const rows = tasks.map(t => [
    t.task_name,
    t.project_name,
    t.assigned_ar_name || 'Unassigned',
    t.task_status,
    t.pm_approved ? 'Yes' : 'No',
    t.due_date || 'No due date',
    t.updated_at || t.created_at
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `team_activity_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const TeamActivityDashboard = () => {
  const [tasks, setTasks] = useState<TaskActivity[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskActivity[]>([]);
  const [recentChanges, setRecentChanges] = useState<StatusChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedAR, setSelectedAR] = useState("all");
  const [allProjects, setAllProjects] = useState<{id: string, name: string}[]>([]);
  const [allARs, setAllARs] = useState<{id: string, name: string}[]>([]);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedTaskForComment, setSelectedTaskForComment] = useState<TaskActivity | null>(null);
  const [stats, setStats] = useState({
    totalTasks: 0,
    inProgress: 0,
    completed: 0,
    needsApproval: 0,
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchTeamActivity();
      fetchARs();
    }
  }, [user]);

  const fetchARs = async () => {
    try {
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, name, role')
        .in('role', ['ar1_planning', 'ar2_field']);

      if (users) {
        setAllARs(users.map(u => ({ id: u.user_id, name: u.name })));
      }
    } catch (error) {
      console.error("Error fetching ARs:", error);
    }
  };

  const fetchTeamActivity = async () => {
    try {
      setLoading(true);

      // Fetch all tasks with AR assignments including AR notes
      const { data: tasksData, error: tasksError } = await supabase
        .from('project_tasks')
        .select(`
          task_id,
          task_name,
          task_status,
          due_date,
          project_id,
          assigned_ar_id,
          created_at,
          updated_at,
          notes_tasks_ar,
          projects:project_id (
            project_name
          )
        `)
        .not('assigned_ar_id', 'is', null)
        .order('updated_at', { ascending: false, nullsFirst: false });

      if (tasksError) throw tasksError;

      // Fetch AR profiles
      const arIds = [...new Set(tasksData?.map(t => t.assigned_ar_id).filter(Boolean))];
      const { data: arProfiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', arIds);

      // Fetch projects list
      const projectIds = [...new Set(tasksData?.map(t => t.project_id))];
      const { data: projectsList } = await supabase
        .from('projects')
        .select('id, project_name')
        .in('id', projectIds);

      setAllProjects(projectsList?.map(p => ({ id: p.id, name: p.project_name })) || []);

      // Transform data - prioritize AR notes from database
      const transformedTasks: TaskActivity[] = (tasksData || []).map(task => {
        const ar = arProfiles?.find(a => a.user_id === task.assigned_ar_id);
        
        // Use notes_tasks_ar from database as primary source for AR comment
        const arComment = task.notes_tasks_ar || null;
        
        // Fallback to localStorage for legacy comments
        let latestComment = arComment;
        let latestCommentBy = ar?.name || 'AR';
        let latestCommentAt = task.updated_at;
        
        if (!latestComment) {
          const storedComments = localStorage.getItem(`task_comments_${task.task_id}`);
          if (storedComments) {
            const comments = JSON.parse(storedComments);
            if (comments.length > 0) {
              const latest = comments[comments.length - 1];
              latestComment = latest.comment;
              latestCommentBy = latest.user_name;
              latestCommentAt = latest.created_at;
            }
          }
        }
        
        return {
          task_id: task.task_id,
          task_name: task.task_name,
          task_status: task.task_status || 'in_queue',
          due_date: task.due_date,
          project_id: task.project_id,
          project_name: task.projects?.project_name || 'Unknown Project',
          assigned_ar_id: task.assigned_ar_id,
          assigned_ar_name: ar?.name || null,
          created_at: task.created_at,
          updated_at: task.updated_at,
          pm_approved: false,
          last_status_change: task.updated_at,
          latest_comment: latestComment,
          latest_comment_by: latestCommentBy,
          latest_comment_at: latestCommentAt,
          notes_tasks_ar: task.notes_tasks_ar,
        };
      });

      setTasks(transformedTasks);
      setFilteredTasks(transformedTasks);

      // Generate recent status changes (mock data for now - can be enhanced with actual tracking table)
      const recentlyUpdated = transformedTasks
        .filter(t => t.updated_at)
        .slice(0, 10)
        .map(t => ({
          id: t.task_id,
          task_id: t.task_id,
          task_name: t.task_name,
          project_name: t.project_name,
          ar_name: t.assigned_ar_name || 'Unknown',
          old_status: 'in_queue',
          new_status: t.task_status,
          changed_at: t.updated_at || t.created_at,
        }));
      setRecentChanges(recentlyUpdated);

      // Calculate stats
      setStats({
        totalTasks: transformedTasks.length,
        inProgress: transformedTasks.filter(t => t.task_status === 'started').length,
        completed: transformedTasks.filter(t => t.task_status === 'completed').length,
        needsApproval: transformedTasks.filter(t => t.task_status === 'completed' && !t.pm_approved).length,
      });

      setLoading(false);
    } catch (error) {
      console.error("Error fetching team activity:", error);
      toast({
        title: "Error",
        description: "Failed to load team activity.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const approveTask = async (taskId: string) => {
    try {
      // Here you would update a pm_approved field in the database
      // For now, just show success message
      toast({
        title: "Task Approved",
        description: "Task has been approved successfully!",
      });
      
      // Update local state
      setTasks(tasks.map(t => 
        t.task_id === taskId ? { ...t, pm_approved: true } : t
      ));
      setFilteredTasks(filteredTasks.map(t => 
        t.task_id === taskId ? { ...t, pm_approved: true } : t
      ));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve task.",
        variant: "destructive",
      });
    }
  };

  // Filter tasks
  useEffect(() => {
    let filtered = tasks;

    if (selectedProject !== "all") {
      filtered = filtered.filter(t => t.project_id === selectedProject);
    }

    if (selectedAR !== "all") {
      filtered = filtered.filter(t => t.assigned_ar_id === selectedAR);
    }

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assigned_ar_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTasks(filtered);
  }, [searchTerm, tasks, selectedProject, selectedAR]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading team activity...</p>
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
                <Activity className="h-8 w-8 text-blue-500" />
                <h1 className="text-3xl font-bold">Team Activity Dashboard</h1>
              </div>
              <p className="text-muted-foreground">Monitor AR work, status changes, and approve completed tasks</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTeamActivity()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Active Tasks</p>
                  <h3 className="text-2xl font-bold">{stats.totalTasks}</h3>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <h3 className="text-2xl font-bold text-blue-600">{stats.inProgress}</h3>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
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

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Needs Approval</p>
                  <h3 className="text-2xl font-bold text-orange-600">{stats.needsApproval}</h3>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks, projects, or ARs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72"
              />
            </div>
            
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {allProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAR} onValueChange={setSelectedAR}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All ARs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ARs</SelectItem>
                {allARs.map(ar => (
                  <SelectItem key={ar.id} value={ar.id}>{ar.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(filteredTasks)}
              className="flex items-center gap-2"
              disabled={filteredTasks.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Tasks ({filteredTasks.length})</TabsTrigger>
            <TabsTrigger value="recent">Recent Changes</TabsTrigger>
            <TabsTrigger value="approval">Needs Approval ({stats.needsApproval})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Task Name</TableHead>
                      <TableHead className="w-[180px]">Project</TableHead>
                      <TableHead className="w-[140px]">Assigned To</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[250px]">AR Comment</TableHead>
                      <TableHead className="w-[140px]">Due Date</TableHead>
                      <TableHead className="w-[140px]">Last Updated</TableHead>
                      <TableHead className="w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => {
                      const isCompleted = task.task_status === 'completed';
                      return (
                        <TableRow key={task.task_id} className="hover:bg-accent">
                          <TableCell className="font-medium">{task.task_name}</TableCell>
                          <TableCell>
                            <span 
                              className="text-sm hover:text-primary hover:underline cursor-pointer"
                              onClick={() => navigate(`/project-mgmt/dashboard/${task.project_id}`)}
                            >
                              {task.project_name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{task.assigned_ar_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(task.task_status)}</TableCell>
                          <TableCell>
                            {task.latest_comment ? (
                              <div className="space-y-1 bg-blue-50 p-2 rounded border border-blue-100">
                                <p className="text-sm line-clamp-2 text-foreground font-medium">
                                  {task.latest_comment}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  by {task.latest_comment_by} • {task.latest_comment_at ? formatDistanceToNow(parseISO(task.latest_comment_at), { addSuffix: true }) : ''}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-orange-600 italic font-medium">⚠️ No AR comment</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {task.due_date ? format(parseISO(task.due_date), 'MMM dd, yyyy') : 'No date'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {task.updated_at 
                                ? formatDistanceToNow(parseISO(task.updated_at), { addSuffix: true })
                                : 'Not updated'
                              }
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedTaskForComment(task);
                                  setCommentDialogOpen(true);
                                }}
                                className="flex items-center gap-1"
                              >
                                <MessageSquare className="h-3 w-3" />
                                Comment
                              </Button>
                              {isCompleted && !task.pm_approved && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveTask(task.task_id)}
                                  className="flex items-center gap-1 text-green-600 hover:text-green-700"
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  Approve
                                </Button>
                              )}
                              {task.pm_approved && (
                                <Badge variant="done" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approved
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/project-mgmt/dashboard/${task.project_id}`)}
                              >
                                View
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
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Status Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentChanges.map((change) => (
                    <div key={change.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            <span className="text-blue-600">{change.ar_name}</span> updated task status
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {change.task_name} • {change.project_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(change.old_status)}
                            <span className="text-muted-foreground">→</span>
                            {getStatusBadge(change.new_status)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(parseISO(change.changed_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {recentChanges.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent status changes
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approval">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Completed By</TableHead>
                      <TableHead className="w-[300px]">AR Comment</TableHead>
                      <TableHead>Completed At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.filter(t => t.task_status === 'completed' && !t.pm_approved).map((task) => (
                      <TableRow key={task.task_id} className="hover:bg-accent">
                        <TableCell className="font-medium">{task.task_name}</TableCell>
                        <TableCell>{task.project_name}</TableCell>
                        <TableCell>{task.assigned_ar_name}</TableCell>
                        <TableCell>
                          {task.latest_comment ? (
                            <div className="space-y-1 bg-green-50 p-2 rounded border border-green-100">
                              <p className="text-sm line-clamp-2 text-foreground font-medium">
                                {task.latest_comment}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {task.latest_comment_at ? formatDistanceToNow(parseISO(task.latest_comment_at), { addSuffix: true }) : ''}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-orange-600 italic font-medium">⚠️ No AR comment provided</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.updated_at && formatDistanceToNow(parseISO(task.updated_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveTask(task.task_id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/project-mgmt/dashboard/${task.project_id}`)}
                            >
                              View Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredTasks.filter(t => t.task_status === 'completed' && !t.pm_approved).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No tasks need approval</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 mt-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No team activity found</p>
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
          currentUserRole="pm"
        />
      )}
    </div>
  );
};

export default TeamActivityDashboard;
