"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Sequence = {
  folder: string;
  count: number;
  files: string[];
};

type ApiResponse = {
  sequences: Sequence[];
  totalFrames?: number;
};

type SequenceMeta = Sequence & { start: number };

type TrackId = "forest" | "rain" | "wildlife" | "panther" | "cinematic";

type SoundTrack = {
  id: string;
  label: string;
  trackSrc: string;
  baseVolume: number;
};

type SoundProfile = Partial<Record<TrackId, number>>;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const equalPower = (t: number) => ({
  from: Math.cos(t * Math.PI * 0.5),
  to: Math.sin(t * Math.PI * 0.5),
});

const SOUND_TRACKS: SoundTrack[] = [
  {
    id: "forest",
    label: "Forest",
    trackSrc: "/audio/forest.wav",
    baseVolume: 0.34,
  },
  {
    id: "rain",
    label: "Rain",
    trackSrc: "/audio/rain.wav",
    baseVolume: 0.28,
  },
  {
    id: "wildlife",
    label: "Wildlife",
    trackSrc: "/audio/wildlife.wav",
    baseVolume: 0.24,
  },
  {
    id: "panther",
    label: "Panther",
    trackSrc: "/audio/panther.wav",
    baseVolume: 0.22,
  },
  {
    id: "cinematic",
    label: "Cinematic",
    trackSrc: "/audio/cinematic.wav",
    baseVolume: 0.26,
  },
];

const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) => {
  const imgWidth = img.naturalWidth || img.width;
  const imgHeight = img.naturalHeight || img.height;
  if (!imgWidth || !imgHeight) return;

  const scale = Math.max(width / imgWidth, height / imgHeight);
  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;

  const dx = (width - scaledWidth) / 2;
  const dy = (height - scaledHeight) / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, dx, dy, scaledWidth, scaledHeight);
};

