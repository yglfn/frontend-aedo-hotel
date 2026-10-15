import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { apiErrorMessage } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export default function Login() {
  const { setUser, refreshUser, hotelSettings } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Ambil CSRF cookie
      await api.get('/sanctum/csrf-cookie');
      
      // 2. Login
      const res = await api.post('/api/v1/auth/login', { email, password });
      
      // 3. Update Auth state
      if (res.data?.user) {
        setUser(res.data.user);
      } else {
        await refreshUser();
      }
      
      // Redirect
      navigate('/dashboard');
    } catch (error: any) {
      const status = error.response?.status;

      if (status === 429) {
        // Route login diproteksi throttle di backend (AGENTS.md bagian 9)
        setErrorMsg('Terlalu banyak percobaan login. Coba lagi dalam 1 menit.');
      } else if (status === 422) {
        // Prioritaskan pesan per-field berbahasa Indonesia dari server, misalnya
        // "Email atau password salah." atau "Akun Anda tidak aktif."
        setErrorMsg(apiErrorMessage(error, 'Email atau password salah.'));
      } else if (!error.response) {
        setErrorMsg('Server tidak dapat dihubungi. Pastikan backend berjalan di port 8000.');
      } else {
        setErrorMsg('Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-section">
        <div className="login-form-wrapper">
          <h1 className="text-h1">Masuk ke {hotelSettings?.hotel_name || 'Aedo Hotel'}</h1>
          <p className="text-body mt-2 mb-8" style={{ color: 'var(--ink-500)' }}>
            {hotelSettings?.hotel_address ? `${hotelSettings.hotel_address} • ` : ''}Masukkan kredensial Anda untuk mengakses sistem.
          </p>
          
          {errorMsg && (
            <div className="login-error-banner">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@aedohotel.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Button type="submit" size="lg" isLoading={isLoading} className="login-submit-btn">
              Masuk
            </Button>
          </form>
        </div>
      </div>
      <div className="login-branding-section">
        <div className="branding-content">
          <h2 className="branding-title">{hotelSettings?.hotel_name || 'Aedo Hotel Syariah'}</h2>
          <p className="branding-text">
            {hotelSettings?.hotel_address ? `${hotelSettings.hotel_address} — ` : ''}
            Kenyamanan syariah untuk pengalaman menginap yang tenang dan berkah.
          </p>
        </div>
      </div>
    </div>
  );
}
