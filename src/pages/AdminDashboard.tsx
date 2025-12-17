import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  BarChart3,
  Calendar,
  FolderKanban,
  Table as TableIcon,
  Grid3x3,
  Edit,
  Save,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ProjectSummary {
  id: string;
  project_name: string;
  project_manager_name: string;
  start_date: string;
  expected_end_date: string;
  hours_allocated: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  in_queue_tasks: number;
  overdue_tasks: number;
  completion_percentage: number;
  days_remaining: number;
  status: string;
  tasks?: any[];
}

// Helper functions - defined before components
const getStatusBadge = (status: string) => {
  const variants: Record<string, "done" | "started" | "queue" | "blocked"> = {
    completed: "done",
    active: "started",
    urgent: "queue",
    overdue: "blocked",
  };
  return (
    <Badge variant={variants[status] || "started"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

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

const getLatestTask = (project: ProjectSummary) => {
  if (!project.tasks || project.tasks.length === 0) return null;
  
  // First try to get the in-progress task
  const inProgressTask = project.tasks.find(t => t.task_status === 'started');
  if (inProgressTask) return inProgressTask;
  
  // Otherwise get the most recent task by due date
  const sortedTasks = [...project.tasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
  });
  
  return sortedTasks[0];
};

// Project Card Component for Grid View
interface ProjectCardProps {
  project: ProjectSummary;
  allUsers: any[];
  getStatusBadge: (status: string) => JSX.Element;
  getLatestTask: (project: ProjectSummary) => any;
  updateTaskAR: (taskId: string, arId: string) => Promise<void>;
  navigate: any;
}

const ProjectCard = ({ project, allUsers, getStatusBadge, getLatestTask, updateTaskAR, navigate }: ProjectCardProps) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingAR, setIsEditingAR] = useState(false);
  const [tempARId, setTempARId] = useState<string | null>(null);
  
  const latestTask = getLatestTask(project);
  const currentTask = selectedTaskId 
    ? project.tasks?.find(t => t.task_id === selectedTaskId)
    : latestTask;

  const currentAR = currentTask?.assigned_ar_id 
    ? allUsers.find(u => u.id === currentTask.assigned_ar_id)
    : null;

  const handleSaveAR = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTask?.task_id && tempARId) {
      await updateTaskAR(currentTask.task_id, tempARId);
      setIsEditingAR(false);
      setTempARId(null);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingAR(false);
    setTempARId(null);
  };

  const assignableUsers = allUsers.filter(u => 
    u.role !== 'pm' && u.role !== 'admin'
  );

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{project.project_name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {project.project_manager_name}
            </CardDescription>
          </div>
          {getStatusBadge(project.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{project.completion_percentage}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${project.completion_percentage}%` }}
              ></div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Tasks</p>
              <p className="font-semibold">{project.total_tasks}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Completed</p>
              <p className="font-semibold text-green-600">{project.completed_tasks}</p>
            </div>
            <div>
              <p className="text-muted-foreground">In Progress</p>
              <p className="font-semibold text-blue-600">{project.in_progress_tasks}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Overdue</p>
              <p className="font-semibold text-red-600">{project.overdue_tasks}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {project.days_remaining > 0
                ? `${project.days_remaining} days remaining`
                : project.days_remaining === 0
                ? "Due today"
                : `${Math.abs(project.days_remaining)} days overdue`}
            </span>
          </div>

          {/* Task Selection */}
          <div onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-muted-foreground mb-2">Task Name</p>
            <Select
              value={selectedTaskId || (latestTask?.task_id || "")}
              onValueChange={(value) => {
                setSelectedTaskId(value);
                setIsEditingAR(false);
                setTempARId(null);
              }}
            >
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Select task..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {project.tasks?.map(task => (
                  <SelectItem 
                    key={task.task_id} 
                    value={task.task_id}
                    className="hover:bg-blue-50 focus:bg-blue-100 cursor-pointer"
                  >
                    <span className="font-medium text-gray-900">{task.task_name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task Status */}
          <div onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-muted-foreground mb-2">Task Status</p>
            {currentTask ? (
              getTaskStatusBadge(currentTask.task_status)
            ) : (
              <span className="text-sm text-muted-foreground">No task selected</span>
            )}
          </div>

          {/* AR Assignment */}
          <div onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-muted-foreground mb-2">Assigned AR</p>
            {currentTask ? (
              <div className="flex items-center gap-2">
                {isEditingAR ? (
                  <>
                    <Select
                      value={tempARId || currentTask.assigned_ar_id || ""}
                      onValueChange={setTempARId}
                    >
                      <SelectTrigger className="h-9 flex-1 bg-white">
                        <SelectValue placeholder="Select AR..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {assignableUsers.map(user => (
                          <SelectItem 
                            key={user.id} 
                            value={user.id}
                            className="hover:bg-purple-50 focus:bg-purple-100 cursor-pointer"
                          >
                            <span className="font-medium text-gray-900">{user.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-green-600"
                      onClick={handleSaveAR}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-red-600"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-3 py-2 bg-secondary rounded-md text-sm font-medium">
                      {currentAR ? currentAR.name : "No AR assigned"}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingAR(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 bg-secondary rounded-md text-sm text-muted-foreground">
                No task selected
              </div>
            )}
          </div>

          {/* View Button */}
          <Button 
            className="w-full" 
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/project-mgmt/dashboard/${project.id}`);
            }}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Project Row Component
