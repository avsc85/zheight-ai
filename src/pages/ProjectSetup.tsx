import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Default task template
const defaultTasks = [
  { id: 1, task_name: "Floor Plan + Site Map", assigned_ar_id: null, assigned_skip_flag: "Y", due_date: "", priority_exception: "Prioritize over everything", hours: 6, notes_tasks: "" },
  { id: 2, task_name: "Proposed Floor Plan", assigned_ar_id: null, assigned_skip_flag: "N", due_date: "", priority_exception: "", hours: 2, notes_tasks: "" },
  { id: 3, task_name: "Elevations", assigned_ar_id: null, assigned_skip_flag: "N", due_date: "", priority_exception: "", hours: 5, notes_tasks: "" },
  { id: 4, task_name: "Finalization PF w/t Customer", assigned_ar_id: null, assigned_skip_flag: "N", due_date: "", priority_exception: "", hours: 6, notes_tasks: "" },
  { id: 5, task_name: "Full Set Completion Planning", assigned_ar_id: null, assigned_skip_flag: "N", due_date: "", priority_exception: "", hours: 6, notes_tasks: "" },
  { id: 6, task_name: "MEP / T-24 / Struc/Finalization", assigned_ar_id: null, assigned_skip_flag: "Skip", due_date: "", priority_exception: "", hours: 1, notes_tasks: "" },
  { id: 7, task_name: "Final Submission Set", assigned_ar_id: null, assigned_skip_flag: "N", due_date: "", priority_exception: "", hours: 2, notes_tasks: "" },
  { id: 8, task_name: "Revision 1", assigned_ar_id: null, assigned_skip_flag: "N", due_date: "", priority_exception: "", hours: 3, notes_tasks: "" },
  { id: 9, task_name: "Revision 2", assigned_ar_id: null, assigned_skip_flag: "N", due_date: "", priority_exception: "", hours: 3, notes_tasks: "" }
];

interface AR {
  id: string;
  name: string;
  role: string;
}

