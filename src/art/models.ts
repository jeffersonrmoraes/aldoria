// Modelos 3D: KayKit Adventurers 1.0 e Skeletons 1.0 (Kay Lousberg, www.kaylousberg.com) — licença CC0.
// Os GLB foram reduzidos (texturas 256px, compressão meshopt) e compartilham as mesmas animações (anims.glb).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import knight from '../assets/models/Knight.glb?url';
import barbarian from '../assets/models/Barbarian.glb?url';
import mage from '../assets/models/Mage.glb?url';
import rogue from '../assets/models/Rogue.glb?url';
import skeleton from '../assets/models/Skeleton_Warrior.glb?url';
import skMinion from '../assets/models/Skeleton_Minion.glb?url';
import skMage from '../assets/models/Skeleton_Mage.glb?url';
import skRogue from '../assets/models/Skeleton_Rogue.glb?url';
import anims from '../assets/models/anims.glb?url';

const URLS: Record<string, string> = { Knight: knight, Barbarian: barbarian, Mage: mage, Rogue: rogue, Skeleton: skeleton, SkMinion: skMinion, SkMage: skMage, SkRogue: skRogue };
export const CHAR_H = 1.7; // altura padrão (em tiles) de um personagem de escala 1

const base: Record<string, THREE.Object3D> = {};
export const clips: Record<string, THREE.AnimationClip> = {};

async function parse(url: string) {
  const buf = await (await fetch(url)).arrayBuffer();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(buf, '');
}

export async function loadModels(): Promise<void> {
  if (Object.keys(base).length) return;
  const all = await Promise.all([...Object.entries(URLS).map(([k, u]) => parse(u).then((g) => [k, g] as const)), parse(anims).then((g) => ['anims', g] as const)]);
  for (const [k, g] of all) {
    if (k === 'anims') { for (const c of g.animations) clips[c.name] = c; continue; }
    base[k] = g.scene;
  }
}

/** Clona um modelo com materiais próprios (para tingir sem afetar outras instâncias). */
export function cloneModel(name: string): THREE.Object3D {
  const m = SkeletonUtils.clone(base[name]);
  m.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.material = (mesh.material as THREE.Material).clone();
      mesh.castShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return m;
}

const heights: Record<string, number> = {};
export function modelScale(name: string): number {
  if (!heights[name]) {
    const box = new THREE.Box3();
    base[name].traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && /_(Head|Body|LegLeft|LegRight)$/.test(mesh.name)) box.expandByObject(mesh);
    });
    heights[name] = box.max.y - box.min.y || 2;
  }
  return CHAR_H / heights[name];
}

