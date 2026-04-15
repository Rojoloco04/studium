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
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { SyncProvider, useSyncCanvas } from '@/lib/sync-provider';
import { PlannerProvider, usePlanner } from '@/lib/planner-provider';

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/courses', icon: BookOpen, label: 'Courses' },
  { href: '/dashboard/assignments', icon: ClipboardList, label: 'Assignments' },
  { href: '/dashboard/grades', icon: TrendingUp, label: 'Grades' },
  { href: '/dashboard/planner', icon: Calendar, label: 'Planner' },
  { href: '/dashboard/upload', icon: Upload, label: 'Upload Syllabus' },
];

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  const { syncing } = useSyncCanvas();

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 flex md:hidden items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2">
        <span className="font-display font-800 text-base">studium</span>
        {syncing && (
          <RefreshCw
            size={11}
            className="animate-spin text-[var(--accent)] opacity-70"
            aria-label="Syncing Canvas…"
          />
        )}
      </div>
      <button
        onClick={onOpen}
        className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-2)] transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
    </header>
  );
}

function MobileDrawer({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const pathname = usePathname();
  const { generating } = usePlanner();

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop — full screen */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel — anchored to right edge */}
      <div className="animate-slide-in-right absolute right-0 top-0 bottom-0 w-64 flex flex-col bg-[var(--surface)] border-l border-[var(--border)]">
        {/* Header */}
        <div className="px-4 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <span className="font-display font-800 text-base">studium</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            const isPlannerGenerating = href === '/dashboard/planner' && generating;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                )}
              >
                <Icon size={15} />
                {label}
                {isPlannerGenerating && (
                  <RefreshCw size={11} className="ml-auto animate-spin text-[var(--accent)] opacity-70" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-[var(--border)] space-y-0.5">
          <Link
            href="/dashboard/settings"
            onClick={onClose}
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
            onClick={() => { onClose(); onSignOut(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ onSignOut }: { onSignOut: () => void }) {
  const pathname = usePathname();
  const { syncing } = useSyncCanvas();
  const { generating } = usePlanner();

  return (
    <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--border)] flex items-center gap-2">
        <span className="font-display font-800 text-base">studium</span>
        {syncing && (
          <RefreshCw
            size={11}
            className="animate-spin text-[var(--accent)] opacity-70"
            aria-label="Syncing Canvas…"
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          const isPlannerGenerating = href === '/dashboard/planner' && generating;
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
              {isPlannerGenerating && (
                <RefreshCw size={11} className="ml-auto animate-spin text-[var(--accent)] opacity-70" />
              )}
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
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      <SyncProvider>
        <PlannerProvider>
        <div className="flex h-dvh bg-[var(--background)]">
          {/* Mobile top header */}
          <MobileHeader onOpen={() => setDrawerOpen(true)} />

          {/* Desktop sidebar */}
          <Sidebar onSignOut={handleSignOut} />

          {/* Mobile drawer overlay */}
          {drawerOpen && (
            <MobileDrawer onClose={() => setDrawerOpen(false)} onSignOut={handleSignOut} />
          )}

          <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
            {children}
          </main>
        </div>
        </PlannerProvider>
      </SyncProvider>
    </QueryClientProvider>
  );
}
