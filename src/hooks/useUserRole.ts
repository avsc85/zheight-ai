import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type UserRole = 'admin' | 'pm' | 'ar1_planning' | 'ar2_field' | 'user' | 'moderator';

interface UserRoleHook {
  role: UserRole | null;
  loading: boolean;
  hasRole: (checkRole: UserRole) => boolean;
  isPM: boolean;
  isAR1: boolean;
  isAR2: boolean;
  isAdmin: boolean;
}

export const useUserRole = (): UserRoleHook => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchUserRole();
    } else {
      setRole(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        setRole('user'); // Default role
      } else {
        setRole(data.role);
      }
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      setRole('user');
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (checkRole: UserRole): boolean => {
    return role === checkRole;
  };

  return {
    role,
    loading,
    hasRole,
    isAdmin: role === 'admin',
    isPM: role === 'pm',
    isAR1: role === 'ar1_planning',
    isAR2: role === 'ar2_field'
  };
};