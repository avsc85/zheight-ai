import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  company: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin' | 'pm' | 'ar1_planning' | 'ar2_field' | 'moderator';
  created_at: string;
  updated_at: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch user profile and role
  const fetchProfile = async (userId: string) => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .single()
      ]);

      if (profileResult.error) {
        console.error('Error fetching profile:', profileResult.error);
      } else {
        setProfile(profileResult.data);
      }

      if (roleResult.error) {
        console.error('Error fetching user role:', roleResult.error);
      } else {
        setUserRole(roleResult.data);
      }
    } catch (error) {
      console.error('Error fetching profile or role:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetching to prevent potential deadlocks
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Clean up auth state first
      const cleanupAuthState = () => {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
      };

      cleanupAuthState();

      // Attempt global sign out
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.error('Error during sign out:', err);
      }

      // Force page reload for clean state
      window.location.href = '/auth';
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({
        title: "Error signing out",
        description: error.message || "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    session,
    profile,
    userRole,
    loading,
    signOut,
    isAuthenticated: !!session?.user,
    isAdmin: userRole?.role === 'admin',
    isPM: userRole?.role === 'pm',
    isAR1: userRole?.role === 'ar1_planning',
    isAR2: userRole?.role === 'ar2_field',
  };
};