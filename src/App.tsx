import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './features/auth/Login';
import Dashboard from './features/dashboard/Dashboard';
import RoomBoard from './features/rooms/RoomBoard';
import RoomTypeList from './features/roomTypes/RoomTypeList';
import BookingList from './features/bookings/BookingList';
import NewBooking from './features/bookings/NewBooking';
import PaymentList from './features/payments/PaymentList';
import PaymentForm from './features/payments/PaymentForm';
import HousekeepingBoard from './features/housekeeping/HousekeepingBoard';
import MaintenanceList from './features/maintenance/MaintenanceList';
import CustomerList from './features/customers/CustomerList';
import SettingsPage from './features/settings/SettingsPage';
import UserList from './features/users/UserList';
import ReportCenter from './features/reports/ReportCenter';
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
