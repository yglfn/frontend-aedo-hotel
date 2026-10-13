import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
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
  created_at: string;
  booking: {
    booking_code: string;
    customer: { name: string };
  };
}

// Modal confirm state type
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

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/reports/transactions');
      const rawList = response.data?.data?.payments || response.data?.data || [];
      const mapped = rawList.map((p: any) => ({
        id: p.id,
        payment_code: p.reference_number || `PAY-${p.id}`,
        amount: Number(p.amount) || 0,
        payment_method: p.method?.value || p.method || 'cash',
        status: p.status?.value || p.status || 'verified',
        created_at: p.paid_at || p.created_at || new Date().toISOString(),
        booking: {
          booking_code: p.booking?.booking_code || `BK-${p.booking_id || p.id}`,
          customer: { name: p.booking?.customer?.name || 'Tamu' },
        },
      }));
      // Filter by status tab
      const filtered = statusFilter === 'all'
        ? mapped
        : mapped.filter((p: Payment) => p.status === statusFilter);
      setPayments(filtered);
    } catch (error) {
      console.error('Failed to fetch payments', error);
      setPayments([]);
    } finally {
      setIsLoading(false);
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
      setConfirmAction(null);
      await fetchPayments();
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.response?.data?.message || 'Gagal memproses aksi pembayaran.');
    } finally {
      setIsActing(false);
    }
  };

  const filteredPayments = payments.filter(p => 
    p.payment_code.toLowerCase().includes(search.toLowerCase()) ||
    p.booking.booking_code.toLowerCase().includes(search.toLowerCase()) ||
    p.booking.customer.name.toLowerCase().includes(search.toLowerCase())
  );

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
    { key: 'code', header: 'Kode Pembayaran', cell: (p) => <span className="text-body-strong">{p.payment_code}</span> },
    { key: 'booking', header: 'Reservasi', cell: (p) => (
      <div>
        <div className="text-body-strong">{p.booking.booking_code}</div>
        <div className="text-body-small text-ink-500">{p.booking.customer.name}</div>
      </div>
    ) },
    { key: 'method', header: 'Metode', cell: (p) => formatMethod(p.payment_method) },
    { key: 'amount', header: 'Jumlah', cell: (p) => formatIDR(p.amount), align: 'right' },
    { key: 'date', header: 'Tanggal', cell: (p) => formatDateShort(p.created_at) },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge type="payment_status" value={p.status} /> },
    // Aksi khusus untuk payment pending & user adalah admin
    ...(isAdmin ? [{
      key: 'action' as const,
      header: 'Aksi',
      align: 'right' as const,
      cell: (p: Payment) => p.status === 'pending' ? (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          <Button size="sm" variant="primary" onClick={() => { setConfirmAction({ type: 'verify', payment: p }); setActionError(''); }}>
            Verifikasi
          </Button>
          <Button size="sm" variant="danger" onClick={() => { setConfirmAction({ type: 'reject', payment: p }); setActionError(''); }}>
            Tolak
          </Button>
        </div>
      ) : <span style={{ color: 'var(--ink-300)', fontSize: '12px' }}>—</span>,
    }] : []),
  ];

  const tabOptions = [
    { label: 'Semua', value: 'all' },
    { label: 'Menunggu', value: 'pending' },
    { label: 'Berhasil', value: 'verified' },
    { label: 'Gagal', value: 'failed' },
  ];

  return (
    <div className="payment-list-page">
      <div className="page-header">
        <h1 className="text-h1">Daftar Pembayaran</h1>
        <div className="page-actions">
          <Button onClick={() => navigate('/payments/new')}>Catat Pembayaran</Button>
        </div>
      </div>

      <div className="payment-filters">
        <Tabs options={tabOptions} value={statusFilter} onChange={setStatusFilter} />
        <div className="search-wrapper">
          <Input 
            placeholder="Cari referensi atau nama..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table 
        columns={columns} 
        data={filteredPayments} 
        keyExtractor={(p) => p.id} 
        isLoading={isLoading} 
      />

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
              {confirmAction?.type === 'verify' ? 'Ya, Verifikasi' : 'Ya, Tolak'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {actionError && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
              {actionError}
            </div>
          )}
          <p className="text-body">
            {confirmAction?.type === 'verify'
              ? <>Konfirmasi bahwa pembayaran <strong>{confirmAction ? formatIDR(confirmAction.payment.amount) : ''}</strong> untuk reservasi <strong>{confirmAction?.payment.booking.booking_code}</strong> telah diterima?</>
              : <>Tolak pembayaran <strong>{confirmAction ? formatIDR(confirmAction.payment.amount) : ''}</strong> untuk reservasi <strong>{confirmAction?.payment.booking.booking_code}</strong>? Pembayaran akan ditandai <strong>gagal</strong> dan staf dapat mencatat pembayaran ulang.</>
            }
          </p>
        </div>
      </Modal>
    </div>
  );
}
