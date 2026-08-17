import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");

  if (!v) {
    return NextResponse.json({ error: "Missing video parameter v" }, { status: 400 });
  }

  const range = request.headers.get("range");

  // High-availability audio stream provider endpoints
  const streamProviders = [
    `https://inv.nadeko.net/latest_version?id=${encodeURIComponent(v)}&itag=140`,
    `https://invidious.f5.si/latest_version?id=${encodeURIComponent(v)}&itag=140`,
    `https://invidious.nerdvpn.de/latest_version?id=${encodeURIComponent(v)}&itag=140`,
    `https://invidious.tiekoetter.com/latest_version?id=${encodeURIComponent(v)}&itag=140`,
  ];

  for (const streamUrl of streamProviders) {
    try {
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };
      if (range) {
        headers["Range"] = range;
      }

      const upstreamRes = await fetch(streamUrl, {
        headers,
        signal: AbortSignal.timeout(4000),
      });

      if (upstreamRes.ok || upstreamRes.status === 206) {
        const responseHeaders = new Headers();
        responseHeaders.set("Content-Type", upstreamRes.headers.get("content-type") || "audio/mp4");
        responseHeaders.set("Accept-Ranges", "bytes");
        responseHeaders.set("Cache-Control", "public, max-age=3600");

        if (upstreamRes.headers.get("content-length")) {
          responseHeaders.set("Content-Length", upstreamRes.headers.get("content-length")!);
        }
        if (upstreamRes.headers.get("content-range")) {
          responseHeaders.set("Content-Range", upstreamRes.headers.get("content-range")!);
        }

        return new Response(upstreamRes.body, {
          status: upstreamRes.status,
          headers: responseHeaders,
        });
      }
    } catch {}
  }

  // Fallback: Piped API stream resolver
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.tokhmi.xyz",
    "https://api.piped.privacydev.net",
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
          const bestAudio =
            data.audioStreams.find((s: any) => s.mimeType?.includes("mp4") || s.mimeType?.includes("m4a")) ||
            data.audioStreams[0];
          if (bestAudio && bestAudio.url) {
            const upstreamRes = await fetch(bestAudio.url, {
              headers: range ? { Range: range } : {},
              signal: AbortSignal.timeout(4000),
            });
            if (upstreamRes.ok || upstreamRes.status === 206) {
              const responseHeaders = new Headers();
              responseHeaders.set("Content-Type", upstreamRes.headers.get("content-type") || "audio/mp4");
              responseHeaders.set("Accept-Ranges", "bytes");
              if (upstreamRes.headers.get("content-length")) {
                responseHeaders.set("Content-Length", upstreamRes.headers.get("content-length")!);
              }
              if (upstreamRes.headers.get("content-range")) {
                responseHeaders.set("Content-Range", upstreamRes.headers.get("content-range")!);
              }
              return new Response(upstreamRes.body, {
                status: upstreamRes.status,
                headers: responseHeaders,
              });
            }
          }
        }
      }
    } catch {}
  }

  return NextResponse.json({ error: "Audio stream unavailable" }, { status: 503 });
}
