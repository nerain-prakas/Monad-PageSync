import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * CityExtrusion3D
 * Recreated 1,600 cubic towers wireframe extrusion scene reverse-engineered from DevTools.
 * Features:
 *  - 40x40 instanced cubes with EdgesGeometry (zero diagonal triangulation)
 *  - Scroll-bound and scrub-bound extrusion with organic proximity falloff and wave motion
 *  - Camera flight from bird's-eye Nadir (-68°) down to cinematic Isometric (-22.5°)
 *  - 3 Waypoint beacons with vertical laser beams and connecting CatmullRom spline
 *  - Dual theme support: 'crimson' (Resident Evil / Sector 07) & 'monad' (Electric Purple / Onchain Observatory)
 *  - Interactive mouse parallax & ambient breathing oscillation
 */
function getThemeColors(theme) {
  if (theme === 'crimson') {
    return {
      primary: 0xff1e28,
      fog: 0x05060a,
      ambient: 0xff2222,
      dir: 0xff3333,
      grid1: 0x660c18,
      grid2: 0x1f0308,
      arc: 0xff4f4f,
    };
  }
  if (theme === 'dark' || theme === 'monad_dark') {
    return {
      primary: 0x7257ff,
      fog: 0x07060d,
      ambient: 0x7257ff,
      dir: 0xa78bfa,
      grid1: 0x4c1d95,
      grid2: 0x1e153b,
      arc: 0xc084fc,
    };
  }
  // Default: 'white' or 'monad' (White Spatial Observatory)
  return {
    primary: 0x6342eb,
    fog: 0xf8f9fc,
    ambient: 0x6342eb,
    dir: 0x0284c7,
    grid1: 0xc7d2fe,
    grid2: 0xe2e8f0,
    arc: 0x0284c7,
  };
}

