export interface Track {
  id: string;
  title: string;
  artist: string;
  film?: string;
  year?: number;
  duration: number; // in seconds
  videoId: string;
  audioUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  tracks: Track[];
}

export const PLAYLISTS: Playlist[] = [
  {
    id: "spotify-library",
    name: "Spotify Music",
    description: "Connect Spotify to stream your custom music & playlists",
    accentColor: "#1DB954",
    tracks: [
      {
        id: "spotify-welcome-track",
        title: "Connect Spotify",
        artist: "Spotify Audio",
        film: "Echoa Music",
        year: 2026,
        duration: 180,
        videoId: "NIYznrc4-sA"
      }
    ]
  }
];
