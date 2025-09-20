import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Download, RefreshCw, Edit, Save, X, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
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
  taskType: 'assigned' | 'next_unassigned';
  milestoneNumber: number;
}

type SortField = keyof ProjectTask;
type SortDirection = 'asc' | 'desc' | null;

interface ColumnFilters {
  project: string;
  taskActiveAssigned: string;
  arAssignedName: string;
  currentStatus: string;
  dueDate: string;
  priorityException: string;
  taskType: string;
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
  const [projects, setProjects] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editedNotesValue, setEditedNotesValue] = useState("");
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Column filters
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    project: '',
    taskActiveAssigned: '',
    arAssignedName: '',
    currentStatus: '',
    dueDate: '',
    priorityException: '',
    taskType: ''
  });
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
      
      // Fetch assigned tasks
      let assignedQuery = supabase
        .from('project_tasks')
        .select(`
          *,
          projects (
            id,
            project_name,
            user_id,
            ar_planning_id,
            ar_field_id
          )
        `)
        .in('task_status', ['in_queue', 'started', 'blocked'])
        .eq('assigned_skip_flag', 'Y');

      // Apply role-based filtering for assigned tasks
      if (isPM && !isAdmin) {
        assignedQuery = assignedQuery.filter('projects.user_id', 'eq', user?.id);
      } else if (isAR2 && !isAdmin) {
        assignedQuery = assignedQuery.filter('projects.ar_field_id', 'eq', user?.id);
      }

      const { data: assignedTasks, error: assignedError } = await assignedQuery;
      if (assignedError) throw assignedError;

      // Fetch next unassigned task per project
      let nextUnassignedQuery = supabase
        .from('project_tasks')
        .select(`
          *,
          projects (
            id,
            project_name,
            user_id,
            ar_planning_id,
            ar_field_id
          )
        `)
        .eq('assigned_skip_flag', 'N')
        .order('milestone_number', { ascending: true });

      // Apply role-based filtering for next unassigned tasks
      if (isPM && !isAdmin) {
        nextUnassignedQuery = nextUnassignedQuery.filter('projects.user_id', 'eq', user?.id);
      } else if (isAR2 && !isAdmin) {
        nextUnassignedQuery = nextUnassignedQuery.filter('projects.ar_field_id', 'eq', user?.id);
      }

      const { data: allUnassignedTasks, error: unassignedError } = await nextUnassignedQuery;
      if (unassignedError) throw unassignedError;

      // Get only the first (lowest milestone_number) unassigned task per project
      const nextUnassignedByProject = new Map();
      (allUnassignedTasks || []).forEach(task => {
        const projectId = task.projects?.id || task.project_id;
        if (!nextUnassignedByProject.has(projectId)) {
          nextUnassignedByProject.set(projectId, task);
        }
      });
      const nextUnassignedTasks = Array.from(nextUnassignedByProject.values());

      // Combine both task types
      const allTasks = [
        ...(assignedTasks || []).map(task => ({ ...task, task_type: 'assigned' })),
        ...nextUnassignedTasks.map(task => ({ ...task, task_type: 'next_unassigned' }))
      ];

      // Get user names for assigned AR users
      const assignedUserIds = [...new Set(allTasks.map(task => task.assigned_ar_id).filter(Boolean))];
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

      const formattedTasks: ProjectTask[] = allTasks.map(task => ({
        id: task.task_id,
        project: task.projects?.project_name || 'Unknown Project',
        projectId: task.projects?.id || task.project_id,
        taskActiveAssigned: task.task_name,
        arAssigned: task.assigned_ar_id || '',
        arAssignedName: userNames[task.assigned_ar_id] || (task.task_type === 'next_unassigned' ? 'Unassigned' : 'Unknown'),
        currentStatus: task.task_status || 'in_queue',
        dueDate: task.due_date || '',
        priorityException: task.priority_exception || '',
        lastStepTimestamp: task.last_step_timestamp ? 
          new Date(task.last_step_timestamp).toLocaleString() : '',
        notesAR: task.notes_tasks_ar || '',
        notesPM: task.notes_tasks_pm || '',
        completionDate: task.completion_date,
        taskType: task.task_type as 'assigned' | 'next_unassigned',
        milestoneNumber: task.milestone_number
      }));

      // Sort by project name, then by task type (assigned first), then by milestone number
      formattedTasks.sort((a, b) => {
        if (a.project !== b.project) return a.project.localeCompare(b.project);
        if (a.taskType !== b.taskType) return a.taskType === 'assigned' ? -1 : 1;
        return a.milestoneNumber - b.milestoneNumber;
      });

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

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(
        sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort projects
  const filteredAndSortedProjects = (() => {
    let filtered = projects.filter(project => {
      // Global search filter
      const globalMatch = !filterTerm || (
        project.project.toLowerCase().includes(filterTerm.toLowerCase()) ||
        project.taskActiveAssigned.toLowerCase().includes(filterTerm.toLowerCase()) ||
        (project.arAssignedName && project.arAssignedName.toLowerCase().includes(filterTerm.toLowerCase()))
      );

      // Column filters
      const columnMatch = 
        (!columnFilters.project || project.project.toLowerCase().includes(columnFilters.project.toLowerCase())) &&
        (!columnFilters.taskActiveAssigned || project.taskActiveAssigned.toLowerCase().includes(columnFilters.taskActiveAssigned.toLowerCase())) &&
        (!columnFilters.arAssignedName || (project.arAssignedName && project.arAssignedName.toLowerCase().includes(columnFilters.arAssignedName.toLowerCase()))) &&
        (!columnFilters.currentStatus || project.currentStatus === columnFilters.currentStatus) &&
        (!columnFilters.dueDate || project.dueDate.includes(columnFilters.dueDate)) &&
        (!columnFilters.priorityException || project.priorityException.toLowerCase().includes(columnFilters.priorityException.toLowerCase())) &&
        (!columnFilters.taskType || project.taskType === columnFilters.taskType);

      return globalMatch && columnMatch;
    });

    // Apply sorting
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];

        // Handle string comparison
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        // Handle date comparison
        if (sortField === 'lastStepTimestamp' || sortField === 'dueDate') {
          const aDate = aVal ? new Date(aVal) : new Date(0);
          const bDate = bVal ? new Date(bVal) : new Date(0);
          return sortDirection === 'asc' ? 
            aDate.getTime() - bDate.getTime() : 
            bDate.getTime() - aDate.getTime();
        }

        // Handle milestone number
        if (sortField === 'milestoneNumber') {
          return sortDirection === 'asc' ? 
            (a.milestoneNumber || 0) - (b.milestoneNumber || 0) : 
            (b.milestoneNumber || 0) - (a.milestoneNumber || 0);
        }

        // Default string comparison
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  })();

  // Get unique values for filter dropdowns
  const getUniqueValues = (field: keyof ProjectTask): string[] => {
    const values = projects
      .map(p => p[field])
      .filter(Boolean)
      .filter(v => typeof v === 'string') as string[];
    return [...new Set(values)].sort();
  };

  // Column filter update
  const updateColumnFilter = (column: keyof ColumnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setColumnFilters({
      project: '',
      taskActiveAssigned: '',
      arAssignedName: '',
      currentStatus: '',
      dueDate: '',
      priorityException: '',
      taskType: ''
    });
    setFilterTerm('');
    setSortField(null);
    setSortDirection(null);
  };

  // Sortable header component
  const SortableHeader = ({ field, children, className }: { 
    field: SortField; 
    children: React.ReactNode; 
    className?: string;
  }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );

  // Filter popover component
  const FilterPopover = ({ 
    column, 
    placeholder, 
    options 
  }: { 
    column: keyof ColumnFilters; 
    placeholder: string; 
    options?: string[];
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
          <Filter className={`h-3 w-3 ${columnFilters[column] ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 bg-background border shadow-lg z-50" align="start">
        {options ? (
          <Select 
            value={columnFilters[column]} 
            onValueChange={(value) => updateColumnFilter(column, value)}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="">All</SelectItem>
              {options.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder={placeholder}
              value={columnFilters[column]}
              onChange={(e) => updateColumnFilter(column, e.target.value)}
              className="h-8 bg-background"
            />
            {columnFilters[column] && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => updateColumnFilter(column, '')}
                className="h-6 w-full text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
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
        <div className="max-w-7xl mx-auto space-y-6">
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Global search across projects, tasks, and assignees..."
                        value={filterTerm}
                        onChange={(e) => setFilterTerm(e.target.value)}
                        className="max-w-md"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={clearAllFilters}
                        className="text-xs"
                      >
                        Clear All Filters
                      </Button>
                      <Badge variant="outline" className="text-xs">
                        {filteredAndSortedProjects.length} of {projects.length} tasks
                      </Badge>
                    </div>
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
                             <TableRow className="bg-muted/30">
                               <SortableHeader field="project" className="min-w-48">
                                 <div className="flex items-center gap-2">
                                   Project
                                   <FilterPopover 
                                     column="project" 
                                     placeholder="Filter projects..." 
                                   />
                                 </div>
                               </SortableHeader>
                               <SortableHeader field="taskActiveAssigned" className="min-w-48">
                                 <div className="flex items-center gap-2">
                                   Task Active Assigned
                                   <FilterPopover 
                                     column="taskActiveAssigned" 
                                     placeholder="Filter tasks..." 
                                   />
                                 </div>
                               </SortableHeader>
                               <SortableHeader field="taskType" className="w-32">
                                 <div className="flex items-center gap-2">
                                   Task Type
                                   <FilterPopover 
                                     column="taskType" 
                                     placeholder="Filter type..." 
                                     options={['assigned', 'next_unassigned']}
                                   />
                                 </div>
                               </SortableHeader>
                               <SortableHeader field="arAssignedName" className="w-32">
                                 <div className="flex items-center gap-2">
                                   AR Assigned
                                   <FilterPopover 
                                     column="arAssignedName" 
                                     placeholder="Filter assignees..." 
                                     options={getUniqueValues('arAssignedName')}
                                   />
                                 </div>
                               </SortableHeader>
                               <SortableHeader field="currentStatus" className="w-32">
                                 <div className="flex items-center gap-2">
                                   Current Status
                                   <FilterPopover 
                                     column="currentStatus" 
                                     placeholder="Filter status..." 
                                     options={getUniqueValues('currentStatus')}
                                   />
                                 </div>
                               </SortableHeader>
                               <SortableHeader field="dueDate" className="w-32">
                                 <div className="flex items-center gap-2">
                                   Due Date
                                   <FilterPopover 
                                     column="dueDate" 
                                     placeholder="Filter dates..." 
                                   />
                                 </div>
                               </SortableHeader>
                               <SortableHeader field="priorityException" className="min-w-48">
                                 <div className="flex items-center gap-2">
                                   Priority Exception
                                   <FilterPopover 
                                     column="priorityException" 
                                     placeholder="Filter priorities..." 
                                   />
                                 </div>
                               </SortableHeader>
                               <SortableHeader field="lastStepTimestamp" className="w-40">
                                 Last Step Timestamp
                               </SortableHeader>
                               <TableHead className="min-w-64">AR Notes</TableHead>
                               <TableHead className="min-w-64">PM Notes</TableHead>
                             </TableRow>
                            </TableHeader>
                           <TableBody>
                               {filteredAndSortedProjects.map((project) => (
                                <TableRow 
                                  key={project.id} 
                                  className={`hover:bg-muted/50 ${
                                    project.taskType === 'next_unassigned' 
                                      ? 'bg-orange-50/50 border-l-4 border-l-orange-400' 
                                      : 'bg-green-50/30 border-l-4 border-l-green-400'
                                  }`}
                                >
                                  <TableCell className="font-medium">
                                    <Link 
                                      to={`/project-mgmt/setup/${project.projectId}`}
                                      className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
                                    >
                                      {project.project}
                                    </Link>
                                  </TableCell>
                                 <TableCell>
                                   <div className="flex items-center gap-2">
                                     <span>{project.taskActiveAssigned}</span>
                                     <Badge variant="outline" className="text-xs">
                                       M{project.milestoneNumber}
                                     </Badge>
                                   </div>
                                 </TableCell>
                                 <TableCell>
                                   <Badge 
                                     variant={project.taskType === 'assigned' ? 'default' : 'secondary'}
                                     className={
                                       project.taskType === 'assigned' 
                                         ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                         : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                     }
                                   >
                                     {project.taskType === 'assigned' ? 'Assigned' : 'Next to Assign'}
                                   </Badge>
                                 </TableCell>
                                 <TableCell>
                                   {project.arAssignedName && project.arAssignedName !== 'Unassigned' && (
                                     <Badge variant="outline">{project.arAssignedName}</Badge>
                                   )}
                                   {project.taskType === 'next_unassigned' && (
                                     <Badge variant="outline" className="text-muted-foreground">
                                       Unassigned
                                     </Badge>
                                   )}
                                 </TableCell>
                                 <TableCell>
                                   {project.taskType === 'assigned' ? (
                                     getStatusBadge(project.currentStatus)
                                   ) : (
                                     <Badge variant="outline" className="text-muted-foreground">
                                       Not Started
                                     </Badge>
                                   )}
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
                                   {project.taskType === 'assigned' ? project.lastStepTimestamp : '-'}
                                 </TableCell>
                                 <TableCell className="text-sm">
                                   {project.taskType === 'assigned' && project.notesAR && (
                                     <div className="max-w-64 p-2 bg-blue-50 rounded text-xs">
                                       {project.notesAR}
                                     </div>
                                   )}
                                   {project.taskType === 'next_unassigned' && (
                                     <div className="text-xs text-muted-foreground/60 italic">
                                       Task not assigned yet
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
                </>
              )}
        </div>
      </main>
    </div>
  );
};

export default ProjectTracking;