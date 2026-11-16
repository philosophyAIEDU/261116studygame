// 단어 문제 전용 음성. 실제 영어 음성이 끝났을 때만 청취 완료로 처리한다.
export function englishVoices(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const quality = (voice: SpeechSynthesisVoice) => (/en[-_]US/i.test(voice.lang) ? 30 : 0) + (/natural|neural|premium|enhanced|google us english|jenny|aria|samantha/i.test(voice.name) ? 20 : 0);
  return voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang)).sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name));
}
export async function loadEnglishVoices(timeout = 1800): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const synth = window.speechSynthesis;
  const initial = englishVoices(synth.getVoices());
  if (initial.length) return initial;
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', changed); resolve(englishVoices(synth.getVoices())); };
    const changed = () => { if (englishVoices(synth.getVoices()).length) done(); };
    const timer = setTimeout(done, timeout);
    synth.addEventListener('voiceschanged', changed);
    changed();
  });
}
let cancelCurrent: (() => void) | null = null;
export function stopWordVoice() { cancelCurrent?.(); cancelCurrent = null; }
export function playQuestWord(word: string, options: { voiceURI: string; slow?: boolean; volume?: number }): { done: Promise<boolean>; stop: () => void } {
  stopWordVoice();
  let settled = false; let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined;
  let resolve: (played: boolean) => void = () => {};
  const done = new Promise<boolean>((r) => { resolve = r; });
  const finish = (played: boolean) => { if (settled) return; settled = true; if (timer) clearTimeout(timer); resolve(played); };
  const stop = () => { cancelled = true; finish(false); if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  cancelCurrent = stop;
  void loadEnglishVoices().then((voices) => {
    if (cancelled) return;
    const voice = voices.find((v) => v.voiceURI === options.voiceURI) ?? voices[0];
    if (!voice || typeof SpeechSynthesisUtterance === 'undefined' || (options.volume ?? 1) <= 0) { finish(false); return; }
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.voice = voice; utterance.lang = voice.lang;
    utterance.pitch = 1; utterance.rate = options.slow ? 0.72 : 0.95; utterance.volume = options.volume ?? 1;
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    timer = setTimeout(() => { finish(false); window.speechSynthesis.cancel(); }, 15000);
    try { window.speechSynthesis.speak(utterance); } catch { finish(false); }
  }).catch(() => finish(false));
  return { done, stop };
}
