import { Modal } from '@/ui/kit';

// (임시) 다음 마일스톤에서 구현한다.
export function CareerPick({ onClose }: { onClose: () => void } & Record<string, unknown>) {
  return <Modal title="CareerPick" icon="⏳" onClose={onClose}><p className="text-center text-5xl">⏳</p></Modal>;
}
