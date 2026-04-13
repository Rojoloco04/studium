import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import Link from 'next/link';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="surface-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-[var(--text-faint)] uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent ? 'bg-[var(--accent-dim)]' : 'bg-[var(--surface-2)]'}`}>
          <Icon size={14} className={accent ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'} />
        </div>
      </div>
      <div className="font-display font-700 text-2xl text-[var(--text)]">{value}</div>
      {sub && <div className="text-xs text-[var(--text-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Check if Canvas is connected
  const { data: canvasToken } = await supabase
    .from('canvas_tokens')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const canvasConnected = !!canvasToken;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl text-[var(--text)]">
          Good morning
        </h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Canvas CTA if not connected */}
      {!canvasConnected && (
        <div className="mb-6 bg-[var(--accent-dim)] border border-[var(--accent)] border-opacity-30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap size={18} className="text-[var(--accent)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Connect Canvas to get started</p>
              <p className="text-xs text-[var(--text-dim)]">Pull your real courses, assignments, and grades automatically</p>
            </div>
          </div>
          <Link
            href="/dashboard/canvas"
            className="flex items-center gap-1.5 bg-[var(--accent)] text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium flex-shrink-0 ml-4"
          >
            Connect
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Courses" value={canvasConnected ? '—' : '0'} icon={BookOpen} accent />
        <StatCard label="Due this week" value={canvasConnected ? '—' : '0'} sub="assignments" icon={ClipboardList} />
        <StatCard label="Avg grade" value={canvasConnected ? '—' : 'N/A'} icon={TrendingUp} />
        <StatCard label="At risk" value={canvasConnected ? '—' : '0'} sub="assignments" icon={AlertCircle} />
      </div>

      {/* Empty state */}
      {!canvasConnected && (
        <div className="surface-border rounded-xl p-12 text-center">
          <GraduationCap size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
          <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">
            No course data yet
          </h3>
          <p className="text-[var(--text-dim)] text-sm max-w-xs mx-auto mb-5">
            Connect Canvas to automatically import your courses, assignments, and grades.
          </p>
          <Link
            href="/dashboard/canvas"
            className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Connect Canvas
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
