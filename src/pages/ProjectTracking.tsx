import { useState } from "react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, Download, RefreshCw } from "lucide-react";

// Mock data based on the wireframe
const mockProjects = [
  {
    id: 1,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Floor Plan + Site Map",
    arAssigned: "Sahad",
    currentStatus: "Started",
    dueDate: "Sept 7th",
    priorityException: "Prioritize over everything",
    lastStepTimestamp: "11:30 AM, 04/06",
    notes: "90% Might walkin here 'The AIA' Self Know ---"
  },
  {
    id: 2,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Proposed Floor Plan",
    arAssigned: "",
    currentStatus: "In Que",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "",
    notes: ""
  },
  {
    id: 3,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Elevations",
    arAssigned: "",
    currentStatus: "In Que",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "",
    notes: ""
  },
  {
    id: 4,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Finalization PF w/t Customer",
    arAssigned: "Sha",
    currentStatus: "Completed",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "11:30 AM, 09/06",
    notes: ""
  },
  {
    id: 5,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Full Set Completion Planning",
    arAssigned: "",
    currentStatus: "Blocked",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "",
    notes: ""
  },
  {
    id: 6,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "MEP / T-24 / Struc/Finalization",
    arAssigned: "",
    currentStatus: "In Que",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "",
    notes: ""
  },
  {
    id: 7,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Final Submission Set",
    arAssigned: "",
    currentStatus: "In Que",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "",
    notes: ""
  },
  {
    id: 8,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Revision 1",
    arAssigned: "",
    currentStatus: "In Que",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "",
    notes: ""
  },
  {
    id: 9,
    project: "231 Club Dr, San Jose",
    taskActiveAssigned: "Revision 2",
    arAssigned: "",
    currentStatus: "In Que",
    dueDate: "",
    priorityException: "",
    lastStepTimestamp: "",
    notes: ""
  }
];

const getStatusBadge = (status: string) => {
  const variants: Record<string, string> = {
    "Started": "bg-blue-100 text-blue-800",
    "In Que": "bg-gray-100 text-gray-800", 
    "Completed": "bg-green-100 text-green-800",
    "Blocked": "bg-red-100 text-red-800"
  };
  
  return (
    <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
      {status}
    </Badge>
  );
};

const ProjectTracking = () => {
  const [filterTerm, setFilterTerm] = useState("");
  const [activeTab, setActiveTab] = useState("setup");
  
  const filteredProjects = mockProjects.filter(project =>
    project.project.toLowerCase().includes(filterTerm.toLowerCase()) ||
    project.taskActiveAssigned.toLowerCase().includes(filterTerm.toLowerCase()) ||
    project.arAssigned.toLowerCase().includes(filterTerm.toLowerCase())
  );

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
                  <Button variant="outline" size="sm">
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
                          <TableHead className="min-w-64">Notes</TableHead>
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
                              {project.arAssigned && (
                                <Badge variant="outline">{project.arAssigned}</Badge>
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
                              {project.notes && (
                                <div className="max-w-64 truncate" title={project.notes}>
                                  {project.notes}
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
                      {filteredProjects.filter(p => p.currentStatus === "Started").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Started Tasks</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-gray-600">
                      {filteredProjects.filter(p => p.currentStatus === "In Que").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Queued Tasks</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {filteredProjects.filter(p => p.currentStatus === "Completed").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Completed Tasks</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {filteredProjects.filter(p => p.currentStatus === "Blocked").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Blocked Tasks</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ProjectTracking;