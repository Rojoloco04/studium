'use client';

import { useMemo, useState } from 'react';
import {
  useAssignments,
  useCanvasConnected,
  useToggleSubmitted,
} from '@/lib/queries';
import type { Assignment } from '@/lib/types';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

type FilterTab = 'all' | 'upcoming' | 'past_due' | 'finished';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past_due', label: 'Past Due' },
  { id: 'finished', label: 'Finished' },
];

// Finished = manually marked OR Canvas recorded a non-zero grade.
// score=0 is treated as a genuine miss, not finished.
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

  // Compare calendar days in local timezone to avoid UTC off-by-one.
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
    return {
      text: 'Due today',
      color: finished ? 'var(--text-faint)' : 'var(--warning)',
    };
  if (diffDays === 1)
    return {
      text: 'Tomorrow',
      color: finished ? 'var(--text-faint)' : 'var(--warning)',
    };
  if (diffDays <= 7)
    return { text: `In ${diffDays} days`, color: 'var(--text-dim)' };
  return { text: dateLabel, color: 'var(--text-faint)' };
}

function scorePct(score: number, points: number): string {
  return `${Math.round((score / points) * 100)}%`;
}

export default function AssignmentsPage() {
  const { data: canvasConnected, isLoading: checkingCanvas } =
    useCanvasConnected();
  const { data: assignments = [], isLoading: loadingAssignments } =
    useAssignments();
  const toggleSubmitted = useToggleSubmitted();

  const [filter, setFilter] = useState<FilterTab>('upcoming');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  const loading = checkingCanvas || loadingAssignments;

  const courses = useMemo(() => {
    const seen = new Set<string>();
    return assignments
      .reduce<{ id: string; name: string; course_code: string }[]>((acc, a) => {
        if (!seen.has(a.course_id) && a.courses) {
          seen.add(a.course_id);
          acc.push({ id: a.course_id, ...a.courses });
        }
        return acc;
      }, [])
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments]);

  const counts = useMemo(() => {
    const now = new Date();
    return {
      all: assignments.length,
      upcoming: assignments.filter(
        (a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now)
      ).length,
      past_due: assignments.filter(
        (a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now
      ).length,
      finished: assignments.filter(isFinished).length,
    };
  }, [assignments]);

  const filtered = useMemo(() => {
    const now = new Date();
    const list =
      courseFilter === 'all'
        ? assignments
        : assignments.filter((a) => a.course_id === courseFilter);

    switch (filter) {
      case 'upcoming':
        return list.filter(
          (a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now)
        );
      case 'past_due':
        return list
          .filter(
            (a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now
          )
          .sort(
            (a, b) =>
              new Date(b.due_at!).getTime() - new Date(a.due_at!).getTime()
          );
      case 'finished':
        return list.filter(isFinished);
      default:
        return list;
    }
  }, [assignments, filter, courseFilter]);

  // Canvas not connected
  if (!loading && !canvasConnected) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-700 text-2xl">Assignments</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">
            All assignments across your courses
          </p>
        </div>
        <div className="surface-border rounded-xl p-12 text-center">
          <ClipboardList
            size={32}
            className="text-[var(--text-faint)] mx-auto mb-4"
          />
          <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">
            No assignments yet
          </h3>
          <p className="text-[var(--text-dim)] text-sm max-w-xs mx-auto mb-5">
            Connect Canvas to import your assignments automatically.
          </p>
          <Link
            href="/dashboard/canvas"
            className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Connect Canvas
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-700 text-2xl">Assignments</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          {loading
            ? 'Loading…'
            : `${assignments.length} assignment${assignments.length !== 1 ? 's' : ''} across ${courses.length} course${courses.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-0.5 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === tab.id
                  ? 'bg-[var(--surface-2)] text-[var(--text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              )}
            >
              {tab.label}
              {!loading && (
                <span
                  className={clsx(
                    'text-xs font-mono',
                    filter === tab.id
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-faint)]'
                  )}
                >
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {courses.length > 1 && (
          <div className="relative">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="appearance-none bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-sm pl-3 pr-8 py-1.5 rounded-lg cursor-pointer focus:outline-none focus:border-[var(--accent)] transition-colors"
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="surface-border rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="px-5 py-3.5 flex items-center gap-4 animate-pulse"
            >
              <div className="w-4 h-4 rounded-full bg-[var(--surface-2)] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-[var(--surface-2)] rounded w-2/5" />
                <div className="h-2.5 bg-[var(--surface-2)] rounded w-1/4" />
              </div>
              <div className="h-3 bg-[var(--surface-2)] rounded w-20 hidden sm:block" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-16" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-border rounded-xl p-10 text-center">
          <ClipboardList
            size={28}
            className="text-[var(--text-faint)] mx-auto mb-3"
          />
          <p className="text-[var(--text-dim)] text-sm">
            {filter === 'upcoming' && 'No upcoming assignments — nice!'}
            {filter === 'past_due' && 'No past due assignments.'}
            {filter === 'finished' && 'No finished assignments yet.'}
            {filter === 'all' && 'No assignments found.'}
          </p>
        </div>
      ) : (
        <div className="surface-border rounded-xl overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((a: Assignment) => {
              const now = new Date();
              const past = !!a.due_at && new Date(a.due_at) < now;
              const finished = isFinished(a);
              // Manually marked = submitted flag set by the user, no Canvas grade yet.
              const canUnmark = a.submitted && a.score == null;
              // Can toggle if: not finished (show "Mark done") OR manually marked (show "Unmark").
              const canToggle = !finished || canUnmark;
              const { text: dueText, color: dueColor } = formatDue(
                a.due_at,
                finished
              );

              return (
                <div
                  key={a.id}
                  className="group flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {finished ? (
                      <CheckCircle2
                        size={15}
                        style={{ color: 'var(--success)' }}
                      />
                    ) : past ? (
                      <AlertCircle
                        size={15}
                        style={{ color: 'var(--danger)' }}
                      />
                    ) : (
                      <Clock size={15} style={{ color: 'var(--text-faint)' }} />
                    )}
                  </div>

                  {/* Name + course */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={clsx(
                        'text-sm font-medium truncate',
                        finished ? 'text-[var(--text-dim)]' : 'text-[var(--text)]'
                      )}
                    >
                      {a.name}
                    </p>
                    {a.courses && (
                      <p className="text-xs text-[var(--text-faint)] mt-0.5 truncate">
                        {a.courses.name}
                      </p>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0 hidden sm:block min-w-[120px]">
                    {a.points_possible != null && (
                      <span className="text-xs font-mono">
                        {a.score != null ? (
                          <>
                            <span
                              style={{
                                color:
                                  a.score / a.points_possible >= 0.7
                                    ? 'var(--text)'
                                    : 'var(--danger)',
                              }}
                            >
                              {a.score}
                            </span>
                            <span style={{ color: 'var(--text-faint)' }}>
                              {' '}/ {a.points_possible} pts
                            </span>
                            <span
                              style={{ color: 'var(--text-faint)' }}
                              className="ml-1"
                            >
                              ({scorePct(a.score, a.points_possible)})
                            </span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-faint)' }}>
                            — / {a.points_possible} pts
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Due date — swaps to action button on row hover */}
                  <div className="flex-shrink-0 w-24 flex items-center justify-end">
                    {/* Date: shown by default, hidden on hover when an action exists */}
                    <span
                      className={clsx(
                        'text-xs font-mono',
                        canToggle ? 'flex group-hover:hidden' : 'flex'
                      )}
                      style={{ color: dueColor }}
                    >
                      {dueText}
                    </span>
                    {/* Action button: only mounted when hoverable, hidden until hover */}
                    {canToggle && (
                      <button
                        onClick={() =>
                          toggleSubmitted.mutate({
                            id: a.id,
                            submitted: !a.submitted,
                          })
                        }
                        className="hidden group-hover:flex text-xs font-medium text-[var(--text-faint)] hover:text-[var(--accent)] transition-colors"
                      >
                        {canUnmark ? 'Unmark' : 'Mark done'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
