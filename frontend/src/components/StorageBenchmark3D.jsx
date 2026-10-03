import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import gsap from 'gsap';

/**
 * StorageBenchmark3D
 * Cyberpunk / Monad-purple WebGL visualizer.
 *
 * Props:
 *  mode       – 'pagesync' | 'conventional'
 *  onWorkload – callback when workload animation completes
 *  triggerRef – ref whose .trigger() method fires the workload
 */
export default function StorageBenchmark3D({ mode = 'pagesync', triggerRef }) {
  const mountRef   = useRef(null);
  const stateRef   = useRef({ mode, scene: null, slots: [], base: null, animating: false });

  // ── Bootstrap Three.js once ────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x141414, 0.03);
    stateRef.current.scene = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 11, 20);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.05;
    controls.maxPolarAngle   = Math.PI / 2 - 0.05;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0x9dd2ff, 1.2);
    dir.position.set(10, 20, 10);
    scene.add(dir);
    const pt = new THREE.PointLight(0x2575fc, 1.5, 30);
    pt.position.set(0, 5, 0);
    scene.add(pt);

    // Grid
    const grid = new THREE.GridHelper(50, 30, 0x2780c4, 0x222222);
    grid.position.y = -0.61;
    scene.add(grid);

    // Build initial storage page
    buildPage(scene, stateRef.current);

    // Expose workload trigger via ref
    if (triggerRef) {
      triggerRef.current = { trigger: () => triggerWorkload(stateRef.current, scene) };
    }

    // Render loop
    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // Responsive resize
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 360;
      if (renderer.domElement.width !== Math.floor(w * dpr) ||
          renderer.domElement.height !== Math.floor(h * dpr)) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      // Float warmed slots
      const t = Date.now() * 0.0025;
      stateRef.current.slots.forEach((slot, i) => {
        if (slot.userData.isWarmed) {
          slot.position.y = slot.userData.baseY + Math.sin(t + i * 0.5) * 0.08;
        }
      });

      scene.rotation.y += 0.0012;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild page when mode prop changes ────────────────────────────────
  useEffect(() => {
    stateRef.current.mode = mode;
    if (stateRef.current.scene) {
      buildPage(stateRef.current.scene, stateRef.current);
    }
  }, [mode]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '360px', borderRadius: '12px', overflow: 'hidden', background: '#141414' }}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPage(scene, state) {
  // Clear old meshes
  state.slots.forEach(s => scene.remove(s));
  state.slots = [];
  if (state.base) scene.remove(state.base);

  // Base plate
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, roughness: 0.4, metalness: 0.2,
    emissive: 0x2575fc, emissiveIntensity: 0.08,
  });
  state.base = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.2, 10.8), pageMat);
  state.base.position.y = -0.6;
  scene.add(state.base);

  const gridSize = 6;
  const spacing  = 1.6;
  const startX   = -((gridSize - 1) * spacing) / 2;
  const startZ   = -((gridSize - 1) * spacing) / 2;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const isWarmed = state.mode === 'pagesync'
        ? (i >= 1 && i <= 4 && j >= 1 && j <= 4)
        : (i % 2 === 0 && j % 2 === 1);

      const color = isWarmed ? 0x2575fc : 0x3d3270;
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.3, metalness: 0.4,
        emissive: color, emissiveIntensity: isWarmed ? 0.35 : 0.05,
      });

      const slot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), mat);
      slot.position.set(startX + i * spacing, 0, startZ + j * spacing);
      slot.userData = { baseY: 0, isWarmed };
      scene.add(slot);
      state.slots.push(slot);
    }
  }
}

function triggerWorkload(state, scene) {
  if (state.animating || state.slots.length === 0) return;
  state.animating = true;

  state.slots.forEach((slot, idx) => {
    setTimeout(() => {
      const pGeo = new THREE.SphereGeometry(0.2, 16, 16);
      const pMat = new THREE.MeshBasicMaterial({ color: slot.userData.isWarmed ? 0x2575fc : 0xff007a });
      const packet = new THREE.Mesh(pGeo, pMat);
      packet.position.set(slot.position.x, 7, slot.position.z);
      scene.add(packet);

      gsap.to(packet.position, {
        y: slot.position.y + 0.3, duration: 0.55, ease: 'bounce.out',
        onComplete: () => {
          scene.remove(packet);
          gsap.to(slot.scale, { y: 2.2, duration: 0.12, yoyo: true, repeat: 1 });
          gsap.to(slot.material, {
            emissiveIntensity: 0.9, duration: 0.12, yoyo: true, repeat: 1,
            onComplete: () => { if (idx === state.slots.length - 1) state.animating = false; },
          });
        },
      });
    }, idx * 20);
  });
}
