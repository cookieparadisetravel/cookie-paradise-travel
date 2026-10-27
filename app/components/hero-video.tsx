"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";

type Connection = EventTarget & { saveData?: boolean };

function connection() {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

function shouldAutoplay() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && !connection()?.saveData;
}

function subscribeToPreferences(onChange: () => void) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const network = connection();
  motion.addEventListener("change", onChange);
  network?.addEventListener("change", onChange);
  return () => {
    motion.removeEventListener("change", onChange);
    network?.removeEventListener("change", onChange);
  };
}

function HeroPlayback() {
  const video = useRef<HTMLVideoElement>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  async function togglePlayback() {
    if (!video.current) return;
    if (video.current.paused) {
      try {
        await video.current.play();
      } catch {
        setFailed(true);
      }
    } else {
      video.current.pause();
    }
  }

  if (failed) return <HeroPoster />;

  return <>
    <HeroPoster hidden={hasFrame} />
    <video
      ref={video}
      id="hero-background-video"
      className={`pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover ${hasFrame ? "opacity-50" : "opacity-0"}`}
      aria-hidden="true"
      tabIndex={-1}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster="/vietnam-hero-poster.webp"
      onPlaying={() => { setHasFrame(true); setPlaying(true); }}
      onPause={() => setPlaying(false)}
      onError={() => setFailed(true)}
    >
      <source src="/vietnam-hero-mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
      <source src="/vietnam-hero.mp4" type="video/mp4" />
    </video>
    <button
      type="button"
      onClick={() => { void togglePlayback(); }}
      aria-controls="hero-background-video"
      aria-label={playing ? "Pause background video" : "Play background video"}
      className="absolute right-5 bottom-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/35 bg-black/40 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:right-8 sm:bottom-6"
    >
      {playing ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
      {playing ? "Pause video" : "Play video"}
    </button>
  </>;
}

function HeroPoster({ hidden = false }: { hidden?: boolean }) {
  return <img
      className={`pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover ${hidden ? "invisible" : "opacity-50"}`}
      aria-hidden={hidden || undefined}
      src="/vietnam-hero-poster.webp"
      alt="Nguyễn Huệ promenade facing Ho Chi Minh City Hall"
      width={1920}
      height={1080}
      fetchPriority="high"
    />;
}

export function HeroVideo() {
  // No video element or media request until the browser confirms motion/data preferences.
  const autoplay = useSyncExternalStore(subscribeToPreferences, shouldAutoplay, () => false);
  return autoplay ? <HeroPlayback /> : <HeroPoster />;
}
