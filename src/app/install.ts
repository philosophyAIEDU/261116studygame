import { create } from 'zustand';

// PWA 설치: 안드로이드·PC(Chrome/Edge)는 beforeinstallprompt 로 설치 버튼을 띄울 수 있다.
// iOS(Safari)는 이 이벤트가 없어서 "공유 → 홈 화면에 추가" 그림 안내를 보여준다.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  canInstall: boolean;
  promptInstall: () => Promise<boolean>;
}

let deferred: InstallPromptEvent | null = null;

export const useInstall = create<InstallState>((set) => ({
  canInstall: false,
  promptInstall: async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    set({ canInstall: false });
    return choice.outcome === 'accepted';
  },
}));

export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    useInstall.setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    useInstall.setState({ canInstall: false });
  });
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent));
}
