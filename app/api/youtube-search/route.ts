import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter q" }, { status: 400 });
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();

    // Regex to extract videoId from YouTube search page HTML
    const regex = /"videoId":"([^"]+)"/;
    const match = html.match(regex);

    if (match && match[1]) {
      return NextResponse.json({ videoId: match[1] });
    }

    return NextResponse.json({ error: "No video found" }, { status: 404 });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
