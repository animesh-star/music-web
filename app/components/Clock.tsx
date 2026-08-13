"use client";

import React, { useState, useEffect } from "react";

export default function Clock() {
  const [timeParts, setTimeParts] = useState<{ hour: string; minute: string; ampm: string } | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const formatted = formatter.format(now);
      // formatted is typically "4:05 pm" or "04:05 PM"
      const match = formatted.match(/^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)$/i);
      if (match) {
        setTimeParts({
          hour: match[1],
          minute: match[2],
          ampm: match[3].toUpperCase(),
        });
      } else {
        const parts = formatted.split(":");
        if (parts.length >= 2) {
          const minAndAmpm = parts[1].trim().split(" ");
          setTimeParts({
            hour: parts[0].trim(),
            minute: minAndAmpm[0] || "00",
            ampm: (minAndAmpm[1] || "").toUpperCase(),
          });
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeParts) {
    return (
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full glass-box text-xs font-medium tracking-wide text-white/80 select-none">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
        <span>IST --:--</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-box text-xs font-semibold tracking-wider text-white/90 shadow-lg select-none">
      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
      <span className="text-white/60 font-medium">IST</span>
      <div className="flex items-center font-mono tabular-nums text-white">
        <span>{timeParts.hour}</span>
        <span className="animate-blink px-0.5 text-white/80">:</span>
        <span>{timeParts.minute}</span>
        <span className="ml-1 text-[10px] text-white/60 font-sans">{timeParts.ampm}</span>
      </div>
    </div>
  );
}
