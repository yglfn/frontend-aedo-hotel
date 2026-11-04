/* oxlint-disable react/immutability, react-hooks/exhaustive-deps */
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
import { formatIDR, formatDateShort, maskKtp } from '../../lib/format';
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
  source?: string;
  notes?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  created_at?: string;
  created_by?: { id: number; name: string } | null;
  customer: { id: number; name: string; phone?: string; email?: string; ktp?: string };
  guest_count?: number;
  booking_guests?: Array<{ id: number; name: string; ktp?: string | null; is_primary?: boolean; booking_room_id?: number | null }>;
  assigned_rooms?: string[];
  booking_rooms?: Array<{
    id: number;
    check_in?: string;
    check_out?: string;
    nights?: number;
    price_per_night?: number | string;
    total_price?: number | string;
    room?: { id: number; room_number: string; room_type?: { id: number; name: string; price?: number | string; max_person?: number } | null };
  }>;
  booking_services?: Array<{
    id: number;
    quantity?: number;
    price_at_transaction?: number | string;
    total?: number | string;
    service?: { id: number; name: string; unit?: string } | null;
  }>;
  payments?: Array<{
    id: number;
    amount: number;
    method: string;
    type?: string;
    status: string;
    reference_number?: string | null;
    paid_at?: string | null;
    created_at?: string;
    created_by?: { id: number; name: string } | null;
    verified_by?: { id: number; name: string } | null;
  }>;
  invoice?: { id: number; status: string; total: string; invoice_number?: string; subtotal?: number | string; discount?: number | string; tax?: number | string };
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

/** Sumber reservasi -> label yang dibaca manusia. */
const SOURCE_LABEL: Record<string, string> = {
  walk_in: 'Walk-in',
  phone: 'Telepon',
  traveloka: 'Traveloka',
  other: 'Lainnya',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer Bank',
  qris: 'QRIS',
  credit_card: 'Kartu Kredit',
  payment_gateway: 'Payment Gateway',
};

/** KTP tidak perlu tampil utuh di layar ringkasan; pengaburannya sudah ada di lib/format. */
const tampilkanKtp = (ktp?: string | null) => (ktp ? maskKtp(ktp) : '-');

/** Alur reservasi menurut AGENTS.md: pending -> confirmed -> checked_in -> checked_out. */
const FLOW_LABELS = ['Reservasi', 'Konfirmasi', 'Check-In', 'Check-Out'];
const FLOW_STATUS: BookingStatus[] = ['pending', 'confirmed', 'checked_in', 'checked_out'];

