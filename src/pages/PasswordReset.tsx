import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { EyeIcon, EyeOffIcon } from "lucide-react";

const PasswordReset = () => {
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const setupSession = async () => {
      try {
        // Get tokens from URL hash (Supabase recovery format)
        const hash = window.location.hash;
        console.log('URL hash received:', hash);
        
        // Parse hash parameters
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        console.log('Parsed tokens:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        });
        
        if (!accessToken || !refreshToken) {
          setError("Invalid reset link. Please request a new password reset.");
          return;
        }

        try {
          // Set the session with the tokens from the URL
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Session setup error:', sessionError);
            
            // Handle specific error types
            if (sessionError.message.includes('expired')) {
              setError("This reset link has expired. Please request a new password reset.");
            } else if (sessionError.message.includes('already been used')) {
              setError("This reset link has already been used. Please request a new password reset.");
            } else if (sessionError.message.includes('Invalid')) {
              setError("Invalid reset link. Please request a new password reset.");
            } else {
              setError(`Session error: ${sessionError.message}`);
            }
            return;
          }

          if (!data.session) {
            setError("Unable to establish session. Please request a new password reset.");
            return;
          }

          // Session is ready
          console.log('Session established successfully');
          setSessionReady(true);
        } catch (err: any) {
          console.error('Error setting session:', err);
          setError(`Error: ${err.message}`);
        }
      } catch (err: any) {
        console.error('Unexpected error setting up session:', err);
        setError("An unexpected error occurred. Please request a new password reset.");
      }
    };

    setupSession();
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionReady) {
      setError("Session not ready. Please wait or request a new reset link.");
      return;
    }
    
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      toast({
        title: "Password updated successfully",
        description: "You can now sign in with your new password.",
      });

      // Sign out the user and redirect to sign in page
      await supabase.auth.signOut();
      navigate("/auth?message=password-updated");
    } catch (error: any) {
      console.error('Password update error:', error);
      setError(error.message || 'An error occurred while updating your password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <p className="text-muted-foreground">
            {!sessionReady && !error ? "Verifying reset link..." : "Enter your new password below"}
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="flex flex-col gap-2">
                <span>{error}</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/forgot-password")}
                  className="w-full mt-2"
                >
                  Request New Reset Link
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {!error && !sessionReady && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {sessionReady && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
              {loading ? "Updating Password..." : "Update Password"}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordReset;