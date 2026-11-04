/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { toast } from '../../components/ui/Toast';
import { formatIDR } from '../../lib/format';
import { api } from '../../lib/api';
import './NewBooking.css';

interface AvailableRoom {
  id: number;
  room_number: string;
  floor: number;
  // Kolom decimal(12,2) dikirim API sebagai string ("350000.00"), jadi keduanya mungkin
  room_type: { id: number; name: string; price: number | string; max_person?: number };
}

interface GuestInput {
  name: string;
  ktp: string;
  phone: string;
  email: string;
  /** Kamar fisik yang ditugaskan untuk penghuni ini; '' = belum ditentukan. */
  room_id: number | '';
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
  // Baris 0 = penanggung jawab reservasi (sekaligus jadi data pelanggan), baris berikutnya
  // = penghuni lain. Jumlah baris mengikuti "Jumlah Tamu" di langkah 1; kosong boleh, karena
  // nama penghuni boleh dirampungkan saat check-in (backend menolak check-in bila kurang).
  const emptyGuest = (): GuestInput => ({ name: '', ktp: '', phone: '', email: '', room_id: '', is_primary: false });
  const [guests, setGuests] = useState<GuestInput[]>([{ name: '', ktp: '', phone: '', email: '', room_id: '', is_primary: true }]);

  const updateGuest = (index: number, patch: Partial<GuestInput>) => {
    setGuests((prev) => prev.map((guest, i) => (i === index ? { ...guest, ...patch } : guest)));
  };

