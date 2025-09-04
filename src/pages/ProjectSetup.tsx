import { useState } from "react";
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

// Mock data for milestones based on wireframe
const defaultMilestones = [
  { id: 1, taskName: "Floor Plan + Site Map", arAssigned: "Sahad", assignedSkip: "Y", dueDate: "Sept 7th", priorityException: "Prioritize over everything", hours: "=32*18%", timePercentage: "18", notes: "" },
  { id: 2, taskName: "Proposed Floor Plan", arAssigned: "", assignedSkip: "N", dueDate: "", priorityException: "", hours: "=32*6%", timePercentage: "6", notes: "" },
  { id: 3, taskName: "Elevations", arAssigned: "", assignedSkip: "N", dueDate: "", priorityException: "", hours: "=32*14%", timePercentage: "14", notes: "" },
  { id: 4, taskName: "Finalization PF w/t Customer", arAssigned: "Sha", assignedSkip: "N", dueDate: "", priorityException: "", hours: "=32*18%", timePercentage: "18", notes: "" },
  { id: 5, taskName: "Full Set Completion Planning", arAssigned: "", assignedSkip: "N", dueDate: "", priorityException: "", hours: "=32*18%", timePercentage: "18", notes: "" },
  { id: 6, taskName: "MEP / T-24 / Struc/Finalization", arAssigned: "", assignedSkip: "Skip", dueDate: "", priorityException: "", hours: "=32*4%", timePercentage: "4", notes: "" },
  { id: 7, taskName: "Final Submission Set", arAssigned: "", assignedSkip: "N", dueDate: "", priorityException: "", hours: "=32*6%", timePercentage: "6", notes: "" },
  { id: 8, taskName: "Revision 1", arAssigned: "", assignedSkip: "N", dueDate: "", priorityException: "", hours: "=32*8%", timePercentage: "8", notes: "" },
  { id: 9, taskName: "Revision 2", arAssigned: "", assignedSkip: "N", dueDate: "", priorityException: "", hours: "=32*8%", timePercentage: "8", notes: "" }
];

