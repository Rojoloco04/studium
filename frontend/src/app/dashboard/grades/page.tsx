'use client';

import { useMemo, useState } from 'react';
import { useCourses, useAssignments, useAssignmentGroups, useCanvasConnected } from '@/lib/queries';
import type { Assignment, AssignmentGroup, Course } from '@/lib/types';
import { TrendingUp, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function feasibilityColor(needed: number | null): string {
  if (needed === null) return 'var(--success)';
  if (needed > 100) return 'var(--danger)';
  if (needed > 90) return 'var(--warning)';
  return 'var(--success)';
}

function feasibilityLabel(needed: number | null): string {
  if (needed === null) return 'Already secured';
  if (needed > 100) return 'Not possible';
  if (needed > 90) return 'Difficult';
  if (needed > 70) return 'Achievable';
  return 'Easy';
}

// ─── Final grade estimator math ──────────────────────────────────────────────
// neededScore = (target - running * (1 - finalWeight/100)) / (finalWeight/100)
// Returns null if already secured (needed <= 0), or the needed % (may exceed 100)
function neededOnFinal(target: number, running: number, finalWeight: number): number | null {
  if (finalWeight <= 0) return null;
  const f = finalWeight / 100;
  const needed = (target - running * (1 - f)) / f;
  if (needed <= 0) return null;
  return needed;
}

const GRADE_THRESHOLDS = [
  { letter: 'A', min: 90 },
  { letter: 'B', min: 80 },
  { letter: 'C', min: 70 },
  { letter: 'D', min: 60 },
];

// Heuristic: find a group whose name looks like a "final exam"
function findFinalGroup(groups: AssignmentGroup[]): AssignmentGroup | undefined {
  const keywords = ['final', 'exam', 'midterm'];
  return groups.find((g) =>
    keywords.some((kw) => g.name.toLowerCase().includes(kw))
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GradesPage() {
  const { data: canvasConnected, isLoading: checkingCanvas } = useCanvasConnected();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: assignments = [], isLoading: loadingAssignments } = useAssignments();
  const { data: groups = [], isLoading: loadingGroups } = useAssignmentGroups();

  const loading = checkingCanvas || loadingCourses || loadingAssignments || loadingGroups;

  const stats = useMemo(() => {
    const validScores = courses.filter((c) => c.current_score != null).map((c) => c.current_score!);
    const avgScore = validScores.length
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
      : null;
    return { total: courses.length, avgScore };
  }, [courses]);

  if (!loading && !canvasConnected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-700 text-2xl">Grades</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">Track and estimate your grades</p>
        </div>
        <div className="surface-border rounded-xl p-12 text-center">
          <TrendingUp size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
          <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">No grade data yet</h3>
          <p className="text-[var(--text-dim)] text-sm max-w-xs mx-auto mb-5">
            Connect Canvas to import your grades and run what-if scenarios.
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-700 text-2xl">Grades</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          {loading ? 'Loading…' : `${stats.total} course${stats.total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <StatChip label="Courses" value={String(stats.total)} />
          <StatChip label="Avg score" value={stats.avgScore != null ? `${stats.avgScore}%` : '—'} />
        </div>
      )}

      {/* Course accordion list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-border rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 bg-[var(--surface-2)] rounded" />
                <div className="flex-1">
                  <div className="h-4 bg-[var(--surface-2)] rounded w-1/3 mb-2" />
                  <div className="h-3 bg-[var(--surface-2)] rounded w-1/2" />
                </div>
                <div className="h-10 w-12 bg-[var(--surface-2)] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="surface-border rounded-xl p-10 text-center">
          <TrendingUp size={28} className="text-[var(--text-faint)] mx-auto mb-3" />
          <p className="text-[var(--text-dim)] text-sm">No courses found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {courses.map((course) => {
            const courseAssignments = assignments.filter((a) => a.course_id === course.id);
            const courseGroups = groups.filter((g) => g.course_id === course.id);
            return (
              <CourseRow
                key={course.id}
                course={course}
                assignments={courseAssignments}
                groups={courseGroups}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Course accordion row ─────────────────────────────────────────────────────

function CourseRow({
  course,
  assignments,
  groups,
}: {
  course: Course;
  assignments: Assignment[];
  groups: AssignmentGroup[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="surface-border rounded-xl overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        className="w-full text-left p-5 flex items-center gap-4 hover:bg-[var(--surface-2)] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Grade badge */}
        <div className="shrink-0 w-12 text-center">
          <span
            className="font-display font-700 text-3xl leading-none"
            style={{ color: gradeColor(course.current_grade) }}
          >
            {course.current_grade ?? '—'}
          </span>
        </div>

        {/* Course info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono bg-[var(--surface-2)] text-[var(--text-dim)] px-2 py-0.5 rounded">
              {course.course_code}
            </span>
            {course.term && (
              <span className="text-xs font-mono text-[var(--text-faint)]">{course.term}</span>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--text)] truncate">{course.name}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 max-w-[160px] bg-[var(--surface-2)] rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, course.current_score ?? 0)}%`,
                  backgroundColor: scoreBarColor(course.current_score),
                }}
              />
            </div>
            <span className="font-mono text-xs text-[var(--text-dim)]">
              {course.current_score != null ? `${course.current_score}%` : 'No score'}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-[var(--text-faint)]">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border)] p-5 flex flex-col gap-6">
          <CategoryBreakdown assignments={assignments} groups={groups} />
          <FinalEstimator course={course} groups={groups} />
        </div>
      )}
    </div>
  );
}

// ─── Assignment group breakdown ───────────────────────────────────────────────

function CategoryBreakdown({
  assignments,
  groups,
}: {
  assignments: Assignment[];
  groups: AssignmentGroup[];
}) {
  const hasWeights = groups.some((g) => g.group_weight > 0);

  // Compute per-group stats
  const groupStats = useMemo(() => {
    return groups.map((g) => {
      const groupAssignments = assignments.filter((a) => a.assignment_group_id === g.id);
      const graded = groupAssignments.filter(
        (a) => a.score != null && a.points_possible != null && a.points_possible > 0
      );
      const totalEarned = graded.reduce((sum, a) => sum + (a.score ?? 0), 0);
      const totalPossible = graded.reduce((sum, a) => sum + (a.points_possible ?? 0), 0);
      const categoryScore = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
      const contribution =
        categoryScore != null && hasWeights ? (categoryScore * g.group_weight) / 100 : null;
      return { group: g, categoryScore, contribution, gradedCount: graded.length, totalCount: groupAssignments.length };
    });
  }, [assignments, groups, hasWeights]);

  if (groups.length === 0) {
    // Fallback: show a simple unweighted point summary
    const graded = assignments.filter(
      (a) => a.score != null && a.points_possible != null && a.points_possible > 0
    );
    const totalEarned = graded.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const totalPossible = graded.reduce((sum, a) => sum + (a.points_possible ?? 0), 0);
    const pct = totalPossible > 0 ? ((totalEarned / totalPossible) * 100).toFixed(1) : null;

    return (
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-3">
          Grade Breakdown
        </h3>
        <p className="text-sm text-[var(--text-dim)]">
          {pct != null
            ? `${totalEarned.toFixed(1)} / ${totalPossible.toFixed(1)} pts (${pct}%) across ${graded.length} graded assignment${graded.length !== 1 ? 's' : ''}`
            : 'No graded assignments yet.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-3">
        Grade Breakdown
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-faint)]">
              <th className="pb-2 font-medium">Category</th>
              {hasWeights && <th className="pb-2 font-medium text-right">Weight</th>}
              <th className="pb-2 font-medium text-right">Score</th>
              {hasWeights && <th className="pb-2 font-medium text-right">Contribution</th>}
              <th className="pb-2 font-medium text-right pr-1">Graded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {groupStats.map(({ group, categoryScore, contribution, gradedCount, totalCount }) => (
              <tr key={group.id}>
                <td className="py-2.5 text-[var(--text)] pr-4">{group.name}</td>
                {hasWeights && (
                  <td className="py-2.5 font-mono text-xs text-[var(--text-dim)] text-right pr-4">
                    {group.group_weight}%
                  </td>
                )}
                <td className="py-2.5 text-right pr-4">
                  {categoryScore != null ? (
                    <span
                      className="font-mono text-xs font-medium"
                      style={{ color: scoreBarColor(categoryScore) }}
                    >
                      {categoryScore.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-[var(--text-faint)] text-xs">—</span>
                  )}
                </td>
                {hasWeights && (
                  <td className="py-2.5 font-mono text-xs text-[var(--text-dim)] text-right pr-4">
                    {contribution != null ? `${contribution.toFixed(1)} pts` : '—'}
                  </td>
                )}
                <td className="py-2.5 text-right pr-1">
                  <span className="text-xs text-[var(--text-faint)]">
                    {gradedCount}/{totalCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Final grade estimator ────────────────────────────────────────────────────

function FinalEstimator({ course, groups }: { course: Course; groups: AssignmentGroup[] }) {
  const finalGroup = useMemo(() => findFinalGroup(groups), [groups]);

  const [finalWeight, setFinalWeight] = useState<string>(
    finalGroup ? String(finalGroup.group_weight) : '20'
  );
  const [runningGrade, setRunningGrade] = useState<string>(
    course.current_score != null ? String(course.current_score) : ''
  );

  const parsedWeight = parseFloat(finalWeight);
  const parsedRunning = parseFloat(runningGrade);
  const canCompute =
    !isNaN(parsedWeight) &&
    parsedWeight > 0 &&
    parsedWeight <= 100 &&
    !isNaN(parsedRunning) &&
    parsedRunning >= 0 &&
    parsedRunning <= 100;

  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-4">
        Final Grade Estimator
      </h3>

      <div className="flex flex-wrap gap-4 mb-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-dim)]">
            Final exam weight (%)
            {finalGroup && (
              <span className="ml-1 text-[var(--text-faint)]">— from "{finalGroup.name}"</span>
            )}
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={finalWeight}
            onChange={(e) => setFinalWeight(e.target.value)}
            className="surface-border rounded-lg px-3 py-1.5 font-mono text-sm w-24 bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-dim)]">Current running grade (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={runningGrade}
            onChange={(e) => setRunningGrade(e.target.value)}
            className="surface-border rounded-lg px-3 py-1.5 font-mono text-sm w-28 bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </label>
      </div>

      {!canCompute ? (
        <p className="text-xs text-[var(--text-faint)]">
          Enter valid values above to see grade thresholds.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-faint)]">
                <th className="pb-2 font-medium">Target</th>
                <th className="pb-2 font-medium text-right">Min grade</th>
                <th className="pb-2 font-medium text-right">Need on final</th>
                <th className="pb-2 font-medium text-right">Feasibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {GRADE_THRESHOLDS.map(({ letter, min }) => {
                const needed = neededOnFinal(min, parsedRunning, parsedWeight);
                const color = feasibilityColor(needed);
                const label = feasibilityLabel(needed);
                return (
                  <tr key={letter}>
                    <td className="py-2.5">
                      <span className="font-display font-700 text-lg" style={{ color: gradeColor(letter) }}>
                        {letter}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-xs text-[var(--text-dim)] text-right">{min}%</td>
                    <td className="py-2.5 font-mono text-sm font-medium text-right" style={{ color }}>
                      {needed === null ? '≤ 0%' : needed > 100 ? '>100%' : `${needed.toFixed(1)}%`}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)]"
                        style={{ color }}
                      >
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-border rounded-lg px-4 py-2.5 flex items-center gap-3">
      <span className="text-xs text-[var(--text-faint)]">{label}</span>
      <span className="font-mono text-sm font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}
