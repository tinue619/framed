import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Point } from '../../models';

export interface Preview3DConfig {
  container:      HTMLElement;
  productW:       number;   // мм
  productH:       number;   // мм
  glassThickness: number;   // мм
  profilePts?:    Point[];
}

export interface Preview3DHandle {
  destroy: () => void;
}

export function createPreview3D(cfg: Preview3DConfig): Preview3DHandle {
  const { container, productW: W, productH: H, glassThickness: GT, profilePts } = cfg;

  container.innerHTML = '';
  const cW = container.clientWidth  || 400;
  const cH = container.clientHeight || 500;

  // ── Scene ────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a202c);

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
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.08;
  controls.minDistance    = maxDim * 0.1;
  controls.maxDistance    = maxDim * 8;
  controls.update();

  // ── Lights ───────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(W, H * 1.4, maxDim * 2.2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7799bb, 0.28);
  fill.position.set(-W * 0.6, -H * 0.5, maxDim * 0.4);
  scene.add(fill);

  // ── Glass ────────────────────────────────────────────────────
  const glassGeo  = new THREE.BoxGeometry(W, H, GT);
  const glassMat  = new THREE.MeshPhysicalMaterial({
    color: 0x88ccdd, transparent: true, opacity: 0.28,
    roughness: 0.04, metalness: 0, side: THREE.DoubleSide,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(0, 0, GT / 2);
  scene.add(glassMesh);

  const edgeMat  = new THREE.LineBasicMaterial({ color: 0x66aabb, opacity: 0.55, transparent: true });
  const edgeLine = new THREE.LineSegments(new THREE.EdgesGeometry(glassGeo), edgeMat);
  edgeLine.position.copy(glassMesh.position);
  scene.add(edgeLine);

  // ── Profile frame ────────────────────────────────────────────
  if (profilePts && profilePts.length >= 3) {
    const profMat = new THREE.MeshStandardMaterial({
      color: 0xd0d8e4, metalness: 0.72, roughness: 0.28, side: THREE.DoubleSide,
    });

    const mkShape = (pts: Point[], flipY = false) => {
      const s = new THREE.Shape();
      s.moveTo(pts[0].x, flipY ? -pts[0].y : pts[0].y);
      for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, flipY ? -pts[i].y : pts[i].y);
      s.closePath();
      return s;
    };

    const shapeN = mkShape(profilePts);
    const shapeF = mkShape(profilePts, true);

    const addBar = (sh: THREE.Shape, depth: number, m: number[]) => {
      const geo  = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
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

    // TOP — отражённый, вдоль W
    addBar(shapeF, W, [ 0, 0, 1,-W/2,  0,-1, 0, H/2,  1, 0, 0, 0,  0, 0, 0, 1 ]);
    // BOTTOM — нормальный, вдоль W
    addBar(shapeN, W, [ 0, 0, 1,-W/2,  0,-1, 0,-H/2,  1, 0, 0, 0,  0, 0, 0, 1 ]);
    // RIGHT — нормальный, вдоль H
    addBar(shapeN, H, [ 0, 1, 0, W/2,  0, 0, 1,-H/2,  1, 0, 0, 0,  0, 0, 0, 1 ]);
    // LEFT — отражённый, вдоль H
    addBar(shapeF, H, [ 0, 1, 0,-W/2,  0, 0, 1,-H/2,  1, 0, 0, 0,  0, 0, 0, 1 ]);
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
