'use client';

/**
 * PlannerProvider — global context for study plan generation.
 *
 * Mirrors the SyncProvider pattern: the fetch lives here, not in the page
 * component, so navigating away during generation doesn't cancel it.
 * On finish it seeds the TanStack cache (QK.plannerPreview + QK.calendarEvents)
 * and fires a toast — whether the user is still on the planner page or not.
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { QK } from '@/lib/queries';
import type { PlanningPrefs, ProposedBlock, CalendarEvent } from '@/lib/types';

const API = process.env.NEXT_PUBLIC_API_URL;

interface PlannerContextValue {
  generating: boolean;
  triggerGenerate: (prefs: PlanningPrefs) => void;
}

const PlannerContext = createContext<PlannerContextValue>({
  generating: false,
  triggerGenerate: () => {},
});

export function usePlanner() {
  return useContext(PlannerContext);
}

function PlannerController({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);

  const triggerGenerate = useCallback((prefs: PlanningPrefs) => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);

    const loadingId = toast.loading('Generating your study plan…');

    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch(`${API}/api/google-calendar/preview-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ prefs }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `Error ${res.status}`);
        }

        const data = await res.json();
        const blocks = data.blocks as ProposedBlock[];
        const calendarEvents = (data.calendar_events ?? []) as CalendarEvent[];

        // Seed both caches — the planner page reads these reactively.
        queryClient.setQueryData(QK.plannerPreview, blocks);
        queryClient.setQueryData(QK.calendarEvents(prefs.days_ahead), calendarEvents);

        toast.dismiss(loadingId);
        toast.success(
          blocks.length > 0
            ? `Study plan ready — ${blocks.length} block${blocks.length !== 1 ? 's' : ''} proposed`
            : 'Plan generated — no blocks could be scheduled'
        );
      } catch (err) {
        toast.dismiss(loadingId);
        toast.error(err instanceof Error ? err.message : 'Failed to generate plan');
      } finally {
        generatingRef.current = false;
        setGenerating(false);
      }
    })();
  }, [queryClient]);

  return (
    <PlannerContext.Provider value={{ generating, triggerGenerate }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  return <PlannerController>{children}</PlannerController>;
}
