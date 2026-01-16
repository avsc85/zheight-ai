import { Bot, User, LogOut, Users, BarChart3, ClipboardList, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import zHeightLogo from "@/assets/zheight-logo.png";
import { useUserRole } from "@/hooks/useUserRole";
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
  const { user, profile, signOut, isAuthenticated, isAdmin, isPM } = useAuth();
  const { isAR1, isAR2 } = useUserRole();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path === '/project-mgmt' && location.pathname.startsWith('/project-mgmt')) return true;
    if (path === '/ai-plan-checker' && location.pathname === '/ai-plan-checker') return true;
    if (path === '/ai-feasibility' && location.pathname === '/ai-feasibility') return true;
    return false;
  };

  return (
    <header className="bg-header sticky top-0 z-50 border-b border-header/10">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <img src={zHeightLogo} alt="zHeight Logo" className="h-9 w-auto" />
              <div>
                <h1 className="text-lg font-semibold text-header-foreground">zHeight Internal AI</h1>
                <p className="text-xs text-header-foreground/60">Building Code Compliance & Project Management</p>
              </div>
            </Link>
            
            {/* Navigation Tabs */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-1">
                <Link to="/">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`font-medium text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10 ${
                      isActive('/') ? 'bg-header-foreground/10 text-header-foreground' : ''
                    }`}
                  >
                    Home
                  </Button>
                </Link>
                <Link to="/project-mgmt">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`font-medium text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10 ${
                      isActive('/project-mgmt') ? 'bg-header-foreground/10 text-header-foreground' : ''
                    }`}
                  >
                    Project Mgmt
                  </Button>
                </Link>
                <Link to="/ai-plan-checker">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`font-medium text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10 ${
                      isActive('/ai-plan-checker') ? 'bg-header-foreground/10 text-header-foreground' : ''
                    }`}
                  >
                    AI Plan Checker
                  </Button>
                </Link>
                <Link to="/ai-feasibility">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`font-medium text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10 ${
                      isActive('/ai-feasibility') ? 'bg-header-foreground/10 text-header-foreground' : ''
                    }`}
                  >
                    AI Feasibility
                  </Button>
                </Link>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-header-foreground/60">
              <Bot className="w-4 h-4 text-primary" />
              <span>3 AI Agents Active</span>
            </div>
            
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="hidden sm:inline text-sm">
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
                        <Link to="/project-mgmt/dashboard" className="flex items-center">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          <span>Admin Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/users" className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          <span>User Management</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isPM && !isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/project-mgmt/pm-dashboard" className="flex items-center">
                          <ClipboardList className="mr-2 h-4 w-4" />
                          <span>PM Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {(isAR1 || isAR2) && !isAdmin && !isPM && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/project-mgmt/ar-dashboard" className="flex items-center">
                          <ListChecks className="mr-2 h-4 w-4" />
                          <span>My Tasks</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <a href="/auth">Sign In</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
