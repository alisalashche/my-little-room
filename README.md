# My Little Room

Furnish the childhood room you remember: pick furniture and decor from the panel, place it on the floor, the walls or on top of other furniture, recolour the walls, floor and wood, then press Finish.

Made for Expert Creative Development, WebGPU + three.js challenge (Devine, Howest).

- Live: https://alisalashche.github.io/my-little-room/
- Shadertoy shader: https://www.shadertoy.com/view/4slSWf (sketch / pencil effect for the camera mode, port in progress)

## Run it

```bash
npm install
npm run dev
```

## How it is built

| File | What it does |
|---|---|
| `js/script.js` | WebGPU renderer, iso camera, lights, loads `public/models/room.glb`, basics (wall, floor and wood colours), Finish |
| `js/catalog.js` | Every card in the panel: which model, where it may stand, how many |
| `js/panel.js` | Builds the cards and colour swatches |
| `js/placement.js` | Raycasting, the blue grid, snapping, dragging, rotating, deleting |
| `public/models/room.glb` | Room + all objects, made in Blender |
| `public/thumbs/` | 1×1 renders of every object for the cards |

Placement rules:
- `floor` items stand on the floor and can't overlap other floor furniture (rugs may go under anything)
- `wall` items hang flat against the left or back wall
- `top` items stand on any surface facing up, and move along with the furniture they stand on
- the Persian rug lies on the floor or hangs on a wall, depending on where you point

Controls: click a card, click in the room to place. Drag to move, R to turn (Shift+R the other way), Delete to remove, Esc to cancel.

## Credits

- 3D models and textures: made in Blender with Python, AI-assisted (Claude), art direction and optimisation by me
- Code: written with help from Claude (AI-assisted)
- three.js r186 (WebGPURenderer), Vite
- Fonts: Anton and Oswald (Google Fonts)
