import * as THREE from 'three/webgpu';
import { bedOffsets } from './catalog.js';

const BLUE = 0x3d6bff;
const RED = 0xe0453a;
const SNAP = 0.05;
const ROTATE_STEP = Math.PI / 4;
const HINTS = {
  floor: 'Point at the floor',
  wall: 'Point at a wall',
  'floor wall': 'Point at the floor or a wall',
  top: 'Point at the floor or a furniture top',
  bed: 'Point at the bed',
};

const snap = (value) => Math.round(value / SNAP) * SNAP;

// thin blue lines every `cell` metres on a w x h plane (xy plane, centred)
const makeGrid = (w, h, cell = 0.3) => {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicNodeMaterial({ color: BLUE, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  const points = [];
  for (let x = -w / 2; x <= w / 2 + 0.001; x += cell) points.push(x, -h / 2, 0, x, h / 2, 0);
  for (let y = -h / 2; y <= h / 2 + 0.001; y += cell) points.push(-w / 2, y, 0, w / 2, y, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicNodeMaterial({ color: BLUE, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  group.add(fill, lines);
  group.renderOrder = 2;
  group.visible = false;
  return group;
};

export const createPlacement = ({ scene, camera, $canvas, $tools, $hint, bounds, templates, floor, onChange }) => {
  const { left, back, right, front, height } = bounds;

  // every placed item lives in this layer (or is attached to a furniture inside it)
  const layer = new THREE.Group();
  layer.name = 'placed';
  scene.add(layer);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const box = new THREE.Box3();

  // state
  let mode = 'idle'; // idle | placing | dragging
  let active = null; // item following the pointer
  let selected = null;
  let lastHit = null;
  let dragFrom = null; // where a dragged item came from, to undo a click without moving
  let moved = false;

  // grids on the floor and both walls
  const grids = {
    floor: makeGrid(right - left, front - back),
    left: makeGrid(front - back, height),
    back: makeGrid(right - left, height),
  };
  grids.floor.rotation.x = -Math.PI / 2;
  grids.floor.position.set((left + right) / 2, 0.006, (back + front) / 2);
  grids.left.rotation.y = Math.PI / 2;
  grids.left.position.set(left + 0.006, height / 2, (back + front) / 2);
  grids.back.position.set((left + right) / 2, height / 2, back + 0.006);
  Object.values(grids).forEach((grid) => scene.add(grid));

  // translucent blue box around the selected item
  const highlight = new THREE.Group();
  const highlightBox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicNodeMaterial({ color: BLUE, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  const highlightEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicNodeMaterial({ color: BLUE }),
  );
  highlight.add(highlightBox, highlightEdges);
  highlight.renderOrder = 3;
  highlight.visible = false;
  scene.add(highlight);

  const showGrids = (on = '') => {
    grids.floor.visible = on.includes('floor') || on.includes('top');
    grids.left.visible = on.includes('wall');
    grids.back.visible = on.includes('wall');
  };

  // the placed item an object belongs to (meshes sit a few levels deep)
  const placedOf = (object) => {
    let current = object;
    while (current && !current.userData.item) current = current.parent;
    return current;
  };

  const isInside = (object, parent) => {
    let current = object;
    while (current) {
      if (current === parent) return true;
      current = current.parent;
    }
    return false;
  };

  const countOf = (id) => {
    let count = 0;
    layer.traverse((child) => {
      if (child.userData.item?.id === id && child !== active) count++;
    });
    return count;
  };

  // build a fresh copy of the models of a catalog item
  const fillModels = (root, variant) => {
    const { item } = root.userData;
    // drop old model parts, keep items that stand on it
    root.children.filter((child) => !child.userData.item).forEach((child) => root.remove(child));
    const names = variant === 'wall' && item.wallModels ? item.wallModels : item.models;
    names.forEach((name) => {
      const model = templates[name].clone();
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      if (item.on === 'bed') model.position.fromArray(bedOffsets[name]);
      root.add(model);
    });
    root.userData.variant = variant;
  };

  const build = (item) => {
    const root = new THREE.Group();
    root.name = item.id;
    root.userData.item = item;
    fillModels(root, 'floor');
    return root;
  };

  // find the surface under the pointer that this item may stand on
  const hitSurface = (on, exclude) => {
    raycaster.setFromCamera(pointer, camera);
    const { ray } = raycaster;

    // beddings: only on a bed
    if (on === 'bed') {
      const beds = [];
      layer.traverse((child) => {
        if (child.userData.item?.id === 'bed-frame') beds.push(child);
      });
      const hit = raycaster.intersectObjects(beds, true)[0];
      return hit ? { kind: 'bed', point: hit.point, parent: placedOf(hit.object) } : null;
    }

    // any surface facing up: floor, desk, bed, nightstand, shelf, tv...
    if (on === 'top') {
      const hits = raycaster.intersectObjects([floor, layer], true)
        .filter((hit) => hit.object.visible && !isInside(hit.object, exclude));
      const hit = hits[0];
      if (!hit?.face) return null;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const parent = placedOf(hit.object);
      // flat rugs don't carry items around
      const carrier = parent && parent.userData.item.id !== 'persian-rug' ? parent : null;
      if (normal.y > 0.7) return { kind: 'top', point: hit.point, parent: carrier };

      // pointing at the side of a furniture: stand on its top surface instead
      const top = parent?.userData.item.top;
      if (top === undefined) return null;
      const point = new THREE.Vector3();
      if (!ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(parent.getWorldPosition(new THREE.Vector3()).y + top)), point)) return null;
      modelBox(parent);
      if (point.x < box.min.x || point.x > box.max.x || point.z < box.min.z || point.z > box.max.z) return null;
      return { kind: 'top', point, parent: carrier };
    }

    // floor and walls are plain planes, closest valid one wins
    const options = [];
    const point = new THREE.Vector3();
    if (on.includes('floor') && ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) {
      if (point.x >= left && point.x <= right && point.z >= back && point.z <= front) {
        options.push({ kind: 'floor', point: point.clone() });
      }
    }
    if (on.includes('wall')) {
      if (ray.intersectPlane(new THREE.Plane(new THREE.Vector3(1, 0, 0), -left), point)) {
        if (point.z >= back && point.z <= front && point.y >= 0 && point.y <= height) {
          options.push({ kind: 'wall', wall: 'left', point: point.clone() });
        }
      }
      if (ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -back), point)) {
        if (point.x >= left && point.x <= right && point.y >= 0 && point.y <= height) {
          options.push({ kind: 'wall', wall: 'back', point: point.clone() });
        }
      }
    }
    options.sort((a, b) => a.point.distanceTo(ray.origin) - b.point.distanceTo(ray.origin));
    return options[0] || null;
  };

  // box of the item itself, without what stands on it
  const modelBox = (root) => {
    box.makeEmpty();
    root.children.filter((child) => !child.userData.item).forEach((child) => box.expandByObject(child));
    return box;
  };

  // floor furniture may not stand inside each other (rugs can go under anything)
  const isFlat = (object) => object.userData.item.id === 'persian-rug';
  const overlaps = (object) => {
    if (object.userData.kind !== 'floor' || isFlat(object)) return false;
    const own = modelBox(object).clone().expandByScalar(-0.02);
    return layer.children.some((other) => other !== object && other.userData.kind === 'floor'
      && !isFlat(other) && own.intersectsBox(modelBox(other)));
  };

  // keep an item inside the room
  const clamp = (object) => {
    box.setFromObject(object);
    if (box.min.x < left) object.position.x += left - box.min.x;
    else if (box.max.x > right) object.position.x -= box.max.x - right;
    if (box.min.z < back) object.position.z += back - box.min.z;
    else if (box.max.z > front) object.position.z -= box.max.z - front;
  };

  const applyHit = (object, hit) => {
    const { item } = object.userData;
    object.userData.kind = hit.kind;

    if (hit.kind === 'bed') {
      hit.parent.getWorldPosition(object.position);
      object.rotation.y = hit.parent.rotation.y;
      return;
    }

    // the rug switches between the floor and the wall model
    if (item.wallModels) {
      const variant = hit.kind === 'wall' ? 'wall' : 'floor';
      if (object.userData.variant !== variant) fillModels(object, variant);
    }

    if (hit.kind === 'wall') {
      // face away from the wall, back against it, centred on the pointer
      object.rotation.y = hit.wall === 'left' ? Math.PI / 2 : 0;
      object.position.copy(hit.point);
      box.setFromObject(object);
      object.position.y += snap(hit.point.y) - (box.min.y + box.max.y) / 2;
      box.setFromObject(object);
      if (box.min.y < 0.05) object.position.y += 0.05 - box.min.y;
      if (box.max.y > height - 0.05) object.position.y -= box.max.y - (height - 0.05);
      if (hit.wall === 'left') object.position.x += left + 0.004 - box.min.x;
      else object.position.z += back + 0.004 - box.min.z;
      object.position.x = hit.wall === 'left' ? object.position.x : snap(object.position.x);
      object.position.z = hit.wall === 'back' ? object.position.z : snap(object.position.z);
    } else if (hit.kind === 'floor') {
      object.position.set(snap(hit.point.x), 0, snap(hit.point.z));
    } else {
      object.position.copy(hit.point);
    }
    clamp(object);
  };

  const updatePointer = (event) => {
    const rect = $canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const follow = () => {
    const hit = hitSurface(active.userData.item.on, active);
    if (!hit) return;
    applyHit(active, hit);
    active.userData.blocked = overlaps(active);
    active.visible = true;
    lastHit = hit;
    moved = true;
  };

  // put the item down, standing on whatever carries it
  const drop = () => {
    const carrier = lastHit?.parent && lastHit.parent !== active ? lastHit.parent : layer;
    carrier.attach(active);
  };

  const select = (object) => {
    selected = object;
    highlight.visible = !!object;
  };

  const start = (item) => {
    cancel();
    select(null);
    active = build(item);
    active.visible = false;
    layer.add(active);
    mode = 'placing';
    lastHit = null;
    showGrids(item.on);
  };

  const cancel = () => {
    if (mode === 'placing' && active) active.removeFromParent();
    active = null;
    mode = 'idle';
    showGrids();
    onChange();
  };

  const remove = () => {
    if (!selected) return;
    selected.removeFromParent();
    select(null);
    onChange();
  };

  const rotate = (direction = 1) => {
    const target = mode === 'placing' ? active : selected;
    // wall items follow their wall, beddings follow the bed
    if (!target || ['wall', 'bed'].includes(target.userData.kind)) return;
    if (target !== selected) {
      target.rotation.y += ROTATE_STEP * direction;
      clamp(target);
      target.userData.blocked = overlaps(target);
      return;
    }
    const before = { position: selected.position.clone(), rotation: selected.rotation.y };
    selected.rotation.y += ROTATE_STEP * direction;
    clamp(selected);
    // no room to turn: undo
    if (selected.parent === layer && overlaps(selected)) {
      selected.position.copy(before.position);
      selected.rotation.y = before.rotation;
    }
  };

  // pointer handling on the canvas
  const onPointerDown = (event) => {
    updatePointer(event);

    if (mode === 'placing') {
      if (!lastHit || active.userData.blocked) return;
      drop();
      const placed = active;
      active = null;
      mode = 'idle';
      showGrids();
      select(placed);
      onChange();
      return;
    }

    // grab an item that is already in the room
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(layer, true).find((h) => h.object.visible);
    const object = hit && placedOf(hit.object);
    select(object || null);
    if (!object) return;

    dragFrom = { parent: object.parent };
    layer.attach(object);
    dragFrom.position = object.position.clone();
    dragFrom.rotation = object.rotation.y;
    object.userData.blocked = false;
    active = object;
    mode = 'dragging';
    moved = false;
    lastHit = null;
    $canvas.setPointerCapture(event.pointerId);
    showGrids(object.userData.item.on);
  };

  const onPointerMove = (event) => {
    updatePointer(event);
    if (mode === 'placing' || mode === 'dragging') follow();
  };

  const onPointerUp = () => {
    if (mode !== 'dragging') return;
    if (moved && lastHit && !active.userData.blocked) {
      drop();
    } else {
      // only clicked or dropped inside another item: back where it was
      active.position.copy(dragFrom.position);
      active.rotation.y = dragFrom.rotation;
      active.userData.blocked = false;
      dragFrom.parent.attach(active);
    }
    active = null;
    mode = 'idle';
    showGrids();
    onChange();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (mode === 'placing') cancel();
      else select(null);
    }
    if (event.key === 'r' || event.key === 'R') rotate(event.shiftKey ? -1 : 1);
    if (event.key === 'Delete' || event.key === 'Backspace') remove();
  };

  $canvas.addEventListener('pointerdown', onPointerDown);
  $canvas.addEventListener('pointermove', onPointerMove);
  $canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  $tools.querySelector('.tools__button--left').addEventListener('click', () => rotate(-1));
  $tools.querySelector('.tools__button--right').addEventListener('click', () => rotate(1));
  $tools.querySelector('.tools__button--delete').addEventListener('click', remove);

  // every frame: blue box + tools follow the selected item
  const update = () => {
    const target = mode === 'placing' && active?.visible ? active : selected;
    highlight.visible = !!target;
    if (target) {
      const blocked = target.userData.blocked && mode !== 'idle';
      highlightBox.material.color.setHex(blocked ? RED : BLUE);
      highlightBox.material.opacity = blocked ? 0.4 : 0.18;
      highlightEdges.material.color.setHex(blocked ? RED : BLUE);
      box.setFromObject(target);
      box.getCenter(highlight.position);
      box.getSize(highlight.scale);
      highlight.scale.addScalar(0.02);
    }

    // short hint under the room while moving things
    let hint = '';
    if (mode === 'placing') hint = active.visible ? 'Click to put it here · R to turn · Esc to cancel' : HINTS[active.userData.item.on];
    if (mode !== 'idle' && active?.userData.blocked) hint = 'Something is in the way';
    $hint.textContent = hint;
    $hint.hidden = !hint;

    $tools.hidden = !selected || mode !== 'idle';
    if (!$tools.hidden) {
      const top = new THREE.Vector3(highlight.position.x, box.max.y, highlight.position.z).project(camera);
      const rect = $canvas.getBoundingClientRect();
      $tools.style.left = `${(top.x + 1) / 2 * rect.width}px`;
      $tools.style.top = `${(1 - top.y) / 2 * rect.height}px`;
      $tools.classList.toggle('tools--fixed', ['wall', 'bed'].includes(selected.userData.kind));
    }
  };

  return {
    start,
    cancel,
    countOf,
    update,
    clearSelection: () => select(null),
    total: () => layer.children.length,
    placing: () => (mode === 'placing' ? active.userData.item.id : null),
  };
};
