import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { DayPhase, LifeStage, Profile } from '@/types';
import { LIGHT_PRESETS, STAGE_THEMES, type StageTheme } from '@/config/theme';
import { SPAWN, ZONES, zoneById, type ZoneDef } from '@/config/zones';
import { useUi } from '@/app/uiStore';
import { Character, type CharacterLook } from './Character';
import { emojiTexture, toonGradient, windowMaterial } from './materials';
import { attachKeyboard, cameraYaw, inputVector, moveTarget, playerPos, resetInput } from './input';
import { qualityConfig, type Quality } from './quality';

// 3D 학교 월드 (React Three Fiber).
//  · 스타일라이즈드 저폴리 + 툰 셰이딩, 낮/밤이 부드럽게 바뀐다.
//  · 조작: WASD/방향키, 마우스 드래그로 카메라 회전, 땅을 탭하면 그곳으로 이동, 모바일은 가상 조이스틱.
//  · 외부 모델(GLB)이 없어도 프리미티브만으로 실행된다. public/models/ 에 CC0 모델을 넣으면 건물이 교체된다.

const Effects = lazy(() => import('./Effects'));
const MAP_RADIUS = 34;
const NEAR_DISTANCE = 5;
const WALK_SPEED = 7.5;

const NPC_LOOKS: Record<string, CharacterLook> = {
  harper: { hair: 1, hairColor: 1, outfitColor: 3 },
  leo: { hair: 0, hairColor: 2, outfitColor: 1 },
  ava: { hair: 2, hairColor: 3, outfitColor: 2 },
  mrbooks: { hair: 0, hairColor: 0, outfitColor: 4 },
};

// ── 하늘·조명 (낮/밤 순환) ─────────────────────────────────────
function Atmosphere({ phase, shadows, stars }: { phase: DayPhase; shadows: boolean; stars: number }) {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const starMat = useRef<THREE.PointsMaterial>(null);
  const target = LIGHT_PRESETS[phase];
  const cur = useRef({
    top: new THREE.Color(target.skyTop), bottom: new THREE.Color(target.skyBottom), sun: new THREE.Color(target.sun),
    intensity: target.sunIntensity, ambient: target.ambient, night: target.night, pos: new THREE.Vector3(...target.sunPos),
  });
  const tmp = useMemo(() => ({ color: new THREE.Color(), vec: new THREE.Vector3() }), []);

  const dome = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(target.skyTop) }, bottom: { value: new THREE.Color(target.skyBottom) } },
        vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 bottom; varying vec3 vPos; void main(){ float h = clamp(normalize(vPos).y * 1.5 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0);\n#include <colorspace_fragment>\n}',
      }),
    // 처음 한 번만 만든다. 색은 매 프레임 보간한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const starGeo = useMemo(() => {
    const pts = new Float32Array(stars * 3);
    for (let i = 0; i < stars; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const y = 0.15 + ((i * 0.618034) % 1) * 0.85;
      const r = Math.sqrt(1 - y * y);
      pts.set([Math.cos(a) * r * 100, y * 100, Math.sin(a) * r * 100], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return geo;
  }, [stars]);

  useEffect(() => {
    scene.fog = new THREE.Fog(target.skyBottom, 55, 130);
    return () => { scene.fog = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useFrame((_, dt) => {
    // 약 2~3초에 걸쳐 목표 프리셋으로 부드럽게 다가간다.
    const k = 1 - Math.exp(-dt * 1.4);
    const c = cur.current;
    c.top.lerp(tmp.color.set(target.skyTop), k);
    c.bottom.lerp(tmp.color.set(target.skyBottom), k);
    c.sun.lerp(tmp.color.set(target.sun), k);
    c.intensity += (target.sunIntensity - c.intensity) * k;
    c.ambient += (target.ambient - c.ambient) * k;
    c.night += (target.night - c.night) * k;
    c.pos.lerp(tmp.vec.set(...target.sunPos), k);
    (dome.uniforms.top as { value: THREE.Color }).value.copy(c.top);
    (dome.uniforms.bottom as { value: THREE.Color }).value.copy(c.bottom);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(c.bottom);
    if (sun.current) {
      sun.current.color.copy(c.sun);
      sun.current.intensity = c.intensity;
      sun.current.position.copy(c.pos);
    }
    if (hemi.current) {
      hemi.current.intensity = c.ambient;
      hemi.current.color.copy(c.top).lerp(tmp.color.set('#ffffff'), 0.5);
    }
    if (starMat.current) starMat.current.opacity = Math.max(0, c.night - 0.3) * 1.4;
    windowMaterial.emissiveIntensity = c.night * 1.6;
  });

  return (
    <>
      <mesh material={dome}><sphereGeometry args={[150, 24, 16]} /></mesh>
      <points geometry={starGeo}><pointsMaterial ref={starMat} color="#ffffff" size={0.9} transparent opacity={0} fog={false} depthWrite={false} /></points>
      <hemisphereLight ref={hemi} args={['#ffffff', '#6b8f5e', target.ambient]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-far={90}
        shadow-bias={-0.0006}
      />
    </>
  );
}

// ── 땅과 길 ─────────────────────────────────────────────────
function Ground({ theme }: { theme: StageTheme }) {
  const marker = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!marker.current) return;
    const p = moveTarget.point;
    marker.current.visible = p !== null;
    if (p) {
      marker.current.position.set(p[0], 0.06, p[1]);
      marker.current.rotation.z += 0.04;
    }
  });
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          // 드래그(카메라 회전)가 아닌 "탭"일 때만 이동 목표로 삼는다.
          if (e.delta > 6) return;
          moveTarget.point = [e.point.x, e.point.z];
        }}
      >
        <circleGeometry args={[MAP_RADIUS + 8, 48]} />
        <meshToonMaterial color={theme.ground} gradientMap={toonGradient()} />
      </mesh>
      {ZONES.map((z) => {
        const len = Math.hypot(z.pos[0], z.pos[1] - 4);
        const angle = Math.atan2(z.pos[0], z.pos[1] - 4);
        return (
          <mesh key={z.id} rotation={[-Math.PI / 2, 0, angle]} position={[z.pos[0] / 2, 0.02, (z.pos[1] + 4) / 2]} receiveShadow>
            <planeGeometry args={[2.2, len]} />
            <meshToonMaterial color={theme.path} gradientMap={toonGradient()} />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 4]} receiveShadow>
        <circleGeometry args={[4.5, 32]} />
        <meshToonMaterial color={theme.path} gradientMap={toonGradient()} />
      </mesh>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.45, 0.65, 6]} />
        <meshBasicMaterial color="#f6b352" transparent opacity={0.9} />
      </mesh>
    </>
  );
}

