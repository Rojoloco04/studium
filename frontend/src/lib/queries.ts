import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Assignment, AssignmentGroup, Course, StudyBlock, ProposedBlock, PlanningPrefs, CalendarEvent } from '@/lib/types';

// Query keys — centralised so every page uses the same cache bucket.
export const QK = {
  canvasConnected: ['canvas', 'connected'] as const,
  courses: ['courses'] as const,
  allCourses: ['courses', 'all'] as const,
  assignments: ['assignments'] as const,
  assignmentGroups: ['assignment_groups'] as const,
  googleCalendarConnected: ['google-calendar', 'connected'] as const,
  studyBlocks: ['study_blocks'] as const,
  // Parameterised: calendarEvents(7) vs calendarEvents(14) are separate cache entries.
  calendarEvents: (days: number) => ['calendar_events', days] as const,
  // Planner preview blocks — stored in cache so navigating away and back
  // doesn't lose a generated plan. Cleared on confirm or explicit regenerate.
  plannerPreview: ['planner', 'preview'] as const,
};

function getSupabase() {
  return createClient();
}

// ─── Canvas connection status ───────────────────────────────────────────────

export function useCanvasConnected() {
  return useQuery({
    queryKey: QK.canvasConnected,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from('canvas_tokens')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    staleTime: Infinity, // connection status only changes on the Canvas setup page
  });
}

// ─── Courses ────────────────────────────────────────────────────────────────

export function useCourses() {
  return useQuery({
    queryKey: QK.courses,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as Course[];
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('user_id', user.id)
        .eq('hidden', false)
        .order('name');
      if (error) throw error;
      return (data as Course[]) ?? [];
    },
    staleTime: 1000 * 60 * 5, // 5 min — data only changes after a Canvas sync
  });
}

