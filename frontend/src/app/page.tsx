'use client';

import Link from 'next/link';
import { BookOpen, Calendar, Brain, TrendingUp, ArrowRight, Zap } from 'lucide-react';

const features = [
  {
    icon: BookOpen,
    label: 'Canvas Sync',
    desc: 'Pulls your real assignments, due dates, and grades automatically.',
  },
  {
    icon: Brain,
    label: 'Syllabus Parser',
    desc: 'Upload any PDF syllabus — AI extracts every deadline and policy.',
  },
  {
    icon: Calendar,
    label: 'Smart Scheduler',
    desc: 'Blocks study time in Google Calendar based on assignment weight and urgency.',
  },
  {
    icon: TrendingUp,
    label: 'Grade Estimator',
    desc: 'Model your grade with scenario sliders. Know exactly where you stand.',
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <span className="font-display font-700 text-lg tracking-tight">
          studi<span className="accent-gradient">um</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors text-sm"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-[var(--accent)] text-white text-sm px-4 py-1.5 rounded-md hover:opacity-90 transition-opacity font-medium"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center relative overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(124,111,255,0.08) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[var(--accent-dim)] border border-[var(--accent)] border-opacity-30 rounded-full px-3 py-1 mb-8">
            <Zap size={12} className="text-[var(--accent)]" />
            <span className="text-xs font-mono text-[var(--accent)]">Canvas + AI + Google Calendar</span>
          </div>

          <h1 className="font-display font-800 text-5xl sm:text-6xl leading-[1.1] tracking-tight mb-6">
            Your courses,{' '}
            <span className="accent-gradient">actually under control</span>
          </h1>

          <p className="text-[var(--text-dim)] text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            Studium syncs with Canvas, parses your syllabi, and builds a real study schedule
            — so you stop guessing what to work on and when.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Start for free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 surface-border text-[var(--text-dim)] px-6 py-3 rounded-lg font-medium hover:text-[var(--text)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="surface-border rounded-xl p-5 hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center">
                  <Icon size={15} className="text-[var(--accent)]" />
                </div>
                <span className="font-display font-600 text-sm">{label}</span>
              </div>
              <p className="text-[var(--text-dim)] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-4 text-center">
        <span className="text-[var(--text-faint)] text-xs font-mono">
          studium — built by Jack
        </span>
      </footer>
    </main>
  );
}
