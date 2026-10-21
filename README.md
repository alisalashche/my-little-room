# My Little Room

Mini game about room furnishing is inspired by my childhood memories. It was my first own room, in typical block bulding from the 80s - which, unfortunately, was destroyed in 2022. 

## Design 
I tried to draw my full concept on paper first (not everything was implemented and some things were modified). 
![Sketshes of start, play, and camera screens](/public/readme-img/sketches.jpg)

Based on my drawing and references below I generated how the render of the room in 3D could look like in Gemini AI.
![Several references](/public/readme-img/refs.png) Prompt:
```
Generate a room with composition like on the second image, but stile like on the first, room description: 
 - Square room, yellow walls with small blue rectangles pattern, 
 - Window on the right wall on the center like in the soviet buildings, with the lace white curtains
 - Floor is reddish brown linoleum with red persian rug on it
 - Also on the left wall red persian rug is ahanging
 - Next to the left wall awith rug a wooden bed for one person with wool blanket on top and pink star plushie
 - Next to the right wall and window - wide wooden table with a lot of books, pens, color pencils, art and craft materials and aquarium lantern with drawn fish 
 - In the corner between bed and table - a basket in form of frog with children toys and hula-hoop
 - Next to the table computer chair same light green color as frog basket
 - In the right part next to table is a nightstand with old rectangular TV with the lace servette on top of it
 - On the right side but closer to viewer is a nightstand with a doll house as on 3rd pictur
```
From the render I received and some photo references I made a styleguide in Figma, as well as the layout of the main game screen (panel UI).
![Styleguide](/public/readme-img/style-guide.png)
![Play screen design](/public/readme-img/UI.png)

Than I used Claude cowork with Blender (add Blender connector to Claude, installed MCP server add-on for Blender). Through multiple iterations I've got all needed models. I also optimized models a bit by deleting unnecessary faces.
![alt text](/public/readme-img/preview-room.png) ![alt text](/public/readme-img/thumbs-overview.png)

## File structure

| File | What it does |
|---|---|
| `js/script.js` | WebGPU renderer, iso camera, lights, loads `public/models/room.glb`, basics (wall, floor and wood colours), Finish |
| `js/catalog.js` | Every card in the panel: which model, where it may stand, how many |
| `js/panel.js` | Builds the cards and colour swatches |
| `js/placement.js` | Raycasting, the blue grid, snapping, dragging, rotating, deleting |
| `js/camera-mode.js` | Renders the room into a texture, puts a filter on top, builds the camera UI, saves the photo |
|`js/shaders/sketch.wgsl` |	Pencil sketch filter (the slot for your 4slSWf port) |
|`js/shaders/comic.wgsl` |	Comic halftone dots |
|`js/shaders/old-photo.wgsl` |	Sepia, grain and scratches |
|`css/camera-mode.css`	| Frame corners, REC dot, filter buttons, lens slider, shutter |
| `public/models/room.glb` | Room + all objects, made in Blender |
| `public/thumbs/` | 1×1 renders of every object for the cards |

Placement rules:
- `floor` items stand on the floor and can't overlap other floor furniture
- `wall` items hang flat against the left or back wall
- `top` items stand on any surface facing up, and move along with the furniture they stand on
- the persian rug lies on the floor or hangs on a wall, depending on where you point

Controls: 
- Click on card -> click in the room to place
- Drag to move
- `R` to turn (`Shift+R` the other way)
- `Delete` to remove
- `Esc` to cancel
---
## Links & credits

- Online: https://alisalashche.github.io/my-little-room/
- Figma design: https://www.figma.com/design/0u8HwPtOVhdzB0nv4UK8U7/my-little-room?node-id=0-1&t=GsmXMNpuVwtfOE0N-1

- 3D models and textures: made in Blender with AI-assistance (Claude), art direction and optimisation by me

- Fonts (from Google Fonts): 
    - Mohave 
    - Saira Extra Condensed

- Shader: https://www.shadertoy.com/view/Xl3cDn

- Claude used in this project for: planing the project, tutoring in code writting and debugging, 3d models generating + Code Caude for correcting/formatting code


