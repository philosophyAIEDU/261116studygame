import { create } from 'zustand';
import { resetInput } from '@/world/input';
import type { Skill } from '@/types';

// 화면 상태(저장하지 않음): 지금 어떤 창이 떠 있는가.

export type Overlay =
  | { type: 'adventure'; nodeId?: string }
  | { type: 'storyList' }
  | { type: 'story'; packId: string }
  | { type: 'bedtime'; packId?: string }
  | { type: 'bag'; tab?: 'dictionary' | 'phrases' | 'badges' | 'outfit' }
  | { type: 'quests' }
  | { type: 'mentor' }
  | { type: 'talk'; packId: string; npcId?: string; career?: boolean }
  | { type: 'skills'; skill: Skill }
  | { type: 'realTalk' }
  | { type: 'exam' }
  | { type: 'graduation' }
  | { type: 'settings' }
  | { type: 'report' }
  | { type: 'install' }
  | { type: 'career' }
  | { type: 'map' };

interface UiState {
  overlay: Overlay | null;
  storyReturnToAdventure: boolean;
  /** 창을 열고 닫는다. 창을 열면 플레이어 이동 입력은 멈춘다. */
  open: (overlay: Overlay) => void;
  close: () => void;
  /** 3D 월드에서 가까이 있는 장소 id */
  nearZone: string | null;
  setNearZone: (id: string | null) => void;
  /** 순간 이동 요청 (퀘스트 로그·미니맵 → 3D 월드) */
  teleport: string | null;
  requestTeleport: (zoneId: string | null) => void;
}

export const useUi = create<UiState>((set) => ({
  overlay: null,
  storyReturnToAdventure: false,
  open: (overlay) => set((s) => ({ overlay, storyReturnToAdventure: (s.overlay?.type === 'adventure' && overlay.type === 'story') || (s.storyReturnToAdventure && ['story', 'bedtime', 'talk'].includes(overlay.type)) })),
  close: () => set({ overlay: null, storyReturnToAdventure: false }),
  nearZone: null,
  setNearZone: (id) => set((s) => (s.nearZone === id ? s : { nearZone: id })),
  teleport: null,
  requestTeleport: (zoneId) => {
    // 요청 시점의 이동만 취소한다. 월드 로딩 중 새로 누른 목표는 보존한다.
    if (zoneId) resetInput();
    set({ teleport: zoneId });
  },
}));
