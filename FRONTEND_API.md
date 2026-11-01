# Backend API Documentation — Aedo Hotel Syariah

> Dokumen ini adalah referensi lengkap backend untuk tim **frontend (React + TypeScript)**.
> Dibaca oleh AI yang membantu pengembangan frontend agar memahami kontrak API, aturan bisnis, dan struktur data.

---

## 1. Tech Stack & Konfigurasi

| Item | Detail |
|---|---|
| Framework | Laravel 11 (PHP 8.2+) |
| Auth | Laravel Sanctum — **mode SPA cookie** (session-based, bukan JWT Bearer) |
| Base URL | `http://localhost:8000` (local) |
| API Prefix | `/api/v1/` |
| Timezone | `Asia/Jakarta` (WIB) |
| Currency | IDR, semua angka uang adalah `decimal(12,2)` — tampilkan tanpa desimal |

---

## 2. Autentikasi

Backend menggunakan **Sanctum SPA Authentication** — artinya:

- **Bukan** `Authorization: Bearer <token>`
- Menggunakan **cookie session** + **CSRF token**
- Frontend dan backend harus di **domain yang sama atau subdomain** (mis. `app.domain.id` & `api.domain.id`)

### Setup Awal Frontend (wajib dilakukan sekali)

```ts
// 1. Ambil CSRF cookie sebelum login (sekali saja)
await axios.get('/sanctum/csrf-cookie', { withCredentials: true })

// 2. Login
await axios.post('/api/v1/auth/login', {
  email: 'admin@aedohotel.com',
  password: 'password'
}, { withCredentials: true })

// 3. Semua request berikutnya otomatis terautentikasi via cookie
// Pastikan withCredentials: true di semua request
```

### Konfigurasi Axios Global yang Disarankan

```ts
axios.defaults.withCredentials = true
axios.defaults.baseURL = 'http://localhost:8000'
// CSRF token otomatis dihandle Sanctum via cookie X-XSRF-TOKEN
```

