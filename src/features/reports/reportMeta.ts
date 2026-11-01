import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { BookingSource, BookingStatus, PaymentMethod, RoomStatus } from '../../types';
import type { DailyRevenueRow } from './types';

/* Warna grafik berurutan sesuai DESIGN.md 5.13 — dilarang palet acak. */
export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'var(--warning-fg)',
  confirmed: 'var(--info-fg)',
  checked_in: 'var(--success-fg)',
  checked_out: 'var(--neutral-fg)',
  cancelled: 'var(--danger-fg)',
};

export const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: 'var(--primary-600)',
  transfer: 'var(--info-fg)',
  qris: 'var(--violet-fg)',
};

export const SOURCE_COLORS: Record<BookingSource, string> = {
  walk_in: 'var(--primary-600)',
  phone: 'var(--info-fg)',
  traveloka: 'var(--violet-fg)',
  other: 'var(--neutral-fg)',
};

export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  available: 'var(--success-fg)',
  booked: 'var(--info-fg)',
  occupied: 'var(--violet-fg)',
  cleaning: 'var(--warning-fg)',
  maintenance: 'var(--danger-fg)',
};

/* ---------------------------------------------------------------
   Periode: preset cepat + label yang dibaca orang, bukan ISO string
   --------------------------------------------------------------- */

export type PeriodPresetId = 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom';

/* Tanggal bentuk input (yyyy-MM-dd) mengikuti zona waktu browser pengguna */
export const toDateInput = (date: Date): string => format(date, 'yyyy-MM-dd');

export interface PeriodPreset {
  id: PeriodPresetId;
  label: string;
  range: (today: Date) => { from: string; to: string };
}

export const PERIOD_PRESETS: PeriodPreset[] = [
  { id: 'today', label: 'Hari ini', range: (today) => ({ from: toDateInput(today), to: toDateInput(today) }) },
  { id: 'last7', label: '7 hari terakhir', range: (today) => ({ from: toDateInput(addDays(today, -6)), to: toDateInput(today) }) },
  { id: 'thisMonth', label: 'Bulan ini', range: (today) => ({ from: toDateInput(startOfMonth(today)), to: toDateInput(today) }) },
  {
    id: 'lastMonth',
    label: 'Bulan lalu',
    range: (today) => {
      const first = startOfMonth(subMonths(today, 1));
      const last = addDays(startOfMonth(today), -1);

      return { from: toDateInput(first), to: toDateInput(last) };
    },
  },
];

/** Preset mana yang sedang cocok dengan tanggal di layar; kalau tidak ada, berarti kustom. */
export function matchPreset(from: string, to: string, today: Date = new Date()): PeriodPresetId {
  const found = PERIOD_PRESETS.find((preset) => {
    const range = preset.range(today);

    return range.from === from && range.to === to;
  });

  return found ? found.id : 'custom';
}

export function periodLabel(from: string, to: string): string {
  if (from === to) return formatLongDay(from);

  return `${formatLongDay(from)} – ${formatLongDay(to)}`;
}

function formatLongDay(value: string): string {
  try {
    return format(parseISO(value), 'd MMM yyyy', { locale: localeId });
  } catch {
    return value;
  }
}

/** Panjang periode dalam hari (inklusif), dipakai pada catatan periode di layar. */
export function periodLength(from: string, to: string): number {
  try {
    return differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  } catch {
    return 1;
  }
}

/**
 * Seri harian yang lengkap: tanggal tanpa transaksi diisi nol, supaya grafik tren
 * tidak tampak bolong-bolong dan pembaca tidak mengira datangnya hilang.
 */
export function buildDailySeries(rows: DailyRevenueRow[], from: string, to: string) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const series: { key: string; label: string; value: number; transactions: number }[] = [];

  let cursor = parseISO(from);
  const end = parseISO(to);
  // Batasi pengisian agar periode setahun tetap ringan dipakai di browser
  const maxDays = 370;

  for (let day = 0; day < maxDays && cursor <= end; day += 1) {
    const date = toDateInput(cursor);
    const row = byDate.get(date);

    series.push({
      key: date,
      label: format(cursor, 'd MMM', { locale: localeId }),
      value: row ? Number(row.revenue) || 0 : 0,
      transactions: row ? Number(row.transactions) || 0 : 0,
    });

    cursor = addDays(cursor, 1);
  }

  return series;
}

/** Kalimat pembanding pendek; null berarti belum ada angka pembanding. */
export function changeLabel(percent: number | null | undefined, unit = 'vs periode sebelumnya'): string {
  if (percent === null || percent === undefined) {
    return 'Belum ada pembanding periode sebelumnya';
  }

  if (percent === 0) {
    return `Sama ${unit}`;
  }

  return `${percent > 0 ? 'Naik' : 'Turun'} ${Math.abs(percent).toLocaleString('id-ID')}% ${unit}`;
}
