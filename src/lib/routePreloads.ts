export const routePreloads: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../features/dashboard/Dashboard'),
  '/rooms': () => import('../features/rooms/RoomBoard'),
  '/reservations': () => import('../features/bookings/BookingList'),
  '/payments': () => import('../features/payments/PaymentList'),
  '/housekeeping': () => import('../features/housekeeping/HousekeepingBoard'),
  '/maintenance': () => import('../features/maintenance/MaintenanceList'),
  '/customers': () => import('../features/customers/CustomerList'),
  '/room-types': () => import('../features/roomTypes/RoomTypeList'),
  '/reports': () => import('../features/reports/ReportCenter'),
  '/users': () => import('../features/users/UserList'),
  '/settings': () => import('../features/settings/SettingsPage'),
};
