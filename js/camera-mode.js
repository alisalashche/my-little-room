// camera mode: the room is rendered into a texture, then the sepia shader draws it on screen
import * as THREE from 'three/webgpu';
import { sampler, texture, uniform, uv, wgslFn } from 'three/tsl';

import sepiaCode from './shaders/sepia.wgsl?raw';

const LENS_MIN = 0.06;
const LENS_MAX = 0.5;

// the overlay with the frame, lens slider and shutter
const makeOverlay = () => {
  const $shot = document.createElement('div');
  $shot.classList.add('shot');
  $shot.hidden = true;
  $shot.innerHTML = `
    <div class="shot__frame" aria-hidden="true">
      <span class="shot__corner shot__corner--tl"></span>
      <span class="shot__corner shot__corner--tr"></span>
      <span class="shot__corner shot__corner--bl"></span>
      <span class="shot__corner shot__corner--br"></span>
      <p class="shot__rec">REC</p>
    </div>
    <div class="shot__bar">
      <label class="shot__lens">
        <span class="shot__lens-label">Lens</span>
        <input class="shot__lens-input" type="range" min="${LENS_MIN}" max="${LENS_MAX}" step="0.01" value="0.22">
      </label>
      <button class="shot__shutter" type="button" aria-label="Take a photo"></button>
      <p class="shot__hint">Drag to move the lens · Space = photo</p>
    </div>
    <p class="shot__note" hidden>Camera mode needs a browser with WebGPU (Chrome or Edge)</p>
    <div class="shot__flash"></div>
  `;
  return $shot;
};

export const createCameraMode = ({ renderer, scene, camera, $stage }) => {
  const $shot = makeOverlay();
  $stage.append($shot);
  const $lens = $shot.querySelector('.shot__lens-input');
  const $flash = $shot.querySelector('.shot__flash');

  // the room is drawn into this texture first, the shader reads it like shadertoy's iChannel0
  const size = new THREE.Vector2();
  const target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType });

  // shadertoy inputs: iResolution, iMouse, iTime (+ our own lens size)
  const resolution = uniform(new THREE.Vector2(1, 1));
  const mouse = uniform(new THREE.Vector2(0.5, 0.5));
  const time = uniform(0);
  const lens = uniform(Number($lens.value));

  // the sepia shader reads the room texture and draws on a quad that fills the screen
  const roomTexture = texture(target.texture);
  const sepia = wgslFn(sepiaCode);
  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = sepia({
    tex: roomTexture,
    tex_sampler: sampler(roomTexture),
    uv: uv(),
    resolution,
    mouse,
    time,
    lens,
  });
  material.toneMapped = false;
  const quad = new THREE.QuadMesh(material);

  const timer = new THREE.Timer();
  let active = false;
  let wantPhoto = false;
  let dragging = false;
  const supported = renderer.backend.isWebGPUBackend === true;

  const enter = () => {
    active = supported;
    $shot.hidden = false;
    $shot.querySelector('.shot__note').hidden = supported;
    $shot.querySelector('.shot__bar').hidden = !supported;
  };

  const exit = () => {
    active = false;
    $shot.hidden = true;
  };

  // pointer in uv: 0,0 bottom left, 1,1 top right (like iMouse / iResolution)
  const moveLens = (event) => {
    const rect = $shot.getBoundingClientRect();
    mouse.value.set((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
  };

  // the lens only moves while you drag, so it stays put when you reach for the shutter
  const onPointerDown = (event) => {
    if (event.target.closest('.shot__bar')) return;
    dragging = true;
    $shot.classList.add('shot--dragging');
    $shot.setPointerCapture(event.pointerId);
    moveLens(event);
  };

  const onPointerMove = (event) => {
    if (dragging) moveLens(event);
  };

  const onPointerUp = () => {
    dragging = false;
    $shot.classList.remove('shot--dragging');
  };

  // scroll = bigger or smaller lens
  const onWheel = (event) => {
    event.preventDefault();
    const value = THREE.MathUtils.clamp(lens.value - event.deltaY * 0.0006, LENS_MIN, LENS_MAX);
    lens.value = value;
    $lens.value = value;
  };

  // the photo: copy the canvas right after drawing (before the browser clears it) and save it as a png
  const savePhoto = () => {
    const $copy = document.createElement('canvas');
    $copy.width = renderer.domElement.width;
    $copy.height = renderer.domElement.height;
    $copy.getContext('2d').drawImage(renderer.domElement, 0, 0);
    $copy.toBlob((blob) => {
      const $link = document.createElement('a');
      $link.href = URL.createObjectURL(blob);
      $link.download = `my-little-room-sepia.png`;
      $link.click();
      setTimeout(() => URL.revokeObjectURL($link.href), 1000);
    });
  };

  const flash = () => {
    $flash.classList.remove('shot__flash--on');
    // restart the css animation
    void $flash.offsetWidth;
    $flash.classList.add('shot__flash--on');
  };

  $shot.addEventListener('pointerdown', onPointerDown);
  $shot.addEventListener('pointermove', onPointerMove);
  $shot.addEventListener('pointerup', onPointerUp);
  $shot.addEventListener('pointercancel', onPointerUp);
  $shot.addEventListener('wheel', onWheel, { passive: false });
  $lens.addEventListener('input', () => {
    lens.value = Number($lens.value);
  });
  $shot.querySelector('.shot__shutter').addEventListener('click', () => {
    wantPhoto = true;
  });
  window.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.key === ' ') {
      event.preventDefault();
      wantPhoto = true;
    }
  });

  // called every frame instead of renderer.render while camera mode is on
  const render = () => {
    timer.update();
    time.value = timer.getElapsed();

    renderer.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    resolution.value.copy(size);

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    quad.render(renderer);

    if (wantPhoto) {
      wantPhoto = false;
      flash();
      savePhoto();
    }
  };

  return {
    enter,
    exit,
    render,
    get active() {
      return active;
    },
  };
};
