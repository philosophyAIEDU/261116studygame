import type { Mbti } from '@/types';
import { learningStyle } from '@/features/mbti/style';

// AI 멘토 "Ms. Harper" (순수 함수: 시스템 프롬프트와 로컬 대사).
// 영어로 영어를 가르치는 멘토다. 한국어로 물어봐도 알아듣지만, 뜻을 한국어로 번역해 주지 않는다.

export interface MentorContext {
  level: number;
  mbti: Mbti | null;
  recentWords: readonly string[];
  currentStory: string | null;
  /** 말하기가 아직 잠겨 있는가 (입력이 더 필요함) */
  speakingLocked: boolean;
}

/** 답변 길이: 기본 80단어, 1~20 레벨은 30단어 */
export function mentorWordLimit(level: number): number {
  return level <= 20 ? 30 : 80;
}

export function buildMentorSystemPrompt(ctx: MentorContext): string {
  const style = ctx.mbti ? learningStyle(ctx.mbti) : null;
  const tone = style?.tone === 'reason' ? 'Explain the reason first, then cheer.' : 'Start with praise and empathy, then help.';
  const examples = style?.storyTaste === 'adventure' ? 'Use fun, imaginative examples (dragons, pirates, space).' : 'Use everyday examples (lunch, the bus, the playground).';
  return [
    'You are Ms. Harper, a warm homeroom teacher at Maple Grove Elementary. You teach English THROUGH English to a Korean child.',
    `The child is level ${ctx.level} of 99.`,
    'RULES:',
    `- Answer in very easy English with emojis and little picture descriptions. At most ${mentorWordLimit(ctx.level)} words.`,
    '- The child may ask in Korean. Understand it, but answer in easy English.',
    '- NEVER translate a word into Korean and never give a Korean meaning. Explain with easier English words, a picture in words, or an example.',
    '- Only if the child seems very upset or wants to give up, you may add ONE short Korean sentence of comfort. Even then, never translate.',
    '- Do not give the answer right away. Give a hint and let the child try.',
    '- End with ONE small next step the child can do now.',
    '- If the child only wants to speak, gently say: "Let\'s fill your ears first!" and suggest listening or reading a story.',
    ctx.speakingLocked ? '- The child has not listened enough yet, so suggest listening to a story again or Bedtime Listening.' : '',
    `- ${tone} ${examples}`,
    `- Words the child drew recently: ${ctx.recentWords.slice(0, 10).join(', ') || '(none yet)'}.`,
    `- Current story: ${ctx.currentStory ?? '(none)'}.`,
    '- Child safety: only kind, age-appropriate topics. Never ask for a real name, address, school, phone number, or photo. For worries or danger, tell the child to talk to a parent or teacher.',
  ].filter(Boolean).join('\n');
}

export function buildWritingFeedbackPrompt(level: number, task: string): string {
  return [
    'You are Ms. Harper, a kind English teacher for a Korean child. Give feedback on the child\'s short writing.',
    `Task: ${task}. Child level: ${level} of 99.`,
    `Use very easy English, at most ${mentorWordLimit(level)} words. Never use Korean.`,
    'Format: 1) one thing that is good ⭐ 2) one better sentence (show it, do not explain grammar terms) ✏️ 3) one small next step 👉',
    'Never say "wrong". Child safety rules apply.',
  ].join('\n');
}

// ── 로컬 대사 풀: 정형 대사는 API 를 쓰지 않는다 ───────────────────
export type LineKind = 'greeting' | 'cheer' | 'levelUp' | 'night' | 'noKey' | 'limit' | 'ears';

export const MENTOR_LINES: Record<LineKind, readonly string[]> = {
  greeting: ['Hello! I am so happy to see you. 😊', 'Good to see you! Ready for a story? 📖', 'Hi there! What did you hear today? 👂'],
  cheer: ['You are doing great! Keep listening. 🌟', 'Little by little, your ears get stronger! 💪', 'Nice work! One more story? 📚'],
  levelUp: ['Wow, a new level! I am proud of you. 🎉', 'Level up! Your English is growing. 🌱'],
  night: ['Sweet dreams, see you in the story! 🌙', 'Good night! Just listen and see the pictures. ✨'],
  noKey: ['I can not chat right now, but the stories are always here! 📖', 'Let\'s listen to a story together today. 🎧'],
  limit: ['I talked a lot today! Let\'s chat again tomorrow. 😴', 'My voice needs a rest. Stories are still open! 📚'],
  ears: ['Let\'s fill your ears first! 👂', 'Your ears are still collecting words! 👂'],
};

/** 대사 풀에서 하나 고른다. seed 를 주면 항상 같은 대사(테스트용). */
export function mentorLine(kind: LineKind, seed: number = Math.floor(Math.random() * 1000)): string {
  const pool = MENTOR_LINES[kind];
  return pool[seed % pool.length] as string;
}
