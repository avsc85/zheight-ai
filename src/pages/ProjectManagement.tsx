import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, KanbanSquare, ArrowRight, Activity, Users } from "lucide-react";

const ProjectManagement = () => {
  const { isAuthenticated, loading, profile } = useAuth();
  const { isPM, isAdmin } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Project Management
            </h2>
            <p className="text-muted-foreground">
              Manage architectural design projects with efficient task assignment and tracking
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">12</div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-status-queue">8</div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-status-done">24</div>
                <p className="text-sm text-muted-foreground">Completed This Week</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-status-blocked">3</div>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </CardContent>
            </Card>
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
              <CardHeader className="pb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <KanbanSquare className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg text-foreground">AR Board</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Kanban-style dashboard for task management
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate('/project-mgmt/board')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  View Tasks Board
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
              <CardHeader className="pb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg text-foreground">Project Setup</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Create and configure new projects
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate('/project-mgmt/setup')}
                  variant="outline"
                  className="w-full border-primary/30 hover:bg-primary/5"
                >
                  Setup Projects
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
              <CardHeader className="pb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg text-foreground">Project Tracking</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Monitor project progress and deadlines
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate('/project-mgmt/tracking')}
                  variant="outline"
                  className="w-full border-primary/30 hover:bg-primary/5"
                >
                  Track Progress
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* New Team Activity Dashboard Card */}
            {(isPM || isAdmin) && (
              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-blue-500/30">
                <CardHeader className="pb-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <CardTitle className="text-lg text-foreground">Team Activity</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Real-time view of AR work and task status
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    onClick={() => navigate('/project-mgmt/team-activity')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    View Activity
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectManagement;
