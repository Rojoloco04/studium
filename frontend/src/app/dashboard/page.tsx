'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCanvasConnected, useCourses, useAssignments } from '@/lib/queries';
import type { Assignment } from '@/lib/types';
import {
  BookOpen,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function isFinished(a: Assignment): boolean {
  return a.submitted || (a.score != null && a.score > 0);
}

function formatDue(
  dueAt: string | null,
  finished = false
): { text: string; color: string } {
  if (!dueAt) return { text: 'No due date', color: 'var(--text-faint)' };

  const now = new Date();
  const due = new Date(dueAt);

  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round(
    (dueDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dateLabel = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (diffDays < 0) {
    if (finished) return { text: dateLabel, color: 'var(--text-faint)' };
    const n = Math.abs(diffDays);
    return { text: `${n}d overdue`, color: 'var(--danger)' };
  }
  if (diffDays === 0)
    return { text: 'Due today', color: finished ? 'var(--text-faint)' : 'var(--warning)' };
  if (diffDays === 1)
    return { text: 'Tomorrow', color: finished ? 'var(--text-faint)' : 'var(--warning)' };
  if (diffDays <= 7)
    return { text: `In ${diffDays} days`, color: 'var(--text-dim)' };
  return { text: dateLabel, color: 'var(--text-faint)' };
}

// ─── StatCard ────────────────────────────────────────────────────────────────

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
        <span className="text-xs font-mono text-[var(--text-faint)] uppercase tracking-wider">
          {label}
        </span>
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            accent ? 'bg-[var(--accent-dim)]' : 'bg-[var(--surface-2)]'
          }`}
        >
          <Icon
            size={14}
            className={accent ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}
          />
        </div>
      </div>
      <div className="font-display font-700 text-2xl text-[var(--text)]">{value}</div>
      {sub && <div className="text-xs text-[var(--text-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const full = session.user.user_metadata?.full_name as string | undefined;
        setUserName(full?.split(' ')[0] ?? null);
      }
    });
  }, []);

  const { data: canvasConnected, isLoading: checkingCanvas } = useCanvasConnected();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: assignments = [], isLoading: loadingAssignments } = useAssignments();

  const loading = checkingCanvas || loadingCourses || loadingAssignments;

  const stats = useMemo(() => {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const courseCount = courses.length;

    const dueThisWeek = assignments.filter(
      (a) =>
        !isFinished(a) &&
        !!a.due_at &&
        new Date(a.due_at) >= now &&
        new Date(a.due_at) <= weekOut
    ).length;

    const scoredCourses = courses.filter((c) => c.current_score != null);
    const avgGrade =
      scoredCourses.length > 0
        ? Math.round(
            (scoredCourses.reduce((s, c) => s + c.current_score!, 0) /
              scoredCourses.length) *
              10
          ) / 10
        : null;

    const pastDueUnsubmitted = assignments.filter(
      (a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now
    ).length;

    const lowScoreCourses = courses.filter(
      (c) => c.current_score != null && c.current_score < 70
    ).length;

    return {
      courseCount,
      dueThisWeek,
      avgGrade,
      atRisk: pastDueUnsubmitted + lowScoreCourses,
      pastDueUnsubmitted,
      lowScoreCourses,
    };
  }, [courses, assignments]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return assignments
      .filter((a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now))
      .slice(0, 5);
  }, [assignments]);

  const encouragement = useMemo((): { text: string; color: string } | null => {
    if (!canvasConnected || loading) return null;
    const { dueThisWeek, atRisk, avgGrade, courseCount } = stats;

    if (atRisk > 3)
      return {
        text: `${atRisk} items need attention — tackle the overdue work first.`,
        color: 'var(--danger)',
      };
    if (dueThisWeek >= 5)
      return {
        text: `Busy week ahead with ${dueThisWeek} assignments due. Stay focused!`,
        color: 'var(--warning)',
      };
    if (atRisk > 0)
      return {
        text: `${atRisk} item${atRisk > 1 ? 's' : ''} need attention — you've got this.`,
        color: 'var(--warning)',
      };
    if (avgGrade != null && avgGrade >= 90)
      return {
        text: `Outstanding — averaging ${avgGrade}% across your courses.`,
        color: 'var(--success)',
      };
    if (avgGrade != null && avgGrade >= 80)
      return {
        text: `Solid work — keep that ${avgGrade}% average going.`,
        color: 'var(--accent)',
      };
    if (courseCount > 0 && dueThisWeek === 0 && atRisk === 0)
      return {
        text: 'All caught up — nothing urgent on the horizon.',
        color: 'var(--success)',
      };
    if (dueThisWeek > 0)
      return {
        text: `${dueThisWeek} assignment${dueThisWeek > 1 ? 's' : ''} due this week — keep chipping away.`,
        color: 'var(--text-dim)',
      };

    return null;
  }, [canvasConnected, loading, stats]);

  // At-risk sub text
  const atRiskSub = (() => {
    const { pastDueUnsubmitted, lowScoreCourses, atRisk } = stats;
    if (atRisk === 0) return 'all on track';
    if (pastDueUnsubmitted > 0 && lowScoreCourses > 0)
      return `${pastDueUnsubmitted} overdue · ${lowScoreCourses} low grade`;
    if (pastDueUnsubmitted > 0) return 'past due assignments';
    return 'low grade courses';
  })();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl text-[var(--text)]">
          {getGreeting()}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        {encouragement && (
          <p className="text-sm mt-2 font-medium" style={{ color: encouragement.color }}>
            {encouragement.text}
          </p>
        )}
      </div>

      {/* Canvas CTA if not connected */}
      {!loading && !canvasConnected && (
        <div className="mb-6 bg-[var(--accent-dim)] border border-[var(--accent)] border-opacity-30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap size={18} className="text-[var(--accent)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Connect Canvas to get started
              </p>
              <p className="text-xs text-[var(--text-dim)]">
                Pull your real courses, assignments, and grades automatically
              </p>
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
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-border rounded-xl p-5 animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="h-3 w-20 bg-[var(--surface-2)] rounded" />
                <div className="w-7 h-7 bg-[var(--surface-2)] rounded-lg" />
              </div>
              <div className="h-7 w-12 bg-[var(--surface-2)] rounded mb-1" />
              <div className="h-3 w-16 bg-[var(--surface-2)] rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Courses"
            value={canvasConnected ? stats.courseCount : '—'}
            icon={BookOpen}
            accent
          />
          <StatCard
            label="Due this week"
            value={canvasConnected ? stats.dueThisWeek : '—'}
            sub="assignments"
            icon={ClipboardList}
          />
          <StatCard
            label="Avg grade"
            value={
              canvasConnected
                ? stats.avgGrade != null
                  ? `${stats.avgGrade}%`
                  : '—'
                : '—'
            }
            icon={TrendingUp}
          />
          <StatCard
            label="At risk"
            value={canvasConnected ? stats.atRisk : '—'}
            sub={canvasConnected ? atRiskSub : undefined}
            icon={AlertCircle}
          />
        </div>
      )}

      {/* Upcoming assignments */}
      {canvasConnected && !loading && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-[var(--text-faint)] uppercase tracking-wider">
              Upcoming
            </span>
            <Link
              href="/dashboard/assignments"
              className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              View all →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="surface-border rounded-xl p-8 text-center">
              <p className="text-sm text-[var(--text-dim)]">
                All caught up — nothing due soon.
              </p>
            </div>
          ) : (
            <div className="surface-border rounded-xl overflow-hidden divide-y divide-[var(--border)]">
              {upcoming.map((a: Assignment) => {
                const now = new Date();
                const past = !!a.due_at && new Date(a.due_at) < now;
                const { text: dueText, color: dueColor } = formatDue(a.due_at);

                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {past ? (
                        <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
                      ) : (
                        <Clock size={15} style={{ color: 'var(--text-faint)' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">
                        {a.name}
                      </p>
                      {a.courses && (
                        <p className="text-xs text-[var(--text-faint)] mt-0.5 truncate">
                          {a.courses.name}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs font-mono flex-shrink-0"
                      style={{ color: dueColor }}
                    >
                      {dueText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Upcoming skeleton while loading */}
      {loading && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="h-3 w-20 bg-[var(--surface-2)] rounded animate-pulse" />
            <div className="h-3 w-12 bg-[var(--surface-2)] rounded animate-pulse" />
          </div>
          <div className="surface-border rounded-xl overflow-hidden divide-y divide-[var(--border)]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="w-4 h-4 rounded-full bg-[var(--surface-2)] flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-[var(--surface-2)] rounded w-2/5" />
                  <div className="h-2.5 bg-[var(--surface-2)] rounded w-1/4" />
                </div>
                <div className="h-3 bg-[var(--surface-2)] rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !canvasConnected && (
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
