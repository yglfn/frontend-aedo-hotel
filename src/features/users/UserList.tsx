import { useState, useEffect, useRef } from 'react';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge, Chip } from '../../components/ui/StatusBadge';
import { apiErrorMessage, toast } from '../../components/ui/Toast';
import type { Role } from '../../types';
import { formatDateShort } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';

import { api } from '../../lib/api';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_login_at?: string | null;
  open_shifts_count?: number;
}

interface PageMeta {
  current_page: number;
  last_page: number;
  from: number;
  to: number;
  total: number;
}

const emptyMeta: PageMeta = { current_page: 1, last_page: 1, from: 0, to: 0, total: 0 };

const emptyForm = {
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'pegawai' as Role,
  is_active: true,
};

/** Role dikirim sebagai string oleh API, tapi dijamin aman bila bentuknya object. */
const roleValue = (role: Role | { value: string }): Role =>
  (typeof role === 'object' ? (role as { value: string }).value : role) as Role;

export default function UserList() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | Role>('');
  const [page, setPage] = useState(1);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [errorMsg, setErrorMsg] = useState('');

  const [deletingUser, setDeletingUser] = useState<StaffUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestSeq = useRef(0);

  // Ganti filter/pencarian selalu kembali ke halaman pertama
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  // Debounce 300ms agar tidak banyak request saat mengetik
  useEffect(() => {
    const handler = setTimeout(() => fetchUsers(page), 300);
    return () => clearTimeout(handler);
  }, [search, roleFilter, page]);

  const fetchUsers = async (targetPage: number = page) => {
    const requestId = ++requestSeq.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '15', page: String(targetPage) });
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);

      const res = await api.get(`/api/v1/users?${params.toString()}`);
      if (requestId !== requestSeq.current) return;

      const list = res.data.data || [];
      setUsers(Array.isArray(list) ? list : []);
      // Laravel paginator mengirim current_page/from/to/last_page/total di root (bukan di dalam meta)
      const pageData = res.data?.meta ?? res.data ?? {};
      setMeta({ ...emptyMeta, ...pageData });
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      console.error('Failed to fetch users', error);
      toast.error('Gagal memuat data pegawai. Periksa koneksi ke server.');
    } finally {
      if (requestId === requestSeq.current) setIsLoading(false);
    }
  };

  const isSelf = (u: StaffUser) => !!currentUser && currentUser.id === u.id;

  const handleAdd = () => {
    setEditingUser(null);
    setErrorMsg('');
    setFormData(emptyForm);
    setIsDrawerOpen(true);
  };

  const handleEdit = (u: StaffUser) => {
    setEditingUser(u);
    setErrorMsg('');
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      password_confirmation: '',
      role: roleValue(u.role),
      is_active: u.is_active,
    });
    setIsDrawerOpen(true);
  };

  const validateForm = (): string => {
    if (!formData.name.trim()) return 'Nama lengkap wajib diisi.';
    if (!formData.email.trim()) return 'Alamat email wajib diisi.';

    const passwordTyped = formData.password.length > 0;

    if (!editingUser && !passwordTyped) return 'Password wajib diisi (minimal 8 karakter).';
    if (passwordTyped && formData.password.length < 8) return 'Password minimal 8 karakter.';
    if (passwordTyped && formData.password !== formData.password_confirmation) {
      return 'Konfirmasi password tidak sama dengan password.';
    }

    return '';
  };

  const handleSubmit = async () => {
    const localError = validateForm();
    if (localError) {
      setErrorMsg(localError);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        // Status akun tidak boleh diubah dari form untuk akun sendiri
        is_active: editingUser && isSelf(editingUser) ? undefined : formData.is_active,
      };

      if (editingUser) {
        await api.put(`/api/v1/users/${editingUser.id}`, payload);

        if (formData.password.length > 0) {
          await api.post(`/api/v1/users/${editingUser.id}/reset-password`, {
            password: formData.password,
          });
        }
      } else {
        await api.post('/api/v1/users', { ...payload, password: formData.password });
      }

      setIsDrawerOpen(false);
      await fetchUsers();
      toast.success(
        editingUser ? `Data ${editingUser.name} tersimpan.` : `Akun ${formData.name} berhasil dibuat.`,
        { title: 'Tersimpan' }
      );
    } catch (error: any) {
      console.error('Failed to save user', error);
      setErrorMsg(apiErrorMessage(error, 'Gagal menyimpan data pegawai.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (u: StaffUser) => {
    const endpoint = u.is_active
      ? `/api/v1/users/${u.id}/deactivate`
      : `/api/v1/users/${u.id}/activate`;

    try {
      await api.patch(endpoint);

      setUsers(users.map((item) => (item.id === u.id ? { ...item, is_active: !item.is_active } : item)));

      toast.success(
        u.is_active
          ? `Akun ${u.name} dinonaktifkan. Sesi dan token login ikut dicabut.`
          : `Akun ${u.name} aktif kembali.`
      );
    } catch (error: any) {
      console.error('Failed to change user status', error);
      toast.apiError(error, 'Gagal mengubah status aktif pegawai.');
      await fetchUsers();
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/users/${deletingUser.id}`);
      const deletedName = deletingUser.name;
      setDeletingUser(null);
      await fetchUsers();
      toast.success(`Akun ${deletedName} sudah dihapus.`);
    } catch (error: any) {
      console.error('Failed to delete user', error);
      setDeletingUser(null);
      toast.apiError(error, 'Gagal menghapus pegawai.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<StaffUser>[] = [
    {
      key: 'name',
      header: 'Nama',
      cell: (u) => (
        <div>
          <span className="text-body-strong">{u.name}</span>
          <div className="text-caption">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) => {
        const value = roleValue(u.role);
        return (
          <span
            style={{
              textTransform: 'uppercase',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: value === 'admin' ? 'var(--primary-100)' : 'var(--surface-muted)',
              color: value === 'admin' ? 'var(--primary-800)' : 'var(--ink-700)',
            }}
          >
            {value}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status Akun',
      cell: (u) => <StatusBadge type="shift" value={u.is_active ? 'open' : 'closed'} />,
    },
    {
      key: 'shift',
      header: 'Shift',
      cell: (u) =>
        (u.open_shifts_count ?? 0) > 0 ? (
          <Chip label="Shift berjalan" color="info" />
        ) : (
          <span className="text-caption">Tidak ada</span>
        ),
    },
    {
      key: 'last_login_at',
      header: 'Login Terakhir',
      cell: (u) =>
        u.last_login_at ? (
          <span className="text-caption">{formatDateShort(u.last_login_at)}</span>
        ) : (
          <span className="text-caption">Belum pernah</span>
        ),
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      cell: (u) => {
        const self = isSelf(u);
        const hasOpenShift = (u.open_shifts_count ?? 0) > 0;
        const cannotDeactivate = self || (u.is_active && hasOpenShift);
        const deactivateTitle = self
          ? 'Anda tidak dapat menonaktifkan akun sendiri'
          : hasOpenShift
            ? 'Pegawai masih memiliki shift berjalan'
            : undefined;

        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="ghost"
              disabled={u.is_active && cannotDeactivate}
              title={u.is_active ? deactivateTitle : undefined}
              onClick={() => handleToggleActive(u)}
            >
              {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleEdit(u)}>
              Edit
            </Button>
            {!self && (
              <Button size="sm" variant="danger" onClick={() => setDeletingUser(u)}>
                Hapus
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-h1">Manajemen Pegawai</h1>
          <p className="text-caption">Kelola akun administrator dan staf operasional hotel.</p>
        </div>
        <Button onClick={handleAdd}>Tambah Pegawai</Button>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '360px', flex: '1 1 240px' }}>
          <Input
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
          <label className="text-label">Filter Role</label>
          <select
            className="ui-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as '' | Role)}
          >
            <option value="">Semua role</option>
            <option value="admin">Admin</option>
            <option value="pegawai">Pegawai</option>
          </select>
        </div>
      </div>

      <Table columns={columns} data={users} keyExtractor={(u) => u.id} isLoading={isLoading} />

      {!isLoading && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span className="text-caption">
            {meta.total === 0
              ? 'Belum ada data pegawai'
              : `Menampilkan ${meta.from}-${meta.to} dari ${meta.total} akun (halaman ${meta.current_page} dari ${meta.last_page})`}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={meta.current_page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={meta.current_page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingUser ? 'Edit Pegawai' : 'Tambah Pegawai Baru'}
        width="450px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting}>
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
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            >
              {errorMsg}
            </div>
          )}
          <Input
            label="Nama Lengkap"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nama Anda"
            required
          />
          <Input
            label="Alamat Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="nama@aedohotel.com"
            required
          />
          <Input
            label={editingUser ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Minimal 8 karakter"
            hint="Minimal 8 karakter"
            required={!editingUser}
            autoComplete="new-password"
          />
          {formData.password.length > 0 && (
            <Input
              label="Konfirmasi Password"
              type="password"
              value={formData.password_confirmation}
              onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
              placeholder="Ulangi password baru"
              required
              autoComplete="new-password"
            />
          )}
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Peran (Role)</label>
            <select
              className="ui-select"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
            >
              <option value="pegawai">Pegawai (Operasional Kasir &amp; Kamar)</option>
              <option value="admin">Administrator (Akses Penuh)</option>
            </select>
          </div>
          {!(editingUser && isSelf(editingUser)) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="checkbox"
                id="is_active_checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="is_active_checkbox" className="text-body-small">
                Akun Aktif (Dapat Login ke Sistem)
              </label>
            </div>
          ) : (
            <p className="text-caption">
              Status akun Anda sendiri tidak dapat diubah dari halaman ini.
            </p>
          )}
        </div>
      </Drawer>

      <Modal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Hapus Akun Pegawai"
        maxWidth="420px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingUser(null)}>
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
            Hapus akun <strong>{deletingUser?.name}</strong> ({deletingUser?.email})?
          </p>
          <p className="text-caption">
            Akun yang sudah punya jejak operasional (reservasi, pembayaran, shift, housekeeping,
            maintenance) tidak akan dihapus — sistem akan menolaknya dan Anda cukup menonaktifkan akun
            tersebut.
          </p>
        </div>
      </Modal>
    </div>
  );
}
