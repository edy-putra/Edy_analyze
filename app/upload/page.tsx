"use client";

import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "../ThemeToggle";
import type { VideoAnalysis } from "@/lib/videoTypes";

type Kind = "auto" | "shorts" | "long";
const MAX = 200 * 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readDuration(f: File): Promise<number> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { res(v.duration || 0); URL.revokeObjectURL(v.src); };
    v.onerror = () => res(0);
    v.src = URL.createObjectURL(f);
  });
}

function upload(url: string, file: File, onProgress: (p: number) => void): Promise<{ name: string }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.setRequestHeader("X-Goog-Upload-Offset", "0");
    x.setRequestHeader("X-Goog-Upload-Command", "upload, finalize");
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        try { resolve(JSON.parse(x.responseText).file); } catch { reject(new Error("Respons upload tidak terbaca.")); }
      } else reject(new Error(`Upload ditolak Google (${x.status}).`));
    };
    x.onerror = () => reject(new Error("Upload ke Google gagal (jaringan atau pembatasan browser)."));
    x.send(file);
  });
}

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="neo-sm shrink-0 px-3 py-1 text-xs font-bold text-accent"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}>
      {ok ? "Tersalin" : "Salin"}
    </button>
  );
}

function Card({ tag, title, action, children }: { tag: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="neo mt-6 p-5">
      <div className="flex items-center justify-between gap-3"><span className="tag">{tag}</span>{action}</div>
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dur, setDur] = useState(0);
  const [kind, setKind] = useState<Kind>("auto");
  const [phase, setPhase] = useState<"idle" | "upload" | "analyze">("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [r, setR] = useState<(VideoAnalysis) | null>(null);

  async function pick(f: File | undefined) {
    setError(null); setR(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) return setError("File harus berupa video.");
    if (f.size > MAX) return setError("Ukuran video maksimal 200 MB.");
    setFile(f);
    setDur(await readDuration(f));
  }

  async function run() {
    if (!file || phase !== "idle") return;
    setError(null); setR(null); setPct(0); setPhase("upload");
    try {
      const init = await fetch("/api/upload-init", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const ij = await init.json();
      if (!init.ok) throw new Error(ij.error ?? "Gagal menyiapkan upload.");
      const up = await upload(ij.uploadUrl, file, setPct);

      setPhase("analyze");
      for (let i = 0; i < 25; i++) {
        const res = await fetch("/api/analyze-video", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: up.name, kind, durationSec: dur }),
        });
        const j = await res.json();
        if (res.status === 202) { await sleep(3000); continue; }
        if (!res.ok) throw new Error(j.error ?? "Gagal menganalisa video.");
        setR(j as VideoAnalysis);
        return;
      }
      throw new Error("Pemrosesan video terlalu lama. Coba video yang lebih pendek.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setPhase("idle");
    }
  }

  const kinds: [Kind, string][] = [["auto", "Otomatis"], ["shorts", "Shorts"], ["long", "Video panjang"]];
  const busy = phase !== "idle";
  const mb = file ? (file.size / 1048576).toFixed(1).replace(".", ",") : "";
  const menit = dur ? `${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")}` : "";

  return (
    <main className="mx-auto max-w-2xl px-5 pb-36 pt-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="neo-sm px-4 py-2 text-sm font-semibold">← Analisa link</Link>
        <ThemeToggle />
      </div>

      <header className="mt-4 text-center">
        <div className="neo mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl text-accent">⬆</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Upload video</h1>
        <p className="mt-1 text-sm text-muted">Judul, hashtag, dan deskripsi dari isi videomu · By Edy Putra</p>
      </header>

      <section className="neo mt-8 p-5">
        <span className="tag">LANGKAH 1</span>
        <h2 className="mt-3 text-lg font-bold">Pilih video</h2>
        <label className="neo-in mt-3 block cursor-pointer px-4 py-5 text-center">
          <input type="file" accept="video/*" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          <span className="font-semibold text-accent">{file ? "Ganti video" : "Pilih video dari perangkat"}</span>
          <span className="mt-1 block truncate text-xs text-muted">
            {file ? `${file.name} · ${mb} MB${menit ? ` · ${menit}` : ""}` : "MP4, MOV, atau WebM. Maksimal 200 MB."}
          </span>
        </label>
      </section>

      <section className="neo mt-6 p-5">
        <span className="tag">LANGKAH 2</span>
        <h2 className="mt-3 text-lg font-bold">Format konten</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {kinds.map(([k, label]) => (
            <button key={k} type="button" disabled={busy} onClick={() => setKind(k)} aria-pressed={kind === k}
              className={`neo-sm px-4 py-2 text-sm font-semibold ${kind === k ? "on" : ""}`}>{label}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Otomatis: video 3 menit atau kurang dianggap Shorts.</p>
      </section>

      {busy && (
        <section className="neo mt-6 p-5">
          <p className="text-sm font-semibold">
            {phase === "upload" ? `Mengunggah video… ${Math.round(pct * 100)}%` : "Gemini sedang menonton dan menganalisa videomu…"}
          </p>
          <div className="neo-in mt-2 h-3 overflow-hidden rounded-full p-0.5">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${phase === "upload" ? Math.max(pct * 100, 4) : 100}%`, opacity: phase === "upload" ? 1 : 0.5 }} />
          </div>
          {phase === "analyze" && <p className="mt-2 text-xs text-muted">Biasanya 30 sampai 90 detik. Jangan tutup halaman ini.</p>}
        </section>
      )}
      {error && <div role="alert" className="neo mt-6 p-4 text-sm font-medium text-bad">{error}</div>}

      {r && (
        <div>
          <Card tag="RINGKASAN" title={r.format === "shorts" ? "Hasil untuk Shorts" : "Hasil untuk video panjang"}>
            <p className="text-[15px] leading-relaxed">{r.ringkasan}</p>
          </Card>

          <Card tag="JUDUL" title="Pilihan judul">
            <ul className="space-y-3">
              {(r.judul ?? []).map((j, i) => (
                <li key={i} className="neo-in flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{j.teks}</p>
                    <p className="mt-1 text-xs text-muted">{j.teks.length} karakter · {j.gaya}</p>
                  </div>
                  <Copy text={j.teks} />
                </li>
              ))}
            </ul>
          </Card>

          <Card tag="HASHTAG" title="Hashtag" action={<Copy text={(r.hashtag ?? []).join(" ")} />}>
            <div className="flex flex-wrap gap-2">
              {(r.hashtag ?? []).map((h, i) => <span key={i} className="neo-sm px-3 py-1.5 text-sm font-semibold text-accent">{h}</span>)}
            </div>
            {r.tag_seo?.length ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">Tag SEO (kolom tag di YouTube Studio)</h3>
                  <Copy text={r.tag_seo.join(", ")} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{r.tag_seo.join(", ")}</p>
              </div>
            ) : null}
          </Card>

          <Card tag="DESKRIPSI" title="Deskripsi siap tempel" action={<Copy text={r.deskripsi ?? ""} />}>
            <div className="neo-in whitespace-pre-wrap p-4 text-sm leading-relaxed">{r.deskripsi}</div>
          </Card>

          <Card tag="HOOK" title="Detik-detik pertama">
            <p className="text-[15px] leading-relaxed">{r.hook?.penilaian}</p>
            <Bullets items={r.hook?.saran} />
          </Card>

          <Card tag="EVALUASI" title="Kekuatan dan kelemahan">
            <h3 className="text-sm font-bold">Kekuatan</h3>
            <Bullets items={r.kekuatan} />
            <h3 className="mt-4 text-sm font-bold">Kelemahan</h3>
            <Bullets items={r.kelemahan} />
          </Card>

          {r.saran_thumbnail?.length ? (
            <Card tag="THUMBNAIL" title="Ide thumbnail">
              <Bullets items={r.saran_thumbnail} />
            </Card>
          ) : null}

          {r.catatan && <p className="mt-8 text-xs leading-relaxed text-muted">{r.catatan}</p>}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 px-4 pb-4 pt-3" style={{ background: "var(--bg)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm">
            <div className="font-bold">{file ? "Video siap" : "Belum ada video"}</div>
            <div className="truncate text-xs text-muted">{file ? file.name : "Pilih video di atas"}</div>
          </div>
          <button type="button" onClick={run} disabled={!file || busy} className="btn shrink-0">
            {busy ? "Memproses…" : "Analisa"}
          </button>
        </div>
      </div>
    </main>
  );
}
