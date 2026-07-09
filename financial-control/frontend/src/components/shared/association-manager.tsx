'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { extractApiMessage } from '@/lib/crud-api';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AssociationManagerProps<T extends { id: string }> {
  title: string;
  /** Ex.: `/projects/${projectId}/clients` */
  listPath: string;
  /** Ex.: `/clients` (cadastro mestre global) */
  globalPath: string;
  /** Campo do body do POST de associação. Ex.: 'clientId' */
  assignKey: string;
  getLabel: (item: T) => string;
  canManage: boolean;
}

export function AssociationManager<T extends { id: string }>({
  title,
  listPath,
  globalPath,
  assignKey,
  getLabel,
  canManage,
}: AssociationManagerProps<T>) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const associated = useQuery({
    queryKey: ['assoc', listPath],
    queryFn: async () => (await api.get<T[]>(listPath)).data,
  });

  const global = useQuery({
    queryKey: ['global', globalPath],
    queryFn: async () => (await api.get<T[]>(globalPath)).data,
    enabled: dialogOpen, // só carrega o mestre ao abrir o diálogo
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['assoc', listPath] });
  const onError = (err: unknown) => toast.error(extractApiMessage(err));

  const assign = useMutation({
    mutationFn: (id: string) => api.post(listPath, { [assignKey]: id }),
    onSuccess: () => {
      invalidate();
      toast.success('Associado com sucesso');
      setDialogOpen(false);
      setSelectedId('');
    },
    onError,
  });

  const unassign = useMutation({
    mutationFn: (id: string) => api.delete(`${listPath}/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Desassociado com sucesso');
    },
    onError,
  });

  const associatedIds = new Set((associated.data ?? []).map((i) => i.id));
  const available = (global.data ?? []).filter((i) => !associatedIds.has(i.id));

  const columns: Column<T>[] = [{ header: 'Nome', cell: (i) => getLabel(i) }];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Associar
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={associated.data ?? []}
        isLoading={associated.isLoading}
        emptyMessage="Nenhum item associado a este projeto"
        actions={
          canManage
            ? (item) => (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={unassign.isPending}
                  onClick={() => unassign.mutate(item.id)}
                >
                  Desassociar
                </Button>
              )
            : undefined
        }
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={`Associar — ${title}`}>
        {global.isLoading ? (
          <p className="text-sm text-gray-500">Carregando cadastro…</p>
        ) : (
          <div className="space-y-4">
            <select
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {getLabel(item)}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!selectedId || assign.isPending}
                onClick={() => assign.mutate(selectedId)}
              >
                {assign.isPending ? 'Associando…' : 'Associar'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
