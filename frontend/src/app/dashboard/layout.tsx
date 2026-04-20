'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { SyncProvider, useSyncCanvas } from '@/lib/sync-provider';
import { PlannerProvider, usePlanner } from '@/lib/planner-provider';
import { useTheme } from '@/lib/theme';
import { prefetchForRoute } from '@/lib/queries';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Today' },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/dashboard/assignments', label: 'Assignments' },
      { href: '/dashboard/courses', label: 'Courses' },
      { href: '/dashboard/grades', label: 'Grades' },
    ],
  },
  {
    label: 'Schedule',
    items: [
      { href: '/dashboard/planner', label: 'Planner' },
      { href: '/dashboard/upload', label: 'Upload Syllabus' },
    ],
  },
];

function Brand({ syncing }: { syncing: boolean }) {
  return (
    <div className="flex items-baseline gap-2 mb-12">
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        Stud<em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>ium</em>
      </span>
      {syncing && (
        <RefreshCw
          size={10}
          className="animate-spin text-[var(--accent)] opacity-70"
          aria-label="Syncing…"
        />
      )}
    </div>
  );
}

function NavGroup({
  group,
  pathname,
  generating,
  onClick,
}: {
  group: (typeof NAV_GROUPS)[0];
  pathname: string;
  generating: boolean;
  onClick?: () => void;
}) {
  const queryClient = useQueryClient();

  return (
    <div className="mb-8">
      <p
        className="mb-3 pl-3.5"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-faint2)',
          fontWeight: 400,
        }}
      >
        {group.label}
      </p>
      <nav>
        {group.items.map(({ href, label }) => {
          const active = pathname === href;
          const isPlannerGenerating = href === '/dashboard/planner' && generating;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClick}
              onMouseEnter={() => prefetchForRoute(queryClient, href)}
              className={clsx(
                'relative flex items-center justify-between py-1.5 pl-3.5 pr-2 mb-px rounded-sm text-sm transition-colors',
                active
                  ? 'text-[var(--text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: 2,
                    height: 14,
                    background: 'var(--accent)',
                  }}
                />
              )}
              {label}
              {isPlannerGenerating && (
                <RefreshCw size={10} className="animate-spin text-[var(--accent)] opacity-70" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <div
      className="inline-flex gap-0.5 p-0.5 rounded"
      style={{ background: 'var(--surface-2)' }}
    >
      {(['light', 'dark'] as const).map((t) => (
        <button
          key={t}
          onClick={() => theme !== t && toggle()}
          className="rounded-sm transition-colors cursor-pointer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '3px 7px',
            background: theme === t ? 'var(--surface)' : 'transparent',
            color: theme === t ? 'var(--text)' : 'var(--text-faint)',
            border: theme === t ? '1px solid var(--border)' : '1px solid transparent',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  const { syncing } = useSyncCanvas();
  return (
    <header
      className="fixed top-0 inset-x-0 z-40 h-14 flex md:hidden items-center justify-between px-5"
      style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          letterSpacing: '-0.02em',
        }}
      >
        Stud<em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>ium</em>
        {syncing && (
          <RefreshCw
            size={10}
            className="ml-2 inline animate-spin text-[var(--accent)] opacity-70"
          />
        )}
      </span>
      <button
        onClick={onOpen}
        className="p-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
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
  const queryClient = useQueryClient();

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="animate-slide-in-right absolute right-0 top-0 bottom-0 w-64 flex flex-col"
        style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              letterSpacing: '-0.02em',
            }}
          >
            Stud<em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>ium</em>
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 px-4 py-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <NavGroup
              key={group.label}
              group={group}
              pathname={pathname}
              generating={generating}
              onClick={onClose}
            />
          ))}
          <div className="mb-8">
            <p
              className="mb-3 pl-3.5"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-faint2)',
              }}
            >
              Account
            </p>
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              onMouseEnter={() => prefetchForRoute(queryClient, '/dashboard/settings')}
              className={clsx(
                'relative flex items-center py-1.5 pl-3.5 mb-px text-sm transition-colors',
                pathname === '/dashboard/settings' ? 'text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              )}
            >
              {pathname === '/dashboard/settings' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full" style={{ width: 2, height: 14, background: 'var(--accent)' }} />
              )}
              Settings
            </Link>
          </div>
        </div>
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <div className="flex items-center justify-between text-sm mb-3" style={{ color: 'var(--text-faint)' }}>
            <span>Theme</span>
            <ThemeToggle />
          </div>
          <button
            onClick={() => { onClose(); onSignOut(); }}
            className="text-sm transition-colors"
            style={{ color: 'var(--text-faint)', fontFamily: 'inherit' }}
          >
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
  const queryClient = useQueryClient();

  return (
    <aside
      className="hidden md:flex flex-shrink-0 flex-col sticky top-0 h-screen"
      style={{
        width: 240,
        padding: '28px 24px',
        borderRight: '1px solid var(--border)',
        background: 'var(--background)',
      }}
    >
      <Brand syncing={syncing} />

      <div className="flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.label}
            group={group}
            pathname={pathname}
            generating={generating}
          />
        ))}
        <div className="mb-8">
          <p
            className="mb-3 pl-3.5"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-faint2)',
              fontWeight: 400,
            }}
          >
            Account
          </p>
          <Link
            href="/dashboard/settings"
            onMouseEnter={() => prefetchForRoute(queryClient, '/dashboard/settings')}
            className={clsx(
              'relative flex items-center py-1.5 pl-3.5 mb-px text-sm transition-colors',
              pathname === '/dashboard/settings' ? 'text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            )}
          >
            {pathname === '/dashboard/settings' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full" style={{ width: 2, height: 14, background: 'var(--accent)' }} />
            )}
            Settings
          </Link>
        </div>
      </div>

      <div
        className="pt-5"
        style={{ borderTop: '1px solid var(--border-soft)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: 'var(--text-faint)' }}>Theme</span>
          <ThemeToggle />
        </div>
        <button
          onClick={onSignOut}
          className="text-sm transition-colors hover:text-[var(--text)]"
          style={{ color: 'var(--text-faint)', fontFamily: 'inherit' }}
        >
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
          <div className="flex h-dvh" style={{ background: 'var(--background)' }}>
            <MobileHeader onOpen={() => setDrawerOpen(true)} />
            <Sidebar onSignOut={handleSignOut} />
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
