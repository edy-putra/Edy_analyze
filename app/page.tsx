"use client";

import { useState } from "react";
import type { AnalyzeResponse } from "@/lib/types";

const nf = new Intl.NumberFormat("id-ID");
const fmt = (n: number | null | undefined) => (n == null ? "-" : nf.format(Math.round(n)));
const fmt1 = (n: number | null | undefined) =>
  n == null ? "-" : n.toFixed(1).replace(".", ",");

function dur(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function tanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const barColor = (s: number) => (s >= 75 ? "bg-good" : s >= 50 ? "bg-warn" : "bg-bad");
const textColor = (s: number) => (s >= 75 ? "text-good" : s >= 50 ? "text-warn" : "text-bad");
const dampakColor = (d: string) =>
  d === "tinggi" ? "bg-bad text-white" : d === "sedang" ? "bg-warn text-white" : "bg-line text-ink";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3.5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-0.5 font-display text-xl font-semibold">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setData(null);
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

  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Edy Analyze</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">
        Tempel link video YouTube. Kamu akan melihat apa yang kurang dari video itu dan apa yang
        harus diperbaiki lebih dulu.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          aria-label="Link video YouTube"
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3 text-base"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-lg bg-accent px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Menganalisa…" : "Analisa video"}
        </button>
      </form>

      {loading && (
        <p className="mt-6 text-muted">
          Mengambil data video dan menyusun diagnosis. Biasanya 10 sampai 20 detik.
        </p>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-bad/40 bg-bad/10 p-4 text-bad">
          {error}
        </div>
      )}

      {data && m && (
        <div>
          {/* Ringkasan video */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            {data.video.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.video.thumbnail}
                alt="Thumbnail video"
                className="aspect-video w-full rounded-lg border border-line object-cover sm:w-64"
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold leading-snug">{data.video.title}</h2>
              <p className="mt-1 text-muted">
                {data.channel.title}
                {data.channel.subscribers != null
                  ? `, ${fmt(data.channel.subscribers)} subscriber`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-muted">
                Tayang {tanggal(data.video.publishedAt)} ({m.self.hari}, jam {m.self.jam}.00 WIB),
                durasi {dur(data.video.durationSec)}
              </p>
              {data.overall != null && (
                <p className="mt-3">
                  Skor keseluruhan{" "}
                  <span className={`font-display text-2xl font-bold ${textColor(data.overall)}`}>
                    {data.overall}
                  </span>
                  <span className="text-muted"> / 100</span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Views" value={fmt(data.video.views)} hint={`${fmt(m.viewsPerDay)} per hari`} />
            <Stat
              label="Likes"
              value={data.video.likesHidden ? "Disembunyikan" : fmt(data.video.likes)}
              hint={m.likeRate != null ? `${fmt1(m.likeRate)}% dari views` : undefined}
            />
            <Stat
              label="Komentar"
              value={fmt(data.video.comments)}
              hint={m.commentsPer1k != null ? `${fmt1(m.commentsPer1k)} per 1.000 views` : undefined}
            />
            <Stat
              label="Peringkat di channel"
              value={m.rank != null ? `${m.rank} dari ${m.totalCompared + 1}` : "-"}
              hint="berdasarkan views, video terbaru"
            />
          </div>

          {data.cached && (
            <p className="mt-3 text-sm text-muted">Hasil dari cache (kurang dari 6 jam lalu).</p>
          )}

          {/* Diagnosis */}
          {a ? (
            <>
              <Section title="Diagnosis">
                <p className="font-display text-xl font-medium leading-snug">{a.diagnosis_utama}</p>
                <p className="mt-3 leading-relaxed text-muted">{a.ringkasan}</p>
              </Section>

              <Section title="Yang harus diperbaiki, berurutan">
                <ol className="space-y-3">
                  {(a.prioritas ?? []).map((p, i) => (
                    <li key={i} className="rounded-lg border border-line bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold leading-snug">
                          {i + 1}. {p.aksi}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${dampakColor(
                            p.dampak,
                          )}`}
                        >
                          dampak {p.dampak}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.alasan}</p>
                    </li>
                  ))}
                </ol>
              </Section>
            </>
          ) : (
            <div className="mt-8 rounded-lg border border-warn/50 bg-warn/10 p-4">
              <p className="font-semibold">Analisa AI belum tersedia</p>
              <p className="mt-1 text-[15px]">
                {data.analysisError ?? "Terjadi masalah saat menjalankan analisa AI."} Skor dan
                perbandingan di bawah tetap berasal dari data video.
              </p>
            </div>
          )}

          {/* Skor */}
          <Section title="Skor per aspek">
            <ul className="space-y-4">
              {data.scores.map((s) => (
                <li key={s.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{s.label}</span>
                    <span className={`font-display font-semibold ${textColor(s.score)}`}>
                      {s.score}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${barColor(s.score)}`}
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted">{s.note}</p>
                </li>
              ))}
            </ul>
          </Section>

          {a && (
            <>
              <Section title="Judul">
                <p className="leading-relaxed">{a.judul?.penilaian}</p>
                <Bullets items={a.judul?.saran} />
              </Section>

              {a.thumbnail && (
                <Section title="Thumbnail">
                  <p className="leading-relaxed">{a.thumbnail.penilaian}</p>
                  <Bullets items={a.thumbnail.saran} />
                </Section>
              )}

              <Section title="Deskripsi dan tag">
                <p className="leading-relaxed">{a.deskripsi_tag?.penilaian}</p>
                <Bullets items={a.deskripsi_tag?.saran} />
              </Section>

              <Section title="Komentar penonton">
                <p className="leading-relaxed">{a.komentar?.sentimen}</p>
                {a.komentar?.topik?.length ? (
                  <>
                    <h3 className="mt-4 font-semibold">Yang sering dibahas</h3>
                    <Bullets items={a.komentar.topik} />
                  </>
                ) : null}
                {a.komentar?.pertanyaan?.length ? (
                  <>
                    <h3 className="mt-4 font-semibold">Pertanyaan yang belum terjawab</h3>
                    <Bullets items={a.komentar.pertanyaan} />
                  </>
                ) : null}
                {a.komentar?.keluhan?.length ? (
                  <>
                    <h3 className="mt-4 font-semibold">Keluhan berulang</h3>
                    <Bullets items={a.komentar.keluhan} />
                  </>
                ) : null}
              </Section>
            </>
          )}

          {/* Perbandingan */}
          {m.rows.length > 0 && (
            <Section title="Dibanding video terbaru lain di channel ini">
              <p className="mb-3 text-sm text-muted">
                Median views channel: {fmt(m.channelMedianViews)}. Video ini{" "}
                {m.viewsVsMedian != null ? `${fmt1(m.viewsVsMedian)}x` : "-"} dari median.
              </p>
              <div className="overflow-x-auto rounded-lg border border-line bg-white">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-line text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Judul</th>
                      <th className="px-3 py-2 text-right font-medium">Views</th>
                      <th className="px-3 py-2 text-right font-medium">Per hari</th>
                      <th className="px-3 py-2 text-right font-medium">Like</th>
                      <th className="px-3 py-2 text-right font-medium">Durasi</th>
                      <th className="px-3 py-2 font-medium">Tayang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[{ ...m.self, title: `${m.self.title} (video ini)` }, ...m.rows].map((r, i) => (
                      <tr key={`${r.id}-${i}`} className={i === 0 ? "bg-accent/5 font-medium" : ""}>
                        <td className="max-w-[220px] truncate px-3 py-2" title={r.title}>
                          {r.title}
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(r.views)}</td>
                        <td className="px-3 py-2 text-right">{fmt(r.viewsPerDay)}</td>
                        <td className="px-3 py-2 text-right">
                          {r.likeRate != null ? `${fmt1(r.likeRate)}%` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right">{dur(r.durationSec)}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {r.hari}, {r.jam}.00
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <p className="mt-10 text-sm leading-relaxed text-muted">
            {a?.catatan_keterbatasan ? `${a.catatan_keterbatasan} ` : ""}
            Retention, CTR, dan impressions tidak ada di data publik, jadi diagnosis ini berdasarkan
            data yang terlihat dari luar.
          </p>
        </div>
      )}
    </main>
  );
}
