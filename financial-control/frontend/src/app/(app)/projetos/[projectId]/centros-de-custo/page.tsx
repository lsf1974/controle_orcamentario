'use client';

import { use, useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { useProjectRole } from '@/hooks/use-project-role';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { CostCenter } from '@/types';

const FIELDS: FieldSpec[] = [
  { name: 'code', label: 'Código', type: 'text', required: true },
  { name: 'name', label: 'Nome', type: 'text', required: true },
  { name: 'description', label: 'Descrição', type: 'text' },
];

const columns: Column<CostCenter>[] = [
  { header: 'Código', cell: (c) => c.code },
  { header: 'Nome', cell: (c) => c.name },
  { header: 'Status', cell: (c) => (c.isActive ? 'Ativo' : 'Inativo') },
];

export default function CentrosDeCustoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { canManage } = useProjectRole(projectId);
  const resource = createResourceApi<CostCenter>(
    `/projects/${projectId}/cost-centers`,
  );

  const { rows, isLoading, create, update, remove, isMutating } =
    useCrud<CostCenter>({
      queryKey: ['cost-centers', projectId],
      resource,
      labels: { entity: 'Centro de custo' },
    });

  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CostCenter | null>(null);

  function handleSubmit(values: Partial<CostCenter>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Centros de Custo</h1>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Novo centro de custo
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={
          canManage
            ? (c) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormOpen(true); }}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update.mutate({ id: c.id, payload: { isActive: !c.isActive } })}
                  >
                    {c.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
                    Excluir
                  </Button>
                </div>
              )
            : undefined
        }
      />

      <EntityFormDialog<CostCenter>
        open={formOpen}
        title={editing ? 'Editar centro de custo' : 'Novo centro de custo'}
        fields={FIELDS}
        defaultValues={editing ?? { isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir centro de custo"
        message={`Excluir "${deleting?.name ?? ''}"? Centros usados em lançamentos/orçamento não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
