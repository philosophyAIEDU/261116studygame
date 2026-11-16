// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// "한국어 없음" 검사 (철학 1번)
//  1) content/packs 의 모든 story.json / pack.json 에 한글이 없어야 한다.
//  2) 게임 화면 문자열(= src 의 코드에서 주석을 뺀 부분)에 한글이 없어야 한다.
//     예외: src/i18n/ko.ts (보호자·설정·설치 안내 전용)와 테스트 파일.

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** 주석(//, 블록 주석)을 지운다. 문자열 안의 // (예: URL)는 건드리지 않는다. */
export function stripComments(code: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < code.length) {
    const c = code[i] as string;
    const next = code[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
    } else if (c === '/' && next !== '/' && next !== '*' && /[(,=:[!&|?{};]$/.test(out.trimEnd() || ';')) {
      // 정규식 리터럴: 닫는 / 까지 그대로 복사한다 (문자 클래스 [] 안의 / 와 따옴표는 무시)
      let inClass = false;
      out += c;
      i++;
      while (i < code.length) {
        const r = code[i] as string;
        out += r;
        i++;
        if (r === '\\') { out += code[i] ?? ''; i++; continue; }
        if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if ((r === '/' && !inClass) || r === '\n') break;
      }
    } else if (c === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

describe('no Korean in learning content', () => {
  const packs = path.join(root, 'content', 'packs');
  const files = walk(packs).filter((f) => /(story|pack)\.json$/.test(f));
  it('finds the story packs', () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });
  it.each(files.map((f) => [path.relative(root, f), f]))('%s has no Hangul', (_rel, file) => {
    expect(HANGUL.test(fs.readFileSync(file as string, 'utf8'))).toBe(false);
  });
  it('schemas have no Korean-meaning field', () => {
    const schema = fs.readFileSync(path.join(root, 'src', 'content', 'schema.ts'), 'utf8');
    expect(/meaningKo|korean:|translation:/i.test(stripComments(schema))).toBe(false);
  });
});

describe('no Korean in game screen strings', () => {
  const files = walk(path.join(root, 'src')).filter(
    (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}i18n${path.sep}ko`),
  );
  it('comment stripper keeps strings and URLs', () => {
    expect(stripComments('const a = "https://x.y"; // 한글\n/* 한 */ const b = 1;')).toBe('const a = "https://x.y"; \n const b = 1;');
  });
  it.each(files.map((f) => [path.relative(root, f), f]))('%s', (_rel, file) => {
    const code = stripComments(fs.readFileSync(file as string, 'utf8'));
    const line = code.split('\n').find((l) => HANGUL.test(l));
    expect(line, `Korean text found in game code: ${line ?? ''}`).toBeUndefined();
  });
});
