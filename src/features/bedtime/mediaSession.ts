// Media Session API: 휴대폰 잠금 화면·알림창에 재생 컨트롤을 띄운다.
// 화면이 꺼져도 이야기가 계속 나오고, 잠금 화면에서 멈추거나 다음 이야기로 넘길 수 있다.

interface Handlers {
  play: () => void;
  pause: () => void;
  next: () => void;
}

function supported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof MediaMetadata !== 'undefined';
}

export function setBedtimeMedia(title: string, handlers: Handlers): void {
  if (!supported()) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist: 'Bedtime Listening',
    album: 'My American School Quest',
    artwork: [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }],
  });
  const set = (action: MediaSessionAction, fn: (() => void) | null) => {
    try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* 지원하지 않는 동작은 무시 */ }
  };
  set('play', handlers.play);
  set('pause', handlers.pause);
  set('stop', handlers.pause);
  set('nexttrack', handlers.next);
}

export function setBedtimePlaying(playing: boolean): void {
  if (supported()) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

export function clearBedtimeMedia(): void {
  if (!supported()) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
}
