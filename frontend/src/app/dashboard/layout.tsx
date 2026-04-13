'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  ClipboardList,
  Upload,
  TrendingUp,
  LogOut,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/courses', icon: BookOpen, label: 'Courses' },
  { href: '/dashboard/assignments', icon: ClipboardList, label: 'Assignments' },
  { href: '/dashboard/planner', icon: Calendar, label: 'Planner' },
  { href: '/dashboard/grades', icon: TrendingUp, label: 'Grades' },
  { href: '/dashboard/upload', icon: Upload, label: 'Upload Syllabus' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
      })
  );

  async function handleSignOut() {
    localStorage.removeItem('studium_stay_signed_in');
    localStorage.removeItem('studium_ephemeral');
    sessionStorage.removeItem('studium_session_active');
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <QueryClientProvider client={queryClient}>
    <div className="flex h-dvh bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[var(--border)]">
          <span className="font-display font-800 text-base">
            studium
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-[var(--border)] space-y-0.5">
          <Link
            href="/dashboard/settings"
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === '/dashboard/settings'
                ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
            )}
          >
            <Settings size={15} />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
    </QueryClientProvider>
  );
}
