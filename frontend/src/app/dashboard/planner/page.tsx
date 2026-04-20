'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  Loader2,
  Sparkles,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  QK,
  useGoogleCalendarConnected,
  useStudyBlocks,
  useCalendarEvents,
  usePlannerPreview,
  useConfirmStudyPlan,
  useDeleteStudyBlock,
  useSyncStudyBlocks,
} from '@/lib/queries';
import { usePlanner } from '@/lib/planner-provider';
import type { ProposedBlock, StudyBlock, PlanningPrefs, CalendarEvent } from '@/lib/types';

// ── Prefs persistence ─────────────────────────────────────────────────────────
// Prefs survive page refresh via localStorage. Timezone is always re-detected
// from the browser so it stays accurate (don't cache the stored one).

const PREFS_KEY = 'studium_planner_prefs';

function loadPrefs(): PlanningPrefs {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(PREFS_KEY) : null;
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PlanningPrefs>;
      return {
        days_ahead: saved.days_ahead ?? 7,
        day_start_hour: saved.day_start_hour ?? 8,
        day_end_hour: saved.day_end_hour ?? 22,
        max_session_minutes: saved.max_session_minutes ?? 120,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };
    }
  } catch { /* ignore */ }
  return {
    days_ahead: 7,
    day_start_hour: 8,
    day_end_hour: 22,
    max_session_minutes: 120,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

function savePrefs(p: PlanningPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOUR_OPTIONS = Array.from({ length: 19 }, (_, i) => i + 5); // 5–23

function fmtHour(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function fmtHourShort(h: number) {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDate<T extends { start_at: string }>(blocks: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const b of blocks) {
    const day = new Date(b.start_at).toDateString();
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(b);
  }
  return Array.from(map.entries());
}

function isAllDay(s: string) { return s.length === 10; }

function localMins(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

// ── Week Calendar ─────────────────────────────────────────────────────────────
//
// Always visible on the planner page:
//   Idle       → existing Google Calendar events only (gray)
//   Previewing → + proposed study blocks (dashed accent)
//   Confirmed  → + confirmed study blocks (solid accent)
//
// Shows PAGE_DAYS days at a time with prev/next navigation when days_ahead > 7.

const HOUR_PX = 52;
const PAGE_DAYS = 7;

interface WeekCalendarProps {
  daysCount: number;
  visStartHour: number;
  visEndHour: number;
  existingEvents: CalendarEvent[];
  eventsLoading?: boolean;
  proposedBlocks?: ProposedBlock[];
  confirmedBlocks?: StudyBlock[];
  onSync?: () => void;
  onDeleteBlock?: (id: string) => void;
  deletingBlockId?: string | null;
}

function WeekCalendar({
  daysCount,
  visStartHour,
  visEndHour,
  existingEvents,
  eventsLoading = false,
  proposedBlocks = [],
  confirmedBlocks = [],
  onSync,
  onDeleteBlock,
  deletingBlockId,
}: WeekCalendarProps) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(daysCount / PAGE_DAYS));
  const pageStart = page * PAGE_DAYS;
  const pageDays = Array.from({ length: Math.min(PAGE_DAYS, daysCount - pageStart) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + pageStart + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const visHours = visEndHour - visStartHour;
  const totalHeight = visHours * HOUR_PX;
  const timeLabels = Array.from({ length: visHours + 1 }, (_, i) => visStartHour + i);
  const today = new Date().toDateString();

  function dk(d: Date) { return d.toDateString(); }
  function idk(iso: string) { return new Date(iso).toDateString(); }

  function eventsOn(day: Date) {
    return existingEvents.filter((e) => !isAllDay(e.start) && idk(e.start) === dk(day));
  }
  function proposedOn(day: Date) {
    return proposedBlocks.filter((b) => idk(b.start_at) === dk(day));
  }
  function confirmedOn(day: Date) {
    return confirmedBlocks.filter((b) => idk(b.start_at) === dk(day));
  }

  function pos(startIso: string, endIso: string) {
    const sm = localMins(startIso);
    const em = localMins(endIso);
    const offset = Math.max(0, sm - visStartHour * 60);
    const cappedEnd = Math.min(em, visEndHour * 60);
    const visible = Math.max(8, cappedEnd - Math.max(sm, visStartHour * 60));
    return { top: offset * (HOUR_PX / 60), height: visible * (HOUR_PX / 60) };
  }

  const hasProposed = proposedBlocks.length > 0;
  const hasConfirmed = confirmedBlocks.length > 0;

  return (
    <div className="overflow-hidden text-xs" style={{ border: '1px solid var(--border)', borderRadius: 2 }}>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="font-mono text-[var(--text-faint)]">Week {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Day header */}
      <div className="flex border-b border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="w-9 flex-shrink-0" />
        {pageDays.map((day, i) => (
          <div
            key={i}
            className={`flex-1 text-center py-2 font-mono leading-tight ${
              dk(day) === today ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]'
            }`}
          >
            <div>{day.toLocaleDateString([], { weekday: 'short' })}</div>
            <div style={{ fontSize: '10px' }}>
              {day.toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex overflow-y-auto max-h-[360px]" style={{ background: 'var(--background)' }}>
        {/* Time labels */}
        <div className="w-9 flex-shrink-0 relative" style={{ height: totalHeight, background: 'var(--surface)' }}>
          {timeLabels.map((h, i) => (
            <div
              key={h}
              className="absolute w-full text-right pr-1.5 font-mono text-[var(--text-faint)]"
              style={{ top: i * HOUR_PX - 5, fontSize: '9px' }}
            >
              {fmtHourShort(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {pageDays.map((day, di) => (
          <div
            key={di}
            className="flex-1 relative border-l border-[var(--border)]"
            style={{ height: totalHeight, background: 'var(--background)' }}
          >
            {timeLabels.map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-[var(--border)]"
                style={{ top: i * HOUR_PX }}
              />
            ))}
            {dk(day) === today && (
              <div className="absolute inset-0 bg-[var(--accent)]/[0.03] pointer-events-none" />
            )}

            {eventsOn(day).map((e, i) => {
              const p = pos(e.start, e.end);
              return (
                <div
                  key={i}
                  title={e.title || '(busy)'}
                  className="absolute left-0.5 right-0.5 rounded overflow-hidden bg-[var(--surface-2)] border border-[var(--border-strong)]"
                  style={{ top: p.top, height: p.height }}
                >
                  {p.height >= 18 && (
                    <p className="px-1 text-[var(--text-dim)] truncate leading-tight pt-px" style={{ fontSize: '10px' }}>
                      {e.title || '(busy)'}
                    </p>
                  )}
                </div>
              );
            })}

            {proposedOn(day).map((b, i) => {
              const p = pos(b.start_at, b.end_at);
              return (
                <div
                  key={i}
                  title={b.title}
                  className="absolute left-0.5 right-0.5 rounded overflow-hidden bg-[var(--accent)]/10 border border-dashed border-[var(--accent)]/70"
                  style={{ top: p.top, height: p.height }}
                >
                  {p.height >= 18 && (
                    <p className="px-1 text-[var(--accent)] truncate leading-tight pt-px" style={{ fontSize: '10px' }}>
                      {b.title}
                    </p>
                  )}
                </div>
              );
            })}

            {confirmedOn(day).map((b, i) => {
              const p = pos(b.start_at, b.end_at);
              const isDeleting = deletingBlockId === b.id;
              return (
                <div
                  key={i}
                  title={b.title}
                  className="absolute left-0.5 right-0.5 rounded overflow-hidden bg-[var(--accent)]/20 border border-[var(--accent)] group"
                  style={{ top: p.top, height: p.height }}
                >
                  {p.height >= 18 && (
                    <p className="px-1 text-[var(--accent)] truncate leading-tight pt-px pr-3" style={{ fontSize: '10px' }}>
                      {b.title}
                    </p>
                  )}
                  {onDeleteBlock && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteBlock(b.id); }}
                      disabled={isDeleting}
                      className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded bg-[var(--danger)] text-white disabled:opacity-50"
                      title="Delete block"
                    >
                      {isDeleting ? <Loader2 size={7} className="animate-spin" /> : <X size={7} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend + loading indicator */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        {eventsLoading ? (
          <div className="flex items-center gap-1.5 text-[var(--text-faint)]">
            <Loader2 size={10} className="animate-spin" />
            <span className="font-mono" style={{ fontSize: '10px' }}>Loading calendar…</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[var(--surface-2)] border border-[var(--border-strong)]" />
            <span className="font-mono text-[var(--text-faint)]" style={{ fontSize: '10px' }}>Your events</span>
          </div>
        )}
        {hasProposed && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[var(--accent)]/10 border border-dashed border-[var(--accent)]/70" />
            <span className="font-mono text-[var(--accent)]" style={{ fontSize: '10px' }}>Proposed</span>
          </div>
        )}
        {hasConfirmed && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[var(--accent)]/20 border border-[var(--accent)]" />
            <span className="font-mono text-[var(--accent)]" style={{ fontSize: '10px' }}>Scheduled</span>
          </div>
        )}
        {onSync && (
          <button
            onClick={onSync}
            disabled={eventsLoading}
            className="ml-auto flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40 transition-colors"
            title="Sync calendar"
          >
            <RefreshCw size={10} className={eventsLoading ? 'animate-spin' : ''} />
            <span className="font-mono" style={{ fontSize: '10px' }}>Sync</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Prefs form ────────────────────────────────────────────────────────────────

const SESSION_STOPS = [30, 60, 90, 120, 150, 180];

interface PrefsFormProps {
  prefs: PlanningPrefs;
  onChange: (p: PlanningPrefs) => void;
  disabled?: boolean;
}

function PrefsForm({ prefs, onChange, disabled }: PrefsFormProps) {
  const endOptions = HOUR_OPTIONS.filter((h) => h > prefs.day_start_hour);
  const startOptions = HOUR_OPTIONS.filter((h) => h < prefs.day_end_hour);

  return (
    <div className="space-y-5 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Plan ahead
          </label>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text)' }}>
            {prefs.days_ahead} day{prefs.days_ahead !== 1 ? 's' : ''}
          </span>
        </div>
        <input
          type="range" min={1} max={14} value={prefs.days_ahead} disabled={disabled}
          onChange={(e) => onChange({ ...prefs, days_ahead: Number(e.target.value) })}
          className="w-full accent-[var(--accent)] disabled:opacity-50"
          style={{ height: 1, background: 'var(--border)' }}
        />
        <div className="flex justify-between mt-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint2)' }}>
          <span>1d</span><span>14d</span>
        </div>
      </div>

      <div>
        <label className="block mb-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Schedule window
        </label>
        <div className="flex items-center gap-2">
          <select
            value={prefs.day_start_hour} disabled={disabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ ...prefs, day_start_hour: v, day_end_hour: prefs.day_end_hour <= v ? v + 1 : prefs.day_end_hour });
            }}
            className="flex-1 px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 2 }}
          >
            {startOptions.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>TO</span>
          <select
            value={prefs.day_end_hour} disabled={disabled}
            onChange={(e) => onChange({ ...prefs, day_end_hour: Number(e.target.value) })}
            className="flex-1 px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 2 }}
          >
            {endOptions.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block mb-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Max session length
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {SESSION_STOPS.map((mins) => (
            <button
              key={mins} type="button" disabled={disabled}
              onClick={() => onChange({ ...prefs, max_session_minutes: mins })}
              className="disabled:opacity-50 transition-colors"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 2,
                background: prefs.max_session_minutes === mins ? 'var(--text)' : 'transparent',
                color: prefs.max_session_minutes === mins ? 'var(--background)' : 'var(--text-faint)',
                cursor: 'pointer',
              }}
            >
              {mins < 60 ? `${mins}m` : `${mins / 60}h`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Saved block card ──────────────────────────────────────────────────────────

function SavedBlockCard({ block }: { block: StudyBlock }) {
  const deleteBlock = useDeleteStudyBlock();
  return (
    <div className="group flex items-baseline gap-6 py-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0, width: 120 }}>
        {formatTime(block.start_at)} – {formatTime(block.end_at)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{block.title}</p>
        {block.description && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>{block.description}</p>}
      </div>
      <span className="flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
        {block.duration_minutes}m
      </span>
      <button
        onClick={() => deleteBlock.mutate(block.id, { onError: () => toast.error('Failed to delete block') })}
        disabled={deleteBlock.isPending}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
        style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        aria-label="Delete study block"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  // Prefs persisted in localStorage so they survive refresh.
  const [prefs, setPrefsState] = useState<PlanningPrefs>(loadPrefs);
  const setPrefs = useCallback((p: PlanningPrefs) => {
    setPrefsState(p);
    savePrefs(p);
  }, []);

  const queryClient = useQueryClient();

  const { data: gcalConnected, isLoading: gcalLoading } = useGoogleCalendarConnected();
  const { data: savedBlocks = [], isLoading: blocksLoading } = useStudyBlocks();

  // Proposed blocks live in TanStack cache — survive navigation within session.
  const { data: proposedBlocks = [] } = usePlannerPreview();

  // Calendar events cached for 5 min; seeded by preview response so no
  // extra round-trip is needed after generating a plan.
  const { data: calendarEvents = [], isFetching: eventsLoading } = useCalendarEvents(prefs.days_ahead);

  const { generating, triggerGenerate } = usePlanner();
  const confirmPlan = useConfirmStudyPlan();
  const deleteBlock = useDeleteStudyBlock();
  const syncBlocks = useSyncStudyBlocks();

  // Derive planner state — no separate useState needed.
  type PlannerState = 'idle' | 'previewing' | 'confirmed';
  const plannerState: PlannerState =
    proposedBlocks.length > 0 ? 'previewing' :
    savedBlocks.length > 0 ? 'confirmed' : 'idle';

  const calVisStart = Math.max(0, prefs.day_start_hour - 1);
  const calVisEnd = Math.min(23, prefs.day_end_hour);

  function handleGenerate() {
    triggerGenerate(prefs);
  }

  function handlePush() {
    confirmPlan.mutate(proposedBlocks, {
      onSuccess: (result) => {
        toast.success(`${result.pushed} study block${result.pushed !== 1 ? 's' : ''} added to Google Calendar`);
        // QK.plannerPreview cleared + QK.studyBlocks invalidated in useConfirmStudyPlan.onSuccess
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to push to calendar'),
    });
  }

  function handleRegenerate() {
    queryClient.setQueryData(QK.plannerPreview, []);
  }

  async function handleSyncCalendar() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: QK.calendarEvents(prefs.days_ahead) }),
      syncBlocks.mutateAsync(),
    ]);
    toast.success('Calendar synced');
  }

  function handleDeleteBlock(id: string) {
    deleteBlock.mutate(id, { onError: () => toast.error('Failed to delete block') });
  }

  // ── Loading ──────────────────────────────────────────────────

  if (gcalLoading) {
    return (
      <div className="px-10 py-14 flex items-center gap-2" style={{ color: 'var(--text-faint)' }}>
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  // ── Not connected ────────────────────────────────────────────

  if (!gcalConnected) {
    return (
      <div className="px-10 py-14 max-w-[1080px]">
        <div className="mb-8">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
            Study Planner
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
            Make <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>time</em> for<br />the work ahead.
          </h1>
        </div>
        <div className="py-16 text-center rounded" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <Calendar size={28} className="mx-auto mb-4" style={{ color: 'var(--text-faint)' }} />
          <h3 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400 }}>Connect Google Calendar first</h3>
          <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--text-faint)' }}>
            The planner needs access to your Google Calendar to read your schedule and add study blocks.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--background)', fontWeight: 500 }}
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────

  return (
    <div className="px-10 py-14 max-w-[1080px] space-y-8">
      <div className="mb-0">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
          Study Planner · Week {Math.ceil((new Date().getDate()) / 7)}
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
          Make <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>time</em> for<br />the work ahead.
        </h1>
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          AI-generated study blocks, synced to your Google Calendar.
        </p>
      </div>

      {/* ── Calendar — always visible at top ── */}
      <WeekCalendar
        daysCount={prefs.days_ahead}
        visStartHour={calVisStart}
        visEndHour={calVisEnd}
        existingEvents={calendarEvents}
        eventsLoading={eventsLoading}
        proposedBlocks={plannerState === 'previewing' ? proposedBlocks : []}
        confirmedBlocks={plannerState === 'confirmed' ? savedBlocks : []}
        onSync={handleSyncCalendar}
        onDeleteBlock={plannerState === 'confirmed' ? handleDeleteBlock : undefined}
        deletingBlockId={deleteBlock.isPending ? deleteBlock.variables : null}
      />

      {/* ── State: idle ── */}
      {plannerState === 'idle' && (
        <div className="space-y-6">
          <PrefsForm prefs={prefs} onChange={setPrefs} disabled={generating} />
          <div className="space-y-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--text)', color: 'var(--background)', padding: '12px 20px', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {generating
                ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                : <><Sparkles size={13} /> Generate Study Plan</>
              }
            </button>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Usually takes 15–30 seconds. You can navigate away — we&apos;ll notify you when it&apos;s ready.
            </p>
          </div>
        </div>
      )}

      {/* ── State: previewing ── */}
      {plannerState === 'previewing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Proposed sessions · {proposedBlocks.length} total
            </div>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--text)]"
              style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <RefreshCw size={11} /> Regenerate
            </button>
          </div>

          <div className="space-y-8" style={{ borderTop: '1px solid var(--border)' }}>
            {groupByDate(proposedBlocks).map(([day, blocks]) => (
              <div key={day} className="pt-4">
                <div className="flex items-baseline justify-between mb-3">
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: '-0.01em', color: 'var(--text)' }}>
                    {formatDateLabel(blocks[0].start_at)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint2)' }}>
                    {blocks.length} session{blocks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {blocks.map((b, i) => (
                  <div key={i} className="grid items-baseline py-3" style={{ gridTemplateColumns: '120px 1fr 60px', gap: 20, borderBottom: '1px solid var(--border-soft)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                      {formatTime(b.start_at)} – {formatTime(b.end_at)}
                    </span>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{b.title}</p>
                      {b.description && <p className="text-xs mt-0.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>{b.description}</p>}
                    </div>
                    <span className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
                      {b.duration_minutes}m
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handlePush}
              disabled={confirmPlan.isPending}
              className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--text)', color: 'var(--background)', padding: '12px 20px', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {confirmPlan.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Adding to Calendar…</>
                : <><CheckCircle2 size={13} /> Add to Google Calendar</>
              }
            </button>
            <button onClick={handleRegenerate} className="text-sm transition-colors hover:text-[var(--text)]" style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Discard proposal
            </button>
          </div>
        </div>
      )}

      {/* ── State: confirmed (saved blocks exist) ── */}
      {plannerState === 'confirmed' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              {savedBlocks.length} block{savedBlocks.length !== 1 ? 's' : ''} scheduled
            </div>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--text)] disabled:opacity-50"
              style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Sparkles size={11} /> Regenerate Plan
            </button>
          </div>

          {blocksLoading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-faint)' }}>
              <Loader2 size={14} className="animate-spin" /> Loading blocks…
            </div>
          ) : (
            <div className="space-y-8" style={{ borderTop: '1px solid var(--border)' }}>
              {groupByDate(savedBlocks).map(([day, blocks]) => (
                <div key={day} className="pt-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: '-0.01em', color: 'var(--text)' }}>
                      {formatDateLabel(blocks[0].start_at)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint2)' }}>
                      {blocks.length} session{blocks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {blocks.map((b) => <SavedBlockCard key={b.id} block={b} />)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
