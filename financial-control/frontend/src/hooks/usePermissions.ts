import { getCurrentUser } from '@/lib/auth';

export function usePermissions() {
  const user = getCurrentUser();

  return {
    isAdmin: user?.systemRole === 'ADMIN',
    isAuthenticated: !!user,
    user,
    can: (permission: 'manage:users' | 'manage:projects' | 'approve:transactions') => {
      if (!user) return false;
      if (user.systemRole === 'ADMIN') return true;
      return false;
    },
  };
}
