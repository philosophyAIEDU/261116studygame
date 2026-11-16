import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { hairColor, outfitColor } from '@/config/appearance';
import { SKIN } from '@/config/theme';
import { toonGradient } from './materials';

// 프리미티브(캡슐·구·박스)로 만든 오리지널 2.5등신 캐릭터. 외부 모델 파일이 없어도 동작한다.

export interface CharacterLook {
  hair: number;
  hairColor: number;
  outfitColor: number;
}

function Toon({ color }: { color: string }) {
  return <meshToonMaterial color={color} gradientMap={toonGradient()} />;
}

export function Character({ look, moving, shadow = true }: { look: CharacterLook; moving?: RefObject<boolean>; shadow?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const phase = useRef(Math.random() * 6);
  const hair = hairColor(look.hairColor);
  const outfit = outfitColor(look.outfitColor);

  useFrame((_, dt) => {
    const walking = moving?.current ?? false;
    phase.current += dt * (walking ? 11 : 2);
    const swing = walking ? Math.sin(phase.current) * 0.7 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (body.current) body.current.position.y = walking ? Math.abs(Math.sin(phase.current)) * 0.08 : Math.sin(phase.current) * 0.025;
  });

  return (
    <group>
      {/* 발밑 그림자(낮은 품질에서도 입체감이 나도록) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <mesh ref={legL} position={[-0.18, 0.32, 0]} castShadow={shadow}>
          <capsuleGeometry args={[0.11, 0.3, 4, 8]} />
          <Toon color="#3b3355" />
        </mesh>
        <mesh ref={legR} position={[0.18, 0.32, 0]} castShadow={shadow}>
          <capsuleGeometry args={[0.11, 0.3, 4, 8]} />
          <Toon color="#3b3355" />
        </mesh>
        <mesh position={[0, 0.88, 0]} castShadow={shadow}>
          <capsuleGeometry args={[0.34, 0.36, 6, 12]} />
          <Toon color={outfit} />
        </mesh>
        <mesh position={[0, 1.62, 0]} castShadow={shadow}>
          <sphereGeometry args={[0.46, 20, 16]} />
          <Toon color={SKIN} />
        </mesh>
        {/* 눈 */}
        <mesh position={[-0.16, 1.64, 0.41]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="#2b2440" /></mesh>
        <mesh position={[0.16, 1.64, 0.41]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="#2b2440" /></mesh>
        {/* 머리카락: 0 짧은 머리 / 1 단발 / 2 포니테일 */}
        <mesh position={[0, 1.74, -0.05]} scale={look.hair === 1 ? [1.08, 1.02, 1.1] : [1.04, 0.92, 1.04]} castShadow={shadow}>
          <sphereGeometry args={[0.48, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <Toon color={hair} />
        </mesh>
        {look.hair === 1 ? (
          <mesh position={[0, 1.45, -0.18]} scale={[1.1, 1, 0.8]}><sphereGeometry args={[0.46, 16, 12]} /><Toon color={hair} /></mesh>
        ) : null}
        {look.hair === 2 ? (
          <mesh position={[0, 1.5, -0.56]} rotation={[0.5, 0, 0]}><capsuleGeometry args={[0.12, 0.42, 4, 8]} /><Toon color={hair} /></mesh>
        ) : null}
      </group>
    </group>
  );
}