  // Pencarian pelanggan terdaftar
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Ambil pengaturan pajak hotel dari backend
  useEffect(() => {
    const fetchHotelSettings = async () => {
      try {
        const res = await api.get('/api/v1/settings');
        const data = res.data?.data;
        if (data?.tax_percentage !== undefined) {
          setTaxPercentage(Number(data.tax_percentage));
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
    updateGuest(0, {
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
    updateGuest(0, { name: '', ktp: '', phone: '', email: '', is_primary: true });
  };

  /** Pilihan kamar untuk penempatan penghuni = kamar yang sudah dipilih di langkah 2. */
  const roomOptions = selectedRooms.map(r => ({
    id: r.id,
    label: `Kamar ${r.room_number} · ${r.room_type.name}`,
  }));

  // Multi-kamar: penempatan wajib dipilih. Satu kamar: tidak ambigu, jadi terisi sendiri.
  const banyakKamar = selectedRooms.length > 1;

  useEffect(() => {
    const valid = new Set(selectedRooms.map(r => r.id));
    const tunggal = selectedRooms.length === 1 ? selectedRooms[0].id : null;

    setGuests((prev) => prev.map((guest) => {
      if (guest.room_id && !valid.has(guest.room_id)) {
        return { ...guest, room_id: tunggal ?? '' };
      }
      if (!guest.room_id && tunggal) {
        return { ...guest, room_id: tunggal };
      }
      return guest;
    }));
  }, [selectedRooms]);

  const roomSelect = (index: number, value: number | '') => (
    <div className="form-group">
      <label className="text-label">
        Kamar
        {banyakKamar && <span className="input-required">*</span>}
      </label>
      <select
        className="ui-select"
        value={value}
        onChange={e => updateGuest(index, { room_id: e.target.value ? Number(e.target.value) : '' })}
        required={banyakKamar}
      >
        <option value="">{banyakKamar ? 'Pilih kamar' : 'Belum ditentukan'}</option>
        {roomOptions.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  );

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

  // Jumlah baris tamu selalu sama dengan guest_count: tambah di belakang, potong dari belakang
  useEffect(() => {
    const target = Math.max(1, Number(guestCount) || 1);

    setGuests((prev) => {
      if (prev.length === target) return prev;
      if (prev.length < target) {
        const tambahan = Array.from({ length: target - prev.length }, () => emptyGuest());
        return [...prev, ...tambahan];
      }
      return prev.slice(0, target);
    });
  }, [guestCount]);

  const handleSubmit = async () => {
    const primary = guests[0];

    if (!primary.name.trim()) {
      setSubmitError('Nama penanggung jawab reservasi wajib diisi.');
      return;
    }

    // Multi-kamar: setiap penghuni yang dikirim harus punya kamar (server juga menolak)
    if (banyakKamar) {
      const belum = guests.filter((guest, i) => (i === 0 || guest.name.trim()) && !guest.room_id);
      if (belum.length) {
        setSubmitError('Reservasi multi-kamar: pilih kamar untuk setiap penghuni.');
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      // 1. Pakai pelanggan terdaftar yang dipilih, atau buat baru bila belum ada
      let customerId = selectedCustomerId;
      if (!customerId) {
        const custRes = await api.post('/api/v1/customers', {
          name: primary.name,
          phone: primary.phone,
          email: primary.email || undefined,
          ktp: primary.ktp,
        });
        customerId = custRes.data.data.id;
      } else if (primary.email) {
        // Lengkapi email pelanggan lama bila belum ada / berubah
        await api.put(`/api/v1/customers/${customerId}`, {
          name: primary.name,
          phone: primary.phone,
          email: primary.email,
          ktp: primary.ktp,
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
        // Baris yang namanya kosong tidak dikirim: backend menghitung jumlah tamu dari baris ini
        guests: guests
          .filter((guest, index) => index === 0 || guest.name.trim() !== '')
          .map((guest, index) => ({
            name: guest.name.trim(),
            ktp: guest.ktp.trim() || undefined,
            phone: guest.phone.trim() || undefined,
            room_id: guest.room_id || undefined,
            is_primary: index === 0,
          })),
        notes: notes || undefined,
      };

      const bookingRes = await api.post('/api/v1/bookings', payload);
      const createdBooking = bookingRes.data.data;

      toast.success(
        `Reservasi ${createdBooking?.booking_code || ''} berhasil dibuat.`,
        { title: 'Reservasi Tersimpan' }
      );

      // Pembayaran dicatat terpisah di daftar reservasi (tunai / transfer / QRIS).
      navigate('/reservations');
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

  // Wajib Number() di sini: harga datang sebagai string desimal, jadi `sum + price`
  // akan MERANGKAI teks bila kamar lebih dari satu -> NaN -> total tampil "Rp 0".
  const totalRoomRatePerNight = selectedRooms.reduce((sum, r) => sum + (Number(r.room_type?.price) || 0), 0);
  const calculateNights = () => {
    if (!checkIn || !checkOut) return 1;
    const diffTime = Math.abs(new Date(checkOut).getTime() - new Date(checkIn).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };
  const nights = calculateNights();
  const estSubtotal = totalRoomRatePerNight * nights;
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
            <h3 className="text-h4 mb-2">Informasi Penanggung Jawab</h3>

            <div className="customer-search-box" style={{ position: 'relative', marginBottom: '16px' }}>
              <label className="text-label">Ambil dari Pelanggan Terdaftar (Opsional)</label>
              {selectedCustomerId ? (
                <div className="selected-customer-chip">
                  <span>
                    Memakai data pelanggan: <strong>{guests[0].name}</strong>
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
                value={guests[0].name}
                onChange={e => updateGuest(0, { name: e.target.value })}
                required
              />
              <Input
                label="No. Telepon / WhatsApp"
                value={guests[0].phone}
                onChange={e => updateGuest(0, { phone: e.target.value })}
                required
              />
              <Input
                label="Nomor KTP"
                value={guests[0].ktp}
                onChange={e => updateGuest(0, { ktp: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={guests[0].email}
                onChange={e => updateGuest(0, { email: e.target.value })}
                placeholder="Contoh: tamu@email.com"
              />
              {roomSelect(0, guests[0].room_id)}
            </div>

            {guests.length > 1 && (
              <>
                <h3 className="text-h4 mb-1 border-top pt-4">Penghuni Lain</h3>
                <p className="text-body-small text-ink-500 mb-3">
                  {banyakKamar
                    ? 'Nama dan kamar setiap penghuni wajib dipilih. Nama yang belum diketahui boleh kosong, tetapi harus dilengkapi sebelum check-in.'
                    : 'Boleh dikosongkan bila namanya belum diketahui. Penghuni otomatis tercatat di kamar yang dipilih.'}
                </p>
                <div className="form-grid mb-4">
                  {guests.slice(1).map((guest, offset) => {
                    const index = offset + 1;
                    return (
                      <div key={index} className="guest-row">
                        <Input
                          label={`Nama Penghuni ${index + 1}`}
                          value={guest.name}
                          onChange={e => updateGuest(index, { name: e.target.value })}
                          placeholder="Nama sesuai KTP"
                        />
                        <Input
                          label="No. KTP (opsional)"
                          value={guest.ktp}
                          onChange={e => updateGuest(index, { ktp: e.target.value })}
                        />
                        {roomSelect(index, guest.room_id)}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            <h3 className="text-h4 mb-2 border-top pt-4">Catatan</h3>
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
              <p className="text-body-small text-ink-500 full-width">
                Pembayaran dicatat setelah reservasi tersimpan, lewat menu Pembayaran (tunai / transfer / QRIS).
              </p>
            </div>

            <div className="summary-section border-top pt-4">
              <h3 className="text-h4 mb-2">Ringkasan Estimasi Tagihan</h3>
              {selectedRooms.map(r => (
                <div className="summary-row" key={r.id}>
                  <span>Kamar {r.room_number} · {r.room_type.name}</span>
                  <span>{formatIDR(Number(r.room_type.price) || 0)} / malam</span>
                </div>
              ))}
              <div className="summary-row">
                <span>Durasi Menginap</span>
                <strong>{nights} malam</strong>
              </div>
              <div className="summary-row">
                <span>Subtotal Kamar ({selectedRooms.length} kamar)</span>
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
                <span className="money-label">Estimasi Total Bayar</span>
                <span className="money-total">{formatIDR(estTotal)}</span>
              </div>
            </div>

            {submitError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginTop: '14px' }}>
                {submitError}
              </div>
            )}

            <div className="step-actions mt-4 border-top pt-4">
              <Button variant="ghost" onClick={() => setStep(2)}>Kembali</Button>
              <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!guests[0].name.trim() || !guests[0].phone}>Konfirmasi & Simpan</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
