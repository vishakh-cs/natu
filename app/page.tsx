"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  { id: "wind",      label: "Wind",     trackSrc: "/audio/wind.wav",     baseVolume: 0.38 },
];

// Per-sequence sound profiles — rain always ≥ 0.55 so it's a constant bed
const PROFILES: SoundProfile[] = [
  { rain: 0.70, forest: 0.90, wildlife: 0.40, cinematic: 0.30, panther: 0.00 }, // scene 0 – forest/rain
  { rain: 0.80, forest: 0.50, wildlife: 0.30, cinematic: 0.50, panther: 0.00 }, // scene 1 – rain dominant
  { rain: 0.60, forest: 0.80, wildlife: 0.90, cinematic: 0.35, panther: 0.00, wind: 0.10 }, // scene 2 – wildlife
  { rain: 0.55, forest: 0.40, wildlife: 0.20, cinematic: 0.75, panther: 0.90, wind: 0.20 }, // scene 3 – panther/cinema
  { rain: 0.20, forest: 0.10, wildlife: 0.50, cinematic: 0.40, panther: 0.40, wind: 0.85 }, // scene 4 – desert (frame5)
  { rain: 0.60, forest: 0.50, wildlife: 0.30, cinematic: 0.30, panther: 0.10, wind: 0.20 }, // scene 5 – return (frame6)
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
  onToggleSound,
}: {
  loaded: number;
  total: number;
  error?: string;
  soundEnabled: boolean;
  audioBlocked: boolean;
  onToggleSound: () => void;
}) {
  const progressPct = total ? clamp((loaded / total) * 100, 0, 100) : 5;

  return (
    <div className="loader-root">
      <div className="loader-bg-simple" />
      
      <div className="flex flex-col items-center gap-8 relative z-10 w-full max-w-xs px-6">
        {/* Simple Minimalist Loader */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <motion.div 
            className="absolute inset-0 border-t-2 border-primary-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute inset-2 border-r-2 border-[#a3e0b8] opacity-50 rounded-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <span className="font-oswald text-lg font-bold tracking-widest text-[#a3e0b8]">
            {Math.round(progressPct)}%
          </span>
        </div>

        <div className="text-center">
          <h1 className="font-oswald text-2xl tracking-[0.4em] text-white uppercase font-bold mb-2">
            NATURALIS
          </h1>
          <p className="font-inter text-[10px] tracking-[0.5em] text-white/40 uppercase font-light">
            {error ? "Loading Failed" : "Synchronizing Ecosystem"}
          </p>
        </div>

        {error ? (
          <div className="text-red-400 text-xs border border-red-500/20 bg-red-500/5 px-4 py-2 rounded uppercase tracking-widest">
            {error}
          </div>
        ) : (
          <button
            type="button"
            className="mt-4 flex items-center gap-3 px-6 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] tracking-[0.2em] uppercase text-white hover:bg-white/10 transition-all font-medium"
            onClick={onToggleSound}
          >
            <span>{soundEnabled ? (audioBlocked ? "🔇" : "🔊") : "🔕"}</span>
            {soundEnabled ? (audioBlocked ? "Unlock Audio" : "Music On") : "Music Off"}
          </button>
        )}
      </div>
      
      {/* Bottom status */}
      <div className="absolute bottom-12 left-0 w-full text-center px-12">
        <div className="w-full max-w-md mx-auto h-[1px] bg-white/5">
          <motion.div 
            className="h-full bg-[#a3e0b8]/40" 
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-4 font-inter text-[9px] tracking-[0.3em] uppercase text-white/20">
          Pre-caching 4K Visual Buffer
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OVERLAY DATA & ANIMATIONS
═══════════════════════════════════════════════════════════════════ */
const OVERLAY_DATA = [
  {
    title: "NATURALIS",
    subtitle: "A CINEMATIC JOURNEY",
    description: "Embrace the wild and discover the deepest corners of the forest through 4K optical precision.",
    positionClass: "bottom-[10%] left-[8%] md:bottom-[15%] md:left-[10%]"
  },
  {
    title: "SCARLET MACAW",
    subtitle: "THE TROPICAL CANOPY",
    description: "Vibrant colors piercing through the dense rain-drenched leaves, echoing wild melodies.",
    positionClass: "top-[15%] right-[8%] md:top-[20%] md:right-[10%]"
  },
  {
    title: "POISON DART FROG",
    subtitle: "JEWEL OF THE WETLANDS",
    description: "A tiny but vibrant sentinel of the damp forest floor, holding hidden power.",
    positionClass: "bottom-[15%] right-[8%] md:bottom-[20%] md:right-[10%]"
  },
  {
    title: "BLACK PANTHER",
    subtitle: "THE SHADOW",
    description: "An elusive predator moving unseen in the cinematic darkness of the dense jungle.",
    positionClass: "top-[15%] left-[8%] md:top-[25%] md:left-[10%]"
  },
  {
    title: "WHITE-TAILED DEER",
    subtitle: "GRACEFUL WANDERER",
    description: "Silent footsteps through the ancient trees, embodying the serene heart of nature.",
    positionClass: "bottom-[10%] left-[8%] md:bottom-[15%] md:left-[10%]"
  },
  {
    title: "DESERT NOMADS",
    subtitle: "SAHARA HORIZON",
    description: "The resilient camels traversing the shifting sands under the relentless sun.",
    positionClass: "top-[20%] right-[8%] md:top-[30%] md:right-[12%] items-end text-right"
  }
];

const overlayContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 }
  },
  exit: { opacity: 0, transition: { duration: 0.6 } }
};

const overlayTextVariants = {
  hidden: { y: 40, opacity: 0, filter: "blur(12px)" },
  visible: { y: 0, opacity: 1, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 50, damping: 20 } }
};

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
  const [activeOverlay, setActiveOverlay] = useState(-1);
  const activeOverlayRef = useRef(-1);
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
    const ref = audioRef.current;
    if (ref?.enabled) {
      setAudioBlocked(false); setSoundError(null);
      try {
        if (ref.ctx.state === "suspended") {
          await ref.ctx.resume();
        }
        for (const t of Object.values(ref.tracks)) {
          if (t.el.paused) {
            await t.el.play().catch(() => {});
          }
        }
        audioUnlockedRef.current = true;
      } catch (e) {
        if (fromGesture) { setAudioBlocked(true); setSoundError("Browser blocked sound."); }
      }
      return;
    }

    if (!seqMetaRef.current.length) { return; }
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
      el.crossOrigin = "anonymous";
      const src  = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain); gain.connect(master);
      tracks[tc.id] = { el, src, gain };
    }

    audioRef.current = { ctx, master, tracks, enabled: true };

    try {
      if (ctx.state === "suspended") await ctx.resume();
      for (const tc of TRACKS) {
        await tracks[tc.id].el.play().catch(() => {});
      }
      audioUnlockedRef.current = true; 
      setAudioBlocked(false); setSoundError(null);
    } catch {
      audioUnlockedRef.current = false; 
      setAudioBlocked(true);
    }

    const onVis = () => {
      const currentRef = audioRef.current;
      if (!currentRef || !soundEnabledRef.current) return;
      if (document.visibilityState === "hidden") {
        for (const t of Object.values(currentRef.tracks)) t.el.pause();
      } else {
        if (currentRef.ctx.state === "suspended") void currentRef.ctx.resume();
        for (const t of Object.values(currentRef.tracks)) void t.el.play().catch(() => {});
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

      // Infinite loop: when we reach the last ~80px of scroll, silently scroll back to top
      if (window.scrollY >= maxScroll - 80) {
        // Jump scroll position back to 0 silently (no animation)
        window.scrollTo({ top: 0, behavior: "instant" });
        currentFrameRef.current = 0;
        targetFrameRef.current = 0;
      }
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

          // Update active overlay
          const seqOverlay = getSeq(rounded);
          let currentOverlay = -1;
          if (seqOverlay) {
            const p = seqOverlay.progress;
            if (seqOverlay.si === 0) {
              if (p < 0.35) currentOverlay = 0;
              else if (p > 0.45 && p < 0.95) currentOverlay = 1;
            } else if (seqOverlay.si === 1) {
              if (p > 0.10 && p < 0.95) currentOverlay = 2;
            } else if (seqOverlay.si === 2) {
              if (p > 0.10 && p < 0.95) currentOverlay = 3;
            } else if (seqOverlay.si === 3) {
              if (p > 0.10 && p < 0.95) currentOverlay = 4;
            } else if (seqOverlay.si === 4) {
              if (p > 0.10 && p < 0.95) currentOverlay = 5;
            }
          }
          if (activeOverlayRef.current !== currentOverlay) {
            activeOverlayRef.current = currentOverlay;
            setActiveOverlay(currentOverlay);
          }

          // Adaptive soundscape
          const currentAudio = audioRef.current;
          if (soundEnabledRef.current && audioUnlockedRef.current && currentAudio?.enabled) {
            // Check if context was suspended by browser and try to resume silently if needed
            if (currentAudio.ctx.state === "suspended") {
               currentAudio.ctx.resume().catch(() => {});
            }

            const mix = getMix(rounded);
            for (const tc of TRACKS) {
              const track = currentAudio.tracks[tc.id];
              if (!track) continue;

              // Ensure element is playing if it should be
              if (track.el.paused && audioUnlockedRef.current) {
                track.el.play().catch(() => {});
              }

              const vol = (mix?.[tc.id] ?? 0) * tc.baseVolume;
              const t = currentAudio.ctx.currentTime;
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
                const ctx = currentAudio.ctx;
                const master = currentAudio.master;
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

      {/* ── Navbar ── */}
      {isReady && (
        <motion.nav
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-md">
              <span className="text-white text-[10px] md:text-xs font-bold">N</span>
            </div>
            <span className="font-oswald text-white text-sm md:text-lg tracking-[0.2em] md:tracking-[0.3em] uppercase font-bold drop-shadow-lg">Naturalis</span>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-1.5 md:gap-4">
            <a
              href="#gallery"
              className="group flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/10 bg-black/20 backdrop-blur-md text-white/80 text-[10px] md:text-xs tracking-[0.2em] uppercase font-medium hover:bg-white/10 hover:border-white/30 hover:text-white transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Gallery</span>
            </a>
            <a
              href="#login"
              className="flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white text-[10px] md:text-xs tracking-[0.2em] uppercase font-medium hover:bg-white/20 hover:border-white/40 transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:inline">Login</span>
            </a>
            <button
              type="button"
              onClick={() => void toggleSound()}
              className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/10 hover:border-white/30 hover:text-white transition-all duration-300"
              title={soundEnabled ? "Sound On" : "Sound Off"}
            >
              <span className="text-xs md:text-sm">{soundEnabled ? (audioBlocked ? "🔇" : "🔊") : "🔕"}</span>
            </button>
          </div>
        </motion.nav>
      )}

      {/* Progressively Revealing Text Overlays */}
      <div className="pointer-events-none fixed inset-0 z-20">
        <AnimatePresence mode="wait">
          {activeOverlay >= 0 && OVERLAY_DATA[activeOverlay] && (
            <motion.div
              key={activeOverlay}
              className={`absolute flex flex-col p-6 md:p-10 text-white drop-shadow-2xl max-w-[90vw] ${OVERLAY_DATA[activeOverlay].positionClass}`}
              variants={overlayContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Decorative Line */}
              <motion.div variants={overlayTextVariants} className="w-10 md:w-16 h-[2px] bg-white opacity-60 mb-5" />
              
              <motion.div variants={overlayTextVariants} className="text-[#a3e0b8] font-oswald text-xs md:text-sm tracking-[0.35em] font-medium uppercase mb-2 drop-shadow-md">
                {OVERLAY_DATA[activeOverlay].subtitle}
              </motion.div>
              <motion.h2 variants={overlayTextVariants} className="font-oswald text-5xl md:text-7xl lg:text-8xl font-bold uppercase leading-[0.9] tracking-tight text-white drop-shadow-2xl">
                {OVERLAY_DATA[activeOverlay].title}
              </motion.h2>
              <motion.p variants={overlayTextVariants} className="font-inter text-base md:text-lg lg:text-xl mt-6 opacity-90 max-w-sm md:max-w-md lg:max-w-xl font-light leading-relaxed drop-shadow-lg text-white/95 border-l-[1px] border-white/20 pl-4">
                {OVERLAY_DATA[activeOverlay].description}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loader */}
      {!isReady && (
        <Loader
          loaded={loadState.loaded}
          total={loadState.total}
          error={loadState.error}
          soundEnabled={soundEnabled}
          audioBlocked={audioBlocked}
          onToggleSound={() => void toggleSound()}
        />
      )}
    </div>
  );
}
