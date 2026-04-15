export type Course = {
  id: string;
  canvas_id: number;
  user_id: string;
  name: string;
  course_code: string;
  term: string | null;
  current_grade: string | null;
  current_score: number | null;
  hidden: boolean;
  created_at: string;
};

export type AssignmentGroup = {
  id: string;
  canvas_id: number;
  course_id: string;
  name: string;
  group_weight: number;
};

export type Assignment = {
  id: string;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  score: number | null;
  submitted: boolean;
  submission_types: string[];
  course_id: string;
  assignment_group_id: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  courses: Pick<Course, 'name' | 'course_code' | 'hidden'> | null;
};

export type StudyBlock = {
  id: string;
  assignment_id: string | null;
  course_id: string | null;
  gcal_event_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: string;
};

export type ProposedBlock = {
  assignment_id: string | null;
  course_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  duration_minutes: number;
};

export type PlanningPrefs = {
  days_ahead: number;
  day_start_hour: number;
  day_end_hour: number;
  max_session_minutes: number;
  // IANA timezone string detected from the browser (e.g. "America/Chicago").
  // Must be included so Gemini schedules in the user's local time, not UTC.
  timezone: string;
};

export type CalendarEvent = {
  id?: string;
  title: string;
  /** ISO datetime string (timed events) or YYYY-MM-DD (all-day events). */
  start: string;
  end: string;
};
