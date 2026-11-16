import { useAppUpdate } from './appUpdate';

// 자동 업데이트 연결.
//  · PWA(브라우저·홈 화면 앱): 서비스 워커가 새 버전을 내려받으면 needRefresh 가 켜진다.
//    registerType 이 'prompt' 이므로 멋대로 새로고침하지 않고, 게임 안 배너에서 아이가 누를 때 적용한다.
//  · PC 설치형(Tauri): GitHub Releases 의 latest.json 을 확인하고, 앱 안에서 내려받아 다시 시작한다.

const HOUR = 60 * 60 * 1000;

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function setupTauri(): Promise<void> {
  const { check } = await import('@tauri-apps/plugin-updater');
  const look = async (): Promise<boolean> => {
    try {
      const update = await check();
      if (!update) return false;
      useAppUpdate.setState({
        needRefresh: true,
        applyUpdate: () => {
          void (async () => {
            await update.downloadAndInstall();
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          })();
        },
      });
      return true;
    } catch {
      return false; // 오프라인이거나 서버에 닿지 못함 → 다음에 다시 확인
    }
  };
  useAppUpdate.setState({
    checkNow: async () => {
      useAppUpdate.setState({ status: 'checking' });
      useAppUpdate.setState({ status: (await look()) ? 'found' : 'latest' });
    },
  });
  await look();
  setInterval(() => void look(), 6 * HOUR);
}

async function setupPwa(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  let registration: ServiceWorkerRegistration | undefined;
  const updateSW = registerSW({
    onNeedRefresh: () => useAppUpdate.setState({ needRefresh: true, status: 'found' }),
    onRegisteredSW: (_url, reg) => {
      registration = reg;
      // 앱을 오래 켜 두어도 새 버전을 알아채도록 한 시간마다 확인한다.
      if (reg) setInterval(() => void reg.update().catch(() => {}), HOUR);
    },
  });
  useAppUpdate.setState({
    applyUpdate: () => void updateSW(true),
    checkNow: async () => {
      useAppUpdate.setState({ status: 'checking' });
      try { await registration?.update(); } catch { /* 오프라인 */ }
      // 새 버전이 있으면 잠시 뒤 onNeedRefresh 가 불린다.
      setTimeout(() => useAppUpdate.setState((s) => ({ status: s.needRefresh ? 'found' : 'latest' })), 2500);
    },
  });
}

export function registerUpdate(): void {
  void (isTauri() ? setupTauri() : setupPwa()).catch(() => {});
}