interface ProjectRowProps {
  project: ProjectSummary;
  allUsers: any[];
  getStatusBadge: (status: string) => JSX.Element;
  getLatestTask: (project: ProjectSummary) => any;
  updateTaskAR: (taskId: string, arId: string) => Promise<void>;
  navigate: any;
}

const ProjectRow = ({ project, allUsers, getStatusBadge, getLatestTask, updateTaskAR, navigate }: ProjectRowProps) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingAR, setIsEditingAR] = useState(false);
  const [tempARId, setTempARId] = useState<string | null>(null);
  
  const latestTask = getLatestTask(project);
  const currentTask = selectedTaskId 
    ? project.tasks?.find(t => t.task_id === selectedTaskId)
    : latestTask;

  const currentAR = currentTask?.assigned_ar_id 
    ? allUsers.find(u => u.id === currentTask.assigned_ar_id)
    : null;

  const handleSaveAR = async () => {
    if (currentTask?.task_id && tempARId) {
      await updateTaskAR(currentTask.task_id, tempARId);
      setIsEditingAR(false);
      setTempARId(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingAR(false);
    setTempARId(null);
  };

  // Filter users: exclude PM and Admin roles
  const assignableUsers = allUsers.filter(u => 
    u.role !== 'pm' && u.role !== 'admin'
  );

  return (
    <TableRow className="hover:bg-accent">
      <TableCell className="font-medium">{project.project_name}</TableCell>
      
      {/* PM Column - Read Only */}
      <TableCell>
        <span className="text-sm font-medium">{project.project_manager_name}</span>
      </TableCell>

      <TableCell>{getStatusBadge(project.status)}</TableCell>
      
      {/* Due Date */}
      <TableCell>
        <div className="flex flex-col text-sm">
          <span className="whitespace-nowrap">{project.expected_end_date || "N/A"}</span>
          {project.days_remaining !== 0 && (
            <span className={`text-xs whitespace-nowrap ${project.days_remaining < 0 ? "text-red-600" : "text-muted-foreground"}`}>
              {project.days_remaining > 0 
                ? `${project.days_remaining}d left` 
                : `${Math.abs(project.days_remaining)}d overdue`}
            </span>
          )}
        </div>
      </TableCell>

      {/* Progress */}
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-20 bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full"
              style={{ width: `${project.completion_percentage}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium">{project.completion_percentage}%</span>
        </div>
      </TableCell>

      {/* Task Selection Dropdown */}
      <TableCell className="max-w-[220px]">
        <Select
          value={selectedTaskId || (latestTask?.task_id || "")}
          onValueChange={(value) => {
            setSelectedTaskId(value);
            setIsEditingAR(false);
            setTempARId(null);
          }}
        >
          <SelectTrigger className="h-9 w-full bg-white">
            <SelectValue placeholder="Select task..." />
          </SelectTrigger>
          <SelectContent className="bg-white max-w-[300px]">
            {project.tasks?.map(task => (
              <SelectItem 
                key={task.task_id} 
                value={task.task_id}
                className="hover:bg-blue-50 focus:bg-blue-100 cursor-pointer"
              >
                <span className="font-medium text-gray-900">{task.task_name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Task Status Badge */}
      <TableCell>
        {currentTask ? (
          getTaskStatusBadge(currentTask.task_status)
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>

      {/* AR Assignment - Shows current AR or allows editing */}
      <TableCell>
        {currentTask ? (
          <div className="flex items-center gap-2">
            {isEditingAR ? (
              <>
                <Select
                  value={tempARId || currentTask.assigned_ar_id || ""}
                  onValueChange={setTempARId}
                >
                  <SelectTrigger className="h-9 w-48 bg-white">
                    <SelectValue placeholder="Select AR..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {assignableUsers.map(user => (
                      <SelectItem 
                        key={user.id} 
                        value={user.id}
                        className="hover:bg-purple-50 focus:bg-purple-100 cursor-pointer"
                      >
                        <span className="font-medium text-gray-900">
                          {user.name} <span className="text-xs text-gray-500">({user.role.replace('ar1_planning', 'AR Planning').replace('ar2_field', 'AR Field')})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-green-600"
                  onClick={handleSaveAR}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-600"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm font-medium min-w-[120px]">
                  {currentAR ? currentAR.name : "No AR assigned"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setIsEditingAR(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No task selected</span>
        )}
      </TableCell>

      {/* View Dashboard Action */}
      <TableCell>
        <Button 
          size="sm" 
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/project-mgmt/dashboard/${project.id}`);
          }}
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

const AdminDashboard = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [statsOverview, setStatsOverview] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
  });

  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Always fetch data, let the component render
    fetchAllProjects();
    fetchAllUsers();
  }, []);

  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      console.log("Fetching projects...");

      // Fetch all projects (same filters as ProjectTracking)
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (projectsError) {
        console.error("Projects error:", projectsError);
        throw projectsError;
      }

      console.log("Projects fetched:", projectsData?.length || 0);

      // Fetch all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("project_tasks")
        .select("*");

      if (tasksError) {
        console.error("Tasks error:", tasksError);
        throw tasksError;
      }

      console.log("Tasks fetched:", tasksData?.length || 0);

      const today = new Date();
      const projectSummaries: ProjectSummary[] = [];
      let totalTasks = 0;
      let totalCompleted = 0;
      let totalOverdue = 0;

      for (const project of projectsData || []) {
        const projectTasks = tasksData?.filter(t => t.project_id === project.id) || [];
        const completedTasks = projectTasks.filter(t => t.task_status === "completed").length;
        const inProgressTasks = projectTasks.filter(t => t.task_status === "started").length;
        const inQueueTasks = projectTasks.filter(t => t.task_status === "in_queue").length;
        const overdueTasks = projectTasks.filter(t => 
          t.due_date && new Date(t.due_date) < today && t.task_status !== "completed"
        ).length;

        const completionPercentage = projectTasks.length > 0 
          ? Math.round((completedTasks / projectTasks.length) * 100) 
          : 0;

        const daysRemaining = project.expected_end_date
          ? Math.ceil((new Date(project.expected_end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        let status = "active";
        if (completionPercentage === 100) status = "completed";
        else if (daysRemaining < 0) status = "overdue";
        else if (daysRemaining <= 7) status = "urgent";

        totalTasks += projectTasks.length;
        totalCompleted += completedTasks;
        totalOverdue += overdueTasks;

        projectSummaries.push({
          id: project.id,
          project_name: project.project_name,
          project_manager_name: project.project_manager_name || "Unassigned",
          start_date: project.start_date,
          expected_end_date: project.expected_end_date,
          hours_allocated: project.hours_allocated || 0,
          total_tasks: projectTasks.length,
          completed_tasks: completedTasks,
          in_progress_tasks: inProgressTasks,
          in_queue_tasks: inQueueTasks,
          overdue_tasks: overdueTasks,
          completion_percentage: completionPercentage,
          days_remaining: daysRemaining,
          status,
          tasks: projectTasks
        });
      }

      setProjects(projectSummaries);
      setFilteredProjects(projectSummaries);

      setStatsOverview({
        totalProjects: projectSummaries.length,
        activeProjects: projectSummaries.filter(p => p.status === "active" || p.status === "urgent").length,
        completedProjects: projectSummaries.filter(p => p.status === "completed").length,
        totalTasks,
        completedTasks: totalCompleted,
        overdueTasks: totalOverdue,
      });

    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      console.log("Fetching all users...");
      
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error("Error fetching user roles:", rolesError);
        return;
      }

      if (!userRoles || userRoles.length === 0) {
        console.log("No user roles found");
        return;
      }

      console.log("User roles fetched:", userRoles.length);

      const userIds = userRoles.map(ur => ur.user_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return;
      }

      if (profiles) {
        const usersWithRoles = profiles.map(profile => {
          const role = userRoles.find(ur => ur.user_id === profile.user_id)?.role || '';
          return {
            id: profile.user_id,
            name: profile.name,
            role: role
          };
        });
        console.log("Users with roles:", usersWithRoles);
        setAllUsers(usersWithRoles);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const updateTaskAR = async (taskId: string, arId: string) => {
    try {
      // Update the task AR assignment
      // Database trigger (trigger_task_assignment_email) will automatically handle email notification
      const { error: updateError } = await supabase
        .from('project_tasks')
        .update({ 
          assigned_ar_id: arId,
          assigned_skip_flag: 'Y'  // 'Y' = AR assigned, 'N' = No AR
        })
        .eq('task_id', taskId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "AR assigned successfully! Email notification will be sent.",
      });

      fetchAllProjects();
    } catch (error) {
      console.error("Error updating AR:", error);
      toast({
        title: "Error",
        description: "Failed to assign AR.",
        variant: "destructive",
      });
    }
  };

  // Filter projects when search term changes
  useEffect(() => {
    if (searchTerm) {
      const filtered = projects.filter(p =>
        p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.project_manager_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(projects);
    }
  }, [searchTerm, projects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
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
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Comprehensive overview of all projects and tasks</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
                  <h3 className="text-2xl font-bold">{statsOverview.totalProjects}</h3>
                </div>
                <FolderKanban className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <h3 className="text-2xl font-bold text-blue-600">{statsOverview.activeProjects}</h3>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <h3 className="text-2xl font-bold text-green-600">{statsOverview.completedProjects}</h3>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                  <h3 className="text-2xl font-bold">{statsOverview.totalTasks}</h3>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed Tasks</p>
                  <h3 className="text-2xl font-bold text-green-600">{statsOverview.completedTasks}</h3>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <h3 className="text-2xl font-bold text-red-600">{statsOverview.overdueTasks}</h3>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6 flex items-center justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects or managers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* View Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-4 w-4 mr-2" />
              Grid
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="h-4 w-4 mr-2" />
              Table
            </Button>
          </div>
        </div>

        {/* Projects Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                allUsers={allUsers}
                getStatusBadge={getStatusBadge}
                getLatestTask={getLatestTask}
                updateTaskAR={updateTaskAR}
                navigate={navigate}
              />
            ))}
          </div>
        )}

        {/* Projects Table View */}
        {viewMode === "table" && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>PM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="w-[220px]">Task Name</TableHead>
                    <TableHead>Task Status</TableHead>
                    <TableHead>Assigned AR</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      allUsers={allUsers}
                      getStatusBadge={getStatusBadge}
                      getLatestTask={getLatestTask}
                      updateTaskAR={updateTaskAR}
                      navigate={navigate}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No projects found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
