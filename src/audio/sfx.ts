// 효과음과 BGM — 외부 파일 없이 Web Audio 로 직접 합성한다(저작권·용량 걱정 없음, 오프라인 OK).
// 톤은 docs/ART_BIBLE.md 8절: 짧고 둥근 실로폰·벨 느낌, 틀렸을 때도 불쾌하지 않게.

export type SfxName = 'tap' | 'correct' | 'wrong' | 'levelup' | 'quest' | 'collect' | 'open' | 'star';
export type BgmMood = 'day' | 'sunset' | 'night' | 'story' | 'off';

let ctx: AudioContext | null = null;
let sfxVolume = 0.8;
let bgmVolume = 0.5;
let bgmGain: GainNode | null = null;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmMood: BgmMood = 'off';
let bgmStep = 0;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function note(ac: AudioContext, out: AudioNode, freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

const SFX: Record<SfxName, { f: number; t: number; d: number; type?: OscillatorType }[]> = {
  tap: [{ f: 660, t: 0, d: 0.08 }],
  open: [{ f: 440, t: 0, d: 0.1 }, { f: 660, t: 0.06, d: 0.14 }],
  collect: [{ f: 784, t: 0, d: 0.1 }, { f: 1047, t: 0.07, d: 0.18 }],
  correct: [{ f: 659, t: 0, d: 0.12 }, { f: 880, t: 0.09, d: 0.2 }],
  wrong: [{ f: 220, t: 0, d: 0.18, type: 'triangle' }],
  star: [{ f: 1175, t: 0, d: 0.12 }, { f: 1568, t: 0.08, d: 0.25 }],
  quest: [{ f: 523, t: 0, d: 0.15 }, { f: 659, t: 0.12, d: 0.15 }, { f: 784, t: 0.24, d: 0.15 }, { f: 1047, t: 0.36, d: 0.4 }],
  levelup: [{ f: 523, t: 0, d: 0.14 }, { f: 659, t: 0.1, d: 0.14 }, { f: 784, t: 0.2, d: 0.14 }, { f: 1047, t: 0.3, d: 0.2 }, { f: 1319, t: 0.45, d: 0.2 }, { f: 1568, t: 0.6, d: 0.6 }],
};

export function playSfx(name: SfxName): void {
  const ac = audio();
  if (!ac || sfxVolume <= 0) return;
  const now = ac.currentTime;
  for (const n of SFX[name]) note(ac, ac.destination, n.f, now + n.t, n.d, 0.22 * sfxVolume, n.type ?? 'sine');
}

// 분위기별 음계(펜타토닉). 밤에는 더 낮고 느리게.
const MOODS: Record<Exclude<BgmMood, 'off'>, { scale: number[]; beatMs: number }> = {
  day: { scale: [262, 294, 330, 392, 440, 523], beatMs: 520 },
  sunset: { scale: [220, 262, 294, 330, 392, 440], beatMs: 640 },
  night: { scale: [165, 196, 220, 247, 294, 330], beatMs: 900 },
  story: { scale: [196, 247, 294, 330, 392, 494], beatMs: 760 },
};

function tick(): void {
  const ac = audio();
  if (!ac || !bgmGain || bgmMood === 'off') return;
  const mood = MOODS[bgmMood];
  const pattern = [0, 2, 4, 2, 3, 5, 4, 1];
  const idx = pattern[bgmStep % pattern.length] ?? 0;
  const freq = mood.scale[idx] ?? 262;
  note(ac, bgmGain, freq, ac.currentTime, (mood.beatMs / 1000) * 1.8, 0.1, 'sine');
  if (bgmStep % 4 === 0) note(ac, bgmGain, (mood.scale[0] ?? 262) / 2, ac.currentTime, (mood.beatMs / 1000) * 3.6, 0.09, 'triangle');
  bgmStep++;
}

export function setBgm(mood: BgmMood): void {
  if (mood === bgmMood) return;
  bgmMood = mood;
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;
  const ac = audio();
  if (!ac || mood === 'off') return;
  if (!bgmGain) {
    bgmGain = ac.createGain();
    bgmGain.connect(ac.destination);
  }
  bgmGain.gain.value = bgmVolume * 0.5;
  bgmTimer = setInterval(tick, MOODS[mood].beatMs);
}

export function setSfxVolume(v: number): void {
  sfxVolume = Math.max(0, Math.min(1, v));
}

export function setBgmVolume(v: number): void {
  bgmVolume = Math.max(0, Math.min(1, v));
  if (bgmGain) bgmGain.gain.value = bgmVolume * 0.5;
}
