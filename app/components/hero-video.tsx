"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

type Connection = EventTarget & { saveData?: boolean };
type PlaybackPreference = "pending" | "autoplay" | "reduced-motion" | "save-data";

function connection() {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

function playbackPreference(): PlaybackPreference {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  return connection()?.saveData ? "save-data" : "autoplay";
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

function PlaybackButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return <button
    type="button"
    onClick={onClick}
    aria-label={playing ? "Pause background video" : "Play background video"}
    className="absolute right-5 bottom-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/35 bg-black/40 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:right-8 sm:bottom-6"
  >
    {playing ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
    {playing ? "Pause video" : "Play video"}
  </button>;
}

function HeroPlayback() {
  const video = useRef<HTMLVideoElement>(null);
  const [source] = useState(() => window.matchMedia("(max-width: 767px)").matches
    ? "/vietnam-hero-mobile.mp4" : "/vietnam-hero.mp4");
  const [hasFrame, setHasFrame] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failure, setFailure] = useState<number | null>(null);

  async function togglePlayback() {
    if (!video.current) return;
    if (!playing) {
      try {
        await video.current.play();
      } catch {
        setPlaying(false);
      }
    } else {
      video.current.pause();
    }
  }

  if (failure !== null) return <>
    <HeroPoster state={`playback-error-${failure}`} />
    <PlaybackButton playing={false} onClick={() => { setHasFrame(false); setPlaying(false); setFailure(null); }} />
  </>;

  return <>
    <HeroPoster hidden={hasFrame} state={hasFrame ? "playing" : "loading-video"} />
    <video
      ref={video}
      src={source}
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
      onPlay={() => setPlaying(true)}
      onPlaying={() => { setHasFrame(true); setPlaying(true); }}
      onPause={() => setPlaying(false)}
      onError={(event) => setFailure(event.currentTarget.error?.code ?? 0)}
    />
    <PlaybackButton playing={playing} onClick={() => { void togglePlayback(); }} />
  </>;
}

function HeroPoster({ hidden = false, state }: { hidden?: boolean; state: string }) {
  return <img
      data-hero-video-state={state}
      className={`pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover ${hidden ? "invisible" : "opacity-50"}`}
      aria-hidden={hidden || undefined}
      src="/vietnam-hero-poster.webp"
      alt="Nguyen Hue promenade facing Ho Chi Minh City Hall"
      width={1920}
      height={1080}
      fetchPriority="high"
    />;
}

export function HeroVideo() {
  // No video element or media request until the browser confirms motion/data preferences.
  const [preference, setPreference] = useState<PlaybackPreference>("pending");
  useEffect(() => {
    const update = () => setPreference(playbackPreference());
    const frame = window.requestAnimationFrame(update);
    const unsubscribe = subscribeToPreferences(update);
    return () => { window.cancelAnimationFrame(frame); unsubscribe(); };
  }, []);

  return preference === "autoplay" ? <HeroPlayback /> : <>
    <HeroPoster state={preference} />
    <PlaybackButton playing={false} onClick={() => setPreference("autoplay")} />
  </>;
}
