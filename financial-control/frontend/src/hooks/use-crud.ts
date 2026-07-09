import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { extractApiMessage, type ResourceApi } from '@/lib/crud-api';

interface UseCrudOptions<T> {
  queryKey: (string | number)[];
  resource: ResourceApi<T>;
  labels?: { entity?: string };
}

export function useCrud<T extends { id: string }>({
  queryKey,
  resource,
  labels,
}: UseCrudOptions<T>) {
  const qc = useQueryClient();
  const entity = labels?.entity ?? 'Registro';

  const query = useQuery({ queryKey, queryFn: resource.list });

  const invalidate = () => qc.invalidateQueries({ queryKey });
  const onError = (err: unknown) => toast.error(extractApiMessage(err));

  const create = useMutation({
    mutationFn: (payload: Partial<T>) => resource.create(payload),
    onSuccess: () => {
      invalidate();
      toast.success(`${entity} criado com sucesso`);
    },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<T> }) =>
      resource.update(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success(`${entity} atualizado com sucesso`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => resource.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(`${entity} excluído com sucesso`);
    },
    onError,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    create,
    update,
    remove,
    isMutating:
      create.isPending || update.isPending || remove.isPending,
  };
}
