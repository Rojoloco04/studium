'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/lib/theme';
import { useAllCourses, useToggleHideCourse, QK } from '@/lib/queries';
import { useSyncCanvas } from '@/lib/sync-provider';
import {
  GraduationCap,
  ExternalLink,
  Loader2,
  AlertCircle,
  Link2Off,
  Moon,
  Sun,
  Shield,
  RefreshCw,
  EyeOff,
  Eye,
  CalendarDays,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface CanvasStatus {
  connected: boolean;
  domain: string | null;
  canvas_user_name: string | null;
  last_synced: string | null;
  courses_count: number;
  assignments_count: number;
}

// ── Helpers ──────────────────────────────────────────────────

async function getAuthHeaders() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Canvas section ───────────────────────────────────────────

function CanvasSection() {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const { syncing, triggerSync } = useSyncCanvas();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: status, isLoading } = useQuery<CanvasStatus>({
    queryKey: ['canvas-status'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/canvas/status`, { headers });
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
  });

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setConnecting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/canvas/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ domain: domain.replace(/\/$/, ''), token }),
      });
      if (!res.ok) {
        const ct = res.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          throw new Error(data.detail || 'Failed to connect');
        }
        throw new Error(`Server error (${res.status})`);
      }
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['canvas-status'] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setError('');
    await triggerSync();
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API}/api/canvas/disconnect`, { method: 'DELETE', headers });
      queryClient.invalidateQueries({ queryKey: ['canvas-status'] });
      setConfirmDisconnect(false);
      setSuccess(false);
      setDomain('');
      setToken('');
    } catch {
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--text-faint)] text-sm py-4">
        <Loader2 size={14} className="animate-spin" />
        Loading…
      </div>
    );
  }

  const connected = status?.connected || success;

  if (connected) {
    const displayDomain = status?.domain ?? domain;
    const displayName = status?.canvas_user_name;
    const lastSynced = status?.last_synced
      ? new Date(status.last_synced).toLocaleString()
      : null;

    return (
      <div className="space-y-4">
        {/* Connected state */}
        <div className="surface-border rounded-xl p-5 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
              <span className="text-sm font-medium text-[var(--text)]">Connected</span>
            </div>
            {displayName && (
              <p className="text-sm text-[var(--text-dim)]">{displayName}</p>
            )}
            {displayDomain && (
              <p className="text-xs font-mono text-[var(--text-faint)] break-all">{displayDomain}</p>
            )}
          </div>

          {(status?.courses_count !== undefined) && (
            <div className="flex gap-4 pt-1 border-t border-[var(--border)]">
              <div>
                <p className="text-xs text-[var(--text-faint)]">Courses</p>
                <p className="text-sm font-medium text-[var(--text)]">{status.courses_count}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-faint)]">Assignments</p>
                <p className="text-sm font-medium text-[var(--text)]">{status.assignments_count}</p>
              </div>
              {lastSynced && (
                <div>
                  <p className="text-xs text-[var(--text-faint)]">Last synced</p>
                  <p className="text-xs text-[var(--text-dim)]">{lastSynced}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sync / Disconnect */}
        {error && (
          <div className="flex items-center gap-2 text-[var(--danger)] text-xs">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>

          <span className="text-[var(--border-strong)] select-none">·</span>

          <button
            onClick={() => setConfirmDisconnect(true)}
            className="flex items-center gap-2 text-sm text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
          >
            <Link2Off size={14} />
            Disconnect Canvas
          </button>
        </div>

        {confirmDisconnect && (
          <div className="surface-border rounded-xl p-4 space-y-3">
            <p className="text-sm text-[var(--text)]">
              This will remove your Canvas token and all synced data. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--danger)] text-white text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {disconnecting && <Loader2 size={13} className="animate-spin" />}
                Yes, disconnect
              </button>
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="px-3 py-1.5 rounded-lg surface-border text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not connected — show connect form
  return (
    <div className="space-y-4">
      <div className="surface-border rounded-xl p-5">
        <h3 className="font-display font-600 text-sm mb-3">How to get your token</h3>
        <ol className="space-y-2 text-sm text-[var(--text-dim)]">
          <li className="flex gap-2">
            <span className="font-mono text-[var(--accent)] flex-shrink-0">1.</span>
            <span>Open Canvas → <strong className="text-[var(--text)]">Account → Settings</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[var(--accent)] flex-shrink-0">2.</span>
            <span>Scroll to <strong className="text-[var(--text)]">Approved Integrations</strong> → <strong className="text-[var(--text)]">+ New Access Token</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[var(--accent)] flex-shrink-0">3.</span>
            <span>Name it <strong className="text-[var(--text)]">Studium</strong>, set an expiry, copy the token</span>
          </li>
        </ol>
        <a
          href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[var(--accent)] text-xs mt-4 hover:underline"
        >
          Canvas help docs <ExternalLink size={11} />
        </a>
      </div>

      <form onSubmit={handleConnect} className="space-y-3">
        <div>
          <label className="block text-xs font-mono text-[var(--text-dim)] mb-1.5">Canvas domain</label>
          <input
            type="url"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
            placeholder="https://youruniversity.instructure.com"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-[var(--text-dim)] mb-1.5">Access token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            placeholder="Paste your Canvas access token"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[var(--danger)] text-xs">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 bg-[var(--surface-2)] rounded-lg px-3 py-2.5">
          <Shield size={13} className="text-[var(--text-faint)]" />
          <p className="text-xs text-[var(--text-faint)]">
            Your token is encrypted at rest. You can revoke it from Canvas at any time.
          </p>
        </div>

        <button
          type="submit"
          disabled={connecting}
          className="w-full bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {connecting && <Loader2 size={14} className="animate-spin" />}
          Connect Canvas
        </button>
      </form>
    </div>
  );
}

// ── Google Calendar section ──────────────────────────────────

interface GCalStatus {
  connected: boolean;
  google_email: string | null;
  token_expiry: string | null;
}

function GoogleCalendarSection() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState('');

  const { data: status, isLoading } = useQuery<GCalStatus>({
    queryKey: ['gcal-status'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/google-calendar/status`, { headers });
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
  });

  async function handleConnect() {
    setError('');
    setConnecting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/google-calendar/auth-url`, { headers });
      if (!res.ok) throw new Error('Failed to get auth URL');
      const { auth_url } = await res.json();
      window.location.href = auth_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API}/api/google-calendar/disconnect`, { method: 'DELETE', headers });
      queryClient.invalidateQueries({ queryKey: ['gcal-status'] });
      queryClient.invalidateQueries({ queryKey: QK.googleCalendarConnected });
      setConfirmDisconnect(false);
    } catch {
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--text-faint)] text-sm py-4">
        <Loader2 size={14} className="animate-spin" />
        Loading…
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="space-y-4">
        <div className="surface-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
            <span className="text-sm font-medium text-[var(--text)]">Connected</span>
          </div>
          {status.google_email && (
            <p className="text-sm text-[var(--text-dim)]">{status.google_email}</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[var(--danger)] text-xs">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <button
          onClick={() => setConfirmDisconnect(true)}
          className="flex items-center gap-2 text-sm text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
        >
          <Link2Off size={14} />
          Disconnect Google Calendar
        </button>

        {confirmDisconnect && (
          <div className="surface-border rounded-xl p-4 space-y-3">
            <p className="text-sm text-[var(--text)]">
              This will remove your Google Calendar connection. Existing study blocks will remain in your calendar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--danger)] text-white text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {disconnecting && <Loader2 size={13} className="animate-spin" />}
                Yes, disconnect
              </button>
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="px-3 py-1.5 rounded-lg surface-border text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-[var(--surface-2)] rounded-lg px-3 py-2.5">
        <Shield size={13} className="text-[var(--text-faint)] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[var(--text-faint)]">
          Google Calendar integration works best when you sign in with Google. If you signed up with email, you can still connect below.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[var(--danger)] text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {connecting
          ? <><Loader2 size={14} className="animate-spin" /> Connecting…</>
          : <>
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Google Calendar
            </>
        }
      </button>
    </div>
  );
}

// ── Dark mode toggle ─────────────────────────────────────────

function AppearanceSection() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--text)]">Dark mode</p>
        <p className="text-xs text-[var(--text-dim)] mt-0.5">Switch between light and dark appearance</p>
      </div>
      <button
        onClick={toggle}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        style={{ backgroundColor: isDark ? 'var(--accent)' : 'var(--border-strong)' }}
        role="switch"
        aria-checked={isDark}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform"
          style={{ transform: isDark ? 'translateX(24px)' : 'translateX(4px)' }}
        >
          {isDark
            ? <Moon size={9} className="text-[var(--accent)]" />
            : <Sun size={9} className="text-orange-400" />
          }
        </span>
      </button>
    </div>
  );
}

// ── Hidden courses ───────────────────────────────────────────

function HiddenCoursesSection() {
  const { data: allCourses = [], isLoading } = useAllCourses();
  const toggleHide = useToggleHideCourse();

  const hidden = allCourses.filter((c) => c.hidden);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--text-faint)] text-sm py-2">
        <Loader2 size={14} className="animate-spin" />
        Loading…
      </div>
    );
  }

  if (hidden.length === 0) {
    return (
      <p className="text-sm text-[var(--text-faint)]">No hidden courses.</p>
    );
  }

  return (
    <div className="surface-border rounded-xl overflow-hidden">
      <div className="divide-y divide-[var(--border)]">
        {hidden.map((course) => (
          <div key={course.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text)] truncate">{course.name}</p>
              <p className="text-xs font-mono text-[var(--text-faint)]">{course.course_code}</p>
            </div>
            <button
              onClick={() => {
                toggleHide.mutate(
                  { id: course.id, hidden: false },
                  { onSuccess: () => toast.success('Course unhidden') }
                );
              }}
              disabled={toggleHide.isPending}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            >
              <Eye size={13} />
              Unhide
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const gcal = searchParams.get('gcal');
    if (gcal === 'connected') {
      toast.success('Google Calendar connected');
      queryClient.invalidateQueries({ queryKey: ['gcal-status'] });
      queryClient.invalidateQueries({ queryKey: QK.googleCalendarConnected });
      // Remove the query param without a page reload
      router.replace('/dashboard/settings', { scroll: false });
    } else if (gcal === 'error') {
      toast.error('Failed to connect Google Calendar');
      router.replace('/dashboard/settings', { scroll: false });
    }
  }, [searchParams, router, queryClient]);

  return (
    <div className="p-6 max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl text-[var(--text)]">Settings</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">Manage your integrations and preferences.</p>
      </div>

      {/* Canvas */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={15} className="text-[var(--text-dim)]" />
          <h2 className="font-display font-600 text-base text-[var(--text)]">Canvas</h2>
        </div>
        <CanvasSection />
      </section>

      <div className="border-t border-[var(--border)]" />

      {/* Google Calendar */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-[var(--text-dim)]" />
          <h2 className="font-display font-600 text-base text-[var(--text)]">Google Calendar</h2>
        </div>
        <GoogleCalendarSection />
      </section>

      <div className="border-t border-[var(--border)]" />

      {/* Appearance */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sun size={15} className="text-[var(--text-dim)]" />
          <h2 className="font-display font-600 text-base text-[var(--text)]">Appearance</h2>
        </div>
        <AppearanceSection />
      </section>

      <div className="border-t border-[var(--border)]" />

      {/* Hidden courses */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <EyeOff size={15} className="text-[var(--text-dim)]" />
          <h2 className="font-display font-600 text-base text-[var(--text)]">Hidden Courses</h2>
        </div>
        <p className="text-xs text-[var(--text-dim)]">
          These courses are hidden from all views. Unhide to restore them.
        </p>
        <HiddenCoursesSection />
      </section>
    </div>
  );
}
