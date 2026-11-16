import { useState } from 'react';
import { useUi } from './uiStore';
import { shouldShowUpdateBanner } from './updateBannerVisibility';
import { Btn } from '@/ui/kit';
import { useAppUpdate } from './appUpdate';

/** "✨ New update!" 배너 (화면 표시 부분). 조건 판단은 updateBannerVisibility.ts 의 순수 함수가 한다. */
export function UpdateBannerView({ needRefresh, onUpdate }: { needRefresh: boolean; onUpdate: () => void }) {
  const overlay = useUi((s) => s.overlay);
  const [dismissed, setDismissed] = useState(false);
  if (!shouldShowUpdateBanner({ needRefresh, overlay, dismissed })) return null;
  return (
    <div role="status" className="fixed left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border-2 border-honey bg-night px-4 py-2 shadow-2xl">
      <span className="text-lg font-extrabold">✨ New update!</span>
      <Btn tone="meadow" onClick={onUpdate}>Update now</Btn>
      <Btn tone="ghost" icon="✖️" aria-label="Later" onClick={() => setDismissed(true)} />
    </div>
  );
}

export function UpdateBanner() {
  const { needRefresh, applyUpdate } = useAppUpdate();
  return <UpdateBannerView needRefresh={needRefresh} onUpdate={applyUpdate} />;
}
