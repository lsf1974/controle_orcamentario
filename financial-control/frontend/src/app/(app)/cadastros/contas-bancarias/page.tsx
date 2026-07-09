'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { BankAccount } from '@/types';

const resource = createResourceApi<BankAccount>('/bank-accounts');

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
  PETTY_CASH: 'Caixa',
};

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Nome da conta', type: 'text', required: true },
  { name: 'bankName', label: 'Banco', type: 'text', required: true },
  { name: 'bankCode', label: 'Código do banco', type: 'text' },
  { name: 'agency', label: 'Agência', type: 'text' },
  { name: 'accountNumber', label: 'Número da conta', type: 'text' },
  {
    name: 'accountType',
    label: 'Tipo',
    type: 'select',
    required: true,
    options: [
      { value: 'CHECKING', label: 'Corrente' },
      { value: 'SAVINGS', label: 'Poupança' },
      { value: 'INVESTMENT', label: 'Investimento' },
      { value: 'PETTY_CASH', label: 'Caixa' },
    ],
  },
  { name: 'initialBalance', label: 'Saldo inicial', type: 'number' },
  { name: 'initialDate', label: 'Data do saldo inicial', type: 'date', required: true },
];

const columns: Column<BankAccount>[] = [
  { header: 'Conta', cell: (a) => a.name },
  { header: 'Banco', cell: (a) => a.bankName },
  { header: 'Tipo', cell: (a) => ACCOUNT_TYPE_LABELS[a.accountType] ?? a.accountType },
  { header: 'Status', cell: (a) => (a.isActive ? 'Ativa' : 'Inativa') },
];

export default function ContasBancariasPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<BankAccount>({
    queryKey: ['bank-accounts'],
    resource,
    labels: { entity: 'Conta bancária' },
  });

  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);

  function handleSubmit(values: Partial<BankAccount>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Contas Bancárias</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Nova conta</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(a) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setFormOpen(true); }}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ id: a.id, payload: { isActive: !a.isActive } })}
            >
              {a.isActive ? 'Desativar' : 'Ativar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(a)}>
              Excluir
            </Button>
          </div>
        )}
      />

      <EntityFormDialog<BankAccount>
        open={formOpen}
        title={editing ? 'Editar conta bancária' : 'Nova conta bancária'}
        fields={FIELDS}
        defaultValues={
          editing
            ? // <input type="date"> exige yyyy-MM-dd; o backend devolve ISO completo
              { ...editing, initialDate: editing.initialDate?.slice(0, 10) }
            : { accountType: 'CHECKING', isActive: true }
        }
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir conta bancária"
        message={`Excluir "${deleting?.name ?? ''}"? Contas com lançamentos, extratos ou cartões vinculados não podem ser excluídas — desative-as.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
