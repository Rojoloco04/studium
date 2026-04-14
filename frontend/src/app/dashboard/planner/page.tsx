'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Calendar,
  Loader2,
  Sparkles,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  useGoogleCalendarConnected,
  useStudyBlocks,
  usePreviewStudyPlan,
  useConfirmStudyPlan,
  useDeleteStudyBlock,
} from '@/lib/queries';
import type { ProposedBlock, StudyBlock, PlanningPrefs } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const HOUR_OPTIONS = Array.from({ length: 19 }, (_, i) => i + 5); // 5–23

function formatHour(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
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
      {/* Days ahead */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-mono text-[var(--text-dim)]">Plan ahead</label>
          <span className="text-sm font-medium text-[var(--text)]">{prefs.days_ahead} day{prefs.days_ahead !== 1 ? 's' : ''}</span>
        </div>
        <input
          type="range"
          min={1}
          max={14}
          value={prefs.days_ahead}
          disabled={disabled}
          onChange={(e) => onChange({ ...prefs, days_ahead: Number(e.target.value) })}
          className="w-full accent-[var(--accent)] disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-[var(--text-faint)] mt-1">
          <span>1 day</span>
          <span>14 days</span>
        </div>
      </div>

      {/* Schedule window */}
      <div>
        <label className="block text-xs font-mono text-[var(--text-dim)] mb-2">Schedule window</label>
        <div className="flex items-center gap-2">
          <select
            value={prefs.day_start_hour}
            disabled={disabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({
                ...prefs,
                day_start_hour: v,
                day_end_hour: prefs.day_end_hour <= v ? v + 1 : prefs.day_end_hour,
              });
            }}
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            {startOptions.map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
          <span className="text-[var(--text-faint)] text-sm">to</span>
          <select
            value={prefs.day_end_hour}
            disabled={disabled}
            onChange={(e) => onChange({ ...prefs, day_end_hour: Number(e.target.value) })}
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            {endOptions.map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Max session length */}
      <div>
        <label className="block text-xs font-mono text-[var(--text-dim)] mb-2">Max session length</label>
        <div className="flex gap-2 flex-wrap">
          {SESSION_STOPS.map((mins) => (
            <button
              key={mins}
              type="button"
              disabled={disabled}
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

// ── Proposed block card ───────────────────────────────────────────────────────

function ProposedBlockCard({ block }: { block: ProposedBlock }) {
  return (
    <div className="surface-border rounded-xl p-4 space-y-1">
      <p className="text-sm font-medium text-[var(--text)]">{block.title}</p>
      {block.description && (
        <p className="text-xs text-[var(--text-dim)]">{block.description}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-[var(--text-faint)] font-mono pt-1">
        <Clock size={11} />
        <span>{formatTime(block.start_at)} – {formatTime(block.end_at)}</span>
        <span>·</span>
        <span>{block.duration_minutes}m</span>
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
        {block.description && (
          <p className="text-xs text-[var(--text-dim)] line-clamp-2">{block.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-[var(--text-faint)] font-mono pt-1">
          <Clock size={11} />
          <span>{formatTime(block.start_at)} – {formatTime(block.end_at)}</span>
          <span>·</span>
          <span>{block.duration_minutes}m</span>
        </div>
      </div>
      <button
        onClick={() => deleteBlock.mutate(block.id, {
          onError: () => toast.error('Failed to delete block'),
        })}
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

const DEFAULT_PREFS: PlanningPrefs = {
  days_ahead: 7,
  day_start_hour: 8,
  day_end_hour: 22,
  max_session_minutes: 120,
};

type PlannerState = 'idle' | 'previewing' | 'confirmed';

export default function PlannerPage() {
  const [prefs, setPrefs] = useState<PlanningPrefs>(DEFAULT_PREFS);
  const [plannerState, setPlannerState] = useState<PlannerState>('idle');
  const [proposedBlocks, setProposedBlocks] = useState<ProposedBlock[]>([]);
  const [previewError, setPreviewError] = useState('');

  const { data: gcalConnected, isLoading: gcalLoading } = useGoogleCalendarConnected();
  const { data: savedBlocks = [], isLoading: blocksLoading } = useStudyBlocks();
  const previewPlan = usePreviewStudyPlan();
  const confirmPlan = useConfirmStudyPlan();

  const hasSavedBlocks = savedBlocks.length > 0;

  // Show saved blocks view if they exist and we're not in preview mode
  const effectiveState: PlannerState =
    plannerState === 'previewing'
      ? 'previewing'
      : hasSavedBlocks
      ? 'confirmed'
      : 'idle';

  async function handleGenerate() {
    setPreviewError('');
    previewPlan.mutate(prefs, {
      onSuccess: (blocks) => {
        setProposedBlocks(blocks);
        setPlannerState('previewing');
      },
      onError: (err) => {
        setPreviewError(err instanceof Error ? err.message : 'Failed to generate plan');
      },
    });
  }

  async function handlePush() {
    confirmPlan.mutate(proposedBlocks, {
      onSuccess: (result) => {
        toast.success(`${result.pushed} study block${result.pushed !== 1 ? 's' : ''} added to Google Calendar`);
        setPlannerState('confirmed');
        setProposedBlocks([]);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to push to calendar');
      },
    });
  }

  function handleRegenerate() {
    setPlannerState('idle');
    setProposedBlocks([]);
    setPreviewError('');
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

  const groupedProposed = groupByDate(proposedBlocks);
  const groupedSaved = groupByDate(savedBlocks);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl text-[var(--text)]">Study Planner</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">AI-generated study blocks synced to Google Calendar</p>
      </div>

      {/* ── State: idle or regenerating ── */}
      {effectiveState === 'idle' && (
        <div className="space-y-6">
          <PrefsForm prefs={prefs} onChange={setPrefs} disabled={previewPlan.isPending} />

          {previewError && (
            <div className="flex items-center gap-2 text-[var(--danger)] text-sm">
              <AlertCircle size={14} />
              {previewError}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={previewPlan.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {previewPlan.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><Sparkles size={14} /> Generate Study Plan</>
            }
          </button>
        </div>
      )}

      {/* ── State: previewing Gemini proposals ── */}
      {effectiveState === 'previewing' && (
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

          {proposedBlocks.length === 0 ? (
            <div className="surface-border rounded-xl p-8 text-center text-[var(--text-faint)] text-sm">
              No study blocks could be scheduled — all assignments may already be submitted or past due.
            </div>
          ) : (
            <div className="space-y-6">
              {groupedProposed.map(([day, blocks]) => (
                <div key={day}>
                  <p className="text-xs font-mono text-[var(--text-faint)] mb-3 uppercase tracking-wide">
                    {formatDateLabel(blocks[0].start_at)}
                  </p>
                  <div className="space-y-2">
                    {blocks.map((b, i) => (
                      <ProposedBlockCard key={i} block={b} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {proposedBlocks.length > 0 && (
            <button
              onClick={handlePush}
              disabled={confirmPlan.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {confirmPlan.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Pushing to Calendar…</>
                : <><CheckCircle2 size={14} /> Push to Google Calendar</>
              }
            </button>
          )}
        </div>
      )}

      {/* ── State: saved blocks exist ── */}
      {effectiveState === 'confirmed' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-dim)]">
              {savedBlocks.length} block{savedBlocks.length !== 1 ? 's' : ''} scheduled
            </p>
            <button
              onClick={handleRegenerate}
              disabled={previewPlan.isPending}
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
              {groupedSaved.map(([day, blocks]) => (
                <div key={day}>
                  <p className="text-xs font-mono text-[var(--text-faint)] mb-3 uppercase tracking-wide">
                    {formatDateLabel(blocks[0].start_at)}
                  </p>
                  <div className="space-y-2">
                    {blocks.map((b) => (
                      <SavedBlockCard key={b.id} block={b} />
                    ))}
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
