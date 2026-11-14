// Build with three@0.160.1 and esbuild@0.25.12:
// esbuild brain-hero.source.js --bundle --minify --format=iife --target=es2020 --legal-comments=inline --outfile=brain-hero.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Anatomical geometry is CC0. Activity is an illustrative, synthetic pattern.
const host = document.querySelector('[data-cortical-brain]');
if (host) initBrain(host);

async function initBrain(host) {
  const canvas = host.querySelector('canvas');
  const toggle = host.querySelector('button');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, visible = true, ready = false, failed = false;
  let frame = 0, previous = 0, elapsed = 0;
  let renderer, model;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.01, 40);
  camera.position.set(0, 0.04, 6.25);
  const pivot = new THREE.Group();
  scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x465169, 2.15));
  const key = new THREE.DirectionalLight(0xfffaf5, 3.1);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc7deff, 1.5);
  rim.position.set(4, 1, -3);
  scene.add(rim);
  const time = { value: 0 };

  function paint() {
    pivot.rotation.set(-0.10 + Math.sin(elapsed * 0.25) * 0.035, -0.72 + elapsed * 0.17, 0.025);
    time.value = elapsed;
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0;
    if (previous) elapsed += Math.min((now - previous) / 1000, 0.08);
    previous = now;
    paint();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!ready || failed) return;
    paint();
    if (visible && !document.hidden && !paused) frame = requestAnimationFrame(tick);
    toggle.textContent = paused ? host.dataset.play : host.dataset.pause;
    toggle.setAttribute('aria-pressed', String(paused));
    host.dataset.motion = paused ? 'paused' : 'playing';
  }
  function resize() {
    if (!ready || failed) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    paint();
  }
  function fallback(error) {
    failed = true;
    cancelAnimationFrame(frame);
    host.classList.remove('brain-ready');
    toggle.hidden = true;
    if (renderer) renderer.dispose();
    console.warn('Brain illustration uses its static fallback.', error);
  }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    model = (await new GLTFLoader().loadAsync(host.dataset.model)).scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(3.65 / Math.max(size.x, size.y, size.z));
    pivot.add(holder);
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      const cortex = mesh.name === 'unified-cortex';
      mesh.material.dispose();
      mesh.material = new THREE.MeshStandardMaterial({ color: cortex ? 0x9499a3 : 0x747d8b, roughness: 0.66, metalness: 0.035 });
      if (!cortex) return;
      mesh.material.onBeforeCompile = shader => {
        shader.uniforms.corticalTime = time;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float _curvature;\nvarying float fold;\nvarying vec3 cortexPosition;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nfold = _curvature;\ncortexPosition = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float corticalTime;\nvarying float fold;\nvarying vec3 cortexPosition;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            vec3 p = cortexPosition * 0.016;
            float a = sin(p.x * 2.8 + p.y * 1.6 + corticalTime * 0.83);
            float b = cos(p.z * 3.5 - p.y * 2.2 - corticalTime * 0.61);
            float activity = smoothstep(0.27, 0.85, a * b);
            float groove = smoothstep(-0.12, 0.36, -fold);
            diffuseColor.rgb *= mix(1.04, 0.64, groove);
            vec3 warm = mix(vec3(0.94, 0.035, 0.008), vec3(1.0, 0.49, 0.07), activity);
            diffuseColor.rgb = mix(diffuseColor.rgb, warm, activity * 0.67);
            totalEmissiveRadiance += warm * activity * (0.8 + groove * 0.8);
          `);
      };
      mesh.material.customProgramCacheKey = () => 'cancheng-cortical-dynamics-1';
    });
    ready = true;
    resize();
    host.classList.add('brain-ready');
    toggle.hidden = false;
    toggle.addEventListener('click', () => { paused = !paused; sync(); });
    reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
    document.addEventListener('visibilitychange', sync);
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(host);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback('WebGL context lost'); });
    sync();
  } catch (error) { fallback(error); }
}
