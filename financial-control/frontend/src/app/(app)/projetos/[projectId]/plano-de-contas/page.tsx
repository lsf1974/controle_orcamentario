'use client';

import { use, useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { useProjectRole } from '@/hooks/use-project-role';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { AccountCategory } from '@/types';

const LEVEL_LABELS: Record<string, string> = {
  PACKAGE: 'Pacote',
  CATEGORY: 'Categoria',
  SUBCATEGORY: 'Subcategoria',
};

export default function PlanoDeContasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { canManage } = useProjectRole(projectId);
  const resource = createResourceApi<AccountCategory>(
    `/projects/${projectId}/account-categories`,
  );

  const { rows, isLoading, create, update, remove, isMutating } =
    useCrud<AccountCategory>({
      queryKey: ['account-categories', projectId],
      resource,
      labels: { entity: 'Categoria' },
    });

  const [editing, setEditing] = useState<AccountCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AccountCategory | null>(null);

  // Pais possíveis = pacotes e categorias existentes (para montar a hierarquia)
  const parentOptions = rows
    .filter((r) => r.level !== 'SUBCATEGORY')
    .map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }));

  const fields: FieldSpec[] = [
    { name: 'code', label: 'Código', type: 'text', required: true },
    { name: 'name', label: 'Nome', type: 'text', required: true },
    {
      name: 'type',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: [
        { value: 'REVENUE', label: 'Receita' },
        { value: 'EXPENSE', label: 'Despesa' },
      ],
    },
    {
      name: 'level',
      label: 'Nível',
      type: 'select',
      required: true,
      options: [
        { value: 'PACKAGE', label: 'Pacote' },
        { value: 'CATEGORY', label: 'Categoria' },
        { value: 'SUBCATEGORY', label: 'Subcategoria' },
      ],
    },
    {
      name: 'parentId',
      label: 'Categoria pai (deixe vazio para Pacote)',
      type: 'select',
      options: parentOptions,
    },
  ];

  const columns: Column<AccountCategory>[] = [
    { header: 'Código', cell: (c) => c.code },
    { header: 'Nome', cell: (c) => c.name },
    { header: 'Nível', cell: (c) => LEVEL_LABELS[c.level] ?? c.level },
    { header: 'Tipo', cell: (c) => (c.type === 'REVENUE' ? 'Receita' : 'Despesa') },
  ];

  function handleSubmit(values: Partial<AccountCategory>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Plano de Contas</h1>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Nova categoria
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

      <EntityFormDialog<AccountCategory>
        open={formOpen}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        fields={fields}
        defaultValues={editing ?? { type: 'EXPENSE', level: 'PACKAGE', isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir categoria"
        message={`Excluir "${deleting?.name ?? ''}"? Categorias com subcategorias ou usadas em lançamentos/orçamento não podem ser excluídas — desative-as.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
