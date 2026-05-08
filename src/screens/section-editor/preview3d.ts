import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Point, ProfileSide } from '../../models';

// ── public types ─────────────────────────────────────────────

export interface Assignment3D {
  pts:     Point[];
  offsetX?: number;
  offsetY?: number;
  sides?:  ProfileSide[];
  insets?: { tl: number; tr: number; br: number; bl: number };
}

export interface MdfPiece3D {
  shape:   Point[];
  offsetX: number;   // смещение сечения по X (→ Z в мировых координатах)
  offsetY: number;
}

export interface Preview3DConfig {
  container:      HTMLElement;
  productW:       number;
  productH:       number;
  glassThickness: number;
  glassSetback:   number;
  assignments:    Assignment3D[];
  mdfPieces?:     MdfPiece3D[];
}

export interface Preview3DHandle {
  destroy: () => void;
}

// ── factory ───────────────────────────────────────────────────

export function createPreview3D(cfg: Preview3DConfig): Preview3DHandle {
  const { container, productW: W, productH: H, glassThickness: GT, glassSetback: GS, assignments } = cfg;

  container.innerHTML = '';
  const cW = container.clientWidth  || 400;
  const cH = container.clientHeight || 400;

  // ── Scene ────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f4f6);

  // ── Camera ───────────────────────────────────────────────────
  const maxDim  = Math.max(W, H);
  const FOV     = 50;
  const halfFov = (FOV / 2) * Math.PI / 180;
  const az = 30 * Math.PI / 180, el = 22 * Math.PI / 180;
  const projW   = (W / 2 + 40) * Math.cos(az);
  const projH   = H / 2 + 40;
  const fitDist = Math.max(projH / Math.tan(halfFov), projW / (Math.tan(halfFov) * (cW / cH))) * 1.3;
  const camera  = new THREE.PerspectiveCamera(FOV, cW / cH, 0.5, maxDim * 30);
  camera.position.set(
    Math.sin(az) * Math.cos(el) * fitDist,
    Math.sin(el) * fitDist,
    Math.cos(az) * Math.cos(el) * fitDist,
  );
  camera.lookAt(0, 0, GT / 2);

  // ── Renderer ─────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(cW, cH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // ── Controls ─────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, GT / 2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance   = maxDim * 0.1;
  controls.maxDistance   = maxDim * 8;
  controls.update();

  // ── Lights ───────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(W, H * 1.4, maxDim * 2.2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xaabbcc, 0.35);
  fill.position.set(-W * 0.6, -H * 0.5, maxDim * 0.4);
  scene.add(fill);

  // ── Glass (с учётом заводки) ──────────────────────────────────
  const ALL_SIDES: ProfileSide[] = ['top', 'bottom', 'left', 'right'];

  // Собираем все стороны, которые перекрывают стекло
  const covered = new Set<ProfileSide>();
  for (const a of assignments) {
    for (const s of (a.sides ?? ALL_SIDES)) covered.add(s);
  }

  const rL = covered.has('left')   ? GS : 0;
  const rR = covered.has('right')  ? GS : 0;
  const rT = covered.has('top')    ? GS : 0;
  const rB = covered.has('bottom') ? GS : 0;

  const glassW  = Math.max(1, W - rL - rR);
  const glassH  = Math.max(1, H - rT - rB);
  const glassCX = (rL - rR) / 2;
  const glassCY = (rB - rT) / 2;

  const glassGeo  = new THREE.BoxGeometry(glassW, glassH, GT);
  const glassMat  = new THREE.MeshPhysicalMaterial({
    color: 0x88ccdd, transparent: true, opacity: 0.28,
    roughness: 0.04, metalness: 0, side: THREE.DoubleSide,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(glassCX, glassCY, GT / 2);
  scene.add(glassMesh);

  const edgeMat  = new THREE.LineBasicMaterial({ color: 0x66aabb, opacity: 0.55, transparent: true });
  const edgeLine = new THREE.LineSegments(new THREE.EdgesGeometry(glassGeo), edgeMat);
  edgeLine.position.copy(glassMesh.position);
  scene.add(edgeLine);

  // ── Profile bars ─────────────────────────────────────────────

  const profMat = new THREE.MeshStandardMaterial({
    color: 0xd0d8e4, metalness: 0.72, roughness: 0.28, side: THREE.DoubleSide,
  });

  const mkShape = (pts: Point[], ox: number, oy: number, flipY = false) => {
    const s = new THREE.Shape();
    const px = (p: Point) => p.x + ox;
    const py = (p: Point) => flipY ? -(p.y + oy) : (p.y + oy);
    s.moveTo(px(pts[0]), py(pts[0]));
    for (let i = 1; i < pts.length; i++) s.lineTo(px(pts[i]), py(pts[i]));
    s.closePath();
    return s;
  };

  const addBar = (shape: THREE.Shape, depth: number, m: number[]) => {
    if (depth <= 0) return;
    const geo  = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, profMat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.set(
      m[0],  m[1],  m[2],  m[3],
      m[4],  m[5],  m[6],  m[7],
      m[8],  m[9],  m[10], m[11],
      m[12], m[13], m[14], m[15],
    );
    mesh.matrixWorldNeedsUpdate = true;
    scene.add(mesh);
  };

  for (const a of assignments) {
    if (!a.pts || a.pts.length < 3) continue;

    const activeSides = a.sides ?? ALL_SIDES;
    const ci = a.insets ?? { tl: 0, tr: 0, br: 0, bl: 0 };
    const ox = a.offsetX ?? 0;
    const oy = a.offsetY ?? 0;
    const shapeN = mkShape(a.pts, ox, oy);
    const shapeF = mkShape(a.pts, ox, oy, true);

    if (activeSides.includes('top')) {
      const len = W - ci.tl - ci.tr;
      addBar(shapeF, len, [ 0, 0, 1, -W/2 + ci.tl,  0,-1, 0, H/2,  1, 0, 0, 0,  0, 0, 0, 1 ]);
    }
    if (activeSides.includes('bottom')) {
      const len = W - ci.bl - ci.br;
      addBar(shapeN, len, [ 0, 0, 1, -W/2 + ci.bl,  0,-1, 0,-H/2,  1, 0, 0, 0,  0, 0, 0, 1 ]);
    }
    if (activeSides.includes('right')) {
      const len = H - ci.tr - ci.br;
      addBar(shapeN, len, [ 0, 1, 0, W/2,  0, 0, 1, -H/2 + ci.br,  1, 0, 0, 0,  0, 0, 0, 1 ]);
    }
    if (activeSides.includes('left')) {
      const len = H - ci.tl - ci.bl;
      addBar(shapeF, len, [ 0, 1, 0,-W/2,  0, 0, 1, -H/2 + ci.bl,  1, 0, 0, 0,  0, 0, 0, 1 ]);
    }
  }

  // ── MDF panels ───────────────────────────────────────────────

  const mdfMat = new THREE.MeshStandardMaterial({
    color: 0x8b6343, metalness: 0.04, roughness: 0.88, side: THREE.DoubleSide,
  });

  for (const m of (cfg.mdfPieces ?? [])) {
    if (m.shape.length < 3) continue;

    // X координаты сечения → Z в мировых координатах (направление толщины)
    const zCoords  = m.shape.map(p => p.x + m.offsetX);
    const zMin     = Math.min(...zCoords);
    const zMax     = Math.max(...zCoords);
    const zThick   = zMax - zMin;
    if (zThick <= 0) continue;

    const geo  = new THREE.BoxGeometry(W, H, zThick);
    const mesh = new THREE.Mesh(geo, mdfMat);
    mesh.position.set(0, 0, (zMin + zMax) / 2);
    scene.add(mesh);

    const mdfEdgeMat = new THREE.LineBasicMaterial({ color: 0x5a3a1a, opacity: 0.35, transparent: true });
    const mdfEdge    = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mdfEdgeMat);
    mdfEdge.position.copy(mesh.position);
    scene.add(mdfEdge);
  }

  // ── RAF loop ─────────────────────────────────────────────────
  let rafId = 0;
  const tick = () => {
    if (!container.isConnected) { cancelAnimationFrame(rafId); return; }
    rafId = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  // ── Resize ───────────────────────────────────────────────────
  const onResize = () => {
    if (!container.parentNode) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  };
  window.addEventListener('resize', onResize);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      container.innerHTML = '';
    },
  };
}
