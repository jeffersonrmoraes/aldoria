// Retratos 3D do personagem (criação e HUD): renderiza o modelo em um canvas auxiliar.
import * as THREE from 'three';
import { applyEquipment, playerActor } from './actors';
import type { Look } from '../data/looks';

let renderer: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
let cam: THREE.PerspectiveCamera;

function init() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 256, false);
  renderer.setClearColor(0x000000, 0);
  cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a6a', 1.4));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.position.set(2, 4, 4);
  scene.add(sun);
}

export interface PortraitOpts { rot?: number; size?: number; equip?: Parameters<typeof applyEquipment>[2] }

export function portrait(raceId: string, classId: string, tone: string, mode: 'full' | 'bust' = 'full', look?: Look | null, opts: PortraitOpts = {}): HTMLCanvasElement {
  init();
  const size = opts.size ?? 256;
  renderer!.setSize(size, size, false);
  const a = playerActor(raceId, classId, tone, look);
  if (opts.equip) applyEquipment(a, classId, opts.equip);
  a.root.rotation.y = opts.rot ?? (mode === 'full' ? -0.45 : -0.25);
  a.update(0.4, 0);
  scene.add(a.root);
  if (mode === 'full') { cam.position.set(0, 1.0, 6.4); cam.lookAt(0, 0.88, 0); }
  else { cam.position.set(0, 1.55, 3.0); cam.lookAt(0, 1.38, 0); }
  renderer!.render(scene, cam);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  out.getContext('2d')!.drawImage(renderer!.domElement, 0, 0);
  scene.remove(a.root);
  return out;
}
