# Edy Analyze

Tempel link video YouTube, dapatkan diagnosis apa yang kurang dan langkah perbaikannya (bahasa Indonesia).

Data dari YouTube Data API v3 (data publik), analisa oleh Gemini. Retention, CTR, dan impressions
tidak tersedia dari data publik.

## Jalankan lokal

```bash
npm install
cp .env.example .env.local   # isi YOUTUBE_API_KEY dan GEMINI_API_KEY
npm run dev
```

Buka http://localhost:3000

## Environment variables

| Nama | Wajib | Keterangan |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | ya | Google Cloud Console, YouTube Data API v3 |
| `GEMINI_API_KEY` | ya | Google AI Studio |
| `GEMINI_MODEL` | tidak | Default `gemini-2.5-flash` |

## Deploy ke Vercel

1. Import repo ini di vercel.com (Add New, Project).
2. Isi Environment Variables di atas (Settings, Environment Variables).
3. Deploy. Setelah mengubah variabel, lakukan Redeploy.

## Struktur

- `app/page.tsx`: halaman input dan hasil
- `app/api/analyze/route.ts`: endpoint utama
- `lib/youtube.ts`: ambil video, channel, pembanding, komentar
- `lib/metrics.ts`: hitung metrik dan skor per aspek
- `lib/llm.ts`: analisa Gemini (termasuk gambar thumbnail)
- `lib/parseUrl.ts`: ekstrak video ID
- `lib/cache.ts`: cache dan rate limit di memori
