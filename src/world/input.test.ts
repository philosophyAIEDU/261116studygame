import { afterEach, expect, it } from 'vitest';
import { useUi } from '@/app/uiStore';
import { moveTarget, resetInput } from './input';

afterEach(() => { resetInput(); useUi.setState({ teleport: null }); });
it('cancels the old destination when fast travel is requested, then preserves a newly queued walk when travel finishes', () => {
  moveTarget.point = [-6, 13];
  useUi.getState().requestTeleport('cafeteria');
  expect(moveTarget.point).toBeNull();
  moveTarget.point = [5, 7];
  useUi.getState().requestTeleport(null);
  expect(moveTarget.point).toEqual([5, 7]);
});
