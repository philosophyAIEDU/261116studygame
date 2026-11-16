// 말하기 로컬 채점 (순수 함수) — API를 쓰지 않는다.
// 음성 인식 결과와 목표 문장을 "단어 단위"로 비교한다(레벤슈타인 편집 거리).

/** 소문자화 + 문장부호 제거 + 흔한 축약형 풀기 → 단어 배열 */
export function toWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\bgonna\b/g, 'going to')
    .replace(/\bwanna\b/g, 'want to')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\bit's\b/g, 'it is')
    .replace(/\bdon't\b/g, 'do not')
    .replace(/\bcan't\b/g, 'can not')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** 두 배열 사이의 편집 거리(삽입·삭제·교체 각 1). */
export function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/** 따라 말하기·쉐도잉 정확도(0~1): 1 - 편집거리 / 목표 단어 수 */
export function speechAccuracy(target: string, heard: string): number {
  const t = toWords(target);
  const h = toWords(heard);
  if (t.length === 0) return 0;
  const distance = levenshtein(t, h);
  return Math.max(0, Math.min(1, 1 - distance / t.length));
}

/** "완전한 문장"으로 볼 수 있는가: 단어 3개 이상 + 흔한 동사 형태 포함. (Talk Time +5 XP 조건) */
export function looksLikeFullSentence(text: string): boolean {
  const words = toWords(text);
  if (words.length < 3) return false;
  return words.some((w) => /^(am|is|are|was|were|do|does|did|have|has|had|can|will|like|likes|want|wants|go|goes|went|play|plays|see|sees|eat|eats|love|loves|need|needs|think|know|feel|feels|make|makes|read|reads|live|lives)$/.test(w));
}

/** 그림 묘사·쓰기의 로컬 점수: 길이와 목표 단어 사용 개수로 0~1 */
export function freeResponseScore(text: string, targetWords: readonly string[], minWords: number): number {
  const words = toWords(text);
  if (words.length === 0) return 0;
  const lengthScore = Math.min(1, words.length / Math.max(1, minWords));
  const targets = targetWords.map((w) => w.toLowerCase());
  const used = targets.filter((w) => words.includes(w)).length;
  const vocabScore = targets.length === 0 ? 1 : Math.min(1, used / Math.min(2, targets.length));
  return Math.round((lengthScore * 0.6 + vocabScore * 0.4) * 100) / 100;
}
