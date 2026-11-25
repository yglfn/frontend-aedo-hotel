/* oxlint-disable react/immutability */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { Chip } from '../../components/ui/StatusBadge';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { formatIDR } from '../../lib/format';
import type { HotelService } from '../../types';
import './ServiceList.css';

interface ServiceFormData {
  name: string;
  price: string;
  unit: string;
  description: string;
  is_active: boolean;
}

type ServiceFilter = 'all' | 'active' | 'inactive';

const emptyForm: ServiceFormData = {
  name: '',
  price: '',
  unit: '',
  description: '',
  is_active: true,
};

export default function ServiceList() {
  const [services, setServices] = useState<HotelService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceFilter>('all');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<HotelService | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deactivatingService, setDeactivatingService] = useState<HotelService | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const requestSeq = useRef(0);

  const fetchServices = useCallback(async () => {
    const requestId = ++requestSeq.current;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ per_page: '100' });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('is_active', statusFilter === 'active' ? '1' : '0');

      const res = await api.get(`/api/v1/services?${params.toString()}`);
      if (requestId !== requestSeq.current) return;

      const raw = res.data.data;
      setServices(Array.isArray(raw) ? raw : []);
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      console.error('Failed to fetch services', error);
      setServices([]);
      toast.error('Gagal memuat layanan. Periksa koneksi ke server.');
    } finally {
      if (requestId === requestSeq.current) setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const handler = setTimeout(() => { void fetchServices(); }, 300);
    return () => clearTimeout(handler);
  }, [fetchServices]);

  const handleAdd = () => {
    setEditingService(null);
    setFormData({ ...emptyForm });
    setFormError('');
    setIsDrawerOpen(true);
  };

  const handleEdit = (service: HotelService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: String(Number(service.price)),
      unit: service.unit,
      description: service.description || '',
      is_active: service.is_active,
    });
    setFormError('');
    setIsDrawerOpen(true);
  };

  const handleSubmit = async () => {
    const price = Number(formData.price);
    if (!formData.name.trim() || !formData.unit.trim() || formData.price === '' || !Number.isFinite(price) || price < 0) {
      setFormError('Lengkapi nama, harga, dan satuan layanan.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        price,
        unit: formData.unit.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      if (editingService) {
        await api.put(`/api/v1/services/${editingService.id}`, payload);
      } else {
        await api.post('/api/v1/services', payload);
      }

      const savedName = formData.name.trim();
      setIsDrawerOpen(false);
      await fetchServices();
      toast.success(editingService ? `${savedName} diperbarui.` : `${savedName} ditambahkan.`);
    } catch (error) {
      console.error('Failed to save service', error);
      setFormError(apiErrorMessage(error, 'Gagal menyimpan layanan.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingService) return;

    setIsToggling(true);
    try {
      await api.delete(`/api/v1/services/${deactivatingService.id}`);
      const name = deactivatingService.name;
      setDeactivatingService(null);
      await fetchServices();
      toast.success(`${name} dinonaktifkan.`);
    } catch (error) {
      console.error('Failed to deactivate service', error);
      setDeactivatingService(null);
      toast.apiError(error, 'Gagal menonaktifkan layanan.');
    } finally {
      setIsToggling(false);
    }
  };

  const handleActivate = async (service: HotelService) => {
    setIsToggling(true);
    try {
      await api.patch(`/api/v1/services/${service.id}/activate`);
      await fetchServices();
      toast.success(`${service.name} diaktifkan.`);
    } catch (error) {
      console.error('Failed to activate service', error);
      toast.apiError(error, 'Gagal mengaktifkan layanan.');
    } finally {
      setIsToggling(false);
    }
  };

  const columns: Column<HotelService>[] = [
    {
      key: 'name',
      header: 'Layanan',
      cell: (service) => (
        <div>
          <span className="text-body-strong">{service.name}</span>
          {service.description && <div className="text-caption">{service.description}</div>}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Harga',
      align: 'right',
      cell: (service) => (
        <span className="money-cell">
          {formatIDR(service.price)} <span className="text-caption">/ {service.unit}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (service) => (
        <Chip label={service.is_active ? 'Aktif' : 'Nonaktif'} color={service.is_active ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      cell: (service) => (
        <div className="service-actions">
          {service.is_active ? (
            <Button size="sm" variant="ghost" disabled={isToggling} onClick={() => setDeactivatingService(service)}>
              Nonaktifkan
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={isToggling} onClick={() => handleActivate(service)}>
              Aktifkan
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => handleEdit(service)}>Edit</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="service-page">
      <div className="page-header">
        <div>
          <h1 className="text-h1">Layanan Tambahan</h1>
          <p className="text-label">Kelola layanan yang dapat ditagihkan ke reservasi.</p>
        </div>
        <Button onClick={handleAdd}>Tambah Layanan</Button>
      </div>

      <div className="service-filters">
        <Input
          placeholder="Cari layanan atau satuan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="ui-select"
          aria-label="Filter status layanan"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ServiceFilter)}
        >
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>

      <Table
        columns={columns}
        data={services}
        keyExtractor={(service) => service.id}
        isLoading={isLoading}
        emptyMessage="Belum ada layanan tambahan."
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingService ? `Edit ${editingService.name}` : 'Tambah Layanan'}
        width="450px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>Batal</Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!formData.name.trim() || !formData.unit.trim() || formData.price === ''}
            >
              Simpan
            </Button>
          </>
        }
      >
        <div className="service-form">
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <Input
            label="Nama Layanan"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contoh: Laundry"
            required
          />
          <Input
            label="Harga (Rp)"
            type="number"
            min={0}
            step={1000}
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            hint={formData.price !== '' ? formatIDR(Number(formData.price)) : undefined}
            placeholder="25000"
            required
          />
          <Input
            label="Satuan"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            placeholder="kg, orang, atau sesi"
            required
          />
          <div className="form-group">
            <label className="text-label" htmlFor="service-description">Deskripsi</label>
            <textarea
              id="service-description"
              className="service-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Keterangan singkat layanan"
            />
          </div>
          <label className="service-checkbox">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            />
            Layanan aktif
          </label>
        </div>
      </Drawer>

      <Modal
        isOpen={!!deactivatingService}
        onClose={() => setDeactivatingService(null)}
        title="Nonaktifkan Layanan"
        maxWidth="420px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeactivatingService(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDeactivate} isLoading={isToggling}>Nonaktifkan</Button>
          </>
        }
      >
        <p className="text-body">
          Nonaktifkan <strong>{deactivatingService?.name}</strong>? Riwayat tagihan tetap tersimpan.
        </p>
      </Modal>
    </div>
  );
}
