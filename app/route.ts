import { NextResponse } from "next/server";
import { cacheGet, cacheSet, rateLimit } from "@/lib/cache";
import { AppError } from "@/lib/errors";
import { analyzeWithLLM } from "@/lib/llm";
import { computeMetrics } from "@/lib/metrics";
import { extractVideoId } from "@/lib/parseUrl";
import type { Analysis, AnalyzeResponse } from "@/lib/types";
import { fetchYoutubeData } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 60;

const SIX_HOURS = 6 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    if (!rateLimit(ip, 10, 60 * 60 * 1000)) {
      throw new AppError("Terlalu banyak permintaan. Coba lagi dalam beberapa menit.", 429);
    }

    const body = await req.json().catch(() => null);
    const videoId = extractVideoId(String(body?.url ?? ""));
    if (!videoId) throw new AppError("Link YouTube tidak valid.", 400);

    const cached = cacheGet<AnalyzeResponse>(videoId);
    if (cached) return NextResponse.json({ ...cached, cached: true });

    const data = await fetchYoutubeData(videoId);
    const { metrics, scores, overall } = computeMetrics(data);

    let analysis: Analysis | null = null;
    let analysisError: string | null = null;
    try {
      analysis = await analyzeWithLLM(data, metrics, scores);
    } catch (e) {
      analysisError = e instanceof AppError ? e.message : "Analisa AI gagal dijalankan.";
    }

    const result: AnalyzeResponse = {
      video: data.video,
      channel: data.channel,
      metrics,
      scores,
      overall,
      analysis,
      analysisError,
    };
    if (analysis) cacheSet(videoId, result, SIX_HOURS);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
  }
}
