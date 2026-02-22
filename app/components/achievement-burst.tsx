"use client";

import { useEffect } from "react";

interface AchievementBurstProps {
  show: boolean;
  text?: string;
  onDone?: () => void;
}

function playSuccessTone() {
  try {
    const ctx = new window.AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.14);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.24);
  } catch {
    // best-effort sound
  }
}

export default function AchievementBurst({ show, text = "Achievement unlocked!", onDone }: AchievementBurstProps) {
  useEffect(() => {
    if (!show) return;
    playSuccessTone();
    const t = window.setTimeout(() => onDone?.(), 1400);
    return () => window.clearTimeout(t);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center">
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative rounded-2xl bg-white border border-indigo-200 px-6 py-4 shadow-2xl animate-[popIn_.35s_ease]">
        <p className="font-semibold text-indigo-900">{text}</p>
        <div className="absolute -top-2 -left-2 h-3 w-3 rounded-full bg-fuchsia-400 animate-ping" />
        <div className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-emerald-400 animate-ping [animation-delay:120ms]" />
      </div>
    </div>
  );
}
