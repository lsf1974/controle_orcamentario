'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdmin } = usePermissions();

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  const links = [
    { href: '/dashboard', label: 'Dashboard', show: true },
    { href: '/projetos', label: 'Projetos', show: true },
    { href: '/cadastros/clientes', label: 'Clientes', show: isAdmin },
    { href: '/cadastros/fornecedores', label: 'Fornecedores', show: isAdmin },
    { href: '/cadastros/contas-bancarias', label: 'Contas Bancárias', show: isAdmin },
    { href: '/cadastros/cartoes', label: 'Cartões', show: isAdmin },
    { href: '/configuracoes/notificacoes', label: 'Notificações', show: true },
  ].filter((l) => l.show);

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-white shadow-sm border-r">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">Controle Financeiro</h1>
        </div>
        <nav className="p-4 space-y-1">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
