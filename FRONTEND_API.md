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
- Lihat log gateway, payment pending/expired
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
`cash` | `transfer` | `qris` | `payment_gateway`

### `payment.type`
`dp` | `final` | `refund`

### `payment.status`
`pending` | `verified` | `failed` | `expired`

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

`payment_gateway_config` bersifat **write-only**: nilainya dienkripsi di database dan tidak pernah
dikembalikan oleh endpoint mana pun. `payment_gateway_provider` boleh dibaca, konfigurasinya tidak.

Field kendali alur pembayaran: `min_dp_percentage` (ambang DP sebelum booking bisa
`confirmed`/check-in, 0 = tidak memaksa), `auto_verify_transfers` (verifikasi otomatis transfer/QRIS),
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
    "auto_verify_max_amount": "0.00",
    "payment_expiry_minutes": 60
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
  "has_pending_payment": false,
  "blocks_manual_payment": false
}
```

> `remaining_due` = tagihan − verified − **pending**. Pembayaran yang masih menunggu verifikasi
> admin dihitung sebagai "uang sudah dalam perjalanan", jadi tidak ditagih lagi saat check-in.
> `blocks_manual_payment` = true bila ada transfer/QRIS **manual** berstatus pending.

**Aturan check-in, bayar, dan konfirmasi:**

| Keadaan reservasi | Yang ditampilkan / diizinkan |
|---|---|
| `pending`, belum ada payment | "Bayar & Check-In" (tunai/DP di meja) |
| payment manual `pending` | "Menunggu Verifikasi" — penagihan baru ditolak 422; admin bisa verifikasi lalu lanjut check-in |
| QR gateway `pending` | Penagihan manual masih boleh (QR bisa kedaluwarsa) |
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
> - Selama masih ada pembayaran manual `pending`, payment baru (manual/gateway) ditolak → HTTP 422
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
| `POST` | `/api/v1/payments/{id}/sync` | Semua | Tanya status transaksi ke gateway (pemulihan webhook yang hilang). Body opsional `transaction_id` = transaction_id Midtrans yang dibawa callback Snap JS / URL redirect; ia hanya petunjuk, keputusan tetap dari gateway. Field balik: `gateway_status`, `gateway_found`, `payment_status`, `changed`. `gateway_found=false` = transaksi belum tercatat di gateway; `message` berisi alasannya |
| `POST` | `/api/v1/payments/sync-pending` | Semua | Sinkronkan SEMUA payment gateway yang masih pending ke gateway (dipanggil otomatis saat halaman Daftar Pembayaran & Reservasi dibuka, dijeda ≥30 detik + `throttle:6,1`). Urutannya seperti scheduler: tanya status dulu, baru tandai melewati batas waktu. Field balik: `changed` (jumlah payment yang statusnya bergerak), `expired`, `message` |
| `GET` | `/api/payment-result/{order_id}` | **Publik (tanpa login)** | Halaman hasil untuk tamu; dituju oleh `callbacks.finish` Midtrans. Membaca status dari database kami dan, bila masih pending, menanya gateway sekali — parameter `?status=` di URL **tidak pernah** dipercaya. Respons hanya `booking_code`, `amount`, `payment_status`, `booking_status`, `paid_at`, `provider`, `environment`, `message` (tanpa nama/telepon/KTP). Throttle 20/menit |
| `POST` | `/api/v1/bookings/{id}/payments/gateway` | Semua* | Buat permintaan gateway. Body `channel`: **`auto`** (default — Midtrans menampilkan semua metode yang aktif di Merchant Account, tamu memilih sendiri di popup), atau paksa satu kanal: `qris` / `va` / `ewallet`. Response `payment_info`: `transaction_id` (order id kita), `token`, `redirect_url`, `qr_string`, `snap_js_url`, `client_key`, `amount`, `environment` (sandbox/production). `token` + `snap_js_url` + `client_key` dipakai frontend untuk membuka halaman bayar otomatis lewat Snap.js (client key publik; server key tidak pernah dikirim ke browser) |

**Aturan verifikasi otomatis (pengganti approval admin):**

| Jalur | Kapan jadi `verified` |
|---|---|
| Tunai | Langsung saat dicatat (kasir + shift = akuntabilitasnya) |
| Transfer / QRIS manual | Otomatis bila `auto_verify_transfers` aktif **dan** nomor referensi terisi unik (belum pernah dipakai payment lain) **dan** bukti terunggah **dan** nominal tidak membuat verified+pending melebihi tagihan **dan** tidak melewati `auto_verify_max_amount`. Kalau ada satu syarat kurang → tetap `pending`, butuh approve admin |
| Payment gateway | Otomatis dari webhook bertanda tangan, dari `POST /payments/{id}/sync`, dari `POST /payments/sync-pending` saat halaman dibuka, saat check-in/check-out (rekonsiliasi per reservasi), atau dari scheduler (sync dulu, baru expired). Tidak pernah atas dasar pengakuan pengguna sistem |

Setiap keputusan otomatis ditulis ke `audit_logs` (`payment.auto_verified`, `payment.gateway_verified`)
dengan `verified_by = NULL` sebagai penanda "sistem". Admin tetap bisa membatalkan lewat `reverse`
selama tamu belum check-out/batal.

> \*) **Pegawai wajib punya shift berjalan** untuk mencatat pembayaran (manual maupun gateway).
> Tanpa shift, kedua endpoint itu membalas **403** dengan pesan
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

**Body buat pembayaran gateway:**
```json
{ "channel": "qris" }
```
> Channel yang tersedia: `qris` | `va` | `ewallet`

**Response gateway payment:**
```json
{
  "data": { "id": 5, "gateway_transaction_id": "SIM-ABCDEF123456", "expires_at": "..." },
  "payment_info": {
    "qr_string": "SIMULATOR_QR_SIM-ABCDEF123456_AMOUNT_777000",
    "transaction_id": "SIM-ABCDEF123456",
    "amount": 777000
  }
}
```

**Upload bukti transfer:**
```ts
const formData = new FormData()
formData.append('proof', file)
await axios.post(`/api/v1/payments/${paymentId}/proof`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
```

---

### 6.12 Webhook Gateway (PUBLIK)

| Method | URL | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/api/webhooks/payment-gateway` | ❌ Tidak perlu | Callback dari payment gateway |

**Kontrak payload (divalidasi ketat):**

```json
{
  "transaction_id": "SIM-AB12CD34EF56",
  "event": "payment.settled",
  "status": "paid",
  "amount": 388500.00
}
```

| Aturan | Perilaku kalau dilanggar |
|---|---|
| Header `X-Simulator-Signature` wajib HMAC-SHA256 atas badan **raw** (kanonik `"<timestamp>.<body>"` bila `X-Simulator-Timestamp` dikirim) | `401 { "status": "rejected" }`, payment tetap `pending`, log tersimpan dengan `signature_valid=false` + `payment_id` (untuk forensik) |
| `X-Simulator-Timestamp` harus berusia ≤ 5 menit | `401` — penahan replay dari webhook yang tertangkap/disimpan |
| `amount` wajib **sama persis** dengan `payments.amount` (toleransi Rp 0,01) | `422 { "status": "amount_mismatch" }`, status tidak diubah |
| `transaction_id` tidak dikenal | `200 { "status": "ignored" }` |
| Webhook datang dua kali untuk transaksi yang sudah lunas | `200 { "status": "skipped" }` (idempoten: `paid_at` & audit tidak berubah) |
| Settlement tiba setelah QR `expired`/`failed` | Tetap diproses `verified` + catatan "perlu rekonsiliasi admin" di `notes` |

Semua yang masuk — valid maupun ditolak — tercatat di `payment_gateway_logs`.

> **Catatan frontend:** endpoint ini untuk gateway, bukan untuk dipanggil aplikasi. Kalau butuh mensimulasikan
> pembayaran saat demo, pakai endpoint sandbox di bagian 6.14.

---

### 6.13 Log Gateway (Admin only)

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/payment-gateway-logs` | Lihat semua log webhook |

Query params: `?provider=simulator&processed=true&signature_valid=false`

---

### 6.14 Sandbox Payment Gateway (non-produksi)

Meniru provider asli: endpoint ini hanya **mengirim webhook bertanda tangan yang sah** ke jalur
pembayaran normal — jadi cek signature, kecocokan nominal, dan idempotensi tetap berlaku.

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/sandbox/gateway/{transactionId}/pay` | Login staf | Dipakai tombol "Bayar (Sandbox)" di halaman Pembayaran |
| `POST` | `/api/sandbox/gateway/{transactionId}/pay` | Header `X-Sandbox-Token` | Untuk Postman/cURL (token = `PG_SIMULATOR_SECRET`) |

Body opsional: `amount` (default = nominal tagihan; kirim nilai lain untuk menguji penolakan),
`status` (`paid` default, `expire`, `cancel`).

Response: `webhook_status` (`processed`/`skipped`/`amount_mismatch`/`rejected`/`ignored`),
`payment_status`, `booking_status`, `invoice_status`.

Pengaman: `404` bila `APP_ENV=production` atau provider aktif bukan simulator/sandbox, `401` bila tidak
login dan token salah, `throttle:30,1`, dan secret sandbox tidak pernah dikirim ke frontend.

---

### 6.14 Housekeeping

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

### 6.15 Maintenance

| Method | URL | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/maintenance` | Semua | List laporan kerusakan |
| `POST` | `/api/v1/maintenance` | Semua | Laporkan kerusakan |
| `GET` | `/api/v1/maintenance/{id}` | Semua | Detail |
| `PUT` | `/api/v1/maintenance/{id}` | Admin | Update |
| `PATCH` | `/api/v1/maintenance/{id}/status` | Semua | Update status |

---

### 6.16 Review

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

### 6.17 Laporan (Admin only)

Semua laporan mendukung parameter:
- `?from=2026-11-01&to=2026-11-30` — filter periode
- `?format=json` — default, kembalikan JSON
- `?format=pdf` — download file PDF
- `?format=xlsx` — download file Excel

| Method | URL | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/reports/occupancy` | Tingkat okupansi kamar |
| `GET` | `/api/v1/reports/revenue` | Pendapatan harian |
| `GET` | `/api/v1/reports/reservations` | Daftar reservasi |
| `GET` | `/api/v1/reports/transactions` | Transaksi pembayaran |
| `GET` | `/api/v1/reports/payment-methods` | Rekapitulasi per metode bayar |
| `GET` | `/api/v1/reports/shifts` | Laporan per shift pegawai |
| `GET` | `/api/v1/reports/sources` | Sumber reservasi (walk-in, traveloka, dll) |
| `GET` | `/api/v1/reports/housekeeping` | Laporan housekeeping |

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
POST /bookings/{id}/payments  ← cash/transfer
POST /bookings/{id}/payments/gateway  ← QRIS/VA

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

### Alur Gateway Payment

```
POST /bookings/{id}/payments/gateway  { channel: "qris" }
↓ Tampilkan QR ke tamu

[Tamu bayar]

POST /api/webhooks/payment-gateway  ← Dikirim gateway (otomatis)
↓ Signature diverifikasi
↓ Payment: verified
↓ Invoice: paid (jika lunas)
```

---

### 7.1 Memakai Midtrans Sandbox (provider asli)

Backend sudah punya `MidtransGateway` (Snap API) dan sudah **diuji langsung ke server Midtrans sandbox**.
Untuk pindah dari simulator lokal ke Midtrans sandbox:

1. Daftar Merchant Account Midtrans, buka **My Settings → Access Keys**, aktifkan kanal yang dipakai
   (QRIS / BCA VA / DANA) di **Payment Channels**.
2. Isi `.env`:
   ```dotenv
   PG_PROVIDER=midtrans
   PG_MIDTRANS_SERVER_KEY=Mid-server-xxxxxxxx
   PG_MIDTRANS_CLIENT_KEY=Mid-client-xxxxxxxx
   PG_MIDTRANS_IS_PRODUCTION=false
   ```
   Prefiks kunci **tidak** dipakai untuk menentukan environment: Midtrans punya lebih dari satu gaya
   penamaan sandbox key (`SB-Mid-server-…` dan `Mid-server-…`), jadi yang dipakai adalah flag
   `PG_MIDTRANS_IS_PRODUCTION` dan jawabannya diverifikasi dengan perintah nyata ke Midtrans:
   ```bash
   php artisan payment:test-connection
   ```
   `ok=true` berarti kunci diterima di environment itu. HTTP 401/403 = kunci/environment salah;
   HTTP 404 = endpoint lookup memang tidak ada di host tersebut.
3. **Midtrans memisahkan host** (hasil verifikasi langsung, penting saat debugging):

   | Kebutuhan | Sandbox | Production |
   |---|---|---|
   | Buat transaksi + halaman bayar (Snap) | `https://app.sandbox.midtrans.com` | `https://app.midtrans.com` |
   | Cek status transaksi (`/v2/{order_id}/status`) | `https://api.sandbox.midtrans.com` | `https://api.midtrans.com` |

   Memanggil `/v2/...` di host `app.*` dijawab **HTTP 404** (endpoint-nya memang tidak di sana).
4. Set **Notification URL** di Midtrans ke `https://<domain-anda>/api/webhooks/payment-gateway`.
   Lokal butuh HTTPS tunnel (ngrok/cloudflared) supaya Midtrans bisa mengirim callback.
5. **Tanpa tunnel tetap bisa uji end-to-end**, karena sistem punya jalur pemulihan status:
   1. Buat pembayaran gateway → buka `redirect_url` Midtrans di browser (halaman Snap sandbox) dan
      selesaikan pembayarannya memakai simulator pembayaran Midtrans.
   2. Setelah tamu membuka/membayar, transaksi baru **tercatat di ledger Midtrans**. Tekan
      **Cek Status** (`POST /api/v1/payments/{id}/sync`) — sistem menanyakan `/v2/{order_id}/status`,
      dan kalau `settlement` maka payment jadi `verified`, invoice lunas, booking `confirmed`
      otomatis (tanpa approval admin).

      Sebelum halaman Snap dibuka, sync menjawab `gateway_found=false` dengan pesan
      "Transaksi belum tercatat di Midtrans" — ini kondisi normal, bukan error, dan **tidak pernah**
      dianggap lunas.
6. **Perilaku otomatis di aplikasi (frontend `src/lib/midtransSnap.ts`):** begitu pembayaran gateway
   dibuat, halaman bayar Midtrans **langsung tampil sendiri** memakai Snap.js
   (`window.snap.pay(token)`) sebagai overlay di dalam aplikasi — staf tidak perlu menekan tautan.
   Urutan cadangan: Snap.js → `window.open(redirect_url)` (tab baru) → tombol **Buka Pembayaran**
   bila browser memblokir popup. Status lalu diikuti otomatis: setiap kali Snap.js menutup/pending
   dan setiap 20 detik selama modal terbuka, frontend memanggil `POST /payments/{id}/sync`; ketika
   gateway menjawab settlement, invoice lunas dan booking terkonfirmasi tanpa langkah manual.
   Pembayaran pending yang tertinggal dapat dibuka lagi dari **Daftar Pembayaran** dengan tombol
   yang sama. Environment (sandbox/production) tidak bisa dipilih frontend karena `snap_js_url`
   dan `client_key` datang dari backend.
   > Snap.js versi ini membuat `<iframe id="snap-midtrans">` di dokumen kita dan menampilkannya
   > sebagai overlay (bukan `window.open`), jadi tidak terkena popup blocker. Opsi `pay()`
   > **hanya** yang dikenal SDK: `onSuccess`, `onPending`, `onError`, `onClose`,
   > `skipOrderSummary`, `autoCloseDelay`, `language`, `enabledPayments`. Mengirim key lain
   > melempar `Error("Unsupported option ...")` dan overlay tidak muncul sama sekali — frontend
   > kini menangkap error itu, membatasi load script dengan timeout, lalu jatuh ke tautan/tab baru
   > dengan alasan yang ditampilkan, jadi tidak ada lagi status "menyiapkan..." yang menggantung.
7. **Daftar metode bayar di popup = pengaturan Merchant Account, bukan kode aplikasi.**
   `channel=auto` (default) mengirim permintaan Snap **tanpa** `enabled_payments`, jadi Midtrans
   menampilkan QRIS, virtual account, e-wallet, kartu kredit, dan kanal lain yang aktif di
   **Payment Enablement / kanal pembayaran** — menambah atau mematikan kanal cukup dari dashboard,
   tanpa deploy. Sudah diuji langsung ke sandbox: transaksi `auto` diterima Midtrans dan
   mengembalikan `token` + `redirect_url`. Bila kasir perlu memaksa satu metode, kirim
   `channel=qris|va|ewallet`.
8. **Pesan console yang normal terjadi (jangan diartikan aplikasi rusak).** Saat tamu membayar,
   Snap.js memindahkan iframe-nya ke domain bank/e-wallet simulator, sehingga posting berikutnya
   gagal:
   `Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('https://app.sandbox.midtrans.com') does not match the recipient window's origin (...)`.
   Ini perilaku SDK Midtrans di sandbox, bukan bug sistem kita — hanya berarti callback browser
   (`onSuccess`/`onClose`) kadang tidak datang. Status tetap benar karena backend yang bertanya
   ke gateway, lewat tiga jalur: retry 3/8/15/25 detik setelah overlay ditutup, poll tiap 20 detik
   selama modal terbuka, dan `POST /payments/sync-pending` saat halaman Daftar Pembayaran/Reservasi
   dibuka.
   Catatan: transaksi **hanya tercatat di Midtrans setelah halaman Snap dibuka**. Sebelum itu
   `/v2/{order_id}/status` menjawab `status_code:"404"`, dan sistem menampilkannya sebagai
   "belum tercatat di gateway" (bukan lunas, bukan error).
9. **Scheduler perlu dijalankan sendiri.** `routes/console.php` sinkron lalu menandai expired tiap
   5 menit, tapi itu butuh cron (produksi) atau:
   ```bash
   php artisan schedule:work
   ```
   di mesin pengembangan (Laragon). Tanpa keduanya, status masih dipulihkan saat halaman dibuka
   (butir 8), hanya tidak otomatis di latar belakang.
10. **Supaya tamu tidak dibuang ke `https://example.com`.** Kalau `callbacks.finish` tidak
   dikirim, Midtrans memakai "Finish Redirect URL" di dashboard — default-nya domain contoh itu.
   Backend kini mengirim `callbacks.finish` per transaksi, dibangun dari
   `PG_MIDTRANS_FINISH_URL` (fallback: `FRONTEND_URL` + `/payment-result`), misalnya
   `http://backend-aedo-hotel.test/payment-result?order_id=AEDO-XXXXXXXXXXXXXXXX`.
   Tujuannya halaman publik [PaymentResult](frontend-aedo-hotel/src/features/payments/PaymentResult.tsx)
   (rute `/payment-result`, tanpa login) yang menampilkan "Pembayaran Berhasil" / "Menunggu
   Konfirmasi" dan mengulang pemeriksaan tiap 10 detik selama pending.
   Catatan penting: nama kunci ini **tidak divalidasi Midtrans saat create** (request dengan kunci
   sembarang tetap dijawab 201), jadi salah ketik = redirect diam-diam kembali ke `example.com`.
   Host tujuan juga harus host yang benar-benar menyajikan SPA. Waktu itu `FRONTEND_URL` berisi
   `http://backend-aedo-hotel.test` yang tidak dapat dihubungi, sehingga tamu mendarat di halaman
   mati; nilai dev yang benar adalah `http://localhost:5173` (atau `PG_MIDTRANS_FINISH_URL` untuk
   menimpa). `php artisan payment:test-connection` kini mencetak "Halaman hasil: …" dan memberi
   peringatan kalau kosong / bukan URL sah. Produksi: isi dengan domain publik aplikasi, bukan `.test`.
   Kalau dites dari HP di jaringan lokal, pakai IP LAN (mis. `http://192.168.x.x:5173`) — dan ingat
   `api.ts` masih hardcode `http://localhost:8000`, jadi halaman hasil tidak dapat membaca API dari
   perangkat lain sampai baseURL dibuat mengikuti `VITE_API_URL`.
11. **Check-in dan check-out ikut merekonsiliasi pembayaran gateway.** Sebelum guard status
   dijalankan, `BookingService::checkIn()` / `checkOut()` memanggil
   `PaymentGatewayService::reconcileBooking($booking)` — menanyakan status transaksi gateway
   milik reservasi itu (yang `pending` **dan** `expired`, karena settlement bisa datang
   belakangan) lalu menyegarkan model. Efeknya:
   - uang yang sudah masuk di Midtrans langsung membuat reservasi `confirmed` sehingga check-in jalan;
   - check-out tidak lagi tertahan oleh payment `pending` yang sebenarnya sudah lunas;
   - kalau gateway sedang tidak bisa dihubungi, operasi tetap jalan (tidak jadi error 500) dan
     pesannya jujur: `... Status payment gateway belum dapat diperiksa — periksa koneksi lalu ulangi.`
     atau `... Pembayaran gateway masih menunggu konfirmasi dari provider.`
   Pembayaran manual (transfer/tunai) **tidak** ikut jalur ini — statusnya tetap lewat bukti
   dan aturan auto-verify-nya sendiri.
12. **Kalau dashboard provider bilang lunas tapi aplikasi bilang menunggu**, jalankan:
   ```bash
   php artisan payment:status AEDO-XXXXXXXXXXXXXXXX
   ```
   Perintah itu (read-only, tidak mengubah status) menampilkan jawaban mentah gateway, payment
   lokal yang cocok, dan vonisnya. Tiga hasil yang mungkin:
   - `Tidak ada payment lokal dengan order_id itu` → transaksi "yatim": uangnya ada di provider
     tapi tidak ada baris payment yang menagihnya (umumnya karena DB dev pernah di-`migrate:fresh`).
   - `BELUM SINKRON: gateway bilang lunas, payment lokal masih pending` → tekan **Cek Status**
     atau buka halaman Daftar Pembayaran/Reservasi; backend memverifikasi ulang lalu melunasi.
   - `Sinkron: gateway belum mencatat pembayaran...` → halaman Snap memang belum dibuka/belum bayar.
   Order id yang dipakai selalu `payments.gateway_transaction_id` (bentuk `AEDO-` + 16 karakter).
13. **Sinkronisasi pembayaran itu 100% otomatis - sengaja tidak ada tombol "tautkan" manual.**
   Yang terjadi di belakang layar:
   1. Midtrans mengenal transaksinya lewat **`transaction_id` mereka sendiri** (mis.
      `A120261015163622...`). Untuk e-wallet hasil Snap (DANA/Gopay), `order_id` kita TIDAK dikenali
      `GET /v2/{order_id}/status` - sudah dibuktikan langsung. QRIS dikenali, e-wallet tidak.
   2. Untuk e-wallet sandbox, API status bahkan tidak mengenal **token Snap** kita juga (diuji
      langsung: `order_id` -> "Transaction doesn't exist", `token` -> sama saja). Satu-satunya bukti
      sah yang tersedia otomatis ada di **URL redirect** `callbacks.finish`: Midtrans menempelkan
      parameter notifikasinya (`status_code`, `transaction_status`, `gross_amount`, `fraud_status`,
      `transaction_id`, **`signature_key`**).
   3. `PaymentResultController` meneruskan parameter itu ke **pipeline `handleWebhook()` yang sama**:
      `signature_key = SHA512(order_id + status_code + gross_amount + server key)` dicocokkan dengan
      `hash_equals`, nominal harus sama dengan tagihan, idempoten, diaudit. Tanda tangan dihitung
      dengan server key, jadi parameter URL ini sekuat webhook - tanpa itu, URL redirect hanya bisa
      dibuat-buat. Kalau tanda tangannya tidak ada/salah, sistem tidak mengubah apa pun.
   4. Id provider yang terlanjur dikenali API (QRIS/VA) disimpan di
      `payments.gateway_payload.provider_transaction_id`; `gateway_transaction_id` tidak pernah
      ditimpa karena notifikasi berkunci pada order_id kita. `syncStatus()` mencoba kandidat id
      berurutan: petunjuk baru -> order_id kita -> id provider yang diingat.

   Praktisnya: **QRIS dan VA** sudah otomatis sejak dulu (API mengenal order_id), **e-wallet (DANA/Gopay)**
   ikut otomatis sejak parameter redirect diverifikasi lewat jalur webhook. Tetap siapkan **Notification
   URL** di Merchant Account untuk keandalan penuh (produksi: domain publik; dev tanpa tunnel:
   `cloudflared tunnel --url http://localhost:8000`) -> `https://<domain>/api/webhooks/payment-gateway`.

Yang dilakukan sistem saat notifikasi masuk (sesuai best practice resmi Midtrans):
`signature_key = SHA512(order_id + status_code + gross_amount + server_key)` dicocokkan dengan `hash_equals`;
lunas hanya bila `transaction_status` `settlement`/`capture` **dan** `status_code` `200` **atau** `201`
(201 adalah kode respons pembuatan transaksi yang dipakai endpoint `/v2/{}/status` untuk QRIS/VA/e-wallet;
mewajibkan 200 saja membuat settlement sungguhan terbaca "menunggu konfirmasi" selamanya) **dan** `fraud_status=accept`;
nominal pada notifikasi **maupun hasil sync** harus sama persis dengan tagihan; notifikasi dobel/balik urutan
diabaikan (idempoten); semua percobaan (termasuk yang ditolak) tercatat di `payment_gateway_logs`.

> **Batasan yang ditemukan saat pengujian langsung:** QRIS Core API BI-SNAP (`POST /v1/qris`) dan
> Core API lama (`POST /v1/charge`) menjawab 404 untuk akun ini, jadi `qr_string` asli (EMVCo) belum
> bisa ditampilkan inline — QRIS delivered lewat halaman `redirect_url` Midtrans. Untuk QR string
> langsung di layar kasir, aktifkan produk QRIS BI-SNAP di Merchant Account lalu tambahkan channel itu.


`gateway_transaction_id` yang disimpan adalah **`order_id` kita sendiri** (`AEDO-XXXXXXXXXXXXXXXX`), supaya
webhook, cek status, dan rekonsiliasi memakai satu kunci yang sama. `transaction_id` Midtrans dipegang
terpisah di `gateway_payload.provider_transaction_id` dan dipakai otomatis saat order_id tidak dikenali API.

> QRIS Snap ditampilkan di halaman `redirect_url` Midtrans (link diberikan ke frontend).
> Kalau ingin QR string tampil langsung di layar kasir, pakai endpoint BI-SNAP `POST /v1/qris`
> yang butuh aktivasi produk QRIS di Merchant Account.

Kembali ke simulator lokal cukup set `PG_PROVIDER=simulator` (mode demo tanpa internet).

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

payment_gateway_logs (semua webhook masuk)
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

# Jalankan scheduler (expired payments)
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
8. **Payment Gateway (Sandbox):** masih simulator — QR yang dikembalikan palsu. Untuk mensimulasikan
   tamu membayar, pakai endpoint sandbox (bagian 6.14) atau tombol **Bayar (Sandbox)** di halaman
   Pembayaran; jangan memanggil webhook manual kecuali Anda memang menguji validasinya.
9. **Status "menunggu verifikasi" tidak lagi berarti harus ada admin:** transfer/QRIS dengan bukti +
   nomor referensi unik terverifikasi otomatis, dan settlement gateway diproses lewat webhook/polling.

### Simulasi Pembayaran (untuk Testing)

```bash
# 1) Membuat tagihan gateway lewat API, catat data.gateway_transaction_id
# 2) Simulasikan tamu membayar (butuh token sandbox = PG_SIMULATOR_SECRET di .env):
curl -X POST http://localhost:8000/api/sandbox/gateway/SIM-XXXXXXXXXXXX/pay \
  -H "Content-Type: application/json" \
  -H "X-Sandbox-Token: simulator-secret-key-aedo-hotel" \
  -d '{}'

# Memanggil webhook langsung juga masih bisa, tapi amount wajib sama dengan tagihan:
BODY='{"transaction_id":"SIM-XXXXXXXXXXXX","event":"payment.settled","status":"paid","amount":388500}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac 'simulator-secret-key-aedo-hotel' | cut -d' ' -f2)
curl -X POST http://localhost:8000/api/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Simulator-Signature: hmac-sha256=$SIG" \
  -H "X-Simulator-Timestamp: $TS" \
  -d "$BODY"
```

---

*Dokumen ini dibuat otomatis berdasarkan implementasi backend Sprint 1–7. Perbarui dokumen ini jika ada perubahan API.*
