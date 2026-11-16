import { describe, expect, it } from 'vitest';
import { nextSpeed, resolveSentenceAudio, textForSpeed } from './speedLadder';
import type { AudioManifest } from '@/content/schema';

const file = (sentenceId: string, speed: 'slow' | 'natural' | 'native') => ({ sentenceId, speed, duration: 1, hash: 'h', bytes: 1 });
const manifest: AudioManifest = {
  packId: 'p', packVersion: 1, generatedAt: '', words: {}, full: null,
  files: {
    's001.natural.mp3': file('s001', 'natural'),
    's001.native.mp3': file('s001', 'native'),
    's002.natural.mp3': file('s002', 'natural'),
    's003.slow.mp3': file('s003', 'slow'),
  },
};

describe('Speed Ladder', () => {
  it('uses the recorded file for that speed when it exists', () => {
    expect(resolveSentenceAudio(manifest, 's001', 'native')).toEqual({ file: 's001.native.mp3', playbackRate: 1 });
  });
  it('otherwise plays the Natural file faster or slower', () => {
    expect(resolveSentenceAudio(manifest, 's002', 'native')).toEqual({ file: 's002.natural.mp3', playbackRate: 1.2 });
    expect(resolveSentenceAudio(manifest, 's002', 'slow')).toEqual({ file: 's002.natural.mp3', playbackRate: 0.75 });
    expect(resolveSentenceAudio(manifest, 's003', 'natural')).toEqual({ file: 's003.slow.mp3', playbackRate: 1.33 });
  });
  it('returns null when nothing is recorded (→ device voice fallback)', () => {
    expect(resolveSentenceAudio(manifest, 's009', 'slow')).toBeNull();
    expect(resolveSentenceAudio(null, 's001', 'slow')).toBeNull();
  });
  it('native speed speaks the contracted text', () => {
    const s = { text: "I'm going to show you.", nativeText: "I'm gonna show you." };
    expect(textForSpeed(s, 'slow')).toBe("I'm going to show you.");
    expect(textForSpeed(s, 'native')).toBe("I'm gonna show you.");
    expect([nextSpeed('slow'), nextSpeed('natural'), nextSpeed('native')]).toEqual(['natural', 'native', 'slow']);
  });
});
