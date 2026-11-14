// Build with three@0.160.1 and esbuild@0.25.12:
// esbuild brain-hero.source.js --bundle --minify --format=iife --target=es2020 --legal-comments=inline --outfile=brain-hero.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import schaefer from './brain-schaefer200.json';
import outline from './brain-axial-outline.json';

// Anatomical geometry is CC0. Activity is an illustrative, synthetic pattern.
const host = document.querySelector('[data-cortical-brain]');
if (host) initBrain(host);
const connectomeHost = document.querySelector('[data-functional-brain]');
if (connectomeHost) initConnectome(connectomeHost);

async function initBrain(host) {
  const canvas = host.querySelector('canvas');
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
    host.dataset.motion = paused ? 'paused' : 'playing';
  }
  function resize() {
    if (!ready || failed) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = 6.7 * Math.max(1, 1 / camera.aspect);
    camera.updateProjectionMatrix();
    paint();
  }
  function fallback(error) {
    failed = true;
    cancelAnimationFrame(frame);
    host.classList.remove('brain-ready');
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
    reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
    document.addEventListener('visibilitychange', sync);
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(host);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback('WebGL context lost'); });
    sync();
  } catch (error) { fallback(error); }
}

function initConnectome(host) {
  const svg = host.querySelector('.connectome-svg');
  if (!svg) return; // Older cached markup keeps its static fallback during deployment.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  let frame = 0, previous = 0, elapsed = 0, visible = true, epoch = -1;
  let renderedEdges = [];
  const palette = { Vis: '#c585cf', SomMot: '#73a8d7', DorsAttn: '#83c86d', SalVentAttn: '#e78dbf', Limbic: '#dacf68', Cont: '#f3a176', Default: '#e27c86' };
  const points = schaefer.nodes.map(n => [110 + n.mni[0] * 1.25, 24 + (75 - n.mni[1]) * 1.25]);
  function element(tag, attributes, parent) {
    const el = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, String(value)));
    parent.appendChild(el); return el;
  }
  const anatomy = element('g', { 'class': 'connectome-anatomy' }, svg);
  outline.paths.forEach(p => element('path', { d: p.d, fill: 'none', 'class': p.outer ? 'brain-contour' : 'brain-fold', 'stroke-width': p.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, anatomy));
  element('text', { x: 12, y: 31, 'class': 'hemisphere-label' }, svg).textContent = 'L';
  element('text', { x: 199, y: 31, 'class': 'hemisphere-label' }, svg).textContent = 'R';
  const edgeLayer = element('g', { 'class': 'connectome-edges' }, svg);
  const nodeLayer = element('g', { 'class': 'connectome-nodes' }, svg);
  const circles = schaefer.nodes.map((n, i) => {
    const circle = element('circle', { cx: points[i][0], cy: points[i][1], r: .9, fill: palette[n.network], opacity: .3, 'data-parcel': n.id }, nodeLayer);
    element('title', {}, circle).textContent = n.name;
    return circle;
  });

  // Each time window selects NEW pairs from the same 200 actual atlas nodes.
  // These weights are synthetic illustrations, not measured correlations.
  function connections(windowIndex) {
    let seed = (1949 + windowIndex * 3571) >>> 0;
    function random() {
      seed += 0x6D2B79F5;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    const groups = {};
    schaefer.nodes.forEach((n, i) => {
      const key = `${n.network}-${n.mni[0] < 0 ? 'L' : 'R'}`;
      (groups[key] ||= []).push(i);
    });
    const hubs = [];
    Object.values(groups).forEach(indices => {
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      hubs.push(...indices.slice(0, 3));
    });
    const edges = new Map();
    function add(a, b) {
      if (a === b || Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]) < 19) return;
      const [source, target] = a < b ? [a, b] : [b, a];
      const key = `${source + 1}-${target + 1}`;
      if (!edges.has(key)) edges.set(key, { source, target, weight: (random() < .17 ? -1 : 1) * (.40 + random() * .56) });
    }
    hubs.forEach(a => {
      const opposite = hubs.filter(b => schaefer.nodes[a].mni[0] * schaefer.nodes[b].mni[0] < 0);
      add(a, opposite[Math.floor(random() * opposite.length)]);
    });
    for (let attempt = 0; edges.size < 64 && attempt < 2000; attempt++) {
      add(hubs[Math.floor(random() * hubs.length)], hubs[Math.floor(random() * hubs.length)]);
    }
    return edges;
  }
  function newWindow(index) {
    const current = connections(index), next = connections(index + 1);
    const keys = new Set([...current.keys(), ...next.keys()]);
    edgeLayer.replaceChildren();
    renderedEdges = [...keys].map(key => {
      const pair = current.get(key) || next.get(key);
      const a = points[pair.source], b = points[pair.target];
      const line = element('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'stroke-linecap': 'round', 'data-pair': key }, edgeLayer);
      return { ...pair, line, from: current.get(key)?.weight || 0, to: next.get(key)?.weight || 0 };
    });
    epoch = index;
  }
  function paint() {
    const t = elapsed / 3.2;
    const index = Math.floor(t);
    if (index !== epoch) newWindow(index);
    const fraction = t - index;
    const blend = fraction * fraction * (3 - 2 * fraction);
    const activity = new Float32Array(200);
    renderedEdges.forEach((edge, i) => {
      const weight = (edge.from * (1 - blend) + edge.to * blend) * (.95 + .05 * Math.sin(elapsed * 1.6 + i));
      const magnitude = Math.abs(weight);
      const alpha = magnitude < .16 ? 0 : Math.min(.92, .18 + magnitude * .76);
      // Warm red positive / cool blue negative, matching a glass-brain plot.
      edge.line.setAttribute('stroke', weight >= 0 ? `hsl(${14 - magnitude * 15}, ${72 + magnitude * 12}%, ${64 - magnitude * 29}%)` : `hsl(202, 64%, ${72 - magnitude * 20}%)`);
      edge.line.setAttribute('stroke-width', String(.75 + magnitude * 3.0));
      edge.line.setAttribute('stroke-opacity', String(alpha));
      activity[edge.source] = Math.max(activity[edge.source], magnitude);
      activity[edge.target] = Math.max(activity[edge.target], magnitude);
    });
    circles.forEach((circle, i) => {
      const strength = Math.min(1, activity[i] / .45);
      circle.setAttribute('r', String(.85 + 3.3 * strength));
      circle.setAttribute('opacity', String(.24 + .76 * strength));
    });
  }
  function tick(now) {
    if (previous) elapsed += Math.min((now - previous) / 1000, .08);
    previous = now; paint(); frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); previous = 0; paint();
    const playing = visible && !document.hidden && !reduced.matches;
    host.dataset.motion = playing ? 'playing' : 'static';
    if (playing) frame = requestAnimationFrame(tick);
  }
  host.dataset.nodes = String(schaefer.nodes.length);
  host.dataset.view = 'axial';
  host.classList.add('brain-ready');
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .05 }).observe(host);
  sync();
}
