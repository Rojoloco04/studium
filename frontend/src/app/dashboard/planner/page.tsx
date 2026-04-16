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
    <div className="surface-border rounded-xl overflow-hidden text-xs">
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
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
      <div className="flex border-b border-[var(--border)] bg-[var(--surface)]">
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
      <div ref={scrollRef} className="flex overflow-y-auto max-h-[360px]">
        {/* Time labels */}
        <div className="w-9 flex-shrink-0 relative bg-[var(--surface)]" style={{ height: totalHeight }}>
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
            style={{ height: totalHeight }}
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
                    <p className="px-1 text-[var(--text-dim)] truncate leading-tight pt-px" style={{ fontSize: '9px' }}>
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
                    <p className="px-1 text-[var(--accent)] truncate leading-tight pt-px" style={{ fontSize: '9px' }}>
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
                    <p className="px-1 text-[var(--accent)] truncate leading-tight pt-px pr-3" style={{ fontSize: '9px' }}>
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
      <div className="flex items-center gap-4 px-3 py-2 border-t border-[var(--border)] bg-[var(--surface)]">
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
    <div className="surface-border rounded-xl p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-mono text-[var(--text-dim)]">Plan ahead</label>
          <span className="text-sm font-medium text-[var(--text)]">{prefs.days_ahead} day{prefs.days_ahead !== 1 ? 's' : ''}</span>
        </div>
        <input
          type="range" min={1} max={14} value={prefs.days_ahead} disabled={disabled}
          onChange={(e) => onChange({ ...prefs, days_ahead: Number(e.target.value) })}
          className="w-full accent-[var(--accent)] disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-[var(--text-faint)] mt-1">
          <span>1 day</span><span>14 days</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-[var(--text-dim)] mb-2">Schedule window</label>
        <div className="flex items-center gap-2">
          <select
            value={prefs.day_start_hour} disabled={disabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ ...prefs, day_start_hour: v, day_end_hour: prefs.day_end_hour <= v ? v + 1 : prefs.day_end_hour });
            }}
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            {startOptions.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
          <span className="text-[var(--text-faint)] text-sm">to</span>
          <select
            value={prefs.day_end_hour} disabled={disabled}
            onChange={(e) => onChange({ ...prefs, day_end_hour: Number(e.target.value) })}
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            {endOptions.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-[var(--text-dim)] mb-2">Max session length</label>
        <div className="flex gap-2 flex-wrap">
          {SESSION_STOPS.map((mins) => (
            <button
              key={mins} type="button" disabled={disabled}
              onClick={() => onChange({ ...prefs, max_session_minutes: mins })}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
                prefs.max_session_minutes === mins
                  ? 'bg-[var(--accent)] text-white'
                  : 'surface-border text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
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
    <div className="surface-border rounded-xl p-4 flex items-start gap-3">
      <div className="flex-1 space-y-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] truncate">{block.title}</p>
        {block.description && <p className="text-xs text-[var(--text-dim)] line-clamp-2">{block.description}</p>}
        <div className="flex items-center gap-2 text-xs text-[var(--text-faint)] font-mono pt-1">
          <Clock size={11} />
          <span>{formatTime(block.start_at)} – {formatTime(block.end_at)}</span>
          <span>·</span>
          <span>{block.duration_minutes}m</span>
        </div>
      </div>
      <button
        onClick={() => deleteBlock.mutate(block.id, { onError: () => toast.error('Failed to delete block') })}
        disabled={deleteBlock.isPending}
        className="flex-shrink-0 p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
        aria-label="Delete study block"
      >
        <Trash2 size={13} />
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
      <div className="p-6 max-w-2xl mx-auto flex items-center gap-2 text-[var(--text-faint)]">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  // ── Not connected ────────────────────────────────────────────

  if (!gcalConnected) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-700 text-2xl text-[var(--text)]">Study Planner</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">AI-generated study blocks synced to Google Calendar</p>
        </div>
        <div className="surface-border rounded-xl p-10 text-center space-y-4">
          <Calendar size={32} className="text-[var(--text-faint)] mx-auto" />
          <div>
            <h3 className="font-display font-600 text-base text-[var(--text)] mb-1">Connect Google Calendar first</h3>
            <p className="text-[var(--text-dim)] text-sm">
              The planner needs access to your Google Calendar to read your schedule and add study blocks.
            </p>
          </div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl text-[var(--text)]">Study Planner</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">AI-generated study blocks synced to Google Calendar</p>
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

          <div className="space-y-1.5">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generating
                ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                : <><Sparkles size={14} /> Generate Study Plan</>
              }
            </button>
            <p className="text-xs text-[var(--text-faint)]">
              Usually takes 15&ndash;30 seconds. You can navigate away &mdash; we&apos;ll notify you when it&apos;s ready.
            </p>
          </div>
        </div>
      )}

      {/* ── State: previewing ── */}
      {plannerState === 'previewing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-dim)]">
              {proposedBlocks.length} study block{proposedBlocks.length !== 1 ? 's' : ''} proposed
            </p>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          </div>

          <div className="space-y-6">
            {groupByDate(proposedBlocks).map(([day, blocks]) => (
              <div key={day}>
                <p className="text-xs font-mono text-[var(--text-faint)] mb-3 uppercase tracking-wide">
                  {formatDateLabel(blocks[0].start_at)}
                </p>
                <div className="space-y-2">
                  {blocks.map((b, i) => (
                    <div key={i} className="surface-border rounded-xl p-4 space-y-1">
                      <p className="text-sm font-medium text-[var(--text)]">{b.title}</p>
                      {b.description && <p className="text-xs text-[var(--text-dim)]">{b.description}</p>}
                      <div className="flex items-center gap-2 text-xs text-[var(--text-faint)] font-mono pt-1">
                        <Clock size={11} />
                        <span>{formatTime(b.start_at)} – {formatTime(b.end_at)}</span>
                        <span>·</span>
                        <span>{b.duration_minutes}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handlePush}
            disabled={confirmPlan.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {confirmPlan.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Adding to Calendar…</>
              : <><CheckCircle2 size={14} /> Add to Google Calendar</>
            }
          </button>
        </div>
      )}

      {/* ── State: confirmed (saved blocks exist) ── */}
      {plannerState === 'confirmed' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-dim)]">
              {savedBlocks.length} block{savedBlocks.length !== 1 ? 's' : ''} scheduled
            </p>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            >
              <Sparkles size={12} />
              Regenerate Plan
            </button>
          </div>

          {blocksLoading ? (
            <div className="flex items-center gap-2 text-[var(--text-faint)] text-sm">
              <Loader2 size={14} className="animate-spin" />
              Loading blocks…
            </div>
          ) : (
            <div className="space-y-6">
              {groupByDate(savedBlocks).map(([day, blocks]) => (
                <div key={day}>
                  <p className="text-xs font-mono text-[var(--text-faint)] mb-3 uppercase tracking-wide">
                    {formatDateLabel(blocks[0].start_at)}
                  </p>
                  <div className="space-y-2">
                    {blocks.map((b) => <SavedBlockCard key={b.id} block={b} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
