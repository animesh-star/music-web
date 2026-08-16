import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");

  if (!v) {
    return NextResponse.json({ error: "Missing video parameter v" }, { status: 400 });
  }

  // 1. Fast Piped API Cluster
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.tokhmi.xyz",
    "https://api.piped.privacydev.net",
    "https://pipedapi.adminforge.de",
  ];

  for (const instance of pipedInstances) {
    try {
      const pipedRes = await fetch(`${instance}/streams/${encodeURIComponent(v)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(3000),
      });
      if (pipedRes.ok) {
        const data = await pipedRes.json();
        if (data.audioStreams && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
          // Prefer m4a / mp4 audio container for highest mobile & lock screen compatibility
          const bestAudio =
            data.audioStreams.find((s: any) => s.mimeType?.includes("mp4") || s.mimeType?.includes("m4a")) ||
            data.audioStreams[0];
          if (bestAudio && bestAudio.url) {
            return NextResponse.redirect(bestAudio.url, { status: 307 });
          }
        }
      }
    } catch {}
  }

  // 2. Invidious Public Instances Cluster
  const invidiousInstances = [
    "https://invidious.f5.si",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.tiekoetter.com",
    "https://yt.chocolatemoo53.com",
  ];

  for (const instance of invidiousInstances) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${encodeURIComponent(v)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.adaptiveFormats && Array.isArray(data.adaptiveFormats)) {
          const audioFormats = data.adaptiveFormats.filter(
            (f: any) => f.type?.includes("audio") || f.container === "m4a" || f.container === "webm"
          );
          if (audioFormats.length > 0 && audioFormats[0].url) {
            return NextResponse.redirect(audioFormats[0].url, { status: 307 });
          }
        }
      }
    } catch {}
  }

  // 3. Cobalt API Stream Engine
  try {
    const cobaltRes = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${v}`,
        downloadMode: "audio",
        audioFormat: "mp3",
      }),
      signal: AbortSignal.timeout(3500),
    });
    if (cobaltRes.ok) {
      const cobaltData = await cobaltRes.json();
      if (cobaltData && cobaltData.url) {
        return NextResponse.redirect(cobaltData.url, { status: 307 });
      }
    }
  } catch {}

  return NextResponse.json({ error: "Audio stream not found" }, { status: 404 });
}
