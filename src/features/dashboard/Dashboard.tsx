import { useState, useEffect } from 'react';
import { 
  LogIn, 
  LogOut, 
  CalendarPlus, 
  UserCheck, 
  UserMinus, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Building
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { KpiCard } from '../../components/ui/KpiCard';
import { ShortcutTile } from '../../components/ui/ShortcutTile';
import { HighlightCard } from '../../components/ui/HighlightCard';
import { Card } from '../../components/ui/Card';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '../../lib/api';
import { formatIDR, formatDateShort } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

interface DashboardData {
  rooms?: {
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
    total: number;
    occupancy: number;
  };
  today?: {
    arrivals: number;
    departures: number;
  };
  finance?: {
    revenue_today: number;
    revenue_month: number;
    pending_payments_count: number;
    pending_payments_amount: number;
  };
  shift?: {
    shift_id: number;
    started_at: string;
    user_name: string;
    total_amount: number;
    cash_amount: number;
    non_cash_amount: number;
    transaction_count: number;
  } | null;
  arrivals_list?: Array<{
    id: number;
    booking_code: string;
    status: string;
    customer?: { name: string; phone?: string };
    booking_rooms?: Array<{ room?: { room_number: string } }>;
  }>;
  departures_list?: Array<{
    id: number;
    booking_code: string;
    status: string;
    customer?: { name: string; phone?: string };
    booking_rooms?: Array<{ room?: { room_number: string } }>;
  }>;
  recent_transactions?: Array<{
    id: number;
    amount: number;
    method: string;
    status: string;
    paid_at?: string;
    created_at: string;
    booking?: { booking_code: string; customer?: { name: string } };
    created_by?: { name: string };
  }>;
}

export default function Dashboard() {
  const { user, isAdmin, isPegawai, hotelSettings } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shiftStarted, setShiftStarted] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboard();
      if (isPegawai) {
        fetchShift();
      }
    }
  }, [user, isPegawai]);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/dashboard');
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShift = async () => {
    try {
      const res = await api.get('/api/v1/shifts/current');
      if (res.data?.data) {
        setShiftStarted(true);
      } else {
        setShiftStarted(false);
      }
    } catch {
      setShiftStarted(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  const currentDate = format(new Date(), 'EEEE, d MMMM yyyy', { locale: id });

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="text-h1">{getGreeting()}, {user?.name || 'Staf'}</h1>
          <p className="text-body mt-1 text-ink-500">
            <strong>{hotelSettings?.hotel_name || 'Aedo Hotel Syariah'}</strong>
            {hotelSettings?.hotel_address ? ` (${hotelSettings.hotel_address})` : ''} • {currentDate} • <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{isAdmin ? 'Akses Administrator' : 'Akses Operasional Pegawai'}</span>
          </p>
        </div>
      </header>

      {/* Warning jika Pegawai belum memulai shift */}
      {isPegawai && !shiftStarted && (
        <section className="dashboard-section">
          <HighlightCard
            title="Anda belum memulai shift"
            description="Sebagai pegawai, Anda wajib membuka shift tugas di menu atas sebelum mencatat reservasi atau pembayaran."
            action={
              <span className="text-body-small text-ink-600">
                Gunakan tombol "Mulai Shift" di pojok kanan atas layar.
              </span>
            }
          />
        </section>
      )}

      {/* KPI KEUANGAN & TRANSAKSI */}
      <section className="dashboard-section">
        <h2 className="text-h2 mb-4">Ringkasan Transaksi & Keuangan</h2>
        <div className="dashboard-kpi-grid">
          <KpiCard
            label="Pemasukan Hari Ini"
            value={isLoading ? '-' : formatIDR(data?.finance?.revenue_today ?? 0)}
            color="success"
            icon={<DollarSign />}
          />
          {isAdmin ? (
            <KpiCard
              label="Pemasukan Bulan Ini"
              value={isLoading ? '-' : formatIDR(data?.finance?.revenue_month ?? 0)}
              color="info"
              icon={<TrendingUp />}
            />
          ) : (
            <KpiCard
              label="Kas Masuk Shift Ini"
              value={isLoading ? '-' : formatIDR(data?.shift?.cash_amount ?? 0)}
              color="info"
              icon={<DollarSign />}
            />
          )}
          <KpiCard
            label="Menunggu Verifikasi"
            value={isLoading ? '-' : `${data?.finance?.pending_payments_count ?? 0} Transaksi`}
            color={data?.finance?.pending_payments_count ? 'danger' : 'violet'}
            icon={<Clock />}
          />
          <KpiCard
            label="Okupansi Hotel"
            value={isLoading ? '-' : `${data?.rooms?.occupancy ?? 0}%`}
            color="violet"
            icon={<Building />}
          />
        </div>
      </section>

      {/* KARTU TRANSAKSI SHIFT AKTIF (Akuntabilitas Kas Kasir Pegawai) */}
      {data?.shift && (
        <section className="dashboard-section">
          <Card title={`Akuntabilitas Transaksi Shift Berjalan (#Shift-${data.shift.shift_id})`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '8px 0' }}>
              <div style={{ padding: '12px 16px', background: 'var(--surface-sunken)', borderRadius: '8px' }}>
                <span className="text-label" style={{ display: 'block', marginBottom: '4px' }}>Petugas Shift</span>
                <span className="text-body-strong">{data.shift.user_name || user?.name}</span>
                <span className="text-body-small text-ink-500" style={{ display: 'block', marginTop: '2px' }}>
                  Mulai: {formatDateShort(data.shift.started_at)}
                </span>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <span className="text-label" style={{ display: 'block', marginBottom: '4px', color: '#15803d' }}>Total Kas Tunai (Fisik)</span>
                <span className="text-h3" style={{ color: '#15803d' }}>{formatIDR(data.shift.cash_amount)}</span>
                <span className="text-body-small text-ink-500" style={{ display: 'block', marginTop: '2px' }}>Uang di laci kasir</span>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--surface-sunken)', borderRadius: '8px' }}>
                <span className="text-label" style={{ display: 'block', marginBottom: '4px' }}>Non-Tunai (Transfer/QRIS)</span>
                <span className="text-h3">{formatIDR(data.shift.non_cash_amount)}</span>
                <span className="text-body-small text-ink-500" style={{ display: 'block', marginTop: '2px' }}>Rekening / Gateway</span>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--surface-sunken)', borderRadius: '8px' }}>
                <span className="text-label" style={{ display: 'block', marginBottom: '4px' }}>Total Seluruh Transaksi</span>
                <span className="text-h3">{formatIDR(data.shift.total_amount)}</span>
                <span className="text-body-small text-ink-500" style={{ display: 'block', marginTop: '2px' }}>
                  {data.shift.transaction_count} transaksi tercatat
                </span>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* OPERASIONAL & STATUS KAMAR */}
      <section className="dashboard-section">
        <h2 className="text-h2 mb-4">Operasional Hari Ini</h2>
        <div className="dashboard-kpi-grid">
          <KpiCard
            label="Check-in Hari Ini"
            value={isLoading ? '-' : data?.today?.arrivals ?? 0}
            color="info"
            icon={<UserCheck />}
          />
          <KpiCard
            label="Check-out Hari Ini"
            value={isLoading ? '-' : data?.today?.departures ?? 0}
            color="violet"
            icon={<UserMinus />}
          />
          <KpiCard
            label="Kamar Tersedia"
            value={isLoading ? '-' : data?.rooms?.available ?? 0}
            color="success"
            icon={<CheckCircle />}
          />
          <KpiCard
            label="Kamar Terisi (Occupied)"
            value={isLoading ? '-' : data?.rooms?.occupied ?? 0}
            color="danger"
            icon={<AlertTriangle />}
          />
        </div>
      </section>

      {/* AKSI CEPAT MENU */}
      <section className="dashboard-section">
        <h2 className="text-h2 mb-4">Aksi Cepat Resepsionis</h2>
        <div className="dashboard-shortcut-grid">
          <ShortcutTile
            to="/reservations/new"
            title="Reservasi Baru"
            subtitle="Buat reservasi tamu"
            icon={<CalendarPlus />}
          />
          <ShortcutTile
            to="/reservations?tab=checkin"
            title="Proses Check-in"
            subtitle="Tamu tiba di hotel"
            icon={<LogIn />}
          />
          <ShortcutTile
            to="/reservations?tab=checkout"
            title="Proses Check-out"
            subtitle="Tamu selesai menginap"
            icon={<LogOut />}
          />
          <ShortcutTile
            to="/payments/new"
            title="Catat Pembayaran"
            subtitle="Terima uang/transfer"
            icon={<FileText />}
          />
        </div>
      </section>

      {/* TABEL LIVE: KEDATANGAN HARI INI & TRANSAKSI TERAKHIR */}
      <section className="dashboard-section dashboard-cols-2">
        <Card title="Jadwal Kedatangan / Check-In Hari Ini">
          {(!data?.arrivals_list || data.arrivals_list.length === 0) ? (
            <div className="empty-state">
              <p className="text-body text-ink-500">Tidak ada jadwal kedatangan tamu untuk hari ini.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.arrivals_list.map((booking) => {
                const roomNos = booking.booking_rooms?.map(br => br.room?.room_number).filter(Boolean) || [];
                return (
                  <div 
                    key={booking.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <div className="text-body-strong">{booking.customer?.name || 'Tamu'}</div>
                      <div className="text-body-small text-ink-500">
                        {booking.booking_code} • {roomNos.length ? `Kamar No. ${roomNos.join(', ')}` : 'Belum pilih kamar'}
                      </div>
                    </div>
                    <Link to={`/reservations?tab=checkin&search=${booking.booking_code}`}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-600)', cursor: 'pointer' }}>
                        Check-In →
                      </span>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Aktivitas Transaksi Terbaru">
          {(!data?.recent_transactions || data.recent_transactions.length === 0) ? (
            <div className="empty-state">
              <p className="text-body text-ink-500">Belum ada transaksi pembayaran yang tercatat.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.recent_transactions.map((tx) => (
                <div 
                  key={tx.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div className="text-body-strong">
                      {formatIDR(tx.amount)}
                      <span 
                        style={{ 
                          marginLeft: '8px', 
                          fontSize: '11px', 
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: tx.status === 'verified' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: tx.status === 'verified' ? '#15803d' : '#b91c1c',
                          fontWeight: 700
                        }}
                      >
                        {tx.status}
                      </span>
                    </div>
                    <div className="text-body-small text-ink-500">
                      {tx.booking?.customer?.name || 'Tamu'} ({tx.booking?.booking_code || '-'}) • Metode: {tx.method.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-body-small text-ink-500" style={{ textAlign: 'right' }}>
                    {formatDateShort(tx.paid_at || tx.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

