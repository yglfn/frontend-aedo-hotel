import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BedDouble, Eye, EyeOff, Lock, Mail, MapPin } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { apiErrorMessage } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

/** API mengirim "14:00:00"; yang dibaca manusia "14:00". */
const jam = (value?: string) => (value ? value.slice(0, 5) : '');

/**
 * Halaman masuk petugas.
 *
 * Kolom kiri = form (satu aksi utama), kolom kanan = panel identitas hotel dengan fakta
 * operasional nyata dari GET /api/v1/settings (jam check-in/out + pajak), bukan tempelan
 * dekorasi. Di bawah 1024px panel disembunyikan sesuai DESIGN.md §6.1.
 */
export default function Login() {
  const { setUser, refreshUser, hotelSettings } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const hotelName = hotelSettings?.hotel_name || 'Aedo Hotel Syariah';
  const alamat = hotelSettings?.hotel_address || '';
  const telepon = hotelSettings?.hotel_phone || '';
  const surelKontak = hotelSettings?.hotel_email || '';
  const checkIn = jam(hotelSettings?.default_check_in);
  const checkOut = jam(hotelSettings?.default_check_out);
  const pajak = Number(hotelSettings?.tax_percentage ?? 0);

  const fakta = [
    checkIn && { label: 'Check-in', value: checkIn },
    checkOut && { label: 'Check-out', value: checkOut },
    pajak > 0 && { label: 'Pajak & layanan', value: `${pajak}%` },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="login-shell">
      <main className="login-pane">
        <header className="login-lockup">
          <span className="login-mark" aria-hidden="true">
            <BedDouble size={18} strokeWidth={1.75} />
          </span>
          <span className="login-lockup-teks">
            <strong className="login-lockup-nama">{hotelName}</strong>
            <span className="login-lockup-sub">Sistem Operasional Hotel</span>
          </span>
        </header>

        <section className="login-main">
          <p className="login-eyebrow">Masuk petugas</p>
          <h1 className="text-h1 login-judul">Masuk ke dasbor operasional</h1>
          <p className="login-sub">
            Gunakan akun yang diberikan admin hotel. Setiap aksi Anda tercatat pada log aktivitas.
          </p>

          {errorMsg && (
            <div className="login-error" role="alert">
              <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@aedohotel.co.id"
              autoComplete="email"
              autoFocus
              leftIcon={<Mail size={16} strokeWidth={1.75} />}
              required
            />

            <Input
              label="Kata sandi"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              leftIcon={<Lock size={16} strokeWidth={1.75} />}
              rightIcon={
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword((tampil) => !tampil)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              }
              required
            />

            <Button type="submit" size="lg" isLoading={isLoading} className="login-submit">
              Masuk
            </Button>
          </form>

          <p className="login-bantuan">
            Lupa kata sandi? Admin hotel dapat membuatkan akun baru lewat menu Pengguna.
          </p>
        </section>

        <footer className="login-foot">
          <span>Sistem internal &mdash; akses hanya untuk petugas terdaftar.</span>
          {(telepon || surelKontak) && <span>{[telepon, surelKontak].filter(Boolean).join(' · ')}</span>}
        </footer>
      </main>

      <aside className="login-brand">
        <div className="login-brand-dalam">
          <div className="login-brand-atas">
            <span className="login-brand-chip">Akses internal</span>
          </div>

          <div className="login-brand-tengah">
            <h2 className="login-brand-nama">{hotelName}</h2>

            {alamat && (
              <p className="login-brand-alamat">
                <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                <span>{alamat}</span>
              </p>
            )}

            <p className="login-brand-teks">
              Reservasi, status kamar, tagihan, dan housekeeping berada di satu layar kerja.
            </p>
          </div>

          {fakta.length > 0 && (
            <dl className="login-fakta">
              {fakta.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}
