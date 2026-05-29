// Recorrido en primera persona (tipo shooter) con Three.js, carga diferida.
// Desktop: clic para capturar el mouse, WASD/flechas para moverse, mouse para mirar.
// Móvil: joystick (abajo-izquierda) para moverse, arrastrar para mirar.
// Colisión: raycast contra los muros del modelo (no se atraviesan paredes).

const EYE_HEIGHT = 1.6; // altura de los ojos (m)
const COLLIDE_Y = 1.0; // altura a la que se lanza el rayo de colisión
const RADIUS = 0.35; // "radio" del jugador para no pegarse a los muros
const SPEED = 2.6; // m/s
const LOOK_MOUSE = 0.0022; // sensibilidad mouse (rad/px)
const LOOK_TOUCH = 0.005; // sensibilidad táctil (rad/px)

/**
 * Crea un recorrido en primera persona dentro de `container` cargando `modelUrl`.
 * Devuelve { start, stop, dispose }. Three.js se importa de forma diferida.
 */
export async function createFirstPerson(container, modelUrl) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10131a);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 100);
  camera.rotation.order = 'YXZ';

  // Iluminación (sin techo, entra luz desde arriba)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6b6b, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(3, 8, 4);
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  // Estado
  let yaw = Math.PI; // mirando hacia +Z (entrando al depto)
  let pitch = 0;
  const pos = new THREE.Vector3(2.1, EYE_HEIGHT, -3.0);
  const bounds = new THREE.Box3();
  const collidables = [];
  const keys = { f: 0, b: 0, l: 0, r: 0 };
  const joy = { x: 0, y: 0 };
  let running = false;
  let rafId = 0;
  let lastT = 0;

  const raycaster = new THREE.Raycaster();
  raycaster.far = 5;

  // Cargar modelo
  await new Promise((resolve, reject) => {
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.traverse((o) => {
          if (o.isMesh) collidables.push(o);
        });
        bounds.setFromObject(gltf.scene);
        resolve();
      },
      undefined,
      reject
    );
  });

  // ---- Movimiento con colisión (deslizando por los muros, eje por eje) ----
  const tmpDir = new THREE.Vector3();
  function moveAxis(dx, dz) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return;
    tmpDir.set(dx, 0, dz).normalize();
    raycaster.set(new THREE.Vector3(pos.x, COLLIDE_Y, pos.z), tmpDir);
    const hits = raycaster.intersectObjects(collidables, true);
    const dist = hits.length ? hits[0].distance : Infinity;
    if (dist > len + RADIUS) {
      pos.x += dx;
      pos.z += dz;
    } else {
      const allowed = Math.max(0, dist - RADIUS);
      pos.x += tmpDir.x * allowed;
      pos.z += tmpDir.z * allowed;
    }
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  function update(dt) {
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    const mf = keys.f - keys.b - joy.y; // adelante/atrás (joy.y: arriba = -1 = adelante)
    const ms = keys.r - keys.l + joy.x; // derecha/izquierda
    let vx = forward.x * mf + right.x * ms;
    let vz = forward.z * mf + right.z * ms;
    const m = Math.hypot(vx, vz);
    if (m > 1e-5) {
      vx = (vx / m) * SPEED * dt;
      vz = (vz / m) * SPEED * dt;
      moveAxis(vx, 0);
      moveAxis(0, vz);
    }

    // Mantener dentro del recinto
    pos.x = Math.min(Math.max(pos.x, bounds.min.x + RADIUS), bounds.max.x - RADIUS);
    pos.z = Math.min(Math.max(pos.z, bounds.min.z + RADIUS), bounds.max.z - RADIUS);
    pos.y = EYE_HEIGHT;
    camera.position.copy(pos);
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min((t - lastT) / 1000 || 0, 0.05);
    lastT = t;
    update(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---- Controles ----
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const canvas = renderer.domElement;

  // Teclado (desktop)
  const keymap = {
    KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
    KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  };
  function onKey(e, v) {
    const k = keymap[e.code];
    if (k) { keys[k] = v; e.preventDefault(); }
  }
  const onKeyDown = (e) => onKey(e, 1);
  const onKeyUp = (e) => onKey(e, 0);

  // Mirar con mouse (pointer lock)
  function onClick() {
    if (!isTouch && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  }
  function onMouseMove(e) {
    if (document.pointerLockElement !== canvas) return;
    yaw -= e.movementX * LOOK_MOUSE;
    pitch = clampPitch(pitch - e.movementY * LOOK_MOUSE);
  }

  // Mirar con el dedo (touch) — arrastre fuera del joystick
  let lookId = null, lastX = 0, lastY = 0;
  function onPointerDown(e) {
    if (e.target.closest('.joystick')) return;
    if (e.pointerType === 'touch') {
      lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
    }
  }
  function onPointerMove(e) {
    if (lookId === null || e.pointerId !== lookId) return;
    yaw -= (e.clientX - lastX) * LOOK_TOUCH;
    pitch = clampPitch(pitch - (e.clientY - lastY) * LOOK_TOUCH);
    lastX = e.clientX; lastY = e.clientY;
  }
  function onPointerUp(e) {
    if (e.pointerId === lookId) lookId = null;
  }
  function clampPitch(p) {
    return Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, p));
  }

  // Joystick (móvil)
  let joyEl = null, knob = null, joyId = null, joyCx = 0, joyCy = 0;
  const JOY_R = 46;
  if (isTouch) {
    joyEl = document.createElement('div');
    joyEl.className = 'joystick';
    knob = document.createElement('div');
    knob.className = 'joystick-knob';
    joyEl.appendChild(knob);
    container.appendChild(joyEl);
    joyEl.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      const r = joyEl.getBoundingClientRect();
      joyCx = r.left + r.width / 2; joyCy = r.top + r.height / 2;
      joyEl.setPointerCapture(joyId);
      moveKnob(e.clientX, e.clientY);
    });
    joyEl.addEventListener('pointermove', (e) => {
      if (e.pointerId === joyId) moveKnob(e.clientX, e.clientY);
    });
    const endJoy = (e) => {
      if (e.pointerId === joyId) { joyId = null; joy.x = 0; joy.y = 0; knob.style.transform = 'translate(0,0)'; }
    };
    joyEl.addEventListener('pointerup', endJoy);
    joyEl.addEventListener('pointercancel', endJoy);
  }
  function moveKnob(cx, cy) {
    let dx = cx - joyCx, dy = cy - joyCy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    joy.x = dx / JOY_R;
    joy.y = dy / JOY_R;
  }

  // Pista de ayuda
  const hint = document.createElement('div');
  hint.className = 'fp-hint';
  hint.textContent = isTouch
    ? 'Arrastra para mirar · usa el joystick para caminar'
    : 'Haz clic para mirar · WASD / flechas para caminar · Esc para salir';
  container.appendChild(hint);

  // Mira (crosshair)
  const cross = document.createElement('div');
  cross.className = 'fp-crosshair';
  container.appendChild(cross);

  function bind() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', resize);
  }
  function unbind() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('click', onClick);
    document.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', resize);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    Object.keys(keys).forEach((k) => (keys[k] = 0));
  }

  return {
    start() {
      if (running) return;
      running = true;
      resize();
      bind();
      lastT = performance.now();
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      unbind();
    },
    dispose() {
      this.stop();
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
