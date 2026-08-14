"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Disc, Layers, RotateCcw, RotateCw, Heart, ListMusic, X, Music } from "lucide-react";
import { PLAYLISTS, Track, Playlist } from "../data/playlists";
import { track as trackAnalytics } from "@vercel/analytics";

// Helper to format seconds to mm:ss safely with bounds checks
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds) || seconds > 86400) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
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
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-emerald-950 rounded-full scale-125 select-none">
            <svg className="w-8 h-8 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.982-.336.075-.668-.135-.744-.47-.076-.336.135-.668.47-.743 3.856-.88 7.15-.504 9.822 1.13.295.178.387.563.206.858zm1.225-2.72c-.227.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.082-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.673-1.114 8.243-.574 11.35 1.34.367.226.487.707.258 1.074zm.105-2.833C14.92 8.947 9.97 8.783 7.11 9.65c-.49.15-1.01-.13-1.16-.62-.15-.49.13-1.01.62-1.16 3.3-.998 8.75-.812 12.27 1.28.44.26.58.83.32 1.27-.26.44-.83.58-1.27.32z"/>
            </svg>
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
}: TransportProps) {
  const handleClick = (cb: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    cb();
  };

  if (isMobile) {
    return (
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleClick(onPrev)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/80 hover:text-white transition-colors active:scale-95 cursor-pointer"
          aria-label="Previous track"
          title="Previous Track (P)"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        {/* Skip 10s Back */}
        <button
          onClick={handleClick(onSkipBack10)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95 cursor-pointer relative"
          aria-label="Rewind 10 seconds"
          title="Rewind 10s (Left Arrow)"
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
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center ring-1 ring-white/25 active:scale-95 transition-transform cursor-pointer"
          aria-label={isPlaying ? "Pause" : "Play"}
          title="Play/Pause (Spacebar)"
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
          aria-label="Forward 10 seconds"
          title="Fast Forward 10s (Right Arrow)"
        >
          <RotateCw className="w-4 h-4" />
          <span className="absolute -bottom-1 text-[8.5px] font-mono font-bold text-white/60">10s</span>
        </button>

        <button
          onClick={handleClick(onNext)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/80 hover:text-white transition-colors active:scale-95 cursor-pointer"
          aria-label="Next track"
          title="Next Track (N)"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
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
    </div>
  );
});

// DESKTOP PLAYER COMPONENT
interface DesktopPlayerProps {
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
}

const DesktopPlayer = React.memo(function DesktopPlayer({
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
}: DesktopPlayerProps) {
  return (
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
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-white truncate tracking-tight">
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
              <p className="text-[12.5px] text-white/70 truncate font-normal">
                {currentTrack.artist} {currentTrack.film ? `• ${currentTrack.film}` : ""}
              </p>
            </div>
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
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id} className="bg-neutral-900 text-white">
                    {pl.name}
                  </option>
                ))}
                {!spotifyLoggedIn && (
                  <option value="connect-spotify" className="bg-neutral-900 text-[#1DB954] font-semibold">
                    🟢 Connect Spotify
                  </option>
                )}
              </select>
            </div>

            <button
              onClick={onToggleMusicList}
              className={`p-1.5 rounded-full border border-white/10 transition-all cursor-pointer ${
                showMusicList ? "bg-white/25 text-white shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "bg-white/10 hover:bg-white/15 text-white/80 hover:text-white"
              }`}
              title="Music List (Tracks)"
              aria-label="Toggle Music List"
            >
              <ListMusic className="w-3.5 h-3.5" />
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
        />
      </div>
    </div>
  );
});

// MOBILE PLAYER COMPONENT
interface MobilePlayerProps {
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
}

const MobilePlayer = React.memo(function MobilePlayer({
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
}: MobilePlayerProps) {
  return (
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
            <h2 className="text-[14px] font-semibold text-white truncate">
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
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id} className="bg-neutral-900 text-white">
                    {pl.name}
                  </option>
                ))}
                {!spotifyLoggedIn && (
                  <option value="connect-spotify" className="bg-neutral-900 text-[#1DB954] font-semibold">
                    🟢 Connect Spotify
                  </option>
                )}
              </select>
            </div>

            <button
              onClick={onToggleMusicList}
              className={`px-2 py-0.5 rounded-md border border-white/10 text-[10.5px] font-medium flex items-center gap-1 transition-all ${
                showMusicList ? "bg-white/25 text-white" : "bg-black/30 hover:bg-black/40 text-white/80"
              }`}
            >
              <ListMusic className="w-3 h-3" />
              <span>Music List</span>
            </button>
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
          />
        </div>

        {/* Spacer for symmetry */}
        <div className="w-4" />
      </div>
    </div>
  );
});

