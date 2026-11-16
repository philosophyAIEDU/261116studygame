import { useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { hairColor, outfitColor, SKIN_COLOR } from '@/config/appearance';
import type { CharacterDesign } from '@/config/characters';

export type CharacterLook = CharacterDesign;
type Point = [number, number, number];

// 작은 둥근 형태에 부드러운 재질을 더한 오리지널 토이 스타일. 외부 모델·텍스처 불필요.
function Pebble({ at, scale, color, shadow = false, rotation }: { at: Point; scale: Point; color: string; shadow?: boolean; rotation?: Point }) {
  return <mesh position={at} scale={scale} rotation={rotation} castShadow={shadow}>
    <sphereGeometry args={[1, 16, 12]} />
    <meshStandardMaterial color={color} roughness={0.64} metalness={0} />
  </mesh>;
}

export function Character({ look, moving, shadow = true }: { look: CharacterLook; moving?: RefObject<boolean>; shadow?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const pony = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 6);
  const reducedMotion = useRef(false);
  const hair = hairColor(look.hairColor);
  const outfit = outfitColor(look.outfitColor);
  const skin = look.skin ?? SKIN_COLOR;
  const accessory = look.accessory ?? (look.hair === 2 ? 'bow' : look.hair === 0 ? 'star' : undefined);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = media.matches; };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const walking = moving?.current ?? false;
    phase.current += dt * (walking ? 10 : 1.6);
    const t = phase.current;
    const motion = reducedMotion.current ? 0 : 1;
    const swing = walking ? Math.sin(t) * 0.55 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
    if (body.current) {
      body.current.position.y = (walking ? Math.abs(Math.sin(t)) * 0.045 : Math.sin(t) * 0.018) * motion;
      body.current.rotation.z = (walking ? Math.sin(t) * 0.025 : 0) * motion;
    }
    if (head.current) head.current.rotation.z = Math.sin(t * 0.65) * 0.035 * motion;
    if (pony.current) pony.current.rotation.x = Math.sin(t) * (walking ? 0.2 : 0.045) * motion;
    // 짧은 눈 깜빡임. 프레임마다 React 상태를 바꾸지 않는다.
    if (eyes.current) eyes.current.scale.y = !reducedMotion.current && t % 7.3 > 7.12 ? 0.12 : 1;
  });

  return (
    <group scale={look.adult ? [1.05, 1.14, 1.05] : [1, 1, 1]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} scale={[1, 0.7, 1]}>
        <circleGeometry args={[0.55, 24]} /><meshBasicMaterial color="#4c3d60" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* 가방은 어느 방향에서 보아도 친구를 알아보게 하는 실루엣이다. */}
        <Pebble at={[0, 0.99, -0.29]} scale={[0.34, 0.36, 0.16]} color="#c79262" shadow={shadow} />
        <Pebble at={[0, 0.91, -0.43]} scale={[0.23, 0.16, 0.045]} color="#edc59a" />
        <Pebble at={[0, 1.34, -0.3]} scale={[0.12, 0.06, 0.055]} color="#9e6b51" />
        {[-1, 1].map((side) => <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.165, 0.65, 0]}>
          <Pebble at={[0, -0.19, 0]} scale={[0.125, 0.27, 0.13]} color="#514760" shadow={shadow} />
          <Pebble at={[0, -0.42, 0.015]} scale={[0.12, 0.105, 0.13]} color="#fff6e5" />
          <Pebble at={[0, -0.51, 0.09]} scale={[0.16, 0.105, 0.225]} color="#fffaf0" shadow={shadow} />
          <Pebble at={[0, -0.55, 0.1]} scale={[0.165, 0.05, 0.23]} color="#d8d8e5" />
          <Pebble at={[0, -0.495, 0.275]} scale={[0.09, 0.035, 0.025]} color={outfit} />
        </group>)}
        <Pebble at={[0, 0.99, 0]} scale={[0.345, 0.4, 0.245]} color={outfit} shadow={shadow} />
        <Pebble at={[0, 0.685, 0.035]} scale={[0.31, 0.065, 0.225]} color="#fff5e4" />
        {[-1, 1].map((side) => <group key={side} position={[side * 0.35, 1.18, 0]} ref={side < 0 ? armL : armR} rotation={[0, 0, side * 0.12]}>
          <Pebble at={[side * 0.035, -0.15, 0]} scale={[0.145, 0.24, 0.145]} color={outfit} shadow={shadow} />
          <Pebble at={[side * 0.05, -0.32, 0.015]} scale={[0.125, 0.065, 0.13]} color="#fff5e4" />
          <Pebble at={[side * 0.05, -0.405, 0.025]} scale={[0.12, 0.135, 0.12]} color={skin} shadow={shadow} />
        </group>)}
        {[-1, 1].map((side) => <Pebble key={side} at={[side * 0.23, 1.04, 0.19]} scale={[0.035, 0.24, 0.04]} rotation={[0, 0, side * -0.15]} color="#ad7758" />)}
        <Pebble at={[0, 1.3, 0.1]} scale={[0.205, 0.095, 0.18]} color="#fff9ee" />
        <Pebble at={[0, 1.36, 0]} scale={[0.12, 0.11, 0.12]} color={skin} />
        <Pebble at={[0.12, 0.93, 0.233]} scale={[0.085, 0.09, 0.025]} color="#fff7e6" />
        <Pebble at={[0.12, 0.95, 0.26]} scale={[0.038, 0.038, 0.012]} color="#eeb95c" />
        <group ref={head} position={[0, 1.75, 0]}>
          {look.hair === 1 && <Pebble at={[0, -0.08, -0.13]} scale={[0.515, 0.5, 0.35]} color={hair} shadow={shadow} />}
          {look.hair === 2 && <group ref={pony} position={[0.29, 0.12, -0.3]}><Pebble at={[0, -0.27, -0.17]} scale={[0.18, 0.4, 0.2]} rotation={[0.35, 0, -0.2]} color={hair} shadow={shadow} /></group>}
          <Pebble at={[0, 0, 0]} scale={[0.49, 0.465, 0.405]} color={skin} shadow={shadow} />
          {[-1, 1].map((side) => <group key={side}>
            <Pebble at={[side * 0.47, -0.04, 0]} scale={[0.095, 0.13, 0.075]} color={skin} />
            <Pebble at={[side * 0.485, -0.04, 0.055]} scale={[0.04, 0.07, 0.025]} color="#de9b89" />
            <Pebble at={[side * 0.265, -0.135, 0.338]} scale={[0.095, 0.047, 0.018]} color="#ef9e9a" />
            <Pebble at={[side * 0.17, 0.125, 0.363]} scale={[0.072, 0.018, 0.025]} color={hair} />
          </group>)}
          <group ref={eyes} position={[0, 0.015, 0.365]}>
            {[-1, 1].map((side) => <group key={side} position={[side * 0.17, 0, 0]}>
              <Pebble at={[0, 0, 0]} scale={[0.077, 0.105, 0.03]} color="#fff9f1" />
              <Pebble at={[0, -0.003, 0.024]} scale={[0.058, 0.084, 0.026]} color="#493241" />
              <Pebble at={[0.007, -0.034, 0.045]} scale={[0.034, 0.032, 0.01]} color="#9f724d" />
              <Pebble at={[-0.018, 0.032, 0.048]} scale={[0.021, 0.026, 0.012]} color="#ffffff" />
              <Pebble at={[0.025, -0.032, 0.052]} scale={[0.01, 0.012, 0.008]} color="#fff3d5" />
            </group>)}
          </group>
          <Pebble at={[0, -0.075, 0.405]} scale={[0.037, 0.03, 0.035]} color={skin} />
          <mesh position={[0, -0.165, 0.366]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.073, 0.012, 6, 16, Math.PI]} /><meshBasicMaterial color="#ac626b" /></mesh>
          <mesh position={[0, 0, -0.015]} castShadow={shadow}><sphereGeometry args={[0.515, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.39]} /><meshStandardMaterial color={hair} roughness={0.5} /></mesh>
          {[-2, -1, 0, 1, 2].map((i) => <Pebble key={i} at={[i * 0.16, 0.265 + Math.abs(i) * 0.018, 0.285 - Math.abs(i) * 0.045]} scale={[0.15, i === 0 ? 0.15 : 0.19, 0.12]} rotation={[0, 0, -0.28]} color={hair} shadow={shadow} />)}
          {look.hair === 1 && [-1, 1].map((side) => <Pebble key={side} at={[side * 0.43, -0.06, 0.04]} scale={[0.1, 0.3, 0.22]} color={hair} />)}
          {accessory === 'bow' && <group position={[0.4, 0.23, 0.18]}>
            <Pebble at={[-0.075, 0, 0]} scale={[0.1, 0.075, 0.05]} color="#efa4b2" rotation={[0, 0, -0.35]} />
            <Pebble at={[0.075, 0, 0]} scale={[0.1, 0.075, 0.05]} color="#efa4b2" rotation={[0, 0, 0.35]} />
            <Pebble at={[0, 0, 0.025]} scale={[0.04, 0.045, 0.04]} color="#ffe6bf" />
          </group>}
          {accessory === 'flower' && <group position={[0.4, 0.2, 0.22]}>{[0, 1, 2, 3, 4].map((i) => <Pebble key={i} at={[Math.cos(i * Math.PI * 0.4) * 0.065, Math.sin(i * Math.PI * 0.4) * 0.065, 0]} scale={[0.05, 0.05, 0.025]} color="#fff5da" />)}<Pebble at={[0, 0, 0.025]} scale={[0.04, 0.04, 0.025]} color="#eeb95c" /></group>}
          {accessory === 'star' && <mesh position={[-0.36, 0.18, 0.285]} rotation={[0, 0, Math.PI / 4]}><octahedronGeometry args={[0.085, 0]} /><meshStandardMaterial color="#ffd476" roughness={0.4} /></mesh>}
          {accessory === 'glasses' && <group position={[0, 0.015, 0.409]}>{[-1, 1].map((side) => <mesh key={side} position={[side * 0.17, 0, 0]}><torusGeometry args={[0.122, 0.012, 6, 20]} /><meshStandardMaterial color="#75657f" /></mesh>)}<Pebble at={[0, 0.025, 0]} scale={[0.055, 0.012, 0.012]} color="#75657f" /></group>}
        </group>
      </group>
    </group>
  );
}