export default function Landing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imagesRef = useRef<HTMLImageElement[][]>([]);
  const sequenceMetaRef = useRef<SequenceMeta[]>([]);
  const totalFramesRef = useRef(0);
  const targetFrameRef = useRef(0);
  const currentFrameRef = useRef(0);
  const lastDrawnFrameRef = useRef(-1);
  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    tracks: Record<
      string,
      { el: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode }
    >;
    enabled: boolean;
  } | null>(null);
  const audioCleanupRef = useRef<null | (() => void)>(null);
  const lastSceneIdRef = useRef<string | null>(null);
  const audioBufferCacheRef = useRef<Record<string, AudioBuffer>>({});
  const audioUnlockedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [pageHeightPx, setPageHeightPx] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<{
    total: number;
    loaded: number;
    error?: string;
  }>({ total: 0, loaded: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const vignetteStyle = useMemo(
    () => ({
      backgroundImage:
        "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.70) 100%)," +
        "linear-gradient(to top, rgba(0,0,0,0.35), rgba(0,0,0,0) 35%)," +
        "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0) 35%)",
    }),
    []
  );

  const getSoundProfiles = (): SoundProfile[] => {
    const meta = sequenceMetaRef.current;
    if (!meta.length) return [];

    const byIndex: SoundProfile[] = [
      {
        forest: 1,
        wildlife: 0.48,
        rain: 0.1,
        cinematic: 0.32,
      },
      {
        forest: 0.52,
        rain: 1,
        wildlife: 0.18,
        cinematic: 0.45,
      },
      {
        forest: 0.72,
        rain: 0.22,
        wildlife: 1,
        cinematic: 0.38,
      },
      {
        forest: 0.3,
        rain: 0.4,
        wildlife: 0.14,
        panther: 1,
        cinematic: 0.7,
      },
    ];

    return meta.map((_, idx) => byIndex[idx] ?? byIndex[0]);
  };

  const stopAudioPlayback = async () => {
    const ref = audioRef.current;
    audioUnlockedRef.current = false;
    setAudioBlocked(false);
    setSoundError(null);

    if (!ref) return;

    const now = ref.ctx.currentTime;
    for (const track of Object.values(ref.tracks)) {
      track.gain.gain.setTargetAtTime(0, now, 0.05);
      track.el.pause();
      track.el.currentTime = 0;
    }

    try {
      await ref.ctx.suspend();
    } catch {
      // Ignore suspend failures.
    }
  };

  const ensureAudioEnabled = async (fromGesture = false) => {
    if (audioRef.current?.enabled) {
      audioUnlockedRef.current = true;
      setAudioBlocked(false);
      setSoundError(null);
      try {
        await audioRef.current.ctx.resume();
        for (const t of Object.values(audioRef.current.tracks)) {
          // eslint-disable-next-line no-await-in-loop
          await t.el.play();
        }
      } catch {
        if (fromGesture) {
          setAudioBlocked(true);
          setSoundError("This browser is still blocking sound.");
        }
      }
      return;
    }

    if (!sequenceMetaRef.current.length) {
      setSoundError("Sound will be available once loading completes.");
      return;
    }

    setSoundError(null);

    const AudioContextCtor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      setSoundError("Audio not supported in this browser.");
      return;
    }

    const ctx: AudioContext = new AudioContextCtor();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const tracksConfig = SOUND_TRACKS;
    const tracks: Record<
      string,
      { el: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode }
    > = {};

    for (const trackConfig of tracksConfig) {
      const el = new Audio(trackConfig.trackSrc);
      el.loop = true;
      el.preload = "auto";

      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;

      source.connect(gain);
      gain.connect(master);

      tracks[trackConfig.id] = { el, source, gain };
    }

    audioRef.current = { ctx, master, tracks, enabled: true };

    try {
      await ctx.resume();
      for (const trackConfig of tracksConfig) {
        // eslint-disable-next-line no-await-in-loop
        await tracks[trackConfig.id].el.play();
      }
      audioUnlockedRef.current = true;
      setAudioBlocked(false);
      setSoundError(null);
    } catch {
      audioUnlockedRef.current = false;
      setAudioBlocked(true);
      if (fromGesture) {
        setSoundError("Tap again to enable sound.");
      } else {
        setSoundError("Tap anywhere to enable sound.");
      }
    }

    const onVisibility = () => {
      const ref = audioRef.current;
      if (!ref || !soundEnabledRef.current) return;
      if (document.visibilityState === "hidden") {
        for (const t of Object.values(ref.tracks)) t.el.pause();
      } else {
        void ref.ctx.resume();
        for (const t of Object.values(ref.tracks)) void t.el.play();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    audioCleanupRef.current?.();
    audioCleanupRef.current = () =>
      document.removeEventListener("visibilitychange", onVisibility);
  };

  const toggleSound = async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      await stopAudioPlayback();
      return;
    }

    soundEnabledRef.current = true;
    setSoundEnabled(true);
    await ensureAudioEnabled(true);
  };

  useEffect(() => {
    if (!isReady || !soundEnabled || audioUnlockedRef.current) return;

    let isDisposed = false;

    void ensureAudioEnabled(false);

    const unlockAudio = () => {
      if (isDisposed || !soundEnabledRef.current || audioUnlockedRef.current) {
        return;
      }

      void ensureAudioEnabled(true);
    };

    const listeners: Array<keyof WindowEventMap> = [
      "pointerdown",
      "touchstart",
      "keydown",
      "wheel",
    ];

    for (const eventName of listeners) {
      window.addEventListener(eventName, unlockAudio, {
        once: true,
        passive: true,
      });
    }

    return () => {
      isDisposed = true;
      for (const eventName of listeners) {
        window.removeEventListener(eventName, unlockAudio);
      }
    };
  }, [isReady, soundEnabled]);

  useEffect(() => {
    let rafId = 0;
    let didCancel = false;

    const getSequenceAtGlobalFrame = (globalFrame: number) => {
      const meta = sequenceMetaRef.current;
      if (!meta.length || totalFramesRef.current <= 0) return null;

      const frame = clamp(
        Math.round(globalFrame),
        0,
        totalFramesRef.current - 1
      );

      let seqIndex = 0;
      for (let i = 0; i < meta.length; i++) {
        const start = meta[i].start;
        const end = meta[i].start + meta[i].count;
        if (frame >= start && frame < end) {
          seqIndex = i;
          break;
        }
      }

      const local = frame - meta[seqIndex].start;
      const count = meta[seqIndex].count;
      const progress = count <= 1 ? 0 : local / (count - 1);

      return { seqIndex, local, frame, meta: meta[seqIndex], progress };
    };

    const getImageForGlobalFrame = (globalFrame: number) => {
      const seq = getSequenceAtGlobalFrame(globalFrame);
      if (!seq) return null;
      return imagesRef.current[seq.seqIndex]?.[seq.local] ?? null;
    };

    const getMixedProfileForFrame = (globalFrame: number) => {
      const seq = getSequenceAtGlobalFrame(globalFrame);
      const profiles = getSoundProfiles();
      if (!seq || !profiles.length) return null;

      const transitionWindow = 0.18;
      const currentProfile = profiles[seq.seqIndex] ?? {};
      const currentMix: Record<TrackId, number> = {
        forest: currentProfile.forest ?? 0,
        rain: currentProfile.rain ?? 0,
        wildlife: currentProfile.wildlife ?? 0,
        panther: currentProfile.panther ?? 0,
        cinematic: currentProfile.cinematic ?? 0,
      };

      if (seq.progress < transitionWindow && seq.seqIndex > 0) {
        const prevProfile = profiles[seq.seqIndex - 1] ?? {};
        const t = smoothstep(0, transitionWindow, seq.progress);
        const { from, to } = equalPower(t);

        (Object.keys(currentMix) as TrackId[]).forEach((trackId) => {
          currentMix[trackId] =
            (prevProfile[trackId] ?? 0) * from +
            (currentProfile[trackId] ?? 0) * to;
        });
      } else if (
        seq.progress > 1 - transitionWindow &&
        seq.seqIndex < profiles.length - 1
      ) {
        const nextProfile = profiles[seq.seqIndex + 1] ?? {};
        const t = smoothstep(1 - transitionWindow, 1, seq.progress);
        const { from, to } = equalPower(t);

        (Object.keys(currentMix) as TrackId[]).forEach((trackId) => {
          currentMix[trackId] =
            (currentProfile[trackId] ?? 0) * from +
            (nextProfile[trackId] ?? 0) * to;
        });
      }

      // Keep a faint environmental bed alive from first frame to last.
      currentMix.forest = Math.max(currentMix.forest, 0.18);
      currentMix.cinematic = Math.max(currentMix.cinematic, 0.22);

      return currentMix;
    };

    const setCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = ctxRef.current ?? canvas.getContext("2d");
      if (!ctx) return;
      ctxRef.current = ctx;

      const cssWidth = window.innerWidth;
      const cssHeight = window.innerHeight;
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);

      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    };

    const updateTargetFromScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0 || totalFramesRef.current <= 1) {
        targetFrameRef.current = 0;
        return;
      }

      const progress = clamp(window.scrollY / maxScroll, 0, 1);
      targetFrameRef.current = progress * (totalFramesRef.current - 1);
    };

    const renderFrame = (frame: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      const img = getImageForGlobalFrame(frame);
      if (!img) return;

      drawCover(ctx, img, window.innerWidth, window.innerHeight);
      lastDrawnFrameRef.current = Math.round(frame);
    };

    const preloadAll = async (images: HTMLImageElement[]) => {
      const total = images.length;
      setLoadState({ total, loaded: 0 });
      if (!total) return;

      let loaded = 0;
      await new Promise<void>((resolve) => {
        const onOneDone = async (img: HTMLImageElement) => {
          if (didCancel) return;

          if (typeof img.decode === "function") {
            try {
              await img.decode();
            } catch {
              // Ignore decode failures.
            }
          }

          loaded += 1;
          setLoadState((s) => ({ ...s, loaded }));
          if (loaded >= total) resolve();
        };

        for (const img of images) {
          if (img.complete && img.naturalWidth > 0) {
            void onOneDone(img);
          } else {
            img.onload = () => void onOneDone(img);
            img.onerror = () => void onOneDone(img);
          }
        }
      });
    };

    const init = async () => {
      try {
        const res = await fetch("/api/frames");
        if (!res.ok) throw new Error(`Failed to load frames (${res.status})`);

        const data: ApiResponse = await res.json();
        if (!data.sequences?.length) {
          throw new Error("No sequences returned by /api/frames");
        }

        const meta: SequenceMeta[] = [];
        let start = 0;
        for (const seq of data.sequences) {
          meta.push({ ...seq, start });
          start += seq.count;
        }

        sequenceMetaRef.current = meta;
        totalFramesRef.current =
          typeof data.totalFrames === "number" ? data.totalFrames : start;

        const pixelsPerFrame = 10;
        const minHeight = window.innerHeight * 5;
        setPageHeightPx(
          Math.max(
            minHeight,
            window.innerHeight + totalFramesRef.current * pixelsPerFrame
          )
        );

        imagesRef.current = data.sequences.map((seq) =>
          seq.files.map((file) => {
            const img = new Image();
            img.decoding = "async";
            img.src = `/image/${seq.folder}/${file}`;
            return img;
          })
        );

        await preloadAll(imagesRef.current.flat());
        if (didCancel) return;

        setCanvasSize();
        updateTargetFromScroll();
        currentFrameRef.current = targetFrameRef.current;
        renderFrame(currentFrameRef.current);

        setIsReady(true);

        const prefersReducedMotion =
          window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ??
          false;
        const smoothing = prefersReducedMotion ? 1 : 0.12;

        const onScroll = () => updateTargetFromScroll();
        const onResize = () => {
          setCanvasSize();

          const pixelsPerFrame = 10;
          const minHeight = window.innerHeight * 5;
          setPageHeightPx(
            Math.max(
              minHeight,
              window.innerHeight + totalFramesRef.current * pixelsPerFrame
            )
          );

          renderFrame(currentFrameRef.current);
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);

        const tick = () => {
          const target = targetFrameRef.current;
          const current = currentFrameRef.current;
          const next =
            smoothing >= 1 ? target : current + (target - current) * smoothing;

          currentFrameRef.current = next;

          const rounded = clamp(
            Math.round(next),
            0,
            totalFramesRef.current - 1
          );

          if (rounded !== lastDrawnFrameRef.current) renderFrame(rounded);

          // Scene-based soundscape, crossfaded per sequence (if enabled).
          if (
            soundEnabledRef.current &&
            audioUnlockedRef.current &&
            audioRef.current?.enabled
          ) {
            const seq = getSequenceAtGlobalFrame(rounded);
            const mixedProfile = getMixedProfileForFrame(rounded);

            for (const trackConfig of SOUND_TRACKS) {
              const track = audioRef.current.tracks[trackConfig.id];
              if (!track) continue;

              const targetVolume =
                (mixedProfile?.[trackConfig.id as TrackId] ?? 0) *
                trackConfig.baseVolume;
              // Smooth gain changes (avoid zipper noise).
              const now = audioRef.current.ctx.currentTime;
              track.gain.gain.setTargetAtTime(targetVolume, now, 0.08);
            }

            // Optional one-shot SFX on scene entry.
            const sceneIds = ["forest", "rain", "deer", "panther"] as const;
            const sceneId = seq ? sceneIds[seq.seqIndex] ?? null : null;
            if (sceneId && sceneId !== lastSceneIdRef.current && seq) {
              lastSceneIdRef.current = sceneId;

              const sfxByScene: Record<string, string[]> = {
                forest: ["/audio/sfx/forest-birds.wav"],
                rain: ["/audio/sfx/rain-thunder.wav"],
                deer: ["/audio/sfx/deer-step.wav"],
                panther: ["/audio/sfx/panther-growl.wav"],
              };

              const sfxList = sfxByScene[sceneId] ?? [];
              const shouldPlay = seq.progress > 0.2; // avoid firing at boundary

              if (shouldPlay && sfxList.length) {
                const src = sfxList[Math.floor(Math.random() * sfxList.length)];
                const ctx = audioRef.current.ctx;
                const master = audioRef.current.master;

                const play = async () => {
                  try {
                    if (!audioBufferCacheRef.current[src]) {
                      const resp = await fetch(src);
                      if (!resp.ok) return;
                      const buf = await resp.arrayBuffer();
                      const audioBuf = await ctx.decodeAudioData(buf);
                      audioBufferCacheRef.current[src] = audioBuf;
                    }

                    const buffer = audioBufferCacheRef.current[src];
                    const node = ctx.createBufferSource();
                    node.buffer = buffer;

                    const gain = ctx.createGain();
                    gain.gain.value = 0.55;

                    node.connect(gain);
                    gain.connect(master);
                    node.start();
                  } catch {
                    // Ignore missing/invalid SFX files.
                  }
                };

                void play();
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
        const message =
          e instanceof Error ? e.message : "Failed to initialize animation";
        setLoadState({ total: 0, loaded: 0, error: message });
      }
    };

    let cleanup: undefined | (() => void);
    init().then((c) => {
      cleanup = c;
    });

    return () => {
      didCancel = true;
      cancelAnimationFrame(rafId);
      audioCleanupRef.current?.();
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <div style={{ height: pageHeightPx ? `${pageHeightPx}px` : "100vh" }}>
      <canvas
        ref={canvasRef}
        className={`fixed top-0 left-0 w-full h-full transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"}`}
      />

      {/* Progressive dark overlay to the borders */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={vignetteStyle}
      />

      {/* Loader: preload everything first to avoid flicker */}
      {!isReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050B12] text-white">
          <div className="absolute inset-0 bg-gradient-to-b from-[#071A10] via-[#050B12] to-[#03060A]" />
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "radial-gradient(1200px 500px at 50% 20%, rgba(255,255,255,0.06), rgba(255,255,255,0) 60%)," +
                "radial-gradient(900px 450px at 15% 70%, rgba(34,197,94,0.10), rgba(34,197,94,0) 60%)," +
                "radial-gradient(900px 450px at 85% 70%, rgba(59,130,246,0.10), rgba(59,130,246,0) 60%)",
            }}
          />

          <div className="relative w-[min(760px,92vw)] rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-md">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-white/60">
                  Nature • Animals • Moody • Wide
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">
                  Preparing scroll sequence
                </div>
                <div className="mt-2 text-sm text-white/60">
                  Preloading frames for ultra-smooth playback.
                </div>
              </div>

              <svg
                width="140"
                height="80"
                viewBox="0 0 140 80"
                className="opacity-80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 63C26 51 36 46 48 45C58 44 69 49 76 54C89 65 96 67 108 67C121 67 131 61 138 54"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16 65L44 30L64 58L86 24L120 66"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M96 52C101 48 104 45 108 45C112 45 115 48 120 52"
                  stroke="rgba(255,255,255,0.42)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void toggleSound()}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-white/10"
                >
                  {soundEnabled
                    ? audioBlocked
                      ? "Tap For Sound"
                      : "Sound On"
                    : "Sound Off"}
                </button>
                {soundError && (
                  <div className="text-xs text-white/50">{soundError}</div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-white/60">
                <span>
                  {loadState.error
                    ? "Failed to load"
                    : `${loadState.loaded}/${loadState.total || "—"} frames`}
                </span>
                <span>
                  {loadState.total
                    ? `${Math.round((loadState.loaded / loadState.total) * 100)}%`
                    : "…"}
                </span>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 via-lime-300/70 to-sky-400/80 transition-[width] duration-200"
                  style={{
                    width: loadState.total
                      ? `${clamp(
                        (loadState.loaded / loadState.total) * 100,
                        0,
                        100
                      )}%`
                      : "8%",
                  }}
                />
              </div>

              {loadState.error && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
                  {loadState.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isReady && (
        <button
          type="button"
          onClick={() => void toggleSound()}
          className="fixed right-4 top-4 z-40 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-black/40"
        >
          {soundEnabled
            ? audioBlocked
              ? "Tap For Sound"
              : "Sound On"
            : "Sound Off"}
        </button>
      )}
    </div>
  );
}
