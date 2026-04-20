'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/lib/theme';
import { useAllCourses, useToggleHideCourse, QK } from '@/lib/queries';
import { useSyncCanvas } from '@/lib/sync-provider';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  Link2Off,
  Shield,
  RefreshCw,
  Eye,
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

// ── Shared section wrapper ───────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 20 }}>
        {label}
      </div>
      {children}
    </section>
  );
}

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
      <div className="flex items-center gap-2" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
        <Loader2 size={13} className="animate-spin" />
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
      <div className="space-y-5">
        {/* Status row */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid py-4" style={{ gridTemplateColumns: '140px 1fr', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span>
            <span className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--text)' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--success)', flexShrink: 0 }} />
              Connected
            </span>
          </div>
          {displayName && (
            <div className="grid py-4" style={{ gridTemplateColumns: '140px 1fr', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Account</span>
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{displayName}</span>
            </div>
          )}
          {displayDomain && (
            <div className="grid py-4" style={{ gridTemplateColumns: '140px 1fr', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Domain</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', wordBreak: 'break-all' }}>{displayDomain}</span>
            </div>
          )}
          {status?.courses_count !== undefined && (
            <div className="grid py-4" style={{ gridTemplateColumns: '140px 1fr', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>{status.courses_count} courses · {status.assignments_count} assignments</span>
            </div>
          )}
          {lastSynced && (
            <div className="grid py-4" style={{ gridTemplateColumns: '140px 1fr', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Last synced</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{lastSynced}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2" style={{ color: 'var(--danger)', fontSize: 12 }}>
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-5">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <button
            onClick={() => setConfirmDisconnect(true)}
            className="flex items-center gap-1.5 transition-colors"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <Link2Off size={12} />
            Disconnect
          </button>
        </div>

        {confirmDisconnect && (
          <div className="p-4 space-y-3" style={{ border: '1px solid var(--border)', borderRadius: 2 }}>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>
              This will remove your Canvas token and all synced data. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: 'var(--danger)', color: 'white', fontSize: 12, padding: '6px 14px', borderRadius: 2, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                {disconnecting && <Loader2 size={12} className="animate-spin" />}
                Yes, disconnect
              </button>
              <button
                onClick={() => setConfirmDisconnect(false)}
                style={{ background: 'none', border: '1px solid var(--border)', fontSize: 12, padding: '6px 14px', borderRadius: 2, cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}
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
    <div className="space-y-5">
      {/* Instructions */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {[
          ['1.', <>Open Canvas → <strong style={{ color: 'var(--text)' }}>Account → Settings</strong></>],
          ['2.', <>Scroll to <strong style={{ color: 'var(--text)' }}>Approved Integrations</strong> → <strong style={{ color: 'var(--text)' }}>+ New Access Token</strong></>],
          ['3.', <>Name it <strong style={{ color: 'var(--text)' }}>Studium</strong>, set an expiry, copy the token</>],
        ].map(([num, text], i) => (
          <div key={i} className="grid py-3.5" style={{ gridTemplateColumns: '28px 1fr', gap: 12, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{num}</span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{text as React.ReactNode}</span>
          </div>
        ))}
      </div>
      <a
        href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
      >
        Canvas help docs <ExternalLink size={11} />
      </a>

      <form onSubmit={handleConnect} className="space-y-3 pt-2">
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Canvas domain
          </label>
          <input
            type="url"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
            placeholder="https://youruniversity.instructure.com"
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', padding: '8px 0', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Access token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            placeholder="Paste your Canvas access token"
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', padding: '8px 0', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2" style={{ color: 'var(--danger)', fontSize: 12 }}>
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        <div className="flex items-start gap-2 py-2">
          <Shield size={12} style={{ color: 'var(--text-faint)', marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            Your token is encrypted at rest. Revoke it from Canvas at any time.
          </p>
        </div>

        <button
          type="submit"
          disabled={connecting}
          className="flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--text)', color: 'var(--background)', fontSize: 12, fontFamily: 'var(--font-mono)', padding: '10px 20px', borderRadius: 2, border: 'none', cursor: 'pointer', letterSpacing: '0.05em', width: '100%' }}
        >
          {connecting && <Loader2 size={13} className="animate-spin" />}
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
  const [syncing, setSyncing] = useState(false);
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

  async function handleSync() {
    setSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      toast.success('Calendar synced');
    } catch {
      toast.error('Failed to sync calendar');
    } finally {
      setSyncing(false);
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
      <div className="flex items-center gap-2" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
        <Loader2 size={13} className="animate-spin" />
        Loading…
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="space-y-5">
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid py-4" style={{ gridTemplateColumns: '140px 1fr', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span>
            <span className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--text)' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--success)', flexShrink: 0 }} />
              Connected
            </span>
          </div>
          {status.google_email && (
            <div className="grid py-4" style={{ gridTemplateColumns: '140px 1fr', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Account</span>
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{status.google_email}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2" style={{ color: 'var(--danger)', fontSize: 12 }}>
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-5">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync calendar'}
          </button>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <button
            onClick={() => setConfirmDisconnect(true)}
            className="flex items-center gap-1.5 transition-colors"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <Link2Off size={12} />
            Disconnect
          </button>
        </div>

        {confirmDisconnect && (
          <div className="p-4 space-y-3" style={{ border: '1px solid var(--border)', borderRadius: 2 }}>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>
              This will remove your Google Calendar connection. Existing study blocks will remain in your calendar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: 'var(--danger)', color: 'white', fontSize: 12, padding: '6px 14px', borderRadius: 2, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                {disconnecting && <Loader2 size={12} className="animate-spin" />}
                Yes, disconnect
              </button>
              <button
                onClick={() => setConfirmDisconnect(false)}
                style={{ background: 'none', border: '1px solid var(--border)', fontSize: 12, padding: '6px 14px', borderRadius: 2, cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}
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
      <div className="flex items-start gap-2">
        <Shield size={12} style={{ color: 'var(--text-faint)', marginTop: 1, flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
          Works best when you sign in with Google. If you signed up with email, you can still connect below.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2" style={{ color: 'var(--danger)', fontSize: 12 }}>
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 disabled:opacity-50 transition-opacity"
        style={{ background: 'var(--text)', color: 'var(--background)', fontSize: 12, fontFamily: 'var(--font-mono)', padding: '10px 20px', borderRadius: 2, border: 'none', cursor: 'pointer', letterSpacing: '0.05em' }}
      >
        {connecting
          ? <><Loader2 size={13} className="animate-spin" /> Connecting…</>
          : <>
              <svg width="13" height="13" viewBox="0 0 24 24">
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

// ── Appearance section ───────────────────────────────────────

function AppearanceSection() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-between">
      <div>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>Dark mode</p>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>Switch between light and dark appearance</p>
      </div>
      <button
        onClick={toggle}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none"
        style={{ backgroundColor: isDark ? 'var(--accent)' : 'var(--border-strong)' }}
        role="switch"
        aria-checked={isDark}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform"
          style={{ transform: isDark ? 'translateX(24px)' : 'translateX(4px)' }}
        />
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
      <div className="flex items-center gap-2" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
        <Loader2 size={13} className="animate-spin" />
        Loading…
      </div>
    );
  }

  if (hidden.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No hidden courses.</p>
    );
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {hidden.map((course) => (
        <div key={course.id} className="flex items-center justify-between gap-4 py-3.5" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <div className="min-w-0">
            <p style={{ fontSize: 13, color: 'var(--text)' }} className="truncate">{course.name}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>{course.course_code}</p>
          </div>
          <button
            onClick={() => {
              toggleHide.mutate(
                { id: course.id, hidden: false },
                { onSuccess: () => toast.success('Course unhidden') }
              );
            }}
            disabled={toggleHide.isPending}
            className="flex-shrink-0 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            <Eye size={12} />
            Unhide
          </button>
        </div>
      ))}
    </div>
  );
}

// ── GCal callback handler ────────────────────────────────────

function GCalCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const gcal = searchParams.get('gcal');
    if (gcal === 'connected') {
      toast.success('Google Calendar connected');
      queryClient.invalidateQueries({ queryKey: ['gcal-status'] });
      queryClient.invalidateQueries({ queryKey: QK.googleCalendarConnected });
      router.replace('/dashboard/settings', { scroll: false });
    } else if (gcal === 'error') {
      toast.error('Failed to connect Google Calendar');
      router.replace('/dashboard/settings', { scroll: false });
    }
  }, [searchParams, router, queryClient]);

  return null;
}

// ── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="px-10 py-14 max-w-[640px]">
      <Suspense>
        <GCalCallbackHandler />
      </Suspense>

      {/* Page header */}
      <div className="mb-8">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
          Settings
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
          Integrations &amp; <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>preferences</em>.
        </h1>
      </div>

      <div className="space-y-12">
        <Section label="Canvas">
          <CanvasSection />
        </Section>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        <Section label="Google Calendar">
          <GoogleCalendarSection />
        </Section>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        <Section label="Appearance">
          <AppearanceSection />
        </Section>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        <Section label="Hidden Courses">
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.5 }}>
            These courses are hidden from all views. Unhide to restore them.
          </p>
          <HiddenCoursesSection />
        </Section>
      </div>
    </div>
  );
}
