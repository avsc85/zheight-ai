import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { 
  Filter, 
  X, 
  CalendarIcon,
  Check
} from "lucide-react";
import { format, isToday, isYesterday, startOfDay, endOfDay, parseISO } from "date-fns";

export interface TaskFilters {
  createdDateFilter: 'all' | 'today' | 'yesterday' | 'custom';
  customDateFrom?: Date;
  customDateTo?: Date;
  status: string[];
  assignedAR: string;
  projectId: string;
  unassignedOnly: boolean;
}

interface TaskFilterPanelProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  allUsers: { id: string; name: string; role: string }[];
  projects: { id: string; project_name: string }[];
}

const defaultFilters: TaskFilters = {
  createdDateFilter: 'all',
  customDateFrom: undefined,
  customDateTo: undefined,
  status: [],
  assignedAR: '',
  projectId: '',
  unassignedOnly: false,
};

const statusOptions = [
  { value: 'in_queue', label: 'Pending' },
  { value: 'started', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

export const TaskFilterPanel = ({ 
  filters, 
  onFiltersChange, 
  allUsers, 
  projects 
}: TaskFilterPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState<'from' | 'to' | null>(null);

  const assignableUsers = allUsers.filter(u => 
    u.role !== 'pm' && u.role !== 'admin'
  );

  const activeFilterCount = [
    filters.createdDateFilter !== 'all',
    filters.status.length > 0,
    filters.assignedAR !== '',
    filters.projectId !== '',
    filters.unassignedOnly,
  ].filter(Boolean).length;

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatuses });
  };

  const clearFilters = () => {
    onFiltersChange(defaultFilters);
  };

  const removeFilter = (filterKey: keyof TaskFilters, value?: string) => {
    switch (filterKey) {
      case 'createdDateFilter':
        onFiltersChange({ 
          ...filters, 
          createdDateFilter: 'all', 
          customDateFrom: undefined, 
          customDateTo: undefined 
        });
        break;
      case 'status':
        if (value) {
          onFiltersChange({ 
            ...filters, 
            status: filters.status.filter(s => s !== value) 
          });
        }
        break;
      case 'assignedAR':
        onFiltersChange({ ...filters, assignedAR: '' });
        break;
      case 'projectId':
        onFiltersChange({ ...filters, projectId: '' });
        break;
      case 'unassignedOnly':
        onFiltersChange({ ...filters, unassignedOnly: false });
        break;
    }
  };

  const getDateFilterLabel = () => {
    switch (filters.createdDateFilter) {
      case 'today':
        return 'Created Today';
      case 'yesterday':
        return 'Created Yesterday';
      case 'custom':
        if (filters.customDateFrom && filters.customDateTo) {
          return `${format(filters.customDateFrom, 'MMM d')} - ${format(filters.customDateTo, 'MMM d')}`;
        } else if (filters.customDateFrom) {
          return `From ${format(filters.customDateFrom, 'MMM d')}`;
        } else if (filters.customDateTo) {
          return `Until ${format(filters.customDateTo, 'MMM d')}`;
        }
        return 'Custom Date';
      default:
        return '';
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filter Tasks</h4>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>

            {/* Created Date Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Created Date</Label>
              <Select
                value={filters.createdDateFilter}
                onValueChange={(value: TaskFilters['createdDateFilter']) => 
                  onFiltersChange({ 
                    ...filters, 
                    createdDateFilter: value,
                    customDateFrom: value !== 'custom' ? undefined : filters.customDateFrom,
                    customDateTo: value !== 'custom' ? undefined : filters.customDateTo,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Pickers */}
              {filters.createdDateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Popover open={datePickerOpen === 'from'} onOpenChange={(open) => setDatePickerOpen(open ? 'from' : null)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.customDateFrom ? format(filters.customDateFrom, 'MMM d') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.customDateFrom}
                        onSelect={(date) => {
                          onFiltersChange({ ...filters, customDateFrom: date });
                          setDatePickerOpen(null);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover open={datePickerOpen === 'to'} onOpenChange={(open) => setDatePickerOpen(open ? 'to' : null)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.customDateTo ? format(filters.customDateTo, 'MMM d') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.customDateTo}
                        onSelect={(date) => {
                          onFiltersChange({ ...filters, customDateTo: date });
                          setDatePickerOpen(null);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={filters.status.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusToggle(option.value)}
                    className="gap-1"
                  >
                    {filters.status.includes(option.value) && <Check className="h-3 w-3" />}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Assigned AR Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assigned AR</Label>
              <Select
                value={filters.assignedAR}
                onValueChange={(value) => onFiltersChange({ ...filters, assignedAR: value, unassignedOnly: false })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All ARs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All ARs</SelectItem>
                  {assignableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Project</Label>
              <Select
                value={filters.projectId}
                onValueChange={(value) => onFiltersChange({ ...filters, projectId: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unassigned Only */}
            <div className="flex items-center gap-2">
              <Button
                variant={filters.unassignedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ 
                  ...filters, 
                  unassignedOnly: !filters.unassignedOnly,
                  assignedAR: !filters.unassignedOnly ? '' : filters.assignedAR
                })}
                className="gap-1"
              >
                {filters.unassignedOnly && <Check className="h-3 w-3" />}
                Unassigned Tasks Only
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Badges */}
      {filters.createdDateFilter !== 'all' && (
        <Badge variant="secondary" className="gap-1">
          {getDateFilterLabel()}
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => removeFilter('createdDateFilter')}
          />
        </Badge>
      )}

      {filters.status.map(status => {
        const option = statusOptions.find(o => o.value === status);
        return (
          <Badge key={status} variant="secondary" className="gap-1">
            {option?.label || status}
            <X 
              className="h-3 w-3 cursor-pointer hover:text-destructive" 
              onClick={() => removeFilter('status', status)}
            />
          </Badge>
        );
      })}

      {filters.assignedAR && (
        <Badge variant="secondary" className="gap-1">
          AR: {assignableUsers.find(u => u.id === filters.assignedAR)?.name || 'Unknown'}
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => removeFilter('assignedAR')}
          />
        </Badge>
      )}

      {filters.projectId && (
        <Badge variant="secondary" className="gap-1">
          {projects.find(p => p.id === filters.projectId)?.project_name || 'Unknown Project'}
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => removeFilter('projectId')}
          />
        </Badge>
      )}

      {filters.unassignedOnly && (
        <Badge variant="secondary" className="gap-1">
          Unassigned Only
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => removeFilter('unassignedOnly')}
          />
        </Badge>
      )}
    </div>
  );
};

// Helper function to apply filters to tasks
export const applyTaskFilters = (tasks: any[], filters: TaskFilters): any[] => {
  return tasks.filter(task => {
    // Created Date Filter
    if (filters.createdDateFilter !== 'all' && task.created_at) {
      const taskDate = parseISO(task.created_at);
      
      if (filters.createdDateFilter === 'today' && !isToday(taskDate)) {
        return false;
      }
      if (filters.createdDateFilter === 'yesterday' && !isYesterday(taskDate)) {
        return false;
      }
      if (filters.createdDateFilter === 'custom') {
        if (filters.customDateFrom && taskDate < startOfDay(filters.customDateFrom)) {
          return false;
        }
        if (filters.customDateTo && taskDate > endOfDay(filters.customDateTo)) {
          return false;
        }
      }
    }

    // Status Filter
    if (filters.status.length > 0) {
      const taskStatus = task.task_status || 'in_queue';
      // Check for overdue status
      if (filters.status.includes('overdue')) {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && taskStatus !== 'completed';
        if (isOverdue) {
          // Task is overdue, include it
        } else if (!filters.status.includes(taskStatus)) {
          return false;
        }
      } else if (!filters.status.includes(taskStatus)) {
        return false;
      }
    }

    // Assigned AR Filter
    if (filters.assignedAR && task.assigned_ar_id !== filters.assignedAR) {
      return false;
    }

    // Project Filter
    if (filters.projectId && task.project_id !== filters.projectId) {
      return false;
    }

    // Unassigned Only Filter
    if (filters.unassignedOnly && task.assigned_ar_id) {
      return false;
    }

    return true;
  });
};

export const defaultTaskFilters = defaultFilters;
