import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Drawer';
import { formatIDR, formatDateShort } from '../../lib/format';
import type { BookingStatus } from '../../types';
import './BookingList.css';

interface Booking {
  id: number;
  booking_code: string;
  status: BookingStatus;
  check_in: string;
  check_out: string;
  total_price: number;
  customer: { id: number; name: string; phone?: string; ktp?: string };
  assigned_rooms?: string[];
  booking_rooms?: Array<{
    id: number;
    room?: { id: number; room_number: string };
  }>;
  payments?: Array<{
    id: number;
    amount: number;
    method: string;
    status: string;
  }>;
  invoice?: { id: number; status: string; total: string };
}

export default function CheckInOutCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'checkin';
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Drawer states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check-In Dialog (Jaminan)
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState<Booking | null>(null);
  const [guaranteeType, setGuaranteeType] = useState('ktp');
  const [guaranteeNote, setGuaranteeNote] = useState('');
  const [depositAmount, setDepositAmount] = useState('0');

  // Quick Payment Modal if not yet paid
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  const navigate = useNavigate();

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/bookings');
      const raw = response.data?.data;
      const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
      setBookings(list);
    } catch (error) {
      console.error('Failed to fetch bookings', error);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper untuk hitung total tagihan riil (mengikuti invoice jika ada, atau total_price)
  const calculateTotal = (b: Booking) => {
    return b.invoice ? Number(b.invoice.total) : Number(b.total_price);
  };

  // Helper untuk hitung total pembayaran yang valid
  const calculatePaid = (b: Booking) => {
    if (!b.payments || !Array.isArray(b.payments)) {
      return 0;
    }
    return b.payments
      .filter((p) => p.status === 'verified' || p.status === 'success')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  };

  // Helper untuk hitung sisa tagihan
  const calculateRemaining = (b: Booking) => {
    const total = calculateTotal(b);
    const paid = calculatePaid(b);
    return Math.max(0, total - paid);
  };

  // Filter list berdasarkan tab aktif
  const filteredList = bookings.filter((b) => {
    const matchesSearch =
      b.booking_code?.toLowerCase().includes(search.toLowerCase()) ||
      b.customer?.name?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'checkin') {
      // Tamu siap check-in (pending atau confirmed)
      return b.status === 'pending' || b.status === 'confirmed';
    } else if (activeTab === 'checkout') {
      // Tamu sedang menginap (checked_in)
      return b.status === 'checked_in';
    } else {
      // Riwayat / Selesai / Dibatalkan
      return b.status === 'checked_out' || b.status === 'cancelled';
    }
  });

  // Action: Open Check-In Modal with Guarantee
  const handleOpenCheckInModal = (b: Booking) => {
    const sisa = calculateRemaining(b);
    
    // Validasi Pembayaran Sebelum Check-In
    if (b.status === 'pending' && sisa > 0) {
      const confirmPay = confirm(
        `PERINGATAN: Reservasi ${b.booking_code} belum lunas (Kurang: ${formatIDR(sisa)}).\n\nApakah Anda ingin mencatat pembayaran terlebih dahulu sekarang?`
      );
      if (confirmPay) {
        setPayTarget(b);
        setPayAmount(String(sisa));
        setIsPayModalOpen(true);
      }
      return;
    }

    setCheckInTarget(b);
    setGuaranteeType('ktp');
    setGuaranteeNote(`KTP Asli an. ${b.customer?.name || 'Tamu'}`);
    setDepositAmount('0');
    setIsCheckInModalOpen(true);
  };

  // Action: Confirm Check-In + Simpan Jaminan
  const handleConfirmCheckIn = async () => {
    if (!checkInTarget) return;
    setIsProcessing(true);
    try {
      // Panggil endpoint check-in backend
      await api.post(`/api/v1/bookings/${checkInTarget.id}/check-in`);
      
      // Simpan jaminan ke localStorage (sebagai audit trail operasional hotel)
      const guaranteeRecord = {
        booking_id: checkInTarget.id,
        booking_code: checkInTarget.id,
        customer_name: checkInTarget.customer?.name,
        type: guaranteeType,
        note: guaranteeNote,
        deposit: Number(depositAmount),
        checked_in_at: new Date().toISOString(),
      };
      const existingGuarantees = JSON.parse(localStorage.getItem('aedo_hotel_guarantees') || '{}');
      existingGuarantees[checkInTarget.id] = guaranteeRecord;
      localStorage.setItem('aedo_hotel_guarantees', JSON.stringify(existingGuarantees));

      setIsCheckInModalOpen(false);
      setCheckInTarget(null);
      await fetchBookings();
      alert(`Berhasil Check-In!\nKamar telah dialihkan ke Occupied dan Jaminan (${guaranteeType.toUpperCase()}) telah dicatat.`);
    } catch (error: any) {
      console.error('Check-in error', error);
      alert(error.response?.data?.message || error.response?.data?.error || 'Gagal memproses check-in.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Process Quick Payment
  const handleConfirmPayment = async () => {
    if (!payTarget) return;
    setIsProcessing(true);
    try {
      await api.post(`/api/v1/bookings/${payTarget.id}/payments`, {
        amount: Number(payAmount),
        method: payMethod,
        type: 'final',
        notes: `Pembayaran langsung di meja resepsionis`,
      });
      setIsPayModalOpen(false);
      await fetchBookings();
      alert('Pembayaran berhasil dicatat!');
    } catch (error: any) {
      console.error('Payment error', error);
      alert(error.response?.data?.message || 'Gagal menyimpan pembayaran.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Check-Out
  const handleProcessCheckOut = async (b: Booking) => {
    // 1. Cek apakah tagihan sudah lunas sebelum checkout (Aturan Bisnis No. 6)
    const sisa = calculateRemaining(b);

    if (sisa > 0) {
      const confirmPay = confirm(
        `CHECK-OUT DITOLAK: Tagihan tamu belum lunas!\nSisa tagihan yang harus dibayar: ${formatIDR(sisa)}.\n\nApakah Anda ingin memproses pelunasan sekarang di meja kasir?`
      );
      if (confirmPay) {
        setPayTarget(b);
        setPayAmount(String(sisa));
        setIsPayModalOpen(true);
      }
      return;
    }

    // 2. Ambil info jaminan yang tersimpan
    const existingGuarantees = JSON.parse(localStorage.getItem('aedo_hotel_guarantees') || '{}');
    const guarantee = existingGuarantees[b.id];
    let guaranteeMsg = '';
    if (guarantee) {
      guaranteeMsg = `\n\n[PENGEMBALIAN JAMINAN]:\n- Jaminan tersimpan: ${guarantee.type?.toUpperCase()} (${guarantee.note})\n- Uang Deposit: ${formatIDR(guarantee.deposit || 0)}\nPASTIKAN JAMINAN DIKEMBALIKAN KE TAMU!`;
    }

    if (!confirm(`Proses Check-Out sekarang untuk ${b.customer?.name} (${b.booking_code})?${guaranteeMsg}`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await api.post(`/api/v1/bookings/${b.id}/check-out`);
      
      // Hapus jaminan yang telah dikembalikan
      if (existingGuarantees[b.id]) {
        delete existingGuarantees[b.id];
        localStorage.setItem('aedo_hotel_guarantees', JSON.stringify(existingGuarantees));
      }

      await fetchBookings();
      alert(`Check-Out sukses!\nKamar telah dialihkan ke tim Housekeeping untuk dibersihkan.`);
    } catch (error: any) {
      console.error('Check-out error', error);
      alert(error.response?.data?.message || error.response?.data?.error || 'Gagal check out.');
    } finally {
      setIsProcessing(false);
    }
  };

  const columns: Column<Booking>[] = [
    { key: 'code', header: 'Kode Booking', cell: (b) => <span className="text-body-strong">{b.booking_code}</span> },
    { 
      key: 'customer', 
      header: 'Nama Tamu', 
      cell: (b) => (
        <div>
          <div className="text-body-strong">{b.customer?.name || '-'}</div>
          <div className="text-body-small text-ink-500">{b.customer?.phone || b.customer?.ktp || '-'}</div>
        </div>
      ) 
    },
    { 
      key: 'room', 
      header: 'Kamar', 
      cell: (b) => {
        const rooms = b.booking_rooms?.map(br => br.room?.room_number).filter(Boolean) || b.assigned_rooms || [];
        return <span>{rooms.length ? `No. ${rooms.join(', ')}` : '-'}</span>;
      }
    },
    { key: 'checkin', header: 'Jadwal Masuk', cell: (b) => formatDateShort(b.check_in) },
    { key: 'checkout', header: 'Jadwal Keluar', cell: (b) => formatDateShort(b.check_out) },
    { 
      key: 'total', 
      header: 'Total Biaya', 
      cell: (b) => formatIDR(calculateTotal(b)), 
      align: 'right' 
    },
    {
      key: 'payment_status',
      header: 'Status Pembayaran',
      cell: (b) => {
        const sisa = calculateRemaining(b);
        const isLunas = sisa <= 0 || b.invoice?.status === 'paid';

        if (isLunas) {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#15803d',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              ● Lunas
            </span>
          );
        }

        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#b91c1c',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            ● Kurang {formatIDR(sisa)}
          </span>
        );
      },
    },
    { 
      key: 'status', 
      header: 'Status Menginap', 
      cell: (b) => <StatusBadge type="booking" value={b.status} /> 
    },
    {
      key: 'action',
      header: 'Aksi Meja Resepsionis',
      align: 'right',
      cell: (b) => {
        const isReadyForCheckIn = b.status === 'confirmed' || b.status === 'pending';
        const isCheckedIn = b.status === 'checked_in';

        return (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isReadyForCheckIn && (
              <Button
                size="sm"
                variant={b.status === 'confirmed' ? 'primary' : 'secondary'}
                onClick={() => handleOpenCheckInModal(b)}
              >
                {b.status === 'confirmed' ? 'Check-In' : 'Bayar & Check-In'}
              </Button>
            )}

            {isCheckedIn && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleProcessCheckOut(b)}
              >
                Check-Out
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedBooking(b);
                setIsDrawerOpen(true);
              }}
            >
              Detail
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="booking-list-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-h1">Meja Resepsionis (Check-In & Check-Out)</h1>
          <p className="text-body-small text-ink-500 mt-1">
            Kelola alur penerimaan tamu, pencatatan jaminan identitas/deposit, dan pemulangan tamu hotel.
          </p>
        </div>
        <div className="page-actions">
          <Button onClick={() => navigate('/reservations/new')}>+ Buat Reservasi</Button>
        </div>
      </div>

      <div className="booking-filters">
        <Tabs
          options={[
            { label: 'Siap Check-In', value: 'checkin' },
            { label: 'Tamu Menginap (Check-Out)', value: 'checkout' },
            { label: 'Riwayat Selesai', value: 'history' },
          ]}
          value={activeTab}
          onChange={(val) => setSearchParams({ tab: val })}
        />
        <div className="search-wrapper">
          <Input
            placeholder="Cari nomor booking atau tamu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={filteredList}
        keyExtractor={(b) => b.id}
        isLoading={isLoading}
      />

      {/* MODAL CHECK-IN DENGAN JAMINAN HOTEL */}
      {isCheckInModalOpen && checkInTarget && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              padding: '24px',
              borderRadius: '12px',
              width: '460px',
              maxWidth: '92%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h2 className="text-h2 mb-2">Formulir Check-In Tamu</h2>
            <p className="text-body-small text-ink-500 mb-4">
              Konfirmasi kedatangan tamu untuk reservasi <strong>{checkInTarget.booking_code}</strong>.
            </p>

            <div style={{ backgroundColor: 'var(--surface-muted)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="text-body-small">Nama Tamu:</span>
                <span className="text-body-strong">{checkInTarget.customer?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="text-body-small">Durasi Menginap:</span>
                <span className="text-body-strong">{formatDateShort(checkInTarget.check_in)} s/d {formatDateShort(checkInTarget.check_out)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-body-small">Status Tagihan:</span>
                <span className="text-body-strong" style={{ color: 'var(--success-600)' }}>
                  Lunas ({formatIDR(checkInTarget.total_price)})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="text-label mb-1" style={{ display: 'block' }}>Jenis Jaminan Hotel (Wajib Disimpan):</label>
                <select
                  className="ui-select"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  value={guaranteeType}
                  onChange={(e) => setGuaranteeType(e.target.value)}
                >
                  <option value="ktp">KTP Asli</option>
                  <option value="sim">SIM Asli</option>
                  <option value="paspor">Paspor Asli</option>
                  <option value="deposit_uang">Deposit Uang Tunai</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-label mb-1" style={{ display: 'block' }}>Nomor / Keterangan Jaminan:</label>
                <Input
                  placeholder="Misal: KTP No. 3201... atau Plat Kendaraan"
                  value={guaranteeNote}
                  onChange={(e) => setGuaranteeNote(e.target.value)}
                />
              </div>

              <div>
                <label className="text-label mb-1" style={{ display: 'block' }}>Deposit Tambahan (Jika Ada):</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <span className="text-body-small text-ink-500 mt-1" style={{ display: 'block', fontSize: '11px' }}>
                  *Deposit akan dikembalikan saat tamu proses Check-Out.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <Button variant="ghost" onClick={() => setIsCheckInModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleConfirmCheckIn} isLoading={isProcessing}>
                Konfirmasi Check-In
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PELUNASAN CEPAT SEBELUM CHECK-IN */}
      {isPayModalOpen && payTarget && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              padding: '24px',
              borderRadius: '12px',
              width: '420px',
              maxWidth: '92%',
            }}
          >
            <h2 className="text-h2 mb-2">Pelunasan Sebelum Check-In</h2>
            <p className="text-body-small text-ink-500 mb-4">
              Catat penerimaan pembayaran untuk <strong>{payTarget.customer?.name}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="text-label mb-1" style={{ display: 'block' }}>Nominal Pembayaran (Rp):</label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="text-label mb-1" style={{ display: 'block' }}>Metode Pembayaran:</label>
                <select
                  className="ui-select"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="cash">Tunai (Kasir Resepsionis)</option>
                  <option value="transfer">Transfer Bank</option>
                  <option value="qris">QRIS Hotel</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <Button variant="ghost" onClick={() => setIsPayModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleConfirmPayment} isLoading={isProcessing}>
                Simpan & Lanjutkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER DETAIL */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Detail Reservasi"
        width="600px"
        footer={
          <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setIsDrawerOpen(false)}>Tutup</Button>
            {selectedBooking?.status === 'confirmed' && (
              <Button onClick={() => { setIsDrawerOpen(false); handleOpenCheckInModal(selectedBooking); }}>
                Check-In Sekarang
              </Button>
            )}
            {selectedBooking?.status === 'checked_in' && (
              <Button onClick={() => { setIsDrawerOpen(false); handleProcessCheckOut(selectedBooking); }}>
                Check-Out Sekarang
              </Button>
            )}
          </div>
        }
      >
        {selectedBooking && (
          <div className="booking-detail-content">
            <div className="detail-header-card">
              <div className="detail-code">{selectedBooking.booking_code}</div>
              <StatusBadge type="booking" value={selectedBooking.status} />
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Informasi Tamu</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="text-label">Nama Tamu</span>
                  <span className="text-body-strong">{selectedBooking.customer?.name}</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">No. Telepon</span>
                  <span className="text-body-strong">{selectedBooking.customer?.phone || '-'}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Rincian Menginap</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="text-label">Check-in</span>
                  <span className="text-body-strong">{formatDateShort(selectedBooking.check_in)}</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">Check-out</span>
                  <span className="text-body-strong">{formatDateShort(selectedBooking.check_out)}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Ringkasan Tagihan & Pembayaran</h3>
              <div className="invoice-summary mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Tagihan (termasuk pajak)</span>
                  <span className="text-body-strong">{formatIDR(calculateTotal(selectedBooking))}</span>
                </div>
                <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sudah Dibayar (Verified)</span>
                  <span className="text-body-strong" style={{ color: '#15803d' }}>{formatIDR(calculatePaid(selectedBooking))}</span>
                </div>
                <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                  <span>Sisa Tagihan</span>
                  <span className="text-body-strong" style={{ color: calculateRemaining(selectedBooking) > 0 ? '#b91c1c' : '#15803d' }}>
                    {calculateRemaining(selectedBooking) > 0 ? formatIDR(calculateRemaining(selectedBooking)) : 'LUNAS'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
