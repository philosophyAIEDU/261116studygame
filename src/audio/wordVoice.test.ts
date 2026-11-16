import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { englishVoices, loadEnglishVoices, playQuestWord, stopWordVoice } from './wordVoice';

function voice(name: string, lang: string): SpeechSynthesisVoice { return { name, lang, voiceURI: name, default: false, localService: true }; }
class Utterance {
  voice: SpeechSynthesisVoice | null = null; lang = ''; pitch = 2; rate = 2; volume = 1;
  onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
function synth(voices: SpeechSynthesisVoice[], autoEnd = true) {
  const events = new EventTarget();
  const value = { voices, getVoices: () => value.voices, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), cancel: vi.fn(),
    speak: vi.fn((utterance: Utterance) => { if (autoEnd) setTimeout(() => utterance.onend?.(), 5); }), dispatchEvent: events.dispatchEvent.bind(events) };
  vi.stubGlobal('speechSynthesis', value); vi.stubGlobal('SpeechSynthesisUtterance', Utterance); return value;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { stopWordVoice(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('natural English word audio', () => {
  it('rejects non-English voices and prefers a natural US voice', () => {
    const voices = englishVoices([voice('Korean default', 'ko-KR'), voice('Basic UK', 'en-GB'), voice('Microsoft Jenny Natural', 'en-US')]);
    expect(voices.map((v) => v.name)).toEqual(['Microsoft Jenny Natural', 'Basic UK']);
  });
  it('waits for late-loaded English voices instead of speaking with the Korean default', async () => {
    const engine = synth([voice('Korean default', 'ko-KR')]);
    const handle = playQuestWord('apple', { voiceURI: '' });
    expect(engine.speak).not.toHaveBeenCalled();
    engine.voices.push(voice('Jenny Natural', 'en-US')); engine.dispatchEvent(new Event('voiceschanged'));
    await vi.advanceTimersByTimeAsync(10);
    await expect(handle.done).resolves.toBe(true);
    const spoken = engine.speak.mock.calls[0]![0];
    expect(spoken.pitch).toBe(1); expect(spoken.rate).toBe(0.95); expect(spoken.lang).toBe('en-US'); expect(spoken.voice?.name).toBe('Jenny Natural');
  });
  it('honors the selected English voice and slows speech without raising the pitch', async () => {
    const engine = synth([voice('US', 'en-US'), voice('UK', 'en-GB')]);
    const handle = playQuestWord('journey', { voiceURI: 'UK', slow: true, volume: 0.7 });
    await vi.advanceTimersByTimeAsync(10); await expect(handle.done).resolves.toBe(true);
    expect(engine.speak.mock.calls[0]![0]).toMatchObject({ text: 'journey', pitch: 1, rate: 0.72, volume: 0.7, lang: 'en-GB' });
  });
  it('never reports silent or missing English audio as completed listening', async () => {
    synth([voice('Korean', 'ko-KR')]); const noEnglish = playQuestWord('apple', { voiceURI: '' });
    await vi.advanceTimersByTimeAsync(1801); await expect(noEnglish.done).resolves.toBe(false);
    const engine = synth([voice('US', 'en-US')]); const muted = playQuestWord('apple', { voiceURI: '', volume: 0 });
    await vi.advanceTimersByTimeAsync(1); await expect(muted.done).resolves.toBe(false); expect(engine.speak).not.toHaveBeenCalled();
  });
  it('requires actual audio completion, returns false on errors/timeouts, and supports cancellation', async () => {
    const engine = synth([voice('US', 'en-US')], false);
    const failed = playQuestWord('apple', { voiceURI: '' }); await vi.advanceTimersByTimeAsync(1); engine.speak.mock.calls[0]![0].onerror?.(); await expect(failed.done).resolves.toBe(false);
    const timeout = playQuestWord('cat', { voiceURI: '' }); await vi.advanceTimersByTimeAsync(15001); await expect(timeout.done).resolves.toBe(false);
    const cancelled = playQuestWord('car', { voiceURI: '' }); cancelled.stop(); await expect(cancelled.done).resolves.toBe(false);
  });
  it('returns no voices when speech synthesis is unavailable', async () => {
    vi.stubGlobal('speechSynthesis', undefined); await expect(loadEnglishVoices()).resolves.toEqual([]);
  });
});
