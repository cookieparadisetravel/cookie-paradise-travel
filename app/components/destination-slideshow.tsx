"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { photographs } from "./journey-photo";

const slides = [photographs.skyline, photographs.mekong, photographs.hue, photographs.street];

export function DestinationSlideshow() {
  const container = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    const updateVisibility = () => setHidden(document.hidden);
    const frame = window.requestAnimationFrame(() => { updateMotion(); updateVisibility(); });
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    if (container.current) observer.observe(container.current);
    return () => {
      window.cancelAnimationFrame(frame);
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer.disconnect();
    };
  }, []);

  const rotating = !paused && !reducedMotion && inView && !hidden && !hovered && !focused;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [rotating]);

  function select(next: number) { setPaused(true); setIndex((next + slides.length) % slides.length); }
  const current = slides[index];
  return <section ref={container} className="destination-slideshow story-skyline" role="region" aria-roledescription="carousel" aria-label="A glimpse of your Vietnam destinations"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="destination-slides">
      {slides.map((photo, slideIndex) => <div key={photo.file} className={`destination-slide ${index === slideIndex ? "is-current" : ""}`} aria-hidden={index !== slideIndex}>
        {/* Responsive, locally hosted photographs reserve their display dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/travel/${photo.file}-1280.webp`} srcSet={[640, 1280, 1800].map(width => `/travel/${photo.file}-${width}.webp ${width}w`).join(", ")}
          sizes="(min-width: 1280px) 580px, (min-width: 768px) 47vw, 92vw" width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" decoding="async" />
      </div>)}
    </div>
    <div className="destination-slide-caption" aria-live={rotating ? "off" : "polite"} aria-atomic="true">
      <p><strong>{current.place}</strong><span>{current.detail}</span></p>
      <a href={current.source} target="_blank" rel="noopener noreferrer">Photo: {current.photographer}</a>
    </div>
    <div className="destination-slide-controls">
      <button type="button" onClick={() => select(index - 1)} aria-label="Previous destination photo"><ChevronLeft size={20} /></button>
      <span aria-label={`Photo ${index + 1} of ${slides.length}`}>{index + 1} / {slides.length}</span>
      <button type="button" onClick={() => select(index + 1)} aria-label="Next destination photo"><ChevronRight size={20} /></button>
      {!reducedMotion && <button type="button" className="slideshow-toggle" onClick={() => setPaused(value => !value)} aria-label={paused ? "Play destination slideshow" : "Pause destination slideshow"}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Play" : "Pause"}</button>}
    </div>
  </section>;
}
