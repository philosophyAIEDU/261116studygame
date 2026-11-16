import type { Overlay } from '@/app/uiStore';

// 학교 맵의 장소들. 3D 월드, 미니맵, 2D 지도(키보드·WebGL 미지원 폴백)가 같은 정보를 쓴다.

export interface ZoneAction {
  icon: string;
  label: string;
  overlay: Overlay;
}

export interface ZoneDef {
  id: string;
  name: string;
  icon: string;
  /** 3D 좌표 (x, z). 맵은 대략 -30~30 범위 */
  pos: [number, number];
  color: string;
  /** 여기 서 있는 NPC (npcVoices 의 id) */
  npcId?: string;
  actions: ZoneAction[];
}

export const ZONES: readonly ZoneDef[] = [
  {
    id: 'classroom', name: 'Classroom', icon: '📖', pos: [0, -21], color: '#f6b352',
    actions: [
      { icon: '📚', label: 'Story Quest', overlay: { type: 'storyList' } },
      { icon: '📖', label: 'Reading', overlay: { type: 'skills', skill: 'reading' } },
    ],
  },
  {
    id: 'music', name: 'Music Room', icon: '🎧', pos: [-18, -12], color: '#8e7cc3',
    actions: [{ icon: '🎧', label: 'Listening', overlay: { type: 'skills', skill: 'listening' } }],
  },
  {
    id: 'cafeteria', name: 'Cafeteria', icon: '🍕', pos: [18, -12], color: '#e8743b', npcId: 'leo',
    actions: [
      { icon: '⚡', label: 'Real Talk', overlay: { type: 'realTalk' } },
      { icon: '💬', label: 'Talk Time', overlay: { type: 'talk', packId: '', npcId: 'leo' } },
    ],
  },
  {
    id: 'playground', name: 'Playground', icon: '⚽', pos: [16, 12], color: '#7cc36a', npcId: 'ava',
    actions: [
      { icon: '🎤', label: 'Speaking', overlay: { type: 'skills', skill: 'speaking' } },
      { icon: '💬', label: 'Talk Time', overlay: { type: 'talk', packId: '', npcId: 'ava' } },
    ],
  },
  {
    id: 'library', name: 'Library', icon: '✏️', pos: [-16, 12], color: '#7ec8e3', npcId: 'mrbooks',
    actions: [
      { icon: '✏️', label: 'Writing', overlay: { type: 'skills', skill: 'writing' } },
      { icon: '🖍️', label: 'My Dictionary', overlay: { type: 'bag', tab: 'dictionary' } },
    ],
  },
  {
    id: 'teacher', name: "Teacher's Desk", icon: '👩‍🏫', pos: [0, -7], color: '#e0526b', npcId: 'harper',
    actions: [
      { icon: '👩‍🏫', label: 'Ms. Harper', overlay: { type: 'mentor' } },
      { icon: '🎓', label: 'Graduation', overlay: { type: 'exam' } },
    ],
  },
  {
    id: 'home', name: 'My Room', icon: '🛏️', pos: [-27, 1], color: '#8e7cc3',
    actions: [{ icon: '🌙', label: 'Bedtime Listening', overlay: { type: 'bedtime' } }],
  },
];

export function zoneById(id: string | null): ZoneDef | undefined {
  return ZONES.find((z) => z.id === id);
}

/** 플레이어 시작 위치 */
export const SPAWN: [number, number] = [0, 6];
