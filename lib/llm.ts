import { AppError } from "./errors";
import type { Analysis, Metrics, Score, YtData } from "./types";

const SYSTEM = `Kamu adalah konsultan strategi YouTube yang tajam dan jujur.
Aturan:
- Tulis dalam Bahasa Indonesia yang jelas dan lugas.
- Hanya pakai data yang diberikan. Jangan mengarang angka atau fakta.
- Data retention (di menit berapa penonton pergi), CTR, dan impressions TIDAK tersedia. Jangan berpura-pura tahu. Kalau relevan, sebut itu sebagai keterbatasan.
- Saran harus spesifik dan bisa langsung dikerjakan (contoh: beri 3 alternatif judul), bukan nasihat umum.
- Urutkan "prioritas" dari dampak terbesar ke terkecil (maksimal 5).
- Kalau gambar thumbnail disertakan, nilai dari apa yang benar-benar terlihat: keterbacaan teks di layar kecil, kontras, fokus visual, ekspresi/objek utama, dan kecocokan dengan judul.
- Balas HANYA dengan JSON valid sesuai skema, tanpa teks lain.`;

const SCHEMA = `{
  "ringkasan": "2-3 kalimat kondisi video secara keseluruhan",
  "diagnosis_utama": "satu kalimat: masalah terbesar yang paling menahan performa video ini",
  "prioritas": [{ "aksi": "apa yang dilakukan", "alasan": "kenapa, berdasarkan data", "dampak": "tinggi | sedang | rendah" }],
  "judul": { "penilaian": "penilaian judul", "saran": ["3 alternatif judul atau perbaikan spesifik"] },
  "thumbnail": { "penilaian": "penilaian thumbnail", "saran": ["perbaikan spesifik"] } ,
  "deskripsi_tag": { "penilaian": "penilaian deskripsi dan tag", "saran": ["perbaikan spesifik"] },
  "komentar": { "sentimen": "ringkasan sentimen", "topik": ["topik yang sering dibahas"], "pertanyaan": ["pertanyaan penonton yang belum terjawab"], "keluhan": ["keluhan berulang"] },
  "catatan_keterbatasan": "apa yang tidak bisa dinilai dari data publik"
}
Jika thumbnail tidak disertakan, isi "thumbnail" dengan null.
Jika komentar tidak tersedia, isi array komentar dengan [] dan sentimen dengan "Komentar tidak tersedia".`;

const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function buildPayload(data: YtData, m: Metrics, scores: Score[]) {
  const v = data.video;
  return {
    video: {
      judul: v.title,
      deskripsi: v.description.slice(0, 1500),
      tag: v.tags.slice(0, 30),
      durasi_detik: v.durationSec,
      tayang_utc: v.publishedAt,
      hari_tayang_wib: m.self.hari,
      jam_tayang_wib: m.self.jam,
      views: v.views,
      likes: v.likesHidden ? null : v.likes,
      jumlah_komentar: v.comments,
    },
    channel: {
      nama: data.channel.title,
      subscriber: data.channel.subscribers,
      jumlah_video: data.channel.videoCount,
    },
    metrik: {
      umur_hari: r1(m.ageDays),
      views_per_hari: r1(m.viewsPerDay),
      like_rate_persen: r1(m.likeRate),
      komentar_per_1000_views: r1(m.commentsPer1k),
      median_views_channel: m.channelMedianViews,
      median_views_per_hari_channel: r1(m.channelMedianVpd),
      rasio_views_vs_median: r1(m.viewsVsMedian),
      peringkat_views_di_antara_video_terbaru: m.rank,
      jumlah_video_pembanding: m.totalCompared,
    },
    skor_otomatis: scores.map((s) => ({ aspek: s.label, skor: s.score, catatan: s.note })),
    video_pembanding: m.rows.map((r) => ({
      judul: r.title,
      views: r.views,
      views_per_hari: r1(r.viewsPerDay),
      like_rate_persen: r1(r.likeRate),
      durasi_detik: r.durationSec,
      hari_tayang: r.hari,
      jam_tayang: r.jam,
    })),
    komentar_teratas: data.comments.slice(0, 40).map((c) => c.text.slice(0, 250)),
    komentar_dimatikan_atau_tidak_tersedia: data.commentsDisabled,
  };
}

async function fetchThumbnail(
  videoId: string,
  url: string,
): Promise<{ mime: string; b64: string } | null> {
  const candidates = [url, `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`].filter(Boolean);
  for (const u of candidates) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 4_000_000) continue;
      return { mime: res.headers.get("content-type") ?? "image/jpeg", b64: buf.toString("base64") };
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  return null;
}

function parseJson(text: string): Analysis {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(cleaned.slice(start, end + 1)) as Analysis;
}

export async function analyzeWithLLM(
  data: YtData,
  metrics: Metrics,
  scores: Score[],
): Promise<Analysis> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AppError("GEMINI_API_KEY belum diatur. Metrik tetap ditampilkan tanpa analisa AI.", 500);

  // Model dicoba berurutan. Kalau satu sudah dipensiunkan (404), lanjut ke berikutnya.
  const models = Array.from(
    new Set([process.env.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.5-flash"].filter(Boolean)),
  ) as string[];

  const thumb = await fetchThumbnail(data.video.id, data.video.thumbnail);
  const prompt =
    `Analisa video YouTube berikut dan jelaskan apa yang kurang.\n\n` +
    `DATA (JSON):\n${JSON.stringify(buildPayload(data, metrics, scores))}\n\n` +
    `SKEMA OUTPUT:\n${SCHEMA}\n\n` +
    (thumb ? "Gambar thumbnail video disertakan di bawah." : "Thumbnail tidak tersedia.");

  const parts: any[] = [{ text: prompt }];
  if (thumb) parts.push({ inlineData: { mimeType: thumb.mime, data: thumb.b64 } });

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  });

  let res: Response | null = null;
  for (const model of models) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(50_000),
      },
    );
    if (res.status !== 404) break;
  }

  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    if (status === 429) throw new AppError("Kuota Gemini sedang habis. Coba lagi beberapa saat lagi.", 429);
    if (status === 404) {
      throw new AppError(
        "Model Gemini tidak ditemukan. Isi GEMINI_MODEL di Vercel dengan model yang masih aktif.",
        502,
      );
    }
    const err = await res?.json().catch(() => null);
    throw new AppError(`Gemini menolak permintaan (${status}): ${err?.error?.message ?? "tanpa detail"}`, 502);
  }

  const json = await res.json();
  const text: string = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p.text ?? "")
    .join("");

  try {
    return parseJson(text);
  } catch {
    throw new AppError("Hasil analisa AI tidak bisa dibaca. Coba ulangi.", 502);
  }
}
