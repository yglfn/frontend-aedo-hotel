import type { BookingStatus, RoomStatus, PaymentStatus, PaymentMethod, PaymentType, InvoiceStatus, HousekeepingTaskStatus, MaintenanceStatus, ShiftStatus, BookingSource } from '../types';

export type StatusColor = 'success' | 'info' | 'warning' | 'danger' | 'violet' | 'neutral';

export interface StatusDef {
  label: string;
  color: StatusColor;
}

export const bookingStatus: Record<BookingStatus, StatusDef> = {
  pending: { label: 'Menunggu', color: 'warning' },
  confirmed: { label: 'Dikonfirmasi', color: 'info' },
  checked_in: { label: 'Check-In', color: 'success' },
  checked_out: { label: 'Check-Out', color: 'neutral' },
  cancelled: { label: 'Dibatalkan', color: 'danger' },
};

export const roomStatus: Record<RoomStatus, StatusDef> = {
  available: { label: 'Tersedia', color: 'success' },
  booked: { label: 'Dipesan', color: 'info' },
  occupied: { label: 'Terisi', color: 'violet' },
  cleaning: { label: 'Sedang Dibersihkan', color: 'warning' },
  maintenance: { label: 'Perbaikan', color: 'danger' },
};

export const paymentStatus: Record<PaymentStatus, StatusDef> = {
  pending: { label: 'Menunggu', color: 'warning' },
  verified: { label: 'Terverifikasi', color: 'success' },
  failed: { label: 'Gagal', color: 'danger' },
  expired: { label: 'Kedaluwarsa', color: 'neutral' },
};

export const paymentMethod: Record<PaymentMethod, StatusDef> = {
  cash: { label: 'Tunai', color: 'neutral' },
  transfer: { label: 'Transfer', color: 'neutral' },
  qris: { label: 'QRIS', color: 'neutral' },
  payment_gateway: { label: 'Gateway', color: 'neutral' },
};

export const paymentType: Record<PaymentType, StatusDef> = {
  dp: { label: 'DP', color: 'neutral' },
  final: { label: 'Pelunasan', color: 'neutral' },
  refund: { label: 'Refund', color: 'danger' },
};

export const invoiceStatus: Record<InvoiceStatus, StatusDef> = {
  draft: { label: 'Draft', color: 'neutral' },
  sent: { label: 'Terkirim', color: 'info' },
  paid: { label: 'Lunas', color: 'success' },
  void: { label: 'Batal', color: 'danger' },
};

export const housekeepingStatus: Record<HousekeepingTaskStatus, StatusDef> = {
  pending: { label: 'Menunggu', color: 'warning' },
  in_progress: { label: 'Dikerjakan', color: 'info' },
  completed: { label: 'Selesai', color: 'success' },
};

export const maintenanceStatus: Record<MaintenanceStatus, StatusDef> = {
  reported: { label: 'Dilaporkan', color: 'danger' },
  in_progress: { label: 'Dikerjakan', color: 'warning' },
  resolved: { label: 'Selesai', color: 'success' },
};

export const shiftStatus: Record<ShiftStatus, StatusDef> = {
  open: { label: 'Buka', color: 'success' },
  closed: { label: 'Tutup', color: 'neutral' },
};

export const bookingSource: Record<BookingSource, StatusDef> = {
  walk_in: { label: 'Walk-in', color: 'neutral' },
  phone: { label: 'Telepon', color: 'neutral' },
  traveloka: { label: 'Traveloka', color: 'neutral' },
  other: { label: 'Lainnya', color: 'neutral' },
};

export const getStatusDef = (type: string, value: string): StatusDef => {
  switch (type) {
    case 'booking': return bookingStatus[value as BookingStatus];
    case 'room': return roomStatus[value as RoomStatus];
    case 'payment_status': return paymentStatus[value as PaymentStatus];
    case 'payment_method': return paymentMethod[value as PaymentMethod];
    case 'payment_type': return paymentType[value as PaymentType];
    case 'invoice': return invoiceStatus[value as InvoiceStatus];
    case 'housekeeping': return housekeepingStatus[value as HousekeepingTaskStatus];
    case 'maintenance': return maintenanceStatus[value as MaintenanceStatus];
    case 'shift': return shiftStatus[value as ShiftStatus];
    case 'booking_source': return bookingSource[value as BookingSource];
    default: return { label: value, color: 'neutral' };
  }
};