const SortableRow = ({ task, index, handleTaskChange, deleteTask, arUsers }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow ref={setNodeRef} style={style} className="group">
          <TableCell className="font-medium">{index + 1}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                value={task.task_name}
                onChange={(e) => handleTaskChange(task.id, "task_name", e.target.value)}
                className="h-8 border-0 p-0 text-sm flex-1"
                placeholder="Task name..."
              />
            </div>
          </TableCell>
          <TableCell>
            <Select
              value={task.assigned_ar_id || "no_ar_assigned"}
              onValueChange={(value) => handleTaskChange(task.id, "assigned_ar_id", value === "no_ar_assigned" ? null : value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select AR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_ar_assigned">No AR Assigned</SelectItem>
                {arUsers.map((ar: AR) => (
                  <SelectItem key={ar.id} value={ar.id}>{ar.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <Input
              value={task.due_date}
              onChange={(e) => handleTaskChange(task.id, "due_date", e.target.value)}
              className="h-8"
              type="date"
            />
          </TableCell>
          <TableCell>
            <Input
              value={task.priority_exception}
              onChange={(e) => handleTaskChange(task.id, "priority_exception", e.target.value)}
              className="h-8"
              placeholder="Priority notes..."
            />
          </TableCell>
          <TableCell>
            <Input
              value={task.hours}
              onChange={(e) => handleTaskChange(task.id, "hours", parseInt(e.target.value) || 0)}
              className="h-8 w-20"
              placeholder="0"
              type="number"
              min="0"
            />
          </TableCell>
          <TableCell>
            <Input
              value={task.notes_tasks}
              onChange={(e) => handleTaskChange(task.id, "notes_tasks", e.target.value)}
              className="h-8"
              placeholder="Notes..."
            />
          </TableCell>
          <TableCell>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteTask(task.id)}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              ×
            </Button>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem 
          onClick={() => deleteTask(task.id)}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Task
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const ProjectSetup = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("setup");
  const [projectData, setProjectData] = useState({
    project_name: "",
    project_manager_name: "",
    start_date: "",
    expected_end_date: "",
    difficulty_level: null as string | null,
    project_notes: "",
    hours_allocated: 32,
    ar_planning_id: "",
    ar_field_id: ""
  });
  const [tasks, setTasks] = useState(defaultTasks);
  const [arUsers, setArUsers] = useState<AR[]>([]);
  const [allUsers, setAllUsers] = useState<AR[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const { toast } = useToast();
  const { user, loading: authLoading, isPM, isAR2, isAdmin, userRole } = useAuth();
  
  // Wait for both auth and role data to be loaded
  const isLoading = authLoading || !user || !userRole;
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchARUsers();
    fetchAllUsers();
  }, []); // Fetch users only once

  useEffect(() => {
    // Only proceed when authentication and roles are fully loaded
    if (!isLoading) {
      console.log('Auth and roles loaded, checking permissions:', { 
        isPM, 
        isAR2, 
        isAdmin, 
        role: userRole?.role, 
        projectId,
        user: user?.id 
      });
      
      if (projectId && (isPM || isAR2 || isAdmin)) {
        console.log('User has permission, fetching project data');
        setEditMode(true);
        fetchProjectData(projectId);
      } else if (projectId && !isPM && !isAR2 && !isAdmin) {
        console.log('User lacks permission for project access');
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this project.",
          variant: "destructive",
        });
        navigate('/project-mgmt/tracking');
      }
    }
  }, [projectId, isLoading, isPM, isAR2, isAdmin, user?.id]);

  const fetchARUsers = async () => {
    try {
      console.log('Fetching AR users...');
      
      // First get user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['ar1_planning', 'ar2_field']);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }

      console.log('Found user roles:', userRoles);

      if (!userRoles || userRoles.length === 0) {
        console.log('No AR users found in user_roles table');
        setArUsers([]);
        return;
      }

      // Then get profiles for those users
      const userIds = userRoles.map(role => role.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('Found profiles:', profiles);

      // Combine the data
      const formattedUsers: AR[] = userRoles.map(userRole => {
        const profile = profiles?.find(p => p.user_id === userRole.user_id);
        return {
          id: userRole.user_id,
          name: profile?.name || 'Unknown',
          role: userRole.role
        };
      });

      console.log('Formatted AR users:', formattedUsers);
      setArUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching AR users:', error);
      toast({
        title: "Warning",
        description: "Unable to load AR users. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  const fetchAllUsers = async () => {
    try {
      console.log('Fetching all users...');
      
      // Get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }

      if (!userRoles || userRoles.length === 0) {
        console.log('No users found in user_roles table');
        setAllUsers([]);
        return;
      }

      // Get profiles for those users
      const userIds = userRoles.map(role => role.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Combine the data
      const formattedUsers: AR[] = userRoles.map(userRole => {
        const profile = profiles?.find(p => p.user_id === userRole.user_id);
        return {
          id: userRole.user_id,
          name: profile?.name || 'Unknown',
          role: userRole.role
        };
      });

      console.log('Formatted all users:', formattedUsers);
      setAllUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching all users:', error);
      toast({
        title: "Warning",
        description: "Unable to load users. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  const handleProjectDataChange = (field: string, value: string | number) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
  };

  const handleTaskChange = (id: number, field: string, value: any) => {
    console.log('=== TASK CHANGE REQUEST ===');
    console.log('Target ID:', id, 'Field:', field, 'New Value:', value);
    console.log('Current task IDs:', tasks.map(t => ({ id: t.id, name: t.task_name })));
    
    setTasks(prev => {
      const updated = prev.map(task => {
        if (task.id === id) {
          console.log(`✓ UPDATING Task ID ${id}: ${field} from "${task[field]}" to "${value}"`);
          return { ...task, [field]: value };
        }
        return task;
      });
      
      // Validate that only one task was updated for assignment changes
      if (field === 'assigned_ar_id') {
        const changedTasks = updated.filter((task, index) => task[field] !== prev[index][field]);
        console.log('Tasks with changed AR assignment:', changedTasks.map(t => ({ id: t.id, name: t.task_name, newAR: t.assigned_ar_id })));
        
        if (changedTasks.length !== 1) {
          console.error(`ERROR: Expected 1 task to change, but ${changedTasks.length} tasks changed!`);
        }
      }
      
      console.log('Final updated tasks:', updated.map(t => ({ id: t.id, [field]: t[field] })));
      return updated;
    });
  };

  const addTask = () => {
    const newId = Math.max(...tasks.map(t => t.id)) + 1;
    const newTask = {
      id: newId,
      task_name: "New Task",
      assigned_ar_id: null,
      assigned_skip_flag: "N",
      due_date: "",
      priority_exception: "",
      hours: 0,
      notes_tasks: ""
    };
    
    setTasks(prev => [...prev, newTask]);
  };

  const deleteTask = (id: number) => {
    if (tasks.length > 1) {
      setTasks(prev => prev.filter(task => task.id !== id));
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const fetchProjectData = async (id: string) => {
    try {
      setLoading(true);
      console.log('Fetching project data for ID:', id);
      console.log('Current user roles:', { isPM, isAR2, isAdmin, authLoading });
      
      // Ensure auth and roles are loaded before proceeding
      if (isLoading) {
        console.log('Auth or roles still loading, aborting fetch');
        setLoading(false);
        return;
      }

      // Ensure user has basic permissions before fetching
      if (!isPM && !isAR2 && !isAdmin) {
        console.log('User does not have required roles');
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this project.",
          variant: "destructive",
        });
        navigate('/project-mgmt/tracking');
        return;
      }
      
      // Fetch project data
      console.log('Fetching project from database...');
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) {
        console.error('Project fetch error:', projectError);
        throw projectError;
      }

      console.log('Project data fetched:', project);

      // Check if user has permission to edit this specific project
      // PMs can edit ALL projects (updated RLS policy), AR2 can edit assigned projects, Admins can edit all
      const canEdit = isAdmin || isPM || (isAR2 && project.ar_field_id === user?.id);
      
      console.log('Permission check:', { 
        canEdit, 
        isAdmin, 
        isPM, 
        isAR2, 
        projectArFieldId: project.ar_field_id, 
        userId: user?.id,
        note: 'PMs now have access to ALL projects per updated RLS policy'
      });

      if (!canEdit) {
        console.log('Permission denied for this specific project');
        toast({
          title: "Access Denied", 
          description: "You don't have permission to edit this specific project.",
          variant: "destructive",
        });
        navigate('/project-mgmt/tracking');
        return;
      }

      // Set project data
      setProjectData({
        project_name: project.project_name,
        project_manager_name: project.project_manager_name || "",
        start_date: project.start_date || "",
        expected_end_date: project.expected_end_date || "",
        difficulty_level: project.difficulty_level,
        project_notes: project.project_notes || "",
        hours_allocated: project.hours_allocated || 32,
        ar_planning_id: project.ar_planning_id || "",
        ar_field_id: project.ar_field_id || ""
      });

      // Fetch project tasks
      const { data: projectTasks, error: tasksError } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', id)
        .order('milestone_number');

      if (tasksError) throw tasksError;

      // Format tasks for editing with unique IDs
      const formattedTasks = projectTasks.map((task, index) => {
        const uniqueId = typeof task.task_id === 'number' ? task.task_id : (Math.max(...defaultTasks.map(t => t.id)) + index + 1);
        console.log(`Task ${index}: ID=${uniqueId}, Name=${task.task_name}, AR=${task.assigned_ar_id}`);
        return {
          id: uniqueId, // Use database task_id or generate truly unique sequential ID
          task_name: task.task_name,
          assigned_ar_id: task.assigned_ar_id,
          assigned_skip_flag: task.assigned_skip_flag || "N",
          due_date: task.due_date || "",
          priority_exception: task.priority_exception || "",
          hours: task.hours || 0,
          notes_tasks: task.notes_tasks || ""
        };
      });

      // Validate unique IDs
      const taskIds = formattedTasks.map(t => t.id);
      const uniqueIds = [...new Set(taskIds)];
      if (taskIds.length !== uniqueIds.length) {
        console.error('DUPLICATE TASK IDs DETECTED!', { taskIds, uniqueIds });
        toast({
          title: "Warning: Duplicate Task IDs",
          description: "Some tasks have duplicate IDs. Please refresh the page.",
          variant: "destructive",
        });
      } else {
        console.log('All task IDs are unique:', taskIds);
      }

      setTasks(formattedTasks.length > 0 ? formattedTasks : defaultTasks);
      
      console.log('Project data loaded successfully');
      toast({
        title: "Project Loaded",
        description: `Project "${project.project_name}" loaded successfully.`,
      });

    } catch (error: any) {
      console.error('Error fetching project data:', error);
      toast({
        title: "Error",
        description: `Failed to load project data: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      navigate('/project-mgmt/tracking');
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async () => {
    // Save or update project based on edit mode
    console.log('Saving project - User roles:', { isPM, isAR2, isAdmin, userRole: userRole?.role });
    
    if (!user || (!isPM && !isAR2 && !isAdmin)) {
      console.error('Access denied - User roles:', { isPM, isAR2, isAdmin, role: userRole?.role });
      toast({
        title: "Access Denied",
        description: "Only Project Managers, AR2 Field users, and Admins can manage projects.",
        variant: "destructive",
      });
      return;
    }

    // Form validation
    if (!projectData.project_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!projectData.difficulty_level) {
      toast({
        title: "Validation Error",
        description: "Please select a difficulty level.",
        variant: "destructive",
      });
      return;
    }

    // Validate: If AR is assigned (not null), due date is required
    const invalidTasks = tasks
      .map((task, index) => ({ task, taskNumber: index + 1 }))
      .filter(({ task }) => task.assigned_ar_id && !task.due_date);
    
    if (invalidTasks.length > 0) {
      // Get AR names for the invalid tasks
      const taskDetails = invalidTasks.map(({ task, taskNumber }) => {
        const arUser = arUsers.find(ar => ar.id === task.assigned_ar_id);
        return `Task #${taskNumber} (${task.task_name}) - AR: ${arUser?.name || 'Unknown'}`;
      }).join('\n');
      
      toast({
        title: "Validation Error",
        description: `${invalidTasks.length} task(s) with AR assigned are missing due dates:\n\n${taskDetails}`,
        variant: "destructive",
        position: "left",
      });
      return;
    }

    setLoading(true);
    try {
      if (editMode && projectId) {
        // Update existing project
        const { error: projectError } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', projectId);

        if (projectError) throw projectError;

        // Delete existing tasks
        const { error: deleteError } = await supabase
          .from('project_tasks')
          .delete()
          .eq('project_id', projectId);

        if (deleteError) throw deleteError;

        // Insert updated tasks with auto-assignment logic
        const tasksToInsert = tasks.map((task, index) => ({
          project_id: projectId,
          milestone_number: index + 1,
          task_name: task.task_name,
          assigned_ar_id: task.assigned_ar_id,
          // Auto-set assigned_skip_flag: 'Y' if AR assigned, 'N' if not assigned
          assigned_skip_flag: task.assigned_ar_id ? 'Y' : 'N',
          due_date: task.due_date || null,
          priority_exception: task.priority_exception,
          hours: task.hours,
          notes_tasks: task.notes_tasks,
          task_status: 'in_queue'
        }));

        const { error: tasksError } = await supabase
          .from('project_tasks')
          .insert(tasksToInsert);

        if (tasksError) throw tasksError;

        // Email notifications are sent automatically via database trigger
        toast({
          title: "Success",
          description: "Project updated successfully!",
        });

      } else {
        // Create new project
        console.log('Inserting project with data:', { ...projectData, user_id: user.id });
        
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert({
            ...projectData,
            user_id: user.id
          })
          .select()
          .single();

        if (projectError) {
          console.error('Project creation error:', projectError);
          throw projectError;
        }

        console.log('Project created successfully:', project);

        // Insert tasks with auto-assignment logic
        const tasksToInsert = tasks.map((task, index) => ({
          project_id: project.id,
          milestone_number: index + 1,
          task_name: task.task_name,
          assigned_ar_id: task.assigned_ar_id,
          // Auto-set assigned_skip_flag: 'Y' if AR assigned, 'N' if not assigned
          assigned_skip_flag: task.assigned_ar_id ? 'Y' : 'N',
          due_date: task.due_date || null,
          priority_exception: task.priority_exception,
          hours: task.hours,
          notes_tasks: task.notes_tasks,
          task_status: 'in_queue'
        }));

        const { error: tasksError } = await supabase
          .from('project_tasks')
          .insert(tasksToInsert);

        if (tasksError) throw tasksError;

        // Email notifications are sent automatically via database trigger
        toast({
          title: "Success",
          description: "Project created successfully!",
        });

        // Reset form
        setProjectData({
          project_name: "",
          project_manager_name: "",
          start_date: "",
          expected_end_date: "",
          difficulty_level: null,
          project_notes: "",
          hours_allocated: 32,
          ar_planning_id: "",
          ar_field_id: ""
        });
        setTasks(defaultTasks);
      }

    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: "Error",
        description: `Failed to ${editMode ? 'update' : 'create'} project. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Show loading state while roles are loading or project data is being fetched */}
          {isLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">
                      Checking permissions and loading data...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Please wait while we verify your access and load project information.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show permission denied state when roles are loaded but user lacks access */}
          {!isLoading && !isPM && !isAR2 && !isAdmin && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
                  <p className="text-muted-foreground">
                    You don't have permission to access project setup.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Required role: PM, AR2, or Admin | Your role: {userRole?.role || 'Unknown'}
                  </p>
                  <Button 
                    onClick={() => navigate('/project-mgmt/tracking')} 
                    className="mt-4"
                  >
                    Return to Project Tracking
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Show main content only when roles are loaded and user has permission */}
          {!isLoading && (isPM || isAR2 || isAdmin) && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="setup" className="text-sm font-medium">
                  Project Setup
                </TabsTrigger>
                <TabsTrigger value="tracking" className="text-sm font-medium">
                  Project Tracking
                </TabsTrigger>
              </TabsList>
            
            <TabsContent value="setup" className="space-y-8">
              {/* Project Details Form */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editMode ? `Edit Project: ${projectData.project_name}` : 'Project Information'}
                  </CardTitle>
                  {editMode && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/project-mgmt/tracking')}
                      >
                        Back to Tracking
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="projectName">Project Name</Label>
                      <Input
                        id="projectName"
                        value={projectData.project_name}
                        onChange={(e) => handleProjectDataChange("project_name", e.target.value)}
                        placeholder="Enter project name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="projectManagerName">Project Manager</Label>
                      <Select
                        value={projectData.project_manager_name || "no_pm_assigned"}
                        onValueChange={(value) => handleProjectDataChange("project_manager_name", value === "no_pm_assigned" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select project manager" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_pm_assigned">No PM Assigned</SelectItem>
                          {allUsers.map((user) => (
                            <SelectItem key={user.id} value={user.name}>
                              {user.name} ({user.role.replace('_', ' ')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={projectData.start_date}
                        onChange={(e) => handleProjectDataChange("start_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Expected End date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={projectData.expected_end_date}
                        onChange={(e) => handleProjectDataChange("expected_end_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="difficultyLevel">Difficulty Level</Label>
                      <Select value={projectData.difficulty_level || ""} onValueChange={(value) => handleProjectDataChange("difficulty_level", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="High / Medium / Low" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hoursAllocated">Hours Allocated</Label>
                      <Input
                        id="hoursAllocated"
                        type="number"
                        value={projectData.hours_allocated}
                        onChange={(e) => handleProjectDataChange("hours_allocated", parseInt(e.target.value) || 32)}
                        placeholder="32"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Project Notes</Label>
                      <Textarea
                        id="notes"
                        value={projectData.project_notes}
                        onChange={(e) => handleProjectDataChange("project_notes", e.target.value)}
                        placeholder="Project notes..."
                        className="min-h-20"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="ar1Planning">AR1 Planning</Label>
                      <Select value={projectData.ar_planning_id} onValueChange={(value) => handleProjectDataChange("ar_planning_id", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AR1 Planning" />
                        </SelectTrigger>
                        <SelectContent>
                          {arUsers.filter(ar => ar.role === 'ar1_planning').map(ar => (
                            <SelectItem key={ar.id} value={ar.id}>{ar.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ar2Field">AR2 Field</Label>
                      <Select value={projectData.ar_field_id} onValueChange={(value) => handleProjectDataChange("ar_field_id", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AR2 Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {arUsers.filter(ar => ar.role === 'ar2_field').map(ar => (
                            <SelectItem key={ar.id} value={ar.id}>{ar.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Milestone and Tasks Setup */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Milestone and Tasks Setup</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead className="min-w-48">Task Name</TableHead>
                            <TableHead className="w-32">AR Assigned</TableHead>
                            <TableHead className="w-32">Due Date</TableHead>
                            <TableHead className="min-w-36">Priority</TableHead>
                            <TableHead className="w-24">Hours</TableHead>
                            <TableHead className="min-w-32">Notes</TableHead>
                            <TableHead className="w-16">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <SortableContext 
                          items={tasks.map(t => t.id)} 
                          strategy={verticalListSortingStrategy}
                        >
                          <TableBody>
                            {tasks.map((task, index) => (
                              <SortableRow
                                key={task.id}
                                task={task}
                                index={index}
                                handleTaskChange={handleTaskChange}
                                deleteTask={deleteTask}
                                arUsers={arUsers}
                              />
                            ))}
                          </TableBody>
                        </SortableContext>
                      </Table>
                    </DndContext>
                  </div>
                  
                  <div className="flex justify-between items-center mt-6">
                    <Button
                      variant="ghost"
                      onClick={addTask}
                      className="text-primary border border-dashed border-primary/30 hover:border-primary/60"
                    >
                      + Add Task
                    </Button>
                    <div className="flex gap-4">
                      <Button variant="outline" disabled={loading}>Save Draft</Button>
                      <Button onClick={saveProject} disabled={loading}>
                        {loading ? (editMode ? "Updating..." : "Creating...") : (editMode ? "Update Project" : "Create Project")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="tracking" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Tracking View</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    This section will show the tracking interface once projects are created.
                    Switch to the Project Tracking page for the full tracking dashboard.
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/project-mgmt/tracking'}
                    className="mt-4"
                  >
                    Go to Project Tracking
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectSetup;