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

export const PLAYLISTS: Playlist[] = [];
