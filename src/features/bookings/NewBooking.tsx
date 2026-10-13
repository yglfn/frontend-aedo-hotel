import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { formatIDR } from '../../lib/format';
import { api } from '../../lib/api';
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
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<{ channel: string; qr_string?: string; amount?: number } | null>(null);

  // Ambil pengaturan pajak hotel dari backend
  useEffect(() => {
    const fetchHotelSettings = async () => {
      try {
        const res = await api.get('/api/v1/settings');
        if (res.data?.data?.tax_percentage !== undefined) {
          setTaxPercentage(Number(res.data.data.tax_percentage));
        }
      } catch (err) {
        console.error('Failed to load hotel tax settings', err);
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
      setSearchError(error.response?.data?.message || 'Gagal mencari ketersediaan kamar. Pastikan tanggal valid.');
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

      if (paymentMethod !== 'pay_later' && createdBooking?.id) {
        try {
          const payRes = await api.post(`/api/v1/bookings/${createdBooking.id}/payments/gateway`, {
            channel: paymentMethod,
          });
          const info = payRes.data?.payment_info;
          setPaymentInfo({
            channel: paymentMethod,
            qr_string: info?.qr_string || info?.transaction_id,
            amount: info?.amount || estTotal,
          });
        } catch (payErr) {
          console.error('Payment gateway error, booking was still created', payErr);
          navigate('/reservations');
        }
      } else {
        navigate('/reservations');
      }
    } catch (error: any) {
      console.error('Failed to submit booking', error);
      setSubmitError(error.response?.data?.message || error.response?.data?.error || 'Gagal membuat reservasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePaymentModal = () => {
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
                <label className="text-label">Metode Pembayaran (Otomatis DP/Lunas)</label>
                <select className="ui-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="pay_later">Bayar Nanti (Pay at Hotel / Transfer Manual)</option>
                  <option value="qris">Payment Gateway (QRIS)</option>
                  <option value="va">Payment Gateway (Virtual Account)</option>
                  <option value="ewallet">Payment Gateway (E-Wallet)</option>
                </select>
                <p className="text-body-small text-ink-500 mt-1">
                  Pilih Gateway untuk langsung memunculkan kode bayar online setelah reservasi tersimpan.
                </p>
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
            <h3 className="text-h3 mb-4 text-center">Selesaikan Pembayaran</h3>
            <div style={{ backgroundColor: 'var(--primary-50)', padding: '16px', borderRadius: '8px', textAlign: 'center', wordBreak: 'break-all' }}>
              <p className="text-body-small mb-2">Total Tagihan:</p>
              <h2 className="text-h2 text-primary-600 mb-4">{formatIDR(paymentInfo.amount || 0)}</h2>
              
              {paymentInfo.channel === 'qris' ? (
                <>
                  <p className="text-body-strong mb-2">Scan QRIS Berikut:</p>
                  <div style={{ backgroundColor: 'white', padding: '16px', display: 'inline-block', border: '1px solid var(--border)' }}>
                    <div style={{ width: '200px', height: '200px', backgroundColor: 'var(--ink-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-ink-500 text-body-small">Dummy QR Image</span>
                    </div>
                  </div>
                  <p className="text-body-small mt-2">{paymentInfo.qr_string}</p>
                </>
              ) : (
                <>
                  <p className="text-body-strong mb-2">Kode Pembayaran ({paymentInfo.channel.toUpperCase()}):</p>
                  <p className="text-h3" style={{ letterSpacing: '2px' }}>{paymentInfo.qr_string}</p>
                </>
              )}
            </div>
            <div className="mt-4" style={{ display: 'flex', justifyContent: 'center' }}>
              <Button onClick={handleClosePaymentModal}>Selesai & Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
