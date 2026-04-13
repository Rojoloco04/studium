'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Check } from 'lucide-react';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex gap-3 mt-1.5">
      {checks.map(({ label, ok }) => (
        <div key={label} className="flex items-center gap-1">
          <Check size={10} className={ok ? 'text-[var(--success)]' : 'text-[var(--text-faint)]'} />
          <span className={`text-xs font-mono ${ok ? 'text-[var(--success)]' : 'text-[var(--text-faint)]'}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display font-800 text-2xl text-[var(--text)]">
            studium
          </span>
          <p className="text-[var(--text-dim)] text-sm mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-3">
          <div>
            <label className="block text-xs font-mono text-[var(--text-dim)] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="you@university.edu"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[var(--text-dim)] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="••••••••"
            />
            <PasswordStrength password={password} />
          </div>

          {error && <p className="text-[var(--danger)] text-xs font-mono">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Create account
          </button>
        </form>

        <p className="text-center text-[var(--text-faint)] text-xs mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--accent)] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
