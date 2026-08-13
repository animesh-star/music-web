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
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
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
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
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

    // Continuously spawn particles for 5.0 seconds (300 frames at 60fps)
    let frameCount = 0;
    const maxFrames = 300; // 5.0 seconds

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      frameCount++;

      if (frameCount < maxFrames) {
        if (frameCount % 4 === 0) {
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
            decay: 0.005 + Math.random() * 0.007,
            rot: (Math.random() - 0.5) * 0.3,
            rotSpeed: (Math.random() - 0.5) * 0.04,
          });
        }
      }

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
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }

      if (particles.length > 0 || frameCount < maxFrames) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

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
        <img
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
          alt="Vinyl artwork"
          className="w-full h-full object-cover rounded-full pointer-events-none scale-125 select-none"
        />

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
}: DesktopPlayerProps) {
  return (
    <div className="hidden sm:flex items-center gap-4 w-full rounded-full p-3 pr-5 glass-pill transition-all duration-300">
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
        <div className="flex justify-between items-center text-[10.5px] text-white/60 font-mono tabular-nums">
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
}: MobilePlayerProps) {
  return (
    <div className="flex flex-col sm:hidden gap-3.5 w-full rounded-[26px] p-4 glass-pill transition-all duration-300">
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
        <div className="text-[10.5px] text-white/60 font-mono tabular-nums flex flex-col">
          <span>{formatTime(currentTime)}</span>
          <span className="text-white/40">{formatTime(duration)}</span>
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
  // In production, skip local audio and go straight to YouTube
  const [useYtFallback, setUseYtFallback] = useState<boolean>(IS_PRODUCTION);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadedYtVideoId = useRef<string | null>(null);
  const globalIframeId = "yt-player-global-container";

  // Per-playlist playback memory store (remembers last track & exact timestamp for Scene A, B, C)
  const playlistStatesRef = useRef<Record<string, { trackIndex: number; currentTime: number }>>({
    "lofi-monsoon": { trackIndex: 0, currentTime: 0 },
    "90s-nostalgia": { trackIndex: 0, currentTime: 0 },
    "punjabi-modern": { trackIndex: 0, currentTime: 0 },
  });

  const initialSeekTimeRef = useRef<number>(0);

  // Hydrate scene & position memory from localStorage on client load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedPlaylistId = localStorage.getItem("phoenix_active_playlist_id");
        const savedStates = localStorage.getItem("phoenix_playlist_states");

        if (savedStates) {
          const parsed = JSON.parse(savedStates);
          playlistStatesRef.current = { ...playlistStatesRef.current, ...parsed };
        }

        if (savedPlaylistId && PLAYLISTS.some((p) => p.id === savedPlaylistId)) {
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
      }
    }
  }, []);

  const currentPlaylist = PLAYLISTS.find((p) => p.id === currentPlaylistId) || PLAYLISTS[0];
  const currentTrack = currentPlaylist.tracks[trackIndex] || currentPlaylist.tracks[0];

  // Broadcast scene changes and persist active playlist ID
  useEffect(() => {
    if (onSceneChange) {
      onSceneChange(currentPlaylist.sceneClass);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("phoenix_active_playlist_id", currentPlaylistId);
    }
  }, [currentPlaylist, currentPlaylistId, onSceneChange]);

  const handleNextTrack = useCallback(() => {
    setTrackIndex((prev) => {
      const nextIdx = (prev + 1) % currentPlaylist.tracks.length;
      playlistStatesRef.current[currentPlaylistId] = {
        trackIndex: nextIdx,
        currentTime: 0,
      };
      return nextIdx;
    });
    setCurrentTime(0);
    initialSeekTimeRef.current = 0;
    setIsPlaying(true);
  }, [currentPlaylist.tracks.length, currentPlaylistId]);

  const handlePrevTrack = useCallback(() => {
    setTrackIndex((prev) => {
      const prevIdx = (prev - 1 + currentPlaylist.tracks.length) % currentPlaylist.tracks.length;
      playlistStatesRef.current[currentPlaylistId] = {
        trackIndex: prevIdx,
        currentTime: 0,
      };
      return prevIdx;
    });
    setCurrentTime(0);
    initialSeekTimeRef.current = 0;
    setIsPlaying(true);
  }, [currentPlaylist.tracks.length, currentPlaylistId]);

  // Setup single YouTube player instance safely as fallback
  useEffect(() => {
    let isCancelled = false;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (isCancelled || !window.YT || !window.YT.Player) return;

      const targetElem = document.getElementById(globalIframeId);
      if (!targetElem) return;

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore cleanup
        }
      }

      playerRef.current = new window.YT.Player(globalIframeId, {
        videoId: currentTrack.videoId,
        playerVars: {
          autoplay: 0,
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
          },
          onStateChange: (event) => {
            if (isCancelled) return;
            if (event.data === window.YT?.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (event.data === window.YT?.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT?.PlayerState.ENDED) {
              setIsPlaying(true);
              handleNextTrack();
            }
          },
          onError: (event) => {
            if (isCancelled) return;
            try {
              trackAnalytics("youtube_video_error", {
                code: event.data,
                videoId: currentTrack.videoId,
                trackId: currentTrack.id,
              });
            } catch {
              // ignore
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      isCancelled = true;
    };
  }, []);

  // HTML5 Audio element setup & handling (dev only — production uses YouTube)
  useEffect(() => {
    // Skip HTML5 audio in production; YouTube iframe handles everything
    if (IS_PRODUCTION) return;

    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = "auto";
    setUseYtFallback(false);

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
      handleNextTrack();
    };

    const handleError = () => {
      // If webm fails, try mp3 or switch to YT fallback
      if (audio.src.endsWith(".webm")) {
        audio.src = `/audio/${currentTrack.videoId}.mp3`;
      } else {
        setUseYtFallback(true);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    if (isPlaying) {
      audio.play().catch(() => {
        setUseYtFallback(true);
      });
    }

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [currentTrack.videoId]);

  // Handle Play / Pause sync
  useEffect(() => {
    if (useYtFallback) {
      if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
        if (lastLoadedYtVideoId.current !== currentTrack.videoId) {
          playerRef.current.loadVideoById(currentTrack.videoId);
          lastLoadedYtVideoId.current = currentTrack.videoId;
          if (initialSeekTimeRef.current > 0) {
            playerRef.current.seekTo(initialSeekTimeRef.current, true);
            initialSeekTimeRef.current = 0;
          }
        }
        if (isPlaying) {
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
    if (useYtFallback && isPlaying) {
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
  }, [isPlaying, useYtFallback, currentPlaylistId, trackIndex]);

  // User interactions
  const handlePlayPause = () => {
    if (!useYtFallback && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          setUseYtFallback(true);
          if (playerRef.current) {
            playerRef.current.playVideo();
            setIsPlaying(true);
          }
        });
      }
    } else if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    }
  };

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
    if (!useYtFallback && audioRef.current) {
      audioRef.current.currentTime = seconds;
    } else if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seconds, true);
    }
  };

  const handleSkipBack10 = useCallback(() => {
    const activeTime = audioRef.current ? audioRef.current.currentTime : currentTime;
    const newTime = Math.max(0, activeTime - 10);
    handleSeek(newTime);
  }, [currentTime]);

  const handleSkipForward10 = useCallback(() => {
    const activeTime = audioRef.current ? audioRef.current.currentTime : currentTime;
    const newTime = Math.min(duration, activeTime + 10);
    handleSeek(newTime);
  }, [currentTime, duration]);

  // Smooth Scene Switcher: saves current position & resumes target scene exactly where left off
  const handleSwitchPlaylist = useCallback((newPlaylistId: string) => {
    if (newPlaylistId === currentPlaylistId) return;

    // 1. Save position of outgoing scene
    const activeTime = audioRef.current ? audioRef.current.currentTime : currentTime;
    playlistStatesRef.current[currentPlaylistId] = {
      trackIndex,
      currentTime: isFinite(activeTime) ? activeTime : 0,
    };
    savePlaylistStates();

    // 2. Fetch saved state of incoming scene
    const savedState = playlistStatesRef.current[newPlaylistId] || { trackIndex: 0, currentTime: 0 };

    // 3. Set seek target for the new scene audio stream
    initialSeekTimeRef.current = savedState.currentTime;

    // 4. Update current scene state & seamlessly resume music
    setCurrentPlaylistId(newPlaylistId);
    setTrackIndex(savedState.trackIndex);
    setCurrentTime(savedState.currentTime);
    setIsPlaying(true);
  }, [currentPlaylistId, trackIndex, currentTime]);

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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSkipBack10, handleSkipForward10, handleNextTrack, handlePrevTrack, handleSwitchPlaylist]);

  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("phoenix_favorite_tracks");
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {};
  });

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

      {/* Hidden single persistent YouTube iframe element */}
      <div
        id={globalIframeId}
        className="fixed -top-[9999px] -left-[9999px] w-1 h-1 opacity-0 pointer-events-none"
      />

      {/* Floating Music List Drawer Popover */}
      {showMusicList && (
        <div className="absolute bottom-full mb-3 inset-x-0 bg-neutral-900/90 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl z-50 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                  onClick={() => {
                    setTrackIndex(idx);
                    setCurrentTime(0);
                    initialSeekTimeRef.current = 0;
                    setIsPlaying(true);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                    isActive
                      ? "bg-white/20 text-white font-medium shadow-sm"
                      : "hover:bg-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-mono w-5 text-center ${isActive ? "text-rose-400 font-bold" : "text-white/40"}`}>
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

                  <span className="text-[11px] font-mono text-white/40 shrink-0 ml-2">
                    {formatTime(tr.duration)}
                  </span>
                </button>
              );
            })}
          </div>
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
        playlists={PLAYLISTS}
        currentPlaylistId={currentPlaylistId}
        onSwitchPlaylist={handleSwitchPlaylist}
        showMusicList={showMusicList}
        onToggleMusicList={() => setShowMusicList((prev) => !prev)}
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
        playlists={PLAYLISTS}
        currentPlaylistId={currentPlaylistId}
        onSwitchPlaylist={handleSwitchPlaylist}
        showMusicList={showMusicList}
        onToggleMusicList={() => setShowMusicList((prev) => !prev)}
      />
    </div>
  );
}
