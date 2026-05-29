// Genera un departamento 2D/1B procedural como GLB para la demo del visor.
// Salida: public/demo/model.glb  (piso, muros, aberturas de puertas, ventanas con
// vidrio y muebles simples). Ejecutar con: node tools/build-apartment.mjs
//
// Sistema de coordenadas: X = ancho, Z = profundidad, Y = alto. El modelo se centra
// en el origen (la planta 0..W x 0..D se traslada restando W/2 y D/2).

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, mergeDocuments } from '@gltf-transform/functions';

// ---- Dimensiones del departamento (metros) ----
const W = 9; // ancho (X)
const D = 7; // profundidad (Z)
const H = 2.6; // alto de muro
const T = 0.12; // espesor de muro
const FLOOR_T = 0.06;
const OX = W / 2; // offset para centrar en X
const OZ = D / 2; // offset para centrar en Z

const DOOR_H = 2.05;
const SILL = 0.9; // alféizar (parte baja de ventana)
const HEAD = 2.15; // dintel (parte alta de ventana)

// ---- Materiales (índices) ----
const materials = [
  { name: 'piso', baseColorFactor: [0.82, 0.74, 0.62, 1], metallicFactor: 0, roughnessFactor: 0.9 },
  { name: 'muro', baseColorFactor: [0.93, 0.93, 0.92, 1], metallicFactor: 0, roughnessFactor: 0.95 },
  { name: 'vidrio', baseColorFactor: [0.55, 0.75, 0.85, 0.28], metallicFactor: 0, roughnessFactor: 0.05, alphaMode: 'BLEND' },
  { name: 'cama', baseColorFactor: [0.85, 0.85, 0.88, 1], metallicFactor: 0, roughnessFactor: 0.8 },
  { name: 'sofa', baseColorFactor: [0.35, 0.45, 0.55, 1], metallicFactor: 0, roughnessFactor: 0.8 },
  { name: 'madera', baseColorFactor: [0.55, 0.38, 0.24, 1], metallicFactor: 0, roughnessFactor: 0.7 },
  { name: 'cocina', baseColorFactor: [0.25, 0.27, 0.3, 1], metallicFactor: 0.1, roughnessFactor: 0.5 },
];
const MAT = Object.fromEntries(materials.map((m, i) => [m.name, i]));

// ---- Acumulador de cajas: cada una es un nodo (cubo unitario escalado/posicionado) ----
const boxes = []; // { center:[x,y,z], size:[w,h,d], mat }
function addBox(cx, cy, cz, sx, sy, sz, mat) {
  boxes.push({ center: [cx - OX, cy, cz - OZ], size: [sx, sy, sz], mat });
}

// Muro recto a lo largo de un eje, con aberturas (puertas/ventanas).
// axis: 'x' (corre en X, z fijo) | 'z' (corre en Z, x fijo)
// openings: [{ a, b, kind:'door'|'window' }]
function addWall(axis, fixed, runStart, runEnd, openings = []) {
  const sorted = [...openings].sort((p, q) => p.a - q.a);
  let cursor = runStart;
  const solid = (r0, r1, yLo, yHi, mat = MAT.muro, thick = T) => {
    if (r1 - r0 < 1e-4 || yHi - yLo < 1e-4) return;
    const rc = (r0 + r1) / 2;
    const yc = (yLo + yHi) / 2;
    const len = r1 - r0;
    const hgt = yHi - yLo;
    if (axis === 'x') addBox(rc, yc, fixed, len, hgt, thick, mat);
    else addBox(fixed, yc, rc, thick, hgt, len, mat);
  };
  for (const op of sorted) {
    solid(cursor, op.a, 0, H); // tramo lleno antes de la abertura
    if (op.kind === 'door') {
      solid(op.a, op.b, DOOR_H, H); // dintel sobre la puerta
    } else {
      solid(op.a, op.b, 0, SILL); // antepecho bajo la ventana
      solid(op.a, op.b, HEAD, H); // dintel sobre la ventana
      solid(op.a, op.b, SILL, HEAD, MAT.vidrio, 0.04); // vidrio
    }
    cursor = op.b;
  }
  solid(cursor, runEnd, 0, H); // tramo final
}

// ---- Piso ----
addBox(W / 2, -FLOOR_T / 2, D / 2, W, FLOOR_T, D, MAT.piso);

