import { Calendar } from 'lucide-react';

export default function PlannerPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl">Study Planner</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">AI-generated study blocks synced to Google Calendar</p>
      </div>
      <div className="surface-border rounded-xl p-12 text-center">
        <Calendar size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
        <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">Planner coming soon</h3>
        <p className="text-[var(--text-dim)] text-sm">Connect Canvas first, then the planner will schedule study blocks automatically.</p>
      </div>
    </div>
  );
}
