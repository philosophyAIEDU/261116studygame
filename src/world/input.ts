// 이동 입력을 한곳에 모은다: 키보드(WASD·방향키) + 가상 조이스틱 + 탭 이동.
// React 상태가 아니라 모듈 변수로 둔다 → 매 프레임 읽어도 다시 그리기가 일어나지 않는다.

const keys = new Set<string>();

export const joystick = { x: 0, y: 0 };
/** 탭해서 이동할 목표 지점 (없으면 null) */
export const moveTarget: { point: [number, number] | null } = { point: null };
/** 카메라 회전(마우스 드래그) */
export const cameraYaw = { value: 0 };
/** 미니맵이 읽는 플레이어 위치 */
export const playerPos = { x: 0, z: 0 };

const MAP: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
}

export function attachKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e.target) || !MAP[e.code]) return;
    keys.add(e.code);
    moveTarget.point = null;
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => keys.clear();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    keys.clear();
  };
}

/** 현재 입력 방향 (길이 0~1). 화면 기준: x = 오른쪽, y = 아래(카메라 쪽) */
export function inputVector(): [number, number] {
  let x = joystick.x;
  let y = joystick.y;
  for (const code of keys) {
    const v = MAP[code];
    if (v) { x += v[0]; y += v[1]; }
  }
  const len = Math.hypot(x, y);
  return len > 1 ? [x / len, y / len] : [x, y];
}

export function resetInput(): void {
  keys.clear();
  joystick.x = 0;
  joystick.y = 0;
  moveTarget.point = null;
}
