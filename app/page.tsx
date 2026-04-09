"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────── types */
type Sequence = { folder: string; count: number; files: string[] };
type ApiResponse = { sequences: Sequence[]; totalFrames?: number };
type SequenceMeta = Sequence & { start: number };
type TrackId = "rain" | "forest" | "wildlife" | "frog" | "panther" | "cinematic" | "wind";

type SoundTrack = {
  id: TrackId;
  label: string;
  trackSrc: string;
  baseVolume: number;
};

type SoundProfile = Partial<Record<TrackId, number>>;

/* ─────────────────────────────────────────────────────────── utils */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const eqPow = (t: number) => ({ from: Math.cos(t * Math.PI * 0.5), to: Math.sin(t * Math.PI * 0.5) });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ─────────────────────────────────────────────────────────── draw */
const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) => {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = iw * scale;
  const sh = ih * scale;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
};

/* ─────────────────────────────────────────────────────────── audio */
// Rain stays as the permanent atmospheric base (all frames).
// Each scene adds its own layer on top.
const TRACKS: SoundTrack[] = [
  { id: "rain",     label: "Rain",     trackSrc: "/audio/rain.wav",     baseVolume: 0.42 },
  { id: "forest",   label: "Forest",   trackSrc: "/audio/forest.wav",   baseVolume: 0.36 },
  { id: "wildlife", label: "Wildlife", trackSrc: "/audio/wildlife.wav", baseVolume: 0.28 },
  { id: "panther",  label: "Panther",  trackSrc: "/audio/panther.wav",  baseVolume: 0.26 },
  { id: "cinematic",label: "Cinematic",trackSrc: "/audio/cinematic.wav",baseVolume: 0.30 },
  // "wind" and "frog" are synthesized via Web Audio if no file exists
];

// Per-sequence sound profiles — rain always ≥ 0.55 so it's a constant bed
const PROFILES: SoundProfile[] = [
  { rain: 0.70, forest: 0.90, wildlife: 0.40, cinematic: 0.30, panther: 0.00 }, // scene 0 – forest/rain
  { rain: 0.80, forest: 0.50, wildlife: 0.30, cinematic: 0.50, panther: 0.00 }, // scene 1 – rain dominant
  { rain: 0.60, forest: 0.80, wildlife: 0.90, cinematic: 0.35, panther: 0.00 }, // scene 2 – wildlife
  { rain: 0.55, forest: 0.40, wildlife: 0.20, cinematic: 0.75, panther: 0.90 }, // scene 3 – panther/cinema
];

const SFX_MAP: Record<string, string[]> = {
  forest:  ["/audio/sfx/forest-birds.wav"],
  rain:    ["/audio/sfx/rain-thunder.wav"],
  deer:    ["/audio/sfx/deer-step.wav"],
  panther: ["/audio/sfx/panther-growl.wav"],
};

