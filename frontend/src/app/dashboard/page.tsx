'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCanvasConnected, useCourses, useAssignments, useToggleSubmitted } from '@/lib/queries';
import type { Assignment, Course } from '@/lib/types';
import { ArrowRight, GraduationCap, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function getDateLabel(dueAt: string | null): { label: string; state: 'overdue' | 'today' | 'done' | 'normal' } {
  if (!dueAt) return { label: 'No date', state: 'normal' };
  const now = new Date();
  const due = new Date(dueAt);
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - nowDay.getTime()) / 86400000);
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0) return { label, state: 'overdue' };
  if (diff === 0) return { label: 'Today', state: 'today' };
  if (diff === 1) return { label: 'Tomorrow', state: 'normal' };
  return { label, state: 'normal' };
}

function gradeColor(score: number | null | undefined): string {
  if (score == null) return 'var(--text)';
  if (score < 70) return 'var(--danger)';
  if (score < 80) return 'var(--warning)';
  return 'var(--text)';
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip({
  courseCount,
  dueThisWeek,
  avgGrade,
  atRisk,
  atRiskSub,
  canvasConnected,
  lowScoreCourseList,
  pastDueUnsubmitted,
}: {
  courseCount: number;
  dueThisWeek: number;
  avgGrade: number | null;
  atRisk: number;
  atRiskSub: string;
  canvasConnected: boolean;
  lowScoreCourseList: Course[];
  pastDueUnsubmitted: number;
}) {
  const stats = [
    {
      label: 'Courses',
      value: canvasConnected ? String(courseCount).padStart(2, '0') : '—',
      foot: canvasConnected ? `${dueThisWeek} with work this wk` : 'Connect Canvas',
      href: canvasConnected ? '/dashboard/courses' : undefined,
      risk: false,
    },
    {
      label: 'Due this week',
      value: canvasConnected ? String(dueThisWeek).padStart(2, '0') : '—',
      foot: canvasConnected ? 'Across your courses' : '',
      href: canvasConnected ? '/dashboard/assignments' : undefined,
      risk: false,
    },
    {
      label: 'Average',
      value: canvasConnected && avgGrade != null ? `${avgGrade}` : '—',
      unit: canvasConnected && avgGrade != null ? '%' : '',
      foot: canvasConnected ? 'Current grade avg' : '',
      href: canvasConnected ? '/dashboard/grades' : undefined,
      risk: false,
    },
    {
      label: 'At risk',
      value: canvasConnected ? String(atRisk).padStart(2, '0') : '—',
      foot: canvasConnected ? atRiskSub : '',
      href: canvasConnected ? '/dashboard/grades' : undefined,
      risk: canvasConnected && atRisk > 0,
    },
  ];

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 mb-8"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      {stats.map((s, i) => {
        const inner = (
          <>
            <div
              className="mb-3.5"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 44,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                color: s.risk ? 'var(--danger)' : 'var(--text)',
              }}
            >
              {s.value}
              {s.unit && (
                <span style={{ fontSize: 16, color: 'var(--text-faint)', marginLeft: 2 }}>
                  {s.unit}
                </span>
              )}
            </div>
            {s.foot && (
              <div
                className="mt-2.5"
                style={{
                  fontSize: 12,
                  color: s.risk ? 'var(--danger)' : 'var(--text-faint)',
                  opacity: s.risk ? 0.85 : 1,
                }}
              >
                {s.foot}
              </div>
            )}
          </>
        );

        const cls =
          'py-7 pr-8 ' +
          (i === 0 ? 'pl-0 ' : 'pl-8 ') +
          (i < stats.length - 1 ? '' : '');

        return s.href ? (
          <Link
            key={s.label}
            href={s.href}
            className={cls}
            style={{
              borderRight: i < stats.length - 1 ? '1px solid var(--border-soft)' : 'none',
              textDecoration: 'none',
              display: 'block',
            }}
          >
            {inner}
          </Link>
        ) : (
          <div
            key={s.label}
            className={cls}
            style={{ borderRight: i < stats.length - 1 ? '1px solid var(--border-soft)' : 'none' }}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat Strip Skeleton ──────────────────────────────────────────────────────

function StatsStripSkeleton() {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 mb-8 animate-pulse"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="py-7 pr-8"
          style={{
            paddingLeft: i === 0 ? 0 : 32,
            borderRight: i < 3 ? '1px solid var(--border-soft)' : 'none',
          }}
        >
          <div className="h-2.5 w-20 rounded mb-4" style={{ background: 'var(--surface-2)' }} />
          <div className="h-10 w-14 rounded mb-2.5" style={{ background: 'var(--surface-2)' }} />
          <div className="h-2.5 w-24 rounded" style={{ background: 'var(--surface-2)' }} />
        </div>
      ))}
    </div>
  );
}

