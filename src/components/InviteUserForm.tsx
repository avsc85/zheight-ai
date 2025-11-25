import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Crown, Building, Clipboard, User as UserIcon, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InviteUserFormProps {
  onInviteSent: () => void;
}

export const InviteUserForm = ({ onInviteSent }: InviteUserFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !name || !role) {
      setError("Please fill in all fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: inviteError } = await supabase.functions.invoke('invite-user', {
        body: { email, name, role }
      });

      if (inviteError) throw inviteError;

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      toast({
        title: "Invitation sent!",
        description: `An invitation has been sent to ${email}`,
      });

      // Reset form and close dialog
      setEmail("");
      setName("");
      setRole("");
      setOpen(false);
      onInviteSent();

    } catch (error: any) {
      console.error('Error sending invitation:', error);
      setError(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation to join zHeight Internal AI. The user will receive an email with instructions to complete their registration.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Full Name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
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
                    <Crown className="w-4 h-4 text-amber-500" />
                    Admin
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};