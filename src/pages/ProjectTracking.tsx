import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Filter, Download, RefreshCw, Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface ProjectTask {
  id: string;
  project: string;
  projectId: string;
  taskActiveAssigned: string;
  arAssigned: string;
  arAssignedName?: string;
  currentStatus: string;
  dueDate: string;
  priorityException: string;
  lastStepTimestamp: string;
  notesAR: string;
  notesPM: string;
  completionDate?: string;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, string> = {
    "started": "bg-blue-100 text-blue-800",
    "in_queue": "bg-gray-100 text-gray-800", 
    "completed": "bg-green-100 text-green-800",
    "blocked": "bg-red-100 text-red-800"
  };
  
  return (
    <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </Badge>
  );
};

const ProjectTracking = () => {
  const [filterTerm, setFilterTerm] = useState("");
  const [activeTab, setActiveTab] = useState("setup");
  const [projects, setProjects] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editedNotesValue, setEditedNotesValue] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { role, isPM, isAR2, isAdmin } = useUserRole();
  
  useEffect(() => {
    if (user && (isPM || isAR2 || isAdmin)) {
      fetchProjects();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'project_tasks'
          },
          () => {
            fetchProjects();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects'
          },
          () => {
            fetchProjects();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isPM, isAR2, isAdmin]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('project_tasks')
        .select(`
          *,
          projects (
            project_name,
            user_id,
            ar_planning_id,
            ar_field_id
          )
        `);

      // Apply role-based filtering
      if (isPM && !isAdmin) {
        // PM users see projects they created
        query = query.filter('projects.user_id', 'eq', user?.id);
      } else if (isAR2 && !isAdmin) {
        // AR2 users see projects assigned to them
        query = query.filter('projects.ar_field_id', 'eq', user?.id);
      }
      // Admin users see all projects (no additional filter)

      const { data: tasks, error } = await query;

      if (error) throw error;

      // Get user names for assigned AR users
      const assignedUserIds = [...new Set((tasks || []).map(task => task.assigned_ar_id).filter(Boolean))];
      let userNames: Record<string, string> = {};
      
      if (assignedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', assignedUserIds);
        
        userNames = (profiles || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile.name || 'Unknown';
          return acc;
        }, {} as Record<string, string>);
      }

      const formattedTasks: ProjectTask[] = (tasks || []).map(task => ({
        id: task.task_id,
        project: task.projects?.project_name || 'Unknown Project',
        projectId: task.project_id,
        taskActiveAssigned: task.task_name,
        arAssigned: task.assigned_ar_id || '',
        arAssignedName: userNames[task.assigned_ar_id] || 'Unassigned',
        currentStatus: task.task_status || 'in_queue',
        dueDate: task.due_date || '',
        priorityException: task.priority_exception || '',
        lastStepTimestamp: task.last_step_timestamp ? 
          new Date(task.last_step_timestamp).toLocaleString() : '',
        notesAR: task.notes_tasks_ar || '',
        notesPM: task.notes_tasks_pm || '',
        completionDate: task.completion_date
      }));

      setProjects(formattedTasks);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to load project data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePMNotes = async (taskId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ notes_tasks_pm: notes })
        .eq('task_id', taskId);

      if (error) throw error;

      // Update local state
      setProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === taskId ? { ...project, notesPM: notes } : project
        )
      );

      toast({
        title: "Success",
        description: "PM notes updated successfully.",
      });
    } catch (error) {
      console.error('Error updating PM notes:', error);
      toast({
        title: "Error",
        description: "Failed to update PM notes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveNotes = async (taskId: string) => {
    await handleUpdatePMNotes(taskId, editedNotesValue);
    setEditingNotes(null);
    setEditedNotesValue("");
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setEditedNotesValue("");
  };

  const startEditingNotes = (taskId: string, currentNotes: string) => {
    setEditingNotes(taskId);
    setEditedNotesValue(currentNotes);
  };

  const filteredProjects = projects.filter(project =>
    project.project.toLowerCase().includes(filterTerm.toLowerCase()) ||
    project.taskActiveAssigned.toLowerCase().includes(filterTerm.toLowerCase()) ||
    (project.arAssignedName && project.arAssignedName.toLowerCase().includes(filterTerm.toLowerCase()))
  );

  if (!isPM && !isAR2 && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Access denied. This page is only available for PM, AR2, and Admin users.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="setup" className="text-sm font-medium">
                Project Setup
              </TabsTrigger>
              <TabsTrigger value="tracking" className="text-sm font-medium">
                Project Tracking
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="setup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Setup</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    This section will redirect you to the Project Setup page for creating new projects.
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/project-mgmt/setup'}
                  >
                    Go to Project Setup
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="tracking" className="space-y-6">
              {/* Header with Filter and Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">Project Tracking</h1>
                  <p className="text-muted-foreground">Monitor all project tasks and their progress</p>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchProjects}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Filter Section */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter Project"
                      value={filterTerm}
                      onChange={(e) => setFilterTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Loading project data...</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Project Tracking Table */}
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-48">Project</TableHead>
                              <TableHead className="min-w-48">Task Active Assigned</TableHead>
                              <TableHead className="w-32">AR Assigned</TableHead>
                              <TableHead className="w-32">Current Status</TableHead>
                              <TableHead className="w-32">Due Date</TableHead>
                              <TableHead className="min-w-48">Priority Exception</TableHead>
                              <TableHead className="w-40">Last Step Timestamp</TableHead>
                              <TableHead className="min-w-64">AR Notes</TableHead>
                              <TableHead className="min-w-64">PM Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProjects.map((project) => (
                              <TableRow key={project.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">
                                  {project.project}
                                </TableCell>
                                <TableCell>{project.taskActiveAssigned}</TableCell>
                                <TableCell>
                                  {project.arAssignedName && project.arAssignedName !== 'Unassigned' && (
                                    <Badge variant="outline">{project.arAssignedName}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(project.currentStatus)}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {project.dueDate}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {project.priorityException && (
                                    <Badge variant="destructive" className="text-xs">
                                      {project.priorityException}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {project.lastStepTimestamp}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {project.notesAR && (
                                    <div className="max-w-64 p-2 bg-blue-50 rounded text-xs">
                                      {project.notesAR}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {editingNotes === project.id ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={editedNotesValue}
                                        onChange={(e) => setEditedNotesValue(e.target.value)}
                                        className="text-xs min-h-16 resize-none"
                                        placeholder="Add PM notes..."
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleSaveNotes(project.id)}
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
                                    <div className="flex items-center gap-2">
                                      {project.notesPM ? (
                                        <div className="max-w-64 p-2 bg-green-50 rounded text-xs">
                                          {project.notesPM}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-muted-foreground/60 italic">
                                          No PM notes
                                        </div>
                                      )}
                                      {(isPM || isAdmin) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditingNotes(project.id, project.notesPM)}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-600">
                          {filteredProjects.filter(p => p.currentStatus === "started").length}
                        </div>
                        <p className="text-sm text-muted-foreground">Started Tasks</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-gray-600">
                          {filteredProjects.filter(p => p.currentStatus === "in_queue").length}
                        </div>
                        <p className="text-sm text-muted-foreground">Queued Tasks</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-600">
                          {filteredProjects.filter(p => p.currentStatus === "completed").length}
                        </div>
                        <p className="text-sm text-muted-foreground">Completed Tasks</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-red-600">
                          {filteredProjects.filter(p => p.currentStatus === "blocked").length}
                        </div>
                        <p className="text-sm text-muted-foreground">Blocked Tasks</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ProjectTracking;