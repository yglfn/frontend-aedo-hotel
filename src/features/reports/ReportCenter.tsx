import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { PERIOD_PRESETS, matchPreset, periodLabel, toDateInput } from './reportMeta';
import type { SummaryReport } from './types';
import { ReportOverview } from './views/ReportOverview';
import './Reports.css';

/**
 * Layar Pusat Laporan hanya menampilkan satu laporan: Ringkasan. PDF/Excel dibuat dari
 * payload yang sama (GET /api/v1/reports/summary?format=pdf|xlsx).
 */
const REPORT_PATH = '/api/v1/reports/summary';

/** Blok yang harus ada sebelum Ringkasan boleh dirender. */
const REQUIRED_BLOCKS = ['revenue', 'occupancy', 'reservations', 'housekeeping', 'shifts', 'rooms', 'highlights'];

interface ReportLoadResult {
  key: string;
  data: SummaryReport | null;
  error: string | null;
}

/** Response blob (PDF/Excel) bisa berisi JSON error, jadi isinya dibaca dulu. */
async function blobErrorMessage(error: unknown, fallback: string): Promise<string> {
  const data = (error as { response?: { data?: unknown } })?.response?.data;

  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());

      return String(parsed?.message || fallback);
    } catch {
      return fallback;
    }
  }

  return apiErrorMessage(error, fallback);
}

function payloadIsComplete(payload: unknown): payload is SummaryReport {
  if (typeof payload !== 'object' || payload === null) return false;

  const record = payload as Record<string, unknown>;

  return REQUIRED_BLOCKS.every((block) => record[block] !== undefined && record[block] !== null);
}

function ReportSkeleton() {
  return (
    <div className="report-skeleton" aria-busy="true">
      <div className="report-skeleton-block" />
      <div className="report-skeleton-row">
        <div className="report-skeleton-block" />
        <div className="report-skeleton-block" />
        <div className="report-skeleton-block" />
        <div className="report-skeleton-block" />
      </div>
      <div className="report-skeleton-block is-tall" />
    </div>
  );
}

export default function ReportCenter() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Satu titik waktu untuk seluruh halaman; preset & penanda "kustom" harus pakai hari yang sama
  const [today] = useState(() => new Date());

  const fallbackRange = PERIOD_PRESETS.find((preset) => preset.id === 'thisMonth')?.range(today) ?? {
    from: toDateInput(today),
    to: toDateInput(today),
  };

  const from = searchParams.get('from') ?? fallbackRange.from;
  const to = searchParams.get('to') ?? fallbackRange.to;

  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ReportLoadResult | null>(null);
  const requestSeq = useRef(0);

  // View hanya membaca hasil yang kuncinya sama dengan periode yang dipilih, supaya
  // perpindahan periode tidak merender ringkasan dengan payload periode sebelumnya.
  const requestKey = `${from}|${to}|${attempt}`;
  const loaded = result && result.key === requestKey ? result : null;

  useEffect(() => {
    const requestId = ++requestSeq.current;

    const load = async () => {
      try {
        const response = await api.get(REPORT_PATH, { params: { from, to } });

        if (requestId !== requestSeq.current) return;

        setResult({ key: requestKey, data: response.data?.data ?? null, error: null });
      } catch (err) {
        if (requestId !== requestSeq.current) return;

        console.error('Gagal memuat ringkasan laporan', err);
        setResult({ key: requestKey, data: null, error: apiErrorMessage(err, 'Ringkasan laporan gagal dimuat dari server.') });
      }
    };

    load();
  }, [from, to, requestKey]);

  const applyRange = (next: { from: string; to: string }) => {
    // Periode disimpan di URL agar laporan bisa ditandai dan tetap sama setelah refresh
    const params = new URLSearchParams();

    params.set('from', next.from);
    params.set('to', next.to);

    setSearchParams(params, { replace: true });
  };

  const handleDownload = async (format: 'pdf' | 'xlsx') => {
    setDownloading(format);

    try {
      const res = await api.get(REPORT_PATH, {
        params: { from, to, format },
        responseType: 'blob',
      });

      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ringkasan-laporan-${from}_sampai_${to}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Ringkasan laporan diunduh sebagai ${format.toUpperCase()}.`);
    } catch (err) {
      console.error('Gagal mengunduh ringkasan laporan', err);
      toast.error(await blobErrorMessage(err, 'Gagal mengunduh laporan dari server.'), {
        title: 'Unduhan gagal',
      });
    } finally {
      setDownloading(null);
    }
  };

  const activePreset = matchPreset(from, to, today);

  return (
    <div className="report-body">
      <div className="report-header">
        <div>
          <h1 className="text-h1">Ringkasan Laporan</h1>
          <p className="report-subtitle">
            Semua angka penting hotel dalam satu halaman, dengan pembanding periode sebelumnya.
          </p>
        </div>

        <div className="report-actions">
          <Button variant="secondary" size="sm" onClick={() => handleDownload('pdf')} isLoading={downloading === 'pdf'}>
            <FileDown size={14} aria-hidden="true" />
            Unduh PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleDownload('xlsx')} isLoading={downloading === 'xlsx'}>
            <FileSpreadsheet size={14} aria-hidden="true" />
            Unduh Excel
          </Button>
        </div>
      </div>

      <Card title="Periode laporan">
        <div className="report-period">
          <div className="report-preset-group" role="group" aria-label="Pilih cepat periode">
            {PERIOD_PRESETS.map((preset) => {
              const range = preset.range(today);

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`report-preset${activePreset === preset.id ? ' active' : ''}`}
                  onClick={() => applyRange(range)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="report-date-field">
            <Input
              label="Dari tanggal"
              type="date"
              value={from}
              max={to}
              onChange={(event) => applyRange({ from: event.target.value, to })}
            />
          </div>

          <div className="report-date-field">
            <Input
              label="Sampai tanggal"
              type="date"
              value={to}
              min={from}
              onChange={(event) => applyRange({ from, to: event.target.value })}
            />
          </div>
        </div>

        <p className="report-period-summary">
          <strong>{periodLabel(from, to)}</strong>
          {' · '}
          {PERIOD_PRESETS.find((preset) => preset.id === activePreset)?.label ?? 'Periode kustom'}
          {' · berlaku untuk tampilan dan hasil unduhan.'}
        </p>
      </Card>

      {!loaded ? (
        <ReportSkeleton />
      ) : loaded.error ? (
        <div className="report-error">
          <p className="callout callout-danger">
            <span>
              <span className="callout-judul">Ringkasan laporan tidak bisa dimuat</span>
              <span className="callout-meta">{loaded.error}</span>
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : !payloadIsComplete(loaded.data) ? (
        <div className="report-error">
          <p className="callout callout-info">
            <span>
              <span className="callout-judul">Data ringkasan tidak lengkap</span>
              <span className="callout-meta">Bentuk respons tidak sesuai. Muat ulang untuk mengambil data terbaru.</span>
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((value) => value + 1)}>
            Muat ulang
          </Button>
        </div>
      ) : (
        <ErrorBoundary subject="Ringkasan laporan" onReset={() => setAttempt((value) => value + 1)}>
          <ReportOverview data={loaded.data} />
        </ErrorBoundary>
      )}
    </div>
  );
}
