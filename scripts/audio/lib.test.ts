// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildTodo, hasFfmpeg, importPack, inspectPack, listPackIds, parseAudioFileName, readManifest, textForSpeed, wordFileName } from './lib';

const PACK = 'test-pack';
let root = '';

function writePack(dir: string) {
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'pack.json'),
    JSON.stringify({ id: PACK, title: 'Test', stage: 'elementary', level: 1, order: 1, theme: 'daily', version: 3, speeds: ['slow', 'natural', 'native'], cover: 'T' }),
  );
  fs.writeFileSync(
    path.join(dir, 'story.json'),
    JSON.stringify({
      packId: PACK, title: 'Test', level: 1,
      scenes: [{ id: 'sc01', image: 'images/sc01.svg', place: 'classroom', objects: [] }],
      sentences: [
        { id: 's001', sceneId: 'sc01', speaker: 'narrator', voiceStyle: 'calm', text: 'Mina has a red ball.' },
        { id: 's002', sceneId: 'sc01', speaker: 'girl', voiceStyle: 'excited', text: 'I am going to play!', nativeText: "I'm gonna play!" },
      ],
      words: [{ word: 'ball', easyEnglish: 'a round toy', imageKey: 'ball', emoji: 'o' }],
      phrasePocket: ['I am going to play!'],
      talk: { npc: 'leo', scene: 'Play time.', opener: 'Hi!' },
    }),
  );
}

function tone(file: string, seconds: number) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`, file]);
  if (r.status !== 0) throw new Error('could not make fixture audio');
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'asq-audio-'));
  writePack(path.join(root, 'content', 'packs', PACK));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('file name rules', () => {
  it('parses {sentenceId}.{speed}.{ext}', () => {
    expect(parseAudioFileName('s001.natural.mp3')).toEqual({ sentenceId: 's001', speed: 'natural', ext: 'mp3' });
    expect(parseAudioFileName('s012.native.wav')).toEqual({ sentenceId: 's012', speed: 'native', ext: 'wav' });
    expect(parseAudioFileName('s1.natural.mp3')).toBeNull();
    expect(parseAudioFileName('s001.fast.mp3')).toBeNull();
    expect(parseAudioFileName('s001.natural.ogg')).toBeNull();
  });
  it('uses nativeText only for native speed', () => {
    const s = { text: 'I am going to play!', nativeText: "I'm gonna play!" };
    expect(textForSpeed(s, 'natural')).toBe('I am going to play!');
    expect(textForSpeed(s, 'native')).toBe("I'm gonna play!");
    expect(textForSpeed({ text: 'Hi.' }, 'native')).toBe('Hi.');
    expect(wordFileName('Fall Down')).toBe('fall-down.mp3');
  });
});

describe('audio:todo', () => {
  it('lists every missing sentence × speed, plus words', () => {
    expect(listPackIds(root)).toEqual([PACK]);
    const todo = buildTodo(root, [PACK]);
    expect(todo).toHaveLength(2 * 3 + 1);
    expect(todo.find((t) => t.sentenceId === 's002' && t.speed === 'native')).toEqual({
      kind: 'sentence', packId: PACK, sentenceId: 's002', speed: 'native', text: "I'm gonna play!",
      speaker: 'girl', voiceStyle: 'excited', outPath: `content/packs/${PACK}/audio/s002.native.mp3`,
    });
    expect(todo.at(-1)).toMatchObject({ kind: 'word', text: 'ball', outPath: `content/packs/${PACK}/audio/words/ball.mp3` });
  });
  it('skips files that already exist (any allowed extension) but not empty ones', () => {
    const audio = path.join(root, 'content', 'packs', PACK, 'audio');
    fs.writeFileSync(path.join(audio, 's001.natural.wav'), 'x');
    fs.writeFileSync(path.join(audio, 's001.slow.mp3'), '');
    const todo = buildTodo(root, [PACK]);
    expect(todo.some((t) => t.sentenceId === 's001' && t.speed === 'natural')).toBe(false);
    expect(todo.some((t) => t.sentenceId === 's001' && t.speed === 'slow')).toBe(true);
  });
});

describe('audio:check', () => {
  it('missing audio is only a warning', () => {
    const r = inspectPack(root, PACK);
    expect(r.errors).toEqual([]);
    expect(r.missing).toBe(6);
    expect(r.warnings[0]).toMatch(/not recorded yet/);
  });
  it('bad names, unknown sentences and empty files are errors', () => {
    const audio = path.join(root, 'content', 'packs', PACK, 'audio');
    fs.writeFileSync(path.join(audio, 'hello.mp3'), 'x');
    fs.writeFileSync(path.join(audio, 's099.natural.mp3'), 'x');
    fs.writeFileSync(path.join(audio, 's001.native.mp3'), '');
    const r = inspectPack(root, PACK);
    expect(r.errors).toHaveLength(3);
    expect(importPack(root, PACK).manifest).toBeNull();
  });
});

describe.skipIf(!hasFfmpeg())('audio:import (needs ffmpeg)', () => {
  it('normalizes to mp3, writes the manifest, builds the full story with timestamps, and is idempotent', () => {
    const audio = path.join(root, 'content', 'packs', PACK, 'audio');
    tone(path.join(audio, 's001.natural.wav'), 1);
    tone(path.join(audio, 's002.natural.wav'), 1.5);
    tone(path.join(audio, 's002.native.wav'), 1);
    fs.mkdirSync(path.join(audio, 'words'));
    tone(path.join(audio, 'words', 'ball.mp3'), 0.5);

    const first = importPack(root, PACK);
    expect(first.report.errors).toEqual([]);
    expect(first.processed).toBe(4);
    expect(fs.existsSync(path.join(audio, 's001.natural.wav'))).toBe(false);
    expect(fs.existsSync(path.join(audio, 's001.natural.mp3'))).toBe(true);

    const manifest = readManifest(path.join(root, 'content', 'packs', PACK));
    expect(manifest?.packVersion).toBe(3);
    expect(Object.keys(manifest?.files ?? {}).sort()).toEqual(['s001.natural.mp3', 's002.native.mp3', 's002.natural.mp3']);
    const f = manifest?.files['s002.natural.mp3'];
    expect(f?.speed).toBe('natural');
    expect(f?.duration).toBeGreaterThan(1.2);
    expect(f?.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(manifest?.words.ball?.file).toBe('words/ball.mp3');
    expect(manifest?.full?.generated).toBe(true);
    expect(manifest?.full?.timestamps.map((t) => t.sentenceId)).toEqual(['s001', 's002']);
    expect(manifest?.full?.timestamps[1]?.start).toBeGreaterThan(1.4);
    expect(manifest?.full?.duration).toBeGreaterThan(2.5);

    const before = fs.readFileSync(path.join(root, 'content', 'packs', PACK, 'audio-manifest.json'), 'utf8');
    const second = importPack(root, PACK, new Date(0));
    expect(second.processed).toBe(0);
    expect(fs.readFileSync(path.join(root, 'content', 'packs', PACK, 'audio-manifest.json'), 'utf8')).toBe(before);
    expect(inspectPack(root, PACK).errors).toEqual([]);
    expect(buildTodo(root, [PACK])).toHaveLength(3);
  }, 60000);
});
