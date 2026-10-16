import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Drawer';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { formatIDR, formatDateShort } from '../../lib/format';
import { syncPendingGatewayPayments } from '../../lib/gatewaySync';
import { useAuth } from '../../context/AuthContext';
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
    type?: string;
    status: string;
  }>;
  invoice?: { id: number; status: string; total: string };
  // Ringkasan pembayaran dihitung ulang oleh backend (satu rumus untuk semua layar)
  paid_verified?: number;
  paid_pending?: number;
  invoice_total?: number;
  remaining_due?: number;
  dp_min_amount?: number;
  dp_shortfall?: number;
  has_pending_payment?: boolean;
  blocks_manual_payment?: boolean;
}

export default function CheckInOutCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'checkin';
  const { isAdmin } = useAuth();
  
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
  // Meja bisa menerima uang muka (DP) saja, tidak selalu pelunasan penuh.
  const [payType, setPayType] = useState<'dp' | 'final'>('final');

  const navigate = useNavigate();

  const requestSeq = useRef(0);

  // Status per tab dikirim ke server agar Reservasi lama (di luar halaman pertama) tetap dicari
  const TAB_STATUS: Record<string, string> = {
    checkin: 'pending,confirmed',
    checkout: 'checked_in',
    riwayat: 'checked_out,cancelled',
  };

  // Debounce 300ms supaya pencarian tidak mengirim banyak request
  useEffect(() => {
    const handler = setTimeout(() => fetchBookings(), 300);
    return () => clearTimeout(handler);
  }, [activeTab, search]);

  const fetchBookings = async () => {
    const requestId = ++requestSeq.current;
    try {
      setIsLoading(true);

      // Status bayar reservasi mengikuti kenyataan di gateway, bukan menunggu tombol
      // "Cek Status" ditekan (di dev tidak ada cron dan webhook tidak selalu bisa masuk)
      await syncPendingGatewayPayments();

      const params = new URLSearchParams({ per_page: '100' });
      if (TAB_STATUS[activeTab]) params.set('status', TAB_STATUS[activeTab]);
      if (search.trim()) params.set('search', search.trim());

      const response = await api.get(`/api/v1/bookings?${params.toString()}`);
      if (requestId !== requestSeq.current) return;

      const raw = response.data?.data;
      const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
      setBookings(list);
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      console.error('Failed to fetch bookings', error);
      setBookings([]);
    } finally {
      if (requestId === requestSeq.current) setIsLoading(false);
    }
  };

  // Helper tagihan. Nilai dari server selalu dipakai lebih dulu supaya UI, backend,
  // dan laporan memakai angka yang sama (dulu UI hanya menjumlah payment `verified`).
  const calculateTotal = (b: Booking) => {
    if (typeof b.invoice_total === 'number') return b.invoice_total;
    return b.invoice ? Number(b.invoice.total) : Number(b.total_price);
  };

  const calculatePaid = (b: Booking) => {
    if (typeof b.paid_verified === 'number') return b.paid_verified;
    if (!b.payments || !Array.isArray(b.payments)) {
      return 0;
    }
    return b.payments
      .filter((p) => p.status === 'verified' || p.status === 'success')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  };

  const calculatePending = (b: Booking) => {
    if (typeof b.paid_pending === 'number') return b.paid_pending;
    return (b.payments || [])
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  };

  /** Sisa yang masih boleh ditagih = total - verified - pending */
  const calculateRemaining = (b: Booking) => {
    if (typeof b.remaining_due === 'number') return b.remaining_due;
    return Math.max(0, calculateTotal(b) - calculatePaid(b) - calculatePending(b));
  };

  /** true bila ada transfer/QRIS manual menunggu verifikasi admin -> jangan menagih lagi */
  const blockedByPendingPayment = (b: Booking) => {
    if (typeof b.blocks_manual_payment === 'boolean') return b.blocks_manual_payment;
    return (b.payments || []).some(
      (p) => p.status === 'pending' && p.method !== 'payment_gateway'
    );
  };

  /**
   * Status pembayaran yang jujur. "Lunas" hanya kalau uang verified sudah menutup tagihan.
   * Payment pending BELUM uang masuk - dulu kasus ini tertulis "LUNAS" dengan Sudah Dibayar
   * Rp 0 sehingga menipu kasir di layar check-in.
   */
  const paymentState = (b: Booking): { tone: 'lunas' | 'pending' | 'unpaid' | 'unknown'; label: string } => {
    const total = calculateTotal(b);
    const paid = calculatePaid(b);
    const pending = calculatePending(b);
    const sisa = calculateRemaining(b);

    if (![total, paid, pending, sisa].every(Number.isFinite)) {
      return { tone: 'unknown', label: 'Belum diketahui' };
    }

    if ((total > 0 && paid >= total) || b.invoice?.status === 'paid') {
      return { tone: 'lunas', label: 'Lunas' };
    }

    if (paid > 0) return { tone: 'unpaid', label: `Kurang ${formatIDR(sisa)}` };
    if (pending > 0) return { tone: 'pending', label: 'Menunggu verifikasi' };

    return { tone: 'unpaid', label: 'Belum bayar' };
  };

  /** Kekurangan DP terhadap ambang minimum hotel (0 bila tidak diwajibkan / sudah cukup). */
  const dpShortfall = (b: Booking) => {
    if (typeof b.dp_shortfall === 'number') return b.dp_shortfall;

    const min = Number(b.dp_min_amount ?? 0);

    return min > 0 ? Math.max(0, Math.round(min - calculatePaid(b))) : 0;
  };

  /**
   * Buka modal pembayaran meja. Saat reservasi masih menunggu uang muka, default-nya DP
   * dengan nominal sebesar kekurangan ambang - itu memang yang dicari kasir untuk mengunci
   * kamar. Untuk pelunasan (mis. check-out), default tetap penuh.
   */
  const openPaymentModal = (b: Booking, sisa: number, preferDp = false) => {
    const kurang = dpShortfall(b);
    const useDp = preferDp && kurang > 0 && kurang < sisa;

    setPayType(useDp ? 'dp' : 'final');
    setPayAmount(String(useDp ? kurang : sisa));
    setPayTarget(b);
    setIsPayModalOpen(true);
  };

  /** Ganti jenis pembayaran di modal: DP mengikuti ambang, pelunasan mengikuti sisa. */
  const choosePayType = (type: 'dp' | 'final') => {
    setPayType(type);

    if (!payTarget) return;

    const sisa = calculateRemaining(payTarget);
    const kurang = dpShortfall(payTarget);

    if (type === 'dp' && kurang > 0 && kurang < sisa) setPayAmount(String(kurang));
    if (type === 'final') setPayAmount(String(sisa));
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

  // Buka form jaminan + check-in (dipakai beberapa jalur di bawah)
  const openCheckInForm = (b: Booking) => {
    setCheckInTarget(b);
    setGuaranteeType('ktp');
    setGuaranteeNote(`KTP Asli an. ${b.customer?.name || 'Tamu'}`);
    setDepositAmount('0');
    setIsCheckInModalOpen(true);
  };

  /** Ambil versi terbaru satu reservasi (status & sisa berubah setelah verifikasi/konfirmasi) */
  const reloadBooking = async (b: Booking): Promise<Booking | null> => {
    try {
      const res = await api.get(`/api/v1/bookings/${b.id}`);
      return (res.data?.data as Booking) || null;
    } catch (error) {
      console.error('Failed to reload booking', error);
      return null;
    }
  };

  /** Verifikasi payment manual yang pending, langsung dari layar check-in (admin only) */
  const verifyPendingPayments = async (b: Booking): Promise<boolean> => {
    const pending = (b.payments || []).filter(
      (p) => p.status === 'pending' && p.method !== 'payment_gateway'
    );

    try {
      for (const payment of pending) {
        await api.patch(`/api/v1/payments/${payment.id}/verify`);
      }

      toast.success(
        pending.length > 1
          ? `${pending.length} pembayaran diverifikasi.`
          : 'Pembayaran diverifikasi dan reservasi diperbarui.'
      );
      await fetchBookings();
      return true;
    } catch (error: any) {
      console.error('Verify pending payments failed', error);
      toast.apiError(error, 'Gagal memverifikasi pembayaran.');
      return false;
    }
  };

  /**
   * Action: check-in dengan 4 keadaan yang jelas. Inti perbaikannya: pembayaran yang
   * sudah masuk tapi belum diverifikasi tidak pernah ditagih ulang lagi.
   */
  const handleOpenCheckInModal = async (b: Booking) => {
    const sisa = calculateRemaining(b);

    // (1) Ada transfer/QRIS manual menunggu verifikasi admin
    if (blockedByPendingPayment(b)) {
      if (!isAdmin) {
        toast.info(`Pembayaran ${b.booking_code} masih menunggu verifikasi admin.`, {
          title: 'Menunggu Verifikasi',
        });
        return;
      }

      const doVerify = await confirmDialog({
        title: 'Verifikasi Pembayaran',
        message: `Pembayaran reservasi ${b.booking_code} belum diverifikasi. Verifikasi sekarang untuk melanjutkan check-in?`,
        confirmLabel: 'Verifikasi & Lanjutkan',
        cancelLabel: 'Batal',
      });

      if (doVerify && (await verifyPendingPayments(b))) {
        const updated = await reloadBooking(b);
        if (updated) openCheckInForm(updated);
      }
      return;
    }

    // (2) Belum terkonfirmasi dan masih ada sisa -> tawarkan catat pembayaran (walk-in)
    if (b.status !== 'confirmed' && sisa > 0) {
      const payNow = await confirmDialog({
        title: 'Pembayaran Belum Lunas',
        message: `Reservasi ${b.booking_code} belum lunas (kurang ${formatIDR(sisa)}). Catat pembayaran sekarang?`,
        confirmLabel: 'Catat Pembayaran',
        cancelLabel: 'Nanti',
      });
      if (payNow) {
        // Reservasi belum terkunci: kasir biasanya cukup menerima DP dulu
        openPaymentModal(b, sisa, true);
      }
      return;
    }

    // (3) Uang sudah cukup tapi reservasi belum dikonfirmasi (mis. Traveloka/kredit)
    if (b.status !== 'confirmed') {
      const doConfirm = await confirmDialog({
        title: 'Konfirmasi Reservasi',
        message: `Tagihan ${b.booking_code} sudah cukup untuk check-in, tapi reservasi belum dikonfirmasi.\n\nKonfirmasi sekarang lalu lanjutkan check-in?`,
        confirmLabel: 'Konfirmasi & Check-In',
        cancelLabel: 'Nanti',
      });

      if (!doConfirm) return;

      try {
        await api.post(`/api/v1/bookings/${b.id}/confirm`);
        toast.success(`Reservasi ${b.booking_code} dikonfirmasi.`);
        await fetchBookings();
        const updated = await reloadBooking(b);
        if (updated) openCheckInForm(updated);
      } catch (error: any) {
        console.error('Confirm booking failed', error);
        toast.apiError(error, 'Gagal mengonfirmasi reservasi.');
      }
      return;
    }

    // (4) Sudah confirmed -> langsung catat jaminan & check-in
    openCheckInForm(b);
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
      toast.success(
        `Kamar dialihkan ke Occupied dan Jaminan (${guaranteeType.toUpperCase()}) telah dicatat.`,
        { title: 'Check-In Berhasil' }
      );
    } catch (error: any) {
      console.error('Check-in error', error);
      toast.error(apiErrorMessage(error, 'Gagal memproses check-in.'), { title: 'Check-In Gagal' });
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
        type: payType,
        notes: payType === 'dp'
          ? 'Uang muka (DP) diterima di meja resepsionis'
          : 'Pembayaran langsung di meja resepsionis',
      });
      setIsPayModalOpen(false);
      await fetchBookings();
      toast.success(payType === 'dp' ? 'DP diterima.' : 'Pembayaran berhasil dicatat.');
    } catch (error: any) {
      console.error('Payment error', error);
      toast.error(apiErrorMessage(error, 'Gagal menyimpan pembayaran.'), { title: 'Pembayaran Gagal' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Check-Out
  const handleProcessCheckOut = async (b: Booking) => {
    // Pembayaran manual yang belum diverifikasi dianggap belum lunas oleh backend.
    // Tahan di sini dengan pesan yang jelas daripada check-out gagal tanpa sebab.
    if (blockedByPendingPayment(b)) {
      toast.warning(
        `Pembayaran ${b.booking_code} masih menunggu verifikasi admin.`,
        { title: 'Menunggu Verifikasi' }
      );
      return;
    }

    // 1. Cek apakah tagihan sudah lunas sebelum checkout
    const sisa = calculateRemaining(b);

    if (sisa > 0) {
      const payNow = await confirmDialog({
        title: 'Pelunasan Tagihan',
        message: `Sisa tagihan: ${formatIDR(sisa)}. Proses pelunasan sekarang?`,
        confirmLabel: 'Pelunasan',
        cancelLabel: 'Batal',
      });
      if (payNow) {
        openPaymentModal(b, sisa);
      }
      return;
    }

    // 2. Ambil info jaminan yang tersimpan
    const existingGuarantees = JSON.parse(localStorage.getItem('aedo_hotel_guarantees') || '{}');
    const guarantee = existingGuarantees[b.id];
    let guaranteeMsg = '';
    if (guarantee) {
      guaranteeMsg = `\nPengembalian Jaminan: ${guarantee.type?.toUpperCase()} (${formatIDR(guarantee.deposit || 0)})`;
    }

    const proceed = await confirmDialog({
      title: 'Konfirmasi Check-Out',
      message: `Selesaikan check-out untuk ${b.customer?.name} (${b.booking_code})?${guaranteeMsg}`,
      confirmLabel: 'Check-Out',
      cancelLabel: 'Batal',
    });

    if (!proceed) {
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
      toast.success('Kamar dialihkan ke tim Housekeeping untuk dibersihkan.', {
        title: 'Check-Out Sukses',
        duration: 8000,
      });
    } catch (error: any) {
      console.error('Check-out error', error);
      toast.error(apiErrorMessage(error, 'Gagal check out.'), { title: 'Check-Out Gagal' });
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
        const state = paymentState(b);

        const tone = state.tone === 'lunas'
          ? { bg: 'rgba(34, 197, 94, 0.15)', fg: '#15803d', border: 'rgba(34, 197, 94, 0.3)' }
          : state.tone === 'pending'
            ? { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', border: 'rgba(154, 100, 16, 0.25)' }
            : state.tone === 'unknown'
              ? { bg: 'var(--ink-100)', fg: 'var(--ink-500)', border: 'var(--border)' }
              : { bg: 'rgba(239, 68, 68, 0.15)', fg: '#b91c1c', border: 'rgba(239, 68, 68, 0.3)' };

        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: tone.bg,
              color: tone.fg,
              border: `1px solid ${tone.border}`,
            }}
          >
            ● {state.label}
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
                {b.status === 'confirmed'
                  ? 'Check-In'
                  : blockedByPendingPayment(b)
                    ? 'Menunggu Verifikasi'
                    : calculateRemaining(b) > 0
                      ? 'Bayar & Check-In'
                      : 'Konfirmasi & Check-In'}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="text-body-small">Tagihan:</span>
                <span className="text-body-strong">{formatIDR(calculateTotal(checkInTarget))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-body-small">Status Pembayaran:</span>
                <span
                  className="text-body-strong"
                  style={{
                    color: paymentState(checkInTarget).tone === 'lunas'
                      ? 'var(--success-600)'
                      : paymentState(checkInTarget).tone === 'pending'
                        ? 'var(--warning-fg)'
                        : '#b91c1c',
                  }}
                >
                  {paymentState(checkInTarget).label}
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
            <h2 className="text-h2 mb-2">{payType === 'dp' ? 'Terima DP' : 'Pembayaran Sebelum Check-In'}</h2>
            <p className="text-body-small text-ink-500 mb-4">
              Catat penerimaan untuk <strong>{payTarget.customer?.name}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="text-label mb-1" style={{ display: 'block' }}>Jenis Pembayaran:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="sm"
                    variant={payType === 'dp' ? 'primary' : 'secondary'}
                    onClick={() => choosePayType('dp')}
                  >
                    DP (uang muka)
                  </Button>
                  <Button
                    size="sm"
                    variant={payType === 'final' ? 'primary' : 'secondary'}
                    onClick={() => choosePayType('final')}
                  >
                    Pelunasan
                  </Button>
                </div>
                {dpShortfall(payTarget) > 0 && (
                  <p className="text-caption text-ink-500 mt-1">
                    DP minimum kurang {formatIDR(dpShortfall(payTarget))}.
                  </p>
                )}
              </div>

              <div>
                <label className="text-label mb-1" style={{ display: 'block' }}>Nominal Pembayaran (Rp):</label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <p className="text-caption text-ink-500 mt-1">
                  Sisa tagihan {formatIDR(calculateRemaining(payTarget))}.
                </p>
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
                {calculatePending(selectedBooking) > 0 && (
                  <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Menunggu Verifikasi</span>
                    <span className="text-body-strong" style={{ color: 'var(--warning-fg)' }}>
                      {formatIDR(calculatePending(selectedBooking))}
                    </span>
                  </div>
                )}
                {Number(selectedBooking.dp_min_amount ?? 0) > 0 && (
                  <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>DP Minimum</span>
                    <span
                      className="text-body-strong"
                      style={{ color: dpShortfall(selectedBooking) > 0 ? 'var(--warning-fg)' : '#15803d' }}
                    >
                      {formatIDR(Number(selectedBooking.dp_min_amount))}
                      {' \u00b7 '}
                      {dpShortfall(selectedBooking) > 0
                        ? `kurang ${formatIDR(dpShortfall(selectedBooking))}`
                        : 'terpenuhi'}
                    </span>
                  </div>
                )}
                <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                  <span>Sisa Tagihan</span>
                  <span
                    className="text-body-strong"
                    style={{
                      color: paymentState(selectedBooking).tone === 'lunas'
                        ? '#15803d'
                        : paymentState(selectedBooking).tone === 'pending'
                          ? 'var(--warning-fg)'
                          : '#b91c1c',
                    }}
                  >
                    {paymentState(selectedBooking).tone === 'lunas'
                      ? 'LUNAS'
                      : paymentState(selectedBooking).tone === 'pending'
                        ? 'Belum ada uang masuk'
                        : formatIDR(calculateRemaining(selectedBooking))}
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
