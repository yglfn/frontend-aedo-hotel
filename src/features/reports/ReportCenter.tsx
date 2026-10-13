import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { FileDown, FileSpreadsheet, BarChart3, TrendingUp, Users, CreditCard, Clock, Brush, Building } from 'lucide-react';

import { api } from '../../lib/api';

interface ReportTypeItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const REPORT_TYPES: ReportTypeItem[] = [
  { id: 'revenue', title: 'Laporan Pendapatan', description: 'Rekapitulasi pendapatan harian, bulanan, dan total omset hotel.', icon: <TrendingUp size={22} color="var(--primary-600)" /> },
  { id: 'occupancy', title: 'Tingkat Okupansi', description: 'Persentase keterisian kamar terhadap total kamar tersedia.', icon: <BarChart3 size={22} color="var(--info-fg)" /> },
  { id: 'reservations', title: 'Daftar Reservasi', description: 'Histori reservasi yang dibuat tamu beserta status check-in/out.', icon: <Building size={22} color="var(--violet-fg)" /> },
  { id: 'transactions', title: 'Transaksi Pembayaran', description: 'Audit seluruh mutasi uang tunai, transfer bank, dan QRIS.', icon: <CreditCard size={22} color="var(--success-fg)" /> },
  { id: 'payment-methods', title: 'Metode Pembayaran', description: 'Komposisi transaksi berdasarkan channel pembayaran.', icon: <CreditCard size={22} color="var(--warning-fg)" /> },
  { id: 'shifts', title: 'Laporan Shift Pegawai', description: 'Pencatatan kas masuk dan kas keluar per giliran kerja pegawai.', icon: <Clock size={22} color="var(--ink-700)" /> },
  { id: 'sources', title: 'Sumber Pemesanan', description: 'Analisis asal tamu (Walk-in vs OTA Traveloka/lainnya).', icon: <Users size={22} color="var(--primary-800)" /> },
  { id: 'housekeeping', title: 'Laporan Housekeeping', description: 'Produktivitas pembersihan kamar dan durasi pengerjaan staf.', icon: <Brush size={22} color="var(--ink-500)" /> },
];

export default function ReportCenter() {
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (reportId: string, format: 'pdf' | 'xlsx') => {
    const actionKey = `${reportId}-${format}`;
    setDownloadingId(actionKey);
    try {
      const res = await api.get(`/api/v1/reports/${reportId}?from=${fromDate}&to=${toDate}&format=${format}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-${reportId}-${fromDate}_to_${toDate}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Gagal mengunduh laporan', err);
      alert(err.response?.data?.message || 'Gagal mengunduh laporan dari server.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-h1">Pusat Laporan & Analitik</h1>
        <p className="text-body-small text-ink-500 mt-1">
          Unduh dokumen pertanggungjawaban operasional dan keuangan dalam format PDF atau Excel.
        </p>
      </div>

      <Card title="Periode Laporan">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: '200px' }}>
            <Input
              label="Dari Tanggal"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div style={{ width: '200px' }}>
            <Input
              label="Sampai Tanggal"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <p className="text-body-small text-ink-500 mb-2">
            *Periode ini akan diterapkan otomatis untuk setiap unduhan di bawah.
          </p>
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {REPORT_TYPES.map((rep) => {
          const isPdfDownloading = downloadingId === `${rep.id}-pdf`;
          const isXlsxDownloading = downloadingId === `${rep.id}-xlsx`;

          return (
            <Card key={rep.id}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {rep.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="text-body-strong" style={{ fontSize: '15px' }}>
                    {rep.title}
                  </h3>
                  <p className="text-body-small text-ink-500 mt-1" style={{ lineHeight: 1.4, minHeight: '40px' }}>
                    {rep.description}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(rep.id, 'pdf')}
                      isLoading={isPdfDownloading}
                    >
                      <FileDown size={14} style={{ marginRight: '6px' }} />
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(rep.id, 'xlsx')}
                      isLoading={isXlsxDownloading}
                    >
                      <FileSpreadsheet size={14} style={{ marginRight: '6px' }} />
                      Excel
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