### Endpoint Auth

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/sanctum/csrf-cookie` | Publik | Ambil CSRF cookie (wajib sebelum login) |
| `POST` | `/api/v1/auth/login` | Publik | Login (dibatasi 10 percobaan/menit per IP → 429) |
| `POST` | `/api/v1/auth/logout` | Auth | Logout |
| `GET` | `/api/v1/auth/me` | Auth | Data user yang sedang login |

**Body Login:**
```json
{ "email": "admin@aedohotel.com", "password": "password" }
```

**Response `/auth/me`:**
```json
{
  "data": {
    "id": 1,
    "name": "Admin",
    "email": "admin@aedohotel.com",
    "role": "admin",
    "is_active": true
  }
}
```

---

## 3. Role & Hak Akses

Hanya ada **2 role**:

| Role | Nilai | Kemampuan |
|---|---|---|
| Admin/Owner | `admin` | Akses penuh |
| Pegawai | `pegawai` | Terbatas (lihat tabel di bawah) |

**Apa yang bisa pegawai lakukan:**
- Login, lihat dashboard terbatas
- Buat/ubah/batalkan reservasi, input tamu
- Check-in, check-out
- Catat pembayaran (tunai/transfer), cetak invoice
- Upload bukti bayar
- Laporkan kerusakan kamar, update status housekeeping

**Yang hanya bisa admin:**
- CRUD users (pegawai)
- CRUD tipe kamar, kamar, layanan
- Verifikasi pembayaran transfer
- Lihat payment pending
- Laporan & export PDF/Excel
- Pengaturan sistem

---

## 4. Format Response API

### Sukses

```json
{
  "data": { ... },
  "meta": { ... }
}
```

### List dengan Paginasi

```json
{
  "data": [ ... ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 72
  }
}
```

### Error

```json
{
  "message": "Pesan error untuk pengguna",
  "errors": {
    "field_name": ["Pesan validasi field ini"]
  }
}
```

### HTTP Status Codes

| Kode | Arti |
|---|---|
| `200` | Sukses |
| `201` | Sukses dibuat |
| `401` | Belum login |
| `403` | Tidak punya izin |
| `404` | Tidak ditemukan |
| `409` | Konflik (mis. double booking) |
| `422` | Validasi gagal |

---

## 5. Enum Values (gunakan string literal ini)

### `booking.status`
| Value | Label |
|---|---|
| `pending` | Menunggu |
| `confirmed` | Dikonfirmasi |
| `checked_in` | Check-In |
| `checked_out` | Check-Out |
| `cancelled` | Dibatalkan |

### `booking.source`
`walk_in` | `phone` | `traveloka` | `other`

### `room.status`
| Value | Label |
|---|---|
| `available` | Tersedia |
| `booked` | Dipesan |
| `occupied` | Terisi |
| `cleaning` | Sedang Dibersihkan |
| `maintenance` | Perbaikan |

### `payment.method`
`cash` | `transfer` | `qris`

### `payment.type`
`dp` | `final` | `refund`

### `payment.status`
`pending` | `verified` | `failed`

### `invoice.status`
`draft` | `sent` | `paid` | `void`

### `housekeeping_task.status`
`pending` | `in_progress` | `completed`

### `maintenance.status`
`reported` | `in_progress` | `resolved`

### `shift.status`
`open` | `closed`

---

## 6. Semua Endpoint

> **Catatan:** semua endpoint kecuali auth dan webhook memerlukan autentikasi.

### 6.1 Users (Admin only)

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/users` | List user. Query: `search` (nama/email), `role`, `is_active`, `per_page` (1-100) |
| `POST` | `/api/v1/users` | Buat user baru |
| `GET` | `/api/v1/users/{id}` | Detail user |
| `PUT` / `PATCH` | `/api/v1/users/{id}` | Update user (termasuk `is_active`) |
| `DELETE` | `/api/v1/users/{id}` | Hapus user — ditolak 422 bila sudah punya jejak transaksi |
| `PATCH` | `/api/v1/users/{id}/activate` | Aktifkan akun |
| `PATCH` | `/api/v1/users/{id}/deactivate` | Nonaktifkan akun (cabut token; ditolak bila shift masih berjalan) |
| `POST` | `/api/v1/users/{id}/reset-password` | Reset password (minimal 8 karakter) |

Setiap baris list membawa `open_shifts_count` (jumlah shift berjalan akun itu) dan `last_login_at`.
Guard yang berlaku: tidak bisa menonaktifkan/menghapus/menurunkan role diri sendiri, admin aktif
terakhir tidak bisa dinonaktifkan, dan pegawai dengan shift berjalan belum boleh dinonaktifkan.
Semua aksi akun (create/update/activate/deactivate/password reset/delete) ditulis ke audit log.

**Body create/update user:**
```json
{
  "name": "Nama Pegawai",
  "email": "pegawai@email.com",
  "password": "password123",
  "role": "pegawai",
  "is_active": true
}
```

---

### 6.2 Settings

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/settings` | Publik | Branding + jam operasional + pajak (hanya field aman; dipakai halaman login) |
| `PUT` | `/api/v1/settings` | Admin | Update pengaturan; perubahan tercatat di audit log |

Tidak ada konfigurasi payment gateway di `settings` — fiturnya sudah dihapus, dan endpoint ini
tidak lagi menerima atau mengembalikan field kredensial apa pun.

Field kendali alur pembayaran: `min_dp_percentage` (ambang uang muka: DP terverifikasi sebesar ini
membuat booking `confirmed`/boleh check-in, 0 = tidak memaksa; sekaligus **nominal default** saat kasir
memilih "DP" di meja), `auto_verify_transfers` (verifikasi otomatis transfer/QRIS),
dan `auto_verify_max_amount` (plafon nilai yang boleh diverifikasi otomatis; 0 = tanpa plafon).

**Response settings:**
```json
{
  "data": {
    "hotel_name": "Aedo Hotel Syariah",
    "hotel_address": "...",
    "hotel_phone": "...",
    "default_check_in": "14:00:00",
    "default_check_out": "12:00:00",
    "tax_percentage": "11.00",
    "min_dp_percentage": "0.00",
    "auto_verify_transfers": true,
    "auto_verify_max_amount": "0.00"
  }
}
```

---

### 6.3 Dashboard

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/dashboard` | Semua | Statistik & notifikasi hari ini |

