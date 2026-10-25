// Dither 3D — WebGL element: 3D model rendered through a 55×2 sprite ramp (pixel + ordered pattern).
// Usage: import { mount } from './dither-hands.min.js'; mount(document.querySelector('#hands'), { model: 'hands.glb' });
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const DEFAULTS = {
  model: 'hands.glb',
  modelData: null,                     // ArrayBuffer with .glb bytes (used instead of `model` when set)
  modelRotation: [0, 0, Math.PI/2],   // rotation applied to the model itself (radians, XYZ)
  tilt: [0.15, 0, -0.18],              // initial view angle (radians; X, Y, Z in screen space)
  fit: 2.6,                            // model size in scene units (bigger = larger in frame)
  flat: false,                         // faceted lighting (auto when the model has no normals)
  pixel: 8,            // size of one "pixel" in CSS px
  offset: 0,           // sprite ramp start, 0..1
  range: 0.75,         // how much of the ramp the object covers, 0..1
  tile: true,          // 2×2 tile sampling (false = one column per level)
  autoSpin: true,      // idle spin around the vertical axis
  spinSpeed: 0.45,     // rad/s
  zoom: 4,             // camera distance
  zoomMin: 1.8,
  zoomMax: 9,
  interactive: true,   // drag to rotate (trackball), wheel/pinch to zoom, double-click to reset
  wheelZoom: true,     // set false if the element sits in a scrolling page and should not capture the wheel
  sprite: [
    'YYYYYRRRPPPPPRPRWRWRWRWRYYYYYYYYWYWYRRRPPKKKKKKKWWWWWWW',
    'YYYYRYRRPPPPRPRPRWWRWRWRYYYYYYYWYWYRYRRPPKKKKKKWKWWWWWW'
  ],
  palette: { Y:'#F5E900', R:'#F4387A', P:'#8C03E8', K:'#1D1D1B', W:'#FFFFFF' }
};

