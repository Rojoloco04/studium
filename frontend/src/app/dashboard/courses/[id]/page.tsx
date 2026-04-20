'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCourses, useAssignments, useToggleSubmitted, useToggleHideCourse } from '@/lib/queries';
import { toast } from 'sonner';
import type { Assignment } from '@/lib/types';
import {
  Upload,
  HelpCircle,
  MessageSquare,
  FileText,
  Paperclip,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

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

function gradeColor(score: number | null | undefined): string {
  if (score == null) return 'var(--text-faint)';
  if (score < 70) return 'var(--danger)';
  if (score < 80) return 'var(--warning)';
  return 'var(--text)';
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
    if (finished) return { text: dateLabel, color: 'var(--text-faint2)' };
    return { text: `${Math.abs(diffDays)}d overdue`, color: 'var(--danger)' };
  }
  if (diffDays === 0) return { text: 'Due today', color: finished ? 'var(--text-faint2)' : 'var(--accent)' };
  if (diffDays === 1) return { text: 'Tomorrow', color: finished ? 'var(--text-faint2)' : 'var(--warning)' };
  if (diffDays <= 7) return { text: `In ${diffDays} days`, color: 'var(--text-dim)' };
  return { text: dateLabel, color: 'var(--text-faint)' };
}

function submissionIcon(types: string[]) {
  const t = types[0];
  if (t === 'online_upload') return <Upload size={12} />;
  if (t === 'online_quiz') return <HelpCircle size={12} />;
  if (t === 'discussion_topic') return <MessageSquare size={12} />;
  if (t === 'online_text_entry') return <FileText size={12} />;
  return <Paperclip size={12} />;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: allAssignments = [], isLoading: loadingAssignments } = useAssignments();
  const toggleSubmitted = useToggleSubmitted();
  const toggleHide = useToggleHideCourse();

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
    <div className="px-10 py-14 max-w-[1080px]">
      {/* Back nav */}
      <Link
        href="/dashboard/courses"
        className="inline-flex items-center gap-1.5 mb-6 transition-colors hover:text-[var(--accent)]"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} />
        Courses
      </Link>

      {loading ? (
        <CourseDetailSkeleton />
      ) : !course ? (
        <div className="py-16 text-center" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: 13 }}>
          <p className="mb-4">Course not found.</p>
          <Link href="/dashboard/courses" style={{ color: 'var(--accent)', fontSize: 13 }}>
            Back to courses
          </Link>
        </div>
      ) : (
        <>
          {/* Course header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
                {course.course_code}{course.term ? ` · ${course.term}` : ''}
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', fontWeight: 400 }}>
                {course.name}
              </h1>
              <button
                onClick={() => {
                  toggleHide.mutate(
                    { id: course.id, hidden: !course.hidden },
                    {
                      onSuccess: () => {
                        if (!course.hidden) {
                          toast.success('Course hidden', { description: 'Manage hidden courses in Settings.' });
                          router.push('/dashboard/courses');
                        } else {
                          toast.success('Course unhidden');
                        }
                      },
                    }
                  );
                }}
                className="inline-flex items-center gap-1.5 mt-4 transition-colors hover:text-[var(--text-dim)]"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {course.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                {course.hidden ? 'Unhide course' : 'Hide course'}
              </button>
            </div>

            {/* Grade display */}
            <div className="flex-shrink-0 ml-10 text-right">
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, lineHeight: 1, letterSpacing: '-0.02em', color: gradeColor(course.current_score) }}>
                {course.current_score != null ? Math.round(course.current_score) : '—'}
                {course.current_score != null && <span style={{ fontSize: 24, color: 'var(--text-faint)', marginLeft: 2 }}>%</span>}
              </div>
              {gradeSummary.count > 0 && (
                <div className="mt-3">
                  <div className="rounded-full mb-1" style={{ width: 120, height: 3, background: 'var(--surface-2)', marginLeft: 'auto' }}>
                    <div className="rounded-full" style={{ width: `${Math.min(100, gradeSummary.pct ?? 0)}%`, height: 3, background: scoreBarColor(gradeSummary.pct) }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>
                    {gradeSummary.earned.toFixed(1)} / {gradeSummary.possible.toFixed(1)} pts
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="relative flex items-end gap-8 mb-0" style={{ borderBottom: '1px solid var(--border)' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  position: 'relative',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: filter === tab.id ? 'var(--text)' : 'var(--text-faint)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 0 12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
                <span style={{ color: filter === tab.id ? 'var(--accent)' : 'var(--text-faint2)' }}>
                  {counts[tab.id]}
                </span>
                {filter === tab.id && (
                  <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--text)', borderRadius: 1 }} />
                )}
              </button>
            ))}
          </div>

          {/* Assignment list */}
          {filtered.length === 0 ? (
            <div className="py-14 text-center" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
              {filter === 'upcoming' && 'No upcoming assignments — nice!'}
              {filter === 'past_due' && 'No past due assignments.'}
              {filter === 'submitted' && 'No submitted assignments yet.'}
              {filter === 'all' && 'No assignments for this course.'}
            </div>
          ) : (
            <div>
              {filtered.map((a) => {
                const finished = isFinished(a);
                const canUnmark = a.submitted && a.score == null;
                const canToggle = !finished || canUnmark;
                const { text: dueText, color: dueColor } = formatDue(a.due_at, finished);

                return (
                  <div
                    key={a.id}
                    className="group grid items-center py-4"
                    style={{ gridTemplateColumns: '88px 1fr 160px 120px 100px', gap: 24, borderBottom: '1px solid var(--border-soft)' }}
                  >
                    {/* Due date */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: dueColor, letterSpacing: '0.03em' }}>
                      {dueText}
                    </span>

                    {/* Name */}
                    <span style={{ fontSize: 14, color: finished ? 'var(--text-faint)' : 'var(--text)', textDecoration: finished ? 'line-through' : 'none', textDecorationColor: 'var(--text-faint2)' }}>
                      {a.name}
                    </span>

                    {/* Submission type */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {submissionIcon(a.submission_types)}
                      {a.submission_types[0]?.replace(/_/g, ' ') ?? ''}
                    </span>

                    {/* Score */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>
                      {a.score != null && a.points_possible != null
                        ? `${a.score} / ${a.points_possible}`
                        : a.points_possible != null
                        ? `— / ${a.points_possible}`
                        : ''}
                    </span>

                    {/* Mark done */}
                    <div className="flex justify-end">
                      {canToggle && (
                        <button
                          onClick={() => toggleSubmitted.mutate({ id: a.id, submitted: !a.submitted })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', background: 'none', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', padding: '3px 8px', letterSpacing: '0.05em' }}
                        >
                          {canUnmark ? 'Unmark' : 'Mark done'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between mt-10 pt-5" style={{ borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span>{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</span>
            <span>{counts.submitted} submitted · {counts.upcoming} upcoming</span>
          </div>
        </>
      )}
    </div>
  );
}

function CourseDetailSkeleton() {
  return (
    <>
      <div className="flex items-start justify-between mb-12 pb-7 animate-pulse" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1 space-y-3">
          <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: 80 }} />
          <div className="h-10 rounded" style={{ background: 'var(--surface-2)', width: '55%' }} />
        </div>
        <div className="h-14 w-20 rounded flex-shrink-0" style={{ background: 'var(--surface-2)' }} />
      </div>
      <div className="flex gap-8 mb-6" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[70, 80, 80, 90].map((w, i) => (
          <div key={i} className="h-3 rounded" style={{ background: 'var(--surface-2)', width: w }} />
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="grid py-4 animate-pulse" style={{ gridTemplateColumns: '88px 1fr 160px 120px 100px', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'center' }}>
            <div className="h-2.5 rounded" style={{ background: 'var(--surface-2)', width: 60 }} />
            <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: '50%' }} />
            <div className="h-2.5 rounded" style={{ background: 'var(--surface-2)', width: 80 }} />
            <div className="h-2.5 rounded" style={{ background: 'var(--surface-2)', width: 60 }} />
            <div />
          </div>
        ))}
      </div>
    </>
  );
}
