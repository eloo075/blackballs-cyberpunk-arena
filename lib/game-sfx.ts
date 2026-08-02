/** Lightweight Web Audio — crash, flip, arena feedback. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, durationMs: number, gain = 0.08, type: OscillatorType = 'square') {
  const ac = getCtx();
  if (!ac) return;
  void ac.resume();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ac.destination);
  const t0 = ac.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durationMs / 1000);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

function noiseBurst(durationMs: number, gain = 0.04) {
  const ac = getCtx();
  if (!ac) return;
  void ac.resume();
  const bufferSize = ac.sampleRate * (durationMs / 1000);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start();
}

export function playCashOutSound(multiplier: number) {
  if (multiplier >= 8) {
    beep(880, 120, 0.1);
    setTimeout(() => beep(1175, 150, 0.1), 100);
    setTimeout(() => beep(1568, 200, 0.12), 220);
  } else if (multiplier >= 2) {
    beep(660, 100, 0.08);
    setTimeout(() => beep(880, 120, 0.08), 90);
  } else {
    beep(520, 80, 0.06);
  }
}

export function playRugSound() {
  beep(180, 250, 0.1);
}

/** Coin leaves the thumb — whoosh + spin tick. */
export function playFlipStartSound() {
  noiseBurst(180, 0.035);
  beep(620, 55, 0.05, 'triangle');
  setTimeout(() => beep(780, 45, 0.04, 'sine'), 60);
}

/** Metallic clink when coin hits the table. */
export function playFlipLandSound() {
  beep(280, 90, 0.1, 'triangle');
  setTimeout(() => beep(420, 70, 0.08, 'sine'), 35);
  setTimeout(() => beep(190, 110, 0.06, 'triangle'), 90);
}

export function playFlipWinSound(big = false) {
  if (big) {
    beep(523, 100, 0.1, 'sine');
    setTimeout(() => beep(659, 120, 0.1, 'sine'), 90);
    setTimeout(() => beep(784, 150, 0.11, 'sine'), 190);
    setTimeout(() => beep(988, 200, 0.1, 'sine'), 320);
  } else {
    beep(660, 90, 0.09, 'sine');
    setTimeout(() => beep(880, 110, 0.09, 'sine'), 85);
    setTimeout(() => beep(1047, 140, 0.08, 'sine'), 180);
  }
}

export function playFlipLoseSound() {
  beep(220, 180, 0.07, 'triangle');
  setTimeout(() => beep(165, 220, 0.06, 'triangle'), 120);
}

/** Premium win sting for result overlay — scales with intensity. */
export function playResultWinSound(intensity: 'normal' | 'big' | 'mega' = 'normal') {
  if (intensity === 'mega') {
    noiseBurst(120, 0.025);
    beep(523, 110, 0.11, 'sine');
    setTimeout(() => beep(659, 130, 0.11, 'sine'), 80);
    setTimeout(() => beep(784, 150, 0.12, 'sine'), 170);
    setTimeout(() => beep(988, 180, 0.11, 'sine'), 280);
    setTimeout(() => beep(1175, 220, 0.1, 'sine'), 420);
  } else if (intensity === 'big') {
    beep(587, 90, 0.1, 'sine');
    setTimeout(() => beep(740, 110, 0.1, 'sine'), 75);
    setTimeout(() => beep(880, 140, 0.1, 'sine'), 160);
    setTimeout(() => beep(1047, 170, 0.09, 'sine'), 270);
  } else {
    beep(660, 85, 0.09, 'sine');
    setTimeout(() => beep(880, 100, 0.08, 'sine'), 70);
    setTimeout(() => beep(988, 130, 0.07, 'sine'), 150);
  }
}

/** Distinct loss thud for result overlay. */
export function playResultLoseSound() {
  beep(140, 200, 0.09, 'triangle');
  setTimeout(() => beep(95, 260, 0.07, 'sawtooth'), 100);
  setTimeout(() => noiseBurst(100, 0.02), 50);
}
