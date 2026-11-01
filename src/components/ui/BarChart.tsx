import './BarChart.css';

export interface BarPoint {
  key: string;
  /** Label pendek di sumbu X, mis. "20 Okt" */
  label: string;
  value: number;
  /** Isi tooltip; default "label — nilai" */
  title?: string;
}

export interface BarChartProps {
  points: BarPoint[];
  formatValue: (value: number) => string;
  emptyMessage?: string;
}

/**
 * Bar tren (pendapatan harian, malam terisi) tanpa pustaka grafik:
 * grid rambut, satu warna primer, tooltip saat hover/fokus, dan tabel sebagai
 * pembanding di bawah grafik (DESIGN.md 5.13).
 */
export function BarChart({ points, formatValue, emptyMessage = 'Belum ada angka pada periode ini.' }: BarChartProps) {
  const max = points.reduce((highest, point) => Math.max(highest, point.value), 0);

  if (max <= 0) {
    return <p className="barchart-empty">{emptyMessage}</p>;
  }

  // Pada rentang panjang, label ditandai tiap beberapa batang agar tidak bertumpuk
  const labelEvery = points.length > 14 ? Math.ceil(points.length / 10) : 1;

  return (
    <div className="barchart">
      <div className="barchart-head">
        <span className="text-mikro">Tertinggi {formatValue(max)}</span>
      </div>

      <div className="barchart-plot" role="img" aria-label="Grafik batang per hari">
        {points.map((point, index) => (
          <div
            key={point.key}
            className="barchart-col"
            tabIndex={0}
            title={point.title ?? `${point.label} — ${formatValue(point.value)}`}
          >
            <span className="barchart-tip">{formatValue(point.value)}</span>
            <span className="barchart-track">
              <span
                className={`barchart-bar${point.value > 0 ? '' : ' is-empty'}`}
                style={{ height: `${Math.max(point.value > 0 ? 2 : 0, (point.value / max) * 100)}%` }}
              />
            </span>
            <span className="barchart-x">
              {index % labelEvery === 0 ? point.label : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
