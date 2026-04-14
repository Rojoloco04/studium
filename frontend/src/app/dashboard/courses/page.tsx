'use client';

import { useMemo, useState } from 'react';
import { useCourses, useAssignments, useCanvasConnected, useToggleHideCourse } from '@/lib/queries';
import type { Assignment, Course } from '@/lib/types';
import { BookOpen, ArrowRight, ArrowUpDown, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import clsx from 'clsx';

type SortKey = 'name' | 'grade';

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

export default function CoursesPage() {
  const { data: canvasConnected, isLoading: checkingCanvas } = useCanvasConnected();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: assignments = [], isLoading: loadingAssignments } = useAssignments();

  const [sort, setSort] = useState<SortKey>('name');
  const hideCourse = useToggleHideCourse();

  const loading = checkingCanvas || loadingCourses || loadingAssignments;

  const stats = useMemo(() => {
    const validScores = courses
      .filter((c) => c.current_score != null)
      .map((c) => c.current_score!);
    const avgScore =
      validScores.length
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
        const sa = a.current_score ?? -1;
        const sb = b.current_score ?? -1;
        return sb - sa;
      }
      return a.name.localeCompare(b.name);
    });
  }, [courses, sort]);

  // Not connected
  if (!loading && !canvasConnected) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-700 text-2xl">Courses</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">All your enrolled courses</p>
        </div>
        <div className="surface-border rounded-xl p-12 text-center">
          <BookOpen size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
          <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">
            No courses yet
          </h3>
          <p className="text-[var(--text-dim)] text-sm max-w-xs mx-auto mb-5">
            Connect Canvas to import your courses and grades automatically.
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
        <h1 className="font-display font-700 text-2xl">Courses</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          {loading ? 'Loading…' : `${stats.total} enrolled course${stats.total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <StatChip label="Courses" value={String(stats.total)} />
          <StatChip
            label="Avg score"
            value={stats.avgScore != null ? `${stats.avgScore}%` : '—'}
          />
          <StatChip label="Upcoming" value={String(stats.upcomingCount)} />
        </div>
      )}

      {/* Sort controls */}
      {!loading && courses.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-[var(--text-faint)] flex items-center gap-1">
            <ArrowUpDown size={11} />
            Sort
          </span>
          <div className="flex items-center gap-0.5 bg-[var(--surface)] border border-[var(--border)] p-0.5 rounded-lg">
            {(['name', 'grade'] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={clsx(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                  sort === key
                    ? 'bg-[var(--surface-2)] text-[var(--text)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="surface-border rounded-xl p-5 animate-pulse">
              <div className="flex gap-2 mb-4">
                <div className="h-5 w-16 bg-[var(--surface-2)] rounded" />
                <div className="h-5 w-12 bg-[var(--surface-2)] rounded" />
              </div>
              <div className="h-4 bg-[var(--surface-2)] rounded w-3/4 mb-1" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-1/2 mb-4" />
              <div className="h-10 bg-[var(--surface-2)] rounded w-12 mb-1" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-16 mb-4" />
              <div className="h-1.5 bg-[var(--surface-2)] rounded-full w-full" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="surface-border rounded-xl p-10 text-center">
          <BookOpen size={28} className="text-[var(--text-faint)] mx-auto mb-3" />
          <p className="text-[var(--text-dim)] text-sm">No courses found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((course) => (
            <CourseCard
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
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-border rounded-lg px-4 py-2.5 flex items-center gap-3">
      <span className="text-xs text-[var(--text-faint)]">{label}</span>
      <span className="font-mono text-sm font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}

function CourseCard({
  course,
  upcomingCount,
  onHide,
}: {
  course: Course;
  upcomingCount: number;
  onHide: () => void;
}) {
  return (
    <div className="relative group/card">
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="surface-border rounded-xl p-5 block hover:border-[var(--border-strong)] transition-all duration-150 group"
    >
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-mono bg-[var(--surface-2)] text-[var(--text-dim)] px-2 py-0.5 rounded">
          {course.course_code}
        </span>
        {course.term && (
          <span className="text-xs font-mono bg-[var(--surface-2)] text-[var(--text-faint)] px-2 py-0.5 rounded">
            {course.term}
          </span>
        )}
      </div>

      {/* Course name */}
      <p
        className="text-sm font-medium text-[var(--text)] mb-3 leading-snug"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {course.name}
      </p>

      {/* Grade display */}
      <div className="mb-1">
        <span
          className="font-display font-700 text-4xl leading-none"
          style={{ color: gradeColor(course.current_grade) }}
        >
          {course.current_grade ?? '—'}
        </span>
      </div>
      <p className="font-mono text-xs text-[var(--text-dim)] mb-3">
        {course.current_score != null ? `${course.current_score}%` : 'No score'}
      </p>

      {/* Progress bar */}
      <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5 mb-3">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${Math.min(100, course.current_score ?? 0)}%`,
            backgroundColor: scoreBarColor(course.current_score),
          }}
        />
      </div>

      {/* Upcoming chip */}
      <p
        className="text-xs"
        style={{ color: upcomingCount > 0 ? 'var(--text-dim)' : 'var(--text-faint)' }}
      >
        {upcomingCount > 0
          ? `${upcomingCount} upcoming assignment${upcomingCount !== 1 ? 's' : ''}`
          : 'All caught up'}
      </p>
    </Link>
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHide(); }}
      title="Hide course"
      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg opacity-0 group-hover/card:opacity-100 text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-all"
    >
      <EyeOff size={13} />
    </button>
    </div>
  );
}