// All courses including hidden ones — used only for the settings hidden-courses manager.
export function useAllCourses() {
  return useQuery({
    queryKey: QK.allCourses,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as Course[];
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      return (data as Course[]) ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export function useAssignments() {
  return useQuery({
    queryKey: QK.assignments,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as Assignment[];
      const { data, error } = await supabase
        .from('assignments')
        .select(
          'id, name, due_at, points_possible, score, submitted, submission_types, course_id, assignment_group_id, estimated_hours, actual_hours, courses(name, course_code, hidden)'
        )
        .eq('user_id', user.id)
        .order('due_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const all = (data as unknown as Assignment[]) ?? [];
      return all.filter((a) => !a.courses?.hidden);
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Assignment groups ───────────────────────────────────────────────────────

export function useAssignmentGroups() {
  return useQuery({
    queryKey: QK.assignmentGroups,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as AssignmentGroup[];
      const { data, error } = await supabase
        .from('assignment_groups')
        .select('id, canvas_id, course_id, name, group_weight')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      return (data as AssignmentGroup[]) ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Toggle submitted ────────────────────────────────────────────────────────

export function useToggleSubmitted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, submitted }: { id: string; submitted: boolean }) => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('assignments')
        .update({ submitted })
        .eq('id', id);
      if (error) throw error;
    },
    // Optimistic update: flip the bit in cache immediately.
    onMutate: async ({ id, submitted }) => {
      await queryClient.cancelQueries({ queryKey: QK.assignments });
      const previous = queryClient.getQueryData<Assignment[]>(QK.assignments);
      queryClient.setQueryData<Assignment[]>(QK.assignments, (old = []) =>
        old.map((a) => (a.id === id ? { ...a, submitted } : a))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QK.assignments, context.previous);
      }
    },
  });
}

// ─── Google Calendar connection status ───────────────────────────────────────

export function useGoogleCalendarConnected() {
  return useQuery({
    queryKey: QK.googleCalendarConnected,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from('google_tokens')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    staleTime: Infinity,
  });
}

// ─── Study blocks ─────────────────────────────────────────────────────────────

export function useStudyBlocks() {
  return useQuery({
    queryKey: QK.studyBlocks,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as StudyBlock[];
      const { data, error } = await supabase
        .from('study_blocks')
        .select('*')
        .eq('user_id', user.id)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return (data as StudyBlock[]) ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Preview study plan (Gemini, no side effects) ────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL;

async function getAuthHeaders() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export function usePreviewStudyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: PlanningPrefs): Promise<{ blocks: ProposedBlock[]; calendarEvents: CalendarEvent[] }> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/google-calendar/preview-plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prefs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      return {
        blocks: data.blocks as ProposedBlock[],
        calendarEvents: (data.calendar_events ?? []) as CalendarEvent[],
      };
    },
    onSuccess: ({ blocks, calendarEvents }, prefs) => {
      // Seed both caches from the single preview response so the planner page
      // can render the full calendar without a second round-trip.
      queryClient.setQueryData(QK.calendarEvents(prefs.days_ahead), calendarEvents);
      // Store proposed blocks in cache — survives navigation away and back.
      queryClient.setQueryData(QK.plannerPreview, blocks);
    },
  });
}

// ─── Planner preview blocks ───────────────────────────────────────────────────
// Proposed blocks live in the TanStack cache (not component state) so they
// survive navigation. usePreviewStudyPlan.onSuccess writes here; clearing is
// done by the page via queryClient.setQueryData(QK.plannerPreview, []).

export function usePlannerPreview() {
  return useQuery({
    queryKey: QK.plannerPreview,
    // Never fetches from network — only populated by setQueryData.
    queryFn: (): ProposedBlock[] => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30, // evict 30 min after last observer unmounts
  });
}

// ─── Calendar events (read-only, for UI display) ─────────────────────────────
// Pattern: fetch once into TanStack cache (staleTime: 5min), read locally in
// components, never call the API directly from component code.

export function useCalendarEvents(days: number) {
  return useQuery({
    queryKey: QK.calendarEvents(days),
    queryFn: async (): Promise<CalendarEvent[]> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/google-calendar/events?days=${days}`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data as CalendarEvent[];
    },
    staleTime: 1000 * 60 * 5, // 5 min — Google Calendar data doesn't change mid-session
  });
}

// ─── Confirm study plan (push to GCal + store in DB) ─────────────────────────

export function useConfirmStudyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blocks: ProposedBlock[]) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/google-calendar/confirm-plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ blocks }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.studyBlocks });
      // Clear proposed blocks cache — plan is now confirmed, no longer a preview.
      queryClient.setQueryData(QK.plannerPreview, []);
    },
  });
}

// ─── Delete study block ───────────────────────────────────────────────────────

export function useDeleteStudyBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/google-calendar/study-blocks/${blockId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
    },
    onMutate: async (blockId) => {
      await queryClient.cancelQueries({ queryKey: QK.studyBlocks });
      const previous = queryClient.getQueryData<StudyBlock[]>(QK.studyBlocks);
      queryClient.setQueryData<StudyBlock[]>(QK.studyBlocks, (old = []) =>
        old.filter((b) => b.id !== blockId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QK.studyBlocks, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QK.studyBlocks });
    },
  });
}

// ─── Sync study blocks (remove orphans whose GCal event was deleted) ─────────

export function useSyncStudyBlocks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ removed: number }> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/google-calendar/sync-study-blocks`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.studyBlocks });
    },
  });
}

// ─── Toggle course hidden ────────────────────────────────────────────────────

export function useToggleHideCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('courses')
        .update({ hidden })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, hidden }) => {
      await queryClient.cancelQueries({ queryKey: QK.courses });
      const previous = queryClient.getQueryData<Course[]>(QK.courses);
      if (hidden) {
        // Optimistically remove from the visible courses list
        queryClient.setQueryData<Course[]>(QK.courses, (old = []) =>
          old.filter((c) => c.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QK.courses, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QK.courses });
      queryClient.invalidateQueries({ queryKey: QK.allCourses });
      queryClient.invalidateQueries({ queryKey: QK.assignments });
    },
  });
}
