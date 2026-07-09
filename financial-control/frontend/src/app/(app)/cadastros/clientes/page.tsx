'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { Client } from '@/types';

const resource = createResourceApi<Client>('/clients');

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
  { name: 'city', label: 'Cidade', type: 'text' },
  { name: 'state', label: 'UF', type: 'text' },
  { name: 'paymentTermDays', label: 'Prazo de pagamento (dias)', type: 'number' },
];

const columns: Column<Client>[] = [
  { header: 'Nome', cell: (c) => c.companyName ?? c.fullName ?? '—' },
  { header: 'CPF/CNPJ', cell: (c) => c.taxId },
  { header: 'Cidade/UF', cell: (c) => [c.city, c.state].filter(Boolean).join('/') || '—' },
  { header: 'Status', cell: (c) => (c.isActive ? 'Ativo' : 'Inativo') },
];

export default function ClientesPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<Client>({
    queryKey: ['clients'],
    resource,
    labels: { entity: 'Cliente' },
  });

  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);

  function handleSubmit(values: Partial<Client>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Novo cliente</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(c) => (
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
        )}
      />

      <EntityFormDialog<Client>
        open={formOpen}
        title={editing ? 'Editar cliente' : 'Novo cliente'}
        fields={FIELDS}
        defaultValues={editing ?? { personType: 'COMPANY', isClient: true, isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir cliente"
        message={`Excluir "${deleting?.companyName ?? deleting?.fullName ?? ''}"? Clientes com lançamentos vinculados não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
