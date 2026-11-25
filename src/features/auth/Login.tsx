import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  CalendarCheck2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { apiErrorMessage } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const jam = (value?: string) => (value ? value.slice(0, 5) : '');
const currentYear = new Date().getFullYear();

export default function Login() {
  const { setUser, refreshUser, hotelSettings } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedLogoSrc, setFailedLogoSrc] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      await api.get('/sanctum/csrf-cookie');
      const res = await api.post('/api/v1/auth/login', { email, password });

      if (res.data?.user) {
        setUser(res.data.user);
      } else {
        await refreshUser();
      }

      navigate('/dashboard');
    } catch (error: any) {
      const status = error.response?.status;

      if (status === 429) {
        setErrorMsg('Terlalu banyak percobaan login. Coba lagi dalam 1 menit.');
      } else if (status === 422) {
        setErrorMsg(apiErrorMessage(error, 'Email atau kata sandi salah.'));
      } else if (!error.response) {
        setErrorMsg('Server tidak dapat dihubungi. Pastikan backend berjalan.');
      } else {
        setErrorMsg('Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const hotelName = hotelSettings?.hotel_name || 'Aedo Hotel Syariah';
  const logoSrc = hotelSettings?.hotel_photo_url && failedLogoSrc !== hotelSettings.hotel_photo_url
    ? hotelSettings.hotel_photo_url
    : '/favicon.svg';
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
          <img
            className="login-logo"
            src={logoSrc}
            alt=""
            onError={() => setFailedLogoSrc(logoSrc)}
          />
          <span className="login-lockup-teks">
            <strong className="login-lockup-nama">{hotelName}</strong>
            <span className="login-lockup-sub">Sistem Operasional Hotel</span>
          </span>
        </header>

        <section className="login-main" aria-labelledby="login-title">
          <div className="login-heading">
            <p className="login-eyebrow"><span aria-hidden="true" /> Portal petugas</p>
            <h1 id="login-title">Selamat datang kembali</h1>
            <p className="login-sub">Masuk untuk mengelola operasional hotel.</p>
          </div>

          {errorMsg && (
            <div className="login-error" id="login-error" role="alert">
              <AlertCircle size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <Input
              label="Email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@gmail.co.id"
              autoComplete="email"
              leftIcon={<Mail size={17} strokeWidth={1.8} />}
              aria-describedby={errorMsg ? 'login-error' : undefined}
              required
            />

            <div className="login-password-field">
              <Input
                label="Kata sandi"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                onBlur={() => setCapsLockOn(false)}
                autoComplete="current-password"
                leftIcon={<Lock size={17} strokeWidth={1.8} />}
                rightIcon={
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPassword((tampil) => !tampil)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
                  </button>
                }
                aria-describedby={errorMsg ? 'login-error' : capsLockOn ? 'login-caps-lock' : undefined}
                required
              />
              {capsLockOn && (
                <p className="login-caps-lock" id="login-caps-lock">
                  <AlertCircle size={13} aria-hidden="true" /> Caps Lock aktif.
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              loadingText="Memproses..."
              className="login-submit"
            >
              Masuk <ArrowRight size={17} strokeWidth={1.9} aria-hidden="true" />
            </Button>
          </form>

          <div className="login-support">
            <ShieldCheck size={17} strokeWidth={1.7} aria-hidden="true" />
            <p>Butuh bantuan akses? Hubungi admin hotel.</p>
          </div>
        </section>

        <footer className="login-foot">
          <span>&copy; {currentYear} {hotelName}</span>
          {(telepon || surelKontak) && <span>{[telepon, surelKontak].filter(Boolean).join(' · ')}</span>}
        </footer>
      </main>

      <aside className="login-brand" aria-label="Tentang sistem operasional hotel">
        <div className="login-brand-glow" aria-hidden="true" />
        <div className="login-brand-top">
          <span className="login-brand-chip"><span aria-hidden="true" /> Ruang kerja internal</span>
          <span className="login-brand-edition">Hotel management</span>
        </div>

        <div className="login-brand-content">
          <span className="login-brand-icon" aria-hidden="true"><BedDouble size={27} strokeWidth={1.5} /></span>
          <p className="login-brand-kicker">Lebih fokus pada tamu</p>
          <h2>{hotelName}</h2>
          <p className="login-brand-description">
            Satu ruang kerja untuk reservasi, kamar, pembayaran, dan housekeeping.
          </p>

          {alamat && (
            <p className="login-brand-address">
              <MapPin size={15} strokeWidth={1.7} aria-hidden="true" />
              <span>{alamat}</span>
            </p>
          )}

          <ul className="login-brand-features">
            <li><CalendarCheck2 size={17} strokeWidth={1.7} aria-hidden="true" /> Reservasi &amp; check-in</li>
            <li><BedDouble size={17} strokeWidth={1.7} aria-hidden="true" /> Kamar &amp; housekeeping</li>
            <li><WalletCards size={17} strokeWidth={1.7} aria-hidden="true" /> Pembayaran &amp; laporan</li>
          </ul>
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

        <div className="login-brand-footer">
          <ShieldCheck size={15} strokeWidth={1.7} aria-hidden="true" />
          Aktivitas petugas tercatat pada sistem.
        </div>
      </aside>
    </div>
  );
}