export function mount(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;touch-action:none;' + (o.interactive ? 'cursor:grab;' : '');
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:false, powerPreference:'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  camera.position.set(0, 0, o.zoom);

  // Pass 1: light value (R) + mask (A) into a low-res target
  // flat: true → normals from screen-space derivatives (faceted look, model needs no NORMAL attribute)
  const makeShade = flat => new THREE.ShaderMaterial({
    defines: flat ? { FLAT:'' } : {},
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz;
        #ifndef FLAT
        vN = normalize(normalMatrix * normal);
        #endif
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vP;
      void main(){
        #ifdef FLAT
        vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
        #else
        vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
        #endif
        vec3 L = normalize(vec3(-0.35, 0.9, 0.45));
        gl_FragColor = vec4(dot(n, L) * 0.5 + 0.5, 0.0, 0.0, 1.0);
      }`,
    side: THREE.DoubleSide
  });
  const shadeSmooth = makeShade(false), shadeFlat = makeShade(true);
  const rt = new THREE.WebGLRenderTarget(2, 2, { minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter });

  // Pass 2: sprite ramp lookup
  const SW = o.sprite[0].length;
  const sdata = new Uint8Array(SW * 2 * 4);
  o.sprite.forEach((row, y) => [...row].forEach((ch, x) => {
    const h = parseInt(o.palette[ch].slice(1), 16), i = (y * SW + x) * 4;
    sdata[i] = h >> 16; sdata[i+1] = (h >> 8) & 255; sdata[i+2] = h & 255; sdata[i+3] = 255;
  }));
  const spriteTex = new THREE.DataTexture(sdata, SW, 2);
  spriteTex.magFilter = spriteTex.minFilter = THREE.NearestFilter; spriteTex.needsUpdate = true;

  const U = {
    tex:{ value:rt.texture }, sprite:{ value:spriteTex }, res:{ value:new THREE.Vector2() },
    sw:{ value:SW }, offset:{ value:o.offset }, range:{ value:o.range }, tile:{ value:o.tile ? 1 : 0 }
  };
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
    fragmentShader:`
      uniform sampler2D tex, sprite; uniform vec2 res; uniform float sw, offset, range, tile;
      varying vec2 vUv;
      void main(){
        vec2 px = floor(vUv*res);
        vec4 s = texture2D(tex, (px+0.5)/res);
        float row = mod(px.y, 2.0), col;
        if(s.a < 0.5) col = sw - 1.0;
        else {
          float t = clamp(offset + (1.0 - s.r) * range, 0.0, 1.0);
          col = tile > 0.5 ? min(floor(t * floor((sw - 1.0) / 2.0)) * 2.0 + mod(px.x, 2.0), sw - 1.0)
                           : floor(t * (sw - 1.0));
        }
        gl_FragColor = vec4(texture2D(sprite, vec2((col + 0.5)/sw, (1.0 - row + 0.5)/2.0)).rgb, 1.0);
      }`
  }));
  const postScene = new THREE.Scene(); postScene.add(post);
  const postCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  // Model
  const pivot = new THREE.Group(); scene.add(pivot);
  const BASE = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.tilt[0], o.tilt[1], o.tilt[2], 'ZXY'));
  pivot.quaternion.copy(BASE);
  const ready = new Promise((resolve, reject) => {
    const onLoad = g => {
      const m = new THREE.Group(); g.scene.rotation.set(o.modelRotation[0], o.modelRotation[1], o.modelRotation[2]); m.add(g.scene);
      m.traverse(n => { if(n.isMesh) n.material = (o.flat || !n.geometry.attributes.normal) ? shadeFlat : shadeSmooth; });
      const box = new THREE.Box3().setFromObject(m);
      const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      const k = o.fit / Math.max(s.x, s.y, s.z);
      m.position.copy(c).multiplyScalar(-k); m.scale.setScalar(k);
      pivot.add(m); resolve();
    };
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    if(o.modelData) loader.parse(o.modelData, '', onLoad, reject);
    else loader.load(o.model, onLoad, undefined, reject);
  });

  // Size follows the container
  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const rw = Math.max(1, Math.round(w / o.pixel)), rh = Math.max(1, Math.round(h / o.pixel));
    rt.setSize(rw, rh); U.res.value.set(rw, rh);
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // Interaction: trackball + zoom
  const Y_AXIS = new THREE.Vector3(0,1,0), _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
  const SENS = 0.008;
  let drag = null, pinch = null, zoom = o.zoom;
  const vel = { axis:new THREE.Vector3(0,1,0), w:0 };
  const pts = new Map();
  const setZoom = z => { zoom = Math.min(o.zoomMax, Math.max(o.zoomMin, z)); camera.position.z = zoom; };
  const dist = () => { const [a,b] = [...pts.values()]; return Math.hypot(a.x-b.x, a.y-b.y) || 1; };
  const rotateScreen = (dx, dy) => {
    const len = Math.hypot(dx, dy); if(!len) return 0;
    _axis.set(dy, dx, 0).normalize();
    pivot.quaternion.premultiply(_q.setFromAxisAngle(_axis, len * SENS)).normalize();
    return len * SENS;
  };
  const on = (t, f, opt) => { canvas.addEventListener(t, f, opt); return () => canvas.removeEventListener(t, f, opt); };
  const off = [];
  if(o.interactive){
    if(o.wheelZoom) off.push(on('wheel', e => { e.preventDefault(); setZoom(zoom * Math.exp(e.deltaY * 0.0015)); }, { passive:false }));
    off.push(on('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x:e.clientX, y:e.clientY }); vel.w = 0;
      if(pts.size === 2){ drag = null; pinch = { d:dist(), z:zoom }; }
      else drag = { x:e.clientX, y:e.clientY, t:performance.now() };
      canvas.style.cursor = 'grabbing';
    }));
    off.push(on('pointermove', e => {
      if(!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if(pinch && pts.size === 2){ setZoom(pinch.z * pinch.d / dist()); return; }
      if(!drag) return;
      const now = performance.now(), ang = rotateScreen(e.clientX - drag.x, e.clientY - drag.y);
      if(ang){ vel.axis.copy(_axis); vel.w = ang / Math.max(1, now - drag.t) * 1000; }
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
    }));
    const up = e => {
      pts.delete(e.pointerId); if(pts.size < 2) pinch = null;
      if(drag && performance.now() - drag.t > 80) vel.w = 0;
      drag = null; canvas.style.cursor = 'grab';
    };
    off.push(on('pointerup', up), on('pointercancel', up));
    off.push(on('dblclick', () => { pivot.quaternion.copy(BASE); vel.w = 0; setZoom(o.zoom); }));
  }

  // Render only while visible
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(container);

  const clock = new THREE.Clock();
  let spin = o.autoSpin && !reduceMotion;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if(!visible || document.hidden) return;
    if(!drag){
      if(vel.w > 0.02){ pivot.quaternion.premultiply(_q.setFromAxisAngle(vel.axis, vel.w * dt)).normalize(); vel.w *= Math.exp(-dt * 3.5); }
      else if(spin) pivot.quaternion.premultiply(_q.setFromAxisAngle(Y_AXIS, o.spinSpeed * dt));
    }
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  });

  // Public controls
  return {
    ready,
    set(opts){
      Object.assign(o, opts);
      if('offset' in opts) U.offset.value = o.offset;
      if('range' in opts) U.range.value = o.range;
      if('tile' in opts) U.tile.value = o.tile ? 1 : 0;
      if('pixel' in opts) resize();
      if('zoom' in opts) setZoom(o.zoom);
      if('autoSpin' in opts) spin = o.autoSpin && !reduceMotion;
    },
    reset(){ pivot.quaternion.copy(BASE); vel.w = 0; setZoom(o.zoom); },
    // Current view in mount() terms: pass it back as { tilt, zoom } to start from the same angle
    view(){
      const e = new THREE.Euler().setFromQuaternion(pivot.quaternion, 'ZXY');
      return { tilt:[e.x, e.y, e.z].map(v => +v.toFixed(4)), zoom:+zoom.toFixed(3) };
    },
    destroy(){
      renderer.setAnimationLoop(null); ro.disconnect(); io.disconnect(); off.forEach(f => f());
      renderer.dispose(); rt.dispose(); spriteTex.dispose(); canvas.remove();
    }
  };
}
