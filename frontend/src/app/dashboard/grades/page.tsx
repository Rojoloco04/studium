import { TrendingUp } from 'lucide-react';

export default function GradesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl">Grade Estimator</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">Model your final grade with scenario sliders</p>
      </div>
      <div className="surface-border rounded-xl p-12 text-center">
        <TrendingUp size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
        <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">No grade data yet</h3>
        <p className="text-[var(--text-dim)] text-sm">Connect Canvas to start tracking and estimating your grades.</p>
      </div>
    </div>
  );
}
