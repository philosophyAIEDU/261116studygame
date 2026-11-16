import type { CareerId } from '@/types';

/** 커리어 단계(Lv 71~)의 직업 6종. 직업마다 인터뷰·발표 연습과 직업 글쓰기 퀘스트가 열린다. */
export interface CareerDef {
  id: CareerId;
  icon: string;
  name: string;
  line: string;
}

export const CAREERS: readonly CareerDef[] = [
  { id: 'teacher', icon: '👩‍🏫', name: 'Teacher', line: 'Help children learn and grow.' },
  { id: 'doctor', icon: '🩺', name: 'Doctor', line: 'Help sick people get better.' },
  { id: 'reporter', icon: '📰', name: 'Reporter', line: 'Find the news and tell the world.' },
  { id: 'gamedev', icon: '🎮', name: 'Game Developer', line: 'Make fun games for everyone.' },
  { id: 'diplomat', icon: '🌐', name: 'Diplomat', line: 'Make friends between countries.' },
  { id: 'chef', icon: '👨‍🍳', name: 'Chef', line: 'Cook yummy food for people.' },
];

export function careerDef(id: CareerId | null): CareerDef | undefined {
  return CAREERS.find((c) => c.id === id);
}