// MAIN PLAYER CLIENT CONTAINER
export default function Player({
  onSceneChange,
}: {
  onSceneChange?: (sceneClass: string) => void;
}) {
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string>("lofi-monsoon");
  const [trackIndex, setTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [showMusicList, setShowMusicList] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Spotify integration state
  const [playlists, setPlaylists] = useState<Playlist[]>(PLAYLISTS);
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState<boolean>(false);

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
  // In production, skip local audio and go straight to YouTube
  const [useYtFallback, setUseYtFallback] = useState<boolean>(IS_PRODUCTION);
  const useYtFallbackRef = useRef<boolean>(IS_PRODUCTION);

  useEffect(() => {
    useYtFallbackRef.current = useYtFallback;
  }, [useYtFallback]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadedYtVideoId = useRef<string | null>(null);
  const musicListRef = useRef<HTMLDivElement | null>(null);
  const iframeWrapperRef = useRef<HTMLDivElement | null>(null);

  // Per-playlist playback memory store (remembers last track & exact timestamp for Scene A, B, C)
  const playlistStatesRef = useRef<Record<string, { trackIndex: number; currentTime: number }>>({
    "lofi-monsoon": { trackIndex: 0, currentTime: 0 },
    "90s-nostalgia": { trackIndex: 0, currentTime: 0 },
    "punjabi-modern": { trackIndex: 0, currentTime: 0 },
  });

  const initialSeekTimeRef = useRef<number>(0);
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

        if (savedPlaylistId && (PLAYLISTS.some((p) => p.id === savedPlaylistId) || savedPlaylistId === "spotify-top-tracks")) {
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

  // Reusable Spotify Top Tracks loader
  const loadSpotifyTracks = useCallback((token: string) => {
    setSpotifyLoggedIn(true);
    fetch("https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=15", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          document.cookie = "spotify_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          setSpotifyLoggedIn(false);
          throw new Error("Spotify token expired");
        }
        if (!res.ok) throw new Error("Failed to fetch top tracks");
        return res.json();
      })
      .then((data) => {
        if (data.items && data.items.length > 0) {
          const spotifyTracks: Track[] = data.items.map((item: any) => ({
            id: `spotify-${item.id}`,
            title: item.name,
            artist: item.artists.map((a: any) => a.name).join(", "),
            film: item.album.name,
            year: parseInt(item.album.release_date?.split("-")[0]) || 2024,
            duration: Math.floor(item.duration_ms / 1000),
            videoId: "", // resolved dynamically on play
          }));

          const spotifyPlaylist: Playlist = {
            id: "spotify-top-tracks",
            name: "Spotify Top",
            description: "Your Top Spotify Tracks",
            sceneClass: "scene-c",
            accentColor: "#1DB954",
            tracks: spotifyTracks,
          };

          setPlaylists((prev) => {
            if (prev.some((p) => p.id === "spotify-top-tracks")) return prev;
            return [...prev, spotifyPlaylist];
          });

          if (!playlistStatesRef.current["spotify-top-tracks"]) {
            playlistStatesRef.current["spotify-top-tracks"] = { trackIndex: 0, currentTime: 0 };
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load Spotify top tracks:", err);
      });
  }, []);

  // Fetch Spotify tracks on load OR when postMessage login event fires
  useEffect(() => {
    const token = getCookie("spotify_access_token");
    if (token) {
      loadSpotifyTracks(token);
    }

    const handleSpotifyMessage = (event: MessageEvent) => {
      if (event.data === "spotify_login_success") {
        const newToken = getCookie("spotify_access_token");
        if (newToken) {
          loadSpotifyTracks(newToken);
          setCurrentPlaylistId("spotify-top-tracks");
          setTrackIndex(0);
          setCurrentTime(0);
        }
      }
    };

    window.addEventListener("message", handleSpotifyMessage);
    return () => window.removeEventListener("message", handleSpotifyMessage);
  }, [getCookie, loadSpotifyTracks]);

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

  const currentPlaylist = playlists.find((p) => p.id === currentPlaylistId) || playlists[0];
  const currentTrack = currentPlaylist.tracks[trackIndex] || currentPlaylist.tracks[0];

  // Sync duration with current track metadata
  useEffect(() => {
    if (currentTrack?.duration) {
      setDuration(currentTrack.duration);
    }
  }, [currentTrack.id, currentTrack.duration]);

  // Broadcast scene changes and persist active playlist ID
  useEffect(() => {
    if (onSceneChange) {
      onSceneChange(currentPlaylist.sceneClass);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("phoenix_active_playlist_id", currentPlaylistId);
    }
  }, [currentPlaylist, currentPlaylistId, onSceneChange]);

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

  const handleSelectTrack = useCallback((idx: number) => {
    const targetTrack = currentPlaylist.tracks[idx];
    if (!targetTrack) return;

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

    setTrackIndex(idx);
    setCurrentTime(0);
    initialSeekTimeRef.current = 0;
    setIsPlaying(true);

    const playVideo = (vid: string) => {
      if (useYtFallbackRef.current && playerRef.current) {
        try {
          lastLoadedYtVideoId.current = vid;
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          playerRef.current.loadVideoById({
            videoId: vid,
            startSeconds: 0,
          });
          playerRef.current.playVideo();
        } catch {
          // ignore
        }
      } else if (audioRef.current) {
        audioRef.current.src = `/audio/${vid}.webm`;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          setUseYtFallback(true);
        });
      }
    };

    if (currentPlaylistId === "spotify-top-tracks" && !targetTrack.videoId) {
      // Resolve Spotify track query dynamically to YouTube video ID on play
      fetch(`/api/youtube-search?q=${encodeURIComponent(targetTrack.title + " " + targetTrack.artist)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.videoId) {
            targetTrack.videoId = data.videoId;
            playVideo(data.videoId);
          } else {
            console.error("No YouTube video resolved for this Spotify track");
          }
        })
        .catch((err) => {
          console.error("Error resolving Spotify track:", err);
        });
    } else {
      playVideo(targetTrack.videoId);
    }
  }, [currentPlaylist.tracks, currentPlaylistId]);

  const handleNextTrack = useCallback(() => {
    const nextIdx = (trackIndex + 1) % currentPlaylist.tracks.length;
    handleSelectTrack(nextIdx);
  }, [currentPlaylist.tracks.length, handleSelectTrack, trackIndex]);

  const handlePrevTrack = useCallback(() => {
    const prevIdx = (trackIndex - 1 + currentPlaylist.tracks.length) % currentPlaylist.tracks.length;
    handleSelectTrack(prevIdx);
  }, [currentPlaylist.tracks.length, handleSelectTrack, trackIndex]);

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

      playerRef.current = new window.YT.Player(targetElem, {
        videoId: currentTrack.videoId,
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
          onReady: (event) => {
            if (isCancelled) return;
            const dur = event.target.getDuration();
            if (dur && isFinite(dur) && dur > 0 && dur < 86400) {
              setDuration(dur);
            }
            if (initialSeekTimeRef.current > 0) {
              event.target.seekTo(initialSeekTimeRef.current, true);
              initialSeekTimeRef.current = 0;
            }
            lastLoadedYtVideoId.current = currentTrack.videoId;

            // Setup player unmuted but do not play automatically on load
            if (useYtFallbackRef.current) {
              try {
                event.target.unMute();
                event.target.setVolume(100);
                event.target.pauseVideo();
              } catch { /* ignore */ }
            } else {
              try {
                event.target.mute();
                event.target.pauseVideo();
              } catch { /* ignore */ }
            }
          },
          onStateChange: (event) => {
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
          onError: (event) => {
            if (isCancelled || !useYtFallbackRef.current) return;
            try {
              trackAnalytics("youtube_video_error", {
                code: event.data,
                videoId: currentTrack.videoId,
                trackId: currentTrack.id,
              });
            } catch {
              // ignore
            }
            // Auto-skip to the next track if the YouTube video is restricted or unavailable
            setTimeout(() => {
              if (handleNextTrackRef.current) {
                handleNextTrackRef.current();
              }
            }, 500);
          },
        },
      });
    };

    initPlayer();

    return () => {
      isCancelled = true;
    };
  }, [isHydrated]);



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

  // HTML5 Audio element setup & handling (dev only — production uses YouTube)
  useEffect(() => {
    // Skip HTML5 audio in production or when YouTube fallback is active
    if (IS_PRODUCTION || useYtFallback) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    audio.preload = "auto";

    // Try webm audio first, fallback to mp3
    audio.src = `/audio/${currentTrack.videoId}.webm`;

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
      if (isPlaying) {
        audio.play().catch(() => {
          // Browser autoplay policy might wait for first interaction
        });
      }
    };

    const handleCanPlay = () => {
      if (isPlaying && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Continuously update position memory for current scene
      playlistStatesRef.current[currentPlaylistId] = {
        trackIndex,
        currentTime: audio.currentTime,
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("phoenix_playlist_states", JSON.stringify(playlistStatesRef.current));
        } catch {
          // ignore
        }
      }
    };

    const handleEnded = () => {
      setIsPlaying(true);
      if (handleNextTrackRef.current) {
        handleNextTrackRef.current();
      }
    };

    const handleError = () => {
      // If webm fails, try mp3 or switch to YT fallback
      if (audio.src.endsWith(".webm")) {
        audio.src = `/audio/${currentTrack.videoId}.mp3`;
        if (isPlaying) {
          audio.play().catch(() => {
            setUseYtFallback(true);
          });
        }
      } else {
        setUseYtFallback(true);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    if (isPlaying) {
      audio.play().catch(() => {
        // Will resume on metadata / canplay or on first user gesture
      });
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [currentTrack.videoId, useYtFallback, handleNextTrack]);

  // Handle Play / Pause sync
  useEffect(() => {
    if (useYtFallback) {
      if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
        if (lastLoadedYtVideoId.current !== currentTrack.videoId) {
          const seek = initialSeekTimeRef.current;
          if (seek > 0) {
            playerRef.current.loadVideoById({ videoId: currentTrack.videoId, startSeconds: seek });
            initialSeekTimeRef.current = 0;
          } else {
            playerRef.current.loadVideoById(currentTrack.videoId);
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
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          setUseYtFallback(true);
        });
      } else {
        audioRef.current.pause();
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
            playlistStatesRef.current[currentPlaylistId] = {
              trackIndex,
              currentTime: t,
            };
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("phoenix_playlist_states", JSON.stringify(playlistStatesRef.current));
              } catch {
                // ignore
              }
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

        const playSwitchedTrack = (vid: string) => {
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
                playSwitchedTrack(data.videoId);
              }
            });
        } else {
          playSwitchedTrack(targetTrack.videoId);
        }
      } catch {
        // ignore
      }
    }
  }, [currentPlaylistId, trackIndex, currentTime, playlists]);

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
        e.preventDefault();
        handlePlayPause();
      } else if ((keyLower === "r" || e.code === "KeyR") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
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
        e.preventDefault();
        handleSkipBack10();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSkipForward10();
      } else if (keyLower === "n" || e.code === "KeyN") {
        e.preventDefault();
        handleNextTrack();
      } else if (keyLower === "p" || e.code === "KeyP") {
        e.preventDefault();
        handlePrevTrack();
      } else if (keyLower === "a" || e.code === "KeyA") {
        e.preventDefault();
        handleSwitchPlaylist("lofi-monsoon");
      } else if (keyLower === "b" || e.code === "KeyB") {
        e.preventDefault();
        handleSwitchPlaylist("90s-nostalgia");
      } else if (keyLower === "c" || e.code === "KeyC") {
        e.preventDefault();
        handleSwitchPlaylist("punjabi-modern");
      } else if (keyLower === "o" || e.code === "KeyO") {
        e.preventDefault();
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

  return (
    <div className="w-full max-w-xl mx-auto relative">

      {/* Loving Heart Burst Particles (Appears for 5.5s on favorite click only) */}
      <ParticleCanvas burstTrigger={burstTrigger} />

      {/* Hidden single persistent YouTube iframe element wrapper (positioned in-viewport so browser never throttles audio) */}
      <div
        ref={iframeWrapperRef}
        className="fixed bottom-0 right-0 w-px h-px opacity-[0.001] pointer-events-none z-[-1]"
      />

      {/* Floating Music List Drawer Popover */}
      {showMusicList && (
        <div
          ref={musicListRef}
          className="absolute bottom-full mb-3 inset-x-0 bg-neutral-900/90 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl z-50 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-semibold text-white tracking-wide">
                {currentPlaylist.name} • Music List ({currentPlaylist.tracks.length} Songs)
              </span>
            </div>
            <button
              onClick={() => setShowMusicList(false)}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
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

                  <span className="text-[12px] font-bold font-mono text-white/80 shrink-0 ml-2">
                    {formatTime(tr.duration)}
                  </span>
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
                    "Spotify Login",
                    `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
                  );
                }}
                className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95 cursor-pointer shadow-md"
              >
                <span>Connect Spotify</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Desktop Player */}
      <DesktopPlayer
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
      />

      {/* Mobile Player */}
      <MobilePlayer
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
      />
    </div>
  );
}
