/* oxlint-disable react/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { formatIDR, formatDateShort } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { PaymentStatus, PaymentMethod } from '../../types';
import './PaymentList.css';

interface Payment {
  id: number;
  payment_code: string;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  proof_of_payment?: string | null;
  created_at: string;
  booking: {
    booking_code: string;
    customer: { name: string };
  };
}

type ConfirmAction = { type: 'verify' | 'reject'; payment: Payment } | null;

export default function PaymentList() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState('');

  // Reversal state
  const [reverseTarget, setReverseTarget] = useState<Payment | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseError, setReverseError] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const [proofTarget, setProofTarget] = useState<Payment | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const requestSeq = useRef(0);

  useEffect(() => {
    const handler = setTimeout(() => fetchPayments(true), 300);
    return () => clearTimeout(handler);
  }, [search, statusFilter]);

  const fetchPayments = async (showLoading = true) => {
    const requestId = ++requestSeq.current;
    try {
      if (showLoading) setIsLoading(true);

      const params = new URLSearchParams({ per_page: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const response = await api.get(`/api/v1/payments?${params.toString()}`);
      if (requestId !== requestSeq.current) return;

      const rawList = response.data?.data || [];
      const mapped = rawList.map((p: any) => ({
        id: p.id,
        payment_code: p.reference_number || `PAY-${p.id}`,
        amount: Number(p.amount) || 0,
        payment_method: p.method?.value || p.method || 'cash',
        status: p.status?.value || p.status || 'verified',
        proof_of_payment: p.proof_of_payment || null,
        created_at: p.paid_at || p.created_at || new Date().toISOString(),
        booking: {
          booking_code: p.booking?.booking_code || `BK-${p.booking_id || p.id}`,
          customer: { name: p.booking?.customer?.name || 'Tamu' },
        },
      }));
      setPayments(mapped);
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      console.error('Failed to fetch payments', error);
      if (showLoading) {
        setPayments([]);
        toast.error('Gagal memuat daftar pembayaran.');
      }
    } finally {
      if (requestId === requestSeq.current && showLoading) setIsLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setIsActing(true);
    setActionError('');
    try {
      const endpoint = confirmAction.type === 'verify'
        ? `/api/v1/payments/${confirmAction.payment.id}/verify`
        : `/api/v1/payments/${confirmAction.payment.id}/reject`;
      await api.patch(endpoint, confirmAction.type === 'reject' ? { reason: 'Ditolak via dashboard' } : {});
      const actionType = confirmAction.type;
      setConfirmAction(null);
      await fetchPayments();
      toast.success(
        actionType === 'verify' ? 'Pembayaran berhasil diverifikasi.' : 'Pembayaran ditolak.'
      );
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.response?.data?.message || 'Gagal memproses pembayaran.');
    } finally {
      setIsActing(false);
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) return;

    if (!reverseReason.trim()) {
      setReverseError('Alasan pembatalan wajib diisi.');
      return;
    }

    setIsReversing(true);
    setReverseError('');
    try {
      await api.post(`/api/v1/payments/${reverseTarget.id}/reverse`, { reason: reverseReason.trim() });
      setReverseTarget(null);
      setReverseReason('');
      toast.success('Pembayaran berhasil dibatalkan.');
      await fetchPayments();
    } catch (error: any) {
      setReverseError(apiErrorMessage(error, 'Gagal membatalkan pembayaran.'));
    } finally {
      setIsReversing(false);
    }
  };

  const handleProofChange = (file: File | undefined) => {
    setProofError('');
    if (!file) {
      setProofFile(null);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setProofFile(null);
      setProofError('Format file harus JPEG, JPG, atau PNG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProofFile(null);
      setProofError('Ukuran file maksimal 5 MB.');
      return;
    }

    setProofFile(file);
  };

  const openProofModal = (payment: Payment) => {
    setProofTarget(payment);
    setProofFile(null);
    setProofError('');
  };

  const closeProofModal = () => {
    if (isUploading) return;
    setProofTarget(null);
    setProofFile(null);
    setProofError('');
  };

  const handleProofUpload = async () => {
    if (!proofTarget || !proofFile) {
      setProofError('Pilih file bukti pembayaran terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setProofError('');
    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      await api.post(`/api/v1/payments/${proofTarget.id}/proof`, formData);
      closeProofModal();
      await fetchPayments();
      toast.success('Bukti pembayaran berhasil diunggah.');
    } catch (error) {
      setProofError(apiErrorMessage(error, 'Gagal mengunggah bukti pembayaran.'));
    } finally {
      setIsUploading(false);
    }
  };

  const formatMethod = (method: string) => {
    const map: Record<string, string> = {
      'cash': 'Tunai',
      'transfer': 'Transfer Bank',
      'credit_card': 'Kartu Kredit',
      'qris': 'QRIS',
    };
    return map[method] || method;
  };

  const columns: Column<Payment>[] = [
    { key: 'code', header: 'No. Pembayaran', cell: (p) => <span className="text-body-strong">{p.payment_code}</span> },
    { key: 'booking', header: 'Reservasi', cell: (p) => (
      <div>
        <div className="text-body-strong">{p.booking.booking_code}</div>
        <div className="text-body-small text-ink-500">{p.booking.customer.name}</div>
      </div>
    ) },
    { key: 'method', header: 'Metode', cell: (p) => formatMethod(p.payment_method) },
    { key: 'amount', header: 'Nominal', cell: (p) => formatIDR(p.amount), align: 'right' },
    { key: 'date', header: 'Waktu', cell: (p) => formatDateShort(p.created_at) },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge type="payment_status" value={p.status} /> },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      cell: (p: Payment) => {
        if (p.payment_method !== 'cash' && p.status !== 'failed' && !(p.status === 'pending' && isAdmin) && !(p.status === 'verified' && isAdmin)) {
          return (
            <Button size="sm" variant="ghost" onClick={() => openProofModal(p)}>
              {p.proof_of_payment ? 'Upload Ulang' : 'Upload Bukti'}
            </Button>
          );
        }

        if (p.status === 'pending' && isAdmin) {
          return (
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
              <Button size="sm" variant="primary" onClick={() => { setConfirmAction({ type: 'verify', payment: p }); setActionError(''); }}>
                Verifikasi
              </Button>
              <Button size="sm" variant="danger" onClick={() => { setConfirmAction({ type: 'reject', payment: p }); setActionError(''); }}>
                Tolak
              </Button>
            </div>
          );
        }

        if (p.status === 'verified' && isAdmin) {
          return (
            <Button size="sm" variant="ghost" onClick={() => { setReverseTarget(p); setReverseError(''); setReverseReason(''); }}>
              Batalkan
            </Button>
          );
        }

        return <span className="text-caption">—</span>;
      },
    },
  ];

  const tabOptions = [
    { label: 'Semua', value: 'all' },
    { label: 'Menunggu', value: 'pending' },
    { label: 'Berhasil', value: 'verified' },
    { label: 'Gagal', value: 'failed' },
  ];

  return (
    <div className="payment-list-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="text-h1">Daftar Pembayaran</h1>
          <p className="text-body-small text-ink-500" style={{ marginTop: '2px' }}>
            Riwayat pembayaran tunai, transfer, dan QRIS.
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button onClick={() => navigate('/payments/new')}>
            Catat Pembayaran
          </Button>
        </div>
      </div>

      <div className="payment-filters">
        <Tabs options={tabOptions} value={statusFilter} onChange={setStatusFilter} />
        <div className="search-wrapper">
          <Input 
            placeholder="Cari kode, nama tamu..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table 
        columns={columns} 
        data={payments} 
        keyExtractor={(p) => p.id} 
        isLoading={isLoading} 
      />

      {/* Modal Verifikasi / Tolak Manual */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => { setConfirmAction(null); setActionError(''); }}
        title={confirmAction?.type === 'verify' ? 'Verifikasi Pembayaran' : 'Tolak Pembayaran'}
        maxWidth="420px"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setConfirmAction(null); setActionError(''); }}>Batal</Button>
            <Button
              variant={confirmAction?.type === 'reject' ? 'danger' : 'primary'}
              onClick={handleConfirmAction}
              isLoading={isActing}
            >
              {confirmAction?.type === 'verify' ? 'Verifikasi' : 'Tolak'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {actionError && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
              {actionError}
            </div>
          )}
          <p className="text-body">
            {confirmAction?.type === 'verify'
              ? <>Konfirmasi pembayaran sebesar <strong>{confirmAction ? formatIDR(confirmAction.payment.amount) : ''}</strong> untuk reservasi <strong>{confirmAction?.payment.booking.booking_code}</strong>?</>
              : <>Tolak pembayaran sebesar <strong>{confirmAction ? formatIDR(confirmAction.payment.amount) : ''}</strong> untuk reservasi <strong>{confirmAction?.payment.booking.booking_code}</strong>?</>
            }
          </p>
        </div>
      </Modal>

      {/* Modal Batalkan Pembayaran (Reversal) */}
      <Modal
        isOpen={!!reverseTarget}
        onClose={() => { setReverseTarget(null); setReverseError(''); }}
        title="Batalkan Pembayaran"
        maxWidth="460px"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setReverseTarget(null); setReverseError(''); }}>Batal</Button>
            <Button variant="danger" onClick={handleReverse} isLoading={isReversing}>Batalkan</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p className="text-body">
            Batalkan pembayaran <strong>{reverseTarget ? formatIDR(reverseTarget.amount) : ''}</strong> untuk reservasi <strong>{reverseTarget?.booking.booking_code}</strong>?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Alasan Pembatalan</label>
            <textarea
              style={{ width: '100%', minHeight: '84px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-control)', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical' }}
              placeholder="Contoh: Dana belum masuk mutasi bank"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </div>
          {reverseError && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
              {reverseError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!proofTarget}
        onClose={closeProofModal}
        title={proofTarget?.proof_of_payment ? 'Upload Ulang Bukti Pembayaran' : 'Upload Bukti Pembayaran'}
        maxWidth="520px"
        footer={
          <>
            <Button variant="ghost" onClick={closeProofModal} disabled={isUploading}>Batal</Button>
            <Button variant="primary" onClick={handleProofUpload} isLoading={isUploading} loadingText="Mengunggah..." disabled={!proofFile}>
              Unggah Bukti
            </Button>
          </>
        }
      >
        <FileDropzone
          value={proofFile}
          onChange={handleProofChange}
          accept="image/jpeg,image/png"
          maxSizeMB={5}
          error={proofError}
        />
      </Modal>
    </div>
  );
}
