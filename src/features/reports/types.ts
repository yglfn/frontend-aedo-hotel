import type { BookingSource, BookingStatus, PaymentMethod } from '../../types';

/** Payload GET /api/v1/reports/summary — satu-satunya laporan yang ditampilkan di layar. */

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface DailyRevenueRow {
  date: string;
  revenue: number;
  transactions: number;
}

export interface MethodShareRow {
  method: PaymentMethod;
  label: string;
  count: number;
  total: number;
  share_percent: number;
  count_percent: number;
  average: number;
}

export interface SourceShareRow {
  source: BookingSource;
  label: string;
  count: number;
  total_revenue: number;
  share_percent: number;
  revenue_percent: number;
  average_value: number;
}

export interface SummaryReport {
  period: ReportPeriod;
  days: number;
  previous_period: ReportPeriod;
  revenue: {
    total_revenue: number;
    total_transactions: number;
    average_per_day: number;
    cash_revenue: number;
    transfer_revenue: number;
    qris_revenue: number;
    refund_total: number;
    pending_count: number;
    pending_amount: number;
    previous_revenue: number;
    change_percent: number | null;
  };
  occupancy: {
    occupancy_rate: number;
    occupied_nights: number;
    total_room_nights: number;
    total_rooms: number;
    idle_rooms: number;
    previous_rate: number;
    change_points: number;
  };
  reservations: {
    total: number;
    total_value: number;
    by_status: Record<BookingStatus, { count: number; value: number }>;
    previous_total: number;
    change_percent: number | null;
  };
  housekeeping: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    completion_rate: number;
    average_hours: number | null;
  };
  shifts: {
    total_shifts: number;
    total_collected: number;
    total_transactions: number;
    average_collected: number;
  };
  rooms: Record<string, number> & { total: number };
  revenue_trend: DailyRevenueRow[];
  payment_mix: MethodShareRow[];
  booking_sources: SourceShareRow[];
  highlights: {
    best_day: { date: string; revenue: number } | null;
    best_room: { room_number: string; occupied_nights: number } | null;
    top_source: { source: BookingSource; count: number } | null;
  };
}
