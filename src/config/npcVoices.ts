// NPC·화자별 목소리 설정 (Web Speech 폴백용).
// 녹음 파일이 있으면 그 파일이 우선이고, 이 값은 기기 음성으로 읽을 때만 쓴다.

export interface VoiceProfile {
  /** 기기 음성 중 어떤 느낌의 목소리를 고를지 */
  prefer: 'female' | 'male';
  pitch: number; // 0~2
  /** 속도 사다리 값에 곱하는 배율 */
  rate: number;
}

export const SPEAKER_VOICES: Record<string, VoiceProfile> = {
  narrator: { prefer: 'female', pitch: 1.0, rate: 1.0 },
  girl: { prefer: 'female', pitch: 1.0, rate: 1.02 },
  boy: { prefer: 'male', pitch: 1.0, rate: 1.04 },
  friend: { prefer: 'female', pitch: 1.0, rate: 1.05 },
  teacher: { prefer: 'female', pitch: 1.0, rate: 0.97 },
  woman: { prefer: 'female', pitch: 1.05, rate: 0.98 },
  man: { prefer: 'male', pitch: 1.0, rate: 0.98 },
  creature: { prefer: 'male', pitch: 1.0, rate: 1.08 },
};

export interface NpcDef {
  id: string;
  name: string;
  portrait: string;
  voice: VoiceProfile;
  /** Gemini 시스템 프롬프트에 넣는 성격 설명 */
  persona: string;
}

export const NPCS: Record<string, NpcDef> = {
  harper: {
    id: 'harper', name: 'Ms. Harper', portrait: '👩‍🏫', voice: { prefer: 'female', pitch: 1.0, rate: 0.97 },
    persona: 'Ms. Harper, a warm and patient homeroom teacher who loves picture books.',
  },
  leo: {
    id: 'leo', name: 'Leo', portrait: '👦', voice: { prefer: 'male', pitch: 1.0, rate: 1.04 },
    persona: 'Leo, a cheerful 8-year-old classmate who loves pizza, rockets, and playing tag.',
  },
  ava: {
    id: 'ava', name: 'Ava', portrait: '👱‍♀️', voice: { prefer: 'female', pitch: 1.0, rate: 1.05 },
    persona: 'Ava, a playful and kind 8-year-old classmate who loves games and drawing.',
  },
  mrbooks: {
    id: 'mrbooks', name: 'Mr. Page', portrait: '🧓', voice: { prefer: 'male', pitch: 1.0, rate: 0.95 },
    persona: 'Mr. Page, a gentle school librarian who speaks softly and loves dragon stories.',
  },
  boss: {
    id: 'boss', name: 'Ms. Rivera', portrait: '👩‍💼', voice: { prefer: 'female', pitch: 1.0, rate: 1.0 },
    persona: 'Ms. Rivera, a friendly manager who interviews new workers and listens to presentations.',
  },
};

export function npc(id: string): NpcDef {
  return NPCS[id] ?? (NPCS.leo as NpcDef);
}
