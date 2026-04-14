import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Assignment, AssignmentGroup, Course } from '@/lib/types';

// Query keys — centralised so every page uses the same cache bucket.
export const QK = {
  canvasConnected: ['canvas', 'connected'] as const,
  courses: ['courses'] as const,
  allCourses: ['courses', 'all'] as const,
  assignments: ['assignments'] as const,
  assignmentGroups: ['assignment_groups'] as const,
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
