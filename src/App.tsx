import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
const loadLogin = () => import('./features/auth/Login');
const loadDashboard = () => import('./features/dashboard/Dashboard');
const loadRoomBoard = () => import('./features/rooms/RoomBoard');
const loadRoomTypeList = () => import('./features/roomTypes/RoomTypeList');
const loadBookingList = () => import('./features/bookings/BookingList');
const loadNewBooking = () => import('./features/bookings/NewBooking');
const loadPaymentList = () => import('./features/payments/PaymentList');
const loadPaymentForm = () => import('./features/payments/PaymentForm');
const loadHousekeepingBoard = () => import('./features/housekeeping/HousekeepingBoard');
const loadMaintenanceList = () => import('./features/maintenance/MaintenanceList');
const loadCustomerList = () => import('./features/customers/CustomerList');
const loadSettingsPage = () => import('./features/settings/SettingsPage');
const loadUserList = () => import('./features/users/UserList');
const loadReportCenter = () => import('./features/reports/ReportCenter');

const Login = lazy(loadLogin);
const Dashboard = lazy(loadDashboard);
const RoomBoard = lazy(loadRoomBoard);
const RoomTypeList = lazy(loadRoomTypeList);
const BookingList = lazy(loadBookingList);
const NewBooking = lazy(loadNewBooking);
const PaymentList = lazy(loadPaymentList);
const PaymentForm = lazy(loadPaymentForm);
const HousekeepingBoard = lazy(loadHousekeepingBoard);
const MaintenanceList = lazy(loadMaintenanceList);
const CustomerList = lazy(loadCustomerList);
const SettingsPage = lazy(loadSettingsPage);
const UserList = lazy(loadUserList);
const ReportCenter = lazy(loadReportCenter);

import { AppShell } from './components/layout/AppShell';
import { Toaster } from './components/ui/Toast';
import { GlobalConfirmDialog } from './components/ui/ConfirmDialog';
// Guard untuk rute yang hanya boleh diakses Admin (AGENTS.md Bagian 3)
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();
  
  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Memuat...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Guard untuk memastikan sudah login
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Memuat...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Memuat...</div>}>
      <Routes>
      <Route path="/login" element={<Login />} />

      {/* Rute Operasional (Bisa diakses Admin & Pegawai) */}
      <Route path="/dashboard" element={<RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>} />
      <Route path="/rooms" element={<RequireAuth><AppShell><RoomBoard /></AppShell></RequireAuth>} />
      <Route path="/reservations" element={<RequireAuth><AppShell><BookingList /></AppShell></RequireAuth>} />
      <Route path="/reservations/new" element={<RequireAuth><AppShell><NewBooking /></AppShell></RequireAuth>} />
      <Route path="/payments" element={<RequireAuth><AppShell><PaymentList /></AppShell></RequireAuth>} />
      <Route path="/payments/new" element={<RequireAuth><AppShell><PaymentForm /></AppShell></RequireAuth>} />
      <Route path="/housekeeping" element={<RequireAuth><AppShell><HousekeepingBoard /></AppShell></RequireAuth>} />
      <Route path="/maintenance" element={<RequireAuth><AppShell><MaintenanceList /></AppShell></RequireAuth>} />
      <Route path="/customers" element={<RequireAuth><AppShell><CustomerList /></AppShell></RequireAuth>} />
      
      {/* Rute Khusus Admin (Berdasarkan AGENTS.md Bagian 3: Pegawai dilarang) */}
      <Route path="/room-types" element={<AdminOnly><AppShell><RoomTypeList /></AppShell></AdminOnly>} />
      <Route path="/users" element={<AdminOnly><AppShell><UserList /></AppShell></AdminOnly>} />
      <Route path="/reports" element={<AdminOnly><AppShell><ReportCenter /></AppShell></AdminOnly>} />
      <Route path="/settings" element={<AdminOnly><AppShell><SettingsPage /></AppShell></AdminOnly>} />
      
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        {/* Notifikasi & dialog konfirmasi global (pengganti alert/confirm browser) */}
        <Toaster />
        <GlobalConfirmDialog />
      </AuthProvider>
    </Router>
  );
}

export default App;
