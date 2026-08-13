"use client";

import React, { useState } from "react";
import Clock from "./Clock";
import ListenerCount from "./ListenerCount";
import SocialLinks from "./SocialLinks";
import Player from "./Player";

export default function MainScene() {
  const [activeSceneClass, setActiveSceneClass] = useState<string>("scene-a");

  return (
    <>
      {/* 1. Fixed background div, -z-20 */}
      <div
        className={`fixed inset-0 -z-20 bg-cover bg-center transition-all duration-700 ease-in-out hero-bg ${activeSceneClass}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/80 pointer-events-none" />
      </div>

      {/* 2. Fixed grain overlay, -z-10: inline SVG feTurbulence data-URI */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 3. Fixed top row using max(1rem, env(safe-area-inset-*)) */}
      <header className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
        <div
          className="w-full flex items-center justify-between"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          {/* Top Left: Clock */}
          <div className="pointer-events-auto">
            <Clock />
          </div>

          {/* Top Centre: Listener Count */}
          <div className="pointer-events-auto">
            <ListenerCount />
          </div>

          {/* Top Right: Social Links */}
          <div className="pointer-events-auto">
            <SocialLinks />
          </div>
        </div>
      </header>

      {/* Subtitle / Ambient Heading & Centered Player in the Middle */}
      <main className="flex-1 flex flex-col items-center justify-center py-6 px-4 text-center select-none z-10 w-full max-w-xl mx-auto min-h-0">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white/95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] font-sans">
          PHOENIX<span className="text-rose-500 font-extrabold ml-1">.PLAY</span>
        </h1>
        <p className="mt-1.5 mb-6 text-xs md:text-sm text-white/70 max-w-md backdrop-blur-md bg-black/20 px-3.5 py-1 rounded-full border border-white/10 shadow-lg pointer-events-none">
          Press play to stream retro memories & golden era vibes
        </p>

        {/* 4. The player, centered in the middle */}
        <div className="w-full pointer-events-auto">
          <Player onSceneChange={(cls) => setActiveSceneClass(cls)} />
        </div>
      </main>
    </>
  );
}
