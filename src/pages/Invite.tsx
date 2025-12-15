import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Building, Clipboard, User as UserIcon } from "lucide-react";

interface InvitationData {
  id: string;
  email: string;
  name: string;
  role: string;
  invited_by: string;
  expires_at: string;
  status: string;
}

const Invite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);

  const email = searchParams.get('email');
  const invitationId = searchParams.get('invitation_id');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/project-mgmt");
    }
  }, [user, navigate]);

  // Load invitation data
  useEffect(() => {
    const loadInvitation = async () => {
      if (!email && !invitationId) {
        setError("Invalid invitation link - no email or invitation ID provided");
        setLoadingInvitation(false);
        return;
      }

      try {
        // Clean up expired invitations first
        await supabase.rpc('cleanup_expired_invitations');

        // Query by email OR invitation_id, whichever is available
        let query = supabase
          .from('user_invitations')
          .select('*')
          .eq('status', 'pending');

        if (invitationId) {
          query = query.eq('id', invitationId);
        } else if (email) {
          query = query.eq('email', email);
        }

        const { data, error: inviteError } = await query.single();

        if (inviteError) {
          if (inviteError.code === 'PGRST116') {
            setError("No valid invitation found for this link");
          } else {
            setError("Failed to load invitation details");
          }
          setLoadingInvitation(false);
          return;
        }

        // Check if invitation is expired
        const expiryDate = new Date(data.expires_at);
        if (expiryDate < new Date()) {
          setError("This invitation has expired. Please contact an admin for a new invitation.");
          setLoadingInvitation(false);
          return;
        }

        setInvitation(data);
      } catch (error: any) {
        console.error('Error loading invitation:', error);
        setError("Failed to load invitation details");
      } finally {
        setLoadingInvitation(false);
      }
    };

    loadInvitation();
  }, [email, invitationId]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-4 h-4 text-amber-500" />;
      case 'pm': return <Building className="w-4 h-4 text-blue-500" />;
      case 'ar1_planning': return <Clipboard className="w-4 h-4 text-green-500" />;
      case 'ar2_field': return <Clipboard className="w-4 h-4 text-purple-500" />;
      default: return <UserIcon className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'pm': return 'Project Manager';
      case 'ar1_planning': return 'AR1 - Planning';
      case 'ar2_field': return 'AR2 - Field';
      case 'user': return 'User';
      default: return role;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError("Please enter and confirm your password");
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

    if (!invitation) {
      setError("No valid invitation found");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          data: {
            full_name: invitation.name,
            role: invitation.role,
            invitation_id: invitation.id
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Update user role from 'user' to the invited role
      // The handle_new_user_role trigger creates role='user' by default,
      // so we need to update it to the intended role
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: invitation.role as "admin" | "pm" | "ar1_planning" | "ar2_field" | "user" })
        .eq('user_id', authData.user.id)
        .eq('role', 'user'); // Only update if currently 'user'

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error updating user role:', roleError);
        // Don't fail signup for this - user can still sign in
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('user_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Error updating invitation status:', updateError);
        // Don't fail the signup for this
      }

      toast({
        title: "Account created successfully!",
        description: "Welcome to zHeight Internal AI. Please sign in with your new account.",
      });

      // Redirect to auth page for signin
      navigate("/auth");

    } catch (error: any) {
      console.error('Sign up error:', error);
      setError(error.message || 'An error occurred during account creation');
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvitation) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-destructive">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => navigate("/auth")} 
              className="w-full mt-4"
              variant="outline"
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Complete Your Registration</CardTitle>
          <p className="text-muted-foreground">You've been invited to join zHeight Internal AI</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {invitation && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Email:</span>
                <span className="text-sm text-muted-foreground">{invitation.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Name:</span>
                <span className="text-sm">{invitation.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Role:</span>
                <Badge variant="outline" className="flex items-center gap-1">
                  {getRoleIcon(invitation.role)}
                  {getRoleDisplayName(invitation.role)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Expires:</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(invitation.expires_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={6}
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="text-center">
            <Button 
              variant="link" 
              onClick={() => navigate("/auth")}
              className="text-sm"
            >
              Already have an account? Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Invite;