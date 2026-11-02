import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/cache";
import { AppError } from "@/lib/errors";
import { GEMINI, generate, geminiKey } from "@/lib/gemini";
import type { VideoAnalysis } from "@/lib/videoTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `Kamu adalah editor dan strategis konten YouTube. Kamu menonton video yang diberikan (gambar dan suara).
Aturan:
- Dasarkan semuanya pada isi video yang sebenarnya. Jangan mengarang adegan, fakta, atau timestamp.
- Tulis dalam bahasa yang dipakai di video (default Bahasa Indonesia).
- Judul harus sesuai isi video dan tidak menipu.
- Balas HANYA dengan JSON valid sesuai skema, tanpa teks lain.`;

const SHORTS_RULES = `FORMAT: YouTube Shorts.
- judul: 5 opsi, pendek, maksimal 45 karakter, langsung ke inti, kuat di 3 kata pertama, relevan dengan isi, boleh 1 emoji.
- hashtag: 3 sampai 5, wajib termasuk #Shorts.
- tag_seo: array kosong.
- deskripsi: 2 sampai 3 baris singkat, hashtag di baris terakhir. Tanpa chapter.`;

const LONG_RULES = `FORMAT: video panjang.
- judul: 5 opsi, 55 sampai 70 karakter, kata kunci utama di bagian awal (SEO), ada sedikit rasa penasaran atau klik-bait ringan (curiosity gap, angka, atau kontras) tetapi tetap jujur sesuai isi video.
- hashtag: 3 sampai 5 (tiga pertama akan tampil di atas judul).
- tag_seo: 8 sampai 15 kata kunci.
- deskripsi: dua baris pertama berisi hook dan kata kunci utama (terlihat sebelum "selengkapnya"), lalu ringkasan singkat, lalu chapter dengan timestamp format 00:00 yang benar-benar sesuai video (mulai dari 00:00, minimal 3 chapter; kalau video terlalu pendek, lewati chapter), lalu ajakan subscribe singkat, lalu hashtag.`;

const SCORE_RULES = `PENILAIAN:
- Semua "skor" adalah angka bulat 0 sampai 100. Nilai dengan jujur dan ketat: konten biasa berkisar 50 sampai 65, jangan beri di atas 85 kecuali benar-benar kuat.
- Skor tiap opsi judul harus berbeda dan mencerminkan perbedaan kualitas (kejelasan, daya tarik, kesesuaian dengan isi, panjang).
- skor.potensi = potensi performa konten secara keseluruhan (kekuatan hook, kejelasan topik, daya tarik isi). Ini penilaian kualitas, BUKAN prediksi jumlah views.
- skor.judul, skor.deskripsi, skor.hashtag = kualitas hasil yang kamu tulis, dengan alasan singkat satu kalimat.
AUDIENS:
- profil = siapa yang paling mungkin menyukai video ini (perkiraan usia, minat, kebiasaan menonton).
- potensi = "rendah", "sedang", atau "tinggi" berdasarkan kejelasan topik, kekuatan hook, dan daya tarik umum.
- Jangan menyebut angka views, jumlah penonton, atau pendapatan.`;

const SCHEMA = `{
  "ringkasan": "2-3 kalimat isi video",
  "skor": {
    "potensi": { "skor": 0, "alasan": "satu kalimat" },
    "hook": { "skor": 0, "alasan": "satu kalimat" },
    "judul": { "skor": 0, "alasan": "satu kalimat" },
    "deskripsi": { "skor": 0, "alasan": "satu kalimat" },
    "hashtag": { "skor": 0, "alasan": "satu kalimat" }
  },
  "hook": { "penilaian": "penilaian 3-5 detik pertama: apakah menahan penonton", "saran": ["perbaikan spesifik"] },
  "kekuatan": ["..."],
  "kelemahan": ["..."],
  "judul": [{ "teks": "judul", "gaya": "label singkat, misal: penasaran, angka, manfaat", "skor": 0 }],
  "hashtag": ["#contoh"],
  "tag_seo": ["kata kunci"],
  "deskripsi": "teks deskripsi lengkap, siap tempel",
  "saran_thumbnail": ["ide thumbnail spesifik berdasarkan adegan di video"],
  "audiens": {
    "profil": "siapa penonton yang paling cocok",
    "minat": ["minat atau topik yang mereka sukai"],
    "potensi": "rendah | sedang | tinggi",
    "alasan": "kenapa potensinya segitu",
    "pendorong": ["hal yang membantu video ini menjangkau penonton"],
    "penghambat": ["hal yang bisa menahan jangkauan"]
  },
  "catatan": "keterbatasan atau hal yang perlu dicek pengguna"
}`;

function parse(text: string): Omit<VideoAnalysis, "format"> {
  const c = text.replace(/```json|```/g, "").trim();
  const s = c.indexOf("{"), e = c.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("no json");
  return JSON.parse(c.slice(s, e + 1));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const fileName = String(body?.fileName ?? "");
    const kind = String(body?.kind ?? "auto");
    const durationSec = Number(body?.durationSec ?? 0);
    if (!/^files\/[a-z0-9-]{1,40}$/.test(fileName)) throw new AppError("Data file tidak valid.", 400);

    const key = geminiKey();
    const st = await fetch(`${GEMINI}/v1beta/${fileName}`, { headers: { "x-goog-api-key": key } });
    if (!st.ok) throw new AppError("File video tidak ditemukan di Google.", 404);
    const f = await st.json();
    if (f.state === "FAILED") throw new AppError("Google gagal memproses video ini. Coba file MP4 lain.", 422);
    if (f.state !== "ACTIVE") return NextResponse.json({ processing: true }, { status: 202 });

    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    if (!rateLimit(`v:${ip}`, 8, 60 * 60 * 1000)) {
      throw new AppError("Terlalu banyak analisa video. Coba lagi nanti.", 429);
    }

    const isShorts = kind === "shorts" || (kind !== "long" && durationSec > 0 && durationSec <= 180);
    const prompt =
      `Tonton video ini lalu hasilkan analisa dan materi publikasi.\n\n` +
      `${isShorts ? SHORTS_RULES : LONG_RULES}\n\n${SCORE_RULES}\n\nSKEMA OUTPUT:\n${SCHEMA}`;

    const text = await generate(
      [{ fileData: { mimeType: f.mimeType, fileUri: f.uri } }, { text: prompt }],
      SYSTEM,
      48_000,
    );

    let out: Omit<VideoAnalysis, "format">;
    try {
      out = parse(text);
    } catch {
      throw new AppError("Hasil analisa tidak bisa dibaca. Coba ulangi.", 502);
    }

    // Hapus file dari Google (best effort)
    fetch(`${GEMINI}/v1beta/${fileName}`, { method: "DELETE", headers: { "x-goog-api-key": key } }).catch(() => {});

    return NextResponse.json({ ...out, format: isShorts ? "shorts" : "long" });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
  }
}
