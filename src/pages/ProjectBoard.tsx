import { useState } from "react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, MapPin, AlertTriangle } from "lucide-react";

// Mock data based on the wireframe
const mockTasks = [
  {
    id: 1,
    project: "231 Club Dr, San Jose",
    task: "Floor Plan + Site Map",
    deadline: "Sept 7th 130 PM IST",
    priority: "Prioritize over everything",
    notes: "",
    status: "in_queue",
    timeAllocated: 0,
    progress: 0
  },
  {
    id: 2,
    project: "ABC, XYZ",
    task: "Proposed Floor Plan",
    deadline: "Sept 8th 430 PM IST",
    priority: "",
    notes: "",
    status: "in_queue",
    timeAllocated: 0,
    progress: 0
  },
  {
    id: 3,
    project: "981 Circle Dr, Palo Alto",
    task: "Floor Plan + Site Map",
    deadline: "Sept 5th 130 PM IST",
    priority: "Prioritize over everything",
    notes: "",
    status: "started",
    timeAllocated: 0,
    progress: 65
  },
  {
    id: 4,
    project: "ABC, XYZ",
    task: "Proposed Floor Plan",
    deadline: "Sept 8th 430 PM IST",
    priority: "",
    notes: "",
    status: "started",
    timeAllocated: 0,
    progress: 40
  },
  {
    id: 5,
    project: "def, wer",
    task: "Floor Plan + Site Map",
    deadline: "Sept 7th 130 PM IST",
    priority: "Prioritize over everything",
    notes: "Notes:",
    status: "completed",
    timeAllocated: 8,
    progress: 100
  },
  {
    id: 6,
    project: "ABC, XYZ",
    task: "Proposed Floor Plan",
    deadline: "Sept 8th 430 PM IST",
    priority: "",
    notes: "",
    status: "completed",
    timeAllocated: 19,
    progress: 100
  },
  {
    id: 7,
    project: "281 Leo Dr, Fremont",
    task: "Floor Plan + Site Map",
    deadline: "Sept 7th 130 PM IST",
    priority: "Prioritize over everything",
    notes: "measurement for kitchen pending",
    status: "blocked",
    timeAllocated: 0,
    progress: 20
  },
  {
    id: 8,
    project: "ABC, XYZ",
    task: "Proposed Floor Plan",
    deadline: "Sept 8th 430 PM IST",
    priority: "",
    notes: "Roof Height and pitch not available",
    status: "blocked",
    timeAllocated: 0,
    progress: 10
  }
];

const TaskCard = ({ task }: { task: any }) => {
  const getPriorityBadge = () => {
    if (task.priority) {
      return <Badge variant="destructive" className="mb-2 text-xs">{task.priority}</Badge>;
    }
    return null;
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'started': return 'border-l-blue-500';
      case 'completed': return 'border-l-green-500';
      case 'blocked': return 'border-l-red-500';
      default: return 'border-l-gray-300';
    }
  };

  return (
    <Card className={`mb-4 border-l-4 ${getStatusColor()} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        {getPriorityBadge()}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">{task.project}</p>
              <p className="text-sm text-muted-foreground">{task.task}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{task.deadline}</p>
          </div>
          
          
          {task.timeAllocated > 0 && (
            <p className="text-xs text-primary font-medium">
              Total Time taken: {task.timeAllocated} Hours
            </p>
          )}
          
          {task.notes && (
            <p className="text-xs text-muted-foreground italic">{task.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ProjectBoard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredTasks = mockTasks.filter(task =>
    task.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.task.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = {
    in_queue: { title: "In Que", color: "bg-gray-50" },
    started: { title: "Started", color: "bg-blue-50" },
    completed: { title: "Completed this week", color: "bg-green-50" },
    blocked: { title: "Blocked", color: "bg-red-50" }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-4">AR Board</h1>
            <div className="max-w-md">
              <Input
                placeholder="Find Board"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(columns).map(([status, config]) => (
              <div key={status} className="space-y-4">
                <Card className={`${config.color}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-center">
                      {config.title}
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <div className="min-h-96">
                  {filteredTasks
                    .filter(task => task.status === status)
                    .map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectBoard;