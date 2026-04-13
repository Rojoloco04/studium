'use client';

import { useState } from 'react';
import { GraduationCap, ExternalLink, Check, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function CanvasSetupPage() {
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/canvas/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ domain: domain.replace(/\/$/, ''), token }),
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          throw new Error(data.detail || 'Failed to connect');
        }
        throw new Error(`Server error (${res.status}) — check that the API URL is configured correctly`);
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="surface-border rounded-xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--success)] bg-opacity-15 flex items-center justify-center mx-auto mb-4">
            <Check size={22} className="text-[var(--success)]" />
          </div>
          <h2 className="font-display font-700 text-xl mb-2">Canvas connected</h2>
          <p className="text-[var(--text-dim)] text-sm mb-6">
            Your courses and assignments are syncing in the background.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl">Connect Canvas</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          Link your Canvas account to import courses and assignments automatically.
        </p>
      </div>

      {/* Instructions */}
      <div className="surface-border rounded-xl p-5 mb-6">
        <h3 className="font-display font-600 text-sm mb-3">How to get your token</h3>
        <ol className="space-y-2 text-sm text-[var(--text-dim)]">
          <li className="flex gap-2">
            <span className="font-mono text-[var(--accent)] flex-shrink-0">1.</span>
            Open Canvas and go to <strong className="text-[var(--text)]">Account → Settings</strong>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[var(--accent)] flex-shrink-0">2.</span>
            Scroll to <strong className="text-[var(--text)]">Approved Integrations</strong> and click <strong className="text-[var(--text)]">+ New Access Token</strong>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[var(--accent)] flex-shrink-0">3.</span>
            Name it <strong className="text-[var(--text)]">Studium</strong>, set an expiry, and copy the token
          </li>
        </ol>
        <a
          href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[var(--accent)] text-xs mt-4 hover:underline"
        >
          Canvas help docs
          <ExternalLink size={11} />
        </a>
      </div>

      {/* Form */}
      <form onSubmit={handleConnect} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-[var(--text-dim)] mb-1.5">
            Canvas domain
          </label>
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
          <label className="block text-xs font-mono text-[var(--text-dim)] mb-1.5">
            Access token
          </label>
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
          <GraduationCap size={13} className="text-[var(--text-faint)]" />
          <p className="text-xs text-[var(--text-faint)]">
            Your token is encrypted and never shared. You can revoke it from Canvas at any time.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Connect Canvas
        </button>
      </form>
    </div>
  );
}
