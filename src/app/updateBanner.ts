import type { Overlay } from './uiStore';

/**
 * 업데이트 배너를 보여줄지 정한다 (순수 함수).
 * 새 버전이 있어도 플레이 중(퀘스트·Bedtime Listening 등 창이 열려 있을 때)에는 띄우지 않고,
 * 마을(월드) 화면으로 돌아왔을 때만 띄운다. 아이의 집중과 잠을 방해하지 않기 위해서다.
 */
export function shouldShowUpdateBanner(args: { needRefresh: boolean; overlay: Overlay | null; dismissed: boolean }): boolean {
  return args.needRefresh && args.overlay === null && !args.dismissed;
}
