import { Bloom, EffectComposer } from '@react-three/postprocessing';

/** High 품질에서만 쓰는 후처리: 창문 불빛·별·간판이 은은하게 번진다. */
export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.45} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
    </EffectComposer>
  );
}
