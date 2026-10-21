import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { items, basics } from './catalog.js';
import { createPanel } from './panel.js';
import { createPlacement } from './placement.js';
import { createCameraMode } from './camera-mode.js';

const $play = document.querySelector('.play');
const $stage = document.querySelector('.stage');
const $canvas = document.querySelector('.stage__canvas');
const $loading = document.querySelector('.stage__loading');
const $tools = document.querySelector('.tools');
const $hint = document.querySelector('.stage__hint');
const $finish = document.querySelector('.finish');

// iso camera like the blender renders: 45° around, 33° down
const VIEW_DIRECTION = new THREE.Vector3(1, 0.92, 1).normalize();
const VIEW_TARGET = new THREE.Vector3(-0.1, 0.95, -0.1);
const VIEW_SIZE = 6.4; // world units visible from top to bottom
const VIEW_WIDTH = 5.6; // world units the room needs from left to right (phones)
const BACKGROUND = '#8c865c';

let renderer, scene, camera, placement, panel, cameraMode;
const materials = {}; // name - material from the glb
const originals = {}; // name - { color, map } to undo a basic option
const textureLoader = new THREE.TextureLoader();

const init = async () => {
  renderer = new THREE.WebGPURenderer({ canvas: $canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);

  camera = new THREE.OrthographicCamera();
  camera.position.copy(VIEW_TARGET).addScaledVector(VIEW_DIRECTION, 20);
  camera.lookAt(VIEW_TARGET);
  camera.near = 0.1;
  camera.far = 60;

  addLights();
  addGround();
  resize();
  window.addEventListener('resize', resize);

  const room = await loadRoom();
  setupPlay(room);

  cameraMode = createCameraMode({ renderer, scene, camera, $stage });

  $loading.hidden = true;
  renderer.setAnimationLoop(draw);
};

const addLights = () => {
  // soft warm sky, olive bounce, from below
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x8f8a5f, 1.6));

  // warm key light from the open side of the room, casts the shadows
  const sun = new THREE.DirectionalLight(0xffd2a1, 2.4);
  sun.position.set(4, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);

  // cosy glow like from ceiling lamp
  const lamp = new THREE.PointLight(0xffc98a, 6, 6, 1.5);
  lamp.position.set(-0.4, 2.3, -0.4);
  scene.add(lamp);
};

// olive ground that only shows the room's shadow
const addGround = () => {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowNodeMaterial({ opacity: 0.25 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.121;
  ground.receiveShadow = true;
  scene.add(ground);
};

const loadRoom = async () => {
  const gltf = await new GLTFLoader().loadAsync('models/room.glb');
  const root = gltf.scene;

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    list.forEach((material) => {
      materials[material.name] = material;
      fixMaterial(material, child);
    });
  });

  // room parts stay, assets become templates for the catalog
  const templates = {};
  const roomParts = [];
  [...root.children].forEach((child) => {
    if (child.name.startsWith('Room_') || child.name === 'Window_View') roomParts.push(child);
    else templates[child.name] = child;
  });
  Object.values(templates).forEach((template) => template.removeFromParent());
  scene.add(root);

  return { root, templates };
};

// fixes for partialy transparen materials
const fixMaterial = (material, mesh) => {
  const { name } = material;
  if (name.startsWith('Mohair_Fur')) {
    // fur shells (cut out instead of blending , so no sorting problems)
    material.transparent = false;
    material.alphaTest = 0.5;
    mesh.castShadow = false;
  }
  if (name.startsWith('Lace_') || name === 'Frog_Net') {
    material.side = THREE.DoubleSide;
    material.transparent = true;
    material.depthWrite = false;
    mesh.castShadow = name === 'Frog_Net';
  }
  if (name.startsWith('Persian_Rug')) {
    // no velvet sheen ( washed the red out to pink)
    material.sheen = 0;
    material.roughness = 1;
    material.metalness = 0;
    material.envMapIntensity = 0;
  }
  if (name === 'Window_Glass') {
    material.transparent = true;
    material.depthWrite = false;
    mesh.castShadow = false;
  }
};

const textures = {};
// plain white texture for painted wood (missing map breaks the shadow pass in webgpu)
const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
blank.needsUpdate = true;
const loadTexture = (url, repeat = [1, 1]) => {
  if (!textures[url]) {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
    textures[url] = texture;
  }
  return textures[url];
};

// basics recolor: walls, linoleum, and wood
const applyBasic = (basic, option) => {
  basic.materials.forEach((name) => {
    const material = materials[name];
    if (!material) return;
    originals[name] ??= { color: material.color.clone(), map: material.map };
    const original = originals[name];

    // texture option > painted (no wood grain) > original texture, colour multiplies on top
    let map = original.map;
    if (option.paint) map = blank;
    if (option.texture) map = loadTexture(option.texture, option.repeat);
    material.map = map;
    material.color.set(option.paint || option.color);
    material.needsUpdate = true;
  });
};

const setupPlay = ({ root, templates }) => {
  const floor = root.getObjectByName('Room_Floor');
  const leftWall = new THREE.Box3().setFromObject(root.getObjectByName('Room_Wall_Left'));
  const backWall = new THREE.Box3().setFromObject(root.getObjectByName('Room_Wall_Back'));
  const bounds = {
    left: leftWall.max.x,
    back: backWall.max.z,
    right: -leftWall.max.x,
    front: -backWall.max.z,
    height: backWall.max.y,
  };

  placement = createPlacement({
    scene,
    camera,
    $canvas,
    $tools,
    $hint,
    bounds,
    templates,
    floor,
    onChange: () => {
      panel?.refresh();
      $finish.disabled = placement.total() === 0;
    },
  });

  panel = createPanel({
    items,
    basics,
    onPick: (item) => (placement.placing() === item.id ? placement.cancel() : placement.start(item)),
    onBasic: applyBasic,
    countOf: placement.countOf,
    placingId: placement.placing,
  });

  // walls start white
  applyBasic(basics[0], basics[0].options[0]);
};

const toggleFinish = () => {
  const done = $play.classList.toggle('play--done');
  $finish.textContent = done ? 'Back to edit' : 'Take picture';

  if (done) cameraMode.enter();
  else cameraMode.exit();

  placement.cancel();
  placement.clearSelection();
  requestAnimationFrame(resize);
};

const resize = () => {
  const width = $stage.clientWidth;
  const height = $stage.clientHeight;
  renderer.setSize(width, height, false);

  // fit the room in both directions
  const aspect = width / height;
  const half = Math.max(VIEW_SIZE / 2, VIEW_WIDTH / 2 / aspect);
  camera.left = -half * aspect;
  camera.right = half * aspect;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
};

const draw = () => {
  placement?.update();
  if (cameraMode?.active) cameraMode.render();
  else renderer.render(scene, camera);
};

$finish.addEventListener('click', toggleFinish);

init();
