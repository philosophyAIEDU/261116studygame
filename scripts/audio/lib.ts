import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { manifestSchema, packMetaSchema, storySchema, SPEED_VALUES, type AudioManifest, type PackMeta, type Story } from '../../src/content/schema';

// 오디오 파이프라인 공용 함수.
// 앱은 특정 TTS 엔진을 모른다. "파일이 규칙대로 놓여 있는가"만 본다.
//   파일명 규칙: {sentenceId}.{slow|natural|native}.{mp3|m4a|wav}   예) s001.natural.mp3
//   단어 발음:   words/{word}.mp3
//   전체 낭독:   full.natural.mp3  (없으면 문장 파일을 이어 붙여 만든다)

export type Speed = (typeof SPEED_VALUES)[number];
export const AUDIO_EXTS = ['mp3', 'm4a', 'wav'] as const;
const FILE_NAME = /^(s\d{3})\.(slow|natural|native)\.(mp3|m4a|wav)$/;
const FULL_NAME = /^full\.natural\.(mp3|m4a|wav)$/;
/** 문장 사이에 넣는 쉼(초) — 전체 낭독을 이어 붙일 때 */
export const SENTENCE_GAP_SECONDS = 0.6;
/** 이보다 긴 무음이 파일 중간에 있으면 경고 */
export const LONG_SILENCE_SECONDS = 2.5;

export interface Pack {
  id: string;
  dir: string;
  meta: PackMeta;
  story: Story;
}

export function packsDir(root: string): string {
  return path.join(root, 'content', 'packs');
}

export function listPackIds(root: string): string[] {
  const dir = packsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((id) => fs.existsSync(path.join(dir, id, 'story.json'))).sort();
}

export function readPack(root: string, id: string): Pack {
  const dir = path.join(packsDir(root), id);
  if (!fs.existsSync(path.join(dir, 'story.json'))) throw new Error(`Pack not found: ${id}`);
  const meta = packMetaSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8')));
  const story = storySchema.parse(JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf8')));
  return { id, dir, meta, story };
}

/** 'all' 또는 팩 id 인자를 팩 목록으로 바꾼다. */
export function resolvePackArg(root: string, arg: string | undefined): string[] {
  if (!arg || arg === 'all') return listPackIds(root);
  return [arg];
}

export function parseAudioFileName(name: string): { sentenceId: string; speed: Speed; ext: string } | null {
  const m = FILE_NAME.exec(name);
  if (!m) return null;
  return { sentenceId: m[1] as string, speed: m[2] as Speed, ext: m[3] as string };
}

/** Native 속도는 구어체 텍스트(nativeText)가 있으면 그것으로 녹음한다. */
export function textForSpeed(sentence: { text: string; nativeText?: string }, speed: Speed): string {
  return speed === 'native' && sentence.nativeText ? sentence.nativeText : sentence.text;
}

export function wordFileName(word: string): string {
  return `${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp3`;
}

function findExisting(audioDir: string, base: string): string | null {
  for (const ext of AUDIO_EXTS) {
    const file = path.join(audioDir, `${base}.${ext}`);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  }
  return null;
}

export interface TodoItem {
  kind: 'sentence' | 'word';
  packId: string;
  sentenceId: string;
  speed: Speed;
  text: string;
  speaker: string;
  voiceStyle: string;
  outPath: string;
}

/** 아직 오디오가 없는 문장·단어 목록. 로컬 TTS 는 이 목록만 읽고 일하면 된다. */
export function buildTodo(root: string, packIds: readonly string[]): TodoItem[] {
  const todo: TodoItem[] = [];
  for (const id of packIds) {
    const pack = readPack(root, id);
    const audioDir = path.join(pack.dir, 'audio');
    const rel = (file: string) => path.relative(root, file).split(path.sep).join('/');
    for (const s of pack.story.sentences) {
      for (const speed of pack.meta.speeds) {
        if (findExisting(audioDir, `${s.id}.${speed}`)) continue;
        todo.push({
          kind: 'sentence', packId: id, sentenceId: s.id, speed, text: textForSpeed(s, speed),
          speaker: s.speaker, voiceStyle: s.voiceStyle, outPath: rel(path.join(audioDir, `${s.id}.${speed}.mp3`)),
        });
      }
    }
    for (const w of pack.story.words) {
      const file = path.join(audioDir, 'words', wordFileName(w.word));
      if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
      todo.push({ kind: 'word', packId: id, sentenceId: `word:${w.word}`, speed: 'natural', text: w.word, speaker: 'narrator', voiceStyle: 'calm', outPath: rel(file) });
    }
  }
  return todo;
}

// ── ffmpeg ───────────────────────────────────────────────────

export function hasFfmpeg(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0 && spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status === 0;
}

export function probeDuration(file: string): number {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const n = Number.parseFloat(r.stdout.trim());
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

/** 파일 안의 가장 긴 무음 길이(초) */
export function longestSilence(file: string): number {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-45dB:d=1', '-f', 'null', '-'], { encoding: 'utf8' });
  let max = 0;
  for (const m of r.stderr.matchAll(/silence_duration: ([0-9.]+)/g)) max = Math.max(max, Number.parseFloat(m[1] ?? '0'));
  return max;
}

/**
 * 형식 통일 + 음량 정규화 + 앞뒤 무음 정리.
 *  - mp3 / mono / 96kbps / 44.1kHz
 *  - loudnorm -16 LUFS (이야기마다 소리 크기가 들쭉날쭉하지 않게)
 *  - silenceremove 를 앞에서 한 번, 뒤집어서(areverse) 한 번 더 → 앞뒤 무음만 잘린다
 */
export function normalizeAudio(input: string, output: string): void {
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05';
  const filter = `${trim},areverse,${trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11`;
  const tmp = `${output}.tmp.mp3`;
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-af', filter, '-ac', '1', '-ar', '44100', '-b:a', '96k', tmp], { encoding: 'utf8' });
  if (r.status !== 0) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`ffmpeg failed for ${path.basename(input)}: ${r.stderr.trim()}`);
  }
  fs.renameSync(tmp, output);
}

