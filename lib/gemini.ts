import { AppError } from "./errors";

export const GEMINI = "https://generativelanguage.googleapis.com";

export function geminiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new AppError("GEMINI_API_KEY belum diatur di server.", 500);
  return k;
}

/** Panggil Gemini, kembalikan teks. Model dicoba berurutan kalau ada yang 404. */
export async function generate(parts: any[], system: string, timeoutMs = 45_000): Promise<string> {
  const key = geminiKey();
  const models = Array.from(
    new Set([process.env.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.5-flash"].filter(Boolean)),
  ) as string[];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
  });

  let res: Response | null = null;
  for (const m of models) {
    res = await fetch(`${GEMINI}/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 404) break;
  }

  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    if (status === 429) throw new AppError("Kuota Gemini sedang habis. Coba lagi beberapa saat lagi.", 429);
    if (status === 404) throw new AppError("Model Gemini tidak ditemukan. Isi GEMINI_MODEL di Vercel.", 502);
    const err = await res?.json().catch(() => null);
    throw new AppError(`Gemini menolak permintaan (${status}): ${err?.error?.message ?? "tanpa detail"}`, 502);
  }
  const json = await res.json();
  return (json.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
}
