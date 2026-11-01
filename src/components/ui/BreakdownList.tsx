import './BreakdownList.css';

export interface BreakdownRow {
  key: string;
  label: string;
  /** Angka utama di kanan, sudah diformat (Rp 1.580.000 / 12 malam) */
  value: string;
  /** 0..1, lebar batang porsi */
  ratio: number;
  /** Penjelasan kecil di bawah label, mis. tipe kamar atau jumlah transaksi */
  hint?: string;
  color?: string;
}

export interface BreakdownListProps {
  rows: BreakdownRow[];
  emptyMessage?: string;
}

/**
 * Daftar peringkat horizontal: nama + batang porsi + angka.
 * Dipakai untuk rincian yang terlalu panjang untuk grafik donut
 * (per kamar, per petugas, per sumber).
 */
export function BreakdownList({ rows, emptyMessage = 'Belum ada data pada periode ini.' }: BreakdownListProps) {
  if (rows.length === 0) {
    return <p className="breakdown-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="breakdown">
      {rows.map((row) => (
        <li key={row.key} className="breakdown-row">
          <div className="breakdown-main">
            <span className="breakdown-label">{row.label}</span>
            {row.value && <span className="breakdown-value">{row.value}</span>}
          </div>

          {row.hint && <span className="breakdown-hint">{row.hint}</span>}

          <span className="breakdown-track">
            <span
              className="breakdown-fill"
              style={{
                width: `${Math.min(100, Math.max(row.ratio * 100, row.ratio > 0 ? 2 : 0))}%`,
                backgroundColor: row.color ?? 'var(--primary-600)',
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
