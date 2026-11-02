"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AnalyzeResponse } from "@/lib/types";

const nf = new Intl.NumberFormat("id-ID");
const fmt = (n: number | null | undefined) => (n == null ? "-" : nf.format(Math.round(n)));
const fmt1 = (n: number | null | undefined) => (n == null ? "-" : n.toFixed(1).replace(".", ","));
const pad = (x: number) => String(x).padStart(2, "0");
const dur = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};
const tgl = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const bar = (s: number) => (s >= 75 ? "bg-good" : s >= 50 ? "bg-warn" : "bg-bad");
const txt = (s: number) => (s >= 75 ? "text-good" : s >= 50 ? "text-warn" : "text-bad");

function Card({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <section className="neo mt-6 p-5">
      <span className="tag">{tag}</span>
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function List({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="neo-in px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}

type Theme = "auto" | "light" | "dark";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  useEffect(() => {
    const r = document.documentElement;
    if (theme === "auto") r.removeAttribute("data-theme");
    else r.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true); setError(null); setData(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menganalisa video.");
      setData(json as AnalyzeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menganalisa video.");
    } finally {
      setLoading(false);
    }
  }

  const a = data?.analysis ?? null;
  const m = data?.metrics ?? null;
  const themes: [Theme, string][] = [["auto", "◐"], ["light", "☀"], ["dark", "☾"]];

  return (
    <main className="mx-auto max-w-2xl px-5 pb-36 pt-6">
      <div className="flex items-center justify-between">
        <Link href="/upload" className="neo-sm px-4 py-2 text-sm font-semibold">Upload video →</Link>
        <div className="neo-sm flex gap-1 p-1" role="group" aria-label="Tema">
          {themes.map(([t, icon]) => (
            <button key={t} onClick={() => setTheme(t)} aria-label={`Tema ${t}`} aria-pressed={theme === t}
              className={`h-9 w-9 rounded-full text-base ${theme === t ? "on" : ""}`}>{icon}</button>
          ))}
        </div>
      </div>

      <header className="mt-4 text-center">
        <div className="neo mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl text-accent">▶</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Edy Analyze</h1>
        <p className="mt-1 text-sm text-muted">Link video jadi diagnosis · By Edy Putra </p>
      </header>

      <form id="f" onSubmit={submit} className="neo mt-8 p-5">
        <span className="tag">LANGKAH 1</span>
        <h2 className="mt-3 text-lg font-bold">Tempel link video</h2>
        <input
          type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..." aria-label="Link video YouTube"
          className="neo-in mt-3 w-full bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted"
        />
        <p className="mt-2 text-xs text-muted">Bisa link biasa, youtu.be, atau Shorts.</p>
      </form>

      {loading && <p className="mt-6 text-center text-sm text-muted">Mengambil data dan menyusun diagnosis. Biasanya 10 sampai 20 detik.</p>}
      {error && <div role="alert" className="neo mt-6 p-4 text-sm font-medium text-bad">{error}</div>}

      {data && m && (
        <div>
          <section className="neo mt-6 p-5">
            <span className="tag">VIDEO</span>
            {data.video.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.video.thumbnail} alt="Thumbnail" className="mt-3 aspect-video w-full rounded-2xl object-cover" />
            )}
            <h2 className="mt-3 font-bold leading-snug">{data.video.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {data.channel.title}{data.channel.subscribers != null ? ` · ${fmt(data.channel.subscribers)} subscriber` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">
              Tayang {tgl(data.video.publishedAt)} ({m.self.hari}, {m.self.jam}.00 WIB) · {dur(data.video.durationSec)}
            </p>
            {data.overall != null && (
              <p className="mt-4 text-sm text-muted">
                Skor keseluruhan <span className={`text-2xl font-extrabold ${txt(data.overall)}`}>{data.overall}</span> / 100
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Chip label="Views" value={fmt(data.video.views)} />
              <Chip label="Per hari" value={fmt(m.viewsPerDay)} />
              <Chip label="Like" value={data.video.likesHidden ? "Disembunyikan" : `${fmt(data.video.likes)}${m.likeRate != null ? ` (${fmt1(m.likeRate)}%)` : ""}`} />
              <Chip label="Komentar" value={fmt(data.video.comments)} />
            </div>
            {m.rank != null && (
              <p className="mt-3 text-xs text-muted">Peringkat views {m.rank} dari {m.totalCompared + 1} video terbaru channel ini.</p>
            )}
            {data.cached && <p className="mt-1 text-xs text-muted">Hasil dari cache (kurang dari 6 jam).</p>}
          </section>

          {a ? (
            <>
              <Card tag="DIAGNOSIS" title="Yang paling menahan video ini">
                <p className="text-lg font-semibold leading-snug">{a.diagnosis_utama}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{a.ringkasan}</p>
              </Card>
              <Card tag="PRIORITAS" title="Perbaiki berurutan">
                <ol className="space-y-3">
                  {(a.prioritas ?? []).map((p, i) => (
                    <li key={i} className="neo-in p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold leading-snug">{i + 1}. {p.aksi}</p>
                        <span className="neo-sm shrink-0 px-3 py-1 text-xs font-bold text-accent">{p.dampak}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.alasan}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          ) : (
            <div className="neo mt-6 p-5">
              <span className="tag">INFO</span>
              <p className="mt-3 font-semibold">Analisa AI belum tersedia</p>
              <p className="mt-1 text-sm text-muted">{data.analysisError ?? "Terjadi masalah saat menjalankan analisa AI."} Skor dan perbandingan tetap dari data video.</p>
            </div>
          )}

          <Card tag="SKOR" title="Nilai per aspek">
            <ul className="space-y-4">
              {data.scores.map((s) => (
                <li key={s.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className={`font-bold ${txt(s.score)}`}>{s.score}</span>
                  </div>
                  <div className="neo-in mt-1.5 h-3 overflow-hidden rounded-full p-0.5">
                    <div className={`h-full rounded-full ${bar(s.score)}`} style={{ width: `${Math.max(s.score, 4)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">{s.note}</p>
                </li>
              ))}
            </ul>
          </Card>

          {a && (
            <>
              <Card tag="JUDUL" title="Penilaian judul">
                <p className="text-[15px] leading-relaxed">{a.judul?.penilaian}</p>
                <List items={a.judul?.saran} />
              </Card>
              {a.thumbnail && (
                <Card tag="THUMBNAIL" title="Penilaian thumbnail">
                  <p className="text-[15px] leading-relaxed">{a.thumbnail.penilaian}</p>
                  <List items={a.thumbnail.saran} />
                </Card>
              )}
              <Card tag="DESKRIPSI" title="Deskripsi dan tag">
                <p className="text-[15px] leading-relaxed">{a.deskripsi_tag?.penilaian}</p>
                <List items={a.deskripsi_tag?.saran} />
              </Card>
              <Card tag="KOMENTAR" title="Suara penonton">
                <p className="text-[15px] leading-relaxed">{a.komentar?.sentimen}</p>
                {([["Sering dibahas", a.komentar?.topik], ["Pertanyaan belum terjawab", a.komentar?.pertanyaan], ["Keluhan berulang", a.komentar?.keluhan]] as [string, string[] | undefined][])
                  .filter(([, v]) => v?.length)
                  .map(([h, v]) => (
                    <div key={h} className="mt-4">
                      <h3 className="text-sm font-bold">{h}</h3>
                      <List items={v} />
                    </div>
                  ))}
              </Card>
            </>
          )}

          {m.rows.length > 0 && (
            <Card tag="PEMBANDING" title="Dibanding video lain di channel">
              <p className="mb-3 text-sm text-muted">
                Median views {fmt(m.channelMedianViews)}. Video ini {m.viewsVsMedian != null ? `${fmt1(m.viewsVsMedian)}x` : "-"} dari median.
              </p>
              <div className="neo-in overflow-x-auto p-2">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th className="px-2 py-2 font-medium">Judul</th>
                      <th className="px-2 py-2 text-right font-medium">Views</th>
                      <th className="px-2 py-2 text-right font-medium">Per hari</th>
                      <th className="px-2 py-2 text-right font-medium">Durasi</th>
                      <th className="px-2 py-2 font-medium">Tayang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[{ ...m.self, title: `${m.self.title} (ini)` }, ...m.rows].map((r, i) => (
                      <tr key={`${r.id}-${i}`} className={i === 0 ? "font-bold text-accent" : ""}>
                        <td className="max-w-[180px] truncate px-2 py-2" title={r.title}>{r.title}</td>
                        <td className="px-2 py-2 text-right">{fmt(r.views)}</td>
                        <td className="px-2 py-2 text-right">{fmt(r.viewsPerDay)}</td>
                        <td className="px-2 py-2 text-right">{dur(r.durationSec)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{r.hari}, {r.jam}.00</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <p className="mt-8 text-xs leading-relaxed text-muted">
            {a?.catatan_keterbatasan ? `${a.catatan_keterbatasan} ` : ""}
            Retention, CTR, dan impressions tidak ada di data publik, jadi diagnosis ini berdasarkan data yang terlihat dari luar.
          </p>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 px-4 pb-4 pt-3" style={{ background: "var(--bg)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm">
            <div className="font-bold">{data?.overall != null ? `Skor ${data.overall}/100` : "Siap menganalisa"}</div>
            <div className="truncate text-xs text-muted">{data ? data.video.title : "Tempel link di atas"}</div>
          </div>
          <button type="submit" form="f" disabled={loading || !url.trim()} className="btn shrink-0">
            {loading ? "Menganalisa…" : "Analisa"}
          </button>
        </div>
      </div>
    </main>
  );
}
