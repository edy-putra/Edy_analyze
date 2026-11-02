export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  tags: string[];
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  durationSec: number;
  views: number;
  likes: number;
  likesHidden: boolean;
  comments: number;
  thumbnail: string;
}

export interface ChannelInfo {
  id: string;
  title: string;
  subscribers: number | null;
  videoCount: number;
}

export interface CommentItem {
  text: string;
  likes: number;
}

export interface YtData {
  video: VideoInfo;
  channel: ChannelInfo;
  others: VideoInfo[];
  comments: CommentItem[];
  commentsDisabled: boolean;
}

export interface VideoRow {
  id: string;
  title: string;
  views: number;
  viewsPerDay: number;
  likeRate: number | null;
  durationSec: number;
  publishedAt: string;
  hari: string;
  jam: number;
}

export interface Metrics {
  ageDays: number;
  isNewVideo: boolean;
  viewsPerDay: number;
  likeRate: number | null;
  commentsPer1k: number | null;
  channelMedianViews: number | null;
  channelMedianVpd: number | null;
  viewsVsMedian: number | null;
  vpdVsMedian: number | null;
  medianDurationSec: number | null;
  rank: number | null;
  totalCompared: number;
  self: VideoRow;
  rows: VideoRow[];
}

export interface Score {
  key: string;
  label: string;
  score: number;
  note: string;
}

export interface Analysis {
  ringkasan: string;
  diagnosis_utama: string;
  prioritas: { aksi: string; alasan: string; dampak: string }[];
  judul: { penilaian: string; saran: string[] };
  thumbnail: { penilaian: string; saran: string[] } | null;
  deskripsi_tag: { penilaian: string; saran: string[] };
  komentar: {
    sentimen: string;
    topik: string[];
    pertanyaan: string[];
    keluhan: string[];
  };
  catatan_keterbatasan: string;
  sumber?: "silang" | "gemini" | "mistral";
  kesepakatan?: string[];
  perbedaan?: string[];
}

export interface AnalyzeResponse {
  video: VideoInfo;
  channel: ChannelInfo;
  metrics: Metrics;
  scores: Score[];
  overall: number | null;
  analysis: Analysis | null;
  analysisError: string | null;
  cached?: boolean;
}
