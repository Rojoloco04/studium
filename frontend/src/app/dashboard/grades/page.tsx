'use client';

import { useMemo, useState } from 'react';
import { useCourses, useAssignments, useAssignmentGroups, useCanvasConnected } from '@/lib/queries';
import type { Assignment, AssignmentGroup, Course } from '@/lib/types';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
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

function scoreNumColor(score: number | null): string {
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

function findFinalGroup(groups: AssignmentGroup[]): AssignmentGroup | undefined {
  const keywords = ['final', 'exam', 'midterm'];
  return groups.find((g) => keywords.some((kw) => g.name.toLowerCase().includes(kw)));
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
      <div className="px-10 py-14 max-w-[1080px]">
        <div className="mb-8">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>Grades</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
            Track and <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>estimate</em><br />your grades.
          </h1>
        </div>
        <div className="py-16 text-center rounded" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <h3 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400 }}>No grade data yet</h3>
          <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--text-faint)' }}>
            Connect Canvas to import your grades and run what-if scenarios.
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>Grades</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
            Track and <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>estimate</em><br />your grades.
          </h1>
          <p className="mt-3" style={{ fontSize: 13, color: 'var(--text-faint)' }}>
            {loading ? 'Loading…' : `${stats.total} course${stats.total !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!loading && stats.avgScore != null && (
          <div className="text-right flex-shrink-0 ml-10" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.7 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', letterSpacing: 0, marginBottom: 4 }}>
              {stats.avgScore}%
            </div>
            <div>Overall average</div>
          </div>
        )}
      </div>

      {/* Course list */}
      {loading ? (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="py-5 animate-pulse" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <div className="flex items-center gap-6">
                <div className="h-8 w-10 rounded" style={{ background: 'var(--surface-2)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded w-1/3" style={{ background: 'var(--surface-2)' }} />
                  <div className="h-3 rounded w-1/2" style={{ background: 'var(--surface-2)' }} />
                </div>
                <div className="h-10 w-12 rounded" style={{ background: 'var(--surface-2)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: 13 }}>
          No courses found.
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {courses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              assignments={assignments.filter((a) => a.course_id === course.id)}
              groups={groups.filter((g) => g.course_id === course.id)}
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

// ─── Course accordion row ─────────────────────────────────────────────────────

function CourseRow({ course, assignments, groups }: { course: Course; assignments: Assignment[]; groups: AssignmentGroup[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
      <button
        className="w-full text-left py-5 flex items-center gap-6 hover:opacity-80 transition-opacity"
        onClick={() => setExpanded((v) => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {/* Grade letter */}
        <div className="flex-shrink-0 w-12 text-right">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', color: gradeColor(course.current_grade) }}>
            {course.current_grade ?? '—'}
          </span>
        </div>

        {/* Course info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-1">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>{course.course_code}</span>
            {course.term && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint2)' }}>{course.term}</span>}
          </div>
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{course.name}</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="rounded-full" style={{ width: 120, height: 3, background: 'var(--surface-2)' }}>
              <div className="rounded-full" style={{ width: `${Math.min(100, course.current_score ?? 0)}%`, height: 3, background: scoreBarColor(course.current_score) }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: scoreNumColor(course.current_score) }}>
              {course.current_score != null ? `${course.current_score}%` : 'No score'}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        <div style={{ color: 'var(--text-faint)' }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {expanded && (
        <div className="pb-6 flex flex-col gap-6" style={{ paddingLeft: 72 }}>
          <CategoryBreakdown assignments={assignments} groups={groups} />
          <FinalEstimator course={course} groups={groups} />
        </div>
      )}
    </div>
  );
}

// ─── Assignment group breakdown ───────────────────────────────────────────────

function CategoryBreakdown({ assignments, groups }: { assignments: Assignment[]; groups: AssignmentGroup[] }) {
  const hasWeights = groups.some((g) => g.group_weight > 0);

  const groupStats = useMemo(() => {
    return groups.map((g) => {
      const graded = assignments.filter((a) => a.assignment_group_id === g.id && a.score != null && a.points_possible != null && a.points_possible > 0);
      const totalEarned = graded.reduce((sum, a) => sum + (a.score ?? 0), 0);
      const totalPossible = graded.reduce((sum, a) => sum + (a.points_possible ?? 0), 0);
      const categoryScore = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
      const contribution = categoryScore != null && hasWeights ? (categoryScore * g.group_weight) / 100 : null;
      return { group: g, categoryScore, contribution, gradedCount: graded.length, totalCount: assignments.filter((a) => a.assignment_group_id === g.id).length };
    });
  }, [assignments, groups, hasWeights]);

  if (groups.length === 0) {
    const graded = assignments.filter((a) => a.score != null && a.points_possible != null && a.points_possible > 0);
    const totalEarned = graded.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const totalPossible = graded.reduce((sum, a) => sum + (a.points_possible ?? 0), 0);
    const pct = totalPossible > 0 ? ((totalEarned / totalPossible) * 100).toFixed(1) : null;
    return (
      <div>
        <div className="mb-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Grade Breakdown</div>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          {pct != null ? `${totalEarned.toFixed(1)} / ${totalPossible.toFixed(1)} pts (${pct}%) across ${graded.length} graded assignment${graded.length !== 1 ? 's' : ''}` : 'No graded assignments yet.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Grade Breakdown</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderTop: '1px solid var(--border)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Category', hasWeights && 'Weight', 'Score', hasWeights && 'Contribution', 'Graded'].filter(Boolean).map((h) => (
                <th key={h as string} className="pb-2 pt-2 font-normal text-left first:text-left last:text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', textAlign: h === 'Graded' || h === 'Score' || h === 'Contribution' || h === 'Weight' ? 'right' : 'left' }}>
                  {h as string}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupStats.map(({ group, categoryScore, contribution, gradedCount, totalCount }) => (
              <tr key={group.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <td className="py-2.5" style={{ color: 'var(--text)', fontSize: 13.5 }}>{group.name}</td>
                {hasWeights && <td className="py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{group.group_weight}%</td>}
                <td className="py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: categoryScore != null ? scoreBarColor(categoryScore) : 'var(--text-faint)' }}>
                  {categoryScore != null ? `${categoryScore.toFixed(1)}%` : '—'}
                </td>
                {hasWeights && <td className="py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{contribution != null ? `${contribution.toFixed(1)} pts` : '—'}</td>}
                <td className="py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{gradedCount}/{totalCount}</td>
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
  const [finalWeight, setFinalWeight] = useState(finalGroup ? String(finalGroup.group_weight) : '20');
  const [runningGrade, setRunningGrade] = useState(course.current_score != null ? String(course.current_score) : '');

  const parsedWeight = parseFloat(finalWeight);
  const parsedRunning = parseFloat(runningGrade);
  const canCompute = !isNaN(parsedWeight) && parsedWeight > 0 && parsedWeight <= 100 && !isNaN(parsedRunning) && parsedRunning >= 0 && parsedRunning <= 100;

  return (
    <div>
      <div className="mb-4" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Final Grade Estimator</div>

      <div className="flex flex-wrap gap-4 mb-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Final exam weight (%)
            {finalGroup && <span className="ml-1" style={{ color: 'var(--text-faint2)' }}>— from &ldquo;{finalGroup.name}&rdquo;</span>}
          </span>
          <input
            type="number" min={0} max={100} step={1} value={finalWeight}
            onChange={(e) => setFinalWeight(e.target.value)}
            className="w-24 px-3 py-1.5 rounded text-sm focus:outline-none"
            style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Current running grade (%)</span>
          <input
            type="number" min={0} max={100} step={0.1} value={runningGrade}
            onChange={(e) => setRunningGrade(e.target.value)}
            className="w-28 px-3 py-1.5 rounded text-sm focus:outline-none"
            style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </label>
      </div>

      {!canCompute ? (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Enter valid values above to see grade thresholds.</p>
      ) : (
        <table className="w-full text-sm" style={{ borderTop: '1px solid var(--border)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Target', 'Min grade', 'Need on final', 'Feasibility'].map((h) => (
                <th key={h} className="py-2 font-normal text-left" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', textAlign: h !== 'Target' ? 'right' : 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADE_THRESHOLDS.map(({ letter, min }) => {
              const needed = neededOnFinal(min, parsedRunning, parsedWeight);
              const color = feasibilityColor(needed);
              const label = feasibilityLabel(needed);
              return (
                <tr key={letter} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <td className="py-2.5">
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: gradeColor(letter) }}>{letter}</span>
                  </td>
                  <td className="py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{min}%</td>
                  <td className="py-2.5 text-right font-medium" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color }}>
                    {needed === null ? '≤ 0%' : needed > 100 ? '>100%' : `${needed.toFixed(1)}%`}
                  </td>
                  <td className="py-2.5 text-right">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color }}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
