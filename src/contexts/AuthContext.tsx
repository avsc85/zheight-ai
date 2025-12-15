import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  user_id: string;
  name: string | null;
  company: string | null;
  role: string;
  avatar_url: string | null;
  location: string | null;
  active_status: boolean;
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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPM: boolean;
  isAR1: boolean;
  isAR2: boolean;
  refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fetch profile data
const fetchProfileData = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data as Profile;
};

// Fetch user role data
const fetchUserRoleData = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data as UserRole;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // React Query for profile - with 5 minute cache
  const { 
    data: profile, 
    isLoading: profileLoading,
    refetch: refetchProfile 
  } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache (was cacheTime)
    retry: 1,
  });

  // React Query for user role - with 5 minute cache
  const { 
    data: userRole, 
    isLoading: roleLoading 
  } = useQuery({
    queryKey: ['userRole', user?.id],
    queryFn: () => fetchUserRoleData(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Invalidate queries on auth change to refetch fresh data
        if (event === 'SIGNED_IN') {
          queryClient.invalidateQueries({ queryKey: ['profile'] });
          queryClient.invalidateQueries({ queryKey: ['userRole'] });
        } else if (event === 'SIGNED_OUT') {
          queryClient.clear(); // Clear all cached data on sign out
        }
        
        setInitialLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setInitialLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      // Clean up auth state first
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // Clear React Query cache
      queryClient.clear();

      // Attempt global sign out
      await supabase.auth.signOut({ scope: 'global' });

      // Force page reload for clean state
      window.location.href = '/auth';
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({
        title: "Error signing out",
        description: error.message || "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  const loading = initialLoading || (!!user && (profileLoading || roleLoading));

  const value: AuthContextType = {
    user,
    session,
    profile: profile ?? null,
    userRole: userRole ?? null,
    loading,
    signOut,
    refetchProfile: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userRole', user?.id] });
    },
    isAuthenticated: !!session?.user,
    isAdmin: userRole?.role === 'admin',
    isPM: userRole?.role === 'pm' || userRole?.role === 'admin',
    isAR1: userRole?.role === 'ar1_planning' || userRole?.role === 'admin',
    isAR2: userRole?.role === 'ar2_field' || userRole?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
