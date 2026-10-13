import { useState, useEffect } from 'react';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Role } from '../../types';

import { api } from '../../lib/api';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
}

export default function UserList() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'pegawai' as Role,
    is_active: true,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/v1/users');
      const list = res.data.data || res.data;
      setUsers(Array.isArray(list) ? list : []);
    } catch (error: any) {
      console.error('Failed to fetch users', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    setErrorMsg('');
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'pegawai',
      is_active: true,
    });
    setIsDrawerOpen(true);
  };

  const handleEdit = (user: StaffUser) => {
    setEditingUser(user);
    setErrorMsg('');
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
    });
    setIsDrawerOpen(true);
  };

  const handleToggleActive = async (user: StaffUser) => {
    try {
      const endpoint = user.is_active
        ? `/api/v1/users/${user.id}/deactivate`
        : `/api/v1/users/${user.id}/activate`;
      await api.patch(endpoint);
      setUsers(users.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
    } catch (error) {
      console.error('Failed to change user status', error);
      alert('Gagal mengubah status aktif user.');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      if (editingUser) {
        await api.put(`/api/v1/users/${editingUser.id}`, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        });

        if (formData.password && formData.password.length >= 8) {
          await api.post(`/api/v1/users/${editingUser.id}/reset-password`, {
            password: formData.password,
          });
        }
      } else {
        await api.post('/api/v1/users', {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
      }
      setIsDrawerOpen(false);
      await fetchUsers();
    } catch (error: any) {
      console.error('Failed to save user', error);
      setErrorMsg(error.response?.data?.message || 'Gagal menyimpan data pegawai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<StaffUser>[] = [
    {
      key: 'name',
      header: 'Nama',
      cell: (u) => (
        <div>
          <span className="text-body-strong">{u.name}</span>
          <div className="text-body-small text-ink-500">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) => (
        <span
          style={{
            textTransform: 'uppercase',
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: u.role === 'admin' ? 'var(--primary-100)' : 'var(--surface-muted)',
            color: u.role === 'admin' ? 'var(--primary-800)' : 'var(--ink-700)',
          }}
        >
          {u.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status Akun',
      cell: (u) => (
        <StatusBadge
          type="shift"
          value={u.is_active ? 'open' : 'closed'}
        />
      ),
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      cell: (u) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleActive(u)}
          >
            {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleEdit(u)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-h1">Manajemen Pegawai</h1>
          <p className="text-body-small text-ink-500 mt-1">Kelola akun administrator dan staf operasional hotel.</p>
        </div>
        <Button onClick={handleAdd}>Tambah Pegawai</Button>
      </div>

      <Table
        columns={columns}
        data={users}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
      />

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
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!formData.name || !formData.email || (!editingUser && !formData.password)}
            >
              Simpan
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{ background: 'var(--color-error-50)', border: '1px solid var(--color-error-200)', color: 'var(--color-error-700)', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' }}>
              {errorMsg}
            </div>
          )}
          <Input
            label="Nama Lengkap"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Misal: Ahmad Fauzi"
            required
          />
          <Input
            label="Alamat Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="fauzi@aedohotel.com"
            required
          />
          <Input
            label={editingUser ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
            required={!editingUser}
          />
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="text-label">Peran (Role)</label>
            <select
              className="ui-select"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
            >
              <option value="pegawai">Pegawai (Operasional Kasir & Kamar)</option>
              <option value="admin">Administrator (Akses Penuh)</option>
            </select>
          </div>
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
        </div>
      </Drawer>
    </div>
  );
}
