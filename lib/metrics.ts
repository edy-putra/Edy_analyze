import type { Metrics, Score, VideoInfo, VideoRow, YtData } from "./types";

const DAY = 86_400_000;

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function hariWib(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long" }).format(d);
}

function jamWib(d: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return Number(h) % 24;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function toRow(v: VideoInfo, now: number): VideoRow {
  const published = new Date(v.publishedAt);
  const age = Math.max((now - published.getTime()) / DAY, 1);
  return {
    id: v.id,
    title: v.title,
    views: v.views,
    viewsPerDay: v.views / age,
    likeRate: v.likesHidden || v.views === 0 ? null : (v.likes / v.views) * 100,
    durationSec: v.durationSec,
    publishedAt: v.publishedAt,
    hari: hariWib(published),
    jam: jamWib(published),
  };
}

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

function buildScores(video: VideoInfo, m: Metrics): Score[] {
  const scores: Score[] = [];

  // Judul
  {
    const t = video.title;
    const len = t.length;
    let s = 55;
    const notes: string[] = [];
    if (len >= 30 && len <= 70) s += 20;
    else if (len < 20) {
      s -= 20;
      notes.push("judul terlalu pendek (kurang dari 20 karakter)");
    } else if (len < 30) {
      notes.push("judul agak pendek");
    } else if (len > 90) {
      s -= 15;
      notes.push("judul terlalu panjang dan berisiko terpotong");
    } else {
      s -= 5;
      notes.push("judul agak panjang, bagian akhir bisa terpotong");
    }
    if (/\d/.test(t)) s += 8;
    else notes.push("tidak ada angka");
    if (/[?!:|\[\(]/.test(t)) s += 7;
    const letters = t.replace(/[^A-Za-z]/g, "");
    const upper = letters.replace(/[^A-Z]/g, "");
    if (letters.length > 8 && upper.length / letters.length > 0.6) {
      s -= 15;
      notes.push("terlalu banyak huruf kapital");
    }
    scores.push({
      key: "judul",
      label: "Judul",
      score: clamp(s),
      note: `${len} karakter` + (notes.length ? `; ${notes.join("; ")}` : "; panjang dan struktur sudah wajar"),
    });
  }

  // Deskripsi
  {
    const d = video.description;
    let s = 25;
    const notes: string[] = [];
    if (d.length >= 500) s += 30;
    else if (d.length >= 200) s += 20;
    else if (d.length >= 80) s += 8;
    else notes.push("deskripsi sangat pendek");
    if (/https?:\/\//.test(d)) s += 10;
    else notes.push("tidak ada link");
    if (/#\w+/.test(d)) s += 10;
    else notes.push("tidak ada hashtag");
    if (/(^|\s)\d{1,2}:\d{2}/m.test(d)) s += 15;
    else notes.push("tidak ada timestamp/chapter");
    scores.push({
      key: "deskripsi",
      label: "Deskripsi",
      score: clamp(s),
      note: `${d.length} karakter` + (notes.length ? `; ${notes.join("; ")}` : "; lengkap"),
    });
  }

  // Tag
  {
    const n = video.tags.length;
    const s = n === 0 ? 25 : n < 5 ? 55 : n <= 25 ? 85 : 60;
    scores.push({
      key: "tag",
      label: "Tag",
      score: s,
      note: n === 0 ? "tidak ada tag" : `${n} tag`,
    });
  }

  // Durasi
  if (m.medianDurationSec) {
    const ratio = video.durationSec / m.medianDurationSec;
    const ok = ratio >= 0.6 && ratio <= 1.6;
    scores.push({
      key: "durasi",
      label: "Durasi",
      score: ok ? 80 : 60,
      note: `${fmt1(video.durationSec / 60)} menit, ${fmt1(ratio)}x median durasi channel`,
    });
  }

  // Like
  if (m.likeRate !== null) {
    const r = m.likeRate;
    const s = r >= 4 ? 90 : r >= 2 ? 70 : r >= 1 ? 50 : 30;
    scores.push({
      key: "like",
      label: "Rasio like",
      score: s,
      note: `${fmt1(r)}% dari views menyukai video ini`,
    });
  }

  // Komentar
  if (m.commentsPer1k !== null) {
    const c = m.commentsPer1k;
    const s = c >= 3 ? 85 : c >= 1 ? 65 : c >= 0.3 ? 45 : 30;
    scores.push({
      key: "komentar",
      label: "Interaksi komentar",
      score: s,
      note: `${fmt1(c)} komentar per 1.000 views`,
    });
  }

  // Performa vs channel
  {
    const ratio = m.isNewVideo ? m.vpdVsMedian : m.viewsVsMedian;
    if (ratio !== null) {
      const s = ratio >= 1.5 ? 90 : ratio >= 1 ? 75 : ratio >= 0.6 ? 55 : ratio >= 0.3 ? 40 : 25;
      scores.push({
        key: "performa",
        label: "Performa vs channel",
        score: s,
        note: `${fmt1(ratio)}x median video terbaru channel (${m.isNewVideo ? "views per hari" : "total views"})`,
      });
    }
  }

  return scores;
}

export function computeMetrics(data: YtData): {
  metrics: Metrics;
  scores: Score[];
  overall: number | null;
} {
  const now = Date.now();
  const { video, others } = data;
  const self = toRow(video, now);
  const rows = others.map((o) => toRow(o, now));
  const ageDays = Math.max((now - new Date(video.publishedAt).getTime()) / DAY, 0);

  const medViews = rows.length ? median(rows.map((r) => r.views)) : null;
  const medVpd = rows.length ? median(rows.map((r) => r.viewsPerDay)) : null;
  const medDur = rows.length ? median(rows.map((r) => r.durationSec)) : null;

  const metrics: Metrics = {
    ageDays,
    isNewVideo: ageDays < 3,
    viewsPerDay: self.viewsPerDay,
    likeRate: self.likeRate,
    commentsPer1k: video.views > 0 ? (video.comments / video.views) * 1000 : null,
    channelMedianViews: medViews,
    channelMedianVpd: medVpd,
    viewsVsMedian: medViews ? self.views / medViews : null,
    vpdVsMedian: medVpd ? self.viewsPerDay / medVpd : null,
    medianDurationSec: medDur,
    rank: rows.length ? 1 + rows.filter((r) => r.views > self.views).length : null,
    totalCompared: rows.length,
    self,
    rows,
  };

  const scores = buildScores(video, metrics);
  const overall = scores.length
    ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
    : null;

  return { metrics, scores, overall };
}
