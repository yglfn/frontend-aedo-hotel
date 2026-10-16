import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { toast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { formatIDR } from '../../lib/format';
import './PaymentForm.css';

interface BookingPayment {
  amount: number;
  status: string;
  type: string;
  method: string;
}

interface BookingOption {
  id: number;
  booking_code: string;
  customer?: { name: string };
  total_price: number;
  invoice?: { total: number; status: string };
  payments?: BookingPayment[];
  // Ambang DP dari backend (settings.min_dp_percentage x tagihan) - dipakai untuk mengisi
  // nominal DP otomatis, bukan ditebak di layar ini.
  dp_min_amount?: number;
  dp_shortfall?: number;
}

import { useSearchParams } from 'react-router-dom';

export default function PaymentForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBookingId = searchParams.get('booking_id') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  
  const [bookingId, setBookingId] = useState(preselectedBookingId);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentType, setPaymentType] = useState('final');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  // Sisa tersedia = total invoice dikurangi SEMUA pembayaran yang masih aktif (verified + pending).
  // Ini mencegah cash menumpuk di atas transfer/QRIS yang belum diverifikasi.
  const getAvailableRemaining = (b: BookingOption): number => {
    const invoiceTotal = Number(b.invoice?.total ?? b.total_price) || 0;
    const committed = (b.payments || [])
      .filter(p => ['verified', 'pending'].includes(p.status) && ['dp', 'final'].includes(p.type))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return Math.max(invoiceTotal - committed, 0);
  };

  // Cek apakah sudah ada pembayaran pending untuk tipe yang sama
  const getPendingForType = (b: BookingOption, type: string): BookingPayment[] => {
    return (b.payments || []).filter(p => p.status === 'pending' && p.type === type && p.method !== 'payment_gateway');
  };

  const selectedBooking: BookingOption | undefined = bookings.find(b => String(b.id) === bookingId);
  const availableRemaining = selectedBooking ? getAvailableRemaining(selectedBooking) : null;
  const pendingForCurrentType = selectedBooking ? getPendingForType(selectedBooking, paymentType) : [];
  const hasBlockingPending = pendingForCurrentType.length > 0;

  const handleBookingChange = (id: string, list: BookingOption[]) => {
    setBookingId(id);
    const match = list.find((b: BookingOption) => String(b.id) === id);
    if (match) {
      const rem = getAvailableRemaining(match);
      setRemaining(rem);
      setAmount(String(rem > 0 ? rem : Number(match.invoice?.total ?? match.total_price) || 0));
    }
  };

  /**
   * Ganti jenis pembayaran: DP mengisi nominal sebesar kekurangan ambang minimum hotel,
   * pelunasan mengisi seluruh sisa. Kasir tetap boleh mengubah angkanya.
   */
  const handleTypeChange = (type: string) => {
    setPaymentType(type);

    if (!selectedBooking) return;

    const sisa = Math.max(availableRemaining ?? 0, 0);
    const kurang = Number(selectedBooking.dp_shortfall ?? 0);

    if (type === 'dp' && kurang > 0 && kurang < sisa) {
      setAmount(String(kurang));
    } else if (type === 'final') {
      setAmount(String(sisa));
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await api.get('/api/v1/bookings');
      const raw = res.data?.data;
      const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
      setBookings(list);
      
      const targetId = preselectedBookingId || (list.length > 0 ? String(list[0].id) : '');
      if (targetId) {
        handleBookingChange(targetId, list);
      }
    } catch (e) {
      console.error('Failed to fetch bookings', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const payload = {
        amount: Number(amount),
        method: paymentMethod,
        type: paymentType,
        notes: notes || undefined,
      };
      const res = await api.post(`/api/v1/bookings/${bookingId}/payments`, payload);
      toast.success(res.data?.message || 'Pembayaran berhasil dicatat.', { title: 'Pembayaran Tersimpan' });
      navigate('/payments');
    } catch (error: any) {
      console.error('Failed to submit payment', error);
      const data = error.response?.data;
      // Prioritas: detail error backend > pesan validasi per-field > pesan generik
      let msg = data?.error || data?.message || '';
      if (!msg && data?.errors) {
        const first = Object.values(data.errors)[0];
        msg = Array.isArray(first) ? first[0] : String(first);
      }
      setErrorMsg(msg || 'Gagal mencatat pembayaran.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="payment-form-page">
      <div className="page-header">
        <h1 className="text-h1">Catat Pembayaran Baru</h1>
        <Button variant="ghost" onClick={() => navigate('/payments')}>Batal</Button>
      </div>

      <Card title="Detail Pembayaran">
        <form onSubmit={handleSubmit} className="payment-form">
          {errorMsg && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <label className="text-label">Pilih Reservasi</label>
            {bookings.length > 0 ? (
              <select
                className="ui-select"
                value={bookingId}
                onChange={e => handleBookingChange(e.target.value, bookings)}
                required
              >
                {bookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.booking_code} - {b.customer?.name || 'Tamu'} (Total: Rp {b.total_price?.toLocaleString('id-ID')})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={bookingId}
                onChange={e => setBookingId(e.target.value)}
                placeholder="ID Reservasi (misal: 1)"
                required
              />
            )}
            {remaining === 0 && (
              <div style={{ backgroundColor: 'var(--warning-bg, #fff7e6)', color: 'var(--warning-fg, #995c00)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
                Reservasi ini sudah lunas.
              </div>
            )}
            {hasBlockingPending && (
              <div style={{ backgroundColor: 'var(--danger-bg, #fff1f0)', color: 'var(--danger-fg, #9a0b0b)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
                Ada pembayaran pending yang belum diverifikasi untuk reservasi ini.
              </div>
            )}
            {availableRemaining !== null && availableRemaining > 0 && (
              <span className="text-body-small text-ink-500">
                Sisa tagihan: {formatIDR(availableRemaining)}
              </span>
            )}
          </div>
          <div className="form-group">
            <Input
              label="Jumlah Bayar (Rp)"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Contoh: 350000"
              required
            />
          </div>
          <div className="form-group">
            <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Tipe Pembayaran</label>
            <div className="method-options">
              <label className="method-radio">
                <input 
                  type="radio" 
                  name="type" 
                  value="dp" 
                  checked={paymentType === 'dp'}
                  onChange={e => handleTypeChange(e.target.value)}
                />
                <span>Down Payment (DP)</span>
              </label>
              <label className="method-radio">
                <input 
                  type="radio" 
                  name="type" 
                  value="final" 
                  checked={paymentType === 'final'}
                  onChange={e => handleTypeChange(e.target.value)}
                />
                <span>Pelunasan (Final)</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Metode Pembayaran</label>
            <div className="method-options">
              <label className="method-radio">
                <input 
                  type="radio" 
                  name="method" 
                  value="cash" 
                  checked={paymentMethod === 'cash'}
                  onChange={e => setPaymentMethod(e.target.value)}
                />
                <span>Tunai</span>
              </label>
              <label className="method-radio">
                <input 
                  type="radio" 
                  name="method" 
                  value="transfer" 
                  checked={paymentMethod === 'transfer'}
                  onChange={e => setPaymentMethod(e.target.value)}
                />
                <span>Transfer Bank</span>
              </label>
              <label className="method-radio">
                <input 
                  type="radio" 
                  name="method" 
                  value="qris" 
                  checked={paymentMethod === 'qris'}
                  onChange={e => setPaymentMethod(e.target.value)}
                />
                <span>QRIS</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <Input
              label="Catatan"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: Dibayar tunai saat check-in"
            />
          </div>

          <div className="form-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {paymentMethod !== 'cash' && (
              <div style={{ backgroundColor: 'var(--info-bg, #e6f4ff)', color: 'var(--info-fg, #0958d9)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                Pembayaran non-tunai memerlukan verifikasi admin.
              </div>
            )}
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={hasBlockingPending || availableRemaining === 0}
            >
              Simpan Pembayaran
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
