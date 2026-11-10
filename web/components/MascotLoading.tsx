"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  loadingPercent,
  type LoadingPose,
} from "../../packages/shared/src/loadingProgress";
import "./mascot-loading.css";

export function MascotLoading({
  label,
  detail,
  pose = "waiting",
  progress,
  progressText,
  compact = false,
}: {
  label: string;
  detail?: string;
  pose?: LoadingPose;
  progress?: number;
  progressText?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!ref.current) return;
    let inView = false;
    const sync = () => setPlaying(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const value = loadingPercent(progress);
  const text = progressText ?? (value === undefined ? undefined : `${value}% complete`);
  const still = `/mascot-loading/${pose}.png`;
  return (
    <div ref={ref} data-playing={playing} className={`mascot-loading${compact ? " is-compact" : ""}`}>
      <picture aria-hidden="true">
        <source media="(prefers-reduced-motion: reduce)" srcSet={still} />
        <Image
          src={playing ? `/mascot-loading/${pose}.webp` : still}
          alt=""
          width={compact ? 48 : 96}
          height={compact ? 48 : 96}
          unoptimized
          loading="eager"
        />
      </picture>
      <div className="mascot-loading-copy" role="status">
        <p className="mascot-loading-label">{label}</p>
        {detail && <p className="mascot-loading-detail">{detail}</p>}
      </div>
      <div
        className={`mascot-loading-track${value === undefined ? " is-indeterminate" : ""}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuetext={text}
      >
        <span style={value === undefined ? undefined : { width: `${value}%` }} />
      </div>
      {text && <p className="mascot-loading-value" aria-hidden="true">{text}</p>}
    </div>
  );
}
