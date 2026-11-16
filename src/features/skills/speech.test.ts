import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenOnce, recordClip } from './speech';

class FakeRecognition {
  static latest: FakeRecognition;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { FakeRecognition.latest = this; }
  start() {}
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('speech failures and microphone cleanup', () => {
  it('resolves a permission/network error and clears timers even when onend is absent', async () => {
    vi.useFakeTimers(); vi.stubGlobal('SpeechRecognition', FakeRecognition);
    const handle = listenOnce();
    FakeRecognition.latest.onerror?.({ error: 'not-allowed' });
    await expect(handle.result).resolves.toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not leave a timeout after recognition start fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('SpeechRecognition', class extends FakeRecognition { override start() { throw new Error('unavailable'); } });
    await expect(listenOnce().result).resolves.toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('releases the microphone if the recorder cannot initialize', async () => {
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    vi.stubGlobal('MediaRecorder', class { constructor() { throw new Error('codec unavailable'); } });
    await expect(recordClip(10).clip).resolves.toBeNull();
    expect(stop).toHaveBeenCalledOnce();
  });
});
