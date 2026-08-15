import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");

  if (!v) {
    return NextResponse.json({ error: "Missing video parameter v" }, { status: 400 });
  }

  // 1. Try Piped API streams
  try {
    const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${encodeURIComponent(v)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (pipedRes.ok) {
      const data = await pipedRes.json();
      if (data.audioStreams && data.audioStreams.length > 0) {
        const bestAudio = data.audioStreams.find((s: any) => s.mimeType?.includes("mp4") || s.mimeType?.includes("m4a")) || data.audioStreams[0];
        if (bestAudio && bestAudio.url) {
          return NextResponse.redirect(bestAudio.url, { status: 307 });
        }
      }
    }
  } catch {}

  // 2. Try Invidious Public Instances
  const invidiousInstances = [
    "https://invidious.nerdvpn.de",
    "https://inv.privacydev.net",
    "https://invidious.drgns.space",
    "https://vid.puffyan.us",
  ];

  for (const instance of invidiousInstances) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${encodeURIComponent(v)}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.adaptiveFormats && Array.isArray(data.adaptiveFormats)) {
          const audioFormats = data.adaptiveFormats.filter((f: any) => f.type?.includes("audio"));
          if (audioFormats.length > 0 && audioFormats[0].url) {
            return NextResponse.redirect(audioFormats[0].url, { status: 307 });
          }
        }
      }
    } catch {}
  }

  return NextResponse.json({ error: "Audio stream not found" }, { status: 404 });
}
