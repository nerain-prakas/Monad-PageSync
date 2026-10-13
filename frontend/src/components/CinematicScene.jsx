import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Full-screen red "city of storage slots" backdrop.
 * An instanced field of bars rises and falls in travelling waves; the camera
 * drifts with the pointer and pushes forward as the page scrolls.
 */
const COLS = 46;
const ROWS = 30;
const SPACING = 0.62;

export default function CinematicScene() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050304, 0.075);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    host.appendChild(renderer.domElement);

    const geo = new THREE.BoxGeometry(0.3, 1, 0.3);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff1f2d, transparent: true, opacity: 0.85, wireframe: true });
    const mesh = new THREE.InstancedMesh(geo, mat, COLS * ROWS);
    scene.add(mesh);

    const glow = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x7a0610, transparent: true, opacity: 0.55 }),
      COLS * ROWS
    );
    scene.add(glow);

    const dummy = new THREE.Object3D();
    const pointer = { x: 0, y: 0 };
    let scrollP = 0;
    let raf = 0;

    const resize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const onMove = (e) => {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => {
      scrollP = Math.min(window.scrollY / Math.max(window.innerHeight * 3, 1), 1);
    };

    const frame = (ms) => {
      const t = reduced ? 0 : ms * 0.001;
      let i = 0;
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          const x = (c - COLS / 2) * SPACING;
          const z = -r * SPACING;
          const wave =
            Math.sin(c * 0.45 + t * 1.1) * 0.5 +
            Math.sin(r * 0.6 - t * 0.9) * 0.5 +
            Math.sin((c + r) * 0.25 + t * 0.5);
          const spike = Math.pow(Math.max(0, Math.sin(c * 1.7 + r * 0.9 + t * 0.6)), 14) * 3.4;
          const h = Math.max(0.05, 0.35 + (wave + 1.5) * 0.45 * (0.35 + scrollP * 0.45) + spike * (0.4 + scrollP * 0.3));
          dummy.position.set(x, 0, z);
          dummy.scale.set(1, h, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          glow.setMatrixAt(i, dummy.matrix);
          i += 1;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      glow.instanceMatrix.needsUpdate = true;

      camera.position.x += (pointer.x * 1.6 - camera.position.x) * 0.04;
      camera.position.y += (2.4 + scrollP * 1.2 - pointer.y * 0.6 - camera.position.y) * 0.04;
      camera.position.z = 4 - scrollP * 9;
      camera.lookAt(0, 0.4, -9 - scrollP * 4);
      host.style.opacity = String(1 - Math.min(scrollP * 3.2, 0.55));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      geo.dispose();
      mat.dispose();
      glow.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="scene" ref={hostRef} aria-hidden="true" />;
}
