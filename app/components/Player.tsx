"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Disc, Layers, RotateCcw, RotateCw, Heart, ListMusic, X, Music, Shuffle, Repeat, Repeat1, Plus, Trash2 } from "lucide-react";
import { PLAYLISTS, Track, Playlist } from "../data/playlists";
import { track as trackAnalytics } from "@vercel/analytics";

// Helper to format seconds to mm:ss safely with bounds checks
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds) || seconds > 86400) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function normalizeTitle(t: string): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/feat\..*|ft\..*/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { target: YTPlayer; data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => any;
    };
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted?: () => boolean;
  setVolume: (volume: number) => void;
  loadVideoById: (args: string | { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (args: string | { videoId: string; startSeconds?: number }) => void;
  destroy: () => void;
}

// Global YouTube API loader guarantee
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (typeof window !== "undefined" && window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousReady) previousReady();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

// In production (Vercel), local audio files are not hosted — use YouTube directly.
// In local dev, audio files exist in public/audio/ so try HTML5 first.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const fallbackPlaylist: Playlist = {
  id: "search-playlist",
  name: "Search & Play",
  description: "Search any song to listen",
  accentColor: "#1DB954",
  tracks: [],
};

const fallbackTrack: Track = {
  id: "placeholder",
  title: "Search any song above 🔍",
  artist: "Type a song name to play instantly",
  film: "Echoa Player",
  year: 2026,
  duration: 180,
  videoId: "",
};

// FULLSCREEN PARTICLE CANVAS (Spawns smooth loving heart particle celebration for 5.5 seconds ONLY when adding to favorites)
interface ParticleCanvasProps {
  burstTrigger: { x: number; y: number; id: number } | null;
}

const ParticleCanvas = React.memo(function ParticleCanvas({
  burstTrigger,
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !burstTrigger) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      text: string;
      alpha: number;
      decay: number;
      rot: number;
      rotSpeed: number;
    }

    const particles: Particle[] = [];
    const heartSymbols = ["❤️", "💖", "💕", "✨", "🌸", "💓", "💗", "🌟", "🎵", "🎶"];

    // Initial smooth burst (28 particles)
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6;
      particles.push({
        x: burstTrigger.x,
        y: burstTrigger.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        size: 14 + Math.random() * 16,
        text: heartSymbols[Math.floor(Math.random() * heartSymbols.length)],
        alpha: 1,
        decay: 0.007 + Math.random() * 0.01,
        rot: (Math.random() - 0.5) * 0.4,
        rotSpeed: (Math.random() - 0.5) * 0.06,
      });
    }

    const startTime = performance.now();
    const TOTAL_DURATION = 5000; // Exactly 5 seconds total
    const SPAWN_DURATION = 3500;  // 3.5s spawning, 1.5s fade out

    const render = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed >= TOTAL_DURATION) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      if (elapsed < SPAWN_DURATION && Math.random() < 0.35) {
        const offsetX = (Math.random() - 0.5) * 70;
        const offsetY = (Math.random() - 0.5) * 50;
        particles.push({
          x: burstTrigger.x + offsetX,
          y: burstTrigger.y + offsetY,
          vx: (Math.random() - 0.5) * 2,
          vy: -1.2 - Math.random() * 2.2,
          size: 14 + Math.random() * 14,
          text: heartSymbols[Math.floor(Math.random() * heartSymbols.length)],
          alpha: 0.95,
          decay: 0.016 + Math.random() * 0.01,
          rot: (Math.random() - 0.5) * 0.3,
          rotSpeed: (Math.random() - 0.5) * 0.04,
        });
      }

      // Smooth fade out during the last 1 second
      const globalFade = elapsed > 4000 ? Math.max(0, (5000 - elapsed) / 1000) : 1;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= 0.97;
        p.vy = p.vy * 0.97 - 0.06; // smooth upward float with friction
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * globalFade));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [burstTrigger]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
    />
  );
});

// MODULE-SCOPED SUB-COMPONENTS to prevent React subtree remounting on progress ticks!

interface VinylProps {
  sizePx: number;
  isPlaying: boolean;
  videoId: string;
  spindleHoleSize?: number;
}

