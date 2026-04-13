'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useCourses, useAssignments } from '@/lib/queries';
import type { Assignment } from '@/lib/types';
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  HelpCircle,
  MessageSquare,
  FileText,
  Paperclip,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

type DetailFilter = 'all' | 'upcoming' | 'past_due' | 'submitted';

const TABS: { id: DetailFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past_due', label: 'Past Due' },
  { id: 'submitted', label: 'Submitted' },
];

function isFinished(a: Assignment): boolean {
  return a.submitted || (a.score != null && a.score > 0);
}

function gradeColor(grade: string | null): string {
  if (!grade) return 'var(--text-faint)';
  const g = grade.toUpperCase();
  if (g.startsWith('A')) return 'var(--success)';
  if (g.startsWith('B')) return 'var(--accent)';
  if (g.startsWith('C')) return 'var(--warning)';
  return 'var(--danger)';
}

function scoreBarColor(score: number | null): string {
  if (score == null) return 'var(--surface-2)';
  if (score >= 90) return 'var(--success)';
  if (score >= 80) return 'var(--accent)';
  if (score >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

function formatDue(dueAt: string | null, finished = false): { text: string; color: string } {
  if (!dueAt) return { text: 'No due date', color: 'var(--text-faint)' };
  const now = new Date();
  const due = new Date(dueAt);
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));
  const dateLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diffDays < 0) {
    if (finished) return { text: dateLabel, color: 'var(--text-faint)' };
    return { text: `${Math.abs(diffDays)}d overdue`, color: 'var(--danger)' };
  }
  if (diffDays === 0) return { text: 'Due today', color: finished ? 'var(--text-faint)' : 'var(--warning)' };
  if (diffDays === 1) return { text: 'Tomorrow', color: finished ? 'var(--text-faint)' : 'var(--warning)' };
  if (diffDays <= 7) return { text: `In ${diffDays} days`, color: 'var(--text-dim)' };
  return { text: dateLabel, color: 'var(--text-faint)' };
}

