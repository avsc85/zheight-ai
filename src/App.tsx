import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import PasswordReset from "./pages/PasswordReset";
import AIPlanChecker from "./pages/AIPlanChecker";
import AIFeasibility from "./pages/AIFeasibility";
import UserManagement from "./pages/UserManagement";
import ProjectManagement from "./pages/ProjectManagement";
import ProjectBoard from "./pages/ProjectBoard";
import ProjectSetup from "./pages/ProjectSetup";
import ProjectTracking from "./pages/ProjectTracking";
import NotFound from "./pages/NotFound";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<PasswordReset />} />
          <Route 
            path="/ai-plan-checker" 
            element={
              <ProtectedRoute>
                <AIPlanChecker />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ai-feasibility" 
            element={
              <ProtectedRoute>
                <AIFeasibility />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/users" 
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/project-mgmt" 
            element={
              <ProtectedRoute>
                <ProjectManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/project-mgmt/board" 
            element={
              <ProtectedRoute>
                <ProjectBoard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/project-mgmt/setup/:projectId?" 
            element={
              <ProtectedRoute>
                <ProjectSetup />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/project-mgmt/tracking" 
            element={
              <ProtectedRoute>
                <ProjectTracking />
              </ProtectedRoute>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
