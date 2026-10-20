import { useState, useEffect } from 'react';
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
  auto_verify_transfers: boolean;
  auto_verify_max_amount: string;
}

const defaultSettings: HotelSettings = {
  hotel_name: '',
  hotel_address: '',
  hotel_phone: '',
  default_check_in: '14:00',
  default_check_out: '12:00',
  tax_percentage: '11.00',
  min_dp_percentage: '0',
  auto_verify_transfers: true,
  auto_verify_max_amount: '0',
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
          auto_verify_transfers: data.auto_verify_transfers !== false,
          auto_verify_max_amount:
            data.auto_verify_max_amount === undefined || data.auto_verify_max_amount === null
              ? '0'
              : String(data.auto_verify_max_amount),
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
      message: 'Nilai baru langsung dipakai sistem: pajak, DP check-in, dan verifikasi otomatis.',
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
        auto_verify_transfers: settings.auto_verify_transfers,
        auto_verify_max_amount: parseFloat(settings.auto_verify_max_amount) || 0,
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

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-h1">Pengaturan Sistem</h1>
          <p className="text-body-small text-ink-500 mt-1">Konfigurasi operasional dan profil Aedo Hotel Syariah.</p>
        </div>
        {!isEditing && (
          <Button variant="secondary" onClick={handleStartEdit}>
            Ubah Pengaturan
          </Button>
        )}
      </div>

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

      <form onSubmit={handleSave}>
        {/* Semua kontrol terkunci sampai tombol "Ubah Pengaturan" ditekan */}
        <fieldset className="settings-fields" disabled={!isEditing}>
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
              <Input
                label="Plafon Verifikasi Otomatis (Rp)"
                type="number"
                min="0"
                step="50000"
                value={settings.auto_verify_max_amount}
                onChange={(e) => setSettings({ ...settings, auto_verify_max_amount: e.target.value })}
                hint="0 = tanpa plafon. Di atas nilai ini pembayaran tetap butuh persetujuan admin."
                required
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px' }}>
                <input
                  type="checkbox"
                  id="auto_verify_transfers"
                  checked={settings.auto_verify_transfers}
                  onChange={(e) => setSettings({ ...settings, auto_verify_transfers: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="auto_verify_transfers" className="text-label">
                  Verifikasi otomatis transfer/QRIS (butuh nomor referensi unik + bukti terunggah)
                </label>
              </div>
            </div>
          </Card>
        </fieldset>

        {isEditing && (
          <div className="settings-actions">
            <Button type="button" variant="ghost" onClick={handleCancelEdit}>
              Batal
            </Button>
            <Button type="submit" isLoading={isSaving} disabled={!isDirty}>
              Simpan Perubahan
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
