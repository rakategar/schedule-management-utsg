# Dashboard Reminder UTSG

Web dashboard multi-divisi untuk sistem reminder UTSG. Frontend statis (Vite + React + TypeScript); backend-nya workflow n8n **"new reminder"** yang menyimpan data di n8n Data Tables (`NR_*`).

## Menjalankan lokal

```bash
npm install
cp .env.example .env   # isi VITE_API_URL
npm run dev            # http://localhost:5173
```

## Deploy ke Vercel

- Framework preset: **Vite** (build `npm run build`, output `dist`)
- Environment variable: `VITE_API_URL` = URL webhook production n8n, misalnya
  `https://<host-n8n>/webhook/new-reminder-api`
- `vercel.json` sudah berisi rewrite SPA dan header keamanan.

Setelah deploy, login sebagai superadmin lalu isi **Pengaturan → Alamat dashboard** dengan domain Vercel. Alamat itu dipakai di email dan di link `/login` bot Telegram.

## Menghubungkan Telegram

1. Pengguna kirim `/start` ke bot. Kalau belum dikenal, bot meminta `/login`.
2. `/login` membalas link sekali pakai (10 menit): `<dashboard>/#/tautkan-telegram?t=…`.
3. Pengguna login di web, melihat akun Telegram yang akan ditautkan, lalu menekan **Hubungkan Telegram**.
4. Telegram ID tersimpan di `NR_Users`. Tautan bisa diputus dari Profil (atau oleh superadmin di menu Pengguna).

Isi **Pengaturan → Username bot Telegram** supaya halaman Profil menampilkan tombol untuk membuka bot.
