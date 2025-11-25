import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, BarChart3, KanbanSquare } from "lucide-react";

const ProjectManagement = () => {
  const { isAuthenticated, loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Role-based routing logic will be added here later
  const userRole = profile?.role || 'user'; // This will be enhanced with proper role management

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Project Management Dashboard
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Manage architectural design projects with efficient task assignment, milestone tracking, and deadline management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KanbanSquare className="h-5 w-5 text-primary" />
                  AR Board
                </CardTitle>
                <CardDescription>
                  Kanban-style dashboard for task management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/project-mgmt/board')}
                  className="w-full"
                >
                  View Tasks Board
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Project Setup
                </CardTitle>
                <CardDescription>
                  Create and configure new projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/project-mgmt/setup')}
                  variant="outline"
                  className="w-full"
                >
                  Setup Projects
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Project Tracking
                </CardTitle>
                <CardDescription>
                  Monitor project progress and deadlines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/project-mgmt/tracking')}
                  variant="outline"
                  className="w-full"
                >
                  Track Progress
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats Section - Will be enhanced later with real data */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">12</div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-500">8</div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">24</div>
                <p className="text-sm text-muted-foreground">Completed This Week</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-500">3</div>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectManagement;