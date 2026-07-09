import { api } from './api';

export interface ResourceApi<T> {
  list: () => Promise<T[]>;
  create: (payload: Partial<T>) => Promise<T>;
  update: (id: string, payload: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function createResourceApi<T>(basePath: string): ResourceApi<T> {
  return {
    list: async () => (await api.get<T[]>(basePath)).data,
    create: async (payload) => (await api.post<T>(basePath, payload)).data,
    update: async (id, payload) =>
      (await api.patch<T>(`${basePath}/${id}`, payload)).data,
    remove: async (id) => {
      await api.delete(`${basePath}/${id}`);
    },
  };
}

/** Extrai a mensagem de erro do backend (string ou array de class-validator). */
export function extractApiMessage(err: unknown): string {
  const message = (
    err as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? 'Ocorreu um erro inesperado';
}
