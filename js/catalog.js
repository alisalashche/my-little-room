// every card in the panel
// on: where it may stand -> floor, wall, top (any surface facing up), bed (only on the bed)
// models: object names inside room.glb
// top: height of the surface other items can stand on
export const items = [
  // furniture
  { id: 'bed-frame', label: 'Bed frame', group: 'furniture', on: 'floor', models: ['Bed'], top: 0.52 },
  { id: 'desk', label: 'Desk', group: 'furniture', on: 'floor', models: ['Desk'], top: 0.775 },
  { id: 'night-stand', label: 'Night stand', group: 'furniture', on: 'floor', models: ['Nightstand_TV'], max: 2, top: 0.56 },
  { id: 'shelf', label: 'Shelf', group: 'furniture', on: 'wall', models: ['Wall_Shelf'] },
  { id: 'chair', label: 'Chair', group: 'furniture', on: 'floor', models: ['Chair'] },
  { id: 'tv', label: 'TV', group: 'furniture', on: 'top', models: ['TV'], top: 0.462 },

  // big decor
  // the rug changes model: flat on the floor, hanging on a wall
  { id: 'persian-rug', label: 'Persian rug', group: 'big', on: 'floor wall', models: ['Rug_Floor'], wallModels: ['Rug_Wall'], max: 2, thumb: 'persian-rug-wall' },
  { id: 'beddings', label: 'Beddings', group: 'big', on: 'bed', models: ['Blanket', 'Pillow'] },
  { id: 'doll-house', label: 'Doll house', group: 'big', on: 'top', models: ['Dollhouse'] },
  { id: 'plushie', label: 'Plushie', group: 'big', on: 'top', models: ['Star_Plush'] },
  { id: 'toys-basket', label: 'Toys basket', group: 'big', on: 'floor', models: ['Frog_Basket'] },
  { id: 'hula-hoop', label: 'Hula hoop', group: 'big', on: 'floor', models: ['Hula_Hoop'] },
  { id: 'lace-doily-1', label: 'Lace doily 1', group: 'big', on: 'top', models: ['Lace_Doily'] },
  { id: 'lace-doily-2', label: 'Lace doily 2', group: 'big', on: 'top', models: ['Lace_Runner'] },

  // small decor
  { id: 'books', label: 'Books', group: 'small', on: 'top', models: ['Books_Row'] },
  { id: 'books-stack', label: 'Books stack', group: 'small', on: 'top', models: ['Book_Stack'] },
  { id: 'textbooks', label: 'Textbooks', group: 'small', on: 'top', models: ['Books_Lying'] },
  { id: 'notebook', label: 'Notebook', group: 'small', on: 'top', models: ['Notebook'] },
  { id: 'nightlight', label: 'Nightlight', group: 'small', on: 'top', models: ['Aquarium_Lamp'] },
  { id: 'drawings', label: 'Drawings', group: 'small', on: 'top', models: ['Drawing'] },
  { id: 'crayons', label: 'Crayons', group: 'small', on: 'top', models: ['Pencil_Cup'] },
  { id: 'ficus', label: 'Ficus', group: 'small', on: 'top', models: ['Plant'] },
  { id: 'syngonium', label: 'Syngonium', group: 'small', on: 'top', models: ['Plant_Trailing'] },
];

// beddings sit on the bed exactly like in the style guide (offsets from the bed origin)
export const bedOffsets = {
  Blanket: [0.029, 0.52, 0.315],
  Pillow: [0, 0.555, 0.675],
};

// basics: materials inside room.glb and the options for each
// color multiplies with the texture, swatch is only the colour of the button
export const basics = [
  {
    id: 'walls',
    label: 'Walls',
    materials: ['Wall_Paint'],
    options: [
      { label: 'White', color: '#f4efe6' },
      { label: 'Wallpaper', color: '#ffffff', texture: 'textures/wallpaper.jpg', repeat: 0.6 },
      { label: 'Butter', color: '#f6e7b4' },
      { label: 'Sage', color: '#b9b892' },
    ],
  },
  {
    id: 'linoleum',
    label: 'Linoleum',
    materials: ['Linoleum'],
    // other colours tint a grey copy of the linoleum texture
    options: [
      { label: 'Terracotta', color: '#ffffff', swatch: '#b5543a' },
      { label: 'Brown', color: '#8a5a44', texture: 'textures/linoleum-grey.jpg' },
      { label: 'Blue', color: '#7f97b8', texture: 'textures/linoleum-grey.jpg' },
      { label: 'Green', color: '#93a873', texture: 'textures/linoleum-grey.jpg' },
    ],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    materials: ['Honey_Oak', 'Oak_Shadow'],
    options: [
      { label: 'Honey oak', color: '#ffffff', swatch: '#c98a4b' },
      { label: 'Birch', color: '#fff3e2', swatch: '#e2c7a0' },
      { label: 'Walnut', color: '#8a6450', swatch: '#7a4a2e' },
      { label: 'Painted white', color: '#ffffff', paint: '#efe9df' },
    ],
  },
];
