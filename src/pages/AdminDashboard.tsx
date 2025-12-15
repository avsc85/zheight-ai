import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Grid3x3
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
}

const AdminDashboard = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
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

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: "bg-green-100 text-green-800 hover:bg-green-200",
      active: "bg-blue-100 text-blue-800 hover:bg-blue-200",
      urgent: "bg-orange-100 text-orange-800 hover:bg-orange-200",
      overdue: "bg-red-100 text-red-800 hover:bg-red-200",
    };
    return (
      <Badge className={styles[status as keyof typeof styles] || styles.active}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };


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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/project-mgmt/dashboard/${project.id}`)}
            >
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
                    <div className="w-full bg-gray-200 rounded-full h-2">
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

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    {getStatusBadge(project.status)}
                    <span className="text-sm text-muted-foreground">{project.hours_allocated}h allocated</span>
                  </div>

                  {/* View Button */}
                  <Button className="w-full" variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                    <TableHead>Start Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Active AR</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow 
                      key={project.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => navigate(`/project-mgmt/dashboard/${project.id}`)}
                    >
                      <TableCell className="font-medium">{project.project_name}</TableCell>
                      <TableCell>{project.project_manager_name}</TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>{project.start_date || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{project.expected_end_date || "N/A"}</span>
                          {project.days_remaining !== 0 && (
                            <span className={`text-xs ${project.days_remaining < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {project.days_remaining > 0 
                                ? `${project.days_remaining}d left` 
                                : `${Math.abs(project.days_remaining)}d overdue`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${project.completion_percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{project.completion_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span>{project.completed_tasks}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{project.in_progress_tasks} active</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {project.in_progress_tasks > 0 ? `${project.in_progress_tasks} AR(s)` : "None"}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/project-mgmt/dashboard/${project.id}`);
                          }}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
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
