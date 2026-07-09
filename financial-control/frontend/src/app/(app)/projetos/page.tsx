'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable, type Column } from '@/components/shared/data-table';
import type { Project } from '@/types';

const columns: Column<Project>[] = [
  { header: 'Projeto', cell: (p) => p.name },
  { header: 'Status', cell: (p) => p.status },
  {
    header: 'Cadastros',
    cell: (p) => (
      <div className="flex gap-3 text-sm">
        <Link className="text-primary underline" href={`/projetos/${p.id}/cadastros`}>
          Associações
        </Link>
        <Link className="text-primary underline" href={`/projetos/${p.id}/plano-de-contas`}>
          Plano de Contas
        </Link>
        <Link className="text-primary underline" href={`/projetos/${p.id}/centros-de-custo`}>
          Centros de Custo
        </Link>
      </div>
    ),
  },
];

export default function ProjetosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Projetos</h1>
      <DataTable columns={columns} rows={data ?? []} isLoading={isLoading} />
    </div>
  );
}
