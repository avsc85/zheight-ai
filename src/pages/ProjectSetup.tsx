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

  const addMilestone = (afterId: number) => {
    const newId = Math.max(...milestones.map(m => m.id)) + 1;
    const insertIndex = milestones.findIndex(m => m.id === afterId) + 1;
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
    
    setMilestones(prev => [
      ...prev.slice(0, insertIndex),
      newMilestone,
      ...prev.slice(insertIndex)
    ]);
  };

  const deleteMilestone = (id: number) => {
    if (milestones.length > 1) {
      setMilestones(prev => prev.filter(milestone => milestone.id !== id));
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
                      <TableBody>
                        {milestones.map((milestone, index) => (
                          <>
                            <TableRow key={milestone.id}>
                              <TableCell className="font-medium">{milestone.id}</TableCell>
                              <TableCell>
                                <Input
                                  value={milestone.taskName}
                                  onChange={(e) => handleMilestoneChange(milestone.id, "taskName", e.target.value)}
                                  className="h-8 border-0 p-0 text-sm"
                                  placeholder="Task name..."
                                />
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
                            {index < milestones.length - 1 && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={10} className="p-0 h-4">
                                  <div className="flex justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addMilestone(milestone.id)}
                                      className="h-6 w-6 p-0 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
                                    >
                                      +
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteMilestone(milestones[index + 1]?.id)}
                                      className="h-6 w-6 p-0 rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                                      disabled={milestones.length <= 1}
                                    >
                                      -
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={10} className="p-2">
                            <div className="flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addMilestone(milestones[milestones.length - 1]?.id || 0)}
                                className="h-8 px-4 text-primary border border-dashed border-primary/30 hover:border-primary/60"
                              >
                                + Add Task
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="flex justify-end gap-4 mt-6">
                    <Button variant="outline">Save Draft</Button>
                    <Button>Create Project</Button>
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