import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import gsap from 'gsap';

/**
 * StorageBenchmark3D (Aurora Edition)
 * Frosted 3D WebGL visualizer with transparent canvas,
 * floating over luminous Aurora orbs.
 *
 * Props:
 *  mode       – 'pagesync' | 'conventional'
 *  triggerRef – ref whose .trigger() method fires the workload
 */
export default function StorageBenchmark3D({ mode = 'pagesync', triggerRef }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ mode, scene: null, slots: [], base: null, animating: false });

  // ── Bootstrap Three.js once ────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    stateRef.current.scene = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 11, 20);
    camera.lookAt(0, 0, 0);

    // Renderer (Alpha enabled for transparent aurora pass-through)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 8;
    controls.maxDistance = 35;

    // Lighting (Aurora Violet & Cyan palette)
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xa5b4fc, 1.4);
    dir.position.set(12, 22, 12);
    scene.add(dir);

    const pt1 = new THREE.PointLight(0x22d3ee, 2.0, 35);
    pt1.position.set(0, 6, 0);
    scene.add(pt1);

    const pt2 = new THREE.PointLight(0x7c5cff, 1.6, 30);
    pt2.position.set(-8, 3, -6);
    scene.add(pt2);

    // Grid (Subtle Aurora hairline grid)
    const grid = new THREE.GridHelper(48, 24, 0x7c5cff, 0x242646);
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
      if (
        renderer.domElement.width !== Math.floor(w * dpr) ||
        renderer.domElement.height !== Math.floor(h * dpr)
      ) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      // Smooth float for warmed slots
      const t = Date.now() * 0.0022;
      stateRef.current.slots.forEach((slot, i) => {
        if (slot.userData.isWarmed) {
          slot.position.y = slot.userData.baseY + Math.sin(t + i * 0.4) * 0.09;
        }
      });

      scene.rotation.y += 0.001;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [triggerRef]);

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
      style={{
        width: '100%',
        height: '100%',
        minHeight: '360px',
        background: 'transparent',
        cursor: 'grab',
      }}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPage(scene, state) {
  // Clear old meshes
  state.slots.forEach((s) => scene.remove(s));
  state.slots = [];
  if (state.base) scene.remove(state.base);

  // Translucent Base Plate simulating a 4KB Monad storage page boundary
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0x11162b,
    roughness: 0.3,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.08,
  });
  state.base = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.22, 11.2), pageMat);
  state.base.position.y = -0.6;
  scene.add(state.base);

  const gridSize = 6;
  const spacing = 1.6;
  const startX = -((gridSize - 1) * spacing) / 2;
  const startZ = -((gridSize - 1) * spacing) / 2;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      // In PageSync mode: slots are packed contiguously in the center (warmed)
      // In Conventional mode: slots are fragmented across arbitrary hash boundaries
      const isWarmed =
        state.mode === 'pagesync'
          ? i >= 1 && i <= 4 && j >= 1 && j <= 4
          : i % 2 === 0 && j % 2 === 1;

      const slotColor = isWarmed ? 0x22d3ee : 0x7c5cff;
      const mat = new THREE.MeshStandardMaterial({
        color: slotColor,
        roughness: 0.25,
        metalness: 0.45,
        emissive: slotColor,
        emissiveIntensity: isWarmed ? 0.4 : 0.06,
        transparent: true,
        opacity: isWarmed ? 0.95 : 0.75,
      });

      const slot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 1.2), mat);
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
      const pGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const isW = slot.userData.isWarmed;
      const pMat = new THREE.MeshBasicMaterial({
        color: isW ? 0x22d3ee : 0xff5fa2,
      });
      const packet = new THREE.Mesh(pGeo, pMat);
      packet.position.set(slot.position.x, 7.5, slot.position.z);
      scene.add(packet);

      gsap.to(packet.position, {
        y: slot.position.y + 0.35,
        duration: 0.5,
        ease: 'bounce.out',
        onComplete: () => {
          scene.remove(packet);
          gsap.to(slot.scale, { y: 2.3, duration: 0.12, yoyo: true, repeat: 1 });
          gsap.to(slot.material, {
            emissiveIntensity: 1.0,
            duration: 0.12,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
              if (idx === state.slots.length - 1) state.animating = false;
            },
          });
        },
      });
    }, idx * 18);
  });
}
