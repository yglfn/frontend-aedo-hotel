import './Donut.css';

export interface DonutSegment {
  key: string;
  label: string;
  /** Nilai angka; segmen 0 tidak digambar */
  value: number;
  /** Warna cincin, selalu lewat token, mis. 'var(--primary-600)' */
  color: string;
  /** Teks legenda; default pakai nilai mentah bila tidak diisi */
  caption?: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  emptyMessage?: string;
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Donut komposisi (metode bayar, sumber reservasi, status kamar) sesuai DESIGN.md 5.13:
 * angka di tengah, legenda dengan titik warna + nama + nilai.
 */
export function Donut({ segments, centerValue, centerLabel, emptyMessage = 'Belum ada data pada periode ini.' }: DonutProps) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);

  let cursor = 0;

  return (
    <div className="donut">
      <div className="donut-chart">
        <svg
          viewBox="0 0 120 120"
          role="img"
          aria-label={`${centerLabel}: ${centerValue}`}
        >
          <circle className="donut-track" cx="60" cy="60" r={RADIUS} />
          {total > 0 &&
            visible.map((segment) => {
              const length = (segment.value / total) * CIRCUMFERENCE;
              const dashoffset = -cursor;
              cursor += length;

              return (
                <circle
                  key={segment.key}
                  className="donut-segment"
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  stroke={segment.color}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={dashoffset}
                />
              );
            })}
        </svg>

        <div className="donut-center">
          <span className="donut-value">{centerValue}</span>
          <span className="donut-label">{centerLabel}</span>
        </div>
      </div>

      {total === 0 ? (
        <p className="donut-empty">{emptyMessage}</p>
      ) : (
        <ul className="donut-legend">
          {visible.map((segment) => (
            <li key={segment.key} className="donut-legend-row">
              <span className="donut-dot" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <span className="donut-legend-label">{segment.label}</span>
              <span className="donut-legend-value">{segment.caption ?? segment.value}</span>
              <span className="donut-legend-percent">
                {Math.round((segment.value / total) * 1000) / 10}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
