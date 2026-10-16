import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { formatIDR, formatDateShort } from '../../lib/format';

/**
 * Halaman hasil pembayaran untuk TAMU — terbuka tanpa login, karena Midtrans
 * mengarahkan browser tamu ke sini (callbacks.finish dari backend).
 *
 * Status yang ditampilkan tidak pernah diambil dari parameter URL: halaman ini hanya
 * membaca jawaban /api/payment-result/{order_id}, dan endpoint itulah yang menverifikasi
 * ke gateway. Selama masih pending, status diulang otomatis.
 *
 * Kalau sudah berhasil, tidak ada lagi tombol cek - uang sudah masuk, tidak ada yang perlu
 * diperiksa ulang; tombolnya mengembalikan user ke halaman sistem (staf yang sudah login
 * kembali ke dashboard, tamu jatuh ke halaman masuk).
 */

interface PaymentResultData {
  found: boolean;
  booking_code?: string;
  amount?: number;
  payment_status?: string;
  booking_status?: string;
  paid_at?: string;
  provider?: string;
  environment?: string;
  message?: string;
}

type ViewState = 'loading' | 'ready' | 'notfound' | 'error';

const POLL_MS = 10000;

const panelStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  backgroundColor: 'var(--ink-100)',
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--surface)',
  padding: '28px',
  borderRadius: 'var(--radius-card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-pop)',
  width: '460px',
  maxWidth: '100%',
  textAlign: 'center',
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('order_id') || params.get('orderId') || '';

  // Seluruh parameter redirect Midtrans diteruskan apa adanya (transaction_status, status_code,
  // gross_amount, signature_key, transaction_id...). Backend yang memutuskan: tanpa tanda tangan
  // sah parameter ini tidak mengubah apa pun, hanya menjadi petunjuk id untuk ditanyakan ke gateway.
  const queryString = params.toString();

  const [view, setView] = useState<ViewState>('loading');
  const [data, setData] = useState<PaymentResultData | null>(null);
  const [notice, setNotice] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!orderId) return;

    if (!options.silent) setIsChecking(true);

    try {
      const res = await api.get(
        `/api/payment-result/${encodeURIComponent(orderId)}${queryString ? `?${queryString}` : ''}`
      );
      setData(res.data);
      setView('ready');
      setNotice('');
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setData(error.response?.data ?? null);
        setView('notfound');
      } else {
        setNotice('Gagal membaca status. Coba lagi.');
        setView((current) => (current === 'ready' ? 'ready' : 'error'));
      }
    } finally {
      if (!options.silent) setIsChecking(false);
    }
  }, [orderId, queryString]);

  useEffect(() => {
    if (!orderId) {
      setNotice('Nomor transaksi tidak ada di tautan ini.');
      setView('notfound');
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Diulang otomatis selama gateway belum mengonfirmasi (settlement bisa datang belakangan)
  useEffect(() => {
    if (data?.payment_status !== 'pending') return;

    timerRef.current = window.setTimeout(() => void load({ silent: true }), POLL_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [data, load]);

  const status = data?.payment_status;

  const tone = status === 'verified'
    ? { bg: 'var(--success-bg)', fg: 'var(--success-fg)', icon: <CheckCircle2 size={34} />, title: 'Pembayaran Berhasil' }
    : status === 'pending'
      ? { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', icon: <Clock size={34} />, title: 'Menunggu Konfirmasi' }
      : status === 'expired'
        ? { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', icon: <XCircle size={34} />, title: 'Batas Waktu Lewat' }
        : view === 'notfound'
          ? { bg: 'var(--ink-100)', fg: 'var(--ink-500)', icon: <ShieldAlert size={34} />, title: 'Transaksi Tidak Ditemukan' }
          : { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', icon: <XCircle size={34} />, title: 'Pembayaran Tidak Berhasil' };

  return (
    <div style={panelStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <span style={{ color: tone.fg, backgroundColor: tone.bg, borderRadius: '50%', padding: '12px', display: 'inline-flex' }}>
            {tone.icon}
          </span>
        </div>

        <h1 className="text-h2" style={{ color: tone.fg, marginBottom: '8px' }}>
          {view === 'loading' ? 'Memeriksa pembayaran…' : tone.title}
        </h1>

        {view === 'loading' && (
          <p className="text-body-small text-ink-500">Menanyakan status ke gateway...</p>
        )}

        {view !== 'loading' && (
          <>
            <p className="text-body-strong" style={{ marginBottom: '14px' }}>
              {data?.message || notice || '—'}
            </p>

            {data?.booking_code && (
              <div style={{ backgroundColor: 'var(--primary-50)', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
                <p className="text-caption">Nomor Reservasi</p>
                <p className="text-h3 text-primary-600">{data.booking_code}</p>
                {typeof data.amount === 'number' && (
                  <p className="text-body-strong" style={{ marginTop: '6px' }}>{formatIDR(data.amount)}</p>
                )}
                {data.paid_at && (
                  <p className="text-body-small text-ink-500" style={{ marginTop: '4px' }}>
                    Dibayar {formatDateShort(data.paid_at)}
                  </p>
                )}
                {data.environment && (
                  <p className="text-caption text-ink-500" style={{ marginTop: '4px' }}>
                    {data.environment}
                  </p>
                )}
              </div>
            )}

            {status === 'pending' && (
              <p className="text-body-small text-ink-500" style={{ marginBottom: '14px' }}>
                Cek ulang otomatis tiap {POLL_MS / 1000} detik.
              </p>
            )}

            {(status === 'expired' || status === 'failed' || view === 'error' || view === 'notfound') && (
              <p className="text-body-small text-ink-500" style={{ marginBottom: '14px' }}>
                Sudah bayar tapi belum berubah? Hubungi meja depan.
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {status === 'verified' ? (
                <Button variant="primary" onClick={() => navigate('/', { replace: true })}>
                  Kembali ke Sistem
                </Button>
              ) : (
                <Button variant="secondary" isLoading={isChecking} onClick={() => void load()}>
                  Cek Sekarang
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
