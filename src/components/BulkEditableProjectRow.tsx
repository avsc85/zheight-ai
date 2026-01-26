import { useState, useEffect } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Edit, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  health_score?: number;
  tasks?: any[];
}

interface BulkEditChange {
  taskId: string;
  dueDate?: string;
  arId?: string;
}

interface BulkEditableProjectRowProps {
  project: ProjectSummary;
  allUsers: any[];
  getStatusBadge: (status: string) => JSX.Element;
  getTaskStatusBadge: (status: string) => JSX.Element;
  getLatestTask: (project: ProjectSummary) => any;
  navigate: any;
  isGlobalEditMode: boolean;
  pendingChanges: Record<string, BulkEditChange>;
  onPendingChange: (taskId: string, change: Partial<BulkEditChange>) => void;
  onRefresh: () => void;
  updateTaskAR: (taskId: string, arId: string) => Promise<void>;
}

export const BulkEditableProjectRow = ({ 
  project, 
  allUsers, 
  getStatusBadge, 
  getTaskStatusBadge,
  getLatestTask, 
  navigate, 
  isGlobalEditMode,
  pendingChanges,
  onPendingChange,
  onRefresh,
  updateTaskAR
}: BulkEditableProjectRowProps) => {
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingAR, setIsEditingAR] = useState(false);
  const [tempARId, setTempARId] = useState<string | null>(null);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState<string>("");
  const [isSavingSingle, setIsSavingSingle] = useState(false);
  
  const latestTask = getLatestTask(project);
  const currentTask = selectedTaskId 
    ? project.tasks?.find(t => t.task_id === selectedTaskId)
    : latestTask;

  const currentAR = currentTask?.assigned_ar_id 
    ? allUsers.find(u => u.id === currentTask.assigned_ar_id)
    : null;

  // Get pending changes for current task
  const currentPendingChange = currentTask ? pendingChanges[currentTask.task_id] : null;
  const displayDueDate = currentPendingChange?.dueDate ?? currentTask?.due_date;
  const displayARId = currentPendingChange?.arId ?? currentTask?.assigned_ar_id;
  const displayAR = displayARId ? allUsers.find(u => u.id === displayARId) : null;

  // Filter users: exclude PM and Admin roles
  const assignableUsers = allUsers.filter(u => 
    u.role !== 'pm' && u.role !== 'admin'
  );

  // Check if single row has any pending edits (not global mode)
  const hasSingleRowPendingChanges = !isGlobalEditMode && (isEditingDueDate || isEditingAR);
  const hasValidChanges = (isEditingDueDate && tempDueDate) || (isEditingAR && tempARId);

  // Combined save for single row edit
  const handleSaveSingleRow = async () => {
    if (!currentTask?.task_id) return;
    
    // Validate AR requires due date
    const effectiveDueDate = tempDueDate || currentTask.due_date;
    if (tempARId && !effectiveDueDate) {
      toast({
        title: "Validation Error",
        description: `Cannot assign AR without a due date. Please set a due date for "${currentTask.task_name}" first.`,
        variant: "destructive",
      });
      return;
    }

    setIsSavingSingle(true);
    try {
      const updateData: Record<string, any> = {};
      
      if (isEditingDueDate && tempDueDate) {
        updateData.due_date = tempDueDate;
      }
      
      if (isEditingAR && tempARId) {
        updateData.assigned_ar_id = tempARId;
        updateData.assigned_skip_flag = 'Y';
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('project_tasks')
          .update(updateData)
          .eq('task_id', currentTask.task_id);

        if (updateError) throw updateError;

        toast({
          title: "Success",
          description: "Task updated successfully!",
        });

        onRefresh();
      }
      
      // Reset all edit states
      setIsEditingDueDate(false);
      setTempDueDate("");
      setIsEditingAR(false);
      setTempARId(null);
    } catch (error) {
      console.error("Error saving task:", error);
      toast({
        title: "Error",
        description: "Failed to save changes.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSingle(false);
    }
  };

  // Cancel all single row edits
  const handleCancelSingleRowEdit = () => {
    setIsEditingDueDate(false);
    setTempDueDate("");
    setIsEditingAR(false);
    setTempARId(null);
  };

  // Global edit mode handlers
  const handleGlobalDueDateChange = (value: string) => {
    if (currentTask) {
      onPendingChange(currentTask.task_id, { 
        taskId: currentTask.task_id,
        dueDate: value 
      });
    }
  };

  const handleGlobalARChange = (value: string) => {
    if (currentTask) {
      onPendingChange(currentTask.task_id, { 
        taskId: currentTask.task_id,
        arId: value 
      });
    }
  };

  return (
    <TableRow className="hover:bg-accent">
      <TableCell className="font-medium">
        <span 
          className="cursor-pointer hover:text-primary hover:underline transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/project-mgmt/setup/${project.id}`);
          }}
        >
          {project.project_name}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm font-medium">{project.project_manager_name}</span>
      </TableCell>

      <TableCell>{getStatusBadge(project.status)}</TableCell>

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
            setIsEditingDueDate(false);
            setTempDueDate("");
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
            {isGlobalEditMode ? (
              // Global edit mode - direct input
              <Input
                type="date"
                value={displayDueDate || ""}
                onChange={(e) => handleGlobalDueDateChange(e.target.value)}
                className={`h-9 w-40 bg-white ${currentPendingChange?.dueDate ? 'border-primary ring-1 ring-primary' : ''}`}
              />
            ) : isEditingDueDate ? (
              // Single row edit mode - just show input (save button moved to Action column)
              <Input
                type="date"
                value={tempDueDate || currentTask.due_date || ""}
                onChange={(e) => setTempDueDate(e.target.value)}
                className="h-9 w-40 bg-white border-amber-400 ring-1 ring-amber-400"
              />
            ) : (
              // Read mode
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

      {/* AR Assignment */}
      <TableCell>
        {currentTask ? (
          <div className="flex items-center gap-2">
            {isGlobalEditMode ? (
              // Global edit mode - direct select
              <Select
                value={displayARId || ""}
                onValueChange={handleGlobalARChange}
              >
                <SelectTrigger className={`h-9 w-48 bg-white ${currentPendingChange?.arId ? 'border-primary ring-1 ring-primary' : ''}`}>
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
            ) : isEditingAR ? (
              // Single row edit mode - just show select (save button moved to Action column)
              <Select
                value={tempARId || currentTask.assigned_ar_id || ""}
                onValueChange={setTempARId}
              >
                <SelectTrigger className="h-9 w-48 bg-white border-amber-400 ring-1 ring-amber-400">
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
            ) : (
              // Read mode
              <>
                <span className="text-sm font-medium min-w-[120px]">
                  {displayAR ? displayAR.name : "No AR assigned"}
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

      {/* Actions - Single Row Save or View Dashboard */}
      <TableCell>
        <div className="flex items-center gap-2">
          {hasSingleRowPendingChanges ? (
            <>
              <Button 
                size="sm" 
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleSaveSingleRow}
                disabled={isSavingSingle || !hasValidChanges}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleCancelSingleRowEdit}
                disabled={isSavingSingle}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
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
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default BulkEditableProjectRow;
