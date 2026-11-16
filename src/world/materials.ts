import * as THREE from 'three';

// 툰 셰이딩용 3단계 그라데이션 맵과 이모지 스프라이트 텍스처 (아트 바이블 4절).

let gradient: THREE.DataTexture | null = null;

export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    const data = new Uint8Array([165, 165, 165, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const emojiCache = new Map<string, THREE.Texture>();

/** 이모지를 그린 텍스처 (간판·퀘스트 마크). 외부 폰트나 이미지 파일이 필요 없다. */
export function emojiTexture(emoji: string): THREE.Texture {
  const cached = emojiCache.get(emoji);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = `${size * 0.72}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  emojiCache.set(emoji, texture);
  return texture;
}

/** 밤에 켜지는 창문 불빛. 모든 건물이 같은 재질을 함께 쓴다 → 한 번만 갱신하면 된다. */
export const windowMaterial = new THREE.MeshStandardMaterial({ color: '#9fd3ee', emissive: '#ffd27a', emissiveIntensity: 0 });
