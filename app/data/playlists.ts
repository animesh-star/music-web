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
  sceneClass: string;
  accentColor: string;
  tracks: Track[];
}

export const PLAYLISTS: Playlist[] = [
  {
    id: "my-playlist-1",
    name: "My Playlist #1",
    description: "Your Personal Playlist",
    sceneClass: "scene-a",
    accentColor: "#1DB954",
    tracks: [],
  },
];
