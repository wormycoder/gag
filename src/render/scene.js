// Renderer, lights, sky dome and image-based lighting.
import * as THREE from '../../vendor/three.module.min.js';

export const SUN_DIR = new THREE.Vector3(0.45, 0.62, 0.64).normalize();

const SKY_VERT = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // pin to far plane
}`;
const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 uSun;
uniform float uNight;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 zenith = vec3(0.16, 0.34, 0.68);
  vec3 horizon = vec3(0.66, 0.78, 0.92);
  vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.55));
  col = mix(col, vec3(0.45, 0.50, 0.46), smoothstep(0.0, -0.2, d.y));
  float s = max(dot(d, normalize(uSun)), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(s, 400.0) * 6.0 + vec3(1.0, 0.8, 0.55) * pow(s, 12.0) * 0.18;
  // thin clouds
  if (d.y > 0.02) {
    vec2 uv = d.xz / (d.y + 0.25) * 1.6;
    float c = noise(uv * 2.0) * 0.55 + noise(uv * 4.0 + 7.0) * 0.3 + noise(uv * 9.0) * 0.15;
    float m = smoothstep(0.52, 0.85, c) * smoothstep(0.02, 0.3, d.y);
    col = mix(col, vec3(1.0) * (0.88 + 0.12 * s), m * 0.8);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function createScene(renderer) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0xb7c9dc);
  scene.fog = new THREE.Fog(fogColor, 260, 1500);

  // sky dome (also baked to a cube map for reflections)
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    uniforms: { uSun: { value: SUN_DIR.clone() }, uNight: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);

  // environment map from a small scene containing the sky + a ground disc
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.0, 0.1, 10).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.75;

  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5648, 0.38);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 1; sc.far = 400; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  const follow = (target) => {
    // snap shadow frustum to texel grid to avoid shimmering
    const step = 90 / 2048;
    const x = Math.round(target.x / step) * step, y = target.y, z = Math.round(target.z / step) * step;
    sun.target.position.set(x, y, z);
    sun.position.set(x + SUN_DIR.x * 150, y + SUN_DIR.y * 150, z + SUN_DIR.z * 150);
    sun.target.updateMatrixWorld();
    skyMat.uniforms.uSun.value.copy(SUN_DIR);
  };
  const updateSky = (cameraPos) => sky.position.copy(cameraPos);
  sky.scale.setScalar(2000);
  return { scene, sun, hemi, follow, updateSky, sky, fogColor };
}
