import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { toast } from '../../components/ui/Toast';
import { formatIDR } from '../../lib/format';
import { api } from '../../lib/api';
import { openMidtransPayment, hideMidtransOverlay, snapResultTransactionId, type SnapHandlers, type SnapOpenResult } from '../../lib/midtransSnap';
import './NewBooking.css';

interface AvailableRoom {
  id: number;
  room_number: string;
  floor: number;
  room_type: { id: number; name: string; price: number };
}

interface GuestInput {
  name: string;
  ktp: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

interface CustomerOption {
  id: number;
  name: string;
  ktp?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export default function NewBooking() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // --- Step 1: Pencarian Ketersediaan ---
  const [source, setSource] = useState('walk_in');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState('1');

  // --- Step 2: Pilih Kamar ---
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<AvailableRoom[]>([]);
  const [isSearchingRooms, setIsSearchingRooms] = useState(false);
  const [searchError, setSearchError] = useState('');

  // --- Step 3: Data Tamu & Ringkasan ---
  const [primaryGuest, setPrimaryGuest] = useState<GuestInput>({
    name: '', ktp: '', phone: '', email: '', is_primary: true
  });

  // Pencarian pelanggan terdaftar
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pay_later');
  // 'full' = tagih seluruh sisa, 'dp' = tagih uang muka sebesar ambang minimum hotel.
  const [collectionMode, setCollectionMode] = useState<'full' | 'dp'>('full');
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [minDpPercentage, setMinDpPercentage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<{
    channel: string;
    qr_string?: string;
    amount?: number;
    redirect_url?: string;
    environment?: string;
    token?: string;
    clientKey?: string;
    snapJsUrl?: string;
    paymentId?: number;
  } | null>(null);

  // Jalur yang berhasil dipakai membuka pembayaran + status terbaru dari gateway,
  // supaya modal menampilkan keadaan sebenarnya, bukan sekadar "silakan scan".
  const [autoOpen, setAutoOpen] = useState<SnapOpenResult | null>(null);
  const [openError, setOpenError] = useState('');
  const [gatewayState, setGatewayState] = useState<'pending' | 'verified' | 'expired'>('pending');
  const pollRef = useRef<number | null>(null);
  // Midtrans kadang mencatat settlement beberapa detik setelah tamu selesai, dan callback
  // Snap JS bisa tidak datang (iframe-nya pindah ke domain bank simulator). Karena itu
  // status ditanya ulang beberapa kali, bukan sekali saja.
  const retryRef = useRef<number[]>([]);
  const resolvedRef = useRef(false);
  // transaction_id Midtrans yang sudah pernah diberitahukan (dipakai ulang oleh retry/poll)
  const providerRefRef = useRef<string | null>(null);

  // Ambil pengaturan pajak & ambang DP hotel dari backend
  useEffect(() => {
    const fetchHotelSettings = async () => {
      try {
        const res = await api.get('/api/v1/settings');
        const data = res.data?.data;
        if (data?.tax_percentage !== undefined) {
          setTaxPercentage(Number(data.tax_percentage));
        }
        if (data?.min_dp_percentage !== undefined) {
          setMinDpPercentage(Number(data.min_dp_percentage));
        }
      } catch (err) {
        console.error('Failed to load hotel settings', err);
      }
    };
    fetchHotelSettings();
  }, []);

  // Debounce pencarian pelanggan saat kata kunci berubah
  useEffect(() => {
    if (selectedCustomerId || !customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const res = await api.get(`/api/v1/customers?search=${encodeURIComponent(customerSearch.trim())}`);
        const raw = res.data?.data;
        const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
        setCustomerResults(list);
        setShowCustomerDropdown(true);
      } catch (err) {
        console.error('Failed to search customers', err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [customerSearch, selectedCustomerId]);

  const handleSelectCustomer = (cust: CustomerOption) => {
    setSelectedCustomerId(cust.id);
    setPrimaryGuest({
      name: cust.name,
      ktp: cust.ktp || '',
      phone: cust.phone || '',
      email: cust.email || '',
      is_primary: true,
    });
    setCustomerSearch(cust.name);
    setShowCustomerDropdown(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setPrimaryGuest({ name: '', ktp: '', phone: '', email: '', is_primary: true });
  };

  const handleSearchRooms = async () => {
    setIsSearchingRooms(true);
    setSearchError('');
    try {
      const res = await api.get(`/api/v1/rooms/availability?check_in=${checkIn}&check_out=${checkOut}`);
      const list = res.data.data || [];
      setAvailableRooms(list);
      setStep(2);
    } catch (error: any) {
      console.error('Failed to search rooms', error);
      setSearchError(error.response?.data?.message || 'Gagal mencari kamar. Periksa tanggalnya.');
    } finally {
      setIsSearchingRooms(false);
    }
  };

  const toggleRoom = (room: AvailableRoom) => {
    if (selectedRooms.find(r => r.id === room.id)) {
      setSelectedRooms(selectedRooms.filter(r => r.id !== room.id));
    } else {
      setSelectedRooms([...selectedRooms, room]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      // 1. Pakai pelanggan terdaftar yang dipilih, atau buat baru bila belum ada
      let customerId = selectedCustomerId;
      if (!customerId) {
        const custRes = await api.post('/api/v1/customers', {
          name: primaryGuest.name,
          phone: primaryGuest.phone,
          email: primaryGuest.email || undefined,
          ktp: primaryGuest.ktp,
        });
        customerId = custRes.data.data.id;
      } else if (primaryGuest.email) {
        // Lengkapi email pelanggan lama bila belum ada / berubah
        await api.put(`/api/v1/customers/${customerId}`, {
          name: primaryGuest.name,
          phone: primaryGuest.phone,
          email: primaryGuest.email,
          ktp: primaryGuest.ktp,
        }).catch(() => {});
      }

      // 2. Create Booking
      const payload = {
        customer_id: customerId,
        source,
        check_in: checkIn,
        check_out: checkOut,
        guest_count: Number(guestCount),
        rooms: selectedRooms.map(r => r.id),
        guests: [{
          name: primaryGuest.name,
          ktp: primaryGuest.ktp,
          is_primary: true,
        }],
        notes: notes || undefined,
      };

      const bookingRes = await api.post('/api/v1/bookings', payload);
      const createdBooking = bookingRes.data.data;

      toast.success(
        `Reservasi ${createdBooking?.booking_code || ''} berhasil dibuat.`,
        { title: 'Reservasi Tersimpan' }
      );

      if (paymentMethod !== 'pay_later' && createdBooking?.id) {
        try {
          const payRes = await api.post(`/api/v1/bookings/${createdBooking.id}/payments/gateway`, {
            channel: paymentMethod,
            // Nominal dihitung backend dari tagihan yang sebenarnya (sisa atau ambang DP),
            // bukan dari estimasi di layar ini.
            ...(collectionMode === 'dp' ? { type: 'dp' } : {}),
          });
          const info = payRes.data?.payment_info;
          setGatewayState('pending');
          setAutoOpen(null);
          setOpenError('');
          resolvedRef.current = false;
          providerRefRef.current = null;
          setPaymentInfo({
            channel: paymentMethod,
            qr_string: info?.qr_string || info?.transaction_id,
            redirect_url: info?.redirect_url || undefined,
            environment: info?.environment || undefined,
            amount: info?.amount || estTotal,
            token: info?.token || undefined,
            clientKey: info?.client_key || undefined,
            snapJsUrl: info?.snap_js_url || undefined,
            paymentId: payRes.data?.data?.id || undefined,
          });
        } catch (payErr) {
          console.error('Payment gateway error, booking was still created', payErr);
          toast.warning(
            'Reservasi tersimpan, gateway gagal. Catat pembayaran di daftar reservasi.',
            { title: 'Gateway Gagal' }
          );
          navigate('/reservations');
        }
      } else {
        navigate('/reservations');
      }
    } catch (error: any) {
      console.error('Failed to submit booking', error);
      const detail = error.response?.data?.error || error.response?.data?.message;
      setSubmitError(detail || 'Gagal membuat reservasi.');

      if (error.response?.status === 409) {
        setStep(2);
        toast.error(String(detail), { title: 'Kamar Tidak Tersedia' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Tanya status terbaru ke gateway.
   */
  const clearStatusRetries = useCallback(() => {
    retryRef.current.forEach((id) => window.clearTimeout(id));
    retryRef.current = [];
  }, []);

  const syncGatewayStatus = useCallback(async (providerRef?: string | null) => {
    if (!paymentInfo?.paymentId || resolvedRef.current) return;

    // transaction_id Midtrans yang baru saja diberitahukan Snap dipakai lagi oleh retry/poll
    // berikutnya: untuk e-wallet hasil Snap, hanya id itulah yang dikenali API status mereka.
    if (providerRef) providerRefRef.current = providerRef;
    const reference = providerRef || providerRefRef.current;

    try {
      const res = await api.post(
        `/api/v1/payments/${paymentInfo.paymentId}/sync`,
        reference ? { transaction_id: reference } : {}
      );

      if (res.data?.payment_status === 'verified') {
        resolvedRef.current = true;
        setGatewayState('verified');

        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        clearStatusRetries();

        toast.success('Pembayaran lunas dan reservasi terkonfirmasi.', { title: 'Pembayaran Berhasil' });
      } else if (res.data?.gateway_status === 'expired') {
        resolvedRef.current = true;
        setGatewayState('expired');
        clearStatusRetries();
        toast.warning('Batas waktu pembayaran gateway kedaluwarsa.');
      }
    } catch (error) {
      // Gagal sinkron (network dsb.) biarkan poller/retry mencoba lagi
      console.error('Gateway status sync failed', error);
    }
  }, [paymentInfo?.paymentId, clearStatusRetries]);

  /** Tanya status berkali-kali sebentar: settlement bisa tercatat setelah callback Snap */
  const scheduleStatusRetries = useCallback(() => {
    clearStatusRetries();

    retryRef.current = [3000, 8000, 15000, 25000].map((delay) =>
      window.setTimeout(() => void syncGatewayStatus(), delay)
    );
  }, [clearStatusRetries, syncGatewayStatus]);

  const snapHandlers = useCallback((): SnapHandlers => ({
    // Hasil Snap JS membawa transaction_id Midtrans -> langsung sinkron otomatis
    onSuccess: (result) => { void syncGatewayStatus(snapResultTransactionId(result)); scheduleStatusRetries(); },
    onPending: (result) => { void syncGatewayStatus(snapResultTransactionId(result)); scheduleStatusRetries(); },
    onError: () => { void syncGatewayStatus(); scheduleStatusRetries(); },
    onClose: () => { void syncGatewayStatus(); scheduleStatusRetries(); },
  }), [syncGatewayStatus, scheduleStatusRetries]);

  /** Buka (ulang) halaman pembayaran Midtrans; mengembalikan jalur yang berhasil dipakai */
  const openPayment = useCallback(async (): Promise<SnapOpenResult | undefined> => {
    if (!paymentInfo) return undefined;

    setOpenError('');

    let outcome;
    try {
      outcome = await openMidtransPayment(
        {
          token: paymentInfo.token,
          client_key: paymentInfo.clientKey,
          snap_js_url: paymentInfo.snapJsUrl,
          redirect_url: paymentInfo.redirect_url,
        },
        snapHandlers()
      );
    } catch (error) {
      // Jangan pernah kembali ke status "menyiapkan..." yang menggantung: tunjukkan alasannya
      console.error('Unexpected failure while opening Midtrans payment', error);
      setAutoOpen('nothing');
      setOpenError('Gagal membuka pembayaran - tekan Bayar.');

      return 'nothing';
    }

    setAutoOpen(outcome.result);
    if (outcome.error) setOpenError(outcome.error);

    if (outcome.result === 'blocked') {
      toast.warning('Popup diblokir browser - tekan Bayar.', {
        title: 'Popup Diblokir',
      });
    }

    return outcome.result;
  }, [paymentInfo, snapHandlers]);

  useEffect(() => {
    if (!paymentInfo) return;

    // Muncul otomatis begitu kode bayar diterima — staf tidak perlu menekan link dulu
    void openPayment();

    // Jaring pengaman: cek berkala selama modal terbuka (notifikasi gateway belum tentu
    // bisa masuk, misalnya aplikasi lokal tanpa HTTPS publik)
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => void syncGatewayStatus(), 20000);

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      clearStatusRetries();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentInfo]);

  const handleClosePaymentModal = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // Overlay Snap milik Midtrans menempel di document; jangan ditinggal saat pindah halaman
    hideMidtransOverlay();
    setPaymentInfo(null);
    navigate('/reservations');
  };

  const totalRoomRatePerNight = selectedRooms.reduce((sum, r) => sum + r.room_type.price, 0);
  const calculateNights = () => {
    if (!checkIn || !checkOut) return 1;
    const diffTime = Math.abs(new Date(checkOut).getTime() - new Date(checkIn).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays || 1;
  };
  const estSubtotal = totalRoomRatePerNight * calculateNights();
  const estDiscount = Number(discountAmount) || 0;
  const taxableAmount = Math.max(0, estSubtotal - estDiscount);
  const estTax = (taxableAmount * taxPercentage) / 100;
  const estTotal = taxableAmount + estTax;

  return (
    <div className="new-booking-page">
      <div className="page-header">
        <h1 className="text-h1">Reservasi Baru</h1>
        <Button variant="ghost" onClick={() => navigate('/reservations')}>Batal</Button>
      </div>

      <div className="stepper-indicator">
        {[1, 2, 3].map(num => (
          <div key={num} className={`stepper-step ${step >= num ? 'active' : ''}`}>
            <div className="stepper-circle">{num}</div>
            <span className="stepper-label">
              {num === 1 ? 'Pencarian' : num === 2 ? 'Kamar' : 'Tamu & Ringkasan'}
            </span>
          </div>
        ))}
      </div>

      <div className="stepper-content">
        {step === 1 && (
          <Card title="Pencarian Ketersediaan">
            <div className="form-grid">
              <div className="form-group">
                <label className="text-label">Source</label>
                <select className="ui-select" value={source} onChange={e => setSource(e.target.value)}>
                  <option value="walk_in">Walk-in</option>
                  <option value="phone">Phone</option>
                  <option value="traveloka">Traveloka</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
              <Input
                label="Jumlah Tamu (Guest Count)"
                type="number"
                value={guestCount}
                onChange={e => setGuestCount(e.target.value)}
                min="1"
              />
              <Input
                label="Tanggal Check in"
                type="date"
                value={checkIn}
                onChange={e => setCheckIn(e.target.value)}
              />
              <Input
                label="Tanggal Check out"
                type="date"
                value={checkOut}
                onChange={e => setCheckOut(e.target.value)}
              />
            </div>
            {searchError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginTop: '14px' }}>
                {searchError}
              </div>
            )}
            <div className="step-actions mt-4 border-top pt-4">
              <Button 
                onClick={handleSearchRooms} 
                isLoading={isSearchingRooms}
                disabled={!checkIn || !checkOut}
              >
                Cek Ketersediaan Kamar
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card title={`Pilih Kamar (${checkIn} s/d ${checkOut})`}>
            <p className="text-body-small mb-4 text-ink-500">
              Menampilkan kamar yang tersedia secara fisik pada tanggal tersebut.
            </p>
            {availableRooms.length === 0 ? (
              <div className="p-8 text-center text-ink-500 border border-dashed rounded-lg">
                <p className="text-body-strong mb-1">Tidak ada kamar yang tersedia</p>
                <p className="text-body-small">Semua kamar pada rentang tanggal tersebut sedang terisi atau dalam perbaikan.</p>
              </div>
            ) : (
              <div className="room-selection-grid">
                {availableRooms.map(room => {
                  const isSelected = selectedRooms.some(r => r.id === room.id);
                  return (
                    <div key={room.id} className={`room-physical-card ${isSelected ? 'selected' : ''}`}>
                      <div className="rpc-header">
                        <span className="text-h3">{room.room_number}</span>
                        <span className="text-body-small">Lantai {room.floor}</span>
                      </div>
                      <div className="rpc-body">
                        <span className="text-body-strong">{room.room_type.name}</span>
                        <span className="text-primary-600">{formatIDR(room.room_type.price)}/mlm</span>
                      </div>
                      <Button 
                        variant={isSelected ? 'secondary' : 'primary'} 
                        size="sm" 
                        onClick={() => toggleRoom(room)}
                        className="mt-2 w-full"
                      >
                        {isSelected ? 'Batal Pilih' : 'Pilih Kamar'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="step-actions mt-4 border-top pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>Kembali</Button>
              <Button onClick={() => setStep(3)} disabled={selectedRooms.length === 0}>Lanjutkan</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card title="Data Tamu & Ringkasan">
            <h3 className="text-h4 mb-2">Informasi Tamu Utama</h3>

            <div className="customer-search-box" style={{ position: 'relative', marginBottom: '16px' }}>
              <label className="text-label">Ambil dari Pelanggan Terdaftar (Opsional)</label>
              {selectedCustomerId ? (
                <div className="selected-customer-chip">
                  <span>
                    Memakai data pelanggan: <strong>{primaryGuest.name}</strong>
                  </span>
                  <Button size="sm" variant="ghost" onClick={handleClearCustomer}>Ganti</Button>
                </div>
              ) : (
                <>
                  <Input
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                    placeholder="Ketik nama / telepon / email pelanggan..."
                  />
                  {isSearchingCustomer && (
                    <span className="text-body-small text-ink-500" style={{ display: 'block', marginTop: '4px' }}>Mencari pelanggan...</span>
                  )}
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="customer-dropdown">
                      {customerResults.map(c => (
                        <div key={c.id} className="customer-option" onMouseDown={() => handleSelectCustomer(c)}>
                          <div className="text-body-strong">{c.name}</div>
                          <div className="text-body-small text-ink-500">
                            {c.phone || 'Tanpa telepon'}{c.email ? ` · ${c.email}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showCustomerDropdown && !isSearchingCustomer && customerSearch.trim() && customerResults.length === 0 && (
                    <div className="customer-dropdown">
                      <div className="customer-option customer-option-empty">
                        Tidak ada pelanggan cocok. Data tamu akan disimpan sebagai pelanggan baru.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="form-grid mb-4">
              <Input
                label="Nama Lengkap"
                value={primaryGuest.name}
                onChange={e => setPrimaryGuest({ ...primaryGuest, name: e.target.value })}
                required
              />
              <Input
                label="No. Telepon / WhatsApp"
                value={primaryGuest.phone}
                onChange={e => setPrimaryGuest({ ...primaryGuest, phone: e.target.value })}
                required
              />
              <Input
                label="Nomor KTP"
                value={primaryGuest.ktp}
                onChange={e => setPrimaryGuest({ ...primaryGuest, ktp: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={primaryGuest.email}
                onChange={e => setPrimaryGuest({ ...primaryGuest, email: e.target.value })}
                placeholder="Contoh: tamu@email.com"
              />
            </div>
            
            <h3 className="text-h4 mb-2 border-top pt-4">Catatan & Pembayaran</h3>
            <div className="form-grid mb-4">
              <Input
                label="Catatan (Opsional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Misal: Minta kamar bebas asap rokok"
              />
              <Input
                label="Nominal Diskon (Rp)"
                type="number"
                value={discountAmount}
                onChange={e => setDiscountAmount(e.target.value)}
              />
              <div className="form-group full-width">
                <label className="text-label">Metode Pembayaran</label>
                <select className="ui-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="pay_later">Bayar Nanti (Pay at Hotel / Transfer Manual)</option>
                  <option value="auto">Payment Gateway Midtrans (tamu pilih metodenya sendiri)</option>
                </select>

                {paymentMethod !== 'pay_later' && minDpPercentage > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <Button
                      size="sm"
                      variant={collectionMode === 'full' ? 'primary' : 'secondary'}
                      onClick={() => setCollectionMode('full')}
                    >
                      Bayar Lunas
                    </Button>
                    <Button
                      size="sm"
                      variant={collectionMode === 'dp' ? 'primary' : 'secondary'}
                      onClick={() => setCollectionMode('dp')}
                    >
                      DP {minDpPercentage}%
                    </Button>
                  </div>
                )}

                <p className="text-body-small text-ink-500 mt-1">
                  {paymentMethod === 'pay_later'
                    ? 'Tamu bayar di meja atau transfer; status mengikuti verifikasi.'
                    : paymentMethod !== 'pay_later' && minDpPercentage > 0 && collectionMode === 'dp'
                      ? `Uang muka ${minDpPercentage}% ditagih sekarang, sisanya saat check-out.`
                      : 'Popup Midtrans terbuka otomatis; tamu memilih metode bayar di sana.'}
                </p>

                {paymentMethod !== 'pay_later' && minDpPercentage <= 0 && collectionMode === 'full' && (
                  <p className="text-caption text-ink-500 mt-1">
                    Ingin menagih uang muka? Isi "Minimal DP (%)" di Pengaturan.
                  </p>
                )}
              </div>
            </div>

            <div className="summary-section border-top pt-4">
              <h3 className="text-h4 mb-2">Ringkasan Estimasi Tagihan</h3>
              <div className="summary-row">
                <span>Kamar Terpilih</span>
                <strong>{selectedRooms.map(r => r.room_number).join(', ')}</strong>
              </div>
              <div className="summary-row">
                <span>Durasi Menginap</span>
                <strong>{calculateNights()} malam</strong>
              </div>
              <div className="summary-row">
                <span>Subtotal Kamar</span>
                <span>{formatIDR(estSubtotal)}</span>
              </div>
              {estDiscount > 0 && (
                <div className="summary-row" style={{ color: '#15803d' }}>
                  <span>Diskon</span>
                  <span>- {formatIDR(estDiscount)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Pajak Hotel ({taxPercentage}%)</span>
                <span>{formatIDR(estTax)}</span>
              </div>
              <div className="summary-row total-row">
                <span>Estimasi Total</span>
                <span className="text-h3 text-primary-600">{formatIDR(estTotal)}</span>
              </div>
              {paymentMethod !== 'pay_later' && minDpPercentage > 0 && (
                <div className="summary-row">
                  <span>{collectionMode === 'dp' ? `Ditagih sekarang (DP ${minDpPercentage}%)` : 'Ditagih sekarang'}</span>
                  <strong>{formatIDR(collectionMode === 'dp' ? Math.round((estTotal * minDpPercentage) / 100) : estTotal)}</strong>
                </div>
              )}
            </div>

            {submitError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginTop: '14px' }}>
                {submitError}
              </div>
            )}

            <div className="step-actions mt-4 border-top pt-4">
              <Button variant="ghost" onClick={() => setStep(2)}>Kembali</Button>
              <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!primaryGuest.name || !primaryGuest.phone}>Konfirmasi & Simpan</Button>
            </div>
          </Card>
        )}
      </div>

      {paymentInfo && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-card)', width: '400px', maxWidth: '90%' }}>
            <h3 className="text-h3 mb-4 text-center">Pembayaran Midtrans</h3>
            <div style={{ backgroundColor: 'var(--primary-50)', padding: '16px', borderRadius: '8px', textAlign: 'center', wordBreak: 'break-all' }}>
              <p className="text-body-small mb-2">Total Tagihan:</p>
              <h2 className="text-h2 text-primary-600 mb-4">{formatIDR(paymentInfo.amount || 0)}</h2>

              {gatewayState === 'verified' && (
                <div style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-fg)', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  <p className="text-body-strong">Lunas - reservasi terkonfirmasi.</p>
                </div>
              )}

              {gatewayState === 'expired' && (
                <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  <p className="text-body-strong">Kedaluwarsa - buat pembayaran baru.</p>
                </div>
              )}

              {gatewayState === 'pending' && (
                <>
                  <p className="text-body-strong mb-2">
                    {autoOpen === 'snap' && 'Popup pembayaran terbuka.'}
                    {autoOpen === 'redirect' && 'Dibuka di tab baru.'}
                    {autoOpen === 'blocked' && 'Popup diblokir - tekan Bayar.'}
                    {autoOpen === 'nothing' && 'Belum terbuka - tekan Bayar.'}
                    {!autoOpen && 'Membuka pembayaran...'}
                  </p>

                  {openError && (
                    <div style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-fg)', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px' }}>
                      <p className="text-body-small">{openError}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <Button size="sm" onClick={() => void openPayment()}>Bayar</Button>
                    {paymentInfo.redirect_url && (
                      <a
                        href={paymentInfo.redirect_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-body-small"
                        style={{ color: 'var(--primary-600)' }}
                      >
                        Tab baru &rarr;
                      </a>
                    )}
                  </div>
                </>
              )}
              
              {/* Simulator lokal (tanpa token): tidak ada popup, jadi kodenya tampil di sini */}
              {!paymentInfo.token && (
                <>
                  <p className="text-body-small text-ink-500 mb-2">
                    {paymentInfo.channel === 'qris' ? 'Scan QRIS ini:' : `Kode ${paymentInfo.channel.toUpperCase()}:`}
                  </p>
                  {paymentInfo.channel === 'qris' ? (
                    <div style={{ backgroundColor: 'white', padding: '16px', display: 'inline-block', border: '1px solid var(--border)' }}>
                      <div style={{ width: '200px', height: '200px', backgroundColor: 'var(--ink-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="text-ink-500 text-body-small">QR</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-h3" style={{ letterSpacing: '2px' }}>{paymentInfo.qr_string}</p>
                  )}
                  <p className="text-body-small mt-2">{paymentInfo.qr_string}</p>
                </>
              )}

              {paymentInfo.environment && (
                <p className="text-caption text-ink-500" style={{ marginTop: '8px' }}>{paymentInfo.environment}</p>
              )}
            </div>
            <div className="mt-4" style={{ display: 'flex', justifyContent: 'center' }}>
              <Button onClick={handleClosePaymentModal}>Selesai</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
