import { useGame } from '@/save/store';
import { Modal } from '@/ui/kit';
import { WorldMap2D } from '@/world/WorldMap2D';

/** 큰 지도: 장소를 누르면 그 앞으로 이동한다 (키보드만으로도 어디든 갈 수 있다). */
export function MapOverlay({ onClose }: { onClose: () => void }) {
  const night = useGame((s) => s.save.world.phase === 'night');
  return (
    <Modal title="School Map" icon="🗺️" onClose={onClose}>
      <WorldMap2D night={night} onPick={onClose} />
    </Modal>
  );
}