const Vinyl = React.memo(function Vinyl({
  sizePx,
  isPlaying,
  videoId,
  spindleHoleSize = 12,
}: VinylProps) {
  return (
    <div
      style={{ width: sizePx, height: sizePx }}
      className="relative shrink-0 rounded-full overflow-hidden shadow-2xl ring-1 ring-white/20 group bg-black"
    >
      {/* Vinyl Outer Groove Ring */}
      <div
        className="absolute inset-0 rounded-full animate-spin-custom overflow-hidden bg-neutral-950"
        style={{
          animationPlayState: isPlaying ? "running" : "paused",
        }}
      >
        {/* Track Cover Thumbnail */}
        {videoId ? (
          <img
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt="Vinyl artwork"
            className="w-full h-full object-cover rounded-full pointer-events-none scale-125 select-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-950 rounded-full scale-125 select-none overflow-hidden p-1.5">
            <img src="/echoa-logo.png" alt="Echoa" className="w-full h-full object-cover rounded-full shadow-lg" />
          </div>
        )}

        {/* Vinyl Grooves Texture Overlay */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-40"
          style={{
            background:
              "radial-gradient(circle, transparent 40%, rgba(255,255,255,0.18) 42%, transparent 43%, rgba(0,0,0,0.85) 60%, rgba(255,255,255,0.12) 75%, transparent 80%)",
          }}
        />
      </div>

      {/* Spindle Hole Overlay Centered Exactly */}
      <div
        style={{
          width: spindleHoleSize,
          height: spindleHoleSize,
        }}
        className="absolute inset-0 m-auto rounded-full bg-black/80 ring-2 ring-white/40 shadow-inner z-10 pointer-events-none"
      />
    </div>
  );
});

interface SeekBarProps {
  currentTime: number;
  duration: number;
  accentColor: string;
  onSeek: (time: number) => void;
}

const SeekBar = React.memo(function SeekBar({
  currentTime,
  duration,
  accentColor,
  onSeek,
}: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const validDuration = isFinite(duration) && duration > 0 ? duration : 180;
  const displayTime = dragTime !== null ? dragTime : currentTime;
  const progressPercent = Math.min(100, Math.max(0, (displayTime / validDuration) * 100));

  const calculateSeekTime = useCallback(
    (clientX: number) => {
      if (!barRef.current || validDuration <= 0) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return (clickX / rect.width) * validDuration;
    },
    [validDuration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const newTime = calculateSeekTime(e.clientX);
    setDragTime(newTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const newTime = calculateSeekTime(e.clientX);
    setDragTime(newTime);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const finalTime = dragTime !== null ? dragTime : calculateSeekTime(e.clientX);
    onSeek(finalTime);
    setDragTime(null);
  };

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative flex items-center h-6 cursor-pointer touch-none group select-none py-2 w-full"
    >
      {/* Visible Rail */}
      <div className="w-full h-[3px] rounded-full bg-white/15 overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
      </div>
      {/* Knob (Visible on Hover / Drag) */}
      <div
        className={`absolute w-3.5 h-3.5 rounded-full bg-white shadow-md transition-opacity duration-150 transform -translate-x-1/2 ${isDragging ? "opacity-100 scale-125" : "opacity-0 group-hover:opacity-100"
          }`}
        style={{
          left: `${progressPercent}%`,
          boxShadow: `0 0 8px ${accentColor}`,
        }}
      />
    </div>
  );
});

interface TransportProps {
  isPlaying: boolean;
  accentColor: string;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkipBack10: () => void;
  onSkipForward10: () => void;
  isMobile?: boolean;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 0 | 1 | 2; // 0: Off, 1: All, 2: One
  onToggleRepeat: () => void;
}

const TransportControls = React.memo(function TransportControls({
  isPlaying,
  accentColor,
  onPlayPause,
  onPrev,
  onNext,
  onSkipBack10,
  onSkipForward10,
  isMobile = false,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
}: TransportProps) {
  const handleClick = (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    cb();
  };

  if (isMobile) {
    return (
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={handleClick(onToggleShuffle)}
          className={`min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors active:scale-95 cursor-pointer ${isShuffle ? 'text-[#1DB954]' : 'text-white/40 hover:text-white/70'}`}
        >
          <Shuffle className="w-4 h-4" />
        </button>

        <button
          onClick={handleClick(onPrev)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/80 hover:text-white transition-colors active:scale-95 cursor-pointer"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        {/* Skip 10s Back */}
        <button
          onClick={handleClick(onSkipBack10)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95 cursor-pointer relative"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="absolute -bottom-1 text-[8.5px] font-mono font-bold text-white/60">10s</span>
        </button>

        {/* Mobile 52px Play/Pause Button */}
        <button
          onClick={handleClick(onPlayPause)}
          style={{
            background: `linear-gradient(135deg, ${accentColor} 0%, rgba(255,255,255,0.2) 100%)`,
            boxShadow: `0 8px 24px -4px ${accentColor}80`,
          }}
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center ring-1 ring-white/25 active:scale-95 transition-transform cursor-pointer mx-1"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white fill-white" />
          ) : (
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          )}
        </button>

        {/* Skip 10s Forward */}
        <button
          onClick={handleClick(onSkipForward10)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95 cursor-pointer relative"
        >
          <RotateCw className="w-4 h-4" />
          <span className="absolute -bottom-1 text-[8.5px] font-mono font-bold text-white/60">10s</span>
        </button>

        <button
          onClick={handleClick(onNext)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/80 hover:text-white transition-colors active:scale-95 cursor-pointer"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        <button
          onClick={handleClick(onToggleRepeat)}
          className={`min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors active:scale-95 cursor-pointer ${repeatMode !== 0 ? 'text-[#1DB954]' : 'text-white/40 hover:text-white/70'}`}
        >
          {repeatMode === 2 ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleClick(onToggleShuffle)}
        className={`p-1.5 transition-colors active:scale-90 cursor-pointer ${isShuffle ? 'text-[#1DB954]' : 'text-white/40 hover:text-white/70'}`}
        aria-label="Toggle Shuffle"
        title="Shuffle"
      >
        <Shuffle className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={handleClick(onPrev)}
        className="p-1.5 text-white/70 hover:text-white transition-colors active:scale-90 cursor-pointer"
        aria-label="Previous track"
        title="Previous Track (P)"
      >
        <SkipBack className="w-3.5 h-3.5" />
      </button>

      {/* 10s Rewind */}
      <button
        onClick={handleClick(onSkipBack10)}
        className="p-1.5 text-white/70 hover:text-white transition-colors active:scale-90 cursor-pointer relative group"
        aria-label="Rewind 10 seconds"
        title="Rewind 10s (Left Arrow)"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={handleClick(onPlayPause)}
        style={{
          backgroundColor: accentColor,
          boxShadow: `0 0 16px ${accentColor}60`,
        }}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
        aria-label={isPlaying ? "Pause" : "Play"}
        title="Play/Pause (Spacebar)"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-white text-white" />
        ) : (
          <Play className="w-4 h-4 fill-white text-white ml-0.5" />
        )}
      </button>

      {/* 10s Fast Forward */}
      <button
        onClick={handleClick(onSkipForward10)}
        className="p-1.5 text-white/70 hover:text-white transition-colors active:scale-90 cursor-pointer relative group"
        aria-label="Forward 10 seconds"
        title="Fast Forward 10s (Right Arrow)"
      >
        <RotateCw className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={handleClick(onNext)}
        className="p-1.5 text-white/70 hover:text-white transition-colors active:scale-90 cursor-pointer"
        aria-label="Next track"
        title="Next Track (N)"
      >
        <SkipForward className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={handleClick(onToggleRepeat)}
        className={`p-1.5 transition-colors active:scale-90 cursor-pointer ${repeatMode !== 0 ? 'text-[#1DB954]' : 'text-white/40 hover:text-white/70'}`}
        aria-label="Toggle Repeat"
        title={repeatMode === 2 ? "Repeat One" : "Repeat All"}
      >
        {repeatMode === 2 ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
});

// DESKTOP PLAYER COMPONENT
interface DesktopPlayerProps {
  onAddCurrentToPlaylist?: () => void;
  showFullLyrics?: boolean;
  onToggleFullLyrics?: () => void;
  currentLyricText?: string;
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  accentColor: string;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkipBack10: () => void;
  onSkipForward10: () => void;
  onSeek: (time: number) => void;
  playlists: Playlist[];
  currentPlaylistId: string;
  onSwitchPlaylist: (playlistId: string) => void;
  showMusicList: boolean;
  onToggleMusicList: () => void;
  spotifyLoggedIn?: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
  isSearching: boolean;
  searchResults: Track[];
  onPlaySearchResult: (track: Track) => void;
  isLoadingPlaylist?: boolean;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 0 | 1 | 2;
  onToggleRepeat: () => void;
}

const DesktopPlayer = React.memo(function DesktopPlayer({
  onAddCurrentToPlaylist,
  showFullLyrics,
  onToggleFullLyrics,
  currentLyricText,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  accentColor,
  isFavorite,
  onToggleFavorite,
  onPlayPause,
  onPrev,
  onNext,
  onSkipBack10,
  onSkipForward10,
  onSeek,
  playlists,
  currentPlaylistId,
  onSwitchPlaylist,
  showMusicList,
  onToggleMusicList,
  spotifyLoggedIn,
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  searchResults,
  onPlaySearchResult,
  isLoadingPlaylist,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  
  
  
}: DesktopPlayerProps) {
  return (
    <>
      <div
        className="hidden sm:flex items-center gap-4 w-full rounded-full p-3 pr-5 glass-pill transition-all duration-300"
      style={{
        backdropFilter: 'blur(72px) saturate(2) brightness(1.1)',
        WebkitBackdropFilter: 'blur(72px) saturate(2) brightness(1.1)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
      }}
    >
      {/* 80px Spinning Vinyl */}
      <Vinyl
        sizePx={80}
        isPlaying={isPlaying}
        videoId={currentTrack.videoId}
        spindleHoleSize={12}
      />

      {/* Track Info & Progress */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
            <h2 className="text-sm sm:text-base font-bold text-rose-300 drop-shadow-sm whitespace-nowrap shrink-0 tracking-tight">
              {currentTrack.title}
            </h2>
            <span className="text-white/40 text-xs shrink-0">•</span>
            <p className="text-xs sm:text-sm text-white/80 font-medium whitespace-nowrap shrink-0">
              {currentTrack.artist} {currentTrack.film ? `(${currentTrack.film})` : ""}
            </p>
            <button
              onClick={onToggleFavorite}
              className="p-1 text-white/60 hover:text-rose-400 transition-all active:scale-125 cursor-pointer shrink-0 ml-1"
              aria-label="Toggle Favorite"
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Heart
                className={`w-4 h-4 transition-all duration-300 ${isFavorite
                    ? "fill-rose-500 text-rose-500 scale-110 drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]"
                    : "text-white/60 hover:text-rose-400"
                  }`}
              />
            </button>
          </div>

          {/* Playlist selector dropdown & Music List Toggle Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-full text-[11px] font-medium text-white/90 border border-white/10 transition-colors">
              <Layers className="w-3 h-3 text-white/70" />
              <select
                value={currentPlaylistId}
                onChange={(e) => {
                  onSwitchPlaylist(e.target.value);
                  e.target.blur();
                }}
                className="bg-transparent text-white focus:outline-none cursor-pointer text-[11px] font-medium"
              >
                {playlists.filter(pl => !pl.id.startsWith("search-play-")).map((pl) => (
                  <option key={pl.id} value={pl.id} className="bg-neutral-900 text-white">
                    {pl.name}
                  </option>
                ))}
                {!spotifyLoggedIn && (
                  <option value="connect-spotify" className="bg-neutral-900 text-[#1DB954] font-semibold">
                    🎵 Connect Spotify
                  </option>
                )}
              </select>
            </div>


            <button
              type="button"
              onClick={onAddCurrentToPlaylist}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
              title="Add current song to Playlist"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add to Playlist</span>
            </button>
          </div>
        </div>

        {/* Seek Bar */}
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          accentColor={accentColor}
          onSeek={onSeek}
        />

        {/* Time Counters */}
        <div className="flex justify-between items-center text-[12px] text-white font-bold font-mono tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        {/* Lower-Side Synced Lyrics Bar with Expand Option */}
        {currentLyricText && (
          <div className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-1 px-3 mt-1 flex items-center justify-between gap-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-emerald-400 animate-pulse text-[11px]">♪</span>
              <p className="text-xs font-semibold text-emerald-300/90 tracking-wide truncate drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                {currentLyricText}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleFullLyrics}
              className="lyrics-toggle-btn text-[10px] text-emerald-400 hover:text-emerald-200 font-bold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-2 py-0.5 rounded-full transition-all cursor-pointer shrink-0"
              title="Expand Full Lyrics"
            >
              {showFullLyrics ? 'Compress ⤢' : 'Expand ⤢'}
            </button>
          </div>
        )}
      </div>

      {/* Right Transport */}
      <div className="pl-2 border-l border-white/10">
        <TransportControls
          isPlaying={isPlaying}
          accentColor={accentColor}
          onPlayPause={onPlayPause}
          onPrev={onPrev}
          onNext={onNext}
          onSkipBack10={onSkipBack10}
          onSkipForward10={onSkipForward10}
          isMobile={false}
          isShuffle={isShuffle}
          onToggleShuffle={onToggleShuffle}
          repeatMode={repeatMode}
          onToggleRepeat={onToggleRepeat}
        />
      </div>
    </div>

    </>
  );
});

// MOBILE PLAYER COMPONENT
interface MobilePlayerProps {
  onAddCurrentToPlaylist?: () => void;
  showFullLyrics?: boolean;
  onToggleFullLyrics?: () => void;
  currentLyricText?: string;
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  accentColor: string;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkipBack10: () => void;
  onSkipForward10: () => void;
  onSeek: (time: number) => void;
  playlists: Playlist[];
  currentPlaylistId: string;
  onSwitchPlaylist: (playlistId: string) => void;
  showMusicList: boolean;
  onToggleMusicList: () => void;
  spotifyLoggedIn?: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
  isSearching: boolean;
  searchResults: Track[];
  onPlaySearchResult: (track: Track) => void;
  isLoadingPlaylist?: boolean;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 0 | 1 | 2;
  onToggleRepeat: () => void;
}

const MobilePlayer = React.memo(function MobilePlayer({
  onAddCurrentToPlaylist,
  showFullLyrics,
  onToggleFullLyrics,
  currentLyricText,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  accentColor,
  isFavorite,
  onToggleFavorite,
  onPlayPause,
  onPrev,
  onNext,
  onSkipBack10,
  onSkipForward10,
  onSeek,
  playlists,
  currentPlaylistId,
  onSwitchPlaylist,
  showMusicList,
  onToggleMusicList,
  spotifyLoggedIn,
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  searchResults,
  onPlaySearchResult,
  isLoadingPlaylist,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  
  
  
}: MobilePlayerProps) {
  return (
    <>
      <div
        className="flex flex-col sm:hidden gap-3.5 w-full rounded-[26px] p-4 glass-pill transition-all duration-300"
      style={{
        backdropFilter: 'blur(72px) saturate(2) brightness(1.1)',
        WebkitBackdropFilter: 'blur(72px) saturate(2) brightness(1.1)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
      }}
    >
      {/* Row 1: 64px Vinyl + Title/Artist */}
      <div className="flex items-center gap-3.5 min-w-0">
        <Vinyl
          sizePx={64}
          isPlaying={isPlaying}
          videoId={currentTrack.videoId}
          spindleHoleSize={10}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h2 className="text-xs sm:text-sm font-bold text-rose-300 drop-shadow-sm whitespace-nowrap overflow-x-auto no-scrollbar">
              {currentTrack.title}
            </h2>
            <button
              onClick={onToggleFavorite}
              className="p-1 text-white/60 hover:text-rose-400 transition-all active:scale-125 cursor-pointer shrink-0"
              aria-label="Toggle Favorite"
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Heart
                className={`w-4 h-4 transition-all duration-300 ${isFavorite
                    ? "fill-rose-500 text-rose-500 scale-110 drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]"
                    : "text-white/60 hover:text-rose-400"
                  }`}
              />
            </button>
          </div>
          <p className="text-[12px] text-white/70 truncate">
            {currentTrack.artist}
          </p>

          {/* Playlist selector & Music List Toggle on mobile */}
          <div className="mt-1 flex items-center justify-between gap-1 text-[10.5px] text-white/80">
            <div className="flex items-center gap-1">
              <Disc className="w-3 h-3 text-white/60" />
              <select
                value={currentPlaylistId}
                onChange={(e) => {
                  onSwitchPlaylist(e.target.value);
                  e.target.blur();
                }}
                className="bg-black/30 text-white rounded-md px-1.5 py-0.5 focus:outline-none text-[10.5px]"
              >
                {playlists.filter(pl => !pl.id.startsWith("search-play-")).map((pl) => (
                  <option key={pl.id} value={pl.id} className="bg-neutral-900 text-white">
                    {pl.name}
                  </option>
                ))}
                {!spotifyLoggedIn && (
                  <option value="connect-spotify" className="bg-neutral-900 text-[#1DB954] font-semibold">
                    🎵 Connect Spotify
                  </option>
                )}
              </select>
            </div>

            <div className="flex">
              <button
                type="button"
                onClick={onAddCurrentToPlaylist}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
                title="Add current song to Playlist"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Playlist</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Full-width Seek Bar */}
      <div className="w-full -my-1">
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          accentColor={accentColor}
          onSeek={onSeek}
        />
      </div>

      {/* Lower-Side Synced Lyrics Bar with Expand Option (Mobile) */}
      {currentLyricText && (
        <div className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-1 px-3 my-1 flex items-center justify-between gap-2 animate-in fade-in duration-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-emerald-400 animate-pulse text-[10px]">♪</span>
            <p className="text-[11px] font-semibold text-emerald-300/90 tracking-wide truncate drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
              {currentLyricText}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleFullLyrics}
            className="lyrics-toggle-btn text-[9px] text-emerald-400 hover:text-emerald-200 font-bold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-2 py-0.5 rounded-full transition-all cursor-pointer shrink-0"
            title="Expand Full Lyrics"
          >
            {showFullLyrics ? 'Compress ⤢' : 'Expand ⤢'}
          </button>
        </div>
      )}

      {/* Row 3: Elapsed/Duration on left, Transport centered */}
      <div className="flex items-center justify-between min-w-0 pt-0.5">
        <div className="text-[12px] text-white font-bold font-mono tabular-nums flex flex-col leading-tight">
          <span>{formatTime(currentTime)}</span>
          <span className="text-white/70">{formatTime(duration)}</span>
        </div>

        <div className="flex-1 flex justify-center">
          <TransportControls
            isPlaying={isPlaying}
            accentColor={accentColor}
            onPlayPause={onPlayPause}
            onPrev={onPrev}
            onNext={onNext}
            onSkipBack10={onSkipBack10}
            onSkipForward10={onSkipForward10}
            isMobile={true}
            isShuffle={isShuffle}
            onToggleShuffle={onToggleShuffle}
            repeatMode={repeatMode}
            onToggleRepeat={onToggleRepeat}
          />
        </div>

        {/* Spacer for symmetry */}
        <div className="w-4" />
      </div>
    </div>
    </>
  );
});

// MAIN PLAYER CLIENT CONTAINER
export default function Player({
  onSceneChange,
}: {
  onSceneChange?: (sceneClass: string) => void;
}) {
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string>("trending-indian");
  const [trackIndex, setTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [showMusicList, setShowMusicList] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [hasStartedSession, setHasStartedSession] = useState<boolean>(false);

  // Spotify integration state
  const [playlists, setPlaylists] = useState<Playlist[]>(PLAYLISTS);
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState<boolean>(false);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [isSpotifyPremium, setIsSpotifyPremium] = useState<boolean | null>(null);
  const spotifyPlayerRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [customPlaylists, setCustomPlaylists] = useState<Playlist[]>([]);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<Track | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [playlistToastMsg, setPlaylistToastMsg] = useState<string | null>(null);

  // Load User Custom Playlists from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedCustom = localStorage.getItem("phoenix_user_playlists");
        if (savedCustom) {
          const parsed: Playlist[] = JSON.parse(savedCustom);
          setCustomPlaylists(parsed);
          setPlaylists(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newLists = parsed.filter(p => !existingIds.has(p.id));
            return [...prev, ...newLists];
          });
        }
      } catch {}
    }
  }, []);

  const saveCustomPlaylists = (updated: Playlist[]) => {
    setCustomPlaylists(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("phoenix_user_playlists", JSON.stringify(updated));
      } catch {}
    }
  };

  const handleCreateNewPlaylist = (name: string, trackToAdd?: Track) => {
    if (!name.trim()) return;
    const newPl: Playlist = {
      id: `user-pl-${Date.now()}`,
      name: name.trim(),
      description: "Custom User Playlist",
      accentColor: "#1DB954",
      tracks: trackToAdd ? [trackToAdd] : [],
    };
    const updatedCustom = [...customPlaylists, newPl];
    saveCustomPlaylists(updatedCustom);
    setPlaylists(prev => [...prev, newPl]);
    playlistStatesRef.current[newPl.id] = { trackIndex: 0, currentTime: 0 };
    setNewPlaylistName("");
    setShowCreatePlaylistModal(false);
    setTrackToAddToPlaylist(null);

    setPlaylistToastMsg(`Created "${newPl.name}"${trackToAdd ? " & added song!" : ""}`);
    setTimeout(() => setPlaylistToastMsg(null), 3000);
  };

  const handleDeletePlaylist = (playlistId: string) => {
    if (!playlistId.startsWith("user-pl-")) return;

    const targetPl = playlists.find(p => p.id === playlistId);
    const updatedCustom = customPlaylists.filter(p => p.id !== playlistId);
    saveCustomPlaylists(updatedCustom);
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));

    if (currentPlaylistId === playlistId) {
      const remaining = playlists.filter(p => p.id !== playlistId);
      if (remaining.length > 0) {
        setCurrentPlaylistId(remaining[0].id);
        setTrackIndex(0);
        setCurrentTime(0);
      }
    }

    setPlaylistToastMsg(`Deleted playlist "${targetPl?.name || "Custom"}"`);
    setTimeout(() => setPlaylistToastMsg(null), 3000);
  };

  const handleAddTrackToPlaylist = (playlistId: string, track: Track) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        if (pl.tracks.some(t => t.id === track.id)) return pl;
        return { ...pl, tracks: [...pl.tracks, track] };
      }
      return pl;
    }));

    const updatedCustom = customPlaylists.map(pl => {
      if (pl.id === playlistId) {
        if (pl.tracks.some(t => t.id === track.id)) return pl;
        return { ...pl, tracks: [...pl.tracks, track] };
      }
      return pl;
    });
    saveCustomPlaylists(updatedCustom);

    const targetPl = playlists.find(p => p.id === playlistId);
    setPlaylistToastMsg(`Added "${track.title}" to ${targetPl?.name || "Playlist"}`);
    setTimeout(() => setPlaylistToastMsg(null), 3000);
    setTrackToAddToPlaylist(null);
  };
  const [showFullLyrics, setShowFullLyrics] = useState(false);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);

  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<0|1|2>(0);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to read cookies on client side
  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null;
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }, []);
  // Native HTML5 audio stream is primary player for failproof background & lock screen audio
  const [useYtFallback, setUseYtFallback] = useState<boolean>(false);
  const useYtFallbackRef = useRef<boolean>(false);

  useEffect(() => {
    useYtFallbackRef.current = useYtFallback;
  }, [useYtFallback]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadedYtVideoId = useRef<string | null>(null);
  const musicListRef = useRef<HTMLDivElement | null>(null);
  const fullLyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeWrapperRef = useRef<HTMLDivElement | null>(null);

  // Per-playlist playback memory store (remembers last track & exact timestamp for Scene A, B, C)
  const playlistStatesRef = useRef<Record<string, { trackIndex: number; currentTime: number }>>({
    "trending-indian": { trackIndex: 0, currentTime: 0 },
    "bollywood-classics": { trackIndex: 0, currentTime: 0 },
    "punjabi-modern": { trackIndex: 0, currentTime: 0 },
  });

  const initialSeekTimeRef = useRef<number>(0);
  const savedSeekPositionRef = useRef<number>(0);
  const lastSaveTimeRef = useRef<number>(0);
  const playedTrackIdsRef = useRef<Set<string>>(new Set());
  const userPausedRef = useRef<boolean>(true);

  // Hydrate scene & position memory from localStorage on client load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedPlaylistId = localStorage.getItem("phoenix_active_playlist_id");
        const savedStates = localStorage.getItem("phoenix_playlist_states");
        const savedFavs = localStorage.getItem("phoenix_favorite_tracks");

        if (savedStates) {
          const parsed = JSON.parse(savedStates);
          playlistStatesRef.current = { ...playlistStatesRef.current, ...parsed };
        }

        if (savedFavs) {
          setFavorites(JSON.parse(savedFavs));
        }

        if (savedPlaylistId) {
          const savedState = playlistStatesRef.current[savedPlaylistId];
          setCurrentPlaylistId(savedPlaylistId);
          if (savedState) {
            setTrackIndex(savedState.trackIndex || 0);
            setCurrentTime(savedState.currentTime || 0);
            initialSeekTimeRef.current = savedState.currentTime || 0;
          }
        }
      } catch {
        // ignore localStorage errors
      } finally {
        setIsHydrated(true);
      }
    }
  }, []);

  // User Interest Profile & Smart Recommendations Engine
  const fetchUserRecommendations = useCallback(async (interestsList?: string[]) => {
    try {
      let terms = interestsList;
      if (!terms && typeof window !== "undefined") {
        const saved = localStorage.getItem("phoenix_user_music_interests");
        if (saved) terms = JSON.parse(saved);
      }
      if (!terms || terms.length === 0) {
        terms = ["arijit singh", "punjabi hits", "bollywood romantic"];
      }

      const res = await fetch(`/api/user-recommendations?interests=${encodeURIComponent(terms.join(","))}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          const recommendedPl: Playlist = {
            id: "user-recommended-vibes",
            name: "🌟 Recommended For You",
            description: "Based on your search & listening history",
            accentColor: "#ec4899",
            tracks: data.recommendations,
          };

          setPlaylists(prev => {
            const exists = prev.some(p => p.id === "user-recommended-vibes");
            if (exists) {
              return prev.map(p => p.id === "user-recommended-vibes" ? recommendedPl : p);
            }
            return [recommendedPl, ...prev];
          });
        }
      }
    } catch (err) {
      console.error("Error loading user recommendations:", err);
    }
  }, []);

  const recordUserInterest = useCallback((queryOrTrack: string | Track) => {
    if (typeof window === "undefined") return;
    try {
      const existing = localStorage.getItem("phoenix_user_music_interests");
      let interests: string[] = existing ? JSON.parse(existing) : [];

      let term = "";
      if (typeof queryOrTrack === "string") {
        term = queryOrTrack.trim();
      } else if (queryOrTrack) {
        term = `${queryOrTrack.artist} ${queryOrTrack.title}`;
      }

      if (term && term.length >= 2) {
        interests = [term, ...interests.filter(t => t.toLowerCase() !== term.toLowerCase())].slice(0, 10);
        localStorage.setItem("phoenix_user_music_interests", JSON.stringify(interests));
        fetchUserRecommendations(interests);
      }
    } catch {}
  }, [fetchUserRecommendations]);

  useEffect(() => {
    if (isHydrated) {
      fetchUserRecommendations();
    }
  }, [isHydrated, fetchUserRecommendations]);

  // Spotify Data Loader (Playlists, Liked Songs, Top Tracks)
  const loadSpotifyData = useCallback(async (token: string) => {
    setSpotifyLoggedIn(true);

    const headers = { Authorization: `Bearer ${token}` };

    const parseTrack = (item: any): Track | null => {
      const track = item.track || item;
      if (!track || !track.id) return null;
      return {
        id: `spotify-${track.id}`,
        title: track.name,
        artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
        film: track.album?.name || "",
        year: parseInt(track.album?.release_date?.split("-")[0]) || 2024,
        duration: Math.floor(track.duration_ms / 1000) || 180,
        videoId: "",
      };
    };

    try {
      // Fetch Liked Songs (first page)
      const likedRes = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", { headers });
      if (likedRes.status === 401) throw new Error("Unauthorized");
      if (likedRes.ok) {
        const likedData = await likedRes.json();
        const likedTracks = likedData.items.map(parseTrack).filter(Boolean) as Track[];
        
        setPlaylists(prev => {
          if (prev.some(p => p.id === "spotify-liked-songs")) return prev;
          return [...prev, {
            id: "spotify-liked-songs",
            name: "Spotify: Liked Songs",
            description: "Your Saved Tracks",
            accentColor: "#1DB954",
            tracks: likedTracks,
            spotifyUrl: likedData.next // Store next URL for background loading
          } as any];
        });
        if (!playlistStatesRef.current["spotify-liked-songs"]) {
          playlistStatesRef.current["spotify-liked-songs"] = { trackIndex: 0, currentTime: 0 };
        }
      }

      // Fetch User Playlists
      const plRes = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", { headers });
      if (plRes.ok) {
        const plData = await plRes.json();
        const userPlaylists = plData.items.map((pl: any) => ({
          id: `spotify-pl-${pl.id}`,
          name: `Spotify: ${pl.name}`,
          description: pl.description || "",
          accentColor: "#1DB954",
          tracks: [], // Empty initially, loaded on click
          spotifyUrl: pl.tracks.href // Store API URL to fetch tracks later
        }));
        setPlaylists(prev => {
          const newLists = userPlaylists.filter((np: any) => !prev.some((p: any) => p.id === np.id));
          return [...prev, ...newLists];
        });
        userPlaylists.forEach((pl: any) => {
           if (!playlistStatesRef.current[pl.id]) {
             playlistStatesRef.current[pl.id] = { trackIndex: 0, currentTime: 0 };
           }
        });
      }

      // Restore exact active Spotify playlist & position from localStorage on page refresh!
      if (typeof window !== "undefined") {
        const savedPlaylistId = localStorage.getItem("phoenix_active_playlist_id");
        const savedStates = localStorage.getItem("phoenix_playlist_states");
        if (savedPlaylistId && savedStates) {
          try {
            const parsed = JSON.parse(savedStates);
            playlistStatesRef.current = { ...playlistStatesRef.current, ...parsed };
            const savedState = playlistStatesRef.current[savedPlaylistId];
            if (savedState) {
              setCurrentPlaylistId(savedPlaylistId);
              setTrackIndex(savedState.trackIndex || 0);
              setCurrentTime(savedState.currentTime || 0);
              initialSeekTimeRef.current = savedState.currentTime || 0;
            }
          } catch {}
        }
      }

    } catch (err) {
      if ((err as Error).message === "Unauthorized") {
        document.cookie = "spotify_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        setSpotifyLoggedIn(false);
      }
      console.error("Failed to load Spotify data:", err);
    }
  }, []);

  // Background Loader for huge playlists
  const loadRemainingTracks = async (playlistId: string, nextUrl: string) => {
    const token = getCookie("spotify_access_token");
    if (!token || !nextUrl) return;
    
    let currentUrl = nextUrl;
    while (currentUrl) {
      try {
        const res = await fetch(currentUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) break;
        const data = await res.json();
        
        const newTracks: Track[] = data.items.map((item: any) => {
          const track = item.track || item;
          if (!track || !track.id) return null;
          return {
            id: `spotify-${track.id}`,
            title: track.name,
            artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
            film: track.album?.name || "",
            year: parseInt(track.album?.release_date?.split("-")[0]) || 2024,
            duration: Math.floor(track.duration_ms / 1000) || 180,
            videoId: "",
          };
        }).filter(Boolean) as Track[];

        setPlaylists(prev => prev.map(p => {
          if (p.id === playlistId) {
            const existingIds = new Set(p.tracks.map(t => t.id));
            const unique = newTracks.filter(t => !existingIds.has(t.id));
            return { ...p, tracks: [...p.tracks, ...unique] };
          }
          return p;
        }));
        
        currentUrl = data.next;
      } catch (err) {
        console.error("Background load error:", err);
        break;
      }
    }
  };

  // Fetch Spotify tracks on load OR auto-refresh token if expired OR when postMessage login event fires
  useEffect(() => {
    const initSpotifyAuth = async () => {
      let token = getCookie("spotify_access_token");
      const refreshToken = getCookie("spotify_refresh_token") || (typeof localStorage !== "undefined" ? localStorage.getItem("spotify_refresh_token") : null);

      if (!token && refreshToken) {
        try {
          const res = await fetch(`/api/spotify-refresh?refresh_token=${encodeURIComponent(refreshToken)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.access_token) {
              token = data.access_token;
            }
          }
        } catch (err) {
          console.error("Auto Spotify refresh error:", err);
        }
      }

      if (token) {
        setSpotifyLoggedIn(true);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("spotify_connected", "true");
        }
        loadSpotifyData(token);
      }
    };

    initSpotifyAuth();

    const handleSpotifyMessage = (event: MessageEvent) => {
      if (event.data === "spotify_login_success" || (event.data && typeof event.data === "object" && event.data.type === "spotify_login_success")) {
        const newToken = getCookie("spotify_access_token");
        if (newToken) {
          setSpotifyLoggedIn(true);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("spotify_connected", "true");
          }
          loadSpotifyData(newToken);
          setCurrentPlaylistId("spotify-top-tracks");
          setTrackIndex(0);
          setCurrentTime(0);
        }
      }
    };

    window.addEventListener("message", handleSpotifyMessage);
    return () => window.removeEventListener("message", handleSpotifyMessage);
  }, [getCookie, loadSpotifyData]);

  // Keep-alive silent audio context player to prevent background throttling on lock screen
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      audio.loop = true;
      silentAudioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    if (!silentAudioRef.current) return;
    if (isPlaying) {
      silentAudioRef.current.play().catch(() => {});
    } else {
      silentAudioRef.current.pause();
    }
  }, [isPlaying]);

  const currentPlaylist = playlists.find((p) => p.id === currentPlaylistId) || playlists[0] || fallbackPlaylist;
  const currentTrack = (currentPlaylist && currentPlaylist.tracks && currentPlaylist.tracks[trackIndex]) || (currentPlaylist && currentPlaylist.tracks && currentPlaylist.tracks[0]) || fallbackTrack;

  // Lock Screen & Background Audio Bridge: Seamless background & screen-lock playback via backend audio stream engine
  useEffect(() => {
    if (!currentTrack || currentTrack.id === "placeholder") return;

    const streamUrl = currentTrack.audioUrl
      ? currentTrack.audioUrl
      : (currentTrack.videoId ? `/api/audio-stream?v=${currentTrack.videoId}` : "");

    if (!streamUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
      audioRef.current.crossOrigin = "anonymous";
    }

    const audio = audioRef.current;
    const fullUrl = streamUrl.startsWith("http") ? streamUrl : window.location.origin + streamUrl;

    if (audio.src !== fullUrl) {
      audio.src = fullUrl;
    }

    const handleVisibilityOrLock = () => {
      if (document.visibilityState === "hidden" && isPlaying && audio) {
        let syncTime = currentTime > 0 ? currentTime : (savedSeekPositionRef.current || 0);
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          try {
            const ytTime = playerRef.current.getCurrentTime();
            if (isFinite(ytTime) && ytTime > 0) {
              syncTime = ytTime;
            }
          } catch {}
        }

        if (audio.paused || Math.abs(audio.currentTime - syncTime) > 2) {
          try {
            audio.currentTime = Math.max(0, syncTime);
            audio.volume = 1;
            audio.play().catch(() => {});
          } catch {}
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrLock);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrLock);
    };
  }, [currentTrack, isPlaying, currentTime]);

  // Save exact playback state (track & seek time) to localStorage on time update (throttled to 3s to prevent UI lag)
  useEffect(() => {
    if (typeof window !== "undefined" && isHydrated && currentTrack && currentTrack.id !== "placeholder" && currentTime > 0) {
      savedSeekPositionRef.current = currentTime;
      const now = Date.now();
      if (now - lastSaveTimeRef.current > 3000) {
        lastSaveTimeRef.current = now;
        try {
          localStorage.setItem("phoenix_saved_playback_state", JSON.stringify({
            currentPlaylistId,
            trackIndex,
            currentTime,
            currentTrack,
          }));
        } catch {}
      }
    }
  }, [currentTime, currentPlaylistId, trackIndex, currentTrack, isHydrated]);

  // Restore exact track & seek position on client load/refresh
  useEffect(() => {
    if (typeof window !== "undefined" && isHydrated) {
      try {
        const saved = localStorage.getItem("phoenix_saved_playback_state");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.currentTrack && parsed.currentTrack.id !== "placeholder") {
            const restoredPlId = parsed.currentPlaylistId || "trending-indian";
            const restoredTrack: Track = parsed.currentTrack;

            setPlaylists(prev => {
              const existing = prev.find(p => p.id === restoredPlId);
              if (existing) {
                if (!existing.tracks.some(t => t.id === restoredTrack.id)) {
                  return prev.map(p => p.id === restoredPlId ? { ...p, tracks: [restoredTrack, ...p.tracks] } : p);
                }
                return prev;
              }
              const restoredPl: Playlist = {
                id: restoredPlId,
                name: "Recently Played",
                description: "Restored playback session",
                accentColor: "#1DB954",
                tracks: [restoredTrack],
              };
              return [...prev, restoredPl];
            });

            setCurrentPlaylistId(restoredPlId);

            let targetIdx = parsed.trackIndex || 0;
            const targetPl = PLAYLISTS.find(p => p.id === restoredPlId);
            if (targetPl && targetPl.tracks.length > 0) {
              const foundIdx = targetPl.tracks.findIndex(t => t.id === restoredTrack.id);
              if (foundIdx !== -1) targetIdx = foundIdx;
            }
            setTrackIndex(targetIdx);

            if (parsed.currentTime !== undefined && parsed.currentTime >= 0) {
              savedSeekPositionRef.current = parsed.currentTime;
              initialSeekTimeRef.current = parsed.currentTime;
              setCurrentTime(parsed.currentTime);
              setIsPlaying(false);
              userPausedRef.current = true;
              playlistStatesRef.current[restoredPlId] = {
                trackIndex: targetIdx,
                currentTime: parsed.currentTime,
              };
            }
          }
        }
      } catch {}
    }
  }, [isHydrated]);

  // Guarantee useYtFallback is enabled for any track without direct audioUrl (e.g. search results)
  useEffect(() => {
    if (currentTrack && !currentTrack.audioUrl && !useYtFallback) {
      setUseYtFallback(true);
    }
  }, [currentTrack?.id, currentTrack?.audioUrl, useYtFallback]);

  // Sync duration with current track metadata
  useEffect(() => {
    if (currentTrack?.duration) {
      setDuration(currentTrack.duration);
    }
  }, [currentTrack?.id, currentTrack?.duration]);


  // Resolve videoId dynamically for search tracks that don't have videoId or audioUrl
  useEffect(() => {
    if (!currentTrack || currentTrack.id === "placeholder" || currentTrack.audioUrl || currentTrack.videoId) return;

    fetch(`/api/youtube-search?q=${encodeURIComponent(currentTrack.title + " " + currentTrack.artist)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.videoId) {
          currentTrack.videoId = data.videoId;
          setPlaylists(prev => prev.map(p => {
            if (p.id === currentPlaylistId) {
              return {
                ...p,
                tracks: p.tracks.map(t => t.id === currentTrack.id ? { ...t, videoId: data.videoId } : t)
              };
            }
            return p;
          }));
          if (playerRef.current && isPlaying) {
            playerRef.current.loadVideoById(data.videoId);
            playerRef.current.playVideo();
          }
        } else {
          fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(currentTrack.title + " " + currentTrack.artist)}&filter=music_songs`)
            .then((res) => res.json())
            .then((pipedData) => {
              if (pipedData && pipedData.items && pipedData.items[0]) {
                const vid = pipedData.items[0].url.split("v=")[1];
                currentTrack.videoId = vid;
                setPlaylists(prev => prev.map(p => {
                  if (p.id === currentPlaylistId) {
                    return {
                      ...p,
                      tracks: p.tracks.map(t => t.id === currentTrack.id ? { ...t, videoId: vid } : t)
                    };
                  }
                  return p;
                }));
                if (playerRef.current && isPlaying) {
                  playerRef.current.loadVideoById(vid);
                  playerRef.current.playVideo();
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [currentTrack?.id, isPlaying]);

  // Fetch & Parse Live Synced Lyrics (LRC timestamps, LRCLIB API, local cache & smooth fallback)
  useEffect(() => {
    if (!currentTrack || currentTrack.id === "placeholder") return;

    const cleanTitle = currentTrack.title.replace(/\[.*?\]|\(.*?\)/g, "").trim();
    const cleanArtist = currentTrack.artist.replace(/Unknown/i, "").split(",")[0].split("&")[0].trim();
    const d = currentTrack.duration || 180;

    const generateDefaultLyrics = () => {
      const step = Math.max(5, Math.floor(d / 8));
      return [
        { time: 0, text: `♪ ${cleanTitle}` },
        { time: Math.min(5, step), text: `♪ ${cleanTitle} • ${cleanArtist}` },
        { time: step * 2, text: `♪ ${currentTrack.film ? currentTrack.film : "Echoa Music Melodies"}` },
        { time: step * 3, text: `♪ ${cleanTitle}` },
        { time: step * 4, text: `♪ Artist: ${cleanArtist}` },
        { time: step * 5, text: `♪ ${cleanTitle} — ${cleanArtist}` },
        { time: step * 6, text: `♪ ${currentTrack.film ? `Film: ${currentTrack.film}` : "Echoa Premium Audio"}` },
        { time: step * 7, text: `♪ ${cleanTitle} • End of Track` }
      ];
    };

    // 1. Load cached synced lyrics instantly (0ms delay)
    const cacheKey = `phoenix_lyrics_${currentTrack.id}`;
    let hasCache = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        if (Array.isArray(parsedCache) && parsedCache.length > 0) {
          setLyrics(parsedCache);
          hasCache = true;
        }
      }
    } catch {}

    // 2. Set default structured lyrics immediately if no cache exists
    if (!hasCache) {
      setLyrics(generateDefaultLyrics());
    }

    // 3. Fetch online LRCLIB lyrics in background
    const searchUrl = cleanArtist
      ? `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`
      : `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`;

    fetch(searchUrl)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const match = data.find((item: any) => item.syncedLyrics) || data[0];
          if (match && match.syncedLyrics) {
            const lines = match.syncedLyrics.split("\n");
            const parsed: { time: number; text: string }[] = [];

            lines.forEach((line: string) => {
              // Match all timestamp formats: [mm:ss.xx], [mm:ss:xx], [mm:ss]
              const matches = Array.from(line.matchAll(/\[(\d+):(\d+)(?:[\.:](\d+))?\]/g));
              const lyricText = line.replace(/\[\d+:\d+(?:[\.:]\d+)?\]/g, "").trim();

              if (matches.length > 0 && lyricText) {
                matches.forEach((m) => {
                  const mins = parseInt(m[1], 10);
                  const secs = parseInt(m[2], 10);
                  const ms = m[3] ? parseFloat(`0.${m[3]}`) : 0;
                  parsed.push({ time: mins * 60 + secs + ms, text: lyricText });
                });
              }
            });

            parsed.sort((a, b) => a.time - b.time);

            if (parsed.length > 0) {
              setLyrics(parsed);
              try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch {}
            }
          } else if (match && match.plainLyrics) {
            const lines = match.plainLyrics.split("\n").filter((l: string) => l.trim().length > 0);
            const step = (currentTrack.duration || 180) / Math.max(lines.length, 1);
            const parsed = lines.map((text: string, idx: number) => ({
              time: idx * step,
              text: text.trim()
            }));
            setLyrics(parsed);
            try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch {}
          }
        }
      })
      .catch(() => {});
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist]);

  const currentLyric = lyrics.find((line, i) => {
    const nextLine = lyrics[i + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  // Auto-scroll full lyrics container to keep active lyric centered
  useEffect(() => {
    if (!showFullLyrics || !fullLyricsContainerRef.current) return;
    const activeElem = fullLyricsContainerRef.current.querySelector(".active-lyric-line");
    if (activeElem) {
      activeElem.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentLyric?.text, showFullLyrics]);


  // Persist active playlist ID
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("phoenix_active_playlist_id", currentPlaylistId);
    }
  }, [currentPlaylistId]);

  // Flush exact playback position to localStorage on browser refresh / page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeTime = !useYtFallbackRef.current && audioRef.current ? audioRef.current.currentTime : currentTime;
      if (isFinite(activeTime) && activeTime > 0) {
        playlistStatesRef.current[currentPlaylistId] = {
          trackIndex,
          currentTime: activeTime,
        };
        try {
          localStorage.setItem("phoenix_playlist_states", JSON.stringify(playlistStatesRef.current));
          localStorage.setItem("phoenix_active_playlist_id", currentPlaylistId);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentPlaylistId, trackIndex, currentTime]);

  const fadeOutAndSwitch = useCallback((callback: () => void) => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    if (!isPlaying) {
      callback();
      return;
    }
    let currentVol = 100;
    fadeIntervalRef.current = setInterval(() => {
      currentVol -= 10;
      if (currentVol <= 0) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        callback();
      } else {
        if (useYtFallbackRef.current && playerRef.current) {
          try { playerRef.current.setVolume(currentVol); } catch {}
        } else if (audioRef.current) {
          audioRef.current.volume = Math.max(0, currentVol / 100);
        }
      }
    }, 100);
  }, [isPlaying]);

  const handleSelectTrack = useCallback((idx: number) => {
    const targetTrack = currentPlaylist.tracks[idx];
    if (!targetTrack) return;

    setHasStartedSession(true);

    const norm = normalizeTitle(targetTrack.title);
    playedTrackIdsRef.current.add(targetTrack.id);
    if (norm) playedTrackIdsRef.current.add(norm);

    userPausedRef.current = false;
    playlistStatesRef.current[currentPlaylistId] = {
      trackIndex: idx,
      currentTime: 0,
    };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("phoenix_playlist_states", JSON.stringify(playlistStatesRef.current));
      } catch {
        // ignore
      }
    }

    // ALWAYS START CHANGED SONG AT EXACTLY 0:00 SECONDS
    setTrackIndex(idx);
    setCurrentTime(0);
    initialSeekTimeRef.current = 0;
    savedSeekPositionRef.current = 0;
    
    if (audioRef.current) {
      try { audioRef.current.currentTime = 0; } catch {}
    }
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      try { playerRef.current.seekTo(0, true); } catch {}
    }

    setIsPlaying(true);

        const playVideo = (vid: string, isSpotifyTarget?: boolean, spotifyRealId?: string, targetAudioUrl?: string) => {
      if (targetAudioUrl) {
        if (playerRef.current) {
          try { playerRef.current.pauseVideo(); } catch {}
        }
        if (audioRef.current) {
          audioRef.current.src = targetAudioUrl;
          audioRef.current.currentTime = 0;
          audioRef.current.volume = 1;
          audioRef.current.play().catch(e => console.error("Audio play error", e));
        }
        return;
      }
      // NATIVE SPOTIFY PREMIUM PLAYBACK
      if (isSpotifyTarget && spotifyRealId && isSpotifyPremium && spotifyDeviceId) {
         const token = getCookie("spotify_access_token");
         fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [`spotify:track:${spotifyRealId}`] }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
         }).then(() => {
            // Stop YouTube if it was playing
            if (playerRef.current) {
               try { playerRef.current.pauseVideo(); } catch {}
            }
            if (audioRef.current) {
               audioRef.current.pause();
            }
         }).catch(e => {
            console.error("Native playback failed, falling back", e);
            // Fallback logic could go here
         });
         return;
      }

      // YOUTUBE OR HTML5 FALLBACK
      if (useYtFallbackRef.current && playerRef.current) {
        try {
          lastLoadedYtVideoId.current = vid;
          playerRef.current.unMute();
          playerRef.current.setVolume(0); // Start at 0 for fade in
          playerRef.current.loadVideoById({
            videoId: vid,
            startSeconds: 0,
          });
          playerRef.current.playVideo();
          // Fade In
          let vol = 0;
          const fi = setInterval(() => {
             vol += 10;
             if(vol >= 100) { clearInterval(fi); vol=100; }
             try { playerRef.current?.setVolume(vol); } catch {}
          }, 100);
        } catch {
          // ignore
        }
      } else if (audioRef.current) {
        audioRef.current.src = `/audio/${vid}.webm`;
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 0;
        audioRef.current.play().then(() => {
           let vol = 0;
           const fi = setInterval(() => {
             vol += 0.1;
             if(vol >= 1) { clearInterval(fi); vol=1; }
             if(audioRef.current) audioRef.current.volume = vol;
           }, 100);
        }).catch(() => {
          setUseYtFallback(true);
        });
      }
    };

    if (targetTrack.audioUrl) {
      playVideo("", false, "", targetTrack.audioUrl);
      return;
    }

    if ((currentPlaylistId.startsWith("spotify-") || currentPlaylistId.includes("search")) && !targetTrack.videoId) {
      // Resolve Spotify track query dynamically to YouTube video ID on play
      fetch(`/api/youtube-search?q=${encodeURIComponent(targetTrack.title + " " + targetTrack.artist)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.videoId) {
            targetTrack.videoId = data.videoId;
            setPlaylists(prev => prev.map(p => {
              if (p.id === currentPlaylistId) {
                return {
                  ...p,
                  tracks: p.tracks.map(t => t.id === targetTrack.id ? { ...t, videoId: data.videoId } : t)
                };
              }
              return p;
            }));
            playVideo(data.videoId, true, targetTrack.id.replace('spotify-', '').replace('search-', ''));
          } else {
            // Client-side Piped API fallback for searched songs
            fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(targetTrack.title + " " + targetTrack.artist)}&filter=music_songs`)
              .then((res) => res.json())
              .then((pipedData) => {
                if (pipedData && pipedData.items && pipedData.items[0]) {
                  const vid = pipedData.items[0].url.split("v=")[1];
                  targetTrack.videoId = vid;
                  setPlaylists(prev => prev.map(p => {
                    if (p.id === currentPlaylistId) {
                      return {
                        ...p,
                        tracks: p.tracks.map(t => t.id === targetTrack.id ? { ...t, videoId: vid } : t)
                      };
                    }
                    return p;
                  }));
                  playVideo(vid, false, "");
                }
              })
              .catch((e) => console.error("Fallback search failed:", e));
          }
        })
        .catch((err) => {
          console.error("Error resolving Spotify track:", err);
        });
    } else {
      playVideo(targetTrack.videoId, targetTrack.id.startsWith('spotify-'), targetTrack.id.replace('spotify-', '').replace('search-', ''));
    }
  }, [currentPlaylist.tracks, currentPlaylistId]);

  const handleNextTrack = useCallback(() => {
    if (repeatMode === 2) {
      fadeOutAndSwitch(() => handleSelectTrack(trackIndex));
      return;
    }

    let nextIdx = trackIndex + 1;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * currentPlaylist.tracks.length);
      fadeOutAndSwitch(() => handleSelectTrack(nextIdx));
      return;
    }

    if (nextIdx >= currentPlaylist.tracks.length) {
      // NEVER wrap back to song 0 (first searched song)! Always fetch and queue a brand new song of matching vibe & era!
      autoPlayNextSimilarTrack(currentTrack);
      return;
    }

    fadeOutAndSwitch(() => handleSelectTrack(nextIdx));
  }, [currentPlaylist.tracks.length, handleSelectTrack, trackIndex, repeatMode, isShuffle, fadeOutAndSwitch, currentTrack]);

  const handlePrevTrack = useCallback(() => {
    if (currentTime > 3) {
      // Restart current track if we are more than 3 seconds in
      fadeOutAndSwitch(() => handleSelectTrack(trackIndex));
      return;
    }
    let prevIdx = trackIndex - 1;
    if (isShuffle) {
      prevIdx = Math.floor(Math.random() * currentPlaylist.tracks.length);
    } else if (prevIdx < 0) {
      prevIdx = currentPlaylist.tracks.length - 1;
    }
    fadeOutAndSwitch(() => handleSelectTrack(prevIdx));
  }, [currentPlaylist.tracks.length, handleSelectTrack, trackIndex, isShuffle, fadeOutAndSwitch, currentTime]);

  const handleNextTrackRef = useRef(handleNextTrack);
  useEffect(() => {
    handleNextTrackRef.current = handleNextTrack;
  }, [handleNextTrack]);

  // Setup single YouTube player instance safely as fallback
  useEffect(() => {
    if (!isHydrated) return;
    let isCancelled = false;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (isCancelled || !window.YT || !window.YT.Player) return;

      const wrapper = iframeWrapperRef.current;
      if (!wrapper) return;

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore cleanup
        }
        playerRef.current = null;
      }

      wrapper.innerHTML = "";
      const targetElem = document.createElement("div");
      targetElem.id = "yt-player-inner-div";
      wrapper.appendChild(targetElem);

      const startSec = Math.floor(initialSeekTimeRef.current || 0);

      const playerOptions: any = {
        playerVars: {
          autoplay: useYtFallbackRef.current ? 1 : 0,
          mute: 1, // Always start muted — browsers block unmuted autoplay; we unmute after user interaction
          enablejsapi: 1,
          playsinline: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "",
          start: startSec > 0 ? startSec : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
        },
        events: {
          onReady: (event: any) => {
            if (isCancelled) return;
            const dur = event.target.getDuration();
            if (dur && isFinite(dur) && dur > 0 && dur < 86400) {
              setDuration(dur);
            }
            const seekSec = savedSeekPositionRef.current || initialSeekTimeRef.current;
            if (seekSec > 0) {
              event.target.seekTo(seekSec, true);
              setCurrentTime(seekSec);
            }
            lastLoadedYtVideoId.current = currentTrack.videoId;

            try {
              event.target.unMute();
              event.target.setVolume(100);
              event.target.pauseVideo();
            } catch {}
          },
          onStateChange: (event: any) => {
            if (isCancelled) return;
            // Ignore YouTube player state events if HTML5 audio is the active player
            if (!useYtFallbackRef.current) return;

            if (event.data === window.YT?.PlayerState.PLAYING) {
              userPausedRef.current = false;
              setIsPlaying(true);
              try {
                event.target.unMute();
                event.target.setVolume(100);
              } catch {
                // ignore
              }
            } else if (event.data === window.YT?.PlayerState.PAUSED) {
              if (userPausedRef.current) {
                setIsPlaying(false);
              } else {
                // If paused due to buffering or transition, resume video playback
                try {
                  event.target.unMute();
                  event.target.playVideo();
                } catch {
                  // ignore
                }
              }
            } else if (event.data === window.YT?.PlayerState.CUED) {
              if (!userPausedRef.current) {
                try {
                  event.target.unMute();
                  event.target.setVolume(100);
                  event.target.playVideo();
                } catch {
                  // ignore
                }
              }
            } else if (event.data === window.YT?.PlayerState.ENDED) {
              userPausedRef.current = false;
              setIsPlaying(true);
              if (handleNextTrackRef.current) {
                handleNextTrackRef.current();
              }
            }
          },
          onError: (event: any) => {
            if (isCancelled || !useYtFallbackRef.current) return;
            console.warn("YouTube player error:", event.data);
            // Re-resolve alternative video stream for the current track instead of auto-skipping songs
            fetch(`/api/youtube-search?q=${encodeURIComponent(currentTrack.title + " " + currentTrack.artist + " audio")}`)
              .then(res => res.json())
              .then(data => {
                if (data.videoId && data.videoId !== currentTrack.videoId && playerRef.current) {
                  currentTrack.videoId = data.videoId;
                  setPlaylists(prev => prev.map(p => {
                    if (p.id === currentPlaylistId) {
                      return {
                        ...p,
                        tracks: p.tracks.map(t => t.id === currentTrack.id ? { ...t, videoId: data.videoId } : t)
                      };
                    }
                    return p;
                  }));
                  lastLoadedYtVideoId.current = data.videoId;
                  try {
                    playerRef.current.loadVideoById(data.videoId);
                    playerRef.current.playVideo();
                  } catch {}
                }
              })
              .catch(() => {});
          },
        },
      };

      if (currentTrack.videoId) {
        playerOptions.videoId = currentTrack.videoId;
      }

      playerRef.current = new window.YT.Player(targetElem, playerOptions);
    };

    initPlayer();

    return () => {
      isCancelled = true;
    };
  }, [isHydrated]);


  // Smart Auto-Play Recommendation Engine (Strict Vibe Continuity & Title Deduplication)
  const autoPlayNextSimilarTrack = useCallback(async (currentTr: Track) => {
    if (!currentTr) return;

    const title = currentTr.title.toLowerCase();
    const artist = currentTr.artist.toLowerCase();
    const mainArtist = currentTr.artist.split("&")[0].split(",")[0].trim();

    // 1. Detect Vibe & Mood Cluster (e.g. Hindi Romantic, Punjabi Modern, 90s Ghazal, English Pop)
    let vibeCategory = "Hindi Romantic";
    let moodSearch = `${mainArtist} bollywood romantic songs`;
    let countryParam = "in";

    const isPunjabi = /sidhu|shubh|aujla|diljit|dhillon|cheema|jordan|sandhu|gur|punjabi|bhangra|pind|love|jackpot|tutor/i.test(artist + " " + title);
    const isSouth = /ar rahman|anirudh|sriram|dsp|thaman|spb|tamil|telugu|kannada|malayalam/i.test(artist + " " + title);
    const isGhazal = /deewana|isharon|neele|phirkiwali|rafi|lata|mehdi|ghulam|kashmir|hamraaz|paap/i.test(artist + " " + title);
    const isEnglish = /[a-z]/i.test(artist) && !/arijit|singh|shreya|mohd|irfan|kailash|kher|rahat|badshah|king|darshan|himesh|anuv|b praak|sonu|jubin|nautiyal/i.test(artist);

    if (isPunjabi) {
      vibeCategory = "Punjabi Modern";
      moodSearch = `${mainArtist} punjabi latest hits`;
    } else if (isGhazal) {
      vibeCategory = "90s Bollywood Ghazal";
      moodSearch = `${mainArtist} classic ghazal songs`;
    } else if (isSouth) {
      vibeCategory = "South Hits";
      moodSearch = `${mainArtist} top South hits`;
    } else if (isEnglish) {
      vibeCategory = "English Pop";
      moodSearch = `${mainArtist} popular songs`;
      countryParam = "us";
    } else {
      // Hindi / Bollywood
      if (/party|club|remix|nach|bhangra|dhol|masti/i.test(title)) {
        vibeCategory = "Bollywood Party Dance";
        moodSearch = `${mainArtist} bollywood dance party hits`;
      } else {
        vibeCategory = "Hindi Romantic";
        moodSearch = `${mainArtist} hindi romantic hits`;
      }
    }

    try {
      // Try backend recommendations API first with strict deduplication
      const excludedTitlesStr = Array.from(playedTrackIdsRef.current).join("|");
      const backendRes = await fetch(`/api/user-recommendations?vibe=${encodeURIComponent(vibeCategory)}&artist=${encodeURIComponent(mainArtist)}&exclude=${encodeURIComponent(excludedTitlesStr)}`);

      let candidateList: Track[] = [];

      if (backendRes.ok) {
        const backendData = await backendRes.json();
        if (backendData && Array.isArray(backendData.recommendations)) {
          candidateList = backendData.recommendations;
        }
      }

      // Fallback query if backend returns few tracks
      if (candidateList.length === 0) {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(moodSearch)}&entity=song&country=${countryParam}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          candidateList = data.results.map((item: any) => ({
            id: `autoplay-${item.trackId}`,
            title: item.trackName,
            artist: item.artistName,
            film: item.collectionName || "",
            year: parseInt(item.releaseDate?.split("-")[0]) || 2024,
            duration: Math.floor(item.trackTimeMillis / 1000) || 180,
            videoId: "",
          }));
        }
      }

      // STRICT DEDUPLICATION FILTER: Remove any track with an already played/queued title
      const validCandidates = candidateList.filter((t: Track) => {
        const norm = normalizeTitle(t.title);
        const currNorm = normalizeTitle(currentTr.title);
        if (!norm || norm === currNorm) return false;
        if (playedTrackIdsRef.current.has(t.id) || playedTrackIdsRef.current.has(norm)) return false;

        // Check if title already exists in current playlist
        const currentPl = playlists.find(p => p.id === currentPlaylistId);
        if (currentPl && currentPl.tracks.some(existing => normalizeTitle(existing.title) === norm)) {
          return false;
        }

        return true;
      });

      if (validCandidates.length > 0) {
        const nextTrack = validCandidates[Math.floor(Math.random() * Math.min(validCandidates.length, 5))];
        const nextNorm = normalizeTitle(nextTrack.title);

        // Record title & ID in played deduplication set
        playedTrackIdsRef.current.add(nextTrack.id);
        if (nextNorm) playedTrackIdsRef.current.add(nextNorm);

        setPlaylistToastMsg(`📻 Next ${vibeCategory}: ${nextTrack.title} • ${nextTrack.artist}`);
        setTimeout(() => setPlaylistToastMsg(null), 4000);

        setPlaylists(prev => {
          const exists = prev.some(p => p.id === currentPlaylistId);
          if (!exists) {
            const fallbackPl: Playlist = {
              id: currentPlaylistId,
              name: "Recently Played",
              description: "Playback session",
              accentColor: "#1DB954",
              tracks: [currentTr, nextTrack],
            };
            return [...prev, fallbackPl];
          }
          return prev.map(p => {
            if (p.id === currentPlaylistId) {
              return { ...p, tracks: [...p.tracks, nextTrack] };
            }
            return p;
          });
        });

        setTimeout(() => {
          setPlaylists(latestPlaylists => {
            const pl = latestPlaylists.find(p => p.id === currentPlaylistId);
            if (pl && pl.tracks && pl.tracks.length > 0) {
              const targetIndex = pl.tracks.length - 1;
              userPausedRef.current = false;
              setTrackIndex(targetIndex);
              setCurrentTime(0);
              savedSeekPositionRef.current = 0;
              initialSeekTimeRef.current = 0;
              setIsPlaying(true);
            }
            return latestPlaylists;
          });
        }, 150);
        return;
      }
    } catch (err) {
      console.error("AutoPlay vibe match error:", err);
    }

    // Fallback if no new tracks found
    handleSelectTrack(0);
  }, [currentPlaylistId, playlists, handleSelectTrack]);


  // Synchronize state when switching between HTML5 audio and YouTube fallback
  useEffect(() => {
    if (useYtFallback) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      if (playerRef.current) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          const activeTime = currentTime > 0 ? currentTime : initialSeekTimeRef.current;
          if (lastLoadedYtVideoId.current !== currentTrack.videoId) {
            if (activeTime > 0) {
              playerRef.current.loadVideoById({ videoId: currentTrack.videoId, startSeconds: Math.floor(activeTime) });
            } else {
              playerRef.current.loadVideoById(currentTrack.videoId);
            }
            lastLoadedYtVideoId.current = currentTrack.videoId;
          } else if (activeTime > 0) {
            playerRef.current.seekTo(activeTime, true);
          }
          if (isPlaying) {
            playerRef.current.playVideo();
          }
        } catch {
          // ignore
        }
      }
    } else {
      if (playerRef.current) {
        try {
          playerRef.current.mute();
          playerRef.current.pauseVideo();
        } catch {
          // ignore
        }
      }
    }
  }, [useYtFallback]);

  // Native HTML5 Audio Element handling (Ensures 100% Mobile Background & Lock Screen Playback)
  useEffect(() => {
    if (!currentTrack || currentTrack.id === "placeholder") return;

    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";

    if (useYtFallback) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    const streamUrl = currentTrack.audioUrl ? currentTrack.audioUrl : (currentTrack.videoId ? `/api/audio-stream?v=${currentTrack.videoId}` : "");
    if (!streamUrl) return;

    if (audio.src !== window.location.origin + streamUrl && audio.src !== streamUrl) {
      audio.src = streamUrl;
      const startAt = initialSeekTimeRef.current > 0 ? initialSeekTimeRef.current : 0;
      initialSeekTimeRef.current = 0;
      savedSeekPositionRef.current = startAt;
      audio.currentTime = startAt;
    }

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      // Resume from last left off position if available
      if (initialSeekTimeRef.current > 0 && isFinite(initialSeekTimeRef.current)) {
        const seekTo = Math.min(initialSeekTimeRef.current, (audio.duration || 86400) - 1);
        audio.currentTime = Math.max(0, seekTo);
        initialSeekTimeRef.current = 0;
      }
    };

    const handleTimeUpdate = () => {
      if (audio.currentTime && isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
        savedSeekPositionRef.current = audio.currentTime;
        playlistStatesRef.current[currentPlaylistId] = {
          trackIndex,
          currentTime: audio.currentTime,
        };
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("phoenix_playlist_states", JSON.stringify(playlistStatesRef.current));
          } catch {}
        }
      }
    };

    const handleEnded = () => {
      const dur = audio.duration || 0;
      const cur = audio.currentTime || 0;
      // Only auto-advance if the song actually played to its natural conclusion
      if (dur > 0 && cur >= Math.max(5, dur - 3)) {
        setIsPlaying(true);
        if (handleNextTrackRef.current) {
          handleNextTrackRef.current();
        }
      } else {
        // Stream load delay or error — switch to YouTube fallback without skipping the user's song!
        setUseYtFallback(true);
      }
    };

    const handleError = () => {
      setUseYtFallback(true);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [currentTrack?.id, currentTrack?.videoId, currentTrack?.audioUrl, isPlaying, useYtFallback]);

  // Handle Play / Pause sync (Primary HTML5 Audio for sound + Muted YT Iframe for vinyl animation)
  useEffect(() => {
    if (useYtFallback) {
      if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
        if (currentTrack.videoId && currentTrack.videoId.length >= 5 && lastLoadedYtVideoId.current !== currentTrack.videoId) {
          const seek = initialSeekTimeRef.current > 0 ? Math.floor(initialSeekTimeRef.current) : 0;
          initialSeekTimeRef.current = 0;
          savedSeekPositionRef.current = seek;
          if (seek > 0) {
            playerRef.current.loadVideoById({ videoId: currentTrack.videoId, startSeconds: seek });
          } else {
            playerRef.current.loadVideoById({ videoId: currentTrack.videoId, startSeconds: 0 });
          }
          lastLoadedYtVideoId.current = currentTrack.videoId;
        }
        if (isPlaying) {
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      }
    } else {
      // Primary HTML5 Audio Engine: Keeps playing in background & lock screen without browser throttling
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.volume = 1;
          audioRef.current.muted = false;
          audioRef.current.play().catch(() => {
            setUseYtFallback(true);
          });
        } else {
          audioRef.current.pause();
        }
      }

      // Muted YouTube Iframe sync for visual vinyl rotation only
      if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
        if (currentTrack.videoId && currentTrack.videoId.length >= 5 && lastLoadedYtVideoId.current !== currentTrack.videoId) {
          try {
            playerRef.current.mute();
            playerRef.current.loadVideoById({ videoId: currentTrack.videoId, startSeconds: Math.floor(currentTime || 0) });
            lastLoadedYtVideoId.current = currentTrack.videoId;
          } catch {}
        }
        if (isPlaying) {
          try {
            playerRef.current.mute();
            playerRef.current.playVideo();
          } catch {}
        } else {
          try {
            playerRef.current.pauseVideo();
          } catch {}
        }
      }
    }
  }, [isPlaying, useYtFallback, currentTrack.videoId]);

  // Polling fallback timer if using YouTube iframe
  useEffect(() => {
    if (useYtFallback) {
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          const t = playerRef.current.getCurrentTime();
          const d = playerRef.current.getDuration();
          if (t >= 0 && isFinite(t)) {
            setCurrentTime(t);
            savedSeekPositionRef.current = t;
            playlistStatesRef.current[currentPlaylistId] = {
              trackIndex,
              currentTime: t,
            };
            const now = Date.now();
            if (now - lastSaveTimeRef.current > 3000 && typeof window !== "undefined") {
              lastSaveTimeRef.current = now;
              try {
                localStorage.setItem("phoenix_playlist_states", JSON.stringify(playlistStatesRef.current));
              } catch {}
            }
          }
          if (d > 0 && isFinite(d) && d < 86400) setDuration(d);
        }
      }, 250);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [useYtFallback, currentPlaylistId, trackIndex]);

  // User interactions
  const handlePlayPause = useCallback(() => {
    if (audioRef.current) { if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play().catch(() => {}); } }
    if (spotifyPlayerRef.current) {
      spotifyPlayerRef.current.togglePlay().then(() => setIsPlaying((prev) => !prev)).catch(() => {});
      return;
    }
    if (!useYtFallbackRef.current && audioRef.current) {
      const isAudioPlaying = !audioRef.current.paused && audioRef.current.currentTime > 0;
      if (isAudioPlaying) {
        userPausedRef.current = true;
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        userPausedRef.current = false;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          setUseYtFallback(true);
        });
      }
    } else if (playerRef.current) {
      const state = typeof playerRef.current.getPlayerState === "function" ? playerRef.current.getPlayerState() : -1;
      const isActuallyPlaying = window.YT && state === window.YT.PlayerState.PLAYING;
      if (isActuallyPlaying) {
        userPausedRef.current = true;
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        userPausedRef.current = false;
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          playerRef.current.playVideo();
          setIsPlaying(true);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // Helper to persist playlist state snapshots to localStorage
  const savePlaylistStates = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("phoenix_playlist_states", JSON.stringify(playlistStatesRef.current));
      } catch {
        // ignore
      }
    }
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    playlistStatesRef.current[currentPlaylistId] = {
      trackIndex,
      currentTime: seconds,
    };
    savePlaylistStates();
    if (!useYtFallbackRef.current && audioRef.current) {
      audioRef.current.currentTime = seconds;
    } else if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seconds, true);
    }
  };

  const handleSkipBack10 = useCallback(() => {
    const activeTime = !useYtFallbackRef.current && audioRef.current ? audioRef.current.currentTime : currentTime;
    const newTime = Math.max(0, activeTime - 10);
    handleSeek(newTime);
  }, [currentTime]);

  const handleSkipForward10 = useCallback(() => {
    const activeTime = !useYtFallbackRef.current && audioRef.current ? audioRef.current.currentTime : currentTime;
    const newTime = Math.min(duration, activeTime + 10);
    handleSeek(newTime);
  }, [currentTime, duration]);

  // Smooth Scene Switcher: saves current position & resumes target scene exactly where left off
  const handleSwitchPlaylist = useCallback((newPlaylistId: string) => {
    if (newPlaylistId === "connect-spotify") {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        "/api/spotify-auth",
        "Spotify Login",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );
      return;
    }

    if (newPlaylistId === currentPlaylistId) return;

    // 1. Save position of outgoing scene
    const activeTime = !useYtFallbackRef.current && audioRef.current ? audioRef.current.currentTime : currentTime;
    playlistStatesRef.current[currentPlaylistId] = {
      trackIndex,
      currentTime: isFinite(activeTime) ? activeTime : 0,
    };
    savePlaylistStates();

    // 2. Fetch saved state of incoming scene
    const targetPlaylist = playlists.find((p) => p.id === newPlaylistId) || playlists[0];
    const savedState = playlistStatesRef.current[newPlaylistId] || { trackIndex: 0, currentTime: 0 };
    const targetTrack = targetPlaylist.tracks[savedState.trackIndex] || targetPlaylist.tracks[0];

    // 3. Set seek target for the new scene audio stream
    initialSeekTimeRef.current = savedState.currentTime;

    // 4. Update current scene state & seamlessly resume music
    userPausedRef.current = false;
    setCurrentPlaylistId(newPlaylistId);
    setTrackIndex(savedState.trackIndex);
    setCurrentTime(savedState.currentTime);
    setIsPlaying(true);

    if (useYtFallbackRef.current && playerRef.current && targetTrack) {
      try {
        lastLoadedYtVideoId.current = targetTrack.videoId;
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        const seek = Math.floor(savedState.currentTime || 0);

        const playSwitchedTrack = (vid: string, isSpotifyTarget?: boolean, spotifyRealId?: string) => {
          if (isSpotifyTarget && spotifyRealId && isSpotifyPremium && spotifyDeviceId) {
            const token = getCookie("spotify_access_token");
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
              method: 'PUT',
              body: JSON.stringify({ uris: [`spotify:track:${spotifyRealId}`], position_ms: seek * 1000 }),
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            }).then(() => {
              if (playerRef.current) {
                try { playerRef.current.pauseVideo(); } catch {}
              }
              if (audioRef.current) audioRef.current.pause();
            }).catch(e => console.error("Native playback failed", e));
            return;
          }

          if (seek > 0) {
            playerRef.current?.loadVideoById({ videoId: vid, startSeconds: seek });
          } else {
            playerRef.current?.loadVideoById(vid);
          }
          playerRef.current?.playVideo();
        };

        if (newPlaylistId === "spotify-top-tracks" && !targetTrack.videoId) {
          fetch(`/api/youtube-search?q=${encodeURIComponent(targetTrack.title + " " + targetTrack.artist)}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.videoId) {
                targetTrack.videoId = data.videoId;
                playSwitchedTrack(data.videoId, true, targetTrack.id.replace('spotify-', '').replace('search-', ''));
              }
            });
        } else {
          playSwitchedTrack(targetTrack.videoId, targetTrack.id.startsWith('spotify-'), targetTrack.id.replace('spotify-', '').replace('search-', ''));
        }
      } catch {
        // ignore
      }
    }
  }, [currentPlaylistId, trackIndex, currentTime, playlists]);

  // Continuous Silent Audio Thread to grant permanent background & lock screen audio execution to mobile browsers (iOS & Android)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!silentAudioRef.current) {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      audio.loop = true;
      audio.volume = 0; audio.muted = true;
      silentAudioRef.current = audio;
    }

    if (isPlaying) {
      silentAudioRef.current.play().catch(() => {});
    } else {
      silentAudioRef.current.pause();
    }
  }, [isPlaying]);

  // Mobile Background Audio Handoff Engine (Ensures 100% uninterrupted audio when screen locks or tab minimizes)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isPlaying && currentTrack && currentTrack.id !== "placeholder") {
        // App backgrounded or screen locked -> Activate native HTML5 audio stream handoff
        const audio = audioRef.current || new Audio();
        audioRef.current = audio;
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";

        const streamUrl = currentTrack.audioUrl ? currentTrack.audioUrl : (currentTrack.videoId ? `/api/audio-stream?v=${currentTrack.videoId}` : "");
        if (streamUrl && audio.src !== window.location.origin + streamUrl && audio.src !== streamUrl) {
          audio.src = streamUrl;
          if (currentTime > 0) audio.currentTime = currentTime;
        }

        audio.play().catch(() => {});

        // Mute YouTube iframe so only native HTML5 audio plays in background
        if (playerRef.current) {
          try {
            playerRef.current.mute();
          } catch {}
        }
      } else if (document.visibilityState === "visible" && isPlaying) {
        // App foregrounded -> Sync volume back
        if (playerRef.current) {
          try {
            playerRef.current.unMute();
            playerRef.current.setVolume(100);
          } catch {}
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPlaying, currentTrack, currentTime]);

  // Update Media Session API for mobile lockscreen integrations
  useEffect(() => {
    if (typeof window !== "undefined" && "mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.film || "Phoenix Play",
        artwork: [
          {
            src: currentTrack.videoId ? `https://img.youtube.com/vi/${currentTrack.videoId}/hqdefault.jpg` : "/bg/logo.png",
            sizes: "480x360",
            type: "image/jpeg",
          },
        ],
      });
    }
  }, [currentTrack]);

  // Media Session lockscreen action controls
  useEffect(() => {
    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("play", () => handlePlayPause());
        navigator.mediaSession.setActionHandler("pause", () => handlePlayPause());
        navigator.mediaSession.setActionHandler("previoustrack", () => handlePrevTrack());
        navigator.mediaSession.setActionHandler("nexttrack", () => handleNextTrack());
        navigator.mediaSession.setActionHandler("seekbackward", () => handleSkipBack10());
        navigator.mediaSession.setActionHandler("seekforward", () => handleSkipForward10());
      } catch (e) {
        // ignore errors for unsupported actions
      }
    }
  }, [handlePlayPause, handlePrevTrack, handleNextTrack, handleSkipBack10, handleSkipForward10]);

  // Global Keyboard Shortcuts (Space: Play/Pause, Left: -10s, Right: +10s, N: Next, P: Prev, A/B/C: Scenes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut keys if focus is inside an input, select, or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
        return;
      }

      // Ensure active focused buttons do not re-trigger native click on Space
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const keyLower = e.key.toLowerCase();

      if (e.code === "Space") {
        if (e) e.preventDefault();
        handlePlayPause();
      } else if ((keyLower === "r" || e.code === "KeyR") && !e.ctrlKey && !e.metaKey) {
        if (e) e.preventDefault();
        handleSeek(0);
        setIsPlaying(true);
        if (useYtFallbackRef.current && playerRef.current) {
          try {
            playerRef.current.unMute();
            playerRef.current.setVolume(100);
            playerRef.current.playVideo();
          } catch {
            // ignore
          }
        }
      } else if (e.code === "ArrowLeft") {
        if (e) e.preventDefault();
        handleSkipBack10();
      } else if (e.code === "ArrowRight") {
        if (e) e.preventDefault();
        handleSkipForward10();
      } else if (keyLower === "n" || e.code === "KeyN") {
        if (e) e.preventDefault();
        handleNextTrack();
      } else if (keyLower === "p" || e.code === "KeyP") {
        if (e) e.preventDefault();
        handlePrevTrack();
      } else if (keyLower === "a" || e.code === "KeyA") {
        if (e) e.preventDefault();
        handleSwitchPlaylist("trending-indian");
      } else if (keyLower === "b" || e.code === "KeyB") {
        if (e) e.preventDefault();
        handleSwitchPlaylist("bollywood-classics");
      } else if (keyLower === "c" || e.code === "KeyC") {
        if (e) e.preventDefault();
        handleSwitchPlaylist("punjabi-modern");
      } else if (keyLower === "o" || e.code === "KeyO") {
        if (e) e.preventDefault();
        setShowMusicList((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSkipBack10, handleSkipForward10, handleNextTrack, handlePrevTrack, handleSwitchPlaylist]);


  // Close Music List when clicking anywhere outside on the site
  useEffect(() => {
    if (!showMusicList) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (musicListRef.current && !musicListRef.current.contains(e.target as Node)) {
        setShowMusicList(false);
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener("click", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [showMusicList]);

  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const [burstTrigger, setBurstTrigger] = useState<{ x: number; y: number; id: number } | null>(null);



  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).blur();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    setFavorites((prev) => {
      const trackId = currentTrack.id;
      const willBeFav = !prev[trackId];
      const updated = { ...prev, [trackId]: willBeFav };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("phoenix_favorite_tracks", JSON.stringify(updated));
        } catch {
          // ignore
        }
      }

      // ONLY trigger particle celebration when ADDING to favorites!
      if (willBeFav) {
        setBurstTrigger({ x, y, id: Date.now() });
        setTimeout(() => {
          setBurstTrigger(null);
        }, 5000);
      } else {
        setBurstTrigger(null);
      }

      return updated;
    });
  }, [currentTrack.id]);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    recordUserInterest(searchQuery);
    setIsSearching(true);
    const token = getCookie("spotify_access_token");
    
    try {
      if (token) {
        // Search via Spotify API with Indian market prioritization
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&market=IN&limit=5`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.tracks?.items?.length > 0) {
            const item = data.tracks.items[0];
            const topTrack: Track = {
              id: `spotify-search-${item.id}`,
              title: item.name,
              artist: item.artists?.map((a: any) => a.name).join(", ") || "Unknown",
              film: item.album?.name || "",
              year: parseInt(item.album?.release_date?.split("-")[0]) || 2024,
              duration: Math.floor(item.duration_ms / 1000) || 180,
              videoId: "",
            };
            handlePlaySearchResult(topTrack);
            setIsSearching(false);
            return;
          }
        }
      }

      // Universal iTunes Search API prioritizing Indian songs (country=in)
      const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&country=in&limit=5`);
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results?.length > 0) {
          const item = itunesData.results[0];
          const topTrack: Track = {
            id: `itunes-search-${item.trackId}`,
            title: item.trackName,
            artist: item.artistName,
            film: item.collectionName || "",
            year: parseInt(item.releaseDate?.split("-")[0]) || 2024,
            duration: Math.floor(item.trackTimeMillis / 1000) || 180,
            videoId: "",
            audioUrl: item.previewUrl || undefined,
          };
          handlePlaySearchResult(topTrack);
        }
      }
    } catch (err) {
      console.error("Universal Search error:", err);
    }
    setIsSearching(false);
  }

  // Disable accidental page refresh hotkeys (F5, Ctrl+R, Cmd+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('.search-container')) {
        setSearchResults([]);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showFullLyrics) return;
    const handleClickOutsideLyrics = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('.full-lyrics-container') && !target.closest('.lyrics-toggle-btn')) {
        setShowFullLyrics(false);
      }
    };
    window.addEventListener('click', handleClickOutsideLyrics);
    return () => window.removeEventListener('click', handleClickOutsideLyrics);
  }, [showFullLyrics]);

  useEffect(() => {
    if (!showMusicList) return;
    const handleClickOutsideMusicList = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        !target.closest('.music-list-container') &&
        !target.closest('.music-list-toggle-btn')
      ) {
        setShowMusicList(false);
      }
    };
    window.addEventListener('click', handleClickOutsideMusicList);
    return () => window.removeEventListener('click', handleClickOutsideMusicList);
  }, [showMusicList]);

  // MediaSession API Integration for Mobile Lock Screen & Background Playback Controls
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.film || "Echoa Music",
        artwork: [
          { src: "/echoa-logo.png", sizes: "96x96", type: "image/png" },
          { src: "/echoa-logo.png", sizes: "128x128", type: "image/png" },
          { src: "/echoa-logo.png", sizes: "512x512", type: "image/png" },
        ],
      });
    }

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    if (duration > 0 && isFinite(currentTime) && isFinite(duration) && currentTime <= duration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: Math.max(0, Math.min(currentTime, duration)),
        });
      } catch {}
    }
  }, [currentTrack, isPlaying, currentTime, duration]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    const setHandler = (action: any, handler: any) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    };

    setHandler("play", () => handlePlayPause());
    setHandler("pause", () => handlePlayPause());
    setHandler("previoustrack", () => handlePrevTrack());
    setHandler("nexttrack", () => handleNextTrack());
    setHandler("seekbackward", () => handleSkipBack10());
    setHandler("seekforward", () => handleSkipForward10());
    setHandler("seekto", (details: any) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        handleSeek(details.seekTime);
      }
    });

    return () => {
      const actions = ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"];
      actions.forEach((act) => setHandler(act, null));
    };
  }, [handlePlayPause, handlePrevTrack, handleNextTrack, handleSkipBack10, handleSkipForward10, handleSeek]);

  const handlePlaySearchResult = (track: Track) => {
    setHasStartedSession(true);
    recordUserInterest(track);
    const tempPlaylistId = `search-play-${Date.now()}`;
    const searchPl: Playlist = {
      id: tempPlaylistId,
      name: "Search Result",
      description: "Your searched track",
      accentColor: "#1DB954",
      tracks: [track],
    };

    setPlaylists(prev => [...prev.filter(p => !p.id.startsWith("search-play-")), searchPl]);
    setSearchResults([]);
    setSearchQuery("");

    playlistStatesRef.current[tempPlaylistId] = { trackIndex: 0, currentTime: 0 };
    initialSeekTimeRef.current = 0;
    savedSeekPositionRef.current = 0;
    userPausedRef.current = false;
    setCurrentPlaylistId(tempPlaylistId);
    setTrackIndex(0);
    setCurrentTime(0);

    if (audioRef.current) {
      try { audioRef.current.currentTime = 0; } catch {}
    }
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      try { playerRef.current.seekTo(0, true); } catch {}
    }

    setIsPlaying(true);

    // Force single audio playback via YouTube streaming engine to prevent any double audio glitch
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch {}
    }

    setUseYtFallback(true);

    const playVideoId = (vid: string) => {
      track.videoId = vid;
      setPlaylists(prev => prev.map(p => {
        if (p.id === tempPlaylistId) {
          return {
            ...p,
            tracks: p.tracks.map(t => t.id === track.id ? { ...t, videoId: vid } : t)
          };
        }
        return p;
      }));
      lastLoadedYtVideoId.current = vid;
      if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          playerRef.current.loadVideoById({ videoId: vid, startSeconds: 0 });
          playerRef.current.playVideo();
        } catch {}
      }
    };

    if (track.videoId) {
      playVideoId(track.videoId);
    } else {
      fetch(`/api/youtube-search?q=${encodeURIComponent(track.title + " " + track.artist)}`)
        .then(res => res.json())
        .then(data => {
          if (data.videoId) {
            playVideoId(data.videoId);
          } else {
            fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(track.title + " " + track.artist)}&filter=music_songs`)
              .then(res => res.json())
              .then(pipedData => {
                if (pipedData && pipedData.items && pipedData.items[0]) {
                  const vid = pipedData.items[0].url.split("v=")[1];
                  if (vid) playVideoId(vid);
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  };

  return (
    <div className="w-full max-w-md mx-auto relative flex flex-col items-center gap-3">

      {/* Loving Heart Burst Particles (Appears for 5.5s on favorite click only) */}
      <ParticleCanvas burstTrigger={burstTrigger} />

      {/* Now Playing Active Header Banner (Single Horizontal Line) */}
      {currentTrack && currentTrack.id !== "placeholder" && (
        <div className="w-full bg-rose-500/15 border border-rose-500/30 rounded-2xl px-4 py-2 text-center backdrop-blur-xl shadow-lg animate-in fade-in slide-in-from-top-1 overflow-hidden whitespace-nowrap">
          <div className="flex items-center justify-center gap-2 whitespace-nowrap overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider shrink-0">🎵 NOW PLAYING:</span>
            <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
              {currentTrack.title} <span className="text-rose-300 font-semibold">• {currentTrack.artist} {currentTrack.film ? `(${currentTrack.film})` : ""}</span>
            </span>
          </div>
        </div>
      )}

      {/* Dedicated Search Bar (Upper Side, right under Time Clock Header) */}
      <div className="w-full relative search-container z-40">
        <form onSubmit={handleSearch} className="relative flex items-center">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any song on Echoa..." 
            className="w-full bg-black/40 border border-white/15 rounded-full py-2 pl-9 pr-8 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-emerald-500/50 shadow-md backdrop-blur-xl transition-all"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Native HTML5 Audio Element explicitly mounted in DOM for permanent Mobile & Desktop Background Audio */}
      <audio
        ref={audioRef}
        id="phoenix-bg-audio"
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Hidden single persistent YouTube iframe element wrapper (positioned in-viewport so browser never throttles audio) */}
      <div
        ref={iframeWrapperRef}
        className="fixed bottom-0 right-0 w-px h-px opacity-[0.001] pointer-events-none z-[-1]"
      />





      {/* Desktop Player */}
      <DesktopPlayer
        onAddCurrentToPlaylist={() => setTrackToAddToPlaylist(currentTrack)}
        showFullLyrics={showFullLyrics}
        onToggleFullLyrics={() => setShowFullLyrics(prev => !prev)}
        currentLyricText={currentLyric?.text}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        accentColor={currentPlaylist.accentColor}
        isFavorite={!!favorites[currentTrack.id]}
        onToggleFavorite={handleToggleFavorite}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
        onSkipBack10={handleSkipBack10}
        onSkipForward10={handleSkipForward10}
        onSeek={handleSeek}
        playlists={playlists}
        currentPlaylistId={currentPlaylistId}
        onSwitchPlaylist={handleSwitchPlaylist}
        showMusicList={showMusicList}
        onToggleMusicList={() => setShowMusicList((prev) => !prev)}
                spotifyLoggedIn={spotifyLoggedIn}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        isSearching={isSearching}
        searchResults={searchResults}
        onPlaySearchResult={handlePlaySearchResult}
        isLoadingPlaylist={isLoadingPlaylist}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(prev => !prev)}
        repeatMode={repeatMode}
        onToggleRepeat={() => setRepeatMode(prev => (prev + 1) % 3 as 0|1|2)}
        
      />

      {/* Mobile Player */}
      <MobilePlayer
        onAddCurrentToPlaylist={() => setTrackToAddToPlaylist(currentTrack)}
        showFullLyrics={showFullLyrics}
        onToggleFullLyrics={() => setShowFullLyrics(prev => !prev)}
        currentLyricText={currentLyric?.text}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        accentColor={currentPlaylist.accentColor}
        isFavorite={!!favorites[currentTrack.id]}
        onToggleFavorite={handleToggleFavorite}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
        onSkipBack10={handleSkipBack10}
        onSkipForward10={handleSkipForward10}
        onSeek={handleSeek}
        playlists={playlists}
        currentPlaylistId={currentPlaylistId}
        onSwitchPlaylist={handleSwitchPlaylist}
        showMusicList={showMusicList}
        onToggleMusicList={() => setShowMusicList((prev) => !prev)}
                spotifyLoggedIn={spotifyLoggedIn}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        isSearching={isSearching}
        searchResults={searchResults}
        onPlaySearchResult={handlePlaySearchResult}
        isLoadingPlaylist={isLoadingPlaylist}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(prev => !prev)}
        repeatMode={repeatMode}
        onToggleRepeat={() => setRepeatMode(prev => (prev + 1) % 3 as 0|1|2)}
      />

      {/* Playlist Toast Notification */}
      {playlistToastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600/90 text-white font-bold text-xs px-4 py-2 rounded-full shadow-2xl backdrop-blur-md z-[100] animate-in fade-in slide-in-from-top-3">
          ✓ {playlistToastMsg}
        </div>
      )}

      {/* Add Track To Playlist Modal */}
      {trackToAddToPlaylist && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[95] animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-white/20 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="text-emerald-400">➕</span> Add to Playlist
              </h3>
              <button
                onClick={() => setTrackToAddToPlaylist(null)}
                className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-white/70 mb-4 bg-white/5 p-2 rounded-xl border border-white/10">
              <p className="font-semibold text-white truncate">{trackToAddToPlaylist.title}</p>
              <p className="text-[11px] text-emerald-400 truncate">{trackToAddToPlaylist.artist}</p>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto mb-4">
              {playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => handleAddTrackToPlaylist(pl.id, trackToAddToPlaylist)}
                  className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-xs font-semibold flex items-center justify-between transition-all"
                >
                  <span className="truncate">{pl.name}</span>
                  <span className="text-[10px] text-white/50">{pl.tracks.length} Songs</span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10">
              <button
                onClick={() => setShowCreatePlaylistModal(true)}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>+ Create New Playlist</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Playlist Prompt Modal */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-white/20 rounded-3xl p-5 max-w-xs w-full shadow-2xl text-white">
            <h3 className="font-bold text-sm mb-1 text-emerald-400">Create New Playlist</h3>
            <p className="text-xs text-white/60 mb-3">Enter a name for your custom playlist:</p>
            <input
              type="text"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              placeholder="e.g. My Favorites, Party Beats..."
              className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreatePlaylistModal(false)}
                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateNewPlaylist(newPlaylistName, trackToAddToPlaylist || undefined)}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Music List Drawer Container (Expands directly UNDER the music bar) */}
      {showMusicList && (
        <div
          ref={musicListRef}
          className="music-list-container mt-3 w-full bg-neutral-900/90 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl z-50 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-semibold text-white tracking-wide">
                {currentPlaylist.name} • Songs ({currentPlaylist.tracks.length})
              </span>
            </div>
            <button
              onClick={() => setShowMusicList(false)}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Spotify-styled Aesthetic Playlists Manager */}
          <div className="mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-400" /> Playlists & Library
              </span>
              <button
                type="button"
                onClick={() => setShowCreatePlaylistModal(true)}
                className="text-[11px] bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-bold px-2.5 py-1 rounded-full border border-rose-500/30 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> + New Playlist
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {playlists.filter(pl => !pl.id.startsWith("search-play-")).map((pl) => {
                const isSelected = pl.id === currentPlaylistId;
                const isCustom = pl.id.startsWith("user-pl-");
                return (
                  <div
                    key={pl.id}
                    onClick={() => handleSwitchPlaylist(pl.id)}
                    className={`group relative flex items-center justify-between p-2 rounded-2xl border transition-all cursor-pointer select-none overflow-hidden ${
                      isSelected
                        ? "bg-rose-500/20 border-rose-500/50 text-white shadow-md"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        style={{ backgroundColor: pl.accentColor || "#f43f5e" }}
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform"
                      >
                        <Music className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate leading-tight">{pl.name}</p>
                        <p className="text-[10px] text-white/50 truncate font-mono">
                          {pl.tracks.length} Songs
                        </p>
                      </div>
                    </div>

                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(pl.id);
                        }}
                        className="opacity-70 hover:opacity-100 p-1.5 rounded-full hover:bg-rose-500/30 text-rose-400 transition-all shrink-0 cursor-pointer"
                        title="Delete Playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            {currentPlaylist.tracks.map((tr, idx) => {
              const isActive = idx === trackIndex;
              return (
                <button
                  key={tr.id}
                  onClick={() => handleSelectTrack(idx)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                    isActive
                      ? "bg-white/20 text-white font-medium shadow-sm"
                      : "hover:bg-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-bold font-mono w-5 text-center ${isActive ? "text-rose-400" : "text-white/80"}`}>
                      {isActive ? (
                        <Music className="w-3.5 h-3.5 animate-pulse text-rose-400 inline" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-xs truncate ${isActive ? "text-white font-semibold" : "text-white/90"}`}>
                        {tr.title}
                      </p>
                      <p className="text-[11px] text-white/50 truncate font-normal">
                        {tr.artist} {tr.film ? `• ${tr.film}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackToAddToPlaylist(tr);
                      }}
                      className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 text-emerald-300 font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer"
                      title="Add to Playlist"
                    >
                      + Add
                    </button>
                    <span className="text-[12px] font-bold font-mono text-white/80">
                      {formatTime(tr.duration)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Optional Spotify Connect banner inside the drawer */}
          {!spotifyLoggedIn && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/50 font-medium">Want to stream your own tracks?</span>
              </div>
              <button
                onClick={() => {
                  const width = 600;
                  const height = 700;
                  const left = window.screenX + (window.outerWidth - width) / 2;
                  const top = window.screenY + (window.outerHeight - height) / 2;
                  window.open(
                    "/api/spotify-auth",
                    "Echoa Login",
                    `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
                  );
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95 cursor-pointer shadow-md"
              >
                <img src="/echoa-logo.png" className="w-3.5 h-3.5 rounded-sm object-cover" alt="Echoa" />
                <span>Connect Spotify</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full Synced Lyrics Container (Expands directly UNDER the music bar) */}
      {showFullLyrics && (
        <div
          ref={fullLyricsContainerRef}
          className="full-lyrics-container mt-3 w-full bg-neutral-900/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-5 shadow-2xl z-[80] max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 sticky top-0 bg-neutral-900/95 backdrop-blur-xl z-10">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">🎤</span> Full Synced Lyrics
              </h3>
              <p className="text-xs text-emerald-400 font-medium truncate">
                {currentTrack.title} • {currentTrack.artist}
              </p>
            </div>
            <button
              onClick={() => setShowFullLyrics(false)}
              className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {lyrics.length > 0 ? (
            <div className="space-y-2 text-center py-2">
              {lyrics.map((line, idx) => {
                const isCurrent = currentLyric?.text === line.text;
                return (
                  <p
                    key={idx}
                    onClick={() => {
                      handleSeek(line.time);
                    }}
                    className={`text-xs sm:text-sm transition-all duration-300 cursor-pointer py-1.5 px-3 rounded-xl ${
                      isCurrent
                        ? "active-lyric-line text-emerald-300 font-bold text-base bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.4)] scale-105"
                        : "text-white/60 hover:text-white hover:bg-white/10 font-medium"
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-white/50 text-xs font-medium">
              No lyrics available for this track.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
