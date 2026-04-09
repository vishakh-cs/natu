import fs from "node:fs";
import path from "node:path";

const sampleRate = 44100;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const writeWav16Mono = (outPath, floatSamples) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = floatSamples.length * 2;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;

  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // PCM
  buffer.writeUInt16LE(1, offset); offset += 2; // audio format = PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < floatSamples.length; i++) {
    const s = clamp(floatSamples[i], -1, 1);
    const int16 = Math.round(s * 32767);
    buffer.writeInt16LE(int16, offset);
    offset += 2;
  }

  fs.writeFileSync(outPath, buffer);
};

const rng = (seed) => {
  let x = seed >>> 0;
  return () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
};

const onePoleLowpass = (alpha) => {
  let y = 0;
  return (x) => {
    y = y + alpha * (x - y);
    return y;
  };
};

const envAD = (t, attack, decay, dur) => {
  if (t < 0 || t > dur) return 0;
  if (t < attack) return t / attack;
  const dt = t - attack;
  return Math.exp((-dt / decay) * 3);
};

const sine = (phase) => Math.sin(phase * 2 * Math.PI);

const makeForest = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);

  const r = rng(1337);
  const lp = onePoleLowpass(0.03);

  // Random bird chirp events.
  const events = [];
  for (let t = 0.6; t < seconds - 0.8; t += 1.2 + r() * 2.2) {
    events.push({
      time: t,
      dur: 0.18 + r() * 0.18,
      f0: 1800 + r() * 1200,
      f1: 3200 + r() * 1600,
      amp: 0.12 + r() * 0.08,
    });
  }

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;

    // Windy bed: filtered noise + very low sine.
    const n = (r() * 2 - 1) * 0.25;
    const wind = lp(n) * 0.25 + Math.sin(t * 2 * Math.PI * 0.18) * 0.02;

    let birds = 0;
    for (const e of events) {
      const dt = t - e.time;
      if (dt < 0 || dt > e.dur) continue;
      const k = dt / e.dur;
      const f = e.f0 + (e.f1 - e.f0) * k;
      birds += Math.sin(t * 2 * Math.PI * f) * e.amp * envAD(dt, 0.02, 0.12, e.dur);
    }

    // Subtle stereo-ish width illusion via slow AM (still mono).
    const wide = 0.92 + 0.08 * Math.sin(t * 2 * Math.PI * 0.07);

    out[i] = (wind * 0.8 + birds) * wide;
  }

  return out;
};

const makeRain = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  const r = rng(2024);

  // Band-limited noise approximation with two filters.
  const lp1 = onePoleLowpass(0.06);
  const lp2 = onePoleLowpass(0.015);

  // Occasional low thunder-ish rumbles.
  const rumbleTimes = [];
  for (let t = 2.0; t < seconds - 2.5; t += 6 + r() * 8) rumbleTimes.push(t);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const n = r() * 2 - 1;
    const spray = lp1(n) * 0.22;
    const sheet = lp2(n) * 0.35;

    let rumble = 0;
    for (const rt of rumbleTimes) {
      const dt = t - rt;
      if (dt < 0 || dt > 2.2) continue;
      rumble +=
        Math.sin(t * 2 * Math.PI * 38) *
        0.25 *
        envAD(dt, 0.08, 0.9, 2.2);
    }

    out[i] = spray + sheet + rumble;
  }

  return out;
};

const makeWildlife = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  const r = rng(77);
  const lp = onePoleLowpass(0.02);

  // Distant calls (low-mid hoots).
  const events = [];
  for (let t = 1.0; t < seconds - 1.0; t += 3.5 + r() * 4) {
    events.push({
      time: t,
      dur: 0.45 + r() * 0.35,
      f: 280 + r() * 220,
      amp: 0.10 + r() * 0.08,
    });
  }

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const n = (r() * 2 - 1) * 0.18;
    const bed = lp(n) * 0.40 + Math.sin(t * 2 * Math.PI * 0.14) * 0.02;

    let calls = 0;
    for (const e of events) {
      const dt = t - e.time;
      if (dt < 0 || dt > e.dur) continue;
      calls +=
        Math.sin(t * 2 * Math.PI * e.f) *
        e.amp *
        envAD(dt, 0.06, 0.22, e.dur);
    }

    out[i] = bed + calls;
  }

  return out;
};

