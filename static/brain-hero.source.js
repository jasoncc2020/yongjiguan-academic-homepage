// Build with three@0.160.1 and esbuild@0.25.12:
// esbuild brain-hero.source.js --bundle --minify --format=iife --target=es2020 --legal-comments=inline --outfile=brain-hero.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import schaefer from './brain-schaefer200.json';

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
  const canvas = host.querySelector('canvas');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer, frame = 0, previous = 0, elapsed = 0, visible = true, failed = false;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);
    camera.position.set(0, 0, 6.4);
    const network = new THREE.Group();
    scene.add(network);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8ba0, 2.0));
    const light = new THREE.DirectionalLight(0xffffff, 2.0);
    light.position.set(-2, 3, 5);
    scene.add(light);
    const palette = { Vis: '#9470b4', SomMot: '#438ec2', DorsAttn: '#4caa74', SalVentAttn: '#c56bc5', Limbic: '#c8a947', Cont: '#e58d42', Default: '#d95c6a' };
    // Exact atlas centroids: RAS millimetres -> right/up/back Three.js axes.
    const coords = schaefer.nodes.map(n => new THREE.Vector3(n.mni[0], n.mni[2], -n.mni[1]));
    const bounds = new THREE.Box3().setFromPoints(coords);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    coords.forEach(p => p.sub(center).multiplyScalar(3.7 / Math.max(size.x, size.y, size.z)));
    const colors = schaefer.nodes.map(n => new THREE.Color(palette[n.network]));
    const spheres = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.05 }), 200);
    const transform = new THREE.Object3D();
    coords.forEach((p, i) => spheres.setColorAt(i, colors[i]));
    network.add(spheres);

    // A sparse, deterministic illustrative graph, not empirical FC estimates.
    // Preserve every atlas node; connect within-network neighbors and a small
    // set of long-range / interhemispheric bridges for a readable animation.
    const edgeSet = new Set(), edges = [];
    function edge(a, b) {
      const key = [Math.min(a,b), Math.max(a,b)].join('-');
      if (a === b || edgeSet.has(key)) return;
      edgeSet.add(key); edges.push([a,b]);
    }
    coords.forEach((p, i) => {
      const same = coords.map((q,j) => ({ j, d:p.distanceToSquared(q) }))
        .filter(x => x.j !== i && schaefer.nodes[x.j].network === schaefer.nodes[i].network)
        .sort((a,b) => a.d-b.d);
      same.slice(0, 2).forEach(x => edge(i,x.j));
      if (i % 4 === 0) {
        const opposite = same.find(x => schaefer.nodes[x.j].mni[0] * schaefer.nodes[i].mni[0] < 0);
        if (opposite) edge(i,opposite.j);
      }
      if (i % 5 === 0) edge(i, (i * 47 + 67) % 200);
    });
    const positions = [], lineColors = [], phases = [], along = [];
    edges.forEach(([a,b], e) => {
      const middle = coords[a].clone().add(coords[b]).multiplyScalar(0.38);
      const curve = new THREE.QuadraticBezierCurve3(coords[a], middle, coords[b]);
      const color = colors[a].clone().lerp(colors[b], .5);
      for (let segment = 0; segment < 8; segment++) {
        for (const t of [segment / 8, (segment + 1) / 8]) {
          const p = curve.getPoint(t);
          positions.push(p.x,p.y,p.z);
          lineColors.push(color.r,color.g,color.b);
          phases.push((e * 2.399963) % (2*Math.PI));
          along.push(t);
        }
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(lineColors,3));
    geometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
    geometry.setAttribute('along',new THREE.Float32BufferAttribute(along,1));
    const clock = { value: 0 };
    const lines = new THREE.LineSegments(geometry,new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true, uniforms: { clock },
      vertexShader: `attribute float phase; attribute float along;
        varying vec3 tint; varying float wave; varying float path;
        void main(){ tint=color; wave=phase; path=along;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float clock; varying vec3 tint; varying float wave; varying float path;
        void main(){
          float strength=pow(0.5+0.5*sin(clock*0.78+wave),3.0);
          float pulse=pow(0.5+0.5*cos(path*6.28318-clock*1.7+wave),10.0);
          gl_FragColor=vec4(mix(tint,vec3(1.0),pulse*0.22),0.035+strength*(0.32+0.34*pulse));
          #include <colorspace_fragment>
        }`
    }));
    network.add(lines);
    function paint() {
      network.rotation.set(0.20 + Math.sin(elapsed * .2) * .055, -.52 + elapsed * .13, .015);
      clock.value = elapsed;
      coords.forEach((p,i) => {
        transform.position.copy(p);
        transform.scale.setScalar(.027 + .009 * (0.5+0.5*Math.sin(elapsed*1.2+i*.72)));
        transform.updateMatrix(); spheres.setMatrixAt(i,transform.matrix);
      });
      spheres.instanceMatrix.needsUpdate = true;
      renderer.render(scene,camera);
    }
    function tick(now) {
      if (previous) elapsed += Math.min((now-previous)/1000,.08);
      previous = now; paint(); frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame); previous=0;
      if (failed) return;
      paint();
      const playing=visible && !document.hidden && !reduced.matches;
      host.dataset.motion=playing?'playing':'static';
      if (playing) frame=requestAnimationFrame(tick);
    }
    function resize() {
      if (failed) return;
      const { width,height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width,height,false); camera.aspect=width/height;
      camera.updateProjectionMatrix(); paint();
    }
    host.dataset.nodes=String(coords.length);
    host.dataset.edges=String(edges.length);
    resize(); host.classList.add('brain-ready');
    reduced.addEventListener('change',sync);
    document.addEventListener('visibilitychange',sync);
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05}).observe(host);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;cancelAnimationFrame(frame);host.classList.remove('brain-ready');renderer.dispose();});
    sync();
  } catch(error) {
    failed=true;cancelAnimationFrame(frame);
    host.classList.remove('brain-ready');
    if(renderer) renderer.dispose();
    console.warn('Connectome illustration uses its static fallback.',error);
  }
}