export default function CityExtrusion3D({
  progress = 0,
  theme = 'white', // 'white' (observatory) | 'dark' | 'crimson'
  highlightMode = 'standard', // 'standard' | 'storage_packed'
  onTelemetryUpdate,
}) {
  const mountRef = useRef(null);
  const internalProgressRef = useRef(progress);
  const targetProgressRef = useRef(progress);
  const themeRef = useRef(theme);
  const highlightModeRef = useRef(highlightMode);
  const sceneElementsRef = useRef(null);

  // Keep target and theme refs synced
  useEffect(() => {
    targetProgressRef.current = Math.min(Math.max(progress, 0.0), 1.0);
  }, [progress]);

  useEffect(() => {
    themeRef.current = theme;
    highlightModeRef.current = highlightMode;
    if (sceneElementsRef.current) {
      updateThemeColors(sceneElementsRef.current, theme);
    }
  }, [theme, highlightMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const getW = () => container.clientWidth || window.innerWidth || 1440;
    const getH = () => container.clientHeight || window.innerHeight || 900;

    const colors = getThemeColors(themeRef.current);

    // 1. Scene & Fog Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(colors.fog, 0.015);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(50, getW() / getH(), 0.1, 1000);
    camera.position.set(0, 38, 44);
    camera.lookAt(0, 0, 0);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(getW(), getH());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(colors.fog, 0.0);
    renderer.domElement.className = 'city-extrusion-canvas';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(colors.ambient, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(colors.dir, 2.8);
    dirLight.position.set(20, 42, 24);
    scene.add(dirLight);

    // 5. Master City Group
    const cityGroup = new THREE.Group();
    cityGroup.rotation.y = -Math.PI / 6; // ~30 deg isometric angle
    scene.add(cityGroup);

    // 6. 40x40 Grid = 1,600 Cubes (EdgesGeometry, Strictly NO diagonal triangulation lines)
    const gridSize = 40;
    const count = gridSize * gridSize;
    const boxSize = 1.15;
    const spacing = 1.55;

    const baseBoxGeo = new THREE.BoxGeometry(boxSize, 1.0, boxSize);
    const edgesGeo = new THREE.EdgesGeometry(baseBoxGeo);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: colors.primary,
      linewidth: 2,
      transparent: true,
      opacity: 0.95,
    });

    const instancedCubes = new THREE.InstancedMesh(edgesGeo, lineMaterial, count);
    instancedCubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cityGroup.add(instancedCubes);

    // 7. Coordinate & Baseline Skyline Caching
    const dummy = new THREE.Object3D();
    const gridData = new Float32Array(count * 4); // posX, posZ, dist, maxSkylineH

    for (let i = 0; i < count; i++) {
      const gx = (i % gridSize) - gridSize / 2;
      const gz = Math.floor(i / gridSize) - gridSize / 2;
      const posX = gx * spacing;
      const posZ = gz * spacing;
      const dist = Math.sqrt(posX * posX + posZ * posZ);

      // Organic metropolitan & storage cluster equation
      const noise = Math.sin(gx * 0.38) * Math.cos(gz * 0.38);
      const falloff = Math.max(0.06, 1.0 - dist / (gridSize * spacing * 0.62));
      const maxH = 2.4 + Math.pow(falloff, 2.0) * 20.0 + noise * 4.0;

      gridData[i * 4 + 0] = posX;
      gridData[i * 4 + 1] = posZ;
      gridData[i * 4 + 2] = dist;
      gridData[i * 4 + 3] = maxH;

      dummy.position.set(posX, 0.04, posZ);
      dummy.scale.set(1.0, 0.08, 1.0);
      dummy.updateMatrix();
      instancedCubes.setMatrixAt(i, dummy.matrix);
    }
    instancedCubes.instanceMatrix.needsUpdate = true;

    // 8. Ground Radar Grid Plane
    const groundGrid = new THREE.GridHelper(66, 34, colors.grid1, colors.grid2);
    groundGrid.position.y = 0.0;
    cityGroup.add(groundGrid);

    // 9. Waypoint Beacons
    const beaconsData = [
      {
        id: 'origin',
        name: 'GENESIS',
        label: '23:58 // 0x0000 GENESIS LIMITS',
        colorCrimson: 0xff3b30,
        colorMonad: 0xa855f7,
        x: -9,
        z: -7,
        targetH: 15,
        threshold: 0.15,
      },
      {
        id: 'checkpoint',
        name: 'INDEXER',
        label: '02:41 // ENVIO INDEXER PIPE',
        colorCrimson: 0xffaa00,
        colorMonad: 0x38bdf8,
        x: 4,
        z: 2,
        targetH: 13,
        threshold: 0.5,
      },
      {
        id: 'venue',
        name: 'KURU VENUE',
        label: '04:17 // KURU & PAGESYNC SETTLEMENT',
        colorCrimson: 0xff1e44,
        colorMonad: 0x10b981,
        x: 11,
        z: -11,
        targetH: 19,
        threshold: 0.85,
      },
    ];

    const beaconGroup = new THREE.Group();
    cityGroup.add(beaconGroup);

    const beaconMeshes = beaconsData.map((b) => {
      const activeColor = themeRef.current === 'crimson' ? b.colorCrimson : b.colorMonad;
      const pinGeo = new THREE.SphereGeometry(0.75, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: activeColor, transparent: true, opacity: 0.2 });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(b.x, 0.5, b.z);
      beaconGroup.add(pinMesh);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(b.x, 0, b.z),
        new THREE.Vector3(b.x, 1, b.z),
      ]);
      const beamMat = new THREE.LineBasicMaterial({ color: activeColor, transparent: true, opacity: 0.2 });
      const beam = new THREE.Line(lineGeo, beamMat);
      beaconGroup.add(beam);

      return { pin: pinMesh, beam: beam, b: b, pinMat, beamMat };
    });

    // 10. Connecting Route Spline Arc
    const arcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-9, 16, -7),
      new THREE.Vector3(-3, 22, -3),
      new THREE.Vector3(4, 15, 2),
      new THREE.Vector3(8, 23, -4),
      new THREE.Vector3(11, 21, -11),
    ]);
    const arcPoints = arcCurve.getPoints(60);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMat = new THREE.LineBasicMaterial({
      color: colors.arc,
      linewidth: 2,
      transparent: true,
      opacity: 0.25,
    });
    const routeArc = new THREE.Line(arcGeo, arcMat);
    cityGroup.add(routeArc);

    // Save references for dynamic updates
    sceneElementsRef.current = {
      scene,
      camera,
      renderer,
      lineMaterial,
      groundGrid,
      beaconMeshes,
      routeArc,
      ambientLight,
      dirLight,
    };

    // 11. Mouse tracking
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e) => {
      mouseX = e.clientX / window.innerWidth - 0.5;
      mouseY = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 12. Resize handler
    const handleResize = () => {
      const w = getW();
      const h = getH();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 13. Main Render Loop
    let clock = 0;
    let rafId;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      clock += 0.016;

      // Smooth scroll interpolation (scrub damping)
      const currentP = internalProgressRef.current;
      const targetP = targetProgressRef.current;
      const newP = currentP + (targetP - currentP) * 0.08;
      internalProgressRef.current = newP;

      // Telemetry telemetry dispatch
      if (onTelemetryUpdate) {
        const altitude = (0.2 + newP * 21.4).toFixed(1);
        const pitch = (-68.0 + newP * 45.5).toFixed(1);
        onTelemetryUpdate({
          progress: newP,
          altitude,
          pitch,
          passedOrigin: newP >= 0.15,
          passedCheckpoint: newP >= 0.5,
          passedVenue: newP >= 0.85,
        });
      }

      // Camera flight from bird's eye nadir down to dramatic low-angle perspective
      const camY = 38.0 - newP * 20.0;
      const camZ = 44.0 - newP * 12.0;
      const camX = 18.0 * (1.0 - newP) * 0.4;

      camera.position.x += (camX + mouseX * 8.0 - camera.position.x) * 0.05;
      camera.position.y += (camY - mouseY * 6.0 - camera.position.y) * 0.05;
      camera.position.z += (camZ - camera.position.z) * 0.05;
      camera.lookAt(0, 3.5 * newP, 0);

      // Ambient city parallax and breathing sway
      cityGroup.rotation.y = -Math.PI / 6 + mouseX * 0.18 + Math.sin(clock * 0.15) * 0.02;
      cityGroup.rotation.x = mouseY * 0.12;

      // Dynamic Cube Growth Logic
      for (let i = 0; i < count; i++) {
        const px = gridData[i * 4 + 0];
        const pz = gridData[i * 4 + 1];
        const dist = gridData[i * 4 + 2];
        let maxH = gridData[i * 4 + 3];

        // If in storage packed mode, emphasize packed 2-word density
        if (highlightModeRef.current === 'storage_packed') {
          const isCenterSlot = Math.abs(px) < 4.0 && Math.abs(pz) < 4.0;
          if (isCenterSlot) {
            maxH *= 1.4;
          }
        }

        const normalizedDist = dist / (gridSize * spacing * 0.5);
        const growthThreshold = Math.max(0.0, newP * 1.35 - normalizedDist * 0.35);
        const effectiveProgress = Math.min(Math.max(growthThreshold, 0.0), 1.0);

        // Subtle ambient breathing wave when extruded
        const wave =
          effectiveProgress > 0.05
            ? Math.sin(dist * 0.3 - clock * 1.8) * 0.8 * effectiveProgress
            : 0.0;
        const dynamicH = Math.max(0.08, maxH * effectiveProgress + wave);

        dummy.position.set(px, dynamicH * 0.5, pz);
        dummy.scale.set(1.0, dynamicH, 1.0);
        dummy.updateMatrix();
        instancedCubes.setMatrixAt(i, dummy.matrix);
      }
      instancedCubes.instanceMatrix.needsUpdate = true;

      // Waypoint Beacon illumination when scroll surpasses checkpoints
      beaconMeshes.forEach(({ pin, beam, b, pinMat, beamMat }) => {
        const isLit = newP >= b.threshold;
        const beaconH = Math.max(1.0, b.targetH * Math.min(newP / b.threshold, 1.0));

        pin.position.y = beaconH + 1.2;
        pinMat.opacity = isLit ? 0.85 + Math.sin(clock * 4.0) * 0.15 : 0.2;

        beam.geometry.setFromPoints([
          new THREE.Vector3(b.x, 0, b.z),
          new THREE.Vector3(b.x, beaconH + 1.2, b.z),
        ]);
        beamMat.opacity = isLit ? 0.9 : 0.15;
      });

      // Route Arc opacity rises with extrusion
      routeArc.material.opacity = Math.max(0.05, Math.min(0.95, (newP - 0.2) * 1.4));

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      baseBoxGeo.dispose();
      edgesGeo.dispose();
      lineMaterial.dispose();
      arcGeo.dispose();
      arcMat.dispose();
      beaconMeshes.forEach(({ pin, beam, pinMat, beamMat }) => {
        pin.geometry.dispose();
        pinMat.dispose();
        beam.geometry.dispose();
        beamMat.dispose();
      });
      groundGrid.geometry.dispose();
      if (Array.isArray(groundGrid.material)) {
        groundGrid.material.forEach((m) => m.dispose());
      } else if (groundGrid.material) {
        groundGrid.material.dispose();
      }
      sceneElementsRef.current = null;
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      className="city-extrusion-container"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    />
  );
}

function updateThemeColors(elements, theme) {
  if (!elements) return;
  const colors = getThemeColors(theme);

  if (elements.scene?.fog) {
    elements.scene.fog.color.setHex(colors.fog);
  }
  elements.renderer?.setClearColor(colors.fog, 0.0);
  elements.lineMaterial?.color.setHex(colors.primary);
  elements.ambientLight?.color.setHex(colors.ambient);
  elements.dirLight?.color.setHex(colors.dir);
  if (elements.routeArc?.material) {
    elements.routeArc.material.color.setHex(colors.arc);
  }

  if (elements.beaconMeshes) {
    elements.beaconMeshes.forEach(({ pinMat, beamMat, b }) => {
      const color = theme === 'crimson' ? b.colorCrimson : b.colorMonad;
      pinMat?.color.setHex(color);
      beamMat?.color.setHex(color);
    });
  }
}