const SortableRow = ({ milestone, index, handleMilestoneChange, deleteMilestone }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: milestone.id });

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
                value={milestone.taskName}
                onChange={(e) => handleMilestoneChange(milestone.id, "taskName", e.target.value)}
                className="h-8 border-0 p-0 text-sm flex-1"
                placeholder="Task name..."
              />
            </div>
          </TableCell>
          <TableCell>
            <Select
              value={milestone.arAssigned}
              onValueChange={(value) => handleMilestoneChange(milestone.id, "arAssigned", value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sahad">Sahad</SelectItem>
                <SelectItem value="sha">Sha</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <Select
              value={milestone.assignedSkip}
              onValueChange={(value) => handleMilestoneChange(milestone.id, "assignedSkip", value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Y">Y</SelectItem>
                <SelectItem value="N">N</SelectItem>
                <SelectItem value="Skip">Skip</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <Input
              value={milestone.dueDate}
              onChange={(e) => handleMilestoneChange(milestone.id, "dueDate", e.target.value)}
              className="h-8"
              placeholder="Sept 7th"
            />
          </TableCell>
          <TableCell>
            <Input
              value={milestone.priorityException}
              onChange={(e) => handleMilestoneChange(milestone.id, "priorityException", e.target.value)}
              className="h-8"
              placeholder="Priority notes..."
            />
          </TableCell>
          <TableCell>
            <Input
              value={milestone.timePercentage}
              onChange={(e) => handleMilestoneChange(milestone.id, "timePercentage", e.target.value)}
              className="h-8 w-16"
              placeholder="0"
              type="number"
            />
          </TableCell>
          <TableCell>
            <Badge variant="secondary" className="text-xs">
              {milestone.hours}
            </Badge>
          </TableCell>
          <TableCell>
            <Input
              value={milestone.notes}
              onChange={(e) => handleMilestoneChange(milestone.id, "notes", e.target.value)}
              className="h-8"
              placeholder="Notes..."
            />
          </TableCell>
          <TableCell>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMilestone(milestone.id)}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              ×
            </Button>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem 
          onClick={() => deleteMilestone(milestone.id)}
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
  const [activeTab, setActiveTab] = useState("setup");
  const [projectData, setProjectData] = useState({
    projectName: "",
    startDate: "",
    endDate: "",
    difficultyLevel: "",
    notes: "",
    hoursAllocated: "32",
    ar1Planning: "",
    ar2Field: ""
  });
  const [milestones, setMilestones] = useState(defaultMilestones);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleProjectDataChange = (field: string, value: string) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
  };

  const handleMilestoneChange = (id: number, field: string, value: string) => {
    setMilestones(prev => 
      prev.map(milestone => 
        milestone.id === id ? { ...milestone, [field]: value } : milestone
      )
    );
  };

  const addMilestone = () => {
    const newId = Math.max(...milestones.map(m => m.id)) + 1;
    const newMilestone = {
      id: newId,
      taskName: "New Task",
      arAssigned: "",
      assignedSkip: "N",
      dueDate: "",
      priorityException: "",
      hours: "=32*0%",
      timePercentage: "0",
      notes: ""
    };
    
    setMilestones(prev => [...prev, newMilestone]);
  };

  const deleteMilestone = (id: number) => {
    if (milestones.length > 1) {
      setMilestones(prev => prev.filter(milestone => milestone.id !== id));
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setMilestones((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const arOptions = ["Sahad", "Sha", "Skip", "N"];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
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
                  <CardTitle>Project Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="projectName">Project Name</Label>
                      <Input
                        id="projectName"
                        value={projectData.projectName}
                        onChange={(e) => handleProjectDataChange("projectName", e.target.value)}
                        placeholder="Enter project name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={projectData.startDate}
                        onChange={(e) => handleProjectDataChange("startDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Exp. End date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={projectData.endDate}
                        onChange={(e) => handleProjectDataChange("endDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="difficultyLevel">Difficulty Level</Label>
                      <Select value={projectData.difficultyLevel} onValueChange={(value) => handleProjectDataChange("difficultyLevel", value)}>
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
                        value={projectData.hoursAllocated}
                        onChange={(e) => handleProjectDataChange("hoursAllocated", e.target.value)}
                        placeholder="32"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={projectData.notes}
                        onChange={(e) => handleProjectDataChange("notes", e.target.value)}
                        placeholder="Project notes..."
                        className="min-h-20"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="ar1Planning">AR1 Planning</Label>
                      <Select value={projectData.ar1Planning} onValueChange={(value) => handleProjectDataChange("ar1Planning", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Drop down of Planning AR names" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sahad">Sahad</SelectItem>
                          <SelectItem value="sha">Sha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ar2Field">AR2 Field</Label>
                      <Select value={projectData.ar2Field} onValueChange={(value) => handleProjectDataChange("ar2Field", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Drop down of Field AR names" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sahad">Sahad</SelectItem>
                          <SelectItem value="sha">Sha</SelectItem>
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
                            <TableHead className="w-16">Milestone #</TableHead>
                            <TableHead className="min-w-48">Task Name</TableHead>
                            <TableHead className="w-32">AR Assigned</TableHead>
                            <TableHead className="w-32">Assigned/Skip</TableHead>
                            <TableHead className="w-32">Due Date</TableHead>
                            <TableHead className="min-w-48">Priority Exception</TableHead>
                            <TableHead className="w-24">% Time</TableHead>
                            <TableHead className="w-24">Hours</TableHead>
                            <TableHead className="min-w-32">Notes</TableHead>
                            <TableHead className="w-16">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <SortableContext 
                          items={milestones.map(m => m.id)} 
                          strategy={verticalListSortingStrategy}
                        >
                          <TableBody>
                            {milestones.map((milestone, index) => (
                              <SortableRow
                                key={milestone.id}
                                milestone={milestone}
                                index={index}
                                handleMilestoneChange={handleMilestoneChange}
                                deleteMilestone={deleteMilestone}
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
                      onClick={addMilestone}
                      className="text-primary border border-dashed border-primary/30 hover:border-primary/60"
                    >
                      + Add Task
                    </Button>
                    <div className="flex gap-4">
                      <Button variant="outline">Save Draft</Button>
                      <Button>Create Project</Button>
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
        </div>
      </main>
    </div>
  );
};

export default ProjectSetup;