// ---- Muros perimetrales (con puerta de acceso y ventanas) ----
// Frente (z=0): puerta de acceso al living
addWall('x', 0, 0, W, [{ a: 6.0, b: 7.2, kind: 'door' }]);
// Fondo (z=D): ventana de cocina
addWall('x', D, 0, W, [{ a: 2.8, b: 4.2, kind: 'window' }]);
// Izquierda (x=0): ventana del dormitorio
addWall('z', 0, 0, D, [{ a: 1.0, b: 2.6, kind: 'window' }]);
// Derecha (x=W): ventanal del living
addWall('z', W, 0, D, [{ a: 2.0, b: 5.0, kind: 'window' }]);

// ---- Muros interiores ----
// Tabique vertical x=5: separa zona izquierda del living. Puertas a dormitorio y cocina.
addWall('z', 5, 0, D, [
  { a: 0.6, b: 1.8, kind: 'door' }, // living -> dormitorio
  { a: 4.8, b: 6.0, kind: 'door' }, // living -> cocina
]);
// Tabique horizontal z=4 (x 0..5): separa dormitorio (z<4) de baño+cocina (z>4)
addWall('x', 4, 0, 5, []);
// Tabique vertical x=2 (z 4..7): separa baño de cocina. Puerta entre ambos.
addWall('z', 2, 4, D, [{ a: 5.0, b: 5.9, kind: 'door' }]);

// ---- Muebles base (cajas; el sofá y las sillas reales se insertan después) ----
addBox(1.3, 0.25, 1.4, 1.6, 0.5, 2.0, MAT.cama); // cama (dormitorio)
addBox(7.0, 0.2, 2.6, 1.0, 0.4, 0.6, MAT.madera); // mesa de centro (living)
addBox(6.0, 0.375, 5.4, 1.4, 0.75, 0.8, MAT.madera); // mesa de comedor
addBox(3.5, 0.45, 6.6, 2.6, 0.9, 0.55, MAT.cocina); // mesón de cocina

// =====================================================================
//  Construcción del GLB (un cubo unitario reutilizado por cada caja)
// =====================================================================

// Cubo unitario centrado, 24 vértices (normales por cara), 36 índices.
const P = []; // posiciones
const N = []; // normales
const I = []; // índices
function face(verts, normal) {
  const base = P.length / 3;
  for (const v of verts) {
    P.push(...v);
    N.push(...normal);
  }
  I.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
const h = 0.5;
face([[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]], [1, 0, 0]); // +X
face([[-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]], [-1, 0, 0]); // -X
face([[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]], [0, 1, 0]); // +Y
face([[-h, -h, h], [-h, -h, -h], [h, -h, -h], [h, -h, h]], [0, -1, 0]); // -Y
face([[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]], [0, 0, 1]); // +Z
face([[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]], [0, 0, -1]); // -Z

const posArr = new Float32Array(P);
const norArr = new Float32Array(N);
const idxArr = new Uint16Array(I);

// Buffer binario: [pos][nor][idx] alineado a 4 bytes.
const posBytes = Buffer.from(posArr.buffer);
const norBytes = Buffer.from(norArr.buffer);
const idxBytes = Buffer.from(idxArr.buffer);
const pad4 = (n) => (4 - (n % 4)) % 4;
const posOff = 0;
const norOff = posBytes.length;
const idxOff = norOff + norBytes.length;
const bin = Buffer.concat([posBytes, norBytes, idxBytes, Buffer.alloc(pad4(idxBytes.length))]);

const gltf = {
  asset: { version: '2.0', generator: 'mapeo_3d build-apartment' },
  scene: 0,
  scenes: [{ nodes: [] }],
  nodes: [],
  meshes: [],
  materials: materials.map((m) => ({
    name: m.name,
    doubleSided: true,
    alphaMode: m.alphaMode || 'OPAQUE',
    pbrMetallicRoughness: {
      baseColorFactor: m.baseColorFactor,
      metallicFactor: m.metallicFactor,
      roughnessFactor: m.roughnessFactor,
    },
  })),
  buffers: [{ byteLength: posBytes.length + norBytes.length + idxBytes.length }],
  bufferViews: [
    { buffer: 0, byteOffset: posOff, byteLength: posBytes.length, target: 34962 },
    { buffer: 0, byteOffset: norOff, byteLength: norBytes.length, target: 34962 },
    { buffer: 0, byteOffset: idxOff, byteLength: idxBytes.length, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: posArr.length / 3, type: 'VEC3', min: [-h, -h, -h], max: [h, h, h] },
    { bufferView: 1, componentType: 5126, count: norArr.length / 3, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: idxArr.length, type: 'SCALAR' },
  ],
};

// Una mesh por material (comparten geometría, cambian el material).
const meshByMat = {};
materials.forEach((m, i) => {
  gltf.meshes.push({
    name: `mesh_${m.name}`,
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: i }],
  });
  meshByMat[i] = i;
});

