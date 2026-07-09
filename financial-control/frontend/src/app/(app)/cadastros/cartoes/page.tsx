'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { CreditCard } from '@/types';

const resource = createResourceApi<CreditCard>('/credit-cards');

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Nome do cartão', type: 'text', required: true },
  {
    name: 'brand',
    label: 'Bandeira',
    type: 'select',
    required: true,
    options: [
      { value: 'VISA', label: 'Visa' },
      { value: 'MASTERCARD', label: 'Mastercard' },
      { value: 'ELO', label: 'Elo' },
      { value: 'AMEX', label: 'Amex' },
      { value: 'HIPERCARD', label: 'Hipercard' },
      { value: 'OTHER', label: 'Outra' },
    ],
  },
  { name: 'lastFourDigits', label: 'Últimos 4 dígitos', type: 'text', required: true },
  { name: 'creditLimit', label: 'Limite', type: 'number', required: true },
  { name: 'billingDay', label: 'Dia de vencimento', type: 'number', required: true },
  { name: 'closingDay', label: 'Dia de fechamento', type: 'number', required: true },
];

const columns: Column<CreditCard>[] = [
  { header: 'Cartão', cell: (c) => c.name },
  { header: 'Bandeira', cell: (c) => c.brand },
  { header: 'Final', cell: (c) => `•••• ${c.lastFourDigits}` },
  { header: 'Status', cell: (c) => (c.isActive ? 'Ativo' : 'Inativo') },
];

export default function CartoesPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<CreditCard>({
    queryKey: ['credit-cards'],
    resource,
    labels: { entity: 'Cartão' },
  });

  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CreditCard | null>(null);

  function handleSubmit(values: Partial<CreditCard>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Cartões de Crédito</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Novo cartão</Button>
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

      <EntityFormDialog<CreditCard>
        open={formOpen}
        title={editing ? 'Editar cartão' : 'Novo cartão'}
        fields={FIELDS}
        defaultValues={editing ?? { brand: 'VISA', isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir cartão"
        message={`Excluir "${deleting?.name ?? ''}"? Cartões com lançamentos vinculados não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
