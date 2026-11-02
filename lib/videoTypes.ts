export interface Penilaian {
  skor: number;
  alasan: string;
}

export interface VideoAnalysis {
  format: "shorts" | "long";
  ringkasan: string;
  skor: {
    potensi: Penilaian;
    hook: Penilaian;
    judul: Penilaian;
    deskripsi: Penilaian;
    hashtag: Penilaian;
  };
  hook: { penilaian: string; saran: string[] };
  kekuatan: string[];
  kelemahan: string[];
  judul: { teks: string; gaya: string; skor: number }[];
  hashtag: string[];
  tag_seo: string[];
  deskripsi: string;
  saran_thumbnail: string[];
  audiens: {
    profil: string;
    minat: string[];
    potensi: string;
    alasan: string;
    pendorong: string[];
    penghambat: string[];
  };
  catatan: string;
}
