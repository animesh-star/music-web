import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter q" }, { status: 400 });
  }

  // 1. Try Invidious Public Instances (Never blocked by YouTube serverless bot check)
  const invidiousInstances = [
    "https://invidious.nerdvpn.de",
    "https://inv.privacydev.net",
    "https://invidious.drgns.space",
    "https://vid.puffyan.us",
  ];

  for (const instance of invidiousInstances) {
    try {
      const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(q)}&type=video`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0] && data[0].videoId) {
          return NextResponse.json({ videoId: data[0].videoId });
        }
      }
    } catch {}
  }

  // 2. Try Piped API
  try {
    const pipedRes = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(q)}&filter=music_songs`, {
      signal: AbortSignal.timeout(3000),
    });
    if (pipedRes.ok) {
      const pipedData = await pipedRes.json();
      if (pipedData && pipedData.items && pipedData.items[0] && pipedData.items[0].url) {
        const match = pipedData.items[0].url.match(/v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          return NextResponse.json({ videoId: match[1] });
        }
      }
    }
  } catch {}

  // 3. Fallback scraping YouTube search
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(4000),
    });
    const html = await response.text();
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/;
    const match = html.match(regex);

    if (match && match[1]) {
      return NextResponse.json({ videoId: match[1] });
    }
  } catch {}

  return NextResponse.json({ error: "No video found" }, { status: 404 });
}
