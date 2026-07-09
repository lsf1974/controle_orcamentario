'use client';

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  actions,
  emptyMessage = 'Nenhum registro encontrado',
}: DataTableProps<T>) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>;
  }
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-gray-600">
            {columns.map((col) => (
              <th key={col.header} className={`px-4 py-2 font-medium ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
            {actions && <th className="px-4 py-2 text-right font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.header} className={`px-4 py-2 text-gray-800 ${col.className ?? ''}`}>
                  {col.cell(row)}
                </td>
              ))}
              {actions && (
                <td className="px-4 py-2 text-right whitespace-nowrap">{actions(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