// Un nodo por caja.
for (const b of boxes) {
  gltf.nodes.push({ mesh: meshByMat[b.mat], translation: b.center, scale: b.size });
  gltf.scenes[0].nodes.push(gltf.nodes.length - 1);
}

// Empaquetado GLB.
let json = JSON.stringify(gltf);
json += ' '.repeat(pad4(Buffer.byteLength(json)));
const jsonBuf = Buffer.from(json);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // glTF
header.writeUInt32LE(2, 4); // version
const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
header.writeUInt32LE(total, 8);

const jsonChunkHdr = Buffer.alloc(8);
jsonChunkHdr.writeUInt32LE(jsonBuf.length, 0);
jsonChunkHdr.writeUInt32LE(0x4e4f534a, 4); // JSON

const binChunkHdr = Buffer.alloc(8);
binChunkHdr.writeUInt32LE(bin.length, 0);
binChunkHdr.writeUInt32LE(0x004e4942, 4); // BIN

const glb = Buffer.concat([header, jsonChunkHdr, jsonBuf, binChunkHdr, bin]);

// =====================================================================
//  Amoblado: insertar muebles reales (GLB de Khronos glTF-Sample-Assets)
//  en la estructura procedural y optimizar (dedup de sillas repetidas).
// =====================================================================

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const apt = await io.readBinary(new Uint8Array(glb));
const root = apt.getRoot();
const mainScene = root.getDefaultScene() || root.listScenes()[0];

const quatY = (deg) => {
  const a = (deg * Math.PI) / 180;
  return [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
};

// Coloca un mueble (archivo en tools/furniture/) en coordenadas centradas del depto.
async function place(file, translation, yaw = 0, scale = 1) {
  const path = `tools/furniture/${file}`;
  if (!existsSync(path)) {
    throw new Error(
      `Falta ${path}. Descárgalo de KhronosGroup/glTF-Sample-Assets ` +
        `(Models/<Nombre>/glTF-Binary/<Nombre>.glb) a tools/furniture/.`
    );
  }
  const src = await io.read(path);
  mergeDocuments(apt, src);
  const scenes = root.listScenes();
  const merged = scenes[scenes.length - 1]; // la escena recién fusionada
  const wrap = apt
    .createNode(file.replace('.glb', ''))
    .setTranslation(translation)
    .setScale([scale, scale, scale])
    .setRotation(quatY(yaw));
  for (const child of merged.listChildren()) {
    merged.removeChild(child);
    wrap.addChild(child);
  }
  mainScene.addChild(wrap);
  merged.dispose();
}

// Living: sofá contra el muro derecho mirando al centro
await place('GlamVelvetSofa.glb', [3.85, 0, 0], -90);
// Sillón individual frente al sofá
await place('ChairDamaskPurplegold.glb', [1.8, 0, -1.3], 90);
// Dos sillas en el comedor (la geometría se deduplica)
await place('ChairDamaskPurplegold.glb', [1.5, 0, 1.1], 0);
await place('ChairDamaskPurplegold.glb', [1.5, 0, 2.7], 180);

await apt.transform(dedup(), prune());

// GLB exige un único buffer: reasignar todos los accessors a uno y descartar el resto.
const buffers = root.listBuffers();
const mainBuffer = buffers[0];
root.listAccessors().forEach((a) => a.setBuffer(mainBuffer));
buffers.slice(1).forEach((b) => b.dispose());

const finalGlb = Buffer.from(await io.writeBinary(apt));
const out = 'public/demo/model.glb';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, finalGlb);
console.log(`OK ${out} — ${(finalGlb.length / 1024 / 1024).toFixed(2)} MB (estructura: ${boxes.length} cajas + muebles reales)`);
