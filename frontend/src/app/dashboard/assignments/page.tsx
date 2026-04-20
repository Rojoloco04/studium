'use client';

import { useMemo, useState } from 'react';
import {
  useAssignments,
  useCanvasConnected,
  useToggleSubmitted,
} from '@/lib/queries';
import type { Assignment } from '@/lib/types';
import { ArrowRight, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

type FilterTab = 'all' | 'upcoming' | 'past_due' | 'finished';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past_due', label: 'Past due' },
  { id: 'finished', label: 'Finished' },
];

function isFinished(a: Assignment): boolean {
  return a.submitted || (a.score != null && a.score > 0);
}

function getDateLabel(dueAt: string | null, finished: boolean): {
  label: string;
  state: 'overdue' | 'today' | 'done' | 'normal';
} {
  if (!dueAt) return { label: 'No date', state: 'normal' };
  const now = new Date();
  const due = new Date(dueAt);
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - nowDay.getTime()) / 86400000);
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (finished) return { label, state: 'done' };
  if (diff < 0) return { label, state: 'overdue' };
  if (diff === 0) return { label: 'Today', state: 'today' };
  if (diff === 1) return { label: 'Tomorrow', state: 'normal' };
  return { label, state: 'normal' };
}

// ─── Tick Button ──────────────────────────────────────────────────────────────

function TickButton({ done, onClick }: { done: boolean; onClick: () => void }) {
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

// ─── Assignment Row ────────────────────────────────────────────────────────────

function AssignmentRow({
  a,
  onToggle,
}: {
  a: Assignment;
  onToggle: () => void;
}) {
  const finished = isFinished(a);
  const canUnmark = a.submitted && a.score == null;
  const canToggle = !finished || canUnmark;
  const { label, state } = getDateLabel(a.due_at, finished);

  const dateColor =
    state === 'overdue' ? 'var(--danger)' :
    state === 'today' ? 'var(--accent)' :
    state === 'done' ? 'var(--text-faint2)' :
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
      {/* Date */}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.04em',
          color: dateColor,
          textDecoration: state === 'done' ? 'line-through' : 'none',
        }}
      >
        {label}
      </span>

      {/* Title */}
      <div
        className="text-sm leading-snug min-w-0"
        style={{
          color: finished ? 'var(--text-faint)' : 'var(--text)',
          textDecoration: finished ? 'line-through' : 'none',
          textDecorationColor: 'var(--text-faint2)',
          textDecorationThickness: '1px',
        }}
      >
        {a.name}
      </div>

      {/* Course */}
      <span
        className="truncate"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-faint)',
          letterSpacing: '0.02em',
        }}
      >
        {a.courses?.course_code ?? a.courses?.name ?? ''}
      </span>

      {/* Points */}
      <span
        className="text-right"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-faint)',
        }}
      >
        {a.points_possible != null ? (
          a.score != null ? (
            <>
              <span style={{ color: 'var(--text)' }}>{a.score}</span>
              {' / '}{a.points_possible} pts
            </>
          ) : (
            `${a.points_possible} pts`
          )
        ) : null}
      </span>

      {/* Tick */}
      <div className="flex items-center justify-end">
        {canToggle && (
          <TickButton
            done={finished}
            onClick={onToggle}
          />
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const { data: canvasConnected, isLoading: checkingCanvas } = useCanvasConnected();
  const { data: assignments = [], isLoading: loadingAssignments } = useAssignments();
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
      upcoming: assignments.filter((a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now)).length,
      past_due: assignments.filter((a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now).length,
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
        return list.filter((a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now));
      case 'past_due':
        return list
          .filter((a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now)
          .sort((a, b) => new Date(b.due_at!).getTime() - new Date(a.due_at!).getTime());
      case 'finished':
        return list.filter(isFinished);
      default:
        return list;
    }
  }, [assignments, filter, courseFilter]);

  // Not connected
  if (!loading && !canvasConnected) {
    return (
      <div className="px-10 py-14 max-w-[1080px]">
        <div className="mb-8">
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
            Assignments
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 52,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              fontWeight: 400,
            }}
          >
            All the <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>work</em>,
            <br />
            in one ledger.
          </h1>
        </div>
        <div
          className="py-16 text-center rounded"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <GraduationCap size={28} className="mx-auto mb-4" style={{ color: 'var(--text-faint)' }} />
          <h3 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400 }}>
            No assignments yet
          </h3>
          <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--text-faint)' }}>
            Connect Canvas to import your assignments automatically.
          </p>
          <Link
            href="/dashboard/canvas"
            className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--background)', fontWeight: 500 }}
          >
            Connect Canvas <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 py-14 max-w-[1080px]">

      {/* Page header */}
      <div className="flex items-end justify-between mb-8">
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
            Assignments
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 52,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              fontWeight: 400,
            }}
          >
            All the <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>work</em>,
            <br />
            in one ledger.
          </h1>
          <p className="mt-3" style={{ fontSize: 13, color: 'var(--text-faint)' }}>
            {loading
              ? 'Loading…'
              : `${assignments.length} item${assignments.length !== 1 ? 's' : ''} across ${courses.length} course${courses.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!loading && (
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
              {counts.finished}
              <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>/{counts.all}</span>
            </div>
            <div>Finished this term</div>
            <div>{counts.all > 0 ? Math.round((counts.finished / counts.all) * 100) : 0}% complete</div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-baseline justify-between mb-6">
        {/* Tabs */}
        <div className="flex" style={{ gap: 28, borderBottom: '1px solid var(--border)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="relative pb-2 transition-colors cursor-pointer"
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 13,
                color: filter === tab.id ? 'var(--text)' : 'var(--text-faint)',
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              {tab.label}
              {!loading && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    color: filter === tab.id ? 'var(--accent)' : 'var(--text-faint2)',
                  }}
                >
                  {counts[tab.id]}
                </span>
              )}
              {filter === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0"
                  style={{ height: 2, background: 'var(--text)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Course filter */}
        {courses.length > 1 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-dim)',
              padding: '6px 20px 6px 0',
              cursor: 'pointer',
              appearance: 'none',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              backgroundImage: `linear-gradient(45deg, transparent 50%, var(--text-faint) 50%), linear-gradient(-45deg, transparent 50%, var(--text-faint) 50%)`,
              backgroundPosition: 'right 4px top 50%, right 0 top 50%',
              backgroundSize: '4px 4px',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.course_code}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {[...Array(8)].map((_, i) => (
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
              <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: '55%' }} />
              <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: 90 }} />
              <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: 70 }} />
              <div />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="py-16 text-center rounded mt-2"
          style={{ border: '1px solid var(--border-soft)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            {filter === 'upcoming' && 'No upcoming assignments — nice!'}
            {filter === 'past_due' && 'No past due assignments.'}
            {filter === 'finished' && 'No finished assignments yet.'}
            {filter === 'all' && 'No assignments found.'}
          </p>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {filtered.map((a: Assignment) => (
            <AssignmentRow
              key={a.id}
              a={a}
              onToggle={() => toggleSubmitted.mutate({ id: a.id, submitted: !a.submitted })}
            />
          ))}
        </div>
      )}

      {/* Footer */}
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
          <span>Showing {filtered.length} of {assignments.length}</span>
          <span>Sorted by due date</span>
        </div>
      )}
    </div>
  );
}