// ─── Tick Button ─────────────────────────────────────────────────────────────

function TickButton({
  done,
  onClick,
}: {
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={done ? 'Unmark' : 'Mark done'}
      className="flex-shrink-0 flex items-center justify-center rounded-full transition-colors"
      style={{
        width: 16,
        height: 16,
        border: done ? '1px solid var(--success)' : '1px solid var(--border)',
        background: done ? 'var(--success)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {done && (
        <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
          <path d="M1 2.5L2.8 4.2L6 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ─── Assignment Row ───────────────────────────────────────────────────────────

function AssignmentRow({ a, onToggle }: { a: Assignment; onToggle: () => void }) {
  const finished = isFinished(a);
  const { label, state } = getDateLabel(a.due_at);

  const dateColor =
    state === 'overdue' ? 'var(--danger)' :
    state === 'today' ? 'var(--accent)' :
    finished ? 'var(--text-faint2)' :
    'var(--text-faint)';

  return (
    <div
      className="group grid items-baseline py-[18px]"
      style={{
        gridTemplateColumns: '88px 1fr 180px 120px 28px',
        gap: 24,
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.04em',
          color: dateColor,
          textDecoration: finished ? 'line-through' : 'none',
        }}
      >
        {label}
      </span>
      <div
        className="text-sm leading-snug truncate"
        style={{ color: finished ? 'var(--text-faint)' : 'var(--text)' }}
      >
        {a.name}
      </div>
      <span
        className="truncate"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-faint)',
          letterSpacing: '0.02em',
        }}
      >
        {a.courses?.name ?? ''}
      </span>
      <span
        className="text-right"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-faint)',
        }}
      >
        {a.points_possible != null && (
          <>
            {a.score != null && (
              <span style={{ color: 'var(--text)' }}>{a.score} / </span>
            )}
            {a.points_possible} pts
          </>
        )}
      </span>
      <div className="flex items-center justify-end">
        <TickButton done={finished} onClick={onToggle} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const toggleSubmitted = useToggleSubmitted();

  const loading = checkingCanvas || loadingCourses || loadingAssignments;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const stats = useMemo(() => {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const courseCount = courses.length;
    const dueThisWeek = assignments.filter(
      (a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) >= now && new Date(a.due_at) <= weekOut
    ).length;
    const scoredCourses = courses.filter((c) => c.current_score != null);
    const avgGrade =
      scoredCourses.length > 0
        ? Math.round((scoredCourses.reduce((s, c) => s + c.current_score!, 0) / scoredCourses.length) * 10) / 10
        : null;
    const pastDueUnsubmitted = assignments.filter(
      (a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now
    ).length;
    const lowScoreCourseList = courses.filter((c) => c.current_score != null && c.current_score < 70);
    return {
      courseCount, dueThisWeek, avgGrade,
      atRisk: pastDueUnsubmitted + lowScoreCourseList.length,
      pastDueUnsubmitted,
      lowScoreCourseList,
    };
  }, [courses, assignments]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return assignments
      .filter((a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now))
      .slice(0, 6);
  }, [assignments]);

  const atRiskSub = (() => {
    const { pastDueUnsubmitted, atRisk } = stats;
    const low = stats.lowScoreCourseList.length;
    if (atRisk === 0) return 'all on track';
    if (pastDueUnsubmitted > 0 && low > 0) return `${pastDueUnsubmitted} overdue · ${low} low grade`;
    if (pastDueUnsubmitted > 0) return 'past due assignments';
    return 'low grade courses';
  })();

  const encouragement = useMemo((): string | null => {
    if (!canvasConnected || loading) return null;
    const { dueThisWeek, atRisk, avgGrade, courseCount } = stats;
    if (atRisk > 3) return `${atRisk} items need attention — tackle the overdue work first.`;
    if (dueThisWeek >= 5) return `Busy week ahead with ${dueThisWeek} assignments due. Stay focused.`;
    if (atRisk > 0) return `${atRisk} item${atRisk > 1 ? 's' : ''} need${atRisk > 1 ? '' : 's'} attention — you've got this.`;
    if (avgGrade != null && avgGrade >= 90) return `Outstanding — averaging ${avgGrade}% across your courses.`;
    if (avgGrade != null && avgGrade >= 80) return `Solid work — keep that ${avgGrade}% average going.`;
    if (courseCount > 0 && dueThisWeek === 0 && atRisk === 0) return 'All caught up — nothing urgent on the horizon.';
    return null;
  }, [canvasConnected, loading, stats]);

  return (
    <div className="px-10 py-14 max-w-[1080px]">

      {/* Page header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              marginBottom: 12,
            }}
          >
            {today}
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 56,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              fontWeight: 400,
              whiteSpace: 'nowrap',
            }}
          >
            {getGreeting()},{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>
              {userName ?? 'there'}.
            </em>
          </h1>
          {encouragement && (
            <p
              className="mt-3.5 max-w-lg"
              style={{ fontSize: 13.5, color: 'var(--text-faint)', lineHeight: 1.55 }}
            >
              {encouragement}
            </p>
          )}
        </div>
        {canvasConnected && !loading && (
          <div
            className="text-right flex-shrink-0 ml-10"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.7 }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'var(--text)',
                letterSpacing: 0,
                marginBottom: 4,
              }}
            >
              {stats.courseCount} courses
            </div>
            <div>{stats.dueThisWeek} due this week</div>
            <div>{stats.atRisk > 0 ? `${stats.atRisk} at risk` : 'All on track'}</div>
          </div>
        )}
      </div>

      {/* Canvas CTA */}
      {!loading && !canvasConnected && (
        <div
          className="mb-8 flex items-center justify-between rounded p-4"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <GraduationCap size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Connect Canvas to get started</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                Pull your real courses, assignments, and grades automatically
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/canvas"
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded ml-4 flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: 'var(--background)', fontWeight: 500 }}
          >
            Connect <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Stats strip */}
      {loading ? (
        <StatsStripSkeleton />
      ) : (
        <StatsStrip
          courseCount={stats.courseCount}
          dueThisWeek={stats.dueThisWeek}
          avgGrade={stats.avgGrade}
          atRisk={stats.atRisk}
          atRiskSub={atRiskSub}
          canvasConnected={!!canvasConnected}
          lowScoreCourseList={stats.lowScoreCourseList}
          pastDueUnsubmitted={stats.pastDueUnsubmitted}
        />
      )}

      {/* Two-column grid */}
      {canvasConnected && (
        <div className="grid gap-10" style={{ gridTemplateColumns: '1fr 300px' }}>

          {/* Main: upcoming assignments */}
          <div>
            <div className="flex items-baseline justify-between mb-5">
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 26,
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                }}
              >
                Upcoming, <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>by urgency</em>
              </h2>
              <Link
                href="/dashboard/assignments"
                className="text-xs transition-colors hover:text-[var(--text)]"
                style={{ color: 'var(--text-faint)' }}
              >
                All assignments →
              </Link>
            </div>

            <div style={{ borderTop: '1px solid var(--border)' }}>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="grid py-[18px] animate-pulse"
                    style={{
                      gridTemplateColumns: '88px 1fr 180px 120px 28px',
                      gap: 24,
                      borderBottom: '1px solid var(--border-soft)',
                    }}
                  >
                    <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: 60 }} />
                    <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: '60%' }} />
                    <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: 100 }} />
                    <div />
                    <div />
                  </div>
                ))
              ) : upcoming.length === 0 ? (
                <div className="py-16 text-center" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                  All caught up — nothing due soon.
                </div>
              ) : (
                upcoming.map((a: Assignment) => (
                  <AssignmentRow
                    key={a.id}
                    a={a}
                    onToggle={() => toggleSubmitted.mutate({ id: a.id, submitted: !a.submitted })}
                  />
                ))
              )}
            </div>

            {!loading && (
              <p
                className="mt-6 max-w-xl"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 17,
                  color: 'var(--text-dim)',
                  lineHeight: 1.45,
                }}
              >
                &ldquo;Plans are worthless, but planning is everything.&rdquo;
                &nbsp;
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontStyle: 'normal',
                    fontSize: 10.5,
                    color: 'var(--text-faint2)',
                    letterSpacing: '0.08em',
                  }}
                >
                  — EISENHOWER
                </span>
              </p>
            )}
          </div>

          {/* Sidebar: courses at a glance */}
          <aside>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div
                className="mb-3.5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}
              >
                Courses · current grade
              </div>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-baseline py-2.5 animate-pulse"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                  >
                    <div className="h-3 rounded w-28" style={{ background: 'var(--surface-2)' }} />
                    <div className="h-5 rounded w-8" style={{ background: 'var(--surface-2)' }} />
                  </div>
                ))
              ) : (
                courses.map((c: Course) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/courses/${c.id}`}
                    className="flex justify-between items-baseline py-2.5 transition-colors hover:text-[var(--accent)]"
                    style={{
                      borderBottom: '1px solid var(--border-soft)',
                      textDecoration: 'none',
                    }}
                  >
                    <div>
                      <div className="text-sm" style={{ color: 'var(--text)' }}>{c.name}</div>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10.5,
                          color: 'var(--text-faint)',
                          display: 'block',
                          marginTop: 2,
                        }}
                      >
                        {c.course_code}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 20,
                        letterSpacing: '-0.01em',
                        color: gradeColor(c.current_score),
                      }}
                    >
                      {c.current_score != null ? `${Math.round(c.current_score)}` : '—'}
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Planner link */}
            <div
              style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 32 }}
            >
              <div
                className="mb-1.5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}
              >
                Planner
              </div>
              <Link
                href="/dashboard/planner"
                className="text-xs transition-colors hover:text-[var(--text)]"
                style={{
                  color: 'var(--text-faint)',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 2,
                  display: 'inline-block',
                  marginTop: 8,
                }}
              >
                Open planner →
              </Link>
            </div>
          </aside>

        </div>
      )}

      {/* Empty state when not connected */}
      {!loading && !canvasConnected && (
        <div
          className="py-16 text-center rounded"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <GraduationCap size={28} className="mx-auto mb-4" style={{ color: 'var(--text-faint)' }} />
          <h3
            className="mb-2"
            style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400 }}
          >
            No course data yet
          </h3>
          <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--text-faint)' }}>
            Connect Canvas to automatically import your courses, assignments, and grades.
          </p>
          <Link
            href="/dashboard/canvas"
            className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--background)', fontWeight: 500 }}
          >
            Connect Canvas <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Footer rule */}
      {!loading && (
        <div
          className="flex justify-between mt-14 pt-5"
          style={{
            borderTop: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--text-faint2)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <span>Studium</span>
          <span>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
}
