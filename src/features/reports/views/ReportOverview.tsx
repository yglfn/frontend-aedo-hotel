import { Building, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { KpiCard } from '../../../components/ui/KpiCard';
import { Donut } from '../../../components/ui/Donut';
import { BarChart } from '../../../components/ui/BarChart';
import { BreakdownList } from '../../../components/ui/BreakdownList';
import type { BreakdownRow } from '../../../components/ui/BreakdownList';
import { Table } from '../../../components/ui/Table';
import type { Column } from '../../../components/ui/Table';
import { formatIDR, formatDateShort, shareOf, toNumber } from '../../../lib/format';
import { getStatusDef } from '../../../lib/status';
import {
  BOOKING_STATUS_COLORS,
  METHOD_COLORS,
  ROOM_STATUS_COLORS,
  SOURCE_COLORS,
  buildDailySeries,
  changeLabel,
  periodLabel,
} from '../reportMeta';
import type { DailyRevenueRow, SummaryReport } from '../types';
import { ComparisonLine, PeriodNote, ReportSection } from './ReportParts';

// Tabel angka di bawah grafik: grafik tidak boleh jadi satu-satunya sumber informasi
const dailyColumns: Column<DailyRevenueRow>[] = [
  { key: 'date', header: 'Tanggal', cell: (row) => formatDateShort(row.date) },
  {
    key: 'revenue',
    header: 'Pendapatan',
    align: 'right',
    cell: (row) => <span className="money-cell">{formatIDR(row.revenue)}</span>,
  },
  { key: 'transactions', header: 'Transaksi', align: 'right', cell: (row) => `${row.transactions}` },
];

/** Ringkasan laporan: angka utama seluruh operasional hotel dalam satu halaman. */
export function ReportOverview({ data }: { data: SummaryReport }) {
  const revenue = data.revenue;
  const occupancy = data.occupancy;
  const reservations = data.reservations;

  const trend = buildDailySeries(data.revenue_trend ?? [], data.period.from, data.period.to);

  const methodSegments = (data.payment_mix ?? []).map((row) => ({
    key: row.method,
    label: row.label ?? getStatusDef('payment_method', row.method).label,
    value: toNumber(row.total),
    color: METHOD_COLORS[row.method] ?? 'var(--neutral-fg)',
    caption: formatIDR(row.total),
  }));

  const sourceSegments = (data.booking_sources ?? []).map((row) => ({
    key: row.source,
    label: row.label ?? getStatusDef('booking_source', row.source).label,
    value: toNumber(row.count),
    color: SOURCE_COLORS[row.source] ?? 'var(--neutral-fg)',
    caption: `${row.count} reservasi`,
  }));

  // Sumber hanya menghitung reservasi yang tidak dibatalkan
  const activeSourceCount = sourceSegments.reduce((sum, segment) => sum + segment.value, 0);

  const roomRows: BreakdownRow[] = Object.entries(data.rooms ?? {})
    .filter(([key]) => key !== 'total')
    .map(([key, count]) => ({
      key,
      label: getStatusDef('room', key).label,
      value: `${count} kamar`,
      ratio: data.rooms.total > 0 ? toNumber(count) / toNumber(data.rooms.total) : 0,
      color: ROOM_STATUS_COLORS[key as keyof typeof ROOM_STATUS_COLORS] ?? 'var(--neutral-fg)',
    }));

  const statusRows = Object.entries(reservations.by_status ?? {}).map(([key, value]) => ({
    key,
    label: getStatusDef('booking', key).label,
    value: `${value.count} reservasi`,
    hint: value.count > 0 ? `Nilai ${formatIDR(value.value)} · ${shareOf(value.count, reservations.total)}% dari reservasi` : undefined,
    ratio: reservations.total > 0 ? toNumber(value.count) / toNumber(reservations.total) : 0,
    color: BOOKING_STATUS_COLORS[key as keyof typeof BOOKING_STATUS_COLORS] ?? 'var(--neutral-fg)',
  }));

  return (
    <div className="report-stack">
      <Card>
        <PeriodNote from={data.period.from} to={data.period.to} />

        <div className="report-kpi-grid">
          <KpiCard
            label="Pendapatan terverifikasi"
            value={formatIDR(revenue.total_revenue)}
            compareText={changeLabel(revenue.change_percent)}
            color="success"
            icon={<TrendingUp />}
          />
          <KpiCard
            label="Reservasi"
            value={`${reservations.total}`}
            compareText={`${formatIDR(reservations.total_value)} · ${changeLabel(reservations.change_percent)}`}
            color="info"
            icon={<Building />}
          />
          <KpiCard
            label="Okupansi"
            value={`${occupancy.occupancy_rate}%`}
            compareText={`${occupancy.occupied_nights} malam terisi dari ${occupancy.total_room_nights} kamar-malam`}
            color="violet"
            icon={<CheckCircle />}
          />
          <KpiCard
            label="Menunggu verifikasi"
            value={`${revenue.pending_count} transaksi`}
            compareText={revenue.pending_amount > 0 ? formatIDR(revenue.pending_amount) : 'Semua transaksi sudah diverifikasi'}
            color={revenue.pending_count > 0 ? 'danger' : 'neutral'}
            icon={<Clock />}
          />
        </div>

        <ComparisonLine
          text={`Pembanding ${formatIDR(revenue.previous_revenue)} pada ${periodLabel(data.previous_period.from, data.previous_period.to)}.`}
        />
      </Card>

      <div className="report-split">
        <Card title="Tren pendapatan harian">
          <ReportSection title={`${trend.length} hari dalam periode`}>
            <BarChart points={trend} formatValue={formatIDR} emptyMessage="Belum ada pembayaran terverifikasi pada periode ini." />
          </ReportSection>
        </Card>

        <Card title="Komposisi metode bayar">
          <Donut
            segments={methodSegments}
            centerValue={formatIDR(revenue.total_revenue)}
            centerLabel="Total masuk"
            emptyMessage="Belum ada pembayaran terverifikasi."
          />
        </Card>
      </div>

      <Card title="Pendapatan per hari">
        <Table
          columns={dailyColumns}
          data={data.revenue_trend ?? []}
          keyExtractor={(row) => row.date}
          emptyMessage="Belum ada pembayaran terverifikasi pada periode ini."
        />
      </Card>

      <div className="report-split">
        <Card title="Reservasi per status">
          <BreakdownList rows={statusRows} emptyMessage="Belum ada reservasi pada periode ini." />
        </Card>

        <Card title="Sumber reservasi">
          <Donut
            segments={sourceSegments}
            centerValue={`${activeSourceCount}`}
            centerLabel="Reservasi aktif"
            emptyMessage="Belum ada reservasi pada periode ini."
          />
        </Card>
      </div>

      <div className="report-split">
        <Card title="Kondisi kamar saat ini">
          <ReportSection title="Status nyata, bukan rekap periode">
            <BreakdownList rows={roomRows} emptyMessage="Belum ada kamar terdaftar." />
          </ReportSection>
        </Card>

        <Card title="Sorotan periode">
          <div className="report-highlights">
            {data.highlights.best_day && (
              <p className="callout">
                <span>
                  <span className="callout-judul">Pendapatan tertinggi {formatDateShort(data.highlights.best_day.date)}</span>
                  <span className="callout-meta">{formatIDR(data.highlights.best_day.revenue)}</span>
                </span>
              </p>
            )}

            {data.highlights.best_room && (
              <p className="callout">
                <span>
                  <span className="callout-judul">Kamar paling laris: {data.highlights.best_room.room_number}</span>
                  <span className="callout-meta">{data.highlights.best_room.occupied_nights} malam terisi</span>
                </span>
              </p>
            )}

            <p className="callout">
              <span>
                <span className="callout-judul">Housekeeping {data.housekeeping.completion_rate}% selesai</span>
                <span className="callout-meta">
                  {data.housekeeping.completed} dari {data.housekeeping.total} tugas
                  {data.housekeeping.average_hours !== null ? ` · rata-rata ${data.housekeeping.average_hours} jam` : ''}
                </span>
              </span>
            </p>

            <p className="callout">
              <span>
                <span className="callout-judul">Kas tercatat pada shift: {formatIDR(data.shifts.total_collected)}</span>
                <span className="callout-meta">
                  {data.shifts.total_shifts} shift · {data.shifts.total_transactions} transaksi
                  {occupancy.idle_rooms > 0 ? ` · ${occupancy.idle_rooms} kamar tidak pernah terisi` : ''}
                </span>
              </span>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
