"use client";

import React, { useState, useEffect } from "react";
import { Users } from "lucide-react";

export default function ListenerCount() {
  const [count, setCount] = useState<number>(1428);

  useEffect(() => {
    // Subtle realistic random listener oscillation
    const interval = setInterval(() => {
      setCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(1200, prev + delta);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-box text-xs font-medium text-white/80 select-none shadow-lg">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
      </span>
      <Users className="w-3.5 h-3.5 text-white/70" />
      <span className="font-mono tabular-nums text-white font-semibold">{count.toLocaleString()}</span>
      <span className="hidden xs:inline text-white/60 text-[11px]">listening now</span>
    </div>
  );
}
