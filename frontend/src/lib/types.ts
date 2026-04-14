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
