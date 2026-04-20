import { Upload } from 'lucide-react';

export default function UploadPage() {
  return (
    <div className="px-10 py-14 max-w-[1080px]">
      {/* Page header */}
      <div className="mb-8">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
          Upload Syllabus
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400 }}>
          Let Gemini read<br />your <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>syllabus</em>.
        </h1>
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          Extracts deadlines, grading policy, and exam dates from any PDF syllabus.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 2,
          padding: '80px 40px',
          background: 'var(--surface)',
        }}
      >
        <div className="mb-5" style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Upload size={18} style={{ color: 'var(--text-faint)' }} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, marginBottom: 8 }}>
          Drop your syllabus here
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 24 }}>PDF, up to 20 MB</p>
        <button
          style={{
            background: 'var(--text)',
            color: 'var(--background)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            padding: '10px 20px',
            borderRadius: 2,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Choose file
        </button>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint2)', marginTop: 20, letterSpacing: '0.06em' }}>
          Syllabus parser coming soon
        </p>
      </div>

      {/* Footer */}
      <div className="mt-14 pt-5 flex justify-between" style={{ borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        <span>Powered by Gemini</span>
        <span>PDF only</span>
      </div>
    </div>
  );
}
