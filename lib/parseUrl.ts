const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Ambil video ID dari berbagai format link YouTube (atau ID mentah). */
export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?]+)/);
      if (m) id = m[2];
    }
  }

  return id && ID_RE.test(id) ? id : null;
}
