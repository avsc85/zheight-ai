import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const COLORS = {
  completed: "#22c55e",
  started: "#3b82f6",
  in_queue: "#f59e0b",
  blocked: "#ef4444",
};

interface ProjectData {
  project: any;
  tasks: any[];
  attachments: any[];
  teamMembers: any[];
}

const ProjectDashboardView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);

      // Fetch project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      // Fetch tasks (without AR names to avoid FK error)
      const { data: tasks, error: tasksError } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId);

      if (tasksError) throw tasksError;

      // Get unique AR IDs
      const arIds = [...new Set(tasks?.filter(t => t.assigned_ar_id).map(t => t.assigned_ar_id))];
      
      // Fetch AR profiles separately
      let arProfiles: any[] = [];
      if (arIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", arIds);
        arProfiles = profiles || [];
      }

      // Map AR names to tasks
      const tasksWithARNames = tasks?.map(task => ({
        ...task,
        ar_name: arProfiles.find(p => p.id === task.assigned_ar_id)?.name || "Unassigned"
      })) || [];

      // Fetch attachments
      const { data: attachments } = await supabase
        .from("attachments" as any)
        .select("*")
        .or(`project_id.eq.${projectId},task_id.in.(${tasksWithARNames?.map(t => t.task_id).join(",") || ""})`);

      // Get unique team members (ARs)
      const uniqueARs = arProfiles.map(p => ({
        id: p.id,
        name: p.name
      }));

      setProjectData({
        project,
        tasks: tasksWithARNames,
        attachments: attachments || [],
        teamMembers: uniqueARs,
      });
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to load project data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !projectData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  const { project, tasks, attachments, teamMembers } = projectData;

  // Calculate statistics
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.task_status === "completed").length,
    inProgress: tasks.filter(t => t.task_status === "started").length,
    inQueue: tasks.filter(t => t.task_status === "in_queue").length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.task_status !== "completed").length,
  };

  const completionPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Prepare chart data
  const taskStatusData = [
    { name: "Completed", value: stats.completed, color: COLORS.completed },
    { name: "In Progress", value: stats.inProgress, color: COLORS.started },
    { name: "In Queue", value: stats.inQueue, color: COLORS.in_queue },
  ];

  const tasksByAR = teamMembers.map(member => ({
    name: member.name,
    completed: tasks.filter(t => t.assigned_ar_id === member.id && t.task_status === "completed").length,
    inProgress: tasks.filter(t => t.assigned_ar_id === member.id && t.task_status === "started").length,
    pending: tasks.filter(t => t.assigned_ar_id === member.id && t.task_status === "in_queue").length,
  }));

  // Timeline data (tasks by milestone)
  const milestoneData = tasks.reduce((acc: any[], task) => {
    const milestone = `M${task.milestone_number || 0}`;
    const existing = acc.find(m => m.name === milestone);
    if (existing) {
      existing.tasks += 1;
      if (task.task_status === "completed") existing.completed += 1;
    } else {
      acc.push({
        name: milestone,
        tasks: 1,
        completed: task.task_status === "completed" ? 1 : 0,
      });
    }
    return acc;
  }, []).sort((a, b) => a.name.localeCompare(b.name));

  const daysRemaining = project.expected_end_date
    ? Math.ceil((new Date(project.expected_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/project-mgmt/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{project.project_name}</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                PM: {project.project_manager_name || "Unassigned"}
              </p>
            </div>
            <Badge
              className={
                completionPercentage === 100
                  ? "bg-green-100 text-green-800"
                  : daysRemaining < 0
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
              }
            >
              {completionPercentage === 100 ? "Completed" : daysRemaining < 0 ? "Overdue" : "Active"}
            </Badge>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Completion</p>
                  <p className="text-3xl font-bold text-primary">{completionPercentage}%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Tasks</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">{stats.completed} completed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="text-3xl font-bold">{teamMembers.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Days Remaining</p>
                  <p className={`text-3xl font-bold ${daysRemaining < 0 ? "text-red-600" : ""}`}>
                    {Math.abs(daysRemaining)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {daysRemaining < 0 ? "overdue" : "remaining"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Task Status Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Task Status Distribution</CardTitle>
                  <CardDescription>Current status of all tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Milestone Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>Milestone Progress</CardTitle>
                  <CardDescription>Tasks completion by milestone</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={milestoneData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="tasks" fill="#94a3b8" name="Total Tasks" />
                      <Bar dataKey="completed" fill={COLORS.completed} name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Project Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date:</span>
                    <span className="font-semibold">{project.start_date || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End Date:</span>
                    <span className="font-semibold">{project.expected_end_date || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Difficulty:</span>
                    <Badge variant="outline">
                      {(project.difficulty_level || "medium").charAt(0).toUpperCase() + (project.difficulty_level || "medium").slice(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hours Allocated:</span>
                    <span className="font-semibold">{project.hours_allocated || 0}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attachments:</span>
                    <span className="font-semibold">{attachments.length} files</span>
                  </div>
                  {project.project_notes && (
                    <div>
                      <p className="text-muted-foreground mb-2">Notes:</p>
                      <p className="text-sm bg-muted p-3 rounded-md">{project.project_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium">Completed Tasks</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{stats.completed}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Activity className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium">In Progress</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">{stats.inProgress}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-orange-600" />
                      <span className="text-sm font-medium">In Queue</span>
                    </div>
                    <span className="text-lg font-bold text-orange-600">{stats.inQueue}</span>
                  </div>
                  {stats.overdue > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-medium">Overdue</span>
                      </div>
                      <span className="text-lg font-bold text-red-600">{stats.overdue}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>All Tasks</CardTitle>
                <CardDescription>{tasks.length} total tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tasks.map((task, index) => (
                    <div
                      key={task.task_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {index + 1}. {task.task_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Assigned to: {task.ar_name} | Due: {task.due_date || "No deadline"}
                        </p>
                      </div>
                      <Badge
                        className={
                          task.task_status === "completed"
                            ? "bg-green-100 text-green-800"
                            : task.task_status === "started"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-orange-100 text-orange-800"
                        }
                      >
                        {task.task_status === "completed"
                          ? "Completed"
                          : task.task_status === "started"
                          ? "In Progress"
                          : "In Queue"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance</CardTitle>
                  <CardDescription>Tasks by team member</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tasksByAR}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" stackId="a" fill={COLORS.completed} name="Completed" />
                      <Bar dataKey="inProgress" stackId="a" fill={COLORS.started} name="In Progress" />
                      <Bar dataKey="pending" stackId="a" fill={COLORS.in_queue} name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>{teamMembers.length} members</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {teamMembers.map(member => {
                      const memberTasks = tasks.filter(t => t.assigned_ar_id === member.id);
                      const memberCompleted = memberTasks.filter(t => t.task_status === "completed").length;
                      const completion = memberTasks.length > 0 ? (memberCompleted / memberTasks.length) * 100 : 0;

                      return (
                        <div key={member.id} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium">{member.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {memberCompleted}/{memberTasks.length} tasks
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${completion}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Project Timeline</CardTitle>
                <CardDescription>Visual representation of project progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Project Duration</p>
                      <p className="text-sm text-muted-foreground">
                        {project.start_date} to {project.expected_end_date}
                      </p>
                    </div>
                    <Badge>{daysRemaining > 0 ? `${daysRemaining} days left` : "Overdue"}</Badge>
                  </div>

                  <div className="relative pt-4">
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                    {milestoneData.map((milestone, index) => (
                      <div key={index} className="relative pb-8 pl-16">
                        <div className="absolute left-6 top-1 w-4 h-4 rounded-full bg-primary"></div>
                        <div className="bg-white p-4 rounded-lg border">
                          <p className="font-medium">{milestone.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {milestone.completed} of {milestone.tasks} tasks completed (
                            {Math.round((milestone.completed / milestone.tasks) * 100)}%)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectDashboardView;
