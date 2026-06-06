import { api } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  systemRole: 'ADMIN' | 'USER';
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data.user;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    localStorage.clear();
    window.location.href = '/login';
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('accessToken');
}
