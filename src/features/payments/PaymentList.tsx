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
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { formatIDR, formatDateShort } from '../../lib/format';
import { openMidtransPayment, snapResultTransactionId } from '../../lib/midtransSnap';
import { syncPendingGatewayPayments } from '../../lib/gatewaySync';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, ExternalLink } from 'lucide-react';
import type { PaymentStatus, PaymentMethod } from '../../types';
import './PaymentList.css';

interface Payment {
  id: number;
  payment_code: string;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  created_at: string;
  gateway_transaction_id?: string | null;
  provider?: string | null;
  gateway_token?: string | null;
  client_key?: string | null;
  snap_js_url?: string | null;
  redirect_url?: string | null;
  gateway_payload?: any;
  booking: {
    booking_code: string;
    customer: { name: string };
  };
}

type ConfirmAction = { type: 'verify' | 'reject'; payment: Payment } | null;

export default function PaymentList() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const { isAdmin, hotelSettings } = useAuth();

  const isSandboxMode = ['simulator', 'sandbox'].includes(
    String(hotelSettings?.payment_gateway_provider || '').toLowerCase()
  );

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState('');

  // Single payment sync & open
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  // Reversal state
  const [reverseTarget, setReverseTarget] = useState<Payment | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseError, setReverseError] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const requestSeq = useRef(0);

  useEffect(() => {
    const handler = setTimeout(() => fetchPayments(true), 300);
    return () => clearTimeout(handler);
  }, [search, statusFilter]);

  // Polling otomatis selama ada pembayaran gateway pending: bukan cuma baca ulang database,
  // tapi minta backend menanya ulang status sebenarnya ke gateway (dibatasi jeda di
  // lib/gatewaySync + throttle di server). Di sinilah "settlement di Midtrans" jadi kelihatan.
  useEffect(() => {
    const hasPendingGateway = payments.some(
      (p) => p.status === 'pending' && (p.payment_method === 'payment_gateway' || p.payment_method === 'qris')
    );
    if (!hasPendingGateway) return;

    const timer = setInterval(() => {
      void fetchPayments(false);
    }, 4000);

    return () => clearInterval(timer);
  }, [payments, statusFilter, search]);

  const fetchPayments = async (showLoading = true) => {
    const requestId = ++requestSeq.current;
    try {
      if (showLoading) setIsLoading(true);

      // Pulihkan status yang sebenarnya dari gateway dulu (dijeda), lalu baca database.
      await syncPendingGatewayPayments();

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
        created_at: p.paid_at || p.created_at || new Date().toISOString(),
        gateway_transaction_id: p.gateway_transaction_id || null,
        provider: p.provider || null,
        gateway_payload: p.gateway_payload || null,
        gateway_token: p.gateway_token || p.gateway_payload?.token || null,
        client_key: p.client_key || p.gateway_payload?.client_key || null,
        snap_js_url: p.snap_js_url || p.gateway_payload?.snap_js_url || null,
        redirect_url: p.redirect_url || p.gateway_payload?.redirect_url || null,
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

  /** Sinkronkan semua transaksi gateway pending sekaligus */
  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await api.post('/api/v1/payments/sync-pending');
      const changed = Number(res.data?.changed || 0);
      if (changed > 0) {
        toast.success(`${changed} status pembayaran berhasil diperbarui.`, { title: 'Sinkronisasi Selesai' });
      } else {
        toast.info('Semua status sudah sesuai.', { title: 'Sinkronisasi Gateway' });
      }
      await fetchPayments();
    } catch (err: any) {
      toast.apiError(err, 'Gagal menyinkronkan status gateway.');
    } finally {
      setIsSyncingAll(false);
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

  const handleSandboxPay = async (p: Payment) => {
    if (!p.gateway_transaction_id) return;
    setPayingId(p.id);
    try {
      const res = await api.post(`/api/v1/sandbox/gateway/${p.gateway_transaction_id}/pay`);
      if (res.data?.webhook_status === 'processed') {
        toast.success('Sandbox: pembayaran terverifikasi.');
      } else {
        toast.warning(res.data?.message || 'Gagal memproses sandbox.');
      }
      await fetchPayments();
    } catch (error: any) {
      toast.apiError(error, 'Gagal memproses sandbox.');
    } finally {
      setPayingId(null);
    }
  };

  /**
   * Tanya status satu pembayaran ke gateway. `providerRef` opsional: transaction_id yang
   * dibawa Snap / redirect Midtrans. Bukan tombol manual - handler Snap JS yang mengirimnya.
   */
  const handleSync = async (p: Payment, providerRef?: string | null) => {
    setSyncingId(p.id);
    try {
      const res = await api.post(`/api/v1/payments/${p.id}/sync`, providerRef ? { transaction_id: providerRef } : {});
      if (res.data?.payment_status === 'verified') {
        toast.success('Gateway mengonfirmasi lunas.');
      } else {
        toast.info(res.data?.message || 'Belum ada konfirmasi dari gateway.');
      }
      await fetchPayments();
    } catch (error: any) {
      toast.apiError(error, 'Gagal mengecek status ke gateway.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleOpenPayment = async (p: Payment) => {
    setOpeningId(p.id);
    try {
      const token = p.gateway_token || p.gateway_payload?.token;
      const clientKey = p.client_key || p.gateway_payload?.client_key;
      const snapJsUrl = p.snap_js_url || p.gateway_payload?.snap_js_url;
      const redirectUrl = p.redirect_url || p.gateway_payload?.redirect_url;

      const outcome = await openMidtransPayment(
        {
          token,
          client_key: clientKey,
          snap_js_url: snapJsUrl,
          redirect_url: redirectUrl,
        },
        {
          // Snap JS menyerahkan hasil transaksinya; dari situ kita ambil transaction_id Midtrans
          // lalu langsung sinkronkan - otomatis, tanpa ada yang mengetik order id.
          onSuccess: (result) => void handleSync(p, snapResultTransactionId(result)),
          onPending: (result) => void handleSync(p, snapResultTransactionId(result)),
          onError: () => void handleSync(p),
          onClose: () => void handleSync(p),
        }
      );

      if (outcome.result === 'blocked') {
        toast.warning('Popup diblokir - izinkan lalu coba lagi.');
      } else if (outcome.result === 'nothing') {
        toast.error('Tautan pembayaran tidak ditemukan.');
      }
    } catch (error: any) {
      toast.apiError(error, 'Gagal membuka pembayaran.');
    } finally {
      setOpeningId(null);
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

  const formatMethod = (method: string) => {
    const map: Record<string, string> = {
      'cash': 'Tunai',
      'transfer': 'Transfer Bank',
      'credit_card': 'Kartu Kredit',
      'qris': 'QRIS',
      'payment_gateway': 'Payment Gateway',
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
        const isGateway = p.payment_method === 'payment_gateway';

        if (p.status === 'pending' && isGateway) {
          const hasLink = Boolean(p.gateway_token || p.redirect_url || p.gateway_payload?.redirect_url);
          return (
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {isSandboxMode && p.gateway_transaction_id && (
                <Button size="sm" variant="ghost" isLoading={payingId === p.id} onClick={() => handleSandboxPay(p)}>
                  Bayar Sandbox
                </Button>
              )}
              {hasLink && (
                <Button size="sm" variant="primary" isLoading={openingId === p.id} onClick={() => void handleOpenPayment(p)}>
                  <ExternalLink size={13} style={{ marginRight: '4px' }} /> Bayar
                </Button>
              )}
              <Button size="sm" variant="secondary" isLoading={syncingId === p.id} onClick={() => handleSync(p)}>
                <RefreshCw size={13} style={{ marginRight: '4px' }} /> Cek Status
              </Button>
            </div>
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
            Riwayat pembayaran tunai, transfer, QRIS, dan payment gateway.
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button variant="secondary" onClick={handleSyncAll} isLoading={isSyncingAll} title="Tarik pembaruan status settlement dari payment gateway">
            <RefreshCw size={14} style={{ marginRight: '6px' }} /> Sinkronkan Gateway
          </Button>
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
    </div>
  );
}
