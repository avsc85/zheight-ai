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
  X,
  Plus
} from "lucide-react";
import { TaskFilterPanel, TaskFilters, applyTaskFilters, defaultTaskFilters } from "@/components/TaskFilterPanel";
import { ProjectDateFilter, ProjectDateFilters, applyProjectDateFilters, defaultProjectDateFilters } from "@/components/ProjectDateFilter";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ProjectSummary {
  id: string;
  project_name: string;
  project_manager_name: string;
  start_date: string;
  expected_end_date: string;
  created_at?: string;
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
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState<string>("");
  const { toast } = useToast();
  
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
      // Validation: Due date is required when assigning an AR
      if (!currentTask.due_date) {
        toast({
          title: "Validation Error",
          description: `Cannot assign AR without a due date. Please set a due date for "${currentTask.task_name}" first.`,
          variant: "destructive",
        });
        return;
      }
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

  const handleSaveDueDate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTask?.task_id && tempDueDate) {
      await updateTaskDueDate(currentTask.task_id, tempDueDate);
      setIsEditingDueDate(false);
      setTempDueDate("");
    }
  };

  const handleCancelDueDateEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingDueDate(false);
    setTempDueDate("");
  };

  const updateTaskDueDate = async (taskId: string, dueDate: string) => {
    try {
      // Update task due date - database trigger will handle email notification if AR is assigned
      const { error: updateError } = await supabase
        .from('project_tasks')
        .update({ due_date: dueDate })
        .eq('task_id', taskId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Task due date updated! Email notification will be sent to assigned AR.",
      });

      // Refresh the data to reflect changes across project and AR's tasks
      window.location.reload();
    } catch (error) {
      console.error("Error updating due date:", error);
      toast({
        title: "Error",
        description: "Failed to update due date.",
        variant: "destructive",
      });
    }
  };

  const assignableUsers = allUsers.filter(u => 
    u.role !== 'pm' && u.role !== 'admin'
  );

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle 
              className="text-lg mb-2 cursor-pointer hover:text-primary hover:underline transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/project-mgmt/dashboard/${project.id}`);
              }}
            >
              {project.project_name}
            </CardTitle>
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

          {/* Task Due Date - Editable */}
          <div onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-muted-foreground mb-2">Task Due Date</p>
            {currentTask ? (
              <div className="flex items-center gap-2">
                {isEditingDueDate ? (
                  <>
                    <Input
                      type="date"
                      value={tempDueDate || currentTask.due_date || ""}
                      onChange={(e) => setTempDueDate(e.target.value)}
                      className="h-9 flex-1 bg-white"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-green-600"
                      onClick={handleSaveDueDate}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-red-600"
                      onClick={handleCancelDueDateEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-3 py-2 bg-secondary rounded-md text-sm font-medium">
                      {currentTask.due_date ? new Date(currentTask.due_date).toLocaleDateString() : "No date set"}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingDueDate(true);
                        setTempDueDate(currentTask.due_date || "");
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
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingAR, setIsEditingAR] = useState(false);
  const [tempARId, setTempARId] = useState<string | null>(null);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState<string>("");
  
  const latestTask = getLatestTask(project);
  const currentTask = selectedTaskId 
    ? project.tasks?.find(t => t.task_id === selectedTaskId)
    : latestTask;

  const currentAR = currentTask?.assigned_ar_id 
    ? allUsers.find(u => u.id === currentTask.assigned_ar_id)
    : null;

  const handleSaveAR = async () => {
    if (currentTask?.task_id && tempARId) {
      // Validation: Due date is required when assigning an AR
      if (!currentTask.due_date) {
        toast({
          title: "Validation Error",
          description: `Cannot assign AR without a due date. Please set a due date for "${currentTask.task_name}" first.`,
          variant: "destructive",
        });
        return;
      }
      await updateTaskAR(currentTask.task_id, tempARId);
      setIsEditingAR(false);
      setTempARId(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingAR(false);
    setTempARId(null);
  };

  const handleSaveDueDate = async () => {
    if (currentTask?.task_id && tempDueDate) {
      await updateTaskDueDate(currentTask.task_id, tempDueDate);
      setIsEditingDueDate(false);
      setTempDueDate("");
    }
  };

  const handleCancelDueDateEdit = () => {
    setIsEditingDueDate(false);
    setTempDueDate("");
  };

  const updateTaskDueDate = async (taskId: string, dueDate: string) => {
    try {
      // Update task due date - database trigger will handle email notification if AR is assigned
      const { error: updateError } = await supabase
        .from('project_tasks')
        .update({ due_date: dueDate })
        .eq('task_id', taskId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Task due date updated! Email notification will be sent to assigned AR.",
      });

      // Refresh the data to reflect changes across project and AR's tasks
      window.location.reload();
    } catch (error) {
      console.error("Error updating due date:", error);
      toast({
        title: "Error",
        description: "Failed to update due date.",
        variant: "destructive",
      });
    }
  };

  // Filter users: exclude PM and Admin roles
  const assignableUsers = allUsers.filter(u => 
    u.role !== 'pm' && u.role !== 'admin'
  );

  return (
    <TableRow className="hover:bg-accent">
      <TableCell className="font-medium">
        <span 
          className="cursor-pointer hover:text-primary hover:underline transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/project-mgmt/dashboard/${project.id}`);
          }}
        >
          {project.project_name}
        </span>
      </TableCell>
      
      {/* PM Column - Read Only */}
      <TableCell>
        <span className="text-sm font-medium">{project.project_manager_name}</span>
      </TableCell>

      <TableCell>{getStatusBadge(project.status)}</TableCell>

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

      {/* Task Due Date - Editable */}
      <TableCell>
        {currentTask ? (
          <div className="flex items-center gap-2">
            {isEditingDueDate ? (
              <>
                <Input
                  type="date"
                  value={tempDueDate || currentTask.due_date || ""}
                  onChange={(e) => setTempDueDate(e.target.value)}
                  className="h-9 w-40 bg-white"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-green-600"
                  onClick={handleSaveDueDate}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-600"
                  onClick={handleCancelDueDateEdit}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm font-medium min-w-[100px]">
                  {currentTask.due_date ? new Date(currentTask.due_date).toLocaleDateString() : "No date set"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setIsEditingDueDate(true);
                    setTempDueDate(currentTask.due_date || "");
                  }}
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

type FilterTab = 'total_projects' | 'active' | 'completed' | 'overdue_projects' | 'total_tasks' | 'completed_tasks';

const AdminDashboard = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectSummary[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [activeFilter, setActiveFilter] = useState<FilterTab>('total_projects');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(defaultTaskFilters);
  const [dateFilters, setDateFilters] = useState<ProjectDateFilters>(defaultProjectDateFilters);
  const [statsOverview, setStatsOverview] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    overdueProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
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
          created_at: project.created_at,
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

      // Collect all tasks with project info for task filtering
      const allTasksWithProject = (tasksData || []).map(task => {
        const project = projectsData?.find(p => p.id === task.project_id);
        return {
          ...task,
          project_name: project?.project_name || 'Unknown Project',
          project_manager_name: project?.project_manager_name || 'Unassigned'
        };
      });

      setProjects(projectSummaries);
      setFilteredProjects(projectSummaries);
      setAllTasks(allTasksWithProject);
      setFilteredTasks(allTasksWithProject);

      setStatsOverview({
        totalProjects: projectSummaries.length,
        activeProjects: projectSummaries.filter(p => p.status === "active" || p.status === "urgent").length,
        completedProjects: projectSummaries.filter(p => p.status === "completed").length,
        overdueProjects: projectSummaries.filter(p => p.days_remaining < 0 && p.status !== "completed").length,
        totalTasks,
        completedTasks: totalCompleted,
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

  // Filter projects and tasks based on active filter, search term, date filters, and task filters
  useEffect(() => {
    const today = new Date();
    let projectsToFilter = projects;
    let tasksToFilter = allTasks;

    // Apply date filter first
    projectsToFilter = applyProjectDateFilters(projectsToFilter, dateFilters);

    // Apply filter based on active tab
    switch (activeFilter) {
      case 'active':
        projectsToFilter = projectsToFilter.filter(p => p.status === "active" || p.status === "urgent");
        break;
      case 'completed':
        projectsToFilter = projectsToFilter.filter(p => p.status === "completed");
        break;
      case 'overdue_projects':
        projectsToFilter = projectsToFilter.filter(p => p.days_remaining < 0 && p.status !== "completed");
        break;
      case 'total_tasks':
        // Show all tasks
        break;
      case 'completed_tasks':
        tasksToFilter = allTasks.filter(t => t.task_status === "completed");
        break;
      default:
        // total_projects - show all
        break;
    }

    // Apply task filters when in task view
    if (activeFilter === 'total_tasks' || activeFilter === 'completed_tasks') {
      tasksToFilter = applyTaskFilters(tasksToFilter, taskFilters);
    }

    // Apply search filter
    if (searchTerm) {
      projectsToFilter = projectsToFilter.filter(p =>
        p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.project_manager_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      tasksToFilter = tasksToFilter.filter(t =>
        t.task_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProjects(projectsToFilter);
    setFilteredTasks(tasksToFilter);
  }, [searchTerm, projects, allTasks, activeFilter, taskFilters, dateFilters]);

  const isTaskFilter = activeFilter === 'total_tasks' || activeFilter === 'completed_tasks';

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

        {/* Stats Overview - Clickable Filter Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'total_projects' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
            onClick={() => setActiveFilter('total_projects')}
          >
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

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'active' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            onClick={() => setActiveFilter('active')}
          >
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

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'completed' ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
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

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'overdue_projects' ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
            onClick={() => setActiveFilter('overdue_projects')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <h3 className="text-2xl font-bold text-red-600">{statsOverview.overdueProjects}</h3>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'total_tasks' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}
            onClick={() => setActiveFilter('total_tasks')}
          >
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

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'completed_tasks' ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
            onClick={() => setActiveFilter('completed_tasks')}
          >
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
        </div>

        {/* Search and Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/project-mgmt/setup")}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects or managers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <ProjectDateFilter 
              filters={dateFilters}
              onFiltersChange={setDateFilters}
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

        {/* Content based on filter type */}
        {!isTaskFilter ? (
          <>
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
                        <TableHead>Progress</TableHead>
                        <TableHead className="w-[220px]">Task Name</TableHead>
                        <TableHead>Task Status</TableHead>
                        <TableHead>Task Due Date</TableHead>
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
          </>
        ) : (
          /* Tasks Table View */
          <>
            {/* Task Filter Panel */}
            <div className="mb-4">
              <TaskFilterPanel
                filters={taskFilters}
                onFiltersChange={setTaskFilters}
                allUsers={allUsers}
                projects={projects.map(p => ({ id: p.id, project_name: p.project_name }))}
              />
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Assigned AR</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => {
                      const assignedAR = allUsers.find(u => u.id === task.assigned_ar_id);
                      return (
                        <TableRow 
                          key={task.task_id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/project-mgmt/dashboard/${task.project_id}`)}
                        >
                          <TableCell className="font-medium">{task.task_name}</TableCell>
                          <TableCell>{task.project_name}</TableCell>
                          <TableCell>{getTaskStatusBadge(task.task_status || 'in_queue')}</TableCell>
                          <TableCell>
                            {task.due_date 
                              ? new Date(task.due_date).toLocaleDateString() 
                              : <span className="text-muted-foreground">No date</span>
                            }
                          </TableCell>
                          <TableCell>{assignedAR?.name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/project-mgmt/dashboard/${task.project_id}`);
                              }}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {isTaskFilter && filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
