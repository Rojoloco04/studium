import { Upload } from 'lucide-react';

export default function UploadPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-700 text-2xl">Upload Syllabus</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          Gemini extracts deadlines, grading policy, and exam dates from any PDF syllabus
        </p>
      </div>
      <div className="surface-border rounded-xl border-dashed p-16 text-center">
        <Upload size={32} className="text-[var(--text-faint)] mx-auto mb-4" />
        <h3 className="font-display font-600 text-base text-[var(--text)] mb-2">Drop your syllabus here</h3>
        <p className="text-[var(--text-dim)] text-sm mb-5">PDF, up to 20MB</p>
        <button className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          Choose file
        </button>
        <p className="text-xs text-[var(--text-faint)] mt-4 font-mono">Syllabus parser coming in Week 3</p>
      </div>
    </div>
  );
}
