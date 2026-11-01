export interface VideoAnalysis {
  format: "shorts" | "long";
  ringkasan: string;
  hook: { penilaian: string; saran: string[] };
  kekuatan: string[];
  kelemahan: string[];
  judul: { teks: string; gaya: string }[];
  hashtag: string[];
  tag_seo: string[];
  deskripsi: string;
  saran_thumbnail: string[];
  catatan: string;
}
