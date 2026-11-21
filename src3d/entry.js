// Bundel voor de 3D-wandeling: three.js + viewer + glTF-export/-import. Wordt js/vendor/tuin3d.js
// (window.Tuin3D). Opnieuw bouwen: sh tools/build3d.sh

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createViewer, disposeTree, sunDirection } from './viewer.js';

/**
 * Kopie van een scène waarin elke InstancedMesh één gewone mesh is (met kleuren per hoekpunt), zodat
 * elk programma (Blender, online viewers) het model zonder extensies kan lezen.
 */
export function flattenInstances(root) {
  const out = root.clone(true);
  const swaps = [];
  out.traverse((o) => { if (o.isInstancedMesh) swaps.push(o); });
  for (const im of swaps) {
    const g = im.geometry.index ? im.geometry.toNonIndexed() : im.geometry.clone();
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const P = new Float32Array(n * 3 * im.count), N = new Float32Array(n * 3 * im.count), C = new Float32Array(n * 3 * im.count);
    const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), col = new THREE.Color(1, 1, 1);
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      nm.getNormalMatrix(m);
      if (im.instanceColor) im.getColorAt(i, col);
      for (let j = 0; j < n; j++) {
        const k = (i * n + j) * 3;
        v.fromBufferAttribute(pos, j).applyMatrix4(m); P[k] = v.x; P[k + 1] = v.y; P[k + 2] = v.z;
        v.fromBufferAttribute(nor, j).applyMatrix3(nm).normalize(); N[k] = v.x; N[k + 1] = v.y; N[k + 2] = v.z;
        if (g.attributes.color) { C[k] = g.attributes.color.getX(j) * col.r; C[k + 1] = g.attributes.color.getY(j) * col.g; C[k + 2] = g.attributes.color.getZ(j) * col.b; } else { C[k] = col.r; C[k + 1] = col.g; C[k + 2] = col.b; }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    if (g.attributes.uv) {
      const uv = g.attributes.uv, U = new Float32Array(n * 2 * im.count);
      for (let i = 0; i < im.count; i++) for (let j = 0; j < n; j++) { U[(i * n + j) * 2] = uv.getX(j); U[(i * n + j) * 2 + 1] = uv.getY(j); }
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    }
    const mat = im.material.clone();
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = im.name;
    mesh.position.copy(im.position); mesh.quaternion.copy(im.quaternion); mesh.scale.copy(im.scale);
    im.parent.add(mesh);
    im.parent.remove(im);
  }
  return out;
}

/**
 * Het model als .glb (ArrayBuffer). Planten die vaak herhaald worden blijven één model met posities
 * (EXT_mesh_gpu_instancing: Blender 3.6+, three.js, Babylon); zo blijft het bestand klein.
 * flat = true: alles uitgeschreven (groter bestand, voor oudere programma's).
 */
export async function exportGlb(root, flat = false) {
  const out = flat ? flattenInstances(root) : root;
  out.updateMatrixWorld(true);
  return new GLTFExporter().parseAsync(out, { binary: true, onlyVisible: true });
}

function fromBase64(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Los geëxporteerd bestand: model inlezen en de wandeling starten. */
export async function openStandalone({ container, glb, info }) {
  const gltf = await new GLTFLoader().parseAsync(typeof glb === 'string' ? fromBase64(glb) : glb, '');
  return createViewer({ container, content: gltf.scene, info });
}

const api = { THREE, GLTFExporter, GLTFLoader, createViewer, disposeTree, sunDirection, flattenInstances, exportGlb, openStandalone };
if (typeof window !== 'undefined') window.Tuin3D = api;
export default api;
