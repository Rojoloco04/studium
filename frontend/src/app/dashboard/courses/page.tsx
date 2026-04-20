'use client';

import { useMemo, useState } from 'react';
import { useCourses, useAssignments, useCanvasConnected, useToggleHideCourse } from '@/lib/queries';
import type { Assignment, Course } from '@/lib/types';
import { ArrowRight, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

type SortKey = 'name' | 'grade';

function isFinished(a: Assignment): boolean {
  return a.submitted || (a.score != null && a.score > 0);
}

function gradeNumColor(score: number | null | undefined): string {
  if (score == null) return 'var(--text)';
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

export default function CoursesPage() {
  const { data: canvasConnected, isLoading: checkingCanvas } = useCanvasConnected();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: assignments = [], isLoading: loadingAssignments } = useAssignments();
  const [sort, setSort] = useState<SortKey>('name');
  const hideCourse = useToggleHideCourse();

  const loading = checkingCanvas || loadingCourses || loadingAssignments;

  const stats = useMemo(() => {
    const validScores = courses.filter((c) => c.current_score != null).map((c) => c.current_score!);
    const avgScore = validScores.length
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null;
    const now = new Date();
    const upcomingCount = assignments.filter(
      (a) => !isFinished(a) && (!a.due_at || new Date(a.due_at) >= now)
    ).length;
    return { total: courses.length, avgScore, upcomingCount };
  }, [courses, assignments]);

  const upcomingByCourse = useMemo(() => {
    const now = new Date();
    const map: Record<string, number> = {};
    for (const a of assignments) {
      if (!isFinished(a) && (!a.due_at || new Date(a.due_at) >= now)) {
        map[a.course_id] = (map[a.course_id] ?? 0) + 1;
      }
    }
    return map;
  }, [assignments]);

  const sorted = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (sort === 'grade') {
        return (b.current_score ?? -1) - (a.current_score ?? -1);
      }
      return a.name.localeCompare(b.name);
    });
  }, [courses, sort]);

  // Not connected
  if (!loading && !canvasConnected) {
    return (
      <div className="px-10 py-14 max-w-[1080px]">
        <div className="mb-12 pb-7" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 18 }}>
            Courses
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
            Your <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>courses</em>,<br />at a glance.
          </h1>
        </div>
        <div className="py-16 text-center rounded" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <h3 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400 }}>No courses yet</h3>
          <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--text-faint)' }}>
            Connect Canvas to import your courses and grades automatically.
          </p>
          <Link href="/dashboard/canvas" className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded transition-opacity hover:opacity-90" style={{ background: 'var(--accent)', color: 'var(--background)', fontWeight: 500 }}>
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
            Courses
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
            Your <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>courses</em>,<br />at a glance.
          </h1>
          <p className="mt-3" style={{ fontSize: 13, color: 'var(--text-faint)' }}>
            {loading ? 'Loading…' : `${stats.total} enrolled course${stats.total !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!loading && stats.avgScore != null && (
          <div className="text-right flex-shrink-0 ml-10" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.7 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', letterSpacing: 0, marginBottom: 4 }}>
              {stats.avgScore}%
            </div>
            <div>Average grade</div>
            <div>{stats.upcomingCount} upcoming</div>
          </div>
        )}
      </div>

      {/* Sort controls */}
      {!loading && courses.length > 0 && (
        <div className="flex items-baseline gap-6 mb-4">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Sort
          </span>
          {(['name', 'grade'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: 'none',
                cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
                color: sort === key ? 'var(--text)' : 'var(--text-faint)',
                textDecoration: sort === key ? 'underline' : 'none',
                textUnderlineOffset: 3,
              }}
            >
              {key}
            </button>
          ))}
        </div>
      )}

      {/* Courses ledger */}
      {loading ? (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid py-5 animate-pulse" style={{ gridTemplateColumns: '120px 1fr 80px 160px 32px', gap: 24, borderBottom: '1px solid var(--border-soft)', alignItems: 'center' }}>
              <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: 70 }} />
              <div className="h-3 rounded" style={{ background: 'var(--surface-2)', width: '60%' }} />
              <div className="h-6 rounded" style={{ background: 'var(--surface-2)', width: 40 }} />
              <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }} />
              <div />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: 13 }}>
          No courses found.
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {sorted.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              upcomingCount={upcomingByCourse[course.id] ?? 0}
              onHide={() => {
                hideCourse.mutate({ id: course.id, hidden: true });
                toast.success('Course hidden', { description: 'Manage hidden courses in Settings.' });
              }}
            />
          ))}
        </div>
      )}

      {!loading && (
        <div className="flex justify-between mt-14 pt-5" style={{ borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span>{stats.total} courses</span>
          <span>{stats.avgScore != null ? `${stats.avgScore}% avg` : 'No grades yet'}</span>
        </div>
      )}
    </div>
  );
}

function CourseRow({ course, upcomingCount, onHide }: { course: Course; upcomingCount: number; onHide: () => void }) {
  return (
    <div className="group relative grid items-center py-5" style={{ gridTemplateColumns: '120px 1fr 80px 1fr 32px', gap: 24, borderBottom: '1px solid var(--border-soft)' }}>
      {/* Course code */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
        {course.course_code}
      </span>

      {/* Course name */}
      <Link href={`/dashboard/courses/${course.id}`} className="hover:text-[var(--accent)] transition-colors" style={{ fontSize: 14.5, color: 'var(--text)', textDecoration: 'none' }}>
        {course.name}
      </Link>

      {/* Grade */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '-0.01em', color: gradeNumColor(course.current_score), lineHeight: 1 }}>
        {course.current_score != null ? Math.round(course.current_score) : '—'}
        {course.current_score != null && <span style={{ fontSize: 13, color: 'var(--text-faint)', marginLeft: 1 }}>%</span>}
      </div>

      {/* Score bar + upcoming */}
      <div>
        <div className="w-full rounded-full mb-1.5" style={{ background: 'var(--surface-2)', height: 4 }}>
          <div className="rounded-full" style={{ width: `${Math.min(100, course.current_score ?? 0)}%`, height: 4, background: scoreBarColor(course.current_score) }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>
          {upcomingCount > 0 ? `${upcomingCount} upcoming` : 'All caught up'}
        </span>
      </div>

      {/* Hide button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHide(); }}
        title="Hide course"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
      >
        <EyeOff size={13} />
      </button>
    </div>
  );
}
