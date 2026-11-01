import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/cache";
import { AppError } from "@/lib/errors";
import { GEMINI, geminiKey } from "@/lib/gemini";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024;

// Langkah 1 upload: server minta alamat upload ke Google (pakai API key),
// lalu browser mengirim file langsung ke alamat itu. File tidak lewat Vercel.
export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    if (!rateLimit(`u:${ip}`, 8, 60 * 60 * 1000)) {
      throw new AppError("Terlalu banyak upload. Coba lagi nanti.", 429);
    }
    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "video").slice(0, 100);
    const type = String(body?.type ?? "");
    const size = Number(body?.size ?? 0);
    if (!type.startsWith("video/")) throw new AppError("File harus berupa video.", 400);
    if (!size || size > MAX_BYTES) throw new AppError("Ukuran video maksimal 200 MB.", 400);

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const init = await fetch(`${GEMINI}/upload/v1beta/files`, {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiKey(),
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": type,
        Origin: origin,
      },
      body: JSON.stringify({ file: { display_name: name } }),
    });
    const raw = init.headers.get("x-goog-upload-url");
    if (!init.ok || !raw) throw new AppError(`Gagal menyiapkan upload ke Google (${init.status}).`, 502);

    const u = new URL(raw);
    u.searchParams.delete("key");
    return NextResponse.json({ uploadUrl: u.toString() });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
  }
}
