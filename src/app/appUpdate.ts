import { create } from 'zustand';

// 앱 업데이트 상태 (PWA 서비스 워커 / Tauri updater 공통).
// 실제 감지는 src/app/registerUpdate.ts 가 하고, 여기는 화면이 읽는 상태만 둔다.

interface UpdateState {
  needRefresh: boolean;
  /** 설정 화면의 "업데이트 확인" 결과 */
  status: 'idle' | 'checking' | 'latest' | 'found';
  applyUpdate: () => void;
  checkNow: () => Promise<void>;
}

export const useAppUpdate = create<UpdateState>(() => ({
  needRefresh: false,
  status: 'idle',
  applyUpdate: () => {},
  checkNow: async () => {},
}));
