import { AppError } from "./errors";
import type { ChannelInfo, CommentItem, VideoInfo, YtData } from "./types";

const BASE = "https://www.googleapis.com/youtube/v3";

async function yt(path: string, params: Record<string, string>): Promise<any> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new AppError("YOUTUBE_API_KEY belum diatur di server.", 500);

  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new AppError("Kuota YouTube API hari ini habis. Coba lagi besok.", 429, reason);
    }
    if (reason === "keyInvalid" || reason === "API_KEY_INVALID") {
      throw new AppError("YOUTUBE_API_KEY tidak valid.", 500, reason);
    }
    throw new AppError(
      `Gagal mengambil data YouTube (${res.status}${reason ? `: ${reason}` : ""}).`,
      res.status === 403 ? 502 : res.status,
      reason,
    );
  }
  return res.json();
}

function parseDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [d, h, mi, s] = [m[1], m[2], m[3], m[4]].map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

function mapVideo(item: any): VideoInfo {
  const s = item.snippet ?? {};
  const st = item.statistics ?? {};
  const th = s.thumbnails ?? {};
  return {
    id: item.id,
    title: s.title ?? "",
    description: s.description ?? "",
    tags: s.tags ?? [],
    channelId: s.channelId ?? "",
    channelTitle: s.channelTitle ?? "",
    publishedAt: s.publishedAt ?? new Date().toISOString(),
    durationSec: parseDuration(item.contentDetails?.duration ?? "PT0S"),
    views: Number(st.viewCount ?? 0),
    likes: Number(st.likeCount ?? 0),
    likesHidden: st.likeCount === undefined,
    comments: Number(st.commentCount ?? 0),
    thumbnail: (th.maxres ?? th.standard ?? th.high ?? th.medium ?? th.default)?.url ?? "",
  };
}

async function fetchOthers(uploadsId: string, selfId: string): Promise<VideoInfo[]> {
  try {
    const pl = await yt("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsId,
      maxResults: "20",
    });
    const ids: string[] = (pl.items ?? [])
      .map((i: any) => i.contentDetails?.videoId as string | undefined)
      .filter((id: string | undefined): id is string => !!id && id !== selfId)
      .slice(0, 15);
    if (!ids.length) return [];
    const vs = await yt("videos", {
      part: "snippet,statistics,contentDetails",
      id: ids.join(","),
    });
    return (vs.items ?? []).map(mapVideo);
  } catch (e) {
    if (e instanceof AppError && e.status === 429) throw e;
    return [];
  }
}

async function fetchComments(
  videoId: string,
): Promise<{ comments: CommentItem[]; disabled: boolean }> {
  try {
    const res = await yt("commentThreads", {
      part: "snippet",
      videoId,
      maxResults: "50",
      order: "relevance",
      textFormat: "plainText",
    });
    const comments: CommentItem[] = (res.items ?? []).map((i: any) => {
      const c = i.snippet?.topLevelComment?.snippet ?? {};
      return { text: String(c.textDisplay ?? "").slice(0, 300), likes: Number(c.likeCount ?? 0) };
    });
    return { comments, disabled: false };
  } catch (e) {
    if (e instanceof AppError && e.status === 429) throw e;
    return { comments: [], disabled: true };
  }
}

export async function fetchYoutubeData(videoId: string): Promise<YtData> {
  const vRes = await yt("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoId,
  });
  const item = vRes.items?.[0];
  if (!item) throw new AppError("Video tidak ditemukan, atau bersifat privat.", 404);
  const video = mapVideo(item);

  const cRes = await yt("channels", {
    part: "snippet,statistics,contentDetails",
    id: video.channelId,
  });
  const ch = cRes.items?.[0];
  const channel: ChannelInfo = {
    id: video.channelId,
    title: ch?.snippet?.title ?? video.channelTitle,
    subscribers: ch?.statistics?.hiddenSubscriberCount
      ? null
      : ch?.statistics?.subscriberCount !== undefined
        ? Number(ch.statistics.subscriberCount)
        : null,
    videoCount: Number(ch?.statistics?.videoCount ?? 0),
  };

  const uploadsId: string | undefined = ch?.contentDetails?.relatedPlaylists?.uploads;
  const [others, c] = await Promise.all([
    uploadsId ? fetchOthers(uploadsId, videoId) : Promise.resolve([] as VideoInfo[]),
    fetchComments(videoId),
  ]);

  return { video, channel, others, comments: c.comments, commentsDisabled: c.disabled };
}
