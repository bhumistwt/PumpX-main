import React, { useEffect, useRef } from "react";
import * as THREE from "three";

type ThreeMarketBackgroundProps = {
  scrollDepth: number;
  tiltX: number;
  tiltY: number;
};

const ThreeMarketBackground: React.FC<ThreeMarketBackgroundProps> = ({ scrollDepth, tiltX, tiltY }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const torusRef = useRef<THREE.Mesh | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      52,
      mountEl.clientWidth / mountEl.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    mountEl.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x6b7cff, 0.55);
    const key = new THREE.PointLight(0x00ff66, 1.2, 60);
    key.position.set(3.5, 3, 6);
    const fill = new THREE.PointLight(0x4f69ff, 0.95, 60);
    fill.position.set(-4, -2, 5);
    scene.add(ambient, key, fill);

    const torusGeometry = new THREE.TorusKnotGeometry(2.15, 0.48, 220, 32);
    const torusMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x4f69ff,
      transmission: 0.35,
      roughness: 0.2,
      metalness: 0.65,
      thickness: 0.8,
      emissive: 0x00161f,
      emissiveIntensity: 0.6,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
    });

    const torus = new THREE.Mesh(torusGeometry, torusMaterial);
    torus.rotation.x = 0.5;
    torus.rotation.y = 0.4;
    torusRef.current = torus;
    scene.add(torus);

    const starCount = 1400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 36;
      positions[i3 + 1] = (Math.random() - 0.5) * 22;
      positions[i3 + 2] = (Math.random() - 0.5) * 25;
    }

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pointsMat = new THREE.PointsMaterial({
      color: 0x7ce3ff,
      size: 0.035,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(pointsGeo, pointsMat);
    pointsRef.current = points;
    scene.add(points);

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };

    const animate = () => {
      if (torusRef.current && pointsRef.current) {
        const t = performance.now() * 0.00035;
        torusRef.current.rotation.x += 0.0032;
        torusRef.current.rotation.y += 0.0045;
        torusRef.current.position.z = Math.sin(t * 2.1) * 0.6;
        pointsRef.current.rotation.y += 0.0008;
        pointsRef.current.rotation.x = Math.sin(t * 0.9) * 0.08;
      }

      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", onResize);
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", onResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        const material = (mesh as THREE.Mesh).material;
        if (Array.isArray(material)) {
          material.forEach((mat) => mat.dispose());
        } else if (material) {
          material.dispose();
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!torusRef.current || !cameraRef.current) return;

    const depth = Math.min(Math.max(scrollDepth, 0), 1);
    torusRef.current.rotation.z = depth * 0.8;
    torusRef.current.position.y = depth * -1.35;
    torusRef.current.position.x = tiltX * 0.035;
    cameraRef.current.position.y = depth * 0.35;
    cameraRef.current.lookAt(tiltX * 0.05, tiltY * 0.05, 0);
  }, [scrollDepth, tiltX, tiltY]);

  return <div className="hero-three-canvas" ref={mountRef} aria-hidden />;
};

export default ThreeMarketBackground;