**Response dashboard:**
```json
{
  "data": {
    "today_checkins": 3,
    "today_checkouts": 2,
    "available_rooms": 8,
    "occupied_rooms": 5,
    "pending_payments": 2,
    "total_rooms": 13
  }
}
```

---

### 6.4 Tipe Kamar (Room Types)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/room-types` | Semua | List tipe kamar (paginated). Query: `search` (nama), `per_page` (1-200, default 15) |
| `POST` | `/api/v1/room-types` | Admin | Buat tipe kamar |
| `GET` | `/api/v1/room-types/{id}` | Semua | Detail tipe kamar |
| `PUT` / `PATCH` | `/api/v1/room-types/{id}` | Admin | Update tipe kamar; perubahan harga dicatat ke audit log |
| `DELETE` | `/api/v1/room-types/{id}` | Admin | Soft delete; ditolak HTTP 422 bila masih dipakai kamar |

Setiap item list membawa `rooms_count` (jumlah kamar aktif bertipe ini) untuk halaman "Kelola Tipe Kamar". Nama tipe kamar harus unik di antara data yang tidak dihapus; pesan validasi dikirim dalam bahasa Indonesia lewat `errors.{field}[0]`.

**Body:**
```json
{
  "name": "Deluxe",
  "price": 350000,
  "max_person": 2,
  "facilities": "AC, TV, WiFi, Kamar Mandi Dalam",
  "description": "Kamar nyaman dengan fasilitas lengkap"
}
```

---

### 6.5 Kamar (Rooms)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/rooms` | Semua | List kamar + status + tipe. Query: `per_page` (default 50, maks 200) |
| `POST` | `/api/v1/rooms` | Admin | Tambah kamar |
| `GET` | `/api/v1/rooms/{id}` | Semua | Detail kamar |
| `PUT` | `/api/v1/rooms/{id}` | Admin | Update kamar |
| `DELETE` | `/api/v1/rooms/{id}` | Admin | Soft delete |
| `PATCH` | `/api/v1/rooms/{id}/status` | Semua | Update status kamar |
| `GET` | `/api/v1/rooms/availability` | Semua | Cek ketersediaan kamar |

**Cek Ketersediaan:**
```
GET /api/v1/rooms/availability?check_in=2026-11-01&check_out=2026-11-03
```

**Response availability:**
```json
{
  "data": [
    {
      "id": 1,
      "room_number": "101",
      "floor": 1,
      "status": "available",
      "room_type": { "id": 1, "name": "Deluxe", "price": 350000 }
    }
  ]
}
```

---

### 6.6 Layanan Tambahan (Services)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/services` | Semua | List layanan (form reservasi butuh ini) |
| `POST` | `/api/v1/services` | Admin | Tambah layanan |
| `GET` | `/api/v1/services/{id}` | Semua | Detail layanan |
| `PUT` / `PATCH` | `/api/v1/services/{id}` | Admin | Update |
| `PATCH` | `/api/v1/services/{id}/activate` | Admin | Aktifkan kembali layanan |
| `DELETE` | `/api/v1/services/{id}` | Admin | **Nonaktifkan** (`is_active = false`), baris tidak dihapus agar histori `booking_services` tetap valid |

---

