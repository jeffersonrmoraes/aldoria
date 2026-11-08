// Aplica a aparência (`Look`) a um personagem 3D: cor dos olhos (recolorindo os olhos do modelo) e cor da roupa.
import * as THREE from 'three';
import type { SkinnedActor } from './actors';
import { Look, OUTFIT_TINT } from '../data/looks';

const V3 = THREE.Vector3;

/** Olhos desenhados no modelo (medidos): afastamento (fração da largura da cabeça) e altura (fração da altura, a partir do centro). */
const EYES: Record<string, { ex: number; ey: number }> = {
  Knight: { ex: 0.187, ey: -0.136 }, Mage: { ex: 0.184, ey: -0.039 }, Rogue: { ex: 0.181, ey: -0.079 }, Barbarian: { ex: 0.187, ey: -0.03 },
};

export function applyLook(a: SkinnedActor, look: Look, tone: string) {
  // --- roupa: tinge corpo, braços, pernas e capa ---
  const tint = OUTFIT_TINT[look.outfit];
  a.model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !tint) return;
    if (/_(Body|ArmLeft|ArmRight|LegLeft|LegRight|Cape)$/.test(o.name)) (m.material as THREE.MeshStandardMaterial).color.set(tint).multiplyScalar(1.7);
  });
  const head = a.head as THREE.SkinnedMesh | null;
  if (!head || !(head as THREE.SkinnedMesh).isSkinnedMesh) return;

  a.model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head);
  const c = box.getCenter(new V3()), sz = box.getSize(new V3());
  const u = sz.y;                                   // unidade: altura da cabeça
  const eye = EYES[a.spec.model] ?? EYES.Knight;
  const E = c.y + eye.ey * sz.y;                    // altura dos olhos
  const EX = eye.ex * sz.x;                         // afastamento dos olhos
  const eyeC = new THREE.Color(look.eyeColor);

  // --- cor dos olhos (os olhos desenhados no modelo mudam de cor) ---
  recolorBaked(head, c, E, u, eyeC, EX);
}

/** Troca a cor dos olhos desenhados na textura da cabeça (por cor de vértice). O resto do modelo fica como o original. */
const texCache = new WeakMap<object, { w: number; h: number; d: Uint8ClampedArray }>();
function recolorBaked(head: THREE.SkinnedMesh, c: THREE.Vector3, E: number, u: number, eyeC: THREE.Color, EX: number) {
  const m = head.material as THREE.MeshStandardMaterial;
  const img = m.map?.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!img) return;
  let tex = texCache.get(img);
  if (!tex) {
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d')!; g.drawImage(img, 0, 0);
    tex = { w: cv.width, h: cv.height, d: g.getImageData(0, 0, cv.width, cv.height).data };
    texCache.set(img, tex);
  }
  const geo = head.geometry = head.geometry.clone();
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const cols = new Float32Array(pos.count * 3).fill(1);
  const t = new V3(), base = m.color.clone();
  for (let i = 0; i < pos.count; i++) {
    t.fromBufferAttribute(pos, i); head.applyBoneTransform(i, t); t.applyMatrix4(head.matrixWorld);
    const px = Math.min(tex.w - 1, Math.floor(uv.getX(i) * tex.w)), py = Math.min(tex.h - 1, Math.floor(uv.getY(i) * tex.h));
    const k = (py * tex.w + px) * 4, r = tex.d[k], g = tex.d[k + 1], b = tex.d[k + 2];
    const inEye = r < 50 && g < 50 && b < 60 && t.z > c.z && ((Math.abs(t.x - c.x) - EX) / (0.065 * u)) ** 2 + ((t.y - E) / (0.075 * u)) ** 2 < 1;
    if (!inEye) continue;
    const orig = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).multiply(base);
    cols[i * 3] = Math.min(500, eyeC.r / Math.max(0.004, orig.r));
    cols[i * 3 + 1] = Math.min(500, eyeC.g / Math.max(0.004, orig.g));
    cols[i * 3 + 2] = Math.min(500, eyeC.b / Math.max(0.004, orig.b));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  m.vertexColors = true; m.needsUpdate = true;
}
