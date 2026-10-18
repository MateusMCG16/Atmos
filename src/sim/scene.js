import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const KM = 1000;
// 1 unidade de cena = 1 km, pra câmera e near/far ficarem bem condicionados
const S = 1 / KM;
// exagero vertical: 400 km de largura por 15 km de altura é uma panqueca,
// então a vertical é esticada — convenção padrão em visualização atmosférica
export const VZ = 7;

/** Rampa de cor por velocidade do vento (azul -> ciano -> amarelo -> vermelho). */
function windColor(ms, out, o) {
  const t = Math.min(1, ms / 75);
  let r, g, b;
  if (t < 0.33) { const u = t / 0.33; r = 0.15 * u; g = 0.45 + 0.45 * u; b = 1; }
  else if (t < 0.66) { const u = (t - 0.33) / 0.33; r = 0.15 + 0.85 * u; g = 0.9; b = 1 - 0.85 * u; }
  else { const u = (t - 0.66) / 0.34; r = 1; g = 0.9 - 0.8 * u; b = 0.15 - 0.1 * u; }
  out[o] = r; out[o + 1] = g; out[o + 2] = b;
}

export function createScene(canvas, domainRadius, ceiling) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);
  scene.fog = new THREE.FogExp2(0x05070f, 0.0018);

  let controlsTarget = 0;
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);
  camera.position.set(domainRadius * S * 0.9, -domainRadius * S * 1.1, ceiling * S * VZ * 2.2);
  controlsTarget = ceiling * S * VZ * 0.35;
  camera.up.set(0, 0, 1);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, controlsTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = domainRadius * S * 6;
  controls.minDistance = 10;

  scene.add(new THREE.AmbientLight(0x8899cc, 1.2));
  const sun = new THREE.DirectionalLight(0xfff0dd, 1.5);
  sun.position.set(1, -1, 2);
  scene.add(sun);

  // oceano
  const oceanR = domainRadius * S * 1.3;
  const ocean = new THREE.Mesh(
    new THREE.CircleGeometry(oceanR, 96),
    new THREE.MeshStandardMaterial({
      color: 0x0b2740, roughness: 0.35, metalness: 0.5,
      transparent: true, opacity: 0.9,
    })
  );
  scene.add(ocean);

  // grade de referência em km
  const grid = new THREE.PolarGridHelper(oceanR, 12, 6, 96, 0x224466, 0x152e44);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = 0.5;
  scene.add(grid);

  // anel do raio de vento máximo
  const rmaxRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      })
    ),
    new THREE.LineBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.6 })
  );
  rmaxRing.position.z = 1;
  scene.add(rmaxRing);

  // partículas
  const geom = new THREE.BufferGeometry();
  let posAttr = new THREE.BufferAttribute(new Float32Array(3), 3);
  let colAttr = new THREE.BufferAttribute(new Float32Array(3), 3);
  const points = new THREE.Points(
    geom,
    new THREE.PointsMaterial({
      // tamanho em pixels: com sizeAttenuation o ponto teria tamanho em km
      // e o overdraw com blending aditivo mataria o fillrate
      size: 2.0, vertexColors: true, transparent: true, opacity: 0.7,
      sizeAttenuation: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(points);

  const ZERO = new THREE.Vector3();
  const boundsRadius = Math.max(domainRadius, ceiling * VZ) * S * 3;

  let scenePos = null;
  let sceneCol = null;

  function allocate(count) {
    scenePos = new Float32Array(count * 3);
    sceneCol = new Float32Array(count * 3);
    posAttr = new THREE.BufferAttribute(scenePos, 3);
    colAttr = new THREE.BufferAttribute(sceneCol, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', posAttr);
    geom.setAttribute('color', colAttr);
  }

  function sync(field) {
    const n = field.count;
    if (!scenePos || scenePos.length !== n * 3) allocate(n);
    const p = field.pos, sp = field.speed;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      scenePos[i3] = p[i3] * S;
      scenePos[i3 + 1] = p[i3 + 1] * S;
      scenePos[i3 + 2] = p[i3 + 2] * S * VZ;
      windColor(sp[i], sceneCol, i3);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geom.setDrawRange(0, n);
    // esfera fixa e generosa: recalcular a cada frame custa caro e o domínio
    // já é conhecido
    if (!geom.boundingSphere) geom.boundingSphere = new THREE.Sphere();
    geom.boundingSphere.set(ZERO, boundsRadius);
  }

  function setRmax(rmaxMeters) {
    const s = rmaxMeters * S;
    rmaxRing.scale.set(s, s, 1);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    controls.dispose();
    geom.dispose();
    points.material.dispose();
    ocean.geometry.dispose();
    ocean.material.dispose();
    renderer.dispose();
  }

  return { sync, setRmax, resize, render, dispose, camera, controls, points };
}