const makePanther = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  const r = rng(999);
  const lp = onePoleLowpass(0.01);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;

    // Low drone + slow wobble.
    const wobble = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 0.09);
    const drone =
      Math.sin(t * 2 * Math.PI * (52 + wobble * 3)) * 0.25 +
      Math.sin(t * 2 * Math.PI * (104 + wobble * 6)) * 0.10;

    // Breathy texture.
    const noise = lp((r() * 2 - 1) * 0.12) * 0.45;

    out[i] = drone + noise * 0.35;
  }

  return out;
};

const makeCinematic = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  const r = rng(31415);
  const lp = onePoleLowpass(0.012);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const swell = 0.55 + 0.45 * Math.sin(t * 2 * Math.PI * 0.045);
    const fundamental = Math.sin(t * 2 * Math.PI * (48 + swell * 2.5)) * 0.22;
    const octave = Math.sin(t * 2 * Math.PI * (96 + swell * 3.5)) * 0.08;
    const air = lp((r() * 2 - 1) * 0.12) * 0.22;

    out[i] = fundamental + octave + air;
  }

  return out;
};

const makeSfxForestBirds = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const f = 1800 + 2200 * t;
    const e = envAD(t, 0.03, 0.25, seconds);
    out[i] = Math.sin(t * 2 * Math.PI * f) * 0.35 * e;
  }
  return out;
};

const makeSfxThunder = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  const r = rng(123);
  const lp = onePoleLowpass(0.02);
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const e = envAD(t, 0.02, 0.9, seconds);
    const n = lp((r() * 2 - 1) * 0.9);
    const rumble = Math.sin(t * 2 * Math.PI * 42) * 0.22;
    out[i] = (n * 0.6 + rumble) * e;
  }
  return out;
};

const makeSfxDeerStep = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const e = envAD(t, 0.005, 0.12, seconds);
    const thump = Math.sin(t * 2 * Math.PI * 90) * 0.5;
    const click = Math.sin(t * 2 * Math.PI * 1400) * 0.08 * envAD(t, 0.001, 0.03, seconds);
    out[i] = (thump * 0.5) * e + click;
  }
  return out;
};

const makeSfxPantherGrowl = (seconds) => {
  const N = Math.floor(seconds * sampleRate);
  const out = new Float32Array(N);
  const r = rng(456);
  const lp = onePoleLowpass(0.04);
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const e = envAD(t, 0.06, 0.55, seconds);
    const f = 70 + 35 * Math.sin(t * 2 * Math.PI * 0.9);
    const tone = Math.sin(t * 2 * Math.PI * f) * 0.55;
    const grit = lp((r() * 2 - 1) * 0.22) * 0.55;
    out[i] = (tone + grit * 0.35) * e;
  }
  return out;
};

const root = process.cwd();
const audioDir = path.join(root, "public", "audio");
const sfxDir = path.join(audioDir, "sfx");
ensureDir(audioDir);
ensureDir(sfxDir);

writeWav16Mono(path.join(audioDir, "forest.wav"), makeForest(20));
writeWav16Mono(path.join(audioDir, "rain.wav"), makeRain(24));
writeWav16Mono(path.join(audioDir, "wildlife.wav"), makeWildlife(20));
writeWav16Mono(path.join(audioDir, "panther.wav"), makePanther(18));
writeWav16Mono(path.join(audioDir, "cinematic.wav"), makeCinematic(24));

writeWav16Mono(path.join(sfxDir, "forest-birds.wav"), makeSfxForestBirds(1.2));
writeWav16Mono(path.join(sfxDir, "rain-thunder.wav"), makeSfxThunder(2.5));
writeWav16Mono(path.join(sfxDir, "deer-step.wav"), makeSfxDeerStep(0.55));
writeWav16Mono(path.join(sfxDir, "panther-growl.wav"), makeSfxPantherGrowl(1.6));

console.log("Generated audio in public/audio/");