// ── 선택적 GLB 모델 (없으면 프리미티브 폴백) ──────────────────────
let modelList: Promise<string[]> | null = null;
function loadModelList(): Promise<string[]> {
  modelList ??= fetch(`${import.meta.env.BASE_URL}models/manifest.json`)
    .then((r) => r.json() as Promise<{ models?: unknown }>)
    .then((j) => (Array.isArray(j.models) ? j.models.filter((m): m is string => typeof m === 'string') : []))
    .catch(() => []);
  return modelList;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Glb({ name }: { name: string }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/${name}.glb`);
  const clone = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clone} />;
}

function OptionalModel({ name, names, children }: { name: string; names: readonly string[]; children: ReactNode }) {
  if (!names.includes(name)) return <>{children}</>;
  return (
    <ModelBoundary fallback={children}>
      <Suspense fallback={children}><Glb name={name} /></Suspense>
    </ModelBoundary>
  );
}

// ── 장소 건물 ────────────────────────────────────────────────
function Sign({ emoji, y, scale = 2.2 }: { emoji: string; y: number; scale?: number }) {
  const ref = useRef<THREE.Sprite>(null);
  const map = useMemo(() => emojiTexture(emoji), [emoji]);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 2) * 0.15; });
  return <sprite ref={ref} position={[0, y, 0]} scale={[scale, scale, 1]}><spriteMaterial map={map} transparent depthWrite={false} /></sprite>;
}

function ZoneProps({ id }: { id: string }) {
  const toon = (color: string) => <meshToonMaterial color={color} gradientMap={toonGradient()} />;
  switch (id) {
    case 'playground':
      return (
        <>
          <mesh position={[-2.4, 0.45, 1.6]} castShadow><sphereGeometry args={[0.45, 16, 12]} />{toon('#ffffff')}</mesh>
          <mesh position={[2.4, 0.9, 1]} rotation={[0, 0, -0.6]} castShadow><boxGeometry args={[2.6, 0.2, 1]} />{toon('#e0526b')}</mesh>
          <mesh position={[3.3, 0.9, 1]} castShadow><boxGeometry args={[0.25, 1.8, 1]} />{toon('#f6b352')}</mesh>
        </>
      );
    case 'library':
      return (
        <>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-2.6, 0.25 + i * 0.32, 1.8]} rotation={[0, i * 0.4, 0]} castShadow><boxGeometry args={[1, 0.28, 0.75]} />{toon(['#e0526b', '#7cc36a', '#f6b352'][i] as string)}</mesh>
          ))}
        </>
      );
    case 'cafeteria':
      return (
        <>
          <mesh position={[-2.4, 0.6, 1.8]} castShadow><cylinderGeometry args={[1, 1, 0.14, 20]} />{toon('#ffffff')}</mesh>
          <mesh position={[-2.4, 0.3, 1.8]}><cylinderGeometry args={[0.14, 0.14, 0.6, 8]} />{toon('#9b6b4a')}</mesh>
        </>
      );
    case 'home':
      return (
        <>
          <mesh position={[2.5, 0.35, 1.6]} castShadow><boxGeometry args={[1.5, 0.5, 2.3]} />{toon('#8e7cc3')}</mesh>
          <mesh position={[2.5, 0.7, 0.75]}><boxGeometry args={[1.1, 0.24, 0.55]} />{toon('#ffffff')}</mesh>
        </>
      );
    case 'music':
      return <mesh position={[-2.5, 0.7, 1.7]} castShadow><cylinderGeometry args={[0.7, 0.7, 1.2, 16]} />{toon('#e8743b')}</mesh>;
    default:
      return (
        <>
          <mesh position={[-2.5, 0.55, 1.7]} castShadow><boxGeometry args={[1.4, 0.14, 0.9]} />{toon('#c98d5a')}</mesh>
          <mesh position={[-2.5, 0.27, 1.7]}><boxGeometry args={[1.2, 0.5, 0.1]} />{toon('#9b6b4a')}</mesh>
        </>
      );
  }
}

function ZoneBuilding({ zone, theme, shadows, quest, models }: { zone: ZoneDef; theme: StageTheme; shadows: boolean; quest: boolean; models: readonly string[] }) {
  const near = useUi((s) => s.nearZone === zone.id);
  const ring = useRef<THREE.Mesh>(null);
  const h = 3.2 * theme.height;
  const isHome = zone.id === 'home';
  useFrame(({ clock }) => { if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.03); });
  return (
    <group position={[zone.pos[0], 0, zone.pos[1]]}>
      <mesh position={[0, 0.08, 0.6]} receiveShadow>
        <cylinderGeometry args={[4.6, 4.8, 0.16, 28]} />
        <meshToonMaterial color={zone.color} gradientMap={toonGradient()} transparent opacity={0.85} />
      </mesh>
      <OptionalModel name={`zone-${zone.id}`} names={models}>
        <group position={[0, 0, -2.4]}>
          <mesh position={[0, h / 2, 0]} castShadow={shadows} receiveShadow>
            <boxGeometry args={[6.4, h, 3]} />
            <meshToonMaterial color={isHome ? '#fce3d0' : theme.wall} gradientMap={toonGradient()} />
          </mesh>
          {isHome ? (
            <mesh position={[0, h + 1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={shadows}>
              <coneGeometry args={[4.9, 2.2, 4]} />
              <meshToonMaterial color={zone.color} gradientMap={toonGradient()} />
            </mesh>
          ) : (
            <mesh position={[0, h + 0.25, 0]} castShadow={shadows}>
              <boxGeometry args={[7, 0.5, 3.6]} />
              <meshToonMaterial color={zone.color} gradientMap={toonGradient()} />
            </mesh>
          )}
          <mesh position={[0, 1, 1.52]}><boxGeometry args={[1.3, 2, 0.08]} /><meshToonMaterial color="#9b6b4a" gradientMap={toonGradient()} /></mesh>
          {[-2.1, 2.1].map((x) => (
            <mesh key={x} position={[x, Math.min(h - 1, 1.9), 1.52]} material={windowMaterial}><boxGeometry args={[1.2, 1.1, 0.08]} /></mesh>
          ))}
          {theme.height > 1.4 ? [-2.1, 0, 2.1].map((x) => (
            <mesh key={`u${x}`} position={[x, h - 1, 1.52]} material={windowMaterial}><boxGeometry args={[1.2, 1, 0.08]} /></mesh>
          )) : null}
        </group>
      </OptionalModel>
      <ZoneProps id={zone.id} />
      <Sign emoji={zone.icon} y={h + (isHome ? 3.4 : 2)} />
      {quest ? <group position={[2.6, 0, 1.2]}><Sign emoji="❗" y={3.1} scale={1.3} /></group> : null}
      {near ? (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0.6]}>
          <ringGeometry args={[4.3, 4.7, 40]} />
          <meshBasicMaterial color="#fff6e5" transparent opacity={0.9} />
        </mesh>
      ) : null}
      {zone.npcId && NPC_LOOKS[zone.npcId] ? (
        <group position={[2.6, 0, 1.2]} rotation={[0, -0.5, 0]}>
          <Character look={NPC_LOOKS[zone.npcId] as CharacterLook} shadow={shadows} />
        </group>
      ) : null}
    </group>
  );
}

// ── 나무 (인스턴싱: 수십 그루를 그리기 호출 2번으로) ─────────────────
function Trees({ count, shadows }: { count: number; shadows: boolean }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let placed = 0;
    for (let i = 0; placed < count && i < count * 8; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = 9 + ((i * 7.31) % 1) * (MAP_RADIUS - 5);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // 건물·길 근처는 비워 둔다.
      if (ZONES.some((zn) => Math.hypot(zn.pos[0] - x, zn.pos[1] - z) < 8) || Math.abs(x) < 2.5) continue;
      const s = 0.8 + ((i * 3.7) % 1) * 0.7;
      trunks.current?.setMatrixAt(placed, m.compose(new THREE.Vector3(x, 0.7 * s, z), q, new THREE.Vector3(s, s, s)));
      crowns.current?.setMatrixAt(placed, m.compose(new THREE.Vector3(x, 2.3 * s, z), q, new THREE.Vector3(s, s, s)));
      placed++;
    }
    if (trunks.current) { trunks.current.count = placed; trunks.current.instanceMatrix.needsUpdate = true; }
    if (crowns.current) { crowns.current.count = placed; crowns.current.instanceMatrix.needsUpdate = true; }
  }, [count]);
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, count]} castShadow={shadows}>
        <cylinderGeometry args={[0.22, 0.3, 1.4, 6]} />
        <meshToonMaterial color="#9b6b4a" gradientMap={toonGradient()} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, count]} castShadow={shadows}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshToonMaterial color="#5fae58" gradientMap={toonGradient()} />
      </instancedMesh>
    </>
  );
}

// ── 플레이어와 3인칭 카메라 ─────────────────────────────────────
function Player({ look, shadows }: { look: CharacterLook; shadows: boolean }) {
  const group = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const { camera } = useThree();
  const teleport = useUi((s) => s.teleport);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (group.current) group.current.position.set(SPAWN[0], 0, SPAWN[1]);
    return attachKeyboard();
  }, []);

  // 퀘스트 로그·지도에서 장소를 고르면 그 앞으로 순간 이동한다.
  useEffect(() => {
    const zone = zoneById(teleport);
    if (!zone || !group.current) return;
    group.current.position.set(zone.pos[0], 0, zone.pos[1] + 3.6);
    moveTarget.point = null;
    useUi.getState().requestTeleport(null);
  }, [teleport]);

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const blocked = useUi.getState().overlay !== null;
    let dx = 0;
    let dz = 0;
    if (blocked) {
      resetInput();
    } else {
      const [ix, iy] = inputVector();
      if (ix !== 0 || iy !== 0) {
        // 입력은 화면 기준 → 카메라가 보는 방향에 맞춰 돌린다.
        const cos = Math.cos(cameraYaw.value);
        const sin = Math.sin(cameraYaw.value);
        dx = ix * cos + iy * sin;
        dz = -ix * sin + iy * cos;
      } else if (moveTarget.point) {
        const tx = moveTarget.point[0] - g.position.x;
        const tz = moveTarget.point[1] - g.position.z;
        const dist = Math.hypot(tx, tz);
        if (dist < 0.3) moveTarget.point = null;
        else { dx = tx / dist; dz = tz / dist; }
      }
    }
    moving.current = dx !== 0 || dz !== 0;
    if (moving.current) {
      g.position.x += dx * WALK_SPEED * dt;
      g.position.z += dz * WALK_SPEED * dt;
      const r = Math.hypot(g.position.x, g.position.z);
      if (r > MAP_RADIUS) { g.position.x *= MAP_RADIUS / r; g.position.z *= MAP_RADIUS / r; }
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 12);
    }
    playerPos.x = g.position.x;
    playerPos.z = g.position.z;

    // 가까운 장소 찾기 → HUD 에 행동 버튼이 뜬다.
    let near: string | null = null;
    for (const z of ZONES) {
      if (Math.hypot(z.pos[0] - g.position.x, z.pos[1] + 0.6 - g.position.z) < NEAR_DISTANCE) { near = z.id; break; }
    }
    useUi.getState().setNearZone(near);

    // 3인칭 카메라: 플레이어 뒤·위에서 부드럽게 따라간다.
    const yaw = cameraYaw.value;
    camTarget.set(g.position.x + Math.sin(yaw) * 15, 11, g.position.z + Math.cos(yaw) * 15);
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 6));
    camera.lookAt(g.position.x, 1.4, g.position.z);
  });

  return <group ref={group}><Character look={look} moving={moving} shadow={shadows} /></group>;
}

/** P 성향: 탐험 중에 만나는 깜짝 이야기 이벤트 (🎲 에 다가가면 열린다) */
function Surprise({ onFound }: { onFound: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const spot = useRef<[number, number]>([-7, 16]);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(spot.current[0], 0, spot.current[1]);
    if (useUi.getState().overlay === null && Math.hypot(playerPos.x - spot.current[0], playerPos.z - spot.current[1]) < 1.6) {
      const a = Math.random() * Math.PI * 2;
      spot.current = [Math.cos(a) * 9, 6 + Math.sin(a) * 9];
      onFound();
    }
  });
  return <group ref={ref}><Sign emoji="🎲" y={1.4} scale={1.5} /></group>;
}

export interface World3DProps {
  phase: DayPhase;
  stage: LifeStage;
  quality: Quality;
  profile: Profile;
  /** 메인 퀘스트가 있는 장소 (❗ 표시) */
  questZones: readonly string[];
  surprise: boolean;
  onSurprise: () => void;
}

export default function World3D({ phase, stage, quality, profile, questZones, surprise, onSurprise }: World3DProps) {
  const cfg = qualityConfig(quality, typeof window === 'undefined' ? 1 : window.devicePixelRatio);
  const theme = STAGE_THEMES[stage];
  const [models, setModels] = useState<readonly string[]>([]);
  const drag = useRef<{ x: number } | null>(null);
  useEffect(() => { void loadModelList().then(setModels); }, []);

  return (
    <div
      className="absolute inset-0 touch-none"
      onPointerDown={(e) => { drag.current = { x: e.clientX }; }}
      onPointerMove={(e) => {
        if (!drag.current || e.buttons === 0) return;
        cameraYaw.value -= (e.clientX - drag.current.x) * 0.006;
        drag.current.x = e.clientX;
      }}
      onPointerUp={() => { drag.current = null; }}
    >
      <Canvas
        shadows={cfg.shadows}
        dpr={cfg.dpr}
        gl={{ antialias: cfg.antialias, powerPreference: 'high-performance' }}
        camera={{ fov: 48, near: 0.5, far: 320, position: [SPAWN[0], 11, SPAWN[1] + 15] }}
      >
        <Atmosphere phase={phase} shadows={cfg.shadows} stars={cfg.stars} />
        <Ground theme={theme} />
        {ZONES.map((z) => (
          <ZoneBuilding key={z.id} zone={z} theme={theme} shadows={cfg.shadows} quest={questZones.includes(z.id)} models={models} />
        ))}
        <Trees count={Math.round(cfg.trees * theme.trees)} shadows={cfg.shadows} />
        <Player look={profile} shadows={cfg.shadows} />
        {surprise ? <Surprise onFound={onSurprise} /> : null}
        {cfg.bloom ? <Suspense fallback={null}><Effects /></Suspense> : null}
      </Canvas>
    </div>
  );
}
