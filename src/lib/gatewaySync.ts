import { api } from './api';

let lastRunAt = 0;
let inFlight: Promise<boolean> | null = null;

/**
 * Tarik status sebenarnya dari gateway untuk semua pembayaran gateway yang masih pending.
 *
 * Kenapa perlu: di lingkungan dev/self-host (Laragon, tanpa cron dan tanpa HTTPS tunnel)
 * webhook Midtrans tidak bisa masuk dan scheduler tidak berjalan, jadi tanpa panggilan ini
 * status baru berubah kalau ada orang menekan "Cek Status". Halaman Daftar Pembayaran &
 * Reservasi memanggilnya saat memuat data.
 *
 * Keputusan tetap diambil backend dari jawaban provider — fungsi ini hanya menyuruh backend
 * bertanya. Jeda antar-run dibatasi agar tidak membanjiri Midtrans (endpoint-nya juga
 * di-throttle).
 */
export async function syncPendingGatewayPayments(minIntervalMs = 30000): Promise<boolean> {
  if (inFlight) return inFlight;

  const now = Date.now();
  if (now - lastRunAt < minIntervalMs) return false;

  lastRunAt = now;

  inFlight = (async () => {
    try {
      const res = await api.post('/api/v1/payments/sync-pending');
      return Number(res.data?.changed ?? 0) > 0;
    } catch (error) {
      // Senyap: ini jalur pemulihan, kegagalan tidak boleh mengganggu tampilan daftar
      console.error('Bulk gateway sync gagal', error);
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
