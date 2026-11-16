import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import type * as THREE from 'three';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { activeFestivalQuest, festivalQuestReady, STAR_PARCELS, storyOutputReady } from '@/features/adventure/rules';
import { zoneById } from '@/config/zones';
import { cameraYaw, moveTarget, playerPos } from './input';
import { emojiTexture } from './materials';

function Parcel({ id, pos, index }: { id: string; pos: readonly [number, number]; index: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) { ref.current.position.y = 0.8 + Math.sin(clock.elapsedTime * 2 + index) * 0.12; ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.8 + index) * 0.2; }
  });
  return <group position={[pos[0], 0, pos[1]]} onClick={(event) => {
    event.stopPropagation();
    if (Math.hypot(playerPos.x - pos[0], playerPos.z - pos[1]) <= 3) useUi.getState().open({ type: 'adventure', nodeId: id });
    else moveTarget.point = [pos[0], pos[1]];
  }}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}><ringGeometry args={[0.7, 0.8, 32]} /><meshBasicMaterial color="#ffe5a4" transparent opacity={0.85} /></mesh>
    <group ref={ref}>
      <RoundedBox args={[0.8, 0.65, 0.65]} radius={0.1} smoothness={2}><meshStandardMaterial color="#f9d18a" roughness={0.55} /></RoundedBox>
      <mesh position={[0, 0.01, 0.335]}><boxGeometry args={[0.12, 0.65, 0.025]} /><meshStandardMaterial color="#caa0c3" /></mesh>
      <mesh position={[0, 0.34, 0]}><boxGeometry args={[0.12, 0.025, 0.65]} /><meshStandardMaterial color="#caa0c3" /></mesh>
      <sprite position={[0, 0.8, 0]} scale={[0.8, 0.8, 1]}><spriteMaterial map={emojiTexture('⭐')} depthWrite={false} /></sprite>
    </group>
  </group>;
}

/** 가장 가까운 다음 목표를 향하는 길잡이. 월드와 HUD가 같은 퀘스트를 읽는다. */
export function FestivalWorld() {
  const save = useGame((s) => s.save);
  const quest = activeFestivalQuest(save.adventure);
  const ready = quest ? festivalQuestReady(save.adventure, quest.id, storyOutputReady(save.stories)) : false;
  const parcel = quest?.id === 'lost-stars' && !ready ? STAR_PARCELS.find((p) => !save.adventure.collected.includes(p.id)) : undefined;
  const target = save.adventure.started ? parcel?.pos ?? zoneById(quest?.zone ?? null)?.pos : zoneById('cafeteria')?.pos;
  const beacon = useRef<THREE.Group>(null);
  const guide = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (beacon.current) { beacon.current.position.y = 3.3 + Math.sin(clock.elapsedTime * 2) * 0.14; beacon.current.rotation.y = cameraYaw.value; }
    if (guide.current && target) {
      const dx = target[0] - playerPos.x; const dz = target[1] - playerPos.z;
      const distance = Math.hypot(dx, dz);
      guide.current.visible = useUi.getState().overlay === null && distance > 3;
      guide.current.position.set(playerPos.x, 0.08, playerPos.z);
      guide.current.rotation.y = Math.atan2(dx, dz);
    }
    if (arrow.current) arrow.current.position.z = 1.4 + Math.sin(clock.elapsedTime * 3) * 0.15;
  });
  return <>
    {quest?.id === 'lost-stars' && STAR_PARCELS.filter((p) => !save.adventure.collected.includes(p.id)).map((p, i) => <Parcel key={p.id} id={p.id} pos={p.pos} index={i} />)}
    {target && <group position={[target[0], 0, target[1]]}>
      <group ref={beacon}><mesh><octahedronGeometry args={[0.26]} /><meshStandardMaterial color="#ffdf88" emissive="#e5ad4b" emissiveIntensity={0.25} /></mesh></group>
      <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.11, 0.55, 3, 16, 1, true]} /><meshBasicMaterial color="#ffe8a6" transparent opacity={0.12} depthWrite={false} /></mesh>
    </group>}
    {target && <group ref={guide}><group ref={arrow}><mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]}><circleGeometry args={[0.32, 3]} /><meshBasicMaterial color="#fff1b0" transparent opacity={0.9} /></mesh></group>{[2.3, 3.1, 3.9].map((z) => <mesh key={z} position={[0, 0, z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.075, 8]} /><meshBasicMaterial color="#fff1b0" transparent opacity={0.7} /></mesh>)}</group>}
  </>;
}

