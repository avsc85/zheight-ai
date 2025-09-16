import { Building2, Bot, User, LogOut, Users, FolderKanban } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "react-router-dom";

export const Header = () => {
  const { user, profile, signOut, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path === '/project-mgmt' && location.pathname.startsWith('/project-mgmt')) return true;
    if (path === '/ai-plan-checker' && location.pathname === '/ai-plan-checker') return true;
    if (path === '/ai-feasibility' && location.pathname === '/ai-feasibility') return true;
    return false;
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-primary">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">zHeight Internal AI Applications</h1>
                <p className="text-sm text-muted-foreground">Building Code Compliance & Project Management</p>
              </div>
            </Link>
            
            {/* Navigation Tabs */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-2">
                <Link to="/">
                  <Button 
                    variant={isActive('/') ? "default" : "ghost"} 
                    size="sm"
                    className="font-medium"
                  >
                    Home
                  </Button>
                </Link>
                <Link to="/project-mgmt">
                  <Button 
                    variant={isActive('/project-mgmt') ? "default" : "ghost"} 
                    size="sm"
                    className="font-medium"
                  >
                    Project Mgmt
                  </Button>
                </Link>
                <Link to="/ai-plan-checker">
                  <Button 
                    variant={isActive('/ai-plan-checker') ? "default" : "ghost"} 
                    size="sm"
                    className="font-medium"
                  >
                    AI Plan Checker
                  </Button>
                </Link>
                <Link to="/ai-feasibility">
                  <Button 
                    variant={isActive('/ai-feasibility') ? "default" : "ghost"} 
                    size="sm"
                    className="font-medium"
                  >
                    AI Feasibility
                  </Button>
                </Link>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="w-4 h-4" />
              <span>3 AI Agents Active</span>
            </div>
            
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {profile?.name || user?.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">
                        {profile?.name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user?.email}
                      </p>
                      {profile?.company && (
                        <p className="text-xs text-muted-foreground">
                          {profile.company}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/users" className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          <span>User Management</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" asChild>
                <a href="/auth">Sign In</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};