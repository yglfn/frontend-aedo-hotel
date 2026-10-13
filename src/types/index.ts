export type Role = 'admin' | 'pegawai';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export type RoomStatus = 'available' | 'booked' | 'occupied' | 'cleaning' | 'maintenance';
export type PaymentMethod = 'cash' | 'transfer' | 'qris' | 'payment_gateway';
export type PaymentType = 'dp' | 'final' | 'refund';
export type PaymentStatus = 'pending' | 'verified' | 'failed' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';
export type HousekeepingTaskStatus = 'pending' | 'in_progress' | 'completed';
export type MaintenanceStatus = 'reported' | 'in_progress' | 'resolved';
export type ShiftStatus = 'open' | 'closed';
export type BookingSource = 'walk_in' | 'phone' | 'traveloka' | 'other';
