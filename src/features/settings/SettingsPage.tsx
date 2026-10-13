import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface HotelSettings {
  hotel_name: string;
  hotel_address: string;
  hotel_phone: string;
  default_check_in: string;
  default_check_out: string;
  tax_percentage: string;
  payment_expiry_minutes: number;
}

export default function SettingsPage() {
  const { refreshSettings } = useAuth();
  const [settings, setSettings] = useState<HotelSettings>({
    hotel_name: '',
    hotel_address: '',
    hotel_phone: '',
    default_check_in: '14:00',
    default_check_out: '12:00',
    tax_percentage: '11.00',
    payment_expiry_minutes: 60,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/v1/settings');
      const data = res.data.data;
      if (data) {
        setSettings({
          hotel_name: data.hotel_name || '',
          hotel_address: data.hotel_address || '',
          hotel_phone: data.hotel_phone || '',
          default_check_in: data.default_check_in ? data.default_check_in.substring(0, 5) : '14:00',
          default_check_out: data.default_check_out ? data.default_check_out.substring(0, 5) : '12:00',
          tax_percentage: data.tax_percentage ? String(data.tax_percentage) : '11.00',
          payment_expiry_minutes: data.payment_expiry_minutes || 60,
        });
      }
    } catch (err: any) {
      console.error('Failed to load settings', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const payload = {
        hotel_name: settings.hotel_name,
        hotel_address: settings.hotel_address,
        hotel_phone: settings.hotel_phone,
        default_check_in: settings.default_check_in.length === 5 ? `${settings.default_check_in}:00` : settings.default_check_in,
        default_check_out: settings.default_check_out.length === 5 ? `${settings.default_check_out}:00` : settings.default_check_out,
        tax_percentage: parseFloat(settings.tax_percentage) || 0,
        payment_expiry_minutes: Number(settings.payment_expiry_minutes) || 60,
      };
      const res = await api.put('/api/v1/settings', payload);
      await refreshSettings();
      setSuccessMsg(res.data.message || 'Pengaturan hotel berhasil disimpan ke database!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to save settings', err);
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan pengaturan ke backend.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-ink-500 py-8">Memuat pengaturan sistem...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-h1">Pengaturan Sistem</h1>
        <p className="text-body-small text-ink-500 mt-1">Konfigurasi operasional dan profil Aedo Hotel Syariah.</p>
      </div>

      {successMsg && (
        <div
          style={{
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success-fg)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-control)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-fg)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-control)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Card title="Profil Hotel">
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <Input
              label="Nama Hotel"
              value={settings.hotel_name}
              onChange={(e) => setSettings({ ...settings, hotel_name: e.target.value })}
              required
            />
            <Input
              label="Nomor Telepon / Hotline"
              value={settings.hotel_phone}
              onChange={(e) => setSettings({ ...settings, hotel_phone: e.target.value })}
              required
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="text-label">Alamat Lengkap</label>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-control)',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                }}
                value={settings.hotel_address}
                onChange={(e) => setSettings({ ...settings, hotel_address: e.target.value })}
                required
              />
            </div>
          </div>
        </Card>

        <Card title="Waktu Operasional & Pajak">
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input
              label="Jam Standar Check-in"
              type="time"
              value={settings.default_check_in}
              onChange={(e) => setSettings({ ...settings, default_check_in: e.target.value })}
              required
            />
            <Input
              label="Jam Standar Check-out"
              type="time"
              value={settings.default_check_out}
              onChange={(e) => setSettings({ ...settings, default_check_out: e.target.value })}
              required
            />
            <Input
              label="Persentase Pajak / PPN (%)"
              type="number"
              step="0.01"
              value={settings.tax_percentage}
              onChange={(e) => setSettings({ ...settings, tax_percentage: e.target.value })}
              required
            />
            <Input
              label="Batas Waktu Pembayaran Gateway (Menit)"
              type="number"
              value={settings.payment_expiry_minutes.toString()}
              onChange={(e) => setSettings({ ...settings, payment_expiry_minutes: Number(e.target.value) })}
              required
            />
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button type="submit" isLoading={isSaving}>
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
  );
}
