import { InviteUserForm } from "@/components/InviteUserForm";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Trash2, Shield, User as UserIcon, Crown, Building, Clipboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: 'user' | 'admin' | 'pm' | 'ar1_planning' | 'ar2_field';
  created_at: string;
  last_sign_in_at: string | null;
  active_status?: boolean;
}

const UserManagement = () => {
  const { isAuthenticated, isAdmin, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set());
  const [orphanedUsers, setOrphanedUsers] = useState<any[]>([]);
  const [isLoadingOrphaned, setIsLoadingOrphaned] = useState(false);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate('/auth');
        return;
      }
      // Only redirect if we have determined the user role (not null) and they're not admin
      if (userRole !== null && !isAdmin) {
        navigate('/');
        return;
      }
    }
  }, [isAuthenticated, isAdmin, userRole, loading, navigate]);

  // Fetch all users with their roles
  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      
      // Use edge function to get users with auth data
      const { data, error } = await supabase.functions.invoke('get-users-with-auth');
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.users);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Failed to load users",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchUsers();
    }
  }, [isAuthenticated, isAdmin]);

  const updateUserRole = async (userId: string, newRole: 'user' | 'admin' | 'pm' | 'ar1_planning' | 'ar2_field') => {
    try {
      setUpdatingUsers(prev => new Set([...prev, userId]));

      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setUsers(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        )
      );

      toast({
        title: "Role updated",
        description: `User role has been changed to ${newRole}.`,
      });
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        title: "Failed to update role",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      setUpdatingUsers(prev => new Set([...prev, userId]));
      
      // First delete from public schema using existing function
      const { error: publicError } = await supabase.rpc('admin_delete_user', {
        target_user_id: userId
      });

      if (publicError) throw publicError;

      // Then delete from auth using edge function
      try {
        const { data, error: authError } = await supabase.functions.invoke('delete-auth-user', {
          body: { email: userEmail, userId }
        });

        if (authError) {
          console.warn('Auth deletion failed:', authError);
          toast({
            title: "Partial deletion completed",
            description: "User data removed but auth account may still exist. Check orphaned users.",
            variant: "destructive",
          });
        } else if (!data.success) {
          console.warn('Auth deletion unsuccessful:', data.error);
          toast({
            title: "Partial deletion completed", 
            description: `User data removed but auth deletion failed: ${data.error}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "User deleted completely",
            description: "User account and all associated data has been removed from all systems.",
          });
        }
      } catch (authErr) {
        console.warn('Auth deletion exception:', authErr);
        toast({
          title: "Partial deletion completed",
          description: "User data removed but auth deletion encountered an error.",
          variant: "destructive",
        });
      }

      // Remove from local state regardless of auth deletion result
      setUsers(prev => prev.filter(user => user.id !== userId));

    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Failed to delete user",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const checkOrphanedUsers = async () => {
    try {
      setIsLoadingOrphaned(true);
      
      const { data, error } = await supabase.functions.invoke('check-orphaned-users');
      
      if (error) {
        console.error('Error checking orphaned users:', error);
        toast({
          title: "Failed to check orphaned users",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data.success) {
        setOrphanedUsers(data.orphanedAuthUsers || []);
        
        if (data.orphanedAuthCount > 0 || data.orphanedProfileCount > 0) {
          toast({
            title: "Orphaned users detected",
            description: `Found ${data.orphanedAuthCount} orphaned auth users and ${data.orphanedProfileCount} orphaned profiles.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "No orphaned users found",
            description: "All users are properly synchronized.",
          });
        }
      }
    } catch (error: any) {
      console.error('Error checking orphaned users:', error);
      toast({
        title: "Failed to check orphaned users",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOrphaned(false);
    }
  };

  const cleanupOrphanedUser = async (orphanedUser: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-auth-user', {
        body: { email: orphanedUser.email, userId: orphanedUser.id }
      });

      if (error) throw error;

      if (data.success) {
        setOrphanedUsers(prev => prev.filter(u => u.id !== orphanedUser.id));
        toast({
          title: "Orphaned user cleaned up",
          description: `Removed orphaned auth user: ${orphanedUser.email}`,
        });
      } else {
        throw new Error(data.error || 'Cleanup failed');
      }
    } catch (error: any) {
      console.error('Error cleaning up orphaned user:', error);
      toast({
        title: "Failed to cleanup orphaned user",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

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

  if (loading || !isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">User Management</h1>
              <p className="text-muted-foreground">
                Manage user accounts and permissions for your organization
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Admin Access
            </Badge>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h2 className="text-lg font-semibold text-foreground">All Users</h2>
              </div>
            <div className="flex items-center gap-2">
              <InviteUserForm onInviteSent={fetchUsers} />
              <Button
                onClick={checkOrphanedUsers} 
                variant="outline" 
                size="sm"
                disabled={isLoadingOrphaned}
              >
                {isLoadingOrphaned ? "Checking..." : "Check Orphaned"}
              </Button>
              <Button 
                onClick={fetchUsers} 
                variant="outline" 
                size="sm"
                disabled={isLoadingUsers}
              >
                {isLoadingUsers ? "Refreshing..." : "Refresh"}
              </Button>
              <Button 
                asChild
                variant="default"
                size="sm"
              >
                <Link to="/">Save Changes and Exit</Link>
              </Button>
            </div>
            </div>

            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' ? (
                            <Crown className="w-4 h-4 text-amber-500" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">
                            {user.full_name || 'Unnamed User'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.company || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value: 'user' | 'admin' | 'pm' | 'ar1_planning' | 'ar2_field') => updateUserRole(user.id, value)}
                          disabled={updatingUsers.has(user.id)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4" />
                                User
                              </div>
                            </SelectItem>
                            <SelectItem value="pm">
                              <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-blue-500" />
                                Project Manager
                              </div>
                            </SelectItem>
                            <SelectItem value="ar1_planning">
                              <div className="flex items-center gap-2">
                                <Clipboard className="w-4 h-4 text-green-500" />
                                AR1 - Planning
                              </div>
                            </SelectItem>
                            <SelectItem value="ar2_field">
                              <div className="flex items-center gap-2">
                                <Clipboard className="w-4 h-4 text-purple-500" />
                                AR2 - Field
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Admin
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.last_sign_in_at 
                          ? new Date(user.last_sign_in_at).toLocaleString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {user.full_name || user.email}? 
                                This action cannot be undone and will remove all their data including 
                                checklist items and account information.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteUser(user.id, user.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={updatingUsers.has(user.id)}
                              >
                                Delete User
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {users.length === 0 && !isLoadingUsers && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </div>
            )}

            {/* Orphaned Users Section */}
            {orphanedUsers.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Orphaned Auth Users</h3>
                    <p className="text-sm text-muted-foreground">
                      These users exist in authentication but not in profiles. They may be blocking email reuse.
                    </p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphanedUsers.map((orphan) => (
                      <TableRow key={orphan.id} className="bg-destructive/5">
                        <TableCell className="font-medium text-destructive">
                          {orphan.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(orphan.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {orphan.last_sign_in_at 
                            ? new Date(orphan.last_sign_in_at).toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                                Clean Up
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Clean Up Orphaned User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove the orphaned auth user {orphan.email}? 
                                  This will allow this email to be used for new registrations.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => cleanupOrphanedUser(orphan)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Clean Up
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default UserManagement;