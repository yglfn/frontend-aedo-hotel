/* oxlint-disable react/immutability */
import { useState, useEffect, useRef } from 'react';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { formatIDR } from '../../lib/format';

interface RoomType {
  id: number;
  name: string;
  price: number | string;
  max_person: number;
  facilities?: string | null;
  description?: string | null;
  rooms_count?: number;
}

interface RoomTypeFormData {
  name: string;
  price: string;
  max_person: string;
  facilities: string;
  description: string;
}

const emptyForm: RoomTypeFormData = {
  name: '',
  price: '',
  max_person: '2',
  facilities: '',
  description: '',
};

const textAreaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '96px',
  padding: '12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  fontFamily: 'inherit',
  fontSize: '14px',
  resize: 'vertical',
};

export default function RoomTypeList() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [formData, setFormData] = useState<RoomTypeFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Delete state
  const [deletingType, setDeletingType] = useState<RoomType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Penanda urutan request supaya respons pencarian lama tidak menimpa hasil terbaru
  const requestSeq = useRef(0);

  // Debounce pencarian sama seperti halaman lain (300ms) agar tidak banyak request
  useEffect(() => {
    const term = search.trim();
    const handler = setTimeout(() => fetchRoomTypes(term), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchRoomTypes = async (term: string = search.trim()) => {
    const requestId = ++requestSeq.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '100' });
      if (term) params.set('search', term);

      const res = await api.get(`/api/v1/room-types?${params.toString()}`);
      if (requestId !== requestSeq.current) return;

      const list = res.data.data || [];
      setRoomTypes(Array.isArray(list) ? list : []);
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      console.error('Failed to fetch room types', error);
      toast.error('Gagal memuat data tipe kamar. Periksa koneksi ke server.');
    } finally {
      if (requestId === requestSeq.current) setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingType(null);
    setFormData(emptyForm);
    setErrorMsg('');
    setIsDrawerOpen(true);
  };

  const handleEdit = (roomType: RoomType) => {
    setEditingType(roomType);
    setErrorMsg('');
    setFormData({
      name: roomType.name,
      price: String(Math.round(Number(roomType.price))),
      max_person: String(roomType.max_person ?? ''),
      facilities: roomType.facilities || '',
      description: roomType.description || '',
    });
    setIsDrawerOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        name: formData.name.trim(),
        price: Number(formData.price),
        max_person: Number(formData.max_person),
        facilities: formData.facilities.trim() || null,
        description: formData.description.trim() || null,
      };

      if (editingType) {
        await api.put(`/api/v1/room-types/${editingType.id}`, payload);
      } else {
        await api.post('/api/v1/room-types', payload);
      }

      setIsDrawerOpen(false);
      await fetchRoomTypes();
      toast.success(
        editingType ? `Tipe ${formData.name} diperbarui.` : `Tipe ${formData.name} berhasil ditambahkan.`,
        { title: 'Tersimpan' }
      );
    } catch (error: any) {
      console.error('Failed to save room type', error);
      setErrorMsg(apiErrorMessage(error, 'Gagal menyimpan tipe kamar.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/room-types/${deletingType.id}`);
      const deletedName = deletingType.name;
      setDeletingType(null);
      await fetchRoomTypes();
      toast.success(`Tipe kamar ${deletedName} dihapus.`);
    } catch (error: any) {
      console.error('Failed to delete room type', error);
      setDeletingType(null);
      toast.apiError(error, 'Gagal menghapus tipe kamar.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<RoomType>[] = [
    {
      key: 'name',
      header: 'Tipe Kamar',
      cell: (t) => (
        <div>
          <span className="text-body-strong">{t.name}</span>
          {t.description && (
            <div className="text-caption">{t.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Harga / Malam',
      cell: (t) => <span className="tabular-nums">{formatIDR(t.price)}</span>,
    },
    {
      key: 'max_person',
      header: 'Kapasitas',
      cell: (t) => `${t.max_person} orang`,
    },
    {
      key: 'facilities',
      header: 'Fasilitas',
      cell: (t) =>
        t.facilities ? (
          <span title={t.facilities} style={{ display: 'block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.facilities}
          </span>
        ) : (
          <span className="text-caption">-</span>
        ),
    },
    {
      key: 'rooms_count',
      header: 'Kamar',
      align: 'right',
      cell: (t) => <span className="text-caption">{t.rooms_count ?? 0} kamar</span>,
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      cell: (t) => {
        const inUse = (t.rooms_count ?? 0) > 0;
        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="ghost"
              disabled={inUse}
              title={inUse ? `Masih dipakai ${t.rooms_count} kamar` : undefined}
              onClick={() => setDeletingType(t)}
            >
              Hapus
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleEdit(t)}>
              Edit
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <h1 className="text-h1">Kelola Tipe Kamar</h1>
          <p className="text-label">
            Tambah, ubah, atau hapus tipe kamar beserta harga per malam, kapasitas, dan fasilitasnya.
          </p>
        </div>
        <Button onClick={handleAdd}>Tambah Tipe Kamar</Button>
      </div>

      <div style={{ maxWidth: '400px' }}>
        <Input
          placeholder="Cari nama tipe kamar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        data={roomTypes}
        keyExtractor={(t) => t.id}
        isLoading={isLoading}
        emptyMessage="Belum ada tipe kamar. Klik “Tambah Tipe Kamar” untuk membuat."
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingType ? `Edit Tipe Kamar ${editingType.name}` : 'Tambah Tipe Kamar'}
        width="450px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!formData.name.trim() || formData.price === '' || formData.max_person === ''}
            >
              Simpan
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-fg)',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              {errorMsg}
            </div>
          )}
          <Input
            label="Nama Tipe Kamar"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contoh: Deluxe Room"
            required
          />
          <Input
            label="Harga per Malam (Rp)"
            type="number"
            min={0}
            step={1000}
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="500000"
            hint={formData.price ? formatIDR(Number(formData.price)) : undefined}
            required
          />
          <Input
            label="Kapasitas Maksimum (orang)"
            type="number"
            min={1}
            value={formData.max_person}
            onChange={(e) => setFormData({ ...formData, max_person: e.target.value })}
            required
          />
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">
              Fasilitas<span style={{ color: 'var(--ink-400)' }}> (opsional)</span>
            </label>
            <textarea
              style={textAreaStyle}
              placeholder="Contoh: AC, Smart TV, King Bed, WiFi, Minibar"
              value={formData.facilities}
              onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">
              Deskripsi<span style={{ color: 'var(--ink-400)' }}> (opsional)</span>
            </label>
            <textarea
              style={textAreaStyle}
              placeholder="Contoh: Kamar dengan pemandangan taman"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>
      </Drawer>

      <Modal
        isOpen={!!deletingType}
        onClose={() => setDeletingType(null)}
        title="Hapus Tipe Kamar"
        maxWidth="420px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingType(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Hapus
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p className="text-body">
            Apakah Anda yakin ingin menghapus tipe kamar <strong>{deletingType?.name}</strong>?
          </p>
          <p className="text-caption">
            Tipe kamar hanya bisa dihapus bila belum dipakai kamar mana pun.
          </p>
        </div>
      </Modal>
    </div>
  );
}
