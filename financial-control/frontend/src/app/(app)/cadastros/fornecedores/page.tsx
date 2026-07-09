'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { Supplier } from '@/types';

const resource = createResourceApi<Supplier>('/suppliers');

const FIELDS: FieldSpec[] = [
  {
    name: 'personType',
    label: 'Tipo de pessoa',
    type: 'select',
    required: true,
    options: [
      { value: 'COMPANY', label: 'Pessoa Jurídica' },
      { value: 'INDIVIDUAL', label: 'Pessoa Física' },
    ],
  },
  { name: 'companyName', label: 'Razão social (PJ)', type: 'text' },
  { name: 'fullName', label: 'Nome completo (PF)', type: 'text' },
  { name: 'taxId', label: 'CPF/CNPJ', type: 'text', required: true },
  { name: 'email', label: 'E-mail', type: 'text' },
  { name: 'phone', label: 'Telefone', type: 'text' },
  { name: 'paymentTermDays', label: 'Prazo de pagamento (dias)', type: 'number' },
];

const columns: Column<Supplier>[] = [
  { header: 'Nome', cell: (s) => s.companyName ?? s.fullName ?? '—' },
  { header: 'CPF/CNPJ', cell: (s) => s.taxId },
  { header: 'Tipo', cell: (s) => (s.personType === 'COMPANY' ? 'PJ' : 'PF') },
  {
    header: 'Status',
    cell: (s) => (s.isActive ? 'Ativo' : 'Inativo'),
  },
];

export default function FornecedoresPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<Supplier>({
    queryKey: ['suppliers'],
    resource,
    labels: { entity: 'Fornecedor' },
  });

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setFormOpen(true);
  }

  function handleSubmit(values: Partial<Supplier>) {
    if (editing) {
      update.mutate(
        { id: editing.id, payload: values },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Fornecedores</h1>
        <Button onClick={openCreate}>Novo fornecedor</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(s) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ id: s.id, payload: { isActive: !s.isActive } })}
            >
              {s.isActive ? 'Desativar' : 'Ativar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(s)}>
              Excluir
            </Button>
          </div>
        )}
      />

      <EntityFormDialog<Supplier>
        open={formOpen}
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        fields={FIELDS}
        defaultValues={
          editing ?? { personType: 'COMPANY', isActive: true }
        }
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir "${
          deleting?.companyName ?? deleting?.fullName ?? ''
        }"? Fornecedores com lançamentos vinculados não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