function submissionIcon(types: string[]) {
  const t = types[0];
  if (t === 'online_upload') return <Upload size={13} />;
  if (t === 'online_quiz') return <HelpCircle size={13} />;
  if (t === 'discussion_topic') return <MessageSquare size={13} />;
  if (t === 'online_text_entry') return <FileText size={13} />;
  return <Paperclip size={13} />;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: allAssignments = [], isLoading: loadingAssignments } = useAssignments();

  const [filter, setFilter] = useState<DetailFilter>('upcoming');

  const loading = loadingCourses || loadingAssignments;

  const course = courses.find((c) => c.id === id) ?? null;
  const courseAssignments = useMemo(
    () => allAssignments.filter((a) => a.course_id === id),
    [allAssignments, id]
  );

  const gradeSummary = useMemo(() => {
    const graded = courseAssignments.filter(
      (a) => a.score != null && a.points_possible != null && a.points_possible > 0
    );
    const earned = graded.reduce((sum, a) => sum + a.score!, 0);
    const possible = graded.reduce((sum, a) => sum + a.points_possible!, 0);
    const pct = possible > 0 ? (earned / possible) * 100 : null;
    return { earned, possible, pct, count: graded.length };
  }, [courseAssignments]);

  const counts = useMemo(() => {
    const now = new Date();
    return {
      all: courseAssignments.length,
      upcoming: courseAssignments.filter(
        (a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now)
      ).length,
      past_due: courseAssignments.filter(
        (a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now
      ).length,
      submitted: courseAssignments.filter(isFinished).length,
    };
  }, [courseAssignments]);

  const filtered = useMemo(() => {
    const now = new Date();
    switch (filter) {
      case 'upcoming':
        return courseAssignments.filter(
          (a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now)
        );
      case 'past_due':
        return courseAssignments
          .filter((a) => !isFinished(a) && !!a.due_at && new Date(a.due_at) < now)
          .sort((a, b) => new Date(b.due_at!).getTime() - new Date(a.due_at!).getTime());
      case 'submitted':
        return courseAssignments.filter(isFinished);
      default:
        return courseAssignments;
    }
  }, [courseAssignments, filter]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back nav */}
      <Link
        href="/dashboard/courses"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Courses
      </Link>

      {loading ? (
        <CourseDetailSkeleton />
      ) : !course ? (
        <div className="surface-border rounded-xl p-12 text-center">
          <p className="text-[var(--text-dim)] text-sm mb-4">Course not found.</p>
          <Link
            href="/dashboard/courses"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Back to courses
          </Link>
        </div>
      ) : (
        <>
          {/* Course header */}
          <div className="surface-border rounded-xl p-6 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="font-display font-700 text-2xl text-[var(--text)] leading-tight">
                  {course.name}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-mono bg-[var(--surface-2)] text-[var(--text-dim)] px-2 py-0.5 rounded">
                    {course.course_code}
                  </span>
                  {course.term && (
                    <span className="text-xs font-mono bg-[var(--surface-2)] text-[var(--text-faint)] px-2 py-0.5 rounded">
                      {course.term}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div
                  className="font-display font-700 text-5xl leading-none"
                  style={{ color: gradeColor(course.current_grade) }}
                >
                  {course.current_grade ?? '—'}
                </div>
                <p className="font-mono text-xs text-[var(--text-dim)] mt-1">
                  {course.current_score != null ? `${course.current_score}%` : 'No score'}
                </p>
              </div>
            </div>
          </div>

          {/* Grade summary */}
          {gradeSummary.count > 0 && (
            <div className="surface-border rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--text-dim)]">
                  Points earned across {gradeSummary.count} graded assignment{gradeSummary.count !== 1 ? 's' : ''}
                </span>
                <span className="font-mono text-xs text-[var(--text)]">
                  {gradeSummary.earned.toFixed(1)} / {gradeSummary.possible.toFixed(1)} pts
                  {gradeSummary.pct != null && (
                    <span className="text-[var(--text-faint)] ml-1">
                      ({Math.round(gradeSummary.pct)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-[var(--surface-2)] rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, gradeSummary.pct ?? 0)}%`,
                    backgroundColor: scoreBarColor(gradeSummary.pct),
                  }}
                />
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-lg w-fit mb-4">
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
                <span
                  className={clsx(
                    'text-xs font-mono',
                    filter === tab.id ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]'
                  )}
                >
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Assignment list */}
          {filtered.length === 0 ? (
            <div className="surface-border rounded-xl p-10 text-center">
              <ClipboardList size={28} className="text-[var(--text-faint)] mx-auto mb-3" />
              <p className="text-[var(--text-dim)] text-sm">
                {filter === 'upcoming' && 'No upcoming assignments — nice!'}
                {filter === 'past_due' && 'No past due assignments.'}
                {filter === 'submitted' && 'No submitted assignments yet.'}
                {filter === 'all' && 'No assignments for this course.'}
              </p>
            </div>
          ) : (
            <div className="surface-border rounded-xl overflow-hidden">
              <div className="divide-y divide-[var(--border)]">
                {filtered.map((a) => {
                  const now = new Date();
                  const past = !!a.due_at && new Date(a.due_at) < now;
                  const finished = isFinished(a);
                  const { text: dueText, color: dueColor } = formatDue(a.due_at, finished);

                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      {/* Status icon */}
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                        {finished ? (
                          <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                        ) : past ? (
                          <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
                        ) : (
                          <Clock size={15} style={{ color: 'var(--text-faint)' }} />
                        )}
                      </div>

                      {/* Name + due */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={clsx(
                            'text-sm font-medium truncate',
                            finished ? 'text-[var(--text-dim)]' : 'text-[var(--text)]'
                          )}
                        >
                          {a.name}
                        </p>
                        <p
                          className="text-xs mt-0.5 font-mono"
                          style={{ color: dueColor }}
                        >
                          {dueText}
                        </p>
                      </div>

                      {/* Submission type */}
                      <div
                        className="flex-shrink-0 hidden sm:flex"
                        style={{ color: 'var(--text-faint)' }}
                        title={a.submission_types[0] ?? 'none'}
                      >
                        {submissionIcon(a.submission_types)}
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
                                <span style={{ color: 'var(--text-faint)' }} className="ml-1">
                                  ({Math.round((a.score / a.points_possible) * 100)}%)
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CourseDetailSkeleton() {
  return (
    <>
      <div className="surface-border rounded-xl p-6 mb-4 animate-pulse">
        <div className="flex justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-7 bg-[var(--surface-2)] rounded w-1/2" />
            <div className="flex gap-2 mt-2">
              <div className="h-5 w-16 bg-[var(--surface-2)] rounded" />
              <div className="h-5 w-12 bg-[var(--surface-2)] rounded" />
            </div>
          </div>
          <div className="h-14 w-16 bg-[var(--surface-2)] rounded flex-shrink-0" />
        </div>
      </div>
      <div className="surface-border rounded-xl p-5 mb-4 animate-pulse">
        <div className="h-3 bg-[var(--surface-2)] rounded w-1/3 mb-3" />
        <div className="h-3 bg-[var(--surface-2)] rounded-full w-full" />
      </div>
      <div className="surface-border rounded-xl overflow-hidden animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center gap-4 border-b border-[var(--border)]">
            <div className="w-4 h-4 rounded-full bg-[var(--surface-2)] flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-[var(--surface-2)] rounded w-2/5" />
              <div className="h-2.5 bg-[var(--surface-2)] rounded w-1/4" />
            </div>
            <div className="h-3 bg-[var(--surface-2)] rounded w-20 hidden sm:block" />
          </div>
        ))}
      </div>
    </>
  );
}