/** Menandai langkah yang sudah dilewati. `cancelled` tidak menyalakan langkah apa pun. */
const flowStepsDone = (status: BookingStatus): boolean[] => {
  const index = FLOW_STATUS.indexOf(status);
  return FLOW_STATUS.map((_, step) => index >= 0 && step <= index);
};

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
  // Daftar mengirim relasi ringkas; detail diambil lewat GET /bookings/{id} agar kamar,
  // layanan, dan riwayat bayar benar-benar terbaca (bukan disalin dari baris tabel).
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Check-In Dialog (Jaminan)
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState<Booking | null>(null);
  const [guaranteeType, setGuaranteeType] = useState('ktp');
  const [guaranteeNote, setGuaranteeNote] = useState('');
  const [depositAmount, setDepositAmount] = useState('0');
  // Penghuni yang belum tercatat saat reservasi; wajib dilengkapi sebelum check-in.
  // room_id mengacu ke kamar fisik (room.id), bukan booking_room.
  const [extraGuests, setExtraGuests] = useState<Array<{ name: string; ktp: string; room_id: number | '' }>>([]);
  // Penempatan penghuni yang sudah bernama tapi belum punya kamar: id tamu -> id kamar fisik
  const [placements, setPlacements] = useState<Record<number, number>>({});

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

  /** Nomor kamar dari baris booking_room pada reservasi ini ('' bila belum ditempatkan). */
  const roomLabel = (b: Booking | null, bookingRoomId?: number | null) => {
    if (!b || !bookingRoomId) return '';
    return b.booking_rooms?.find((br) => br.id === bookingRoomId)?.room?.room_number || '';
  };

  /** Jumlah malam: pakai snapshot booking_room, fallback ke selisih tanggal header. */
  const nightsOf = (b: Booking) => {
    const snapshot = Number(b.booking_rooms?.[0]?.nights || 0);
    if (snapshot > 0) return snapshot;
    const diff = Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000);
    return diff > 0 ? diff : 1;
  };

  /** Subtotal kamar & layanan dibaca dari snapshot baris, bukan dihitung ulang di browser. */
  const roomSubtotal = (b: Booking) =>
    (b.booking_rooms || []).reduce((sum, br) => sum + (Number(br.total_price) || 0), 0);

  const serviceSubtotal = (b: Booking) =>
    (b.booking_services || []).reduce((sum, bs) => sum + (Number(bs.total) || 0), 0);

  /** Sisa yang masih boleh ditagih = total - verified - pending */
  const calculateRemaining = (b: Booking) => {
    if (typeof b.remaining_due === 'number') return b.remaining_due;
    return Math.max(0, calculateTotal(b) - calculatePaid(b) - calculatePending(b));
  };

  /** true bila ada pembayaran menunggu verifikasi admin -> jangan menagih lagi */
  const blockedByPendingPayment = (b: Booking) => {
    if (typeof b.blocks_manual_payment === 'boolean') return b.blocks_manual_payment;
    return (b.payments || []).some((p) => p.status === 'pending');
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

    // Siapkan baris kosong sebanyak penghuni yang belum punya nama
    const tercatat = (b.booking_guests || []).filter((g) => g.name).length;
    const kurang = Math.max(0, Number(b.guest_count || 0) - tercatat);
    setExtraGuests(Array.from({ length: kurang }, () => ({ name: '', ktp: '', room_id: '' })));
    setPlacements({});

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

  /** Buka drawer: tampilkan data tabel seketika, lalu timpa dengan detail lengkap dari server. */
  const openDetail = async (b: Booking) => {
    setSelectedBooking(b);
    setIsDrawerOpen(true);
    setIsDetailLoading(true);

    const fresh = await reloadBooking(b);
    if (fresh) setSelectedBooking(fresh);
    setIsDetailLoading(false);
  };

  /** Verifikasi pembayaran yang pending, langsung dari layar check-in (admin only) */
  const verifyPendingPayments = async (b: Booking): Promise<boolean> => {
    const pending = (b.payments || []).filter((p) => p.status === 'pending');

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

    // Cek lokal dulu supaya tidak bolak-balik ke server untuk data yang jelas kurang
    if (extraGuests.some((guest) => !guest.name.trim())) {
      toast.warning('Nama penghuni masih ada yang kosong. Isi semua baris atau perbaiki jumlah tamunya.');
      return;
    }

    const banyakKamar = (checkInTarget.booking_rooms || []).length > 1;
    const belumDitempatkan = (checkInTarget.booking_guests || []).filter((g) => !g.booking_room_id);

    if (belumDitempatkan.some((guest) => !placements[guest.id])) {
      toast.warning('Pilih kamar untuk setiap penghuni yang belum ditempatkan.');
      return;
    }
    if (banyakKamar && extraGuests.some((guest) => !guest.room_id)) {
      toast.warning('Reservasi multi-kamar: pilih kamar untuk setiap penghuni baru.');
      return;
    }

    // Penghuni baru + penempatan penghuni lama yang masih kosong (nama sama = tambal kamar)
    const penghuni = [
      ...extraGuests
        .filter((guest) => guest.name.trim())
        .map((guest) => ({
          name: guest.name.trim(),
          ktp: guest.ktp.trim() || undefined,
          room_id: guest.room_id || undefined,
        })),
      ...belumDitempatkan.map((guest) => ({
        name: guest.name,
        ktp: guest.ktp || undefined,
        room_id: placements[guest.id],
      })),
    ];

    setIsProcessing(true);
    try {
      // Panggil endpoint check-in backend (sekalian melengkapi data penghuni bila ada)
      await api.post(`/api/v1/bookings/${checkInTarget.id}/check-in`, penghuni.length ? { guests: penghuni } : {});
      
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
      cell: (b) => <span className="money-cell">{formatIDR(calculateTotal(b))}</span>,
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
              onClick={() => { void openDetail(b); }}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px', gap: '12px' }}>
                <span className="text-body-small">Tagihan:</span>
                <span className="money-total-sm">{formatIDR(calculateTotal(checkInTarget))}</span>
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
              {(checkInTarget.guest_count || 0) > 0 && (
                <div>
                  <label className="text-label mb-1" style={{ display: 'block' }}>
                    Penghuni Kamar ({(checkInTarget.booking_guests || []).length} dari {checkInTarget.guest_count} tercatat)
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: extraGuests.length ? '12px' : '0' }}>
                    {(checkInTarget.booking_guests || []).map((guest) => {
                      const room = roomLabel(checkInTarget, guest.booking_room_id);

                      if (room) {
                        return (
                          <div key={guest.id} className="detail-line">
                            <div className="detail-line-main">
                              <span className="text-body-strong">{guest.name}</span>
                              <span className="text-caption">{guest.is_primary ? 'Penanggung jawab' : 'Penghuni'}</span>
                            </div>
                            <span className="pill pill-room">Kamar {room}</span>
                          </div>
                        );
                      }

                      // Belum punya kamar: kasir memilih kamarnya sekarang
                      return (
                        <div key={guest.id} className="detail-line">
                          <div className="detail-line-main">
                            <span className="text-body-strong">{guest.name}</span>
                            <span className="text-caption">{guest.is_primary ? 'Penanggung jawab' : 'Penghuni'}</span>
                          </div>
                          <select
                            className="ui-select"
                            style={{ width: 170 }}
                            value={placements[guest.id] ?? ''}
                            onChange={(e) => setPlacements((prev) => ({ ...prev, [guest.id]: Number(e.target.value) }))}
                          >
                            <option value="">Pilih kamar</option>
                            {(checkInTarget.booking_rooms || []).map((br) => (
                              <option key={br.id} value={br.room?.id ?? ''}>Kamar {br.room?.room_number ?? '-'}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {extraGuests.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {extraGuests.map((guest, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.2fr', gap: '8px', alignItems: 'end' }}>
                          <Input
                            placeholder={`Nama penghuni ${index + 2}`}
                            value={guest.name}
                            onChange={(e) => setExtraGuests((prev) => prev.map((g, i) => (i === index ? { ...g, name: e.target.value } : g)))}
                          />
                          <Input
                            placeholder="No. KTP (opsional)"
                            value={guest.ktp}
                            onChange={(e) => setExtraGuests((prev) => prev.map((g, i) => (i === index ? { ...g, ktp: e.target.value } : g)))}
                          />
                          <div className="form-group">
                            <label className="text-label">Kamar</label>
                            <select
                              className="ui-select"
                              value={guest.room_id}
                              onChange={(e) => setExtraGuests((prev) => prev.map((g, i) => (
                                i === index ? { ...g, room_id: e.target.value ? Number(e.target.value) : '' } : g
                              )))}
                            >
                              <option value="">
                                {(checkInTarget.booking_rooms || []).length > 1 ? 'Pilih kamar' : 'Belum ditentukan'}
                              </option>
                              {(checkInTarget.booking_rooms || []).map((br) => (
                                <option key={br.id} value={br.room?.id ?? ''}>
                                  Kamar {br.room?.room_number ?? '-'}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                      <p className="text-caption">
                        Check-in ditolak sampai seluruh penghuni punya nama.
                      </p>
                    </div>
                  )}
                </div>
              )}

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
        width="680px"
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
              <div>
                <div className="detail-code">{selectedBooking.booking_code}</div>
                <div className="text-caption">
                  {SOURCE_LABEL[selectedBooking.source || ''] || selectedBooking.source || 'Sumber tidak tercatat'}
                  {selectedBooking.created_at ? ` · dibuat ${formatDateShort(selectedBooking.created_at)}` : ''}
                  {selectedBooking.created_by?.name ? ` oleh ${selectedBooking.created_by.name}` : ''}
                </div>
              </div>
              <div className="detail-header-badges">
                <StatusBadge type="booking" value={selectedBooking.status} />
                <span className={`pill ${paymentState(selectedBooking).tone === 'lunas'
                  ? 'pill-ok'
                  : paymentState(selectedBooking).tone === 'pending' ? 'pill-warn' : 'pill-bad'}`}>
                  {paymentState(selectedBooking).label}
                </span>
              </div>
            </div>

            {isDetailLoading && <p className="text-caption">Memuat detail lengkap dari server...</p>}

            <div className="detail-section">
              <h3 className="text-h3">Alur Reservasi</h3>
              <ol className="flow-steps">
                {FLOW_LABELS.map((label, i) => (
                  <li key={label} className={flowStepsDone(selectedBooking.status)[i] ? 'done' : ''}>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
              {selectedBooking.status === 'cancelled' && (
                <div className="callout callout-danger">
                  <span>
                    <span className="callout-judul">Reservasi dibatalkan</span>
                    <span className="callout-meta">
                      {selectedBooking.cancel_reason || 'Tanpa alasan tercatat'}
                      {selectedBooking.cancelled_at ? ` · ${formatDateShort(selectedBooking.cancelled_at)}` : ''}
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Jadwal Menginap</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="text-label">Check-in</span>
                  <span className="text-body-strong">{formatDateShort(selectedBooking.check_in)}</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">Check-out</span>
                  <span className="text-body-strong">{formatDateShort(selectedBooking.check_out)}</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">Durasi</span>
                  <span className="text-body-strong">{nightsOf(selectedBooking)} malam</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">Jumlah Tamu</span>
                  <span className="text-body-strong">
                    {selectedBooking.guest_count ?? '-'} orang
                    <span className="text-caption">{' · '}{(selectedBooking.booking_guests || []).length} bernama</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Tamu &amp; Kontak</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="text-label">Penanggung Jawab</span>
                  <span className="text-body-strong">{selectedBooking.customer?.name || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">No. Telepon</span>
                  <span className="text-body-strong">{selectedBooking.customer?.phone || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">Email</span>
                  <span className="text-body-strong">{selectedBooking.customer?.email || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="text-label">No. KTP</span>
                  <span className="text-body-strong">{tampilkanKtp(selectedBooking.customer?.ktp)}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Penghuni &amp; Penempatan Kamar</h3>
              {(selectedBooking.booking_guests || []).length > 0 ? (
                <div className="detail-lines">
                  {(selectedBooking.booking_guests || []).map((guest) => {
                    const room = roomLabel(selectedBooking, guest.booking_room_id);
                    return (
                      <div key={guest.id} className="detail-line">
                        <div className="detail-line-main">
                          <span className="text-body-strong">{guest.name}</span>
                          <span className="text-caption">KTP {tampilkanKtp(guest.ktp)}</span>
                        </div>
                        <span className={`pill ${room ? 'pill-room' : 'pill-warn'}`}>
                          {room ? `Kamar ${room}` : (guest.is_primary ? 'Penanggung jawab' : 'Belum ditempatkan')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-caption">Belum ada data penghuni tercatat.</p>
              )}

              {(selectedBooking.guest_count || 0) > (selectedBooking.booking_guests || []).length && (
                <div className="callout callout-info">
                  <span>
                    <span className="callout-judul">
                      Baru {(selectedBooking.booking_guests || []).length} dari {selectedBooking.guest_count} penghuni bernama
                    </span>
                    <span className="callout-meta">Check-in ditolak sampai nama seluruh penghuni diisi.</span>
                  </span>
                </div>
              )}
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Kamar Dipesan ({(selectedBooking.booking_rooms || []).length})</h3>
              {(selectedBooking.booking_rooms || []).length > 0 ? (
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Kamar</th><th>Tipe</th><th>Malam</th><th className="num">Harga / malam</th><th className="num">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBooking.booking_rooms || []).map((br) => (
                      <tr key={br.id}>
                        <td className="text-body-strong">{br.room?.room_number || '-'}</td>
                        <td>{br.room?.room_type?.name || '-'}</td>
                        <td>{br.nights ?? nightsOf(selectedBooking)}</td>
                        <td className="num">{formatIDR(Number(br.price_per_night) || 0)}</td>
                        <td className="num">{formatIDR(Number(br.total_price) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Subtotal kamar</td>
                      <td className="num">{formatIDR(roomSubtotal(selectedBooking))}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="text-caption">Rincian kamar belum termuat — tutup dan buka lagi detail ini.</p>
              )}
            </div>

            <div className="detail-section">
              <h3 className="text-h3">Layanan Tambahan</h3>
              {(selectedBooking.booking_services || []).length > 0 ? (
                <table className="detail-table">
                  <thead>
                    <tr><th>Layanan</th><th>Qty</th><th className="num">Harga</th><th className="num">Total</th></tr>
                  </thead>
                  <tbody>
                    {(selectedBooking.booking_services || []).map((bs) => (
                      <tr key={bs.id}>
                        <td className="text-body-strong">{bs.service?.name || 'Layanan terhapus'}</td>
                        <td>{bs.quantity ?? '-'}</td>
                        <td className="num">{formatIDR(Number(bs.price_at_transaction) || 0)}</td>
                        <td className="num">{formatIDR(Number(bs.total) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Subtotal layanan</td>
                      <td className="num">{formatIDR(serviceSubtotal(selectedBooking))}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="text-caption">Tidak ada layanan tambahan pada reservasi ini.</p>
              )}
            </div>

            {selectedBooking.notes && (
              <div className="detail-section">
                <h3 className="text-h3">Catatan Reservasi</h3>
                <p className="text-body">{selectedBooking.notes}</p>
              </div>
            )}

            <div className="detail-section">
              <h3 className="text-h3">Ringkasan Tagihan & Pembayaran</h3>
              <div className="invoice-summary mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <span>Total Tagihan (termasuk pajak)</span>
                  <span className="money-total-sm">{formatIDR(calculateTotal(selectedBooking))}</span>
                </div>
                <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sudah Dibayar (Verified)</span>
                  <span className="text-body-strong" style={{ color: 'var(--success-fg)' }}>{formatIDR(calculatePaid(selectedBooking))}</span>
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
                <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', borderTop: '1px solid var(--line)', marginTop: '4px', paddingTop: '10px' }}>
                  <span className="money-label">Sisa Tagihan</span>
                  <span
                    className={`money-total-sm ${paymentState(selectedBooking).tone === 'lunas'
                      ? 'money-paid'
                      : paymentState(selectedBooking).tone === 'pending'
                        ? 'money-pending'
                        : 'money-due'}`}
                  >
                    {paymentState(selectedBooking).tone === 'lunas'
                      ? 'LUNAS'
                      : formatIDR(calculateRemaining(selectedBooking))}
                  </span>
                </div>
              </div>
            </div>

            {selectedBooking.invoice && (
              <div className="detail-section">
                <h3 className="text-h3">Rincian Tagihan</h3>
                <div className="invoice-summary" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="invoice-row">
                    <span>Subtotal ( kamar + layanan )</span>
                    <span className="text-body-strong">{formatIDR(Number(selectedBooking.invoice.subtotal) || (roomSubtotal(selectedBooking) + serviceSubtotal(selectedBooking)))}</span>
                  </div>
                  {Number(selectedBooking.invoice.discount) > 0 && (
                    <div className="invoice-row">
                      <span>Diskon</span>
                      <span className="text-body-strong">- {formatIDR(Number(selectedBooking.invoice.discount))}</span>
                    </div>
                  )}
                  {Number(selectedBooking.invoice.tax) > 0 && (
                    <div className="invoice-row">
                      <span>Pajak</span>
                      <span className="text-body-strong">{formatIDR(Number(selectedBooking.invoice.tax))}</span>
                    </div>
                  )}
                  <div className="invoice-row">
                    <span>Tagihan (invoice)</span>
                    <span className="text-body-strong">{formatIDR(Number(selectedBooking.invoice.total) || 0)}</span>
                  </div>
                  <div className="invoice-row">
                    <span>Nomor Invoice</span>
                    <span className="text-body-strong">
                      {selectedBooking.invoice.invoice_number || '-'}
                      <span className="text-caption">{' · '}{selectedBooking.invoice.status}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="detail-section">
              <h3 className="text-h3">Riwayat Pembayaran ({(selectedBooking.payments || []).length})</h3>
              {(selectedBooking.payments || []).length > 0 ? (
                <>
                  <table className="detail-table">
                    <thead>
                      <tr><th>Tanggal</th><th>Metode</th><th>Status</th><th className="num">Nominal</th></tr>
                    </thead>
                    <tbody>
                      {(selectedBooking.payments || []).map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="text-body-strong">{formatDateShort(p.paid_at || p.created_at || selectedBooking.created_at || '')}</span>
                            <div className="text-caption">
                              {(p.reference_number || `PAY-${p.id}`)}
                              {p.type ? ` · ${p.type === 'dp' ? 'uang muka' : p.type === 'final' ? 'pelunasan' : p.type}` : ''}
                            </div>
                            {(p.created_by?.name || p.verified_by?.name) && (
                              <div className="text-caption">
                                {p.created_by?.name ? `dicatat ${p.created_by.name}` : ''}
                                {p.verified_by?.name ? ` · diverifikasi ${p.verified_by.name}` : ''}
                              </div>
                            )}
                          </td>
                          <td>{METHOD_LABEL[p.method] || p.method}</td>
                          <td>
                            <StatusBadge type="payment_status" value={p.status} />
                          </td>
                          <td className="num">{formatIDR(Number(p.amount) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-caption">
                    Tercatat verified {formatIDR(calculatePaid(selectedBooking))}
                    {calculatePending(selectedBooking) > 0 ? ` · menunggu verifikasi ${formatIDR(calculatePending(selectedBooking))}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-caption">Belum ada pembayaran tercatat untuk reservasi ini.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
