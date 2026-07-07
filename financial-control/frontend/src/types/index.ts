export type SystemRole = 'ADMIN' | 'USER';
export type ProjectRole = 'GESTOR' | 'ANALISTA';
export type ProjectStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface User {
  id: string;
  name: string;
  email: string;
  systemRole: SystemRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  color?: string;
  icon?: string;
  createdAt: string;
}

export interface ProjectUser {
  userId: string;
  projectId: string;
  role: ProjectRole;
  user: Pick<User, 'id' | 'name' | 'email'>;
}