### 6.7 Pelanggan (Customers)

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/customers` | List pelanggan (+ `?search=nama/email/telepon`, `?per_page=` maks 100) |
| `POST` | `/api/v1/customers` | Tambah pelanggan |
| `GET` | `/api/v1/customers/{id}` | Detail |
| `PUT` / `PATCH` | `/api/v1/customers/{id}` | Update |
| `DELETE` | `/api/v1/customers/{id}` | **Admin only.** Ditolak 422 bila tamu sudah punya reservasi (riwayat wajib disimpan) |

> No. KTP dienkripsi di database dan tidak pernah dikirim ke log/audit.

---

### 6.8 Reservasi (Bookings)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/bookings` | Semua | List reservasi. Query: `status` (boleh multi nilai, mis. `pending,confirmed`), `search` (kode booking/nama tamu), `per_page` (1-100) |
| `POST` | `/api/v1/bookings` | Semua | Buat reservasi baru |
| `GET` | `/api/v1/bookings/{id}` | Semua | Detail reservasi |
| `POST` | `/api/v1/bookings/{id}/confirm` | Semua | Konfirmasi manual reservasi `pending` → `confirmed` (jalur Traveloka / kredit hotel). Bila `min_dp_percentage` > 0, pegawai wajib memenuhi ambang DP; admin boleh melewati (tercatat di audit log) |
| `POST` | `/api/v1/bookings/{id}/check-in` | Semua | Proses check-in |
| `POST` | `/api/v1/bookings/{id}/check-out` | Semua | Proses check-out |
| `POST` | `/api/v1/bookings/{id}/cancel` | Semua | Batalkan reservasi (invoice ikut di-`void`) |
| `POST` | `/api/v1/bookings/{id}/services` | — | ⚠ **Belum tersedia** (layanan hanya bisa dikirim saat membuat booking) |

**Body buat reservasi:**
```json
{
  "customer_id": 1,
  "source": "walk_in",
  "check_in": "2026-11-10",
  "check_out": "2026-11-12",
  "guest_count": 2,
  "rooms": [1, 2],
  "guests": [
    { "name": "Budi Santoso", "ktp": "1234567890", "phone": "0812xxx", "is_primary": true },
    { "name": "Siti Rahma", "is_primary": false }
  ],
  "discount_amount": 0,
  "notes": "Minta kamar di lantai atas"
}
```

**Setiap baris reservasi membawa ringkasan pembayaran yang dihitung backend** (jangan hitung ulang di frontend):
```json
{
  "invoice_total": "1110000.00",
  "paid_verified": "500000.00",
  "paid_pending": "0.00",
  "remaining_due": "610000.00",
  "dp_min_amount": "111000.00",
  "dp_shortfall": "0.00",
  "has_pending_payment": false,
  "blocks_manual_payment": false
}
```

> `remaining_due` = tagihan − verified − **pending**. Pembayaran yang masih menunggu verifikasi
> admin dihitung sebagai "uang sudah dalam perjalanan", jadi tidak ditagih lagi saat check-in.
> `dp_min_amount` = `min_dp_percentage` × tagihan; `dp_shortfall` = sisa kekurangan DP terhadap ambang
> itu (0 bila sudah terpenuhi atau tidak diwajibkan). Frontend memakainya untuk mengisi nominal
> DP otomatis dan menampilkan status DP — angkanya tidak dihitung ulang di browser.
> `blocks_manual_payment` = true bila ada payment berstatus pending.

**Aturan check-in, bayar, dan konfirmasi:**

| Keadaan reservasi | Yang ditampilkan / diizinkan |
|---|---|
| `pending`, belum ada payment | "Bayar & Check-In" (tunai/DP di meja) |
| payment `pending` | "Menunggu Verifikasi" — penagihan baru ditolak 422; admin bisa verifikasi lalu lanjut check-in |
| DP terverifikasi ≥ ambang, status `pending` | "Konfirmasi & Check-In" (otomatis `confirmed` oleh backend begitu ambang tercapai) |
| `confirmed` | "Check-In" langsung |

**Response booking:**
```json
{
  "data": {
    "id": 1,
    "booking_code": "BK-20261110-XXXX",
    "status": "confirmed",
    "check_in": "2026-11-10",
    "check_out": "2026-11-12",
    "total_price": 750000,
    "customer": { "id": 1, "name": "Budi Santoso" },
    "booking_rooms": [...],
    "invoice": { "id": 1, "status": "draft", "total": "825000.00" }
  }
}
```

