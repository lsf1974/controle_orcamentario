'use client';

import { use } from 'react';
import { AssociationManager } from '@/components/shared/association-manager';
import { useProjectRole } from '@/hooks/use-project-role';
import type { Client, BankAccount, CreditCard } from '@/types';

export default function ProjetoCadastrosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { canManage, project } = useProjectRole(projectId);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-800">
        Cadastros do projeto {project?.name ? `— ${project.name}` : ''}
      </h1>

      <AssociationManager<Client>
        title="Clientes"
        listPath={`/projects/${projectId}/clients`}
        globalPath="/clients"
        assignKey="clientId"
        getLabel={(c) => c.companyName ?? c.fullName ?? c.taxId}
        canManage={canManage}
      />

      <AssociationManager<BankAccount>
        title="Contas Bancárias"
        listPath={`/projects/${projectId}/bank-accounts`}
        globalPath="/bank-accounts"
        assignKey="bankAccountId"
        getLabel={(a) => `${a.name} — ${a.bankName}`}
        canManage={canManage}
      />

      <AssociationManager<CreditCard>
        title="Cartões de Crédito"
        listPath={`/projects/${projectId}/credit-cards`}
        globalPath="/credit-cards"
        assignKey="creditCardId"
        getLabel={(c) => `${c.name} (•••• ${c.lastFourDigits})`}
        canManage={canManage}
      />
    </div>
  );
}
