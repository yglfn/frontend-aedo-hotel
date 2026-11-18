/* oxlint-disable react/immutability */
import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import './SettingsPage.css';

interface HotelSettings {
  hotel_name: string;
  hotel_address: string;
  hotel_phone: string;
  default_check_in: string;
  default_check_out: string;
  tax_percentage: string;
  min_dp_percentage: string;
  payment_verification_enabled: boolean;
}

const defaultSettings: HotelSettings = {
  hotel_name: '',
  hotel_address: '',
  hotel_phone: '',
  default_check_in: '14:00',
  default_check_out: '12:00',
  tax_percentage: '11.00',
  min_dp_percentage: '0',
  payment_verification_enabled: true,
};

export default function SettingsPage() {
  const { refreshSettings } = useAuth();
  const [settings, setSettings] = useState<HotelSettings>(defaultSettings);
  // Nilai tersimpan: pembanding "ada perubahan" + nilai kembali saat Batal
  const [savedSettings, setSavedSettings] = useState<HotelSettings>(defaultSettings);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
        const loaded: HotelSettings = {
          hotel_name: data.hotel_name || '',
          hotel_address: data.hotel_address || '',
          hotel_phone: data.hotel_phone || '',
          default_check_in: data.default_check_in ? data.default_check_in.substring(0, 5) : '14:00',
          default_check_out: data.default_check_out ? data.default_check_out.substring(0, 5) : '12:00',
          tax_percentage: data.tax_percentage ? String(data.tax_percentage) : '11.00',
          min_dp_percentage:
            data.min_dp_percentage === undefined || data.min_dp_percentage === null
              ? '0'
              : String(data.min_dp_percentage),
          payment_verification_enabled: data.payment_verification_enabled !== false,
        };
        setSettings(loaded);
        setSavedSettings(loaded);
      }
    } catch (err: any) {
      console.error('Failed to load settings', err);
      toast.error('Gagal memuat pengaturan sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const handleStartEdit = () => {
    setErrorMsg('');
    setIsEditing(true);
  };

  const handleCancelEdit = async () => {
    if (isDirty) {
      const discard = await confirmDialog({
        title: 'Batalkan Perubahan?',
        message: 'Nilai yang belum disimpan kembali ke pengaturan tersimpan.',
        confirmLabel: 'Ya, batalkan',
        cancelLabel: 'Lanjut edit',
        tone: 'danger',
      });
      if (!discard) return;
    }
    setSettings(savedSettings);
    setErrorMsg('');
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const apply = await confirmDialog({
      title: 'Simpan Pengaturan?',
      message: 'Nilai baru langsung dipakai sistem: pajak, DP check-in, dan verifikasi pembayaran.',
      confirmLabel: 'Simpan & Terapkan',
    });
    if (!apply) return;

    setIsSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        hotel_name: settings.hotel_name,
        hotel_address: settings.hotel_address,
        hotel_phone: settings.hotel_phone,
        default_check_in: settings.default_check_in.length === 5 ? `${settings.default_check_in}:00` : settings.default_check_in,
        default_check_out: settings.default_check_out.length === 5 ? `${settings.default_check_out}:00` : settings.default_check_out,
        tax_percentage: parseFloat(settings.tax_percentage) || 0,
        min_dp_percentage: parseFloat(settings.min_dp_percentage) || 0,
        payment_verification_enabled: settings.payment_verification_enabled,
      };
      const res = await api.put('/api/v1/settings', payload);
      await refreshSettings();
      setSavedSettings({ ...settings });
      setIsEditing(false);
      toast.success(res.data.message || 'Pengaturan hotel berhasil disimpan.', { title: 'Tersimpan' });
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

  /* Nilai turunan untuk ringkasan; dibaca dari isian form supaya kolom kanan ikut berubah
     saat admin mengedit, tanpa perlu request tambahan. */
  const pajak = Number(settings.tax_percentage) || 0;
  const dpMinimal = Number(settings.min_dp_percentage) || 0;

  const ringkasan = [
    { label: 'Nama hotel', value: settings.hotel_name || '-' },
    { label: 'Jam operasional', value: `${settings.default_check_in} – ${settings.default_check_out}` },
    { label: 'Pajak / PPN', value: `${pajak}%` },
    {
      label: 'DP check-in',
      value: dpMinimal > 0 ? `${dpMinimal}% dari tagihan` : 'Tidak wajib',
    },
    {
      label: 'Verifikasi pembayaran',
      value: settings.payment_verification_enabled ? 'Aktif (menunggu admin)' : 'Nonaktif (langsung lunas)',
    },
  ];

  return (
    <div className="settings-page">
      <div className="settings-head">
        <div>
          <h1 className="text-h1">Pengaturan Sistem</h1>
          <p className="text-body-small text-ink-500 mt-1">Konfigurasi operasional dan profil Aedo Hotel Syariah.</p>
        </div>
        {!isEditing && (
          <Button variant="primary" onClick={handleStartEdit}>
            Ubah Pengaturan
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="callout callout-danger" role="alert">
          <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="settings-layout">
        <form onSubmit={handleSave}>
          {/* Semua kontrol terkunci sampai tombol "Ubah Pengaturan" ditekan */}
          <fieldset className="settings-fields" disabled={!isEditing}>
            <Card title="Profil Hotel">
              <div className="settings-grid">
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
                <div className="input-group settings-span">
                  <label className="input-label text-label" htmlFor="hotel_address">
                    Alamat Lengkap<span className="input-required">*</span>
                  </label>
                  <textarea
                    id="hotel_address"
                    className="settings-area"
                    value={settings.hotel_address}
                    onChange={(e) => setSettings({ ...settings, hotel_address: e.target.value })}
                    required
                  />
                </div>
              </div>
            </Card>

            <Card title="Waktu Operasional &amp; Pajak">
              <div className="settings-grid">
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
                  label="Minimal DP untuk Check-In (%)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.min_dp_percentage}
                  onChange={(e) => setSettings({ ...settings, min_dp_percentage: e.target.value })}
                  hint="0 = tidak wajib DP. Di atas 0: ini ambang cek-in sekaligus nominal uang muka default di meja."
                  required
                />
                <div className="settings-check settings-span">
                  <input
                    type="checkbox"
                    id="payment_verification_enabled"
                    checked={settings.payment_verification_enabled}
                    onChange={(e) => setSettings({ ...settings, payment_verification_enabled: e.target.checked })}
                  />
                  <label className="settings-check-label" htmlFor="payment_verification_enabled">
                    <span className="text-body-strong">Verifikasi pembayaran transfer / QRIS</span>
                    <span className="settings-check-hint">
                      Aktif: pembayaran non-tunai menunggu persetujuan admin. Nonaktif: langsung dianggap lunas
                      saat dicatat.
                    </span>
                  </label>
                </div>
              </div>
            </Card>
          </fieldset>

          {isEditing && (
            <div className="settings-actions">
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving} disabled={!isDirty}>
                Simpan Perubahan
              </Button>
            </div>
          )}
        </form>

        <aside className="settings-summary">
          <Card title="Ringkasan Aktif">
            <dl className="settings-summary-list">
              {ringkasan.map((item) => (
                <div className="settings-summary-row" key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="settings-summary-note">
              {isEditing
                ? 'Ringkasan mengikuti isian. Nilai baru berlaku setelah disimpan.'
                : 'Klik “Ubah Pengaturan” untuk mengedit. Nilai ini dipakai sistem untuk tagihan, DP check-in, dan alur verifikasi pembayaran.'}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
