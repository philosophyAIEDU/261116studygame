import type { VoiceProfile } from '@/config/npcVoices';

// 기기 음성(Web Speech SpeechSynthesis) 폴백.
// 녹음 파일이 없어도 게임이 진행되도록 한다. 음성이 없는 기기에서는 "읽는 시간"만큼 기다린 뒤 끝난 것으로 본다.

const FEMALE = /(female|samantha|zira|aria|jenny|ava|allison|susan|karen|moira|google us english|michelle|emma)/i;
const MALE = /(male|alex|david|guy|daniel|fred|tom|aaron|mark|james|ryan)/i;

/** 자동 테스트(단위·E2E)에서는 소리를 기다리지 않는다. E2E 는 localStorage 'asq-e2e' = '1' 로 켠다. */
function instant(): boolean {
  if (import.meta.env.MODE === 'test') return true;
  try { return localStorage.getItem('asq-e2e') === '1'; } catch { return false; }
}

export function ttsAvailable(): boolean {
  if (instant()) return false;
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(prefer: 'female' | 'male'): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (voices.length === 0) return null;
  const us = voices.filter((v) => /en[-_]us/i.test(v.lang));
  const pool = us.length > 0 ? us : voices;
  const wanted = pool.find((v) => (prefer === 'female' ? FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, '')) : MALE.test(v.name) && !FEMALE.test(v.name)));
  return wanted ?? pool[0] ?? null;
}

export interface SpeakHandle {
  /** true = 끝까지 재생됨, false = 중간에 멈춤 */
  done: Promise<boolean>;
  stop: () => void;
}

/** 음성이 없을 때 기다리는 시간: 단어당 약 0.38초 */
function readingTimeMs(text: string, rate: number): number {
  if (instant()) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(600, (words * 380) / Math.max(0.5, rate));
}

export function speak(text: string, opts: { rate: number; volume: number; voice: VoiceProfile }): SpeakHandle {
  let finish: (ok: boolean) => void = () => {};
  let settled = false;
  const done = new Promise<boolean>((resolve) => {
    finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
  });

  if (!ttsAvailable()) {
    const timer = setTimeout(() => finish(true), readingTimeMs(text, opts.rate));
    return { done, stop: () => { clearTimeout(timer); finish(false); } };
  }

  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = Math.max(0.5, Math.min(1.6, opts.rate * opts.voice.rate));
  utter.pitch = opts.voice.pitch;
  utter.volume = opts.volume;
  const voice = pickVoice(opts.voice.prefer);
  if (voice) utter.voice = voice;

  // 일부 브라우저(음성이 없는 기기, 헤드리스)는 onend 를 부르지 않는다 → 감시 타이머로 반드시 끝낸다.
  const expected = readingTimeMs(text, utter.rate);
  let watchdog = setTimeout(() => finish(true), import.meta.env.MODE === 'test' ? 0 : 1500);
  utter.onstart = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => finish(true), expected * 2.5 + 4000);
  };
  utter.onend = () => { clearTimeout(watchdog); finish(true); };
  utter.onerror = () => { clearTimeout(watchdog); finish(!voice); };
  try {
    synth.cancel();
    synth.speak(utter);
  } catch {
    finish(true);
  }
  return {
    done,
    stop: () => {
      clearTimeout(watchdog);
      try { synth.cancel(); } catch { /* 무시 */ }
      finish(false);
    },
  };
}
