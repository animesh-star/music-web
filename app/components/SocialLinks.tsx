"use client";

import React, { useState } from "react";
import { Share2, Heart, Check } from "lucide-react";

export default function SocialLinks() {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-full glass-box text-xs select-none shadow-lg">
      <button
        onClick={() => setLiked(!liked)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-300 ${
          liked ? "bg-rose-500/30 text-rose-300 border border-rose-500/40" : "hover:bg-white/10 text-white/80"
        }`}
        title="Favorite this vibe"
      >
        <Heart className={`w-3.5 h-3.5 transition-transform duration-300 ${liked ? "fill-rose-400 text-rose-400 scale-110" : ""}`} />
        <span className="hidden sm:inline font-medium text-[11px]">{liked ? "Saved" : "Favorite"}</span>
      </button>

      <button
        onClick={handleShare}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-white/10 text-white/80 transition-all duration-300"
        title="Share station"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-300">Copied!</span>
          </>
        ) : (
          <>
            <Share2 className="w-3.5 h-3.5 text-white/80" />
            <span className="hidden sm:inline font-medium text-[11px]">Share</span>
          </>
        )}
      </button>
    </div>
  );
}
