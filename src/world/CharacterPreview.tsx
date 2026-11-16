import { Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { CharacterDesign } from '@/config/characters';
import { Avatar2D } from '@/ui/Avatar2D';
import { Character } from './Character';

class PreviewBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
/** 실제 게임 모델을 돌려 보는 작은 스튜디오. 외형 선택을 즉시 반영한다. */
export default function CharacterPreview({ look }: { look: CharacterDesign }) {
  return <PreviewBoundary fallback={<Avatar2D look={look} size={210} />}>
    <div className="h-full w-full" role="img" aria-label="Your character in 3D. Drag to turn around.">
      <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }} camera={{ position: [2.1, 1.9, 4.2], fov: 36 }}>
        <ambientLight intensity={1.4} color="#fff5ec" />
        <directionalLight position={[3, 5, 5]} intensity={2} color="#ffeacf" />
        <directionalLight position={[-3, 2, -4]} intensity={1.3} color="#e1d7ff" />
        <Character look={look} shadow={false} />
        <OrbitControls target={[0, 1.12, 0]} enablePan={false} enableZoom={false} minPolarAngle={0.85} maxPolarAngle={1.65} />
      </Canvas>
    </div>
  </PreviewBoundary>;
}
