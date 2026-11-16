import type { Speed } from '@/types';
import type { StoryPack } from '@/content/loader';
import type { StorySentence } from '@/content/schema';
import { SPEAKER_VOICES, type VoiceProfile } from '@/config/npcVoices';
import { resolveSentenceAudio, textForSpeed, TTS_RATE } from './speedLadder';
import { speak, type SpeakHandle } from './tts';

// 이야기 음성 재생기.
//  1) audio-manifest.json 에 녹음 파일이 있으면 그것을 재생 (배속 시 음높이 유지)
//  2) 없으면 기기 음성(Web Speech)으로 대체 → 오디오를 넣기 전에도 게임이 돌아간다
// 재생된 시간은 "누적 듣기 시간(Input Hours)"으로 보고한다.

export type PlayHandle = SpeakHandle;

let sharedAudio: HTMLAudioElement | null = null;
let current: PlayHandle | null = null;
let inputListener: (seconds: number) => void = () => {};
let voiceVolume = 1;

/** 들은 시간을 받을 곳(세이브 저장소)을 연결한다. */
export function setInputListener(fn: (seconds: number) => void): void {
  inputListener = fn;
}

export function setVoiceVolume(v: number): void {
  voiceVolume = Math.max(0, Math.min(1, v));
  if (sharedAudio) sharedAudio.volume = voiceVolume;
}

function audioSupported(): boolean {
  return typeof Audio !== 'undefined' && import.meta.env.MODE !== 'test';
}

/** 하나의 <audio> 요소를 계속 재사용한다 → 모바일 자동재생 제한과 잠금 화면 컨트롤(Media Session)에 유리 */
export function getAudioElement(): HTMLAudioElement | null {
  if (!audioSupported()) return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
    (sharedAudio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  }
  return sharedAudio;
}

function playFile(url: string, rate: number): PlayHandle {
  const el = getAudioElement();
  let finish: (ok: boolean) => void = () => {};
  const done = new Promise<boolean>((resolve) => { finish = resolve; });
  if (!el) {
    finish(false);
    return { done, stop: () => {} };
  }
  const cleanup = () => {
    el.removeEventListener('ended', onEnd);
    el.removeEventListener('error', onError);
  };
  const onEnd = () => { cleanup(); finish(true); };
  const onError = () => { cleanup(); finish(false); };
  el.addEventListener('ended', onEnd);
  el.addEventListener('error', onError);
  el.src = url;
  el.playbackRate = rate;
  el.volume = voiceVolume;
  el.play().catch(onError);
  return { done, stop: () => { cleanup(); el.pause(); finish(false); } };
}

/** 재생 시간을 재서 듣기 시간으로 보고하는 래퍼 */
function tracked(handle: PlayHandle, track: boolean): PlayHandle {
  const started = Date.now();
  const done = handle.done.then((ok) => {
    if (track) {
      const seconds = (Date.now() - started) / 1000;
      // 비정상적으로 긴 값(탭이 잠든 경우 등)은 버린다.
      if (seconds > 0.2 && seconds < 120) inputListener(seconds);
    }
    return ok;
  });
  return { done, stop: handle.stop };
}

function start(make: () => PlayHandle, track: boolean): PlayHandle {
  current?.stop();
  const handle = tracked(make(), track);
  current = handle;
  void handle.done.then(() => { if (current === handle) current = null; });
  return handle;
}

export function stopAll(): void {
  current?.stop();
  current = null;
}

export function playSentence(pack: StoryPack, sentence: StorySentence, speed: Speed): PlayHandle {
  const resolved = resolveSentenceAudio(pack.manifest, sentence.id, speed);
  const voice = SPEAKER_VOICES[sentence.speaker] ?? (SPEAKER_VOICES.narrator as VoiceProfile);
  const fallback = () => speak(textForSpeed(sentence, speed), { rate: TTS_RATE[speed], volume: voiceVolume, voice });
  return start(() => {
    if (!resolved || !audioSupported()) return fallback();
    const file = playFile(`${pack.baseUrl}audio/${resolved.file}?v=${pack.meta.version}`, resolved.playbackRate);
    // 파일 재생에 실패하면(오프라인·삭제됨) 기기 음성으로 넘어간다.
    let inner: PlayHandle = file;
    let stopped = false;
    const done = file.done.then((ok) => {
      if (ok || stopped) return ok;
      inner = fallback();
      return inner.done;
    });
    return { done, stop: () => { stopped = true; inner.stop(); } };
  }, true);
}

/** 단어 하나 들려주기 (듣기 시간에는 넣지 않는다) */
export function playWord(pack: StoryPack | null, word: string, speed: Speed = 'slow'): PlayHandle {
  const info = pack?.manifest?.words[word];
  const voice = SPEAKER_VOICES.narrator as VoiceProfile;
  return start(() => {
    if (pack && info && audioSupported()) return playFile(`${pack.baseUrl}audio/${info.file}?v=${pack.meta.version}`, 1);
    return speak(word, { rate: TTS_RATE[speed], volume: voiceVolume, voice });
  }, false);
}

/** NPC·멘토의 말 (녹음 파일이 없는 즉석 문장) */
export function speakLine(text: string, voice: VoiceProfile, speed: Speed, countAsInput = true): PlayHandle {
  return start(() => speak(text, { rate: TTS_RATE[speed], volume: voiceVolume, voice }), countAsInput);
}

/**
 * Bedtime Listening 용 전체 낭독 파일(full.natural.mp3) 재생.
 * 실제 오디오 파일이므로 화면이 꺼져도 이어서 재생된다. 파일이 없으면 null.
 */
export function playFullStory(pack: StoryPack): PlayHandle | null {
  const full = pack.manifest?.full;
  if (!full || !audioSupported()) return null;
  current?.stop();
  const started = Date.now();
  const inner = playFile(`${pack.baseUrl}audio/${full.file}?v=${pack.meta.version}`, 1);
  const done = inner.done.then((ok) => {
    // 탭이 잠들어 시간이 부풀려지지 않도록 파일 길이를 넘지 않게 한다.
    const seconds = Math.min((Date.now() - started) / 1000, full.duration + 2);
    if (seconds > 0.2) inputListener(seconds);
    return ok;
  });
  const handle = { done, stop: inner.stop };
  current = handle;
  return handle;
}

/** 전체 낭독 재생 중 현재 위치(초) */
export function fullStoryTime(): number {
  return sharedAudio?.currentTime ?? 0;
}
