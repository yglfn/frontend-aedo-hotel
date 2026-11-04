# Aedo Hotel Syariah — Frontend

Frontend aplikasi operasional Aedo Hotel Syariah. Aplikasi dipakai admin dan pegawai untuk mengelola reservasi, kamar, pelanggan, pembayaran, housekeeping, maintenance, laporan, shift, pengaturan, dan akun pegawai.

Frontend dibangun sebagai SPA menggunakan React, TypeScript, Vite, React Router, dan Axios. Backend API menggunakan Laravel dan berjalan terpisah.

## Daftar Isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Perintah NPM](#perintah-npm)
- [Arsitektur Aplikasi](#arsitektur-aplikasi)
- [Routing dan Hak Akses](#routing-dan-hak-akses)
- [Integrasi API](#integrasi-api)
- [Upload Bukti Pembayaran](#upload-bukti-pembayaran)
- [Code Splitting](#code-splitting)
- [Pengembangan Fitur](#pengembangan-fitur)
- [Validasi Sebelum Commit](#validasi-sebelum-commit)
- [Troubleshooting](#troubleshooting)
- [Build Production](#build-production)
- [Keamanan](#keamanan)

## Fitur

### Operasional

- Dashboard operasional hotel.
- Daftar reservasi dan pembuatan reservasi baru.
- Board kamar dan status kamar.
- Data pelanggan.
- Pencatatan pembayaran tunai, transfer bank, dan QRIS.
- Pencatatan pembayaran DP dan pelunasan.
- Upload bukti pembayaran untuk transfer dan QRIS.
- Board housekeeping.
- Daftar maintenance.
- Pengelolaan shift pegawai.

### Administrasi

- Pengelolaan tipe kamar.
- Pengelolaan pengguna/pegawai.
- Pengaturan aplikasi dan branding.
- Pusat laporan.

### Pengalaman Pengguna

- Login berbasis session cookie melalui Laravel Sanctum.
- Proteksi route berdasarkan status login.
- Proteksi route khusus admin.
- Toast notification global.
- Dialog konfirmasi global.
- Lazy loading untuk halaman route.
- Layout responsif berbasis komponen UI bersama.

## Teknologi

| Komponen | Teknologi |
| --- | --- |
| UI | React 19 |
| Bahasa | TypeScript |
| Bundler | Vite 8 |
| Routing | React Router 7 |
| HTTP client | Axios |
| Ikon | lucide-react |
| Tanggal | date-fns |
| Utility class | clsx, tailwind-merge |
| Linter | Oxlint |
| Compiler/checker | TypeScript |
| Backend | Laravel API |
| Autentikasi | Laravel Sanctum SPA cookie |

Versi dependency lengkap tersedia di [`package.json`](./package.json).

## Struktur Proyek

```text
frontend-aedo-hotel/
├── public/                 # Asset publik
├── src/
│   ├── assets/             # Asset aplikasi
│   ├── components/
│   │   ├── layout/         # AppShell, Sidebar, Topbar
│   │   └── ui/             # Button, Card, Table, Modal, Toast, dan komponen UI
│   ├── context/            # AuthContext dan context global lain
│   ├── features/
│   │   ├── auth/           # Login
│   │   ├── bookings/       # Daftar dan form reservasi
│   │   ├── customers/      # Pelanggan
│   │   ├── dashboard/      # Dashboard
│   │   ├── housekeeping/   # Housekeeping
│   │   ├── maintenance/   # Maintenance
│   │   ├── payments/       # Pembayaran dan bukti pembayaran
│   │   ├── reports/        # Laporan
│   │   ├── roomTypes/      # Tipe kamar
│   │   ├── rooms/          # Board kamar
│   │   ├── settings/       # Pengaturan
│   │   └── users/          # Pengguna/pegawai
│   ├── lib/
│   │   ├── api.ts          # Axios instance dan interceptor
│   │   ├── format.ts       # Format mata uang/tanggal/teks
│   │   └── status.ts       # Label dan warna status
│   ├── types/              # TypeScript shared types
│   ├── App.tsx             # Router dan route guards
│   ├── App.css             # Style aplikasi
│   └── main.tsx            # Entry point
├── .env.local              # Environment lokal, tidak di-commit
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Prasyarat

- Node.js 20 atau lebih baru.
- npm.
- Backend Laravel Aedo Hotel aktif.
- Backend dapat diakses dari browser frontend.
- Database dan data backend sudah siap.
- Browser modern dengan dukungan JavaScript, cookies, dan FormData.

Backend lokal secara default dijalankan pada:

```text
http://localhost:8000
```

Frontend lokal dijalankan pada:

```text
http://localhost:5173
```

Gunakan host yang konsisten. Jangan mencampur `localhost` dan `127.0.0.1` saat menguji login Sanctum karena browser menganggap keduanya sebagai origin berbeda.

## Instalasi

Masuk ke folder frontend:

```bash
cd frontend-aedo-hotel
```

Install dependency:

```bash
npm install
```

Buat `.env.local`:

```env
VITE_API_URL=http://localhost:8000
```

Jalankan frontend:

```bash
npm run dev
```

Buka:

```text
http://localhost:5173/login
```

## Konfigurasi Environment

### `VITE_API_URL`

URL dasar API Laravel.

```env
VITE_API_URL=http://localhost:8000
```

Semua request menggunakan URL ini melalui Axios instance di [`src/lib/api.ts`](./src/lib/api.ts).

### Aturan environment

- `.env.local` hanya untuk komputer lokal.
- Jangan menyimpan API key, password, token, atau secret di source code frontend.
- Variable Vite yang diawali `VITE_` dapat terlihat di browser. Jangan masukkan secret backend.
- Setelah mengubah `.env.local`, restart server Vite.
- Pastikan konfigurasi CORS backend mengizinkan origin frontend.
- Pastikan konfigurasi Sanctum backend memuat `localhost:5173`.

## Menjalankan Aplikasi

### Development

```bash
npm run dev
```

Vite menyediakan Hot Module Replacement untuk perubahan source code.

### Preview hasil build

```bash
npm run preview
```

Perintah ini menyajikan isi folder `dist` menggunakan server preview Vite.

## Perintah NPM

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan server development Vite |
| `npm run lint` | Menjalankan Oxlint |
| `npm run build` | Type-check TypeScript lalu build production |
| `npm run preview` | Preview hasil build production |

Tidak ada script test frontend khusus di `package.json`. Pengujian UI dilakukan melalui browser dan pengujian API/backend berada di proyek Laravel.

## Arsitektur Aplikasi

### Entry point

[`src/main.tsx`](./src/main.tsx) me-mount aplikasi React ke DOM.

### Root application

[`src/App.tsx`](./src/App.tsx) menangani:

- `BrowserRouter`.
- `AuthProvider`.
- Route application.
- `RequireAuth` untuk route yang memerlukan login.
- `AdminOnly` untuk route khusus admin.
- `Suspense` untuk lazy-loaded route.
- `Toaster` dan `GlobalConfirmDialog`.

### Layout

Halaman yang sudah login menggunakan:

```tsx
<AppShell>
  <PageComponent />
</AppShell>
```

Komponen layout utama:

- `AppShell` — wrapper layout aplikasi.
- `Sidebar` — navigasi utama.
- `Topbar` — informasi user, shift, dan aksi global.

### Komponen UI

Gunakan komponen yang sudah ada sebelum membuat komponen baru:

- `Button`
- `Input`
- `Card`
- `Table`
- `Modal`
- `Drawer`
- `Tabs`
- `StatusBadge`
- `KpiCard`
- `Toast`
- `ConfirmDialog`

## Routing dan Hak Akses

### Route publik

| Route | Halaman |
| --- | --- |
| `/login` | Login |

### Route admin dan pegawai

| Route | Halaman |
| --- | --- |
| `/dashboard` | Dashboard |
| `/rooms` | Board kamar |
| `/reservations` | Daftar reservasi |
| `/reservations/new` | Reservasi baru |
| `/payments` | Daftar pembayaran |
| `/payments/new` | Pembayaran baru |
| `/housekeeping` | Housekeeping |
| `/maintenance` | Maintenance |
| `/customers` | Pelanggan |

### Route admin saja

| Route | Halaman |
| --- | --- |
| `/room-types` | Tipe kamar |
| `/users` | Pegawai |
| `/reports` | Laporan |
| `/settings` | Pengaturan |

`RequireAuth` mengarahkan user belum login ke `/login`.

`AdminOnly` mengarahkan pegawai non-admin ke `/dashboard`.

Proteksi frontend bukan pengganti authorization backend. Semua endpoint backend tetap wajib memvalidasi user dan role.

## Integrasi API

Axios instance berada di [`src/lib/api.ts`](./src/lib/api.ts).

Konfigurasi utama:

```ts
axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});
```

### Session dan CSRF

Frontend memakai cookie session. Karena itu:

1. Frontend dan backend harus memakai origin lokal yang konsisten.
2. Request harus mengirim credentials.
3. Backend harus mengizinkan credentials pada CORS.
4. Cookie session dan CSRF harus tersedia sebelum request yang membutuhkan autentikasi.

### Interceptor response

Interceptor API menangani:

- `401` — redirect ke `/login`.
- `403` khusus akun nonaktif — menampilkan toast dan redirect ke `/login`.
- Error lain — diteruskan ke halaman pemanggil untuk ditampilkan sesuai konteks.

### Pola error

Halaman feature biasanya membaca error backend dengan urutan:

1. `error`.
2. `message`.
3. Pesan pertama dari `errors`.
4. Pesan fallback lokal.

Jangan menampilkan token, stack trace, atau data sensitif kepada user.

## Upload Bukti Pembayaran

Upload bukti tersedia untuk metode:

- Transfer Bank.
- QRIS.

Tunai tidak membutuhkan bukti upload.

### Format UI

Frontend menerima:

- JPEG.
- JPG.
- PNG.
- Maksimal 5 MB.

UI menggunakan dropzone di [`src/features/payments/PaymentForm.tsx`](./src/features/payments/PaymentForm.tsx) dan style di [`src/features/payments/PaymentForm.css`](./src/features/payments/PaymentForm.css).

User dapat:

- Klik area upload untuk memilih file.
- Menyeret file ke dropzone.
- Mengganti file yang dipilih.
- Melihat nama file terpilih.

### Alur request

Pembayaran dibuat lebih dulu dengan JSON:

```text
POST /api/v1/bookings/{bookingId}/payments
```

Setelah berhasil, frontend mengambil ID pembayaran lalu mengirim bukti memakai `FormData`:

```text
POST /api/v1/payments/{paymentId}/proof
```

Payload upload:

```text
proof: <file>
```

Frontend tidak menetapkan boundary multipart secara manual. Axios harus membentuk `multipart/form-data` dengan boundary yang benar.

### Backend

Backend saat ini memvalidasi JPG, JPEG, PNG, dan PDF dengan batas 5120 KB. UI frontend sengaja membatasi pilihan menjadi JPEG/JPG/PNG sesuai kebutuhan operasional.

Jika pembayaran berhasil dibuat tetapi upload gagal, backend dapat sudah memiliki payment tanpa bukti. Penanganan lanjutan harus mengikuti status pembayaran di halaman pembayaran dan aturan backend.

## Code Splitting

Halaman route dimuat menggunakan `React.lazy`:

```tsx
const PaymentForm = lazy(() => import('./features/payments/PaymentForm'));
```

Semua route lazy-loaded berada dalam `Suspense`. Dampak:

- Initial bundle lebih kecil.
- Halaman hanya dimuat saat dibutuhkan.
- Loading fallback tampil saat chunk sedang dimuat.

Saat menambah halaman baru:

1. Import dengan `lazy` di `App.tsx`.
2. Tambahkan route di `AppRoutes`.
3. Tentukan wrapper `RequireAuth` atau `AdminOnly`.
4. Gunakan `AppShell` untuk halaman internal.

## Pengembangan Fitur

### Menambah feature page

1. Buat folder di `src/features/<nama-feature>`.
2. Buat komponen `.tsx` dan stylesheet bila diperlukan.
3. Tambahkan import lazy di `src/App.tsx`.
4. Tambahkan route dan guard yang sesuai.
5. Gunakan `api` dari `src/lib/api.ts`.
6. Gunakan komponen UI bersama.
7. Tambahkan loading, empty state, error state, dan success feedback.
8. Jalankan lint dan build.

### Menambah request API

Gunakan `api` instance:

```ts
import { api } from '../../lib/api';

const response = await api.get('/api/v1/example');
```

Jangan membuat Axios instance kedua tanpa alasan kuat karena dapat melewati konfigurasi credentials, CSRF, dan interceptor.

### Menambah form

Form baru sebaiknya memiliki:

- State input yang jelas.
- Validasi boundary input.
- Loading state.
- Pesan error backend.
- Disabled state saat submit.
- Toast setelah berhasil.
- Navigasi atau refresh data setelah berhasil.

### Menambah style

- Gunakan CSS feature lokal jika style hanya dipakai satu feature.
- Gunakan token CSS yang sudah tersedia seperti `var(--primary-600)`, `var(--border)`, `var(--surface)`, dan `var(--danger-fg)`.
- Hindari style inline untuk layout yang kompleks.
- Pertahankan fokus keyboard dan kontras visual.

## Validasi Sebelum Commit

Jalankan dari folder frontend:

```bash
npm run lint
npm run build
```

Acceptance minimum:

- Oxlint selesai tanpa warning/error.
- TypeScript build berhasil.
- Vite menghasilkan folder `dist`.
- Tidak ada secret masuk source code.
- Route yang diubah dapat dibuka melalui browser.
- Form utama dapat diuji pada kondisi sukses dan error.

Untuk perubahan UI, uji juga melalui browser:

1. Login.
2. Buka route yang berubah.
3. Uji golden path.
4. Uji input kosong/tidak valid.
5. Uji loading dan error.
6. Periksa request API di Network.
7. Periksa console browser.

## Troubleshooting

### CORS error

Gejala:

```text
No 'Access-Control-Allow-Origin' header is present
```

Periksa:

- Backend aktif pada port yang benar.
- `VITE_API_URL` benar.
- Origin frontend terdaftar di konfigurasi CORS backend.
- Frontend dan backend memakai host konsisten.
- Jalankan clear config/cache Laravel jika konfigurasi backend baru diubah.

### Status 419 saat login

Biasanya terjadi karena session/CSRF memakai host berbeda.

Gunakan konsisten:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
```

Hindari kombinasi `localhost` di satu sisi dan `127.0.0.1` di sisi lain.

### Status 401

- Login ulang.
- Periksa cookie session di browser.
- Periksa backend masih aktif.
- Periksa `withCredentials: true`.
- Periksa domain frontend terdaftar di Sanctum backend.

### Status 403 akun nonaktif

Backend menutup akses akun nonaktif. Frontend menghapus sesi tampilan dengan mengarahkan user ke `/login` dan menampilkan notifikasi.

### Upload bukti gagal

Periksa:

- File JPG/JPEG/PNG.
- Ukuran file maksimal 5 MB.
- Metode pembayaran bukan Tunai.
- Payment berhasil dibuat sebelum request upload.
- Endpoint `/api/v1/payments/{id}/proof` tersedia.
- Backend memiliki permission menulis ke disk public.
- Request upload menggunakan `FormData`.

### Halaman blank setelah build

- Buka console browser.
- Periksa chunk JS gagal dimuat.
- Jalankan build ulang.
- Pastikan server deployment mengarahkan fallback route SPA ke `index.html`.
- Bersihkan cache browser jika chunk lama masih tersimpan.

### Port 5173 sudah digunakan

Cari proses yang memakai port tersebut lalu hentikan proses development lama, atau jalankan Vite pada port lain dan sesuaikan konfigurasi CORS/Sanctum backend.

## Build Production

Buat build:

```bash
npm run build
```

Output berada di:

```text
dist/
```

Preview lokal:

```bash
npm run preview
```

Deployment wajib mendukung:

- Static asset caching.
- SPA fallback ke `index.html`.
- HTTPS pada production.
- API URL production melalui environment build.
- CORS dan Sanctum stateful domains sesuai domain production.
- Cookie secure dan same-site sesuai arsitektur deployment.

## Keamanan

- Jangan commit `.env.local` atau credential.
- Jangan memasukkan secret backend ke variable `VITE_`.
- Jangan mengandalkan route guard frontend sebagai satu-satunya authorization.
- Jangan menampilkan token, password, atau stack trace.
- Validasi upload di frontend untuk UX dan tetap validasi ulang di backend.
- Batasi tipe dan ukuran file di boundary input.
- Gunakan HTTPS di production.
- Hindari mencampur origin frontend dan backend.
- Periksa Network dan Console sebelum menyatakan fitur selesai.

## Status Validasi Saat Dokumentasi Dibuat

Perintah berikut telah digunakan untuk validasi frontend:

```bash
npm run lint
npm run build
```

Build menggunakan TypeScript project build lalu Vite production build. Detail hasil terbaru sebaiknya selalu diverifikasi ulang setelah perubahan source code.
