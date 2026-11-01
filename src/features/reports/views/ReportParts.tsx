import type { ReactNode } from 'react';
import { periodLabel, periodLength } from '../reportMeta';

/** Label bagian dalam kartu laporan: micro label + garis rambut (patterns.css). */
export function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-section">
      <div className="section-label">
        <span className="text-mikro">{title}</span>
      </div>
      {children}
    </section>
  );
}

/** "1 Okt – 31 Okt 2026 · 31 hari" — periode yang sedang dibaca. */
export function PeriodNote({ from, to }: { from: string; to: string }) {
  return (
    <p className="report-period-note">
      {periodLabel(from, to)} · {periodLength(from, to)} hari
    </p>
  );
}

/** Baris pembanding periode sebelumnya; angka tidak dibuat-buat saat pembanding kosong. */
export function ComparisonLine({ text }: { text: string }) {
  return <p className="report-comparison">{text}</p>;
}
