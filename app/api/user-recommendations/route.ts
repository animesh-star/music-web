import { NextResponse } from "next/server";
import { Track } from "../../data/playlists";

function normalizeTitle(t: string): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/feat\..*|ft\..*/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawInterests = searchParams.get("interests") || "bollywood,romantic,punjabi";
  const artist = searchParams.get("artist") || "";
  const vibe = searchParams.get("vibe") || "";
  const rawExclude = searchParams.get("exclude") || "";

  // Set of excluded normalized titles and track IDs
  const excludedTitles = new Set<string>();
  rawExclude.split("|").concat(rawExclude.split(",")).forEach(t => {
    const norm = normalizeTitle(t);
    if (norm) excludedTitles.add(norm);
  });

  const interestsList = rawInterests.split(",").map(s => s.trim()).filter(Boolean);

  // Build targeted search queries prioritizing current track vibe & user interests
  const searchQueries: string[] = [];

  if (artist && vibe) {
    searchQueries.push(`${artist} ${vibe}`);
  } else if (artist) {
    searchQueries.push(`${artist} top hit songs`);
  }

  if (vibe) {
    searchQueries.push(`${vibe} hit songs`);
  }

  // Append user interest keywords
  interestsList.slice(0, 3).forEach(interest => {
    if (vibe && !interest.toLowerCase().includes(vibe.toLowerCase())) {
      searchQueries.push(`${interest} ${vibe}`);
    } else {
      searchQueries.push(`${interest} songs`);
    }
  });

  let allResults: Track[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>(excludedTitles);

  for (const query of searchQueries.slice(0, 4)) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&country=in&limit=12`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.results)) {
          data.results.forEach((item: any) => {
            const trackId = `suggested-${item.trackId}`;
            const normTitle = normalizeTitle(item.trackName);

            // STICKY DEDUPLICATION: Never repeat same title or ID
            if (!seenIds.has(trackId) && normTitle && !seenTitles.has(normTitle)) {
              seenIds.add(trackId);
              seenTitles.add(normTitle);
              allResults.push({
                id: trackId,
                title: item.trackName,
                artist: item.artistName,
                film: item.collectionName || "",
                year: parseInt(item.releaseDate?.split("-")[0]) || 2024,
                duration: Math.floor(item.trackTimeMillis / 1000) || 180,
                videoId: "",
                audioUrl: item.previewUrl || undefined,
              });
            }
          });
        }
      }
    } catch (err) {
      console.error("Error fetching recommendation query:", query, err);
    }
  }

  return NextResponse.json({ recommendations: allResults.slice(0, 20) });
}