/* ═══════════════════════════════════════════════════════════════════
   LOADER – animated mountains + flying birds
═══════════════════════════════════════════════════════════════════ */
function Loader({
  loaded,
  total,
  error,
  soundEnabled,
  audioBlocked,
  soundError,
  onToggleSound,
}: {
  loaded: number;
  total: number;
  error?: string;
  soundEnabled: boolean;
  audioBlocked: boolean;
  soundError: string | null;
  onToggleSound: () => void;
}) {
  const svgCanvasRef = useRef<SVGSVGElement>(null);
  const birdGroupRef = useRef<SVGGElement>(null);
  const progressPct = total ? clamp((loaded / total) * 100, 0, 100) : 5;

  /* Animate birds via JS RAF */
  useEffect(() => {
    let raf = 0;
    let t = 0;

    const birds = [
      { x: 0.18, y: 0.30, speed: 0.0006, amp: 0.018, phase: 0.0,   scale: 1.0 },
      { x: 0.08, y: 0.22, speed: 0.0004, amp: 0.012, phase: 1.2,   scale: 0.7 },
      { x: 0.30, y: 0.26, speed: 0.0008, amp: 0.022, phase: 2.5,   scale: 0.85 },
      { x: 0.42, y: 0.18, speed: 0.0005, amp: 0.015, phase: 0.8,   scale: 0.6 },
      { x: 0.60, y: 0.30, speed: 0.0007, amp: 0.020, phase: 3.1,   scale: 0.9 },
      { x: 0.75, y: 0.20, speed: 0.0004, amp: 0.010, phase: 1.7,   scale: 0.65 },
    ];

    const tick = (now: number) => {
      t = now;
      const g = birdGroupRef.current;
      if (!g) { raf = requestAnimationFrame(tick); return; }

      const W = g.closest("svg")?.clientWidth ?? 760;
      const H = g.closest("svg")?.clientHeight ?? 220;

      const els = g.querySelectorAll<SVGGElement>(".bird");
      birds.forEach((b, i) => {
        const el = els[i];
        if (!el) return;

        const xPos = ((b.x * W + t * b.speed * W) % (W * 1.2)) - W * 0.1;
        const yPos = b.y * H + Math.sin(t * 0.002 + b.phase) * b.amp * H;
        // Wing flap: scale Y of top wings
        const flapAngle = Math.sin(t * 0.006 + b.phase) * 8; // degrees
        el.setAttribute("transform", `translate(${xPos},${yPos}) scale(${b.scale})`);
        const wings = el.querySelectorAll<SVGPathElement>(".wing");
        wings.forEach((w, wi) => {
          w.setAttribute("transform", `rotate(${wi === 0 ? -flapAngle : flapAngle},0,0)`);
        });
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="loader-root">
      {/* Animated gradient background */}
      <div className="loader-bg" />
      <div className="loader-mist" />

      {/* Mountain SVG scene */}
      <svg
        ref={svgCanvasRef}
        className="loader-scene"
        viewBox="0 0 760 220"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1628" />
            <stop offset="100%" stopColor="#1a3a2a" />
          </linearGradient>
          <linearGradient id="mt-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a4a3a" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#1a3020" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="mt-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3d2a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#112218" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="mt-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d2015" />
            <stop offset="100%" stopColor="#061208" />
          </linearGradient>
          <linearGradient id="snow-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f4f0" />
            <stop offset="100%" stopColor="#b0ccc0" stopOpacity="0.6" />
          </linearGradient>
          <filter id="blur-far">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="blur-mid">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          <filter id="glow-moon">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Sky */}
        <rect width="760" height="220" fill="url(#sky-grad)" />

        {/* Moon glow */}
        <circle cx="620" cy="38" r="22" fill="#e8f4e0" opacity="0.12" filter="url(#glow-moon)" />
        <circle cx="620" cy="38" r="13" fill="#d8eedc" opacity="0.55" />
        <circle cx="620" cy="38" r="9"  fill="#f0f8f0" opacity="0.80" />

        {/* Stars */}
        {[
          [80,18],[140,10],[210,24],[290,8],[360,16],[440,12],[510,22],[560,6],[680,18],[720,10],
          [60,35],[170,30],[330,28],[490,33],[650,25],[740,30],
        ].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r={1.2} fill="#cdecd8" opacity={0.4 + (i%3)*0.15} />
        ))}

        {/* Far mountains */}
        <g filter="url(#blur-far)" opacity="0.65">
          <path d="M0 170 L60 90 L120 130 L190 60 L260 110 L340 70 L420 115 L500 65 L580 100 L650 75 L720 95 L760 80 L760 220 L0 220Z" fill="url(#mt-far)" />
        </g>

        {/* Mid mountains with snow caps */}
        <g filter="url(#blur-mid)" opacity="0.85">
          <path d="M0 185 L80 105 L150 150 L240 80 L320 130 L410 88 L480 125 L560 85 L630 115 L700 90 L760 110 L760 220 L0 220Z" fill="url(#mt-mid)" />
          {/* Snow caps */}
          <path d="M240 80 L258 102 L222 102Z" fill="url(#snow-grad)" opacity="0.7" />
          <path d="M410 88 L427 108 L393 108Z" fill="url(#snow-grad)" opacity="0.65" />
          <path d="M560 85 L576 105 L544 105Z" fill="url(#snow-grad)" opacity="0.6" />
        </g>

        {/* Near/foreground mountains */}
        <path d="M0 200 L100 138 L180 170 L270 115 L360 155 L450 118 L540 150 L620 128 L700 148 L760 135 L760 220 L0 220Z" fill="url(#mt-near)" />
        {/* Foreground treeline silhouette */}
        <path d="M0 220 L15 202 L22 210 L30 198 L38 207 L48 195 L56 203 L65 192 L74 200 L82 188 L90 196 L100 183 L108 191 L118 178 L126 186 L136 174 L145 181 L155 170 L162 178 L172 166 L180 174 L190 163 L200 170 L210 160 L218 168 L228 157 L238 164 L248 155 L256 162 L266 152 L275 159 L285 150 L295 157 L305 148 L313 156 L323 147 L332 155 L342 146 L350 153 L360 144 L370 152 L380 143 L388 151 L398 142 L406 150 L416 141 L424 149 L434 141 L443 149 L452 141 L460 148 L470 140 L479 148 L488 141 L497 148 L506 141 L515 149 L524 142 L532 149 L541 143 L550 150 L559 144 L567 151 L576 145 L584 152 L593 146 L601 154 L610 148 L618 155 L627 149 L636 157 L644 151 L652 159 L661 153 L669 161 L678 155 L686 163 L695 157 L703 165 L712 159 L720 167 L729 161 L737 169 L746 163 L754 171 L760 167 L760 220Z" fill="#040d07" opacity="0.95" />

        {/* Animated mist layers */}
        <rect x="-760" y="170" width="1900" height="35" fill="#1a3a2a" opacity="0.25" rx="20">
          <animateTransform attributeName="transform" type="translate" from="0,0" to="200,0" dur="14s" repeatCount="indefinite" />
        </rect>
        <rect x="-760" y="178" width="1900" height="25" fill="#122a1a" opacity="0.18" rx="16">
          <animateTransform attributeName="transform" type="translate" from="100,0" to="-100,0" dur="20s" repeatCount="indefinite" />
        </rect>

        {/* Birds group */}
        <g ref={birdGroupRef}>
          {[0,1,2,3,4,5].map(i => (
            <g key={i} className="bird">
              {/* Body */}
              <ellipse cx="0" cy="0" rx="4" ry="1.8" fill="#cdecd0" opacity="0.85" />
              {/* Left wing */}
              <path className="wing" d="M-4,0 Q-10,-6 -14,-2" stroke="#b0ddb8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              {/* Right wing */}
              <path className="wing" d="M4,0 Q10,-6 14,-2" stroke="#b0ddb8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* Rain streaks */}
        {Array.from({ length: 28 }).map((_, i) => (
          <line
            key={i}
            x1={20 + i * 26} y1={0}
            x2={16 + i * 26} y2={18}
            stroke="#7ab89a"
            strokeWidth="0.6"
            opacity="0.18"
          >
            <animate
              attributeName="y1"
              values={`${-20 + (i % 5) * 4};220`}
              dur={`${1.2 + (i % 4) * 0.3}s`}
              repeatCount="indefinite"
              begin={`${(i * 0.1) % 1.5}s`}
            />
            <animate
              attributeName="y2"
              values={`${-2 + (i % 5) * 4};238`}
              dur={`${1.2 + (i % 4) * 0.3}s`}
              repeatCount="indefinite"
              begin={`${(i * 0.1) % 1.5}s`}
            />
          </line>
        ))}
      </svg>

      {/* Info card */}
      <div className="loader-card">
        <div className="loader-card-header">
          <div>
            <div className="loader-eyebrow">Nature • Cinematic • 4K</div>
            <div className="loader-title">Entering the wilderness</div>
            <div className="loader-subtitle">
              {error ? "Failed to load frames" : "Preloading cinematic frames · Rain incoming"}
            </div>
          </div>
          <button
            type="button"
            className="loader-sound-btn"
            onClick={onToggleSound}
          >
            <span className="loader-sound-icon">
              {soundEnabled ? (audioBlocked ? "🔇" : "🔊") : "🔕"}
            </span>
            {soundEnabled ? (audioBlocked ? "Tap for sound" : "Sound on") : "Sound off"}
          </button>
        </div>

        {soundError && (
          <div className="loader-sound-error">{soundError}</div>
        )}

        <div className="loader-progress-row">
          <span>{error ? "Error" : `${loaded} / ${total || "—"} frames`}</span>
          <span className="loader-pct">
            {total ? `${Math.round(progressPct)}%` : "…"}
          </span>
        </div>
        <div className="loader-track">
          <div className="loader-fill" style={{ width: `${progressPct}%` }} />
          <div className="loader-fill-glow" style={{ left: `${progressPct}%` }} />
        </div>

        {error && (
          <div className="loader-error-box">{error}</div>
        )}

        {/* Animated nature dots */}
        <div className="loader-dots">
          {["🌧️","🌲","🐦","🦌","🐆"].map((e, i) => (
            <span key={i} className="loader-dot" style={{ animationDelay: `${i * 0.22}s` }}>{e}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const ctxRef           = useRef<CanvasRenderingContext2D | null>(null);
  const imagesRef        = useRef<HTMLImageElement[][]>([]);
  const seqMetaRef       = useRef<SequenceMeta[]>([]);
  const totalFramesRef   = useRef(0);
  const targetFrameRef   = useRef(0);
  const currentFrameRef  = useRef(0);
  const velocityRef      = useRef(0);         // scroll velocity for spring
  const lastDrawnRef     = useRef(-1);
  const lastSceneIdRef   = useRef<string | null>(null);
  const sfxCacheRef      = useRef<Record<string, AudioBuffer>>({});

  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    tracks: Record<string, { el: HTMLAudioElement; src: MediaElementAudioSourceNode; gain: GainNode }>;
    enabled: boolean;
  } | null>(null);
  const audioCleanupRef  = useRef<null | (() => void)>(null);
  const audioUnlockedRef = useRef(false);

  const [isReady,       setIsReady]       = useState(false);
  const [pageHeightPx,  setPageHeightPx]  = useState<number | null>(null);
  const [loadState,     setLoadState]     = useState<{ total: number; loaded: number; error?: string }>({ total: 0, loaded: 0 });
  const [soundEnabled,  setSoundEnabled]  = useState(true);
  const [audioBlocked,  setAudioBlocked]  = useState(false);
  const [soundError,    setSoundError]    = useState<string | null>(null);
  const soundEnabledRef = useRef(true);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  /* ── vignette overlay (memoized, never changes) */
  const vignetteStyle = useMemo(() => ({
    backgroundImage:
      "radial-gradient(ellipse at center, rgba(0,0,0,0) 48%, rgba(0,0,0,0.68) 100%)," +
      "linear-gradient(to top,    rgba(0,0,0,0.38), rgba(0,0,0,0) 32%)," +
      "linear-gradient(to bottom, rgba(0,0,0,0.32), rgba(0,0,0,0) 32%)",
  }), []);

  /* ── get sequence info for a global frame */
  const getSeq = useCallback((gf: number) => {
    const meta = seqMetaRef.current;
    if (!meta.length || totalFramesRef.current <= 0) return null;
    const frame = clamp(Math.round(gf), 0, totalFramesRef.current - 1);
    let si = 0;
    for (let i = 0; i < meta.length; i++) {
      if (frame >= meta[i].start && frame < meta[i].start + meta[i].count) { si = i; break; }
    }
    const local    = frame - meta[si].start;
    const count    = meta[si].count;
    const progress = count <= 1 ? 0 : local / (count - 1);
    return { si, local, frame, meta: meta[si], progress };
  }, []);

  /* ── crossfade sound mix for current frame */
  const getMix = useCallback((gf: number): Record<TrackId, number> | null => {
    const seq = getSeq(gf);
    if (!seq) return null;
    const tw = 0.18;
    const cur = PROFILES[seq.si] ?? PROFILES[0];
    const mix: Record<TrackId, number> = {
      rain: cur.rain ?? 0, forest: cur.forest ?? 0, wildlife: cur.wildlife ?? 0,
      frog: cur.frog ?? 0, panther: cur.panther ?? 0, cinematic: cur.cinematic ?? 0,
      wind: cur.wind ?? 0,
    };

    if (seq.progress < tw && seq.si > 0) {
      const prev = PROFILES[seq.si - 1] ?? {};
      const { from, to } = eqPow(smoothstep(0, tw, seq.progress));
      (Object.keys(mix) as TrackId[]).forEach(k => {
        mix[k] = (prev[k] ?? 0) * from + (cur[k] ?? 0) * to;
      });
    } else if (seq.progress > 1 - tw && seq.si < PROFILES.length - 1) {
      const next = PROFILES[seq.si + 1] ?? {};
      const { from, to } = eqPow(smoothstep(1 - tw, 1, seq.progress));
      (Object.keys(mix) as TrackId[]).forEach(k => {
        mix[k] = (cur[k] ?? 0) * from + (next[k] ?? 0) * to;
      });
    }

    // rain is always the environmental bed — minimum 0.45 everywhere
    mix.rain    = Math.max(mix.rain,    0.55);
    mix.cinematic = Math.max(mix.cinematic, 0.18);
    mix.forest  = Math.max(mix.forest,  0.12);
    return mix;
  }, [getSeq]);

  /* ── stop audio cleanly */
  const stopAudio = useCallback(async () => {
    const ref = audioRef.current;
    audioUnlockedRef.current = false;
    setAudioBlocked(false);
    setSoundError(null);
    if (!ref) return;
    const now = ref.ctx.currentTime;
    for (const t of Object.values(ref.tracks)) {
      t.gain.gain.setTargetAtTime(0, now, 0.08);
      t.el.pause();
      t.el.currentTime = 0;
    }
    try { await ref.ctx.suspend(); } catch { /* ignored */ }
  }, []);

  /* ── unlock / enable audio */
  const enableAudio = useCallback(async (fromGesture = false) => {
    if (audioRef.current?.enabled) {
      audioUnlockedRef.current = true;
      setAudioBlocked(false); setSoundError(null);
      try {
        await audioRef.current.ctx.resume();
        for (const t of Object.values(audioRef.current.tracks)) await t.el.play();
      } catch { if (fromGesture) { setAudioBlocked(true); setSoundError("Browser still blocking sound."); } }
      return;
    }

    if (!seqMetaRef.current.length) { setSoundError("Sound available once loading completes."); return; }
    setSoundError(null);

    const ACtor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!ACtor) { setSoundError("Audio not supported."); return; }

    const ctx: AudioContext = new ACtor();
    const master = ctx.createGain();
    master.gain.value = 0.92;
    master.connect(ctx.destination);

    const tracks: Record<string, { el: HTMLAudioElement; src: MediaElementAudioSourceNode; gain: GainNode }> = {};
    for (const tc of TRACKS) {
      const el = new Audio(tc.trackSrc);
      el.loop = true; el.preload = "auto";
      const src  = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain); gain.connect(master);
      tracks[tc.id] = { el, src, gain };
    }

    audioRef.current = { ctx, master, tracks, enabled: true };

    try {
      await ctx.resume();
      for (const tc of TRACKS) await tracks[tc.id].el.play();
      audioUnlockedRef.current = true; setAudioBlocked(false); setSoundError(null);
    } catch {
      audioUnlockedRef.current = false; setAudioBlocked(true);
      setSoundError(fromGesture ? "Tap again to enable sound." : "Tap anywhere to enable sound.");
    }

    const onVis = () => {
      const ref = audioRef.current;
      if (!ref || !soundEnabledRef.current) return;
      if (document.visibilityState === "hidden") {
        for (const t of Object.values(ref.tracks)) t.el.pause();
      } else {
        void ref.ctx.resume();
        for (const t of Object.values(ref.tracks)) void t.el.play();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    audioCleanupRef.current?.();
    audioCleanupRef.current = () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const toggleSound = useCallback(async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false; setSoundEnabled(false);
      await stopAudio(); return;
    }
    soundEnabledRef.current = true; setSoundEnabled(true);
    await enableAudio(true);
  }, [stopAudio, enableAudio]);

  /* ── auto-unlock on first gesture */
  useEffect(() => {
    if (!isReady || !soundEnabled || audioUnlockedRef.current) return;
    let disposed = false;
    void enableAudio(false);
    const unlock = () => { if (!disposed && !audioUnlockedRef.current && soundEnabledRef.current) void enableAudio(true); };
    const evts: (keyof WindowEventMap)[] = ["pointerdown","touchstart","keydown","wheel"];
    evts.forEach(e => window.addEventListener(e, unlock, { once: true, passive: true }));
    return () => { disposed = true; evts.forEach(e => window.removeEventListener(e, unlock)); };
  }, [isReady, soundEnabled, enableAudio]);

  /* ── canvas size: 4K-aware */
  const setCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = ctxRef.current ?? canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    // Support true 4K: allow up to 3× DPR (covers 4K screens ~2.77× + some headroom)
    const dpr = clamp(window.devicePixelRatio || 1, 1, 3);

    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width  = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }, []);

  /* ── main init effect */
  useEffect(() => {
    let rafId = 0;
    let didCancel = false;
    let prevScrollY = window.scrollY;
    let lastTime = performance.now();

    const getImg = (gf: number) => {
      const s = (() => {
        const meta = seqMetaRef.current;
        if (!meta.length || totalFramesRef.current <= 0) return null;
        const frame = clamp(Math.round(gf), 0, totalFramesRef.current - 1);
        let si = 0;
        for (let i = 0; i < meta.length; i++) {
          if (frame >= meta[i].start && frame < meta[i].start + meta[i].count) { si = i; break; }
        }
        return { si, local: frame - meta[si].start };
      })();
      if (!s) return null;
      return imagesRef.current[s.si]?.[s.local] ?? null;
    };

    const renderFrame = (frame: number) => {
      const ctx = ctxRef.current; if (!ctx) return;
      const img = getImg(frame); if (!img) return;
      drawCover(ctx, img, window.innerWidth, window.innerHeight);
      lastDrawnRef.current = Math.round(frame);
    };

    const updateTarget = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0 || totalFramesRef.current <= 1) { targetFrameRef.current = 0; return; }
      const progress = clamp(window.scrollY / maxScroll, 0, 1);
      targetFrameRef.current = progress * (totalFramesRef.current - 1);
    };

    const preloadAll = async (imgs: HTMLImageElement[]) => {
      const total = imgs.length;
      setLoadState({ total, loaded: 0 });
      if (!total) return;
      let loaded = 0;
      await new Promise<void>(resolve => {
        const done = async (img: HTMLImageElement) => {
          if (didCancel) return;
          if (typeof img.decode === "function") { try { await img.decode(); } catch { /* ok */ } }
          loaded++;
          setLoadState(s => ({ ...s, loaded }));
          if (loaded >= total) resolve();
        };
        for (const img of imgs) {
          if (img.complete && img.naturalWidth > 0) void done(img);
          else { img.onload = () => void done(img); img.onerror = () => void done(img); }
        }
      });
    };

    const init = async () => {
      try {
        const res = await fetch("/api/frames");
        if (!res.ok) throw new Error(`Failed to load frames (${res.status})`);
        const data: ApiResponse = await res.json();
        if (!data.sequences?.length) throw new Error("No sequences returned by /api/frames");

        const meta: SequenceMeta[] = [];
        let start = 0;
        for (const seq of data.sequences) { meta.push({ ...seq, start }); start += seq.count; }
        seqMetaRef.current = meta;
        totalFramesRef.current = typeof data.totalFrames === "number" ? data.totalFrames : start;

        // Instead of pure jumping, map scroll mathematically to total frames but give it huge height
        const PX_PER_FRAME = 30; // Increasing px per frame stretches out the scroll area, meaning the user has to scroll more to move one frame (smoother)
        const totalHeight = window.innerHeight + totalFramesRef.current * PX_PER_FRAME;
        setPageHeightPx(totalHeight);

        imagesRef.current = data.sequences.map(seq =>
          seq.files.map(file => {
            const img = new Image();
            img.decoding = "async";
            img.src = `/image/${seq.folder}/${file}`;
            return img;
          })
        );

        await preloadAll(imagesRef.current.flat());
        if (didCancel) return;

        setCanvasSize();
        updateTarget();
        currentFrameRef.current = targetFrameRef.current;
        velocityRef.current = 0;
        renderFrame(currentFrameRef.current);
        setIsReady(true);

        const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
        
        // We will switch to a much smoother LERP instead of spring if the user feels jumping
        // A low lerp factor ensures the camera floats to the target rather than snapping
        const LERP_FACTOR = prefersReduced ? 1.0 : 0.045; // 4.5% distance per frame (very buttery)

        const onScroll = () => {
          updateTarget();
        };
        const onResize = () => {
          setCanvasSize();
          const totalHeight = window.innerHeight + totalFramesRef.current * PX_PER_FRAME;
          setPageHeightPx(totalHeight);
          renderFrame(currentFrameRef.current);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);

        const tick = (now: number) => {
          const dt = Math.min((now - lastTime) / (1000 / 60), 4); // cap delta at 4 frames
          lastTime = now;

          const target   = targetFrameRef.current;
          const current  = currentFrameRef.current;
          
          // LERP integration (smooth approach towards target without spring jumping)
          currentFrameRef.current = lerp(current, target, LERP_FACTOR * dt);

          const rounded = clamp(Math.round(currentFrameRef.current), 0, totalFramesRef.current - 1);
          if (rounded !== lastDrawnRef.current) renderFrame(rounded);

          // Adaptive soundscape
          if (soundEnabledRef.current && audioUnlockedRef.current && audioRef.current?.enabled) {
            const mix = getMix(rounded);
            for (const tc of TRACKS) {
              const track = audioRef.current.tracks[tc.id];
              if (!track) continue;
              const vol = (mix?.[tc.id] ?? 0) * tc.baseVolume;
              const t = audioRef.current.ctx.currentTime;
              track.gain.gain.setTargetAtTime(vol, t, 0.12);
            }

            // One-shot SFX on scene entry
            const seq = getSeq(rounded);
            const sceneLabels = ["forest","rain","deer","panther"] as const;
            const sceneId = seq ? (sceneLabels[seq.si] ?? null) : null;
            if (sceneId && sceneId !== lastSceneIdRef.current && seq && seq.progress > 0.15) {
              lastSceneIdRef.current = sceneId;
              const sfxList = SFX_MAP[sceneId] ?? [];
              if (sfxList.length) {
                const src = sfxList[Math.floor(Math.random() * sfxList.length)];
                const ctx = audioRef.current.ctx;
                const master = audioRef.current.master;
                (async () => {
                  try {
                    if (!sfxCacheRef.current[src]) {
                      const resp = await fetch(src);
                      if (!resp.ok) return;
                      sfxCacheRef.current[src] = await ctx.decodeAudioData(await resp.arrayBuffer());
                    }
                    const node = ctx.createBufferSource();
                    node.buffer = sfxCacheRef.current[src];
                    const g = ctx.createGain(); g.gain.value = 0.62;
                    node.connect(g); g.connect(master);
                    node.start();
                  } catch { /* sfx missing — ignore */ }
                })();
              }
            }
          }

          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        return () => {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onResize);
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to initialize animation";
        setLoadState({ total: 0, loaded: 0, error: msg });
      }
    };

    let cleanup: undefined | (() => void);
    init().then(c => { cleanup = c; });

    return () => {
      didCancel = true;
      cancelAnimationFrame(rafId);
      audioCleanupRef.current?.();
      cleanup?.();
    };
  }, [setCanvasSize, getMix, getSeq]);

  /* ─────────── render */
  return (
    <div style={{ height: pageHeightPx ? `${pageHeightPx}px` : "100vh" }}>
      {/* 4K canvas */}
      <canvas
        ref={canvasRef}
        className={`fixed top-0 left-0 w-full h-full transition-opacity duration-700 ${isReady ? "opacity-100" : "opacity-0"}`}
      />

      {/* Vignette */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={vignetteStyle} />

      {/* Loader */}
      {!isReady && (
        <Loader
          loaded={loadState.loaded}
          total={loadState.total}
          error={loadState.error}
          soundEnabled={soundEnabled}
          audioBlocked={audioBlocked}
          soundError={soundError}
          onToggleSound={() => void toggleSound()}
        />
      )}

      {/* Sound toggle (post-load) */}
      {isReady && (
        <button
          type="button"
          onClick={() => void toggleSound()}
          className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-md hover:bg-black/50 transition-all"
        >
          <span>{soundEnabled ? (audioBlocked ? "🔇" : "🔊") : "🔕"}</span>
          {soundEnabled ? (audioBlocked ? "Tap for sound" : "Sound on") : "Sound off"}
        </button>
      )}
    </div>
  );
}