> **Aturan bisnis penting:**
> - Harga & pajak dihitung di backend, jangan kirim total dari frontend
> - Double booking / kamar maintenance / kamar occupied hari ini → **HTTP 409** dengan rincian kamar di field `error`
> - `discount_amount` boleh dikirim saat membuat booking, maksimal = subtotal (lebih besar → 422) dan dicatat ke audit log
> - Check-out ditolak jika tagihan belum lunas → HTTP 422
> - Booking berstatus `checked_in`/`checked_out`/`cancelled` tidak bisa dibatalkan lagi → HTTP 422
> - Check-in **wajib** status `confirmed` → HTTP 422 dengan pesan sebabnya
> - Selama masih ada pembayaran `pending`, payment baru ditolak → HTTP 422
> - Batal menghapus tagihan: invoice aktif otomatis berubah menjadi `void`

---

### 6.9 Shift

> Pegawai **wajib** memulai shift sebelum mencatat transaksi.

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/shifts/start` | Pegawai | Mulai shift |
| `POST` | `/api/v1/shifts/end` | Pegawai | Akhiri shift |
| `GET` | `/api/v1/shifts/current` | Pegawai | Shift yang sedang berjalan |
| `GET` | `/api/v1/shifts` | Admin | Semua shift |

---

### 6.10 Invoice

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/invoices` | Semua | List invoice |
| `GET` | `/api/v1/invoices/{id}` | Semua | Detail invoice |
| `GET` | `/api/v1/invoices/{id}/pdf` | Semua | ⚠ **Belum tersedia** — endpoint PDF invoice belum diimplementasikan |
| `POST` | `/api/v1/bookings/{id}/invoice` | Semua | Buat invoice manual |
| `POST` | `/api/v1/invoices/{id}/recalculate` | Semua | Recalculate total |

**Response invoice:**
```json
{
  "data": {
    "id": 1,
    "invoice_number": "INV-20261110-0001",
    "booking_id": 1,
    "status": "draft",
    "subtotal": "700000.00",
    "discount": "0.00",
    "tax": "77000.00",
    "total": "777000.00"
  }
}
```

---

