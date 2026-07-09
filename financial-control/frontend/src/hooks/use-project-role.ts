'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import type { ProjectRole } from '@/types';

interface ProjectDetail {
  id: string;
  name: string;
  projectUsers: { userId: string; role: ProjectRole }[];
}

export function useProjectRole(projectId: string) {
  const user = getCurrentUser();
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () =>
      (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
  });

  const isAdmin = user?.systemRole === 'ADMIN';
  const membership = project?.projectUsers?.find(
    (pu) => pu.userId === user?.id,
  );
  const role = membership?.role;
  const canManage = isAdmin || role === 'GESTOR';

  return { canManage, role, project };
}
