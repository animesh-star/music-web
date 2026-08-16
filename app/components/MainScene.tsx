"use client";

import React from "react";
import Clock from "./Clock";
import ListenerCount from "./ListenerCount";
import SocialLinks from "./SocialLinks";
import Player from "./Player";

export default function MainScene() {
  return (
    <>
      {/* Sleek Modern Dark Ambient Background */}
      <div className="fixed inset-0 -z-20 bg-[#050508] overflow-hidden">
        {/* Soft Ambient Radial Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-rose-600/10 blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />
      </div>

      {/* Subtle Grain Texture Overlay */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-15"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Fixed top header bar */}
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

      {/* Centered Player Section */}
      <section className="fixed inset-0 flex flex-col items-center justify-center p-4 select-none z-10 w-full overflow-y-auto">
        <div className="w-full max-w-md pointer-events-auto">
          <Player />
        </div>
      </section>
    </>
  );
}
