import { ClipboardList } from 'lucide-react';

export default function AssignmentsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl">Assignments</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">All assignments across your courses</p>
      </div>
      <div className="surface-border rounded-xl p-12 text-center">
        <ClipboardList size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
        <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">No assignments yet</h3>
        <p className="text-[var(--text-dim)] text-sm">Connect Canvas to import your assignments automatically.</p>
      </div>
    </div>
  );
}