/** 작은 광장·꽃밭·축제 깃발로 탐험할 만한 공간을 만든다. */
export function CampusDetails({ complete }: { complete: boolean }) {
  const colors = ['#efb8bc', '#f4d58e', '#a9ccbb', '#b8acd5'];
  return <>
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.12, 0]} receiveShadow><cylinderGeometry args={[1.7, 1.85, 0.24, 32]} /><meshStandardMaterial color="#e8d5bd" roughness={0.85} /></mesh>
      <mesh position={[0, 0.29, 0]}><cylinderGeometry args={[1.47, 1.47, 0.12, 32]} /><meshStandardMaterial color="#a6d8df" roughness={0.22} metalness={0.15} /></mesh>
      <mesh position={[0, 0.68, 0]}><cylinderGeometry args={[0.16, 0.34, 0.8, 16]} /><meshStandardMaterial color="#f1e3cf" /></mesh>
      <mesh position={[0, 1.16, 0]}><sphereGeometry args={[0.35, 16, 12]} /><meshStandardMaterial color="#f7ca77" roughness={0.4} /></mesh>
    </group>
    {[-1, 1].map((side) => <group key={side} position={[side * 5.5, 0, 5]}>
      <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.055, 0.075, 1.2, 8]} /><meshStandardMaterial color="#ae8466" /></mesh>
      <mesh position={[0, 1.4, 0]}><sphereGeometry args={[0.33, 16, 12]} /><meshStandardMaterial color={colors[side + 1]} roughness={0.5} /></mesh>
      <mesh position={[0.16, 1.85, 0]}><sphereGeometry args={[0.26, 16, 12]} /><meshStandardMaterial color={colors[side + 2]} roughness={0.5} /></mesh>
    </group>)}
    {[-1, 1].map((side) => <group key={side} position={[side * 4.5, 0, -4]}>
      <RoundedBox args={[0.5, 3.8, 0.5]} position={[0, 1.9, 0]} radius={0.08} smoothness={2}><meshStandardMaterial color="#c59975" /></RoundedBox>
      <mesh position={[0, 4, 0]}><sphereGeometry args={[0.18, 12, 8]} /><meshStandardMaterial color="#ffe4a2" /></mesh>
    </group>)}
    {Array.from({ length: 11 }, (_, i) => <mesh key={i} position={[-4.4 + i * 0.88, 3.7 - Math.sin(i / 10 * Math.PI) * 0.48, -4]} rotation={[0, 0, Math.PI]}><circleGeometry args={[0.32, 3]} /><meshStandardMaterial color={colors[i % colors.length]} side={2} /></mesh>)}
    {Array.from({ length: 24 }, (_, i) => {
      const a = i * 2.39996; const r = 7 + (i % 3) * 0.7;
      return <group key={i} position={[Math.cos(a) * r, 0.2, Math.sin(a) * r + 3]}>
        <mesh><sphereGeometry args={[0.22, 8, 6]} /><meshStandardMaterial color={colors[i % colors.length]} /></mesh>
        <mesh position={[0, -0.09, 0]} scale={[1.6, 0.3, 1]}><sphereGeometry args={[0.22, 8, 6]} /><meshStandardMaterial color="#699f78" /></mesh>
      </group>;
    })}
    {complete && Array.from({ length: 12 }, (_, i) => <sprite key={i} position={[Math.sin(i * 2.4) * 4, 2.5 + i % 3, Math.cos(i * 2.4) * 4]} scale={[0.5, 0.5, 1]}><spriteMaterial map={emojiTexture(i % 2 ? '✨' : '🎈')} depthWrite={false} /></sprite>)}
  </>;
}