/** 문장 파일들을 쉼을 넣어 이어 붙인다. */
export function concatWithGaps(inputs: readonly string[], output: string, gapSeconds: number): void {
  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const f of inputs) args.push('-i', f);
  const parts = inputs.map((_, i) => `[${i}:a]apad=pad_dur=${gapSeconds}[a${i}]`).join(';');
  const chain = inputs.map((_, i) => `[a${i}]`).join('');
  args.push('-filter_complex', `${parts};${chain}concat=n=${inputs.length}:v=0:a=1[out]`, '-map', '[out]', '-ac', '1', '-ar', '44100', '-b:a', '96k', output);
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg concat failed: ${r.stderr.trim()}`);
}

export function hashFile(file: string): string {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}

export function readManifest(packDir: string): AudioManifest | null {
  const file = path.join(packDir, 'audio-manifest.json');
  if (!fs.existsSync(file)) return null;
  const parsed = manifestSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
  return parsed.success ? parsed.data : null;
}

// ── 검사 ────────────────────────────────────────────────────

export interface AudioReport {
  packId: string;
  /** 빌드를 실패시켜야 하는 문제 (이름 규칙 위반, 모르는 문장, 길이 0 …) */
  errors: string[];
  /** 알려만 주는 문제 (아직 녹음 안 됨 …) */
  warnings: string[];
  present: number;
  missing: number;
}

/** audio 폴더를 검사만 한다(파일을 바꾸지 않음). */
export function inspectPack(root: string, id: string): AudioReport {
  const pack = readPack(root, id);
  const audioDir = path.join(pack.dir, 'audio');
  const report: AudioReport = { packId: id, errors: [], warnings: [], present: 0, missing: 0 };
  const ids = new Set(pack.story.sentences.map((s) => s.id));
  if (fs.existsSync(audioDir)) {
    for (const name of fs.readdirSync(audioDir)) {
      const full = path.join(audioDir, name);
      if (name.startsWith('.') || fs.statSync(full).isDirectory()) continue;
      if (FULL_NAME.test(name)) continue;
      const parsed = parseAudioFileName(name);
      if (!parsed) {
        report.errors.push(`${name}: file name must be {sentenceId}.{slow|natural|native}.{mp3|m4a|wav}`);
        continue;
      }
      if (!ids.has(parsed.sentenceId)) report.errors.push(`${name}: sentence ${parsed.sentenceId} is not in story.json`);
      if (fs.statSync(full).size === 0) report.errors.push(`${name}: empty file (0 bytes)`);
    }
  }
  for (const s of pack.story.sentences) {
    for (const speed of pack.meta.speeds) {
      if (findExisting(audioDir, `${s.id}.${speed}`)) report.present++;
      else report.missing++;
    }
  }
  if (report.missing > 0) report.warnings.push(`${report.missing} sentence audio file(s) not recorded yet (the game uses the device voice instead)`);
  const manifest = readManifest(pack.dir);
  if (report.present > 0 && !manifest) report.warnings.push('audio files exist but audio-manifest.json is missing → run: npm run audio:import -- ' + id);
  if (manifest) {
    for (const [name, info] of Object.entries(manifest.files)) {
      const file = path.join(audioDir, name);
      if (!fs.existsSync(file)) report.errors.push(`${name}: listed in audio-manifest.json but the file is gone → run audio:import again`);
      else if (hashFile(file) !== info.hash) report.warnings.push(`${name}: changed after the last import → run audio:import again`);
    }
  }
  return report;
}

// ── import ──────────────────────────────────────────────────

export interface ImportResult {
  report: AudioReport;
  manifest: AudioManifest | null;
  processed: number;
}

/**
 * audio 폴더를 검사하고, ffmpeg 로 정리한 뒤 audio-manifest.json 을 만든다.
 * 이미 처리된 파일(해시가 manifest 와 같은 mp3)은 다시 인코딩하지 않는다 → 여러 번 실행해도 음질이 떨어지지 않는다.
 */
export function importPack(root: string, id: string, now: Date = new Date()): ImportResult {
  const report = inspectPack(root, id);
  // 고쳐야 할 오류(이름 규칙 등)가 있으면 파일을 건드리지 않는다. manifest 누락 오류는 import 로 해결되므로 제외.
  const blocking = report.errors.filter((e) => !e.includes('audio-manifest.json'));
  if (blocking.length > 0) return { report: { ...report, errors: blocking }, manifest: null, processed: 0 };
  if (!hasFfmpeg()) {
    return { report: { ...report, errors: ['ffmpeg / ffprobe not found. Install ffmpeg first (see docs/AUDIO_PIPELINE.md).'] }, manifest: null, processed: 0 };
  }
  const pack = readPack(root, id);
  const audioDir = path.join(pack.dir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const previous = readManifest(pack.dir);
  const warnings: string[] = report.warnings.filter((w) => !w.includes('audio:import'));
  const errors: string[] = [];
  let processed = 0;

  /** 원본(어떤 확장자든) → 정리된 mp3. 이미 정리된 파일이면 그대로 둔다. */
  const prepare = (base: string, prevHash: string | undefined): string | null => {
    const src = findExisting(audioDir, base);
    if (!src) return null;
    const out = path.join(audioDir, `${base}.mp3`);
    if (src === out && prevHash && hashFile(out) === prevHash) return out;
    try {
      normalizeAudio(src, out);
    } catch (e) {
      errors.push((e as Error).message);
      return null;
    }
    if (src !== out) fs.rmSync(src);
    processed++;
    return out;
  };

  const files: AudioManifest['files'] = {};
  for (const s of pack.story.sentences) {
    for (const speed of SPEED_VALUES) {
      const name = `${s.id}.${speed}.mp3`;
      const out = prepare(`${s.id}.${speed}`, previous?.files[name]?.hash);
      if (!out) continue;
      const duration = probeDuration(out);
      if (duration <= 0.05) {
        errors.push(`${name}: audio is empty after trimming silence`);
        continue;
      }
      const silence = longestSilence(out);
      if (silence > LONG_SILENCE_SECONDS) warnings.push(`${name}: has a ${silence.toFixed(1)}s silence inside`);
      const prevTimings = previous?.files[name]?.wordTimings;
      files[name] = { sentenceId: s.id, speed, duration, hash: hashFile(out), bytes: fs.statSync(out).size, ...(prevTimings ? { wordTimings: prevTimings } : {}) };
    }
  }

  const words: AudioManifest['words'] = {};
  for (const w of pack.story.words) {
    const rel = `words/${wordFileName(w.word)}`;
    const file = path.join(audioDir, rel);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue;
    if (previous?.words[w.word]?.hash !== hashFile(file)) {
      try {
        normalizeAudio(file, file);
        processed++;
      } catch (e) {
        errors.push((e as Error).message);
        continue;
      }
    }
    words[w.word] = { file: rel, duration: probeDuration(file), hash: hashFile(file), bytes: fs.statSync(file).size };
  }

  // Bedtime Listening 용 전체 낭독
  let full: AudioManifest['full'] = null;
  const fullOut = path.join(audioDir, 'full.natural.mp3');
  const naturals = pack.story.sentences.map((s) => ({ id: s.id, info: files[`${s.id}.natural.mp3`] }));
  const allNatural = naturals.every((n) => n.info);
  const userFull = findExisting(audioDir, 'full.natural');
  const prevGenerated = previous?.full?.generated ?? false;
  if (userFull && !(prevGenerated && allNatural)) {
    // 사용자가 직접 넣은 전체 낭독 파일
    if (!(userFull === fullOut && previous?.full && hashFile(fullOut) === previous.full.hash)) {
      normalizeAudio(userFull, fullOut);
      if (userFull !== fullOut) fs.rmSync(userFull);
      processed++;
    }
    full = { file: 'full.natural.mp3', duration: probeDuration(fullOut), hash: hashFile(fullOut), bytes: fs.statSync(fullOut).size, generated: false, timestamps: [] };
  } else if (allNatural) {
    // 문장 파일을 이어 붙여 만든다 + 문장 시작/끝 타임스탬프
    concatWithGaps(naturals.map((n) => path.join(audioDir, `${n.id}.natural.mp3`)), fullOut, SENTENCE_GAP_SECONDS);
    let t = 0;
    const timestamps = naturals.map((n) => {
      const d = n.info?.duration ?? 0;
      const stamp = { sentenceId: n.id, start: Math.round(t * 1000) / 1000, end: Math.round((t + d) * 1000) / 1000 };
      t += d + SENTENCE_GAP_SECONDS;
      return stamp;
    });
    full = { file: 'full.natural.mp3', duration: probeDuration(fullOut), hash: hashFile(fullOut), bytes: fs.statSync(fullOut).size, generated: true, timestamps };
  } else if (Object.keys(files).length > 0) {
    warnings.push('full.natural.mp3 not created yet: every sentence needs a natural-speed file first');
  }

  const manifest: AudioManifest = { packId: id, packVersion: pack.meta.version, generatedAt: now.toISOString(), files, words, full };
  // 내용이 그대로면 generatedAt 때문에 파일이 바뀌지 않게 한다(불필요한 git 변경 방지).
  const same = previous && JSON.stringify({ ...previous, generatedAt: '' }) === JSON.stringify({ ...manifest, generatedAt: '' });
  if (!same) fs.writeFileSync(path.join(pack.dir, 'audio-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const after = inspectPack(root, id);
  return { report: { ...after, errors: [...errors, ...after.errors], warnings: [...new Set([...warnings, ...after.warnings])] }, manifest, processed };
}

export function printReport(r: AudioReport): void {
  const total = r.present + r.missing;
  console.log(`\n📦 ${r.packId}  —  ${r.present}/${total} sentence files`);
  for (const e of r.errors) console.log(`  ❌ ${e}`);
  for (const w of r.warnings) console.log(`  ⚠️  ${w}`);
  if (r.errors.length === 0 && r.warnings.length === 0) console.log('  ✅ all good');
}

/** 스크립트를 실행한 위치(프로젝트 루트) */
export function projectRoot(): string {
  return process.cwd();
}
