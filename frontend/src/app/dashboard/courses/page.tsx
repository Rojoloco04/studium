import { BookOpen } from 'lucide-react';

export default function CoursesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl">Courses</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">Your enrolled courses this semester</p>
      </div>
      <div className="surface-border rounded-xl p-12 text-center">
        <BookOpen size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
        <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">No courses yet</h3>
        <p className="text-[var(--text-dim)] text-sm">Connect Canvas or upload a syllabus to get started.</p>
      </div>
    </div>
  );
}