### 6.11 Pembayaran (Payments)

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/payments` | Semua | Daftar pembayaran (halaman Pembayaran). Query: `status`, `method`, `type`, `search`, `per_page` (1-100) |
| `POST` | `/api/v1/bookings/{id}/payments` | Semua* | Catat pembayaran manual |
| `GET` | `/api/v1/payments/{id}` | Semua | Detail pembayaran |
| `POST` | `/api/v1/payments/{id}/proof` | Semua | Upload bukti transfer (jpg/png/pdf maks 5 MB) |
| `PATCH` | `/api/v1/payments/{id}/verify` | **Admin only** | Verifikasi manual (dipakai hanya bila aturan otomatis tidak terpenuhi) |
| `POST` | `/api/v1/payments/{id}/reverse` | **Admin only** | Pembatalan (reversal) pembayaran yang sudah verified, wajib `reason` — kontrol post-audit |

**Aturan verifikasi otomatis (pengganti approval admin):**

| Jalur | Kapan jadi `verified` |
|---|---|
| Tunai | Langsung saat dicatat (kasir + shift = akuntabilitasnya) |
| Transfer / QRIS manual | Otomatis bila `auto_verify_transfers` aktif **dan** nomor referensi terisi unik (belum pernah dipakai payment lain) **dan** bukti terunggah **dan** nominal tidak membuat verified+pending melebihi tagihan **dan** tidak melewati `auto_verify_max_amount`. Kalau ada satu syarat kurang → tetap `pending`, butuh approve admin |

Setiap keputusan otomatis ditulis ke `audit_logs` (`payment.auto_verified`)
dengan `verified_by = NULL` sebagai penanda "sistem". Admin tetap bisa membatalkan lewat `reverse`
selama tamu belum check-out/batal.

> **Tidak ada payment gateway.** Semua pembayaran masuk lewat `POST /api/v1/bookings/{id}/payments`
> (tunai/transfer/QRIS) dan dinilai oleh aturan di atas. Tidak ada endpoint `.../payments/gateway`,
> `.../sync`, `sync-pending`, `payment-result`, webhook, maupun sandbox bayar.
> Status `expired` juga tidak dipakai lagi — pembayaran yang tidak selesai ditolak admin (`failed`).

> \*) **Pegawai wajib punya shift berjalan** untuk mencatat pembayaran.
> Tanpa shift, endpoint itu membalas **403** dengan pesan
> "Anda harus memulai shift terlebih dahulu sebelum mencatat transaksi."

**Body catat pembayaran:**
```json
{
  "amount": 777000,
  "method": "cash",
  "type": "final",
  "notes": "Dibayar tunai saat check-in"
}
```

> **Aturan:**
> - `cash` → langsung `verified` (tidak perlu verifikasi admin)
> - `transfer` → status `pending`, perlu upload bukti, verifikasi admin
> - Tidak bisa melebihi total invoice (`HTTP 422`)

**Upload bukti transfer:**
```ts
const formData = new FormData()
formData.append('proof', file)
await axios.post(`/api/v1/payments/${paymentId}/proof`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
```

---

### 6.12 Housekeeping

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/housekeeping-tasks` | Semua | List tugas kebersihan |
| `PATCH` | `/api/v1/housekeeping-tasks/{id}` | Semua | Update status + catatan |

**Body update housekeeping:**
```json
{
  "status": "completed",
  "notes": "Sudah dibersihkan dan dilaporkan bersih"
}
```

> Saat status → `completed`, kamar otomatis berubah ke `available`.

---

### 6.13 Maintenance

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/maintenance` | Semua | List laporan kerusakan |
| `POST` | `/api/v1/maintenance` | Semua | Laporkan kerusakan |
| `GET` | `/api/v1/maintenance/{id}` | Semua | Detail |
| `PUT` | `/api/v1/maintenance/{id}` | Admin | Update |
| `PATCH` | `/api/v1/maintenance/{id}/status` | Semua | Update status |

---

### 6.14 Review

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/reviews` | Admin | Semua review |
| `POST` | `/api/v1/bookings/{id}/review` | Semua | Input review (setelah check-out) |

**Body review:**
```json
{
  "rating": 5,
  "comment": "Kamar bersih, pelayanan ramah"
}
```

---

### 6.15 Laporan (Admin only)

Semua laporan mendukung parameter:
- `?from=2026-11-01&to=2026-11-30` — filter periode (default: awal bulan s/d hari ini)
- `?format=json` — **default**; payload inilah yang dibaca layar Laporan di aplikasi (angka, grafik, tabel)
- `?format=pdf` — download file PDF
- `?format=xlsx` — download file Excel

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/reports/summary` | Ringkasan semua laporan + pembanding periode sebelumnya. Ini satu-satunya laporan yang ditampilkan di layar Pusat Laporan dan ikut bisa diunduh PDF/Excel |
| `GET` | `/api/v1/reports/occupancy` | Tingkat okupansi kamar |
| `GET` | `/api/v1/reports/revenue` | Pendapatan harian |
| `GET` | `/api/v1/reports/reservations` | Daftar reservasi |
| `GET` | `/api/v1/reports/transactions` | Transaksi pembayaran |
| `GET` | `/api/v1/reports/payment-methods` | Rekapitulasi per metode bayar |
| `GET` | `/api/v1/reports/shifts` | Laporan per shift pegawai |
| `GET` | `/api/v1/reports/sources` | Sumber reservasi (walk-in, traveloka, dll) |
| `GET` | `/api/v1/reports/housekeeping` | Laporan housekeeping |

**Yang sudah disediakan payload JSON** supaya layar laporan tidak perlu menghitung ulang:

| Laporan | Angka siap pakai | Daftar baris |
|---|---|---|
| `summary` | `revenue.*`, `occupancy.*`, `reservations.by_status`, `housekeeping.*`, `shifts.*`, `rooms.*`, `highlights.*` | `revenue_trend`, `payment_mix`, `booking_sources` |
| `revenue` | `average_per_day`, `average_per_txn`, `cash/transfer/qris_revenue`, `pending_*`, `refund_total`, `best_day` | `daily[]` |
| `occupancy` | `occupancy_rate`, `empty_room_nights`, `idle_rooms`, `busiest_room` | `per_room[]` (`room_type`, `room_rate`) |
| `reservations` | `summary.total_value`, `average_value`, `average_nights`, `collected`, `outstanding`, `cancellation_rate` | `bookings[]` |
| `transactions` | `summary.total_amount`, `verified_amount`, `pending_amount`, `failed_amount`, `refund_amount` | `payments[]`, `by_status[]`, `by_method[]` |
| `payment-methods` | `total_amount`, `total_count` | `data[]` (`label`, `share_percent`, `count_percent`, `average`) |
| `shifts` | `summary.total_collected`, `average_collected`, `open_shifts` | `shifts[]` (`duration_hours`) |
| `sources` | `total_count`, `total_revenue` | `data[]` (`label`, `share_percent`, `average_value`) |
| `housekeeping` | `summary.completion_rate`, `average_hours`, `unassigned` | `tasks[]`, `by_staff[]` |

Setiap laporan detail juga mengirim `comparison` (periode sebelumnya dengan panjang sama).

**Layar Laporan (Admin) hanya menampilkan Ringkasan.** Delapan tab laporan detail sudah dihapus dari aplikasi; endpoint-nya tetap ada untuk kebutuhan QA/Postman/integrasi (`?format=json|pdf|xlsx`). Ringkasan bisa diunduh sebagai `?format=pdf` (satu dokumen berisi tabel ukuran utama, metode bayar, sumber, status reservasi, operasional, tren harian, sorotan) atau `?format=xlsx` (baris `Bagian | Ukuran | Nilai`).

Aturan penting untuk frontend:
- `comparison.change_percent` bisa `null` bila periode pembanding kosong. Tampilkan "Belum ada pembanding", **bukan** 0%.
- Kolom uang agregat sudah berupa angka dari server. Kolom model lama (`total_price`, `amount`) masih string desimal — pakai `Number()` sebelum berhitung.
- Laporan tidak membawa KTP tamu; cukup nama tamu untuk identifikasi.

**Contoh download PDF di React:**
```ts
const downloadPdf = async (type: string) => {
  const response = await axios.get(`/api/v1/reports/${type}?format=pdf`, {
    responseType: 'blob',
    withCredentials: true
  })
  const url = URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = `laporan-${type}.pdf`
  link.click()
}
```

---

## 7. Alur Kerja Kritis

### Alur Reservasi Lengkap

```
[Cek Kamar Tersedia]
GET /rooms/availability?check_in=&check_out=

[Buat Reservasi]
POST /bookings
↓
Status: confirmed (otomatis jika ada DP)
Invoice: draft (otomatis dibuat)

[Tambah Layanan (opsional)]
POST /bookings/{id}/services

[Bayar]
POST /bookings/{id}/payments  ← cash / transfer / qris (dicatat staf)

[Check-In]
POST /bookings/{id}/check-in
↓ Kamar → occupied

[Tambah Layanan Saat Menginap (opsional)]
POST /bookings/{id}/services

[Check-Out]
POST /bookings/{id}/check-out  ← GAGAL jika belum lunas
↓
Booking → checked_out
Kamar → cleaning
Housekeeping task dibuat otomatis
```

### Alur Pembayaran Transfer

```
POST /payments  { method: "transfer" }
↓ status: pending

POST /payments/{id}/proof  ← upload bukti

PATCH /payments/{id}/verify  ← Admin verifikasi
↓ status: verified
↓ Jika lunas → Invoice: paid
```

---

### 7.1 Uang muka (DP) di meja

1. Ambang dan nominal DP dihitung di SATU tempat: `Booking::dp_min_amount` = `min_dp_percentage`
   × tagihan, `Booking::dp_shortfall` = kurang berapa lagi supaya ambang terpenuhi. Keduanya ikut
   terkirim pada setiap baris reservasi, jadi frontend tidak meniru rumusnya.
2. `POST /bookings/{id}/payments` menerima `type` (`dp` | `final`) dan `amount`. DP terverifikasi
   membuat payment `verified` dan reservasi otomatis `confirmed` (uang muka mengunci kamar, check-in
   lalu jalan) sementara invoice **tetap belum** `paid` - di situ bedanya pelunasan. Sisa tagihan
   berikutnya otomatis sebesar sisa yang benar, bukan tagihan penuh.
3. Form "Catat Pembayaran" dan modal pembayaran di Daftar Reservasi bisa memilih DP atau pelunasan;
   saat DP dipilih, nominal terisi otomatis sebesar kekurangan ambang.
4. Nominal ≤ 0 atau melebihi sisa tagihan, dan penagihan saat ada pembayaran menunggu verifikasi,
   ditolak 422 dengan alasan yang bisa dibaca kasir.

---

## 8. Struktur Database (Relasi Penting)

```
users (admin | pegawai)
  └── shifts (satu shift per sesi kerja)

customers
  └── bookings
        ├── booking_rooms (kamar yang dibooking, snapshot harga)
        ├── booking_guests (tamu yang menginap)
        ├── booking_services (layanan tambahan)
        ├── invoice (1 per booking)
        │     └── payments (DP, final, refund)
        └── review (1 per booking)

rooms
  ├── room_type (kategori & harga dasar)
  ├── housekeeping_tasks (tugas kebersihan)
  ├── maintenance (laporan kerusakan)
  └── room_status_logs (riwayat perubahan status)

audit_logs (aksi penting)
```

---

## 9. Kredensial Default (Development)

```
Admin:
  email: admin@aedohotel.com
  password: password

Pegawai:
  email: pegawai@aedohotel.com
  password: password
```

---

## 10. Menjalankan Backend

```bash
# Install dependencies
composer install

# Setup environment
cp .env.example .env
php artisan key:generate

# Setup database
php artisan migrate --seed

# Jalankan server
php artisan serve

# Jalankan scheduler (backup)
php artisan schedule:work

# Jalankan test
php artisan test
```

---

## 11. Catatan Penting untuk Frontend

1. **CSRF:** Selalu panggil `GET /sanctum/csrf-cookie` sebelum login pertama kali.
2. **Cookies:** Set `withCredentials: true` pada semua request Axios/Fetch.
3. **Domain:** Di production, pastikan `SANCTUM_STATEFUL_DOMAINS` di `.env` backend mencakup domain frontend.
4. **Harga:** Semua kalkulasi harga dilakukan backend. Jangan kirim `total` dari frontend.
5. **KTP:** Field `ktp` dienkripsi di database — tidak akan muncul di response kecuali endpoint yang memang membutuhkannya.
6. **Shift:** Jika pegawai mencoba mencatat transaksi tanpa shift aktif, backend akan mengembalikan error — tampilkan peringatan di UI.
7. **Soft Delete:** Kamar dan tipe kamar menggunakan soft delete — data tidak hilang dari database meskipun di-delete via API.
8. **Tidak ada payment gateway.** Tidak ada tombol sync/sandbox di UI dan tidak ada webhook yang perlu
   dipanggil. Semua pembayaran dibuat lewat `POST /api/v1/bookings/{id}/payments`.
9. **Status "menunggu verifikasi" tidak lagi berarti harus ada admin:** transfer/QRIS dengan bukti +
   nomor referensi unik terverifikasi otomatis oleh backend.

---

*Dokumen ini dibuat otomatis berdasarkan implementasi backend Sprint 1–7. Perbarui dokumen ini jika ada perubahan API.*
