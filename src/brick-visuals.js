(function () {
'use strict';
const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { PORTALS, FOODS, ITEMS, OBJECTS, WEAPONS, CHARACTERS, HAZARDS, hazardEnabled, obstructionGeometry, obstructionSpikes, obstructionVertices, brickShape, brickRegions, brickEnabled, goalTiles } = engine;
const HAZARD_FLAME = 'M-24 18 Q-12 12 -20 -2 L-10 -18 Q-13 -2 -4 -8 L3 -17 Q12 -4 9 2 Q18 -10 24 -20 Q16 3 24 18 Z';
const MISSILE_BODY = 'M-14 -7 H9 Q24 -7 24 0 Q24 7 9 7 H-14 Z';
const MISSILE_FINS = 'M-15 -6 L-25 -16 L-5 -10 V-6 M-15 6 L-25 16 L-5 10 V6 M-22 0 H-4';
const FLAME = 'M0 20 C-24 16 -22 -6 -10 -12 Q-8 -2 -3 -5 Q7 -14 3 -24 C26 -7 26 16 0 20 Z';
const FENCE = 'M-22 -6 H22 M-22 6 H22 M-18 -14 V14 M-6 -14 V14 M6 -14 V14 M18 -14 V14';
const BOOM_TIME_TYPES = new Set(['boom-time-red', 'boom-time-green', 'boom-time-blue']);
const TURRET_USED_COLOR = '#8a9399';
const SAW_TEETH = Array.from({ length: 12 }, (_, i) => {
  const angle = i * Math.PI / 6, step = Math.PI / 6;
  const point = (offset, radius) => [Math.cos(angle + offset * step) * radius, Math.sin(angle + offset * step) * radius];
  return { root: point(0, 1), control: point(.2, 1.05), tip: point(.78, 1.34), end: point(1, 1) };
});
const SAW_BLADE = `M23 0 ${SAW_TEETH.map(({ control, tip, end }) =>
  `Q${control.map(n => n * 23).join(' ')} ${tip.map(n => n * 23).join(' ')} L${end.map(n => n * 23).join(' ')}`).join(' ')} Z`;
function traceSawBlade(ctx, radius, growth = 1) {
  ctx.beginPath(); ctx.moveTo(radius, 0);
  for (const { root, control, tip, end } of SAW_TEETH) {
    ctx.quadraticCurveTo(...control.map((n, i) => (root[i] + (n - root[i]) * growth) * radius),
      ...tip.map((n, i) => (end[i] + (n - end[i]) * growth) * radius));
    ctx.lineTo(...end.map(n => n * radius));
  }
  ctx.closePath();
}
const SYMBOLS = {
  'item-case': 'M-25 -25 H25 V25 H-25 Z M-19 -13 L-10 -22 M-19 -3 L0 -22 M-7 0 L0 -7 L7 0 L0 7 Z',
  'obstruction-circle': 'M20 0 A20 20 0 1 1 -20 0 A20 20 0 1 1 20 0 Z',
  'obstruction-diamond': 'M0 -23 L23 0 L0 23 L-23 0 Z',
  'obstruction-rectangle': 'M-22 -5.5 H22 V5.5 H-22 Z',
  'obstruction-pentagon': 'M0 -25 L24 -8 L15 20 H-15 L-24 -8 Z',
  'obstruction-hexagon': 'M-22 -13 L0 -26 L22 -13 V13 L0 26 L-22 13 Z',
  'obstruction-octagon': 'M-12 -26 H12 L26 -12 V12 L12 26 H-12 L-26 12 V-12 Z',
  'obstruction-v': 'M-26 -20 H-12 L0 5 L12 -20 H26 L8 24 H-8 Z',
  'obstruction-oval': 'M26 0 A26 18 0 1 1 -26 0 A26 18 0 1 1 26 0 Z',
  'soccer-ball': 'M20 0 A20 20 0 1 1 -20 0 A20 20 0 1 1 20 0 M0 -8 L8 -2 L5 7 H-5 L-8 -2 Z M0 -8 V-20 M8 -2 L19 -6 M5 7 L12 16 M-5 7 L-12 16 M-8 -2 L-19 -6',
  'bumper-red': 'M20 0 A20 20 0 1 1 -20 0 A20 20 0 1 1 20 0 M14 0 A14 14 0 1 1 -14 0 A14 14 0 1 1 14 0 M8 0 A8 8 0 1 1 -8 0 A8 8 0 1 1 8 0 M2 0 A2 2 0 1 1 -2 0 A2 2 0 1 1 2 0',
  'bumper-green': 'M20 0 A20 20 0 1 1 -20 0 A20 20 0 1 1 20 0 M14 0 A14 14 0 1 1 -14 0 A14 14 0 1 1 14 0 M8 0 A8 8 0 1 1 -8 0 A8 8 0 1 1 8 0 M2 0 A2 2 0 1 1 -2 0 A2 2 0 1 1 2 0',
  'bumper-blue': 'M20 0 A20 20 0 1 1 -20 0 A20 20 0 1 1 20 0 M14 0 A14 14 0 1 1 -14 0 A14 14 0 1 1 14 0 M8 0 A8 8 0 1 1 -8 0 A8 8 0 1 1 8 0 M2 0 A2 2 0 1 1 -2 0 A2 2 0 1 1 2 0',
  heart: 'M0 16 C-32 -4 -12 -26 0 -12 C12 -26 32 -4 0 16 Z',
  mouse: 'M-12 -10 A7 7 0 1 1 -19 -17 M12 -10 A7 7 0 1 0 19 -17 M16 0 A16 16 0 1 1 -16 0 A16 16 0 1 1 16 0 M-10 -2 H-3 M3 -2 H10 M-6 9 L0 5 L6 9',
  wheel: 'M19 0 A19 19 0 1 1 -19 0 A19 19 0 1 1 19 0 M12 0 A12 12 0 1 1 -12 0 A12 12 0 1 1 12 0 M-10 -2 H-3 M3 -2 H10 M0 -19 V-23 M19 0 H23 M0 19 V23 M-19 0 H-23',
  ram: 'M-12 -7 C-18 -24 -34 -22 -31 -9 C-30 -2 -23 -1 -23 -7 C-23 -13 -17 -14 -15 -7 M12 -7 C18 -24 34 -22 31 -9 C30 -2 23 -1 23 -7 C23 -13 17 -14 15 -7 M-15 -4 A15 15 0 1 1 15 -4 A15 15 0 1 1 -15 -4 M-9 -5 H-4 M4 -5 H9 M-7 6 H7 L4 11 L0 8 L-4 11 Z',
  bucket: 'M-17 -5 H17 L14 16 Q0 20 -14 16 Z M-19 -6 H19 M-13 -6 C-13 -27 13 -27 13 -6 M-10 5 A4 4 0 1 1 -10 4 M10 5 A4 4 0 1 1 10 4 M-3 13 Q0 9 3 13',
  ball: 'M19 0 A19 19 0 1 1 -19 0 A19 19 0 1 1 19 0 M0 -19 V19 M-19 0 H19 M-15 -19 C5 -9 5 9 -15 19 M15 -19 C-5 -9 -5 9 15 19 M-7 -9 A3 3 0 1 1 -7 -3 A3 3 0 1 1 -7 -9 M7 -9 A3 3 0 1 1 7 -3 A3 3 0 1 1 7 -9 M-10 5 H10 V14 H-10 Z M-6 5 V14 M-2 5 V14 M2 5 V14 M6 5 V14',
  snake: 'M-25 5 A7 7 0 1 1 -11 5 A7 7 0 1 1 -25 5 M-16 -2 V12 M-12 5 H-20 M-13 5 C-9 -3 -1 -3 3 5 M-5 -3 A8 8 0 1 1 -5 13 A8 8 0 1 1 -5 -3 M3 5 C7 -3 14 -5 19 -3 M11 -4 A9 9 0 1 1 11 14 A9 9 0 1 1 11 -4 M15 -3 H18 M15 1 H18 M19 -1 L24 -4 M19 3 L24 6',
  jackolantern: 'M0 -18 V-25 M3 -25 A3 3 0 1 1 -3 -25 A3 3 0 1 1 3 -25 M0 -17 C-28 -26 -28 23 0 19 C28 23 28 -26 0 -17 Z M-10 -15 C-18 -4 -18 10 -10 17 M10 -15 C18 -4 18 10 10 17 M-15 -7 H-4 V0 H-15 Z M4 -7 H15 V0 H4 Z M0 0 L-4 6 H4 Z M-14 8 L-8 10 L-5 7 L0 11 L5 7 L8 10 L14 8 L9 16 L4 13 L0 17 L-4 13 L-9 16 Z',
  goalie: 'M0 -22 C20 -22 26 28 0 28 C-26 28 -20 -22 0 -22 Z M-6 -22 L-11 -31 M0 -22 V-33 M6 -22 L11 -31 M-9 -9 A2 2 0 1 0 -9 -8 M9 -9 A2 2 0 1 0 9 -8 M-3 -8 C-4 0 -9 9 -3 11 C9 14 6 2 3 -8 M-19 0 H-7 M7 0 H19 M-12 3 V21 M-4 14 V26 M4 14 V26 M12 3 V21 M8 7 A4 4 0 1 0 16 7 A4 4 0 1 0 8 7 M-15 8 L-10 3 L-6 8 Z',
  'robo-koshi': 'M-7 -13 L-22 -30 L-19 -5 M7 -13 L22 -30 L19 -5 M0 -22 V-33 M0 -34 A3 3 0 1 1 0 -28 M0 -22 A22 22 0 1 1 0 22 A22 22 0 1 1 0 -22 M-14 -7 H-7 V1 H-14 Z M7 -7 H14 V1 H7 Z M-5 5 L0 9 L5 5 M-7 12 H7',
  'robo-snail': 'M-5 -14 L4 -25 H20 L29 -14 V9 L18 22 H4 L-5 10 Z M0 10 V-8 L6 -16 H15 L23 -8 V5 L15 15 H7 L3 11 M7 15 L16 2 V-4 L12 -7 L8 -4 V1 L11 4 M-27 23 V5 Q-27 -4 -18 -4 Q-8 -4 -8 5 V22 H18 M-23 -4 V-16 M-13 -4 V-16 M-28 -18 A5 2 0 1 0 -18 -18 A5 2 0 1 0 -28 -18 M-18 -18 A5 2 0 1 0 -8 -18 A5 2 0 1 0 -18 -18 M-22 12 V9 C-22 0 -13 0 -13 9 V12 Z M-22 8 H-13 M-19 8 V12 M-16 8 V12',
  'robo-trash-bin': 'M-21 -20 H21 V-14 H-21 Z M-18 -14 L-15 20 Q0 25 15 20 L18 -14 Z M-11 -7 H-3 V-1 H-11 Z M3 -7 H11 V-1 H3 Z M-7 11 Q0 4 7 11 M-18 17 A5 5 0 1 0 -12 23 M18 17 A5 5 0 1 1 12 23',
  'robo-cow': 'M-20 -7 L-29 -19 L-15 -17 L-7 -21 H13 L22 -15 L29 -23 L28 -8 Q32 1 23 9 L21 17 H13 L10 8 H-8 L-12 18 H-20 L-19 7 Q-29 1 -20 -7 M-12 -3 H-5 V2 H-12 Z M7 -3 H14 V2 H7 Z M-2 5 Q2 9 6 5',
  'robo-crab': 'M-23 4 Q-23 -7 -12 -7 H12 Q23 -7 23 4 V8 Q23 19 12 19 H-12 Q-23 19 -23 8 Z M-23 2 H-35 V-24 H-29 M23 2 H35 V-24 H29 M-16 13 L-31 16 L-24 26 M16 13 L31 16 L24 26 M-10 -7 V-19 M10 -7 V-19 M-18 -23 H-2 V-15 H-18 Z M2 -23 H18 V-15 H2 Z M-13 12 V7 H13 V12 M-36 -24 L-37 -38 L-22 -38 L-30 -28 L-23 -31 V-24 Z M36 -24 L37 -38 L22 -38 L30 -28 L23 -31 V-24 Z',
  'robo-love-bug': 'M0 -9 C-30 -13 -30 25 0 25 C30 25 30 -13 0 -9 Z M0 -9 V25 M-22 -7 C-22 -31 22 -31 22 -7 Z M-10 -22 L-18 -33 M10 -22 L18 -33 M-21 -35 A3 3 0 1 1 -15 -35 A3 3 0 1 1 -21 -35 M15 -35 A3 3 0 1 1 21 -35 A3 3 0 1 1 15 -35 M-18 -4 L-27 -9 M-20 6 H-28 M-18 17 L-26 23 M18 -4 L27 -9 M20 6 H28 M18 17 L26 23 M-12 -19 H-5 V-12 H-12 Z M5 -19 H12 V-12 H5 Z M0 19 C-31 2 -13 -9 0 2 C13 -9 31 2 0 19 Z',
  boss: 'M-23 20 V-7 Q-23 -23 -7 -23 H7 Q23 -23 23 -7 V20 Z M-17 -10 H-5 V-3 H-17 Z M5 -10 H17 V-3 H5 Z M-15 10 H15 M24 -6 V15 M22 5 H28 V10 H22 M-15 -19 H15',
  'robo-unicorn': 'M-20 27 C-3 15 -12 4 -17 -7 C-27 -26 -8 -31 8 -21 C16 -16 15 -7 24 1 C35 10 25 21 17 15 C11 9 8 8 4 12 C2 20 -8 27 -20 27 Z M-9 -18 Q-18 -23 -10 -36 Q1 -28 -1 -20 Z M5 -21 L24 -40 L13 -16 Z M1 -14 Q7 -19 12 -12 Q7 -6 2 -9 Z M18 10 H27 V15 H18 Z',
  'bubble-blue': 'M0 -22 A22 22 0 1 1 0 22 A22 22 0 1 1 0 -22 M-11 -15 Q-19 -8 -16 0 M-5 -18 L-2 -17',
  'bubble-green': 'M0 -22 A22 22 0 1 1 0 22 A22 22 0 1 1 0 -22 M-11 -15 Q-19 -8 -16 0 M-5 -18 L-2 -17',
  'bubble-red': 'M0 -22 A22 22 0 1 1 0 22 A22 22 0 1 1 0 -22 M-11 -15 Q-19 -8 -16 0 M-5 -18 L-2 -17',
  sword: 'M0 -23 L6 -14 L4 8 H-4 L-6 -14 Z M-10 9 H10 M0 9 V22',
  hammer: 'M-13 -19 H13 L17 -15 V-4 L13 0 H5 L3 3 H-3 L-5 0 H-13 L-17 -4 V-15 Z M0 -3 V27',
  axe: 'M-8 -25 Q-30 -10 -8 5 Q-15 -4 -8 -5 H8 Q15 -4 8 5 Q30 -10 8 -25 Q15 -16 8 -15 H-8 Q-15 -16 -8 -25 Z M0 -21 V27',
  'rope-dart': 'M0 -27 L11 -4 L8 14 L0 19 L-8 14 L-11 -4 Z M0 -27 V19 M-16 -9 C-30 -9 -30 25 -16 25 C-2 25 -2 -9 -16 -9 M-16 -5 C-25 -5 -25 21 -16 21 C-7 21 -7 -5 -16 -5 M-16 25 Q-4 30 0 21',
  S: 'M-14 -8 Q-18 7 0 19 Q18 7 14 -8 Z M-14 -8 L-4 -6 L0 -16 L4 -6 L14 -8 M-6 0 L-5 3 M5 4 L4 7',
  P: 'M0 -2 C-20 -32 -30 10 -10 12 C8 16 24 -8 12 -14 C0 -26 -14 6 0 14 C22 26 26 -8 6 -6 M-14 10 L14 -10',
  B: 'M-18 -14 Q-12 22 18 12 L20 4 Q-6 12 -12 -16 Z',
  C: 'M-18 14 V-8 L18 -18 V14 Z M-18 -8 H18 M-9 2 A3 3 0 1 0 -3 2 A3 3 0 1 0 -9 2 M7 6 A3 3 0 1 0 13 6 A3 3 0 1 0 7 6',
  L: 'M-5 4 C-30 0 -10 -28 8 -16 C26 -6 10 14 -5 4 L-12 15 Q-24 12 -18 22 Q-8 27 -7 19 Z',
  F: 'M-16 0 Q0 -20 16 0 Q0 20 -16 0 L-24 -10 V10 Z M8 -1 L8 1',
  H: 'M-20 -2 Q-18 -22 0 -22 Q18 -22 20 -2 Z M-20 4 H20 M-20 10 H20 M-18 16 H18',
  'smiley-cookie': 'M0 -21 A21 21 0 1 1 0 21 A21 21 0 1 1 0 -21 M-8 -5 A2 2 0 1 0 -8 -4 M8 -5 A2 2 0 1 0 8 -4 M-10 5 Q0 16 10 5',
  stopwatch: 'M-5 -25 H5 V-19 H-5 Z M-20 -18 H-13 L-9 -14 M20 -18 H13 L9 -14 M0 -20 A20 20 0 1 1 0 20 A20 20 0 1 1 0 -20 M0 -12 V0 L8 5',
  battery: 'M-12 -20 H12 V-16 H16 V17 H-16 V-16 H-12 Z M-7 -8 L0 -1 L-5 5 L7 -5 L1 -6 L5 -12',
  anvil: 'M-26 -13 L-10 -18 H22 V-3 H11 Q5 5 14 12 L20 14 V20 H-17 V14 L-12 12 Q-2 5 -7 -3 H-10 Q-22 -4 -26 -13 Z M-26 -13 L-10 -10 L22 -13 M-14 15 H14 M12 -16 H16',
  'boom-time': 'M-5 -16 H5 L8 -14 Q20 -16 21 -3 A21 21 0 1 1 -21 -3 Q-20 -16 -8 -14 Z',
  'music-box': 'M-20 -8 H12 L20 -13 V13 L12 18 H-20 Z M-16 -12 H15 V-8 H-16 Z M12 -8 L20 -13 V-10 L12 -5 Z M20 1 H25 M25 -2 A3 3 0 1 1 25 4 M-2 -3 V9 M-2 -3 L7 -6 V5 M-2 2 A5 5 0 1 1 -2 3',
  'cat-block': 'M-17 -12 L-12 -22 L-3 -17 H3 L12 -22 L17 -12 Q22 -7 20 12 Q0 25 -20 12 Q-22 -7 -17 -12 Z M-10 -2 A2 2 0 1 0 -10 -1 M10 -2 A2 2 0 1 0 10 -1 M-7 8 Q0 14 7 8 M-20 -2 L-27 -5 M20 -2 L27 -5 M-10 -23 V-29 H10 V-23 M-8 -29 V-23 M8 -29 V-23',
  'cat-shield': 'M-25 -34 L-14 -20 Q-9 -17 -6 -17 L0 -29 L6 -17 Q9 -17 14 -20 L25 -34 L25 13 Q24 30 8 32 Q2 34 0 42 Q-2 34 -8 32 Q-24 30 -25 13 Z M-12 -5 L-8 -10 L-3 -5 M12 -5 L8 -10 L3 -5 M-3 2 L3 2 L0 5 Z M0 5 V11 M0 11 Q-7 19 -12 12 M0 11 Q7 19 12 12 M-11 2 L-21 -3 M-16 8 H-23 M-15 14 L-21 19 M11 2 L21 -3 M16 8 H23 M15 14 L21 19',
  key: 'M-4 -5 A10 10 0 1 1 4 -5 A10 10 0 1 1 -4 -5 M0 4 V23 M0 14 H8 V20 H0 M0 21 H7',
  'treasure-chest': 'M-21 -10 Q-21 -20 -10 -20 H10 Q21 -20 21 -10 V17 H-21 Z M-21 -5 H21 M-4 -5 V7 H4 V-5 M-15 -16 V-12 M15 -16 V-12',
  eggplant: 'M-8 -14 C4 -27 25 -11 18 5 C12 20 -6 22 -17 10 C-28 -3 -17 -19 -7 -16 L-14 -24 L-4 -21 L0 -28 L4 -19 L15 -22 L8 -14',
  'saw-blade': `${SAW_BLADE} M7 0 A7 7 0 1 1 -7 0 A7 7 0 1 1 7 0`,
  'magic-sunglasses': 'M-23 -7 H-4 V2 Q-13 14 -22 2 Z M4 -7 H23 L22 2 Q13 14 4 2 Z M-4 -3 Q0 -7 4 -3 M-23 -7 L-27 -11 M23 -7 L27 -11',
  'kitty-cape': 'M-10 -18 Q0 -12 10 -18 L23 20 Q10 15 0 22 Q-10 15 -23 20 Z M-10 -18 Q0 -28 10 -18 M-6 -10 L-13 12 M6 -10 L13 12',
  'ditto-stamp': 'M-20 16 H20 V23 H-20 Z M-20 3 H20 Q22 3 22 5 V14 Q22 16 20 16 H-20 Q-22 16 -22 14 V5 Q-22 3 -20 3 Z M-5 -8 C-18 -12 -15 -28 0 -28 C15 -28 18 -12 5 -8 L8 3 Q0 6 -8 3 Z M-18 9 C-7 5 3 13 18 8 M-15 13 C-6 10 5 15 14 12',
  'paint-pencil': 'M-3 23 H3 L4 -9 H-4 Z M-4 -9 H4 V-15 H-4 Z M-4 -15 Q0 -20 0 -25 Q5 -21 4 -15 Z',
  'paint-wide': 'M-4 23 H4 V0 H-4 Z M-14 0 H14 V-8 H-14 Z M-14 -8 V-25 L14 -15 V-8 Z M-14 -20 L14 -10 M-9 -17 V-9 M-3 -15 V-9 M3 -13 V-9 M9 -11 V-9 M-14 -25 Q-19 -21 -17 -17 Q-14 -15 -12 -20',
  'paint-roller': 'M-18 -20 H18 V-7 H-18 Z M18 -14 H22 V0 H0 V8 M-4 8 H4 V25 H-4 Z M-10 -7 Q-14 2 -10 4 Q-6 2 -10 -7 M10 -7 Q6 3 10 5 Q14 3 10 -7',
  'spooky-mask': 'M-16 -12 Q-26 -25 -20 -30 L-7 -17 M16 -12 Q26 -25 20 -30 L7 -17 M-16 -8 L-24 -12 Q-25 0 -19 4 Z M16 -8 L24 -12 Q25 0 19 4 Z M-17 -10 Q-23 -5 -20 4 Q-14 23 0 25 Q14 23 20 4 Q23 -5 17 -10 Q0 -25 -17 -10 Z M-15 -8 L-3 -3 L-13 0 Z M15 -8 L3 -3 L13 0 Z M0 -3 L-4 7 L4 7 Z M-13 9 L-9 17 L-5 10 L0 19 L5 10 L9 17 L13 9 Z',
};

function spawnSymbol(spawn) {
  return SYMBOLS[spawn.kind === 'weapon' ? WEAPONS[spawn.type].ropeDart ? 'rope-dart' : WEAPONS[spawn.type].axe ? 'axe' : WEAPONS[spawn.type].hammer ? 'hammer' : 'sword' : spawn.kind === 'heart' ? 'heart'
    : spawn.kind === 'item' && BOOM_TIME_TYPES.has(spawn.type) ? 'boom-time'
      : spawn.kind === 'item' && ITEMS[spawn.type]?.seconds ? 'stopwatch'
        : spawn.kind === 'item' && ITEMS[spawn.type]?.brush ? `paint-${ITEMS[spawn.type].brush}`
          : spawn.kind === 'item' && ITEMS[spawn.type]?.catShield ? 'cat-shield' : spawn.type];
}

function drawPaintbrush(ctx, item) {
  ctx.save();
  ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  const box = (x, y, w, h, color, radius = 1) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); ctx.stroke();
  };
  const drip = (x, y, length) => {
    ctx.fillStyle = item.color; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 4, y + length, x, y + length);
    ctx.quadraticCurveTo(x + 4, y + length, x, y);
    ctx.fill(); ctx.stroke();
  };
  if (item.brush === 'pencil') {
    box(-3, -9, 6, 32, '#bb884c');
    box(-4, -15, 8, 7, '#c4cdd5');
    ctx.fillStyle = item.color; ctx.beginPath(); ctx.moveTo(-4, -15);
    ctx.quadraticCurveTo(0, -20, 0, -25); ctx.quadraticCurveTo(5, -21, 4, -15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (item.brush === 'wide') {
    box(-4, -1, 8, 24, '#bb884c', 3);
    ctx.fillStyle = '#e1c894'; ctx.beginPath();
    ctx.moveTo(-14, -8); ctx.lineTo(-14, -25); ctx.lineTo(14, -15); ctx.lineTo(14, -8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#9d804e'; ctx.lineWidth = 1;
    for (const x of [-9, -3, 3, 9]) {
      ctx.beginPath(); ctx.moveTo(x, -19 + (x + 14) * 10 / 28); ctx.lineTo(x, -9); ctx.stroke();
    }
    ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.5;
    ctx.fillStyle = item.color; ctx.beginPath();
    ctx.moveTo(-14, -25); ctx.lineTo(14, -15); ctx.lineTo(14, -10); ctx.lineTo(-14, -20);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, -25);
    ctx.quadraticCurveTo(-19, -21, -17, -17);
    ctx.quadraticCurveTo(-14, -15, -12, -20);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    box(-14, -8, 28, 8, '#c4cdd5');
  } else if (item.brush === 'roller') {
    ctx.strokeStyle = '#c4cdd5'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(16, -14); ctx.lineTo(22, -14);
    ctx.lineTo(22, 0); ctx.lineTo(0, 0); ctx.lineTo(0, 9); ctx.stroke();
    ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.5;
    box(-4, 8, 8, 17, '#bb884c', 3);
    box(-18, -20, 36, 13, item.color, 4);
    drip(-10, -7, 11); drip(10, -7, 12);
    ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-13, -17); ctx.lineTo(13, -17); ctx.stroke();
  }
  ctx.restore();
}
function spawnColor(spawn) {
  if (spawn.kind === 'weapon') return WEAPONS[spawn.type].color;
  if (spawn.kind === 'heart') return '#e47990';
  if (spawn.kind === 'enemy') return spawn.type === 'robo-koshi' ? '#454d52' : ['ball', 'jackolantern'].includes(spawn.type) ? '#ed852e'
    : spawn.type === 'robo-snail' ? '#76b85a' : spawn.type === 'robo-trash-bin' ? '#008459' : spawn.type === 'robo-cow' ? '#9451bd' : spawn.type === 'robo-crab' ? '#929ba1'
      : spawn.type === 'robo-love-bug' ? '#f29ac2' : spawn.type === 'robo-unicorn' ? '#ef9dca' : spawn.type === 'goalie' ? '#27a6b0' : spawn.type === 'snake' ? '#bbc5ca' : spawn.type === 'bucket' ? '#c9bd76' : '#a3b3c2';
  if (spawn.kind === 'item') return ITEMS[spawn.type].color;
  if (spawn.kind === 'object') return spawn.color ?? OBJECTS[spawn.type].color;
  return { S: '#db5560', P: '#bd8749', B: '#e6c654', C: '#e8b84e', L: '#c9966c', F: '#73b9cf', H: '#ca9a53' }[spawn.type];
}
function specialLabel(brick) {
  const spawn = brick.spawner;
  const spawnName = spawn?.kind === 'food' ? FOODS[spawn.type].name
    : spawn?.kind === 'weapon' ? WEAPONS[spawn.type].name
      : spawn?.kind === 'item' ? ITEMS[spawn.type].name
        : spawn?.kind === 'object' ? OBJECTS[spawn.type].name
        : spawn?.kind === 'enemy' ? CHARACTERS[spawn.type]
        : spawn?.type;
  const hazard = brick.hazard ? `, Hazard: ${HAZARDS[brick.hazard.type].name}${brick.hazard.power ? `, active with ${brick.hazard.power} power` : ', always operating'}${HAZARDS[brick.hazard.type].interval ? `, shoots every ${brick.hazard.interval ?? HAZARDS[brick.hazard.type].interval}s` : ''}` : '';
  return `${brick.power ? `, Power: ${brick.powerOn ? 'on' : 'off'}` : ''}${brick.portal ? `, ${brick.portal} portal: paired teleport` : ''}${brick.toggle ? `, Toggle: ${brick.toggle} clicks, ${brick.toggleRemaining} more until enabled` : ''}${spawn ? `, Spawning: ${spawnName}${brick.spawned ? ', already used' : ', once on contact'}` : ''}${brick.boost ? ', Boost: double-speed fiery launch from rest' : ''}${brick.barrier ? ', Barrier: selection extends or retracts an enemy and bomb fence' : ''}${brick.turret ? `, ${brick.turret} turret` : ''}${hazard}`;
}
function svgNode(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}
// Power-linked hazard frame: beveled bars between quarter-circle corner plates.
function hazardBorder(members, shape, color) {
  const outline = shape.corners?.length ? shape : brickShape(members);
  const sections = members.some(part => part.sourceId !== undefined) ? members.filter(part => part.sourceId !== undefined) : members;
  const thin = Math.min(...sections.map(part => Math.min(part.w, part.h)));
  const band = Math.min(5.5, thin * .18), radius = Math.min(12, thin * .4);
  const reach = Math.sqrt(radius ** 2 - band ** 2);
  const point = ([px, py]) => `${+px.toFixed(3)} ${+py.toFixed(3)}`;
  const unit = (a, b) => { const length = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / length, (b[1] - a[1]) / length]; };
  const along = (p, d, distance, n = [0, 0], inset = 0) => [p[0] + d[0] * distance + n[0] * inset, p[1] + d[1] * distance + n[1] * inset];
  let bandPath = '', plates = '', sheen = '', light = '', dark = '';
  const bevel = (normal, d) => { if (normal[0] + normal[1] < 0) light += d; else dark += d; };
  for (const loop of outline.corners) {
    const count = loop.length;
    const edges = loop.map((p, i) => {
      const d = unit(p, loop[(i + 1) % count]);
      return { p, q: loop[(i + 1) % count], d, n: [-d[1], d[0]] };
    });
    // Outlines wind with the solid on the right, so cross > 0 marks a convex corner.
    const convex = edges.map((edge, i) => {
      const previous = edges[(i + count - 1) % count];
      return previous.d[0] * edge.d[1] - previous.d[1] * edge.d[0] > 0;
    });
    const inner = edges.map((edge, i) => {
      const previous = edges[(i + count - 1) % count];
      return [edge.p[0] + band * (previous.n[0] + edge.n[0]), edge.p[1] + band * (previous.n[1] + edge.n[1])];
    });
    bandPath += `M${loop.map(point).join('L')}ZM${inner.map(point).join('L')}Z`;
    edges.forEach((edge, i) => {
      const length = Math.hypot(edge.q[0] - edge.p[0], edge.q[1] - edge.p[1]);
      const start = convex[i] ? reach : band, end = length - (convex[(i + 1) % count] ? reach : band);
      if (end > start) {
        bevel(edge.n, `M${point(along(edge.p, edge.d, start, edge.n, band - .8))}L${point(along(edge.p, edge.d, end, edge.n, band - .8))}`);
        sheen += `M${point(along(edge.p, edge.d, start, edge.n, band / 2))}L${point(along(edge.p, edge.d, end, edge.n, band / 2))}`;
      }
      bevel([-edge.n[0], -edge.n[1]], `M${point(along(edge.p, edge.d, 0, edge.n, .8))}L${point(along(edge.p, edge.d, length, edge.n, .8))}`);
      if (!convex[i]) return;
      const previous = edges[(i + count - 1) % count], p = edge.p;
      const back = [-previous.d[0], -previous.d[1]], middle = unit([0, 0], [back[0] + edge.d[0], back[1] + edge.d[1]]);
      plates += `M${point(p)}L${point(along(p, back, radius))}A${radius} ${radius} 0 0 0 ${point(along(p, edge.d, radius))}Z`;
      const r = radius - .8;
      for (const [from, to] of [[back, middle], [middle, edge.d]]) {
        bevel(unit([0, 0], [from[0] + to[0], from[1] + to[1]]), `M${point(along(p, from, r))}A${r} ${r} 0 0 0 ${point(along(p, to, r))}`);
      }
      sheen += `M${point(along(p, back, radius * .55))}A${radius * .55} ${radius * .55} 0 0 0 ${point(along(p, edge.d, radius * .55))}`;
    });
  }
  const border = svgNode('svg', { class: 'brick-hazard-border', viewBox: `0 0 ${outline.w} ${outline.h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  border.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  border.style.clipPath = shape.roundedClipPath;
  const outlineStroke = { stroke: '#17212a', 'stroke-width': .9, 'stroke-linejoin': 'round' };
  border.append(
    svgNode('path', { class: 'hazard-border-shadow', d: bandPath, transform: 'translate(0 1.2)', 'fill-rule': 'evenodd', fill: '#000000', opacity: .4 }),
    svgNode('path', { class: 'hazard-border-shadow', d: plates, transform: 'translate(0 1.2)', fill: '#000000', opacity: .4 }),
    svgNode('path', { class: 'hazard-border-band', d: bandPath, 'fill-rule': 'evenodd', fill: color, ...outlineStroke }),
    svgNode('path', { class: 'hazard-border-plates', d: plates, fill: color, ...outlineStroke }),
    svgNode('path', { class: 'hazard-border-sheen', d: sheen, fill: 'none', stroke: '#ffffff', 'stroke-width': band * .3, 'stroke-linecap': 'round', opacity: .16 }),
    svgNode('path', { class: 'hazard-border-light', d: light, fill: 'none', stroke: '#ffffff', 'stroke-width': .9, opacity: .45 }),
    svgNode('path', { class: 'hazard-border-dark', d: dark, fill: 'none', stroke: '#000000', 'stroke-width': 1.1, opacity: .4 }));
  return border;
}
function brickInfoBounds(brick, members) {
  const shape = brickShape(members);
  const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
  const centered = { x: cx - brick.w / 2, y: cy - brick.h / 2, w: brick.w, h: brick.h };
  const cuts = [...new Set([centered.x, centered.x + centered.w,
    ...members.flatMap(part => [part.x, part.x + part.w])
      .filter(x => x > centered.x && x < centered.x + centered.w)])].sort((a, b) => a - b);
  const covered = cuts.slice(1).every((right, index) => {
    const left = cuts[index];
    const spans = members.filter(part => part.x <= left && part.x + part.w >= right)
      .map(part => [part.y, part.y + part.h]).sort((a, b) => a[0] - b[0]);
    let bottom = centered.y;
    for (const [start, end] of spans) {
      if (start > bottom + 1e-9) break;
      bottom = Math.max(bottom, end);
    }
    return bottom >= centered.y + centered.h - 1e-9;
  });
  if (covered) return centered;
  // Fit the whole panel on a real section, not a corner connector or empty arena.
  const sections = members.some(part => part.sourceId !== undefined)
    ? members.filter(part => part.sourceId !== undefined) : members;
  const anchors = sections.map(part => {
    const scale = Math.min(1, part.w / brick.w, part.h / brick.h);
    const w = brick.w * scale, h = brick.h * scale;
    const x = Math.max(part.x + w / 2, Math.min(part.x + part.w - w / 2, cx));
    const y = Math.max(part.y + h / 2, Math.min(part.y + part.h - h / 2, cy));
    return { x: x - w / 2, y: y - h / 2, w, h, scale, distance: Math.hypot(x - cx, y - cy) };
  });
  const { x, y, w, h } = anchors.reduce((best, point) => point.scale > best.scale
    || (point.scale === best.scale && point.distance < best.distance) ? point : best);
  return { x, y, w, h };
}
function decorateBrick(button, brick, members, width, height, groupCenterBrick = null, portalExit = null) {
  let cloud = null, knob = null, count = null, symbol = null, crumblerCount = null, warpCount = null, turretFill = null;
  let powerDisc = null, powerMark = null;
  const shape = brickShape(members, Boolean(brick.crumbler));
  const source = (brick.turret || brick.hazard) && groupCenterBrick && groupCenterBrick.id !== brick.id ? groupCenterBrick : null;
  const infoBounds = source ? { x: source.x, y: source.y, w: source.w, h: source.h } : brickInfoBounds(brick, members);
  const vertical = (source ?? brick).h > (source ?? brick).w;
  if (brick.kind === 'goal') {
    const net = svgNode('svg', { class: 'brick-goal', viewBox: `${shape.x} ${shape.y} ${shape.w} ${shape.h}`,
      preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    net.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    for (const part of goalTiles(members)) {
      const { frame, mesh } = goalLines(part);
      net.append(svgNode('rect', { x: part.x, y: part.y, width: part.w, height: part.h, fill: '#20392c' }));
      net.append(svgNode('path', { d: mesh, fill: 'none', stroke: '#ffffff', 'stroke-width': .8, opacity: .85 }));
      net.append(svgNode('path', { d: frame, fill: 'none', stroke: '#79878d', 'stroke-width': 4, 'stroke-linecap': 'round' }));
      net.append(svgNode('path', { d: frame, fill: 'none', stroke: '#dce4e7', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    }
    button.append(net);
  }
  if (brick.kind === 'cinder') {
    const block = svgNode('svg', { class: 'brick-cinder', viewBox: vertical ? '0 0 58 100' : '0 0 100 58', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (members.length > 1) block.style.clipPath = shape.clipPath;
    const face = svgNode('g', vertical ? { transform: 'translate(58 0) rotate(90)' } : {});
    face.append(svgNode('rect', { x: 1, y: 1, width: 98, height: 56, rx: 3, fill: '#969b99', stroke: '#404946', 'stroke-width': 2 }));
    face.append(svgNode('path', { d: 'M4 53 V4 H96 M7 8 H93', fill: 'none', stroke: '#c1c5bf', 'stroke-width': 2 }));
    for (const x of [13, 56]) {
      face.append(svgNode('rect', { x, y: 12, width: 31, height: 33, rx: 2, fill: '#1b2623', stroke: '#626d68', 'stroke-width': 3 }));
      face.append(svgNode('path', { d: `M${x + 3} 42 V16 H${x + 28}`, fill: 'none', stroke: '#aeb6b0', 'stroke-width': 2 }));
    }
    face.append(svgNode('path', { d: 'M7 22h2 M48 16h3 M48 38h2 M89 29h3 M21 51h3 M66 7h2 M74 51h3', fill: 'none', stroke: '#626c65', 'stroke-width': 1.5 }));
    if (members.length > 1) {
      const concrete = svgNode('svg', { class: 'brick-cinder', viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      concrete.append(svgNode('path', { d: shape.roundedPath, fill: '#969b99', stroke: '#404946', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      for (const part of members.filter(part => part.sourceId !== undefined)) {
        const tile = svgNode('svg', { x: (part.x - shape.x) / shape.w, y: (part.y - shape.y) / shape.h,
          width: part.w / shape.w, height: part.h / shape.h, viewBox: part.h > part.w ? '0 0 58 100' : '0 0 100 58', preserveAspectRatio: 'none' });
        const detail = svgNode('g', part.h > part.w ? { transform: 'translate(58 0) rotate(90)' } : {});
        for (const x of [13, 56]) {
          detail.append(svgNode('rect', { x, y: 12, width: 31, height: 33, rx: 2, fill: '#1b2623', stroke: '#626d68', 'stroke-width': 3 }));
          detail.append(svgNode('path', { d: `M${x + 3} 42 V16 H${x + 28}`, fill: 'none', stroke: '#aeb6b0', 'stroke-width': 2 }));
        }
        tile.append(detail); concrete.append(tile);
      }
      button.append(concrete);
    } else {
      block.append(face); button.append(block);
    }
  }
  button.dataset.specialVertical = String(vertical);
  const slots = [brick.spawner || brick.boost || brick.barrier || brick.turret || brick.hazard ? 'symbol' : null, brick.crumbler ? 'crumbler' : null,
    brick.warped ? 'warped' : null, brick.toggle ? 'toggle' : null, brick.power ? 'power' : null].filter(Boolean);
  const length = slots.reduce((total, slot) => total + (slot === 'toggle' ? 94 : 64), 0);
  const stacked = !vertical && brick.w / brick.h < 2 && brick.toggle && slots.length > 2;
  const rows = slots.length - 1;
  const info = slots.length ? svgNode('svg', { class: 'brick-info', viewBox: stacked ? `0 0 158 ${58 * rows}` : vertical ? `0 0 58 ${length}` : `0 0 ${length} 58`, 'aria-hidden': 'true' }) : null;
  if (info) {
    info.style.cssText = `left:${(infoBounds.x - shape.x) / shape.w * 100}%;top:${(infoBounds.y - shape.y) / shape.h * 100}%;width:${infoBounds.w / shape.w * 100}%;height:${infoBounds.h / shape.h * 100}%;`;
    button.append(info);
  }
  let offset = 0;
  const place = (node, slot) => {
    const size = slot === 'toggle' ? 94 : 64;
    for (const [name, value] of Object.entries(stacked
      ? slot === 'toggle' ? { x: 64, y: 0, width: 94, height: 58 * rows } : { x: 0, y: offset, width: 64, height: 58 }
      : vertical
      ? { x: 0, y: offset, width: 58, height: size }
      : { x: offset, y: 0, width: size, height: 58 })) node.setAttribute(name, value);
    info.append(node); offset += stacked ? 58 : size;
  };
  if (brick.hazard) {
    if (brick.hazard.power) button.append(hazardBorder(members, shape, brick.hazard.power === 'black' ? '#000000' : '#ffd92f'));
    // Bordered hazards shrink their icon so the frame never covers it.
    const span = brick.hazard.power ? 40 : 28;
    symbol = svgNode('svg', { class: 'brick-item-symbol brick-hazard-symbol', viewBox: `${-span} ${-span} ${span * 2} ${span * 2}`, 'aria-hidden': 'true' });
    const type = brick.hazard.type;
    const layer = (d, fill, stroke = '#17212a', width = 2) => symbol.append(svgNode('path', { d, fill, stroke, 'stroke-width': width }));
    if (type === 'laser') {
      const spark = Array.from({ length: 16 }, (_, i) => {
        const angle = i * Math.PI / 8, radius = i % 4 === 0 ? 12 : i % 2 === 0 ? 8.5 : 5;
        return `${i ? 'L' : 'M'}${(13 + Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`;
      }).join(' ') + ' Z';
      // The beam lies along the brick's long side, tapering away from the spark.
      const along = vertical ? 'rotate(90)' : null;
      for (const [d, fill, stroke, width] of [
        ['M-25 -1 L9 -4.5 L9 4.5 L-25 1 Z', '#f04444', '#17212a', 1.5],
        [spark, '#f04444', '#17212a', 1.5],
        ['M-22 0 H9', 'none', '#ffe0d6', 1.2],
        ['M13 -3.2 A3.2 3.2 0 1 1 12.99 -3.2 Z', '#fff2dd', 'none', 0],
      ]) symbol.append(svgNode('path', { d, fill, stroke, 'stroke-width': width, 'stroke-linejoin': 'round', ...(along ? { transform: along } : {}) }));
    } else if (type === 'flame') {
      layer(HAZARD_FLAME, '#ff812d');
      layer('M-12 17 Q-5 12 -8 6 Q-2 10 2 3 Q5 13 14 8 L17 17 Z', '#ffe15a', 'none');
    } else if (type === 'missile') {
      layer(MISSILE_FINS, '#df4141', '#9c2626', 3);
      layer(MISSILE_BODY, '#aeb7bd');
      layer('M-11 -3 H8', 'none', '#edf1f4', 2);
    } else if (type === 'obstructor') {
      const fill = brick.hazard.color ?? OBJECTS['obstruction-circle'].color, accent = brick.hazard.patternColor ?? '#dbe6ed';
      layer(SYMBOLS['obstruction-circle'], fill, '#17232c', 2.5);
      const pattern = brick.hazard.pattern ?? 'solid';
      if (pattern === 'polka-dots') layer('M-7 -9 a3 3 0 1 0 .1 0 M7 -9 a3 3 0 1 0 .1 0 M0 3 a3 3 0 1 0 .1 0 M-11 7 a3 3 0 1 0 .1 0 M11 7 a3 3 0 1 0 .1 0', accent, 'none');
      else if (pattern === 'stripes') layer('M-14 -6 L-6 -14 M-15 6 L6 -15 M-6 15 L15 -6 M6 14 L14 6', 'none', accent, 4);
      else if (pattern === 'checkered') layer('M-12 -12 H0 V0 H-12 Z M0 0 H12 V12 H0 Z', accent, 'none');
      layer('M-13 -9 A16 16 0 0 1 9 -14', 'none', '#ffffffa0', 3);
      layer('M14 9 A16 16 0 0 1 -9 14', 'none', '#00000066', 3);
    } else {
      const color = OBJECTS[type].color;
      layer(SYMBOLS[type], type.startsWith('bubble-') ? `${color}33` : color, color, 3);
      if (type.startsWith('bubble-')) layer('M-11 -15 Q-19 -8 -16 0 M-5 -18 L-2 -17', 'none', '#ffffff', 2);
      else layer('M14 0 A14 14 0 1 1 -14 0 A14 14 0 1 1 14 0 M8 0 A8 8 0 1 1 -8 0 A8 8 0 1 1 8 0', 'none', '#fff4d5', 2);
    }
    place(symbol, 'symbol');
  }
  if (brick.portal) {
    cloud = svgNode('svg', { class: 'brick-portal-cloud', viewBox: `0 0 ${shape.w} ${shape.h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    cloud.style.color = PORTALS[brick.portal];
    const path = shape.path.replace(/([ML])([-\d.e+]+) ([-\d.e+]+)/g, (_, command, x, y) =>
      `${command}${Number(x) * shape.w} ${Number(y) * shape.h}`);
    for (const layer of ['haze', 'puffs']) {
      cloud.append(svgNode('path', { class: `portal-${layer}`, d: path, 'vector-effect': 'non-scaling-stroke' }));
    }
    const center = groupCenterBrick ?? brick;
    const cx = (portalExit?.markerX ?? center.x + center.w / 2) - shape.x;
    const cy = (portalExit?.markerY ?? center.y + center.h / 2) - shape.y;
    cloud.append(svgNode('ellipse', {
      class: 'portal-exit-marker',
      cx,
      cy,
      rx: 13,
      ry: 8,
    }));
    for (let i = 0; i < 3; i++) {
      const ring = svgNode('ellipse', {
        class: 'portal-exit-wave',
        cx,
        cy,
        rx: 11,
        ry: 6,
      });
      ring.style.setProperty('--wave-delay', `${-i * .6}s`);
      ring.style.setProperty('--wave-scale', (i + 1) / 3);
      ring.style.setProperty('--wave-shade', [
        'color-mix(in srgb, currentColor 65%, white)',
        'color-mix(in srgb, currentColor 80%, white)',
        'color-mix(in srgb, currentColor 70%, black)',
      ][i]);
      cloud.append(ring);
    }
    button.append(cloud);
  }
  if (brick.spawner || brick.boost || brick.barrier || brick.turret) {
    const boomTime = brick.spawner?.kind === 'item' && BOOM_TIME_TYPES.has(brick.spawner.type);
    symbol = svgNode('svg', { class: `brick-item-symbol${brick.boost ? ' brick-boost-symbol' : ''}`,
      viewBox: boomTime ? '-28 -40 56 68' : '-28 -28 56 56', 'aria-hidden': 'true' });
    const d = brick.turret ? 'M-24 15 A24 24 0 0 1 24 15 Z'
      : brick.barrier ? FENCE : brick.boost ? FLAME : spawnSymbol(brick.spawner);
    if (brick.spawner) {
      symbol.style.setProperty('--item-color', spawnColor(brick.spawner));
      if (boomTime) {
        const color = ITEMS[brick.spawner.type].color;
        const body = svgNode('path', { class: 'item-color', d });
        body.style.setProperty('fill', color);
        body.style.setProperty('stroke', '#17212a');
        body.style.setProperty('stroke-width', 2.5);
        const wickOutline = svgNode('path', { d: 'M0 -16 Q-9 -22 -5 -29', fill: 'none', stroke: '#17212a', 'stroke-width': 5, 'stroke-linecap': 'round' });
        const wick = svgNode('path', { d: 'M0 -16 Q-9 -22 -5 -29', fill: 'none', stroke: '#e0a04c', 'stroke-width': 2.5, 'stroke-linecap': 'round' });
        const flame = svgNode('path', { d: 'M-5 -27 Q-11 -33 -4 -39 Q-3 -34 1 -35 Q3 -28 -5 -27 Z', fill: '#ff7928', stroke: '#17212a', 'stroke-width': 1.2 });
        const flameCore = svgNode('path', { d: 'M-4 -29 Q-7 -33 -4 -36 Q-3 -33 -1 -32 Z', fill: '#ffe36b', stroke: 'none' });
        const face = svgNode('circle', { cx: 0, cy: 1, r: 14, fill: '#fff7df', stroke: '#17212a', 'stroke-width': 2 });
        const hands = svgNode('path', { d: 'M0 -3 V-10 M0 -3 L6 -1', fill: 'none', stroke: '#17212a', 'stroke-width': 1.8 });
        const count = svgNode('text', { x: 0, y: 12, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 'bold' });
        count.textContent = `+${ITEMS[brick.spawner.type].counts}`;
        count.style.setProperty('fill', '#111820');
        count.style.setProperty('stroke', 'none');
        symbol.append(svgNode('path', { class: 'item-outline', d }), body, wickOutline, wick, flame, flameCore, face, hands, count);
      } else {
        symbol.append(svgNode('path', { class: 'item-outline', d }));
      }
    } else if (brick.turret) {
      const color = brick.turret === 'laser' ? '#3b82f6' : '#ef4545';
      symbol.style.setProperty('--item-color', color);
      const edge = width === undefined ? vertical ? 'left' : 'bottom'
        : brickRegions([source ?? brick], width, height).get((source ?? brick).id).edge;
      const rotation = { top: 180, right: -90, bottom: 0, left: 90 }[edge];
      const group = svgNode('g', { class: 'turret-icon', transform: `rotate(${rotation})` });
      turretFill = svgNode('path', { class: 'item-color', d, fill: color });
      turretFill.turretColor = color;
      group.append(svgNode('path', { class: 'item-outline', d }));
      group.append(turretFill);
      group.append(svgNode('rect', { class: 'turret-barrel', x: 4, y: -4, width: 24, height: 8,
        transform: 'rotate(-45)', fill: '#aeb7bd', stroke: '#17212a', 'stroke-width': 2,
        'stroke-linejoin': 'miter' }));
      symbol.append(group);
    }
    if (!boomTime && !brick.turret) {
      symbol.append(svgNode('path', { class: 'item-color', d, ...(brick.barrier
        ? { fill: 'none', stroke: '#174f36', 'stroke-width': 4, opacity: .75 }
        : brick.boost ? { fill: '#f58428', stroke: '#17212a', 'stroke-width': 3 } : {}) }));
    }
    if (brick.spawner?.kind === 'enemy' && brick.spawner.type === 'snake') {
      symbol.append(svgNode('path', { d: 'M-23 1 H-15 M-23 9 H-15 M-8 0 H0 M-8 10 H0 M7 0 H15 M7 10 H15',
        fill: 'none', stroke: '#59666f', 'stroke-width': 3 }));
      symbol.append(svgNode('path', { d: 'M-21 1 H-17 M-21 9 H-17 M-6 0 H-2 M-6 10 H-2 M9 0 H13 M9 10 H13',
        fill: 'none', stroke: '#bd3944', 'stroke-width': 2 }));
      symbol.append(svgNode('path', { d: 'M18 -3 H22 M18 1 H22 M21 -1 L26 -4 M21 3 L26 6',
        fill: 'none', stroke: '#e3444d', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    }
    place(symbol, 'symbol');
  }
  for (const attribute of ['crumbler', 'warped']) {
    if (!brick[attribute]) continue;
    const badge = svgNode('svg', { class: 'brick-number-badge', viewBox: '0 0 64 58' });
    badge.append(svgNode('rect', { x: 2, y: 7, width: 60, height: 44, rx: 6, fill: '#111d25', 'fill-opacity': .9 }));
    const text = svgNode('text', { x: 32, y: 36, 'text-anchor': 'middle', fill: 'white', 'font-size': 24, 'font-weight': 'bold' });
    badge.append(text); place(badge, attribute);
    if (attribute === 'crumbler') crumblerCount = text; else warpCount = text;
  }
  if (brick.toggle) {
    const toggle = svgNode('svg', { class: 'brick-toggle', viewBox: vertical ? '-3 -3 58 94' : '-3 -3 94 58', 'aria-hidden': 'true' });
    toggle.style.color = { 1: PORTALS.red, 2: PORTALS.green, 4: PORTALS.blue }[brick.toggle];
    const group = svgNode('g', vertical ? { transform: 'translate(52 0) rotate(90)' } : {});
    group.append(svgNode('rect', { x: 0, y: 0, width: 88, height: 52, rx: 26, fill: 'currentColor', stroke: '#19252d', 'stroke-width': 5 }));
    knob = svgNode('circle', { cy: 26, r: 21, fill: 'white' });
    count = svgNode('text', { y: 36, 'text-anchor': 'middle', fill: '#19252d', 'font-size': 32, 'font-weight': 'bold' });
    group.append(knob, count);
    toggle.append(group);
    place(toggle, 'toggle');
  }
  if (brick.power) {
    const power = svgNode('svg', { class: 'brick-power', viewBox: '-29 -29 58 58', 'aria-hidden': 'true' });
    powerDisc = svgNode('circle', { cx: 0, cy: 0, r: 27 });
    const mark = 'M-8 -14 A17 17 0 1 0 8 -14 M0 -21 V-2';
    powerMark = svgNode('path', { d: mark,
      fill: 'none', 'stroke-width': 6, 'stroke-linecap': 'butt' });
    power.append(
      svgNode('circle', { class: 'power-shadow', cx: 0, cy: 1.5, r: 27, fill: '#000000', opacity: .45 }),
      powerDisc,
      svgNode('path', { class: 'power-sheen', d: 'M-27 0 A27 27 0 0 1 27 0 Q0 -15 -27 0 Z', fill: '#ffffff', opacity: .12 }),
      svgNode('path', { class: 'power-shade', d: 'M-27 0 A27 27 0 0 0 27 0 Q0 39 -27 0 Z', fill: '#000000', opacity: .24 }),
      svgNode('path', { class: 'power-bevel-light', d: 'M-24 6 A25 25 0 0 1 18 -17',
        fill: 'none', stroke: '#ffffff', 'stroke-width': 1.5, opacity: .42 }),
      svgNode('path', { class: 'power-bevel-dark', d: 'M24 -6 A25 25 0 0 1 -18 17',
        fill: 'none', stroke: '#000000', 'stroke-width': 2, opacity: .4 }),
      svgNode('path', { class: 'power-mark-shadow', d: mark, transform: 'translate(0 1.2)',
        fill: 'none', stroke: '#000000', 'stroke-width': 7, opacity: .4 }),
      powerMark);
    place(power, 'power');
  }
  const visual = { button, cloud, knob, count, symbol, vertical, info, infoBounds, crumblerCount, warpCount, turretFill, powerDisc, powerMark };
  updateBrick(visual, brick, 0);
  return visual;
}
function updateBrick(visual, brick, elapsed, sunglassesActive = false) {
  const enabled = sunglassesActive || brickEnabled(brick);
  visual.button.dataset.toggleDisabled = String(!enabled);
  if (visual.powerDisc) {
    visual.powerDisc.setAttribute('fill', brick.powerOn ? '#000000' : '#ffd92f');
    visual.powerMark.setAttribute('stroke', brick.powerOn ? '#ffd92f' : '#000000');
  }
  if (visual.cloud) {
    // Moving dashes jump at the closed outline's seam; breathe the fixed mist instead.
    visual.cloud.querySelector('.portal-puffs').style.opacity = String(.7 + Math.sin(elapsed * 1.5) * .1);
  }
  if (visual.knob) {
    const x = enabled ? 62 : 26;
    visual.knob.setAttribute('cx', x);
    visual.count.setAttribute('x', x);
    visual.count.textContent = String(sunglassesActive ? 0 : brick.toggleRemaining);
    if (visual.vertical) visual.count.setAttribute('transform', `rotate(-90 ${x} 26)`);
  }
  if (visual.symbol) {
    visual.symbol.dataset.spawnReady = String(Boolean((brick.spawner || brick.turret) && !brick.spawned));
    visual.symbol.style.opacity = brick.boost ? '.8' : '1';
    if (brick.hazard) visual.symbol.style.opacity = hazardEnabled(brick, Boolean(brick.powerOn)) ? '1' : '.4';
    if (brick.spawner?.type === 'magic-sunglasses') visual.symbol.style.setProperty('--item-color', `hsl(${elapsed * 140 % 360}, 85%, 70%)`);
  }
  if (visual.turretFill) {
    const used = Boolean(brick.spawned);
    visual.turretFill.setAttribute('fill', used ? TURRET_USED_COLOR : visual.turretFill.turretColor);
    if (visual.symbol.dataset) visual.symbol.dataset.turretUsed = String(used);
  }
  if (visual.crumblerCount) visual.crumblerCount.textContent = `C:${brick.usesLeft ?? brick.crumbler}`;
  if (visual.warpCount) {
    const seconds = brick.warpUntil == null ? brick.warped : Math.max(0, Math.ceil(brick.warpUntil - elapsed - 1e-9));
    visual.warpCount.textContent = `W:${brick.usesLeft === 0 ? 'X' : seconds}`;
  }
  for (const text of [visual.crumblerCount, visual.warpCount]) {
    if (text) text.setAttribute('font-size', Math.min(28, 120 / text.textContent.length));
  }
}
function exposeBrickInfo(visual, container, brick, width, height) {
  if (!visual.info) return;
  const bounds = visual.infoBounds;
  visual.info.style.cssText = `left:${bounds.x / width * 100}%;top:${bounds.y / height * 100}%;width:${bounds.w / width * 100}%;height:${bounds.h / height * 100}%;`;
  visual.info.dataset.id = brick.id;
  container.append(visual.info);
}
function exposePortalCloud(visual, container) {
  if (!visual.cloud) return;
  for (const property of ['left', 'top', 'width', 'height']) visual.cloud.style[property] = visual.button.style[property];
  visual.cloud.style.right = 'auto'; visual.cloud.style.bottom = 'auto';
  container.append(visual.cloud);
}
function drawBoost(ctx, x, y, time) {
  ctx.save(); ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 14) * .08);
  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 42);
  glow.addColorStop(0, '#ffe28444'); glow.addColorStop(.6, '#ff813088'); glow.addColorStop(1, '#ff4c1400');
  ctx.fillStyle = glow; ctx.fillRect(-42, -42, 84, 84);
  ctx.strokeStyle = '#ffae44'; ctx.lineWidth = 3;
  ctx.stroke(new Path2D(FLAME));
  ctx.restore();
}
function drawCatTrack(ctx, track) {
  ctx.save();
  ctx.strokeStyle = track.power === 'yellow' ? '#d5b83f' : track.power === 'black' ? '#41464b' : '#174f36';
  ctx.globalAlpha *= .65;
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash([1, 8]);
  ctx.beginPath();
  track.path.nodes.forEach((node, i) => i ? ctx.lineTo(node.x, node.y) : ctx.moveTo(node.x, node.y));
  if (track.closed) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawBarrier(ctx, fence) {
  ctx.save(); ctx.translate(fence.x, fence.y); ctx.rotate(Math.atan2(fence.ny, fence.nx));
  ctx.strokeStyle = '#174f36'; ctx.fillStyle = '#174f36'; ctx.globalAlpha *= .65;
  ctx.fillRect(0, -7, fence.length, 14);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(fence.length, -5);
  ctx.moveTo(0, 5); ctx.lineTo(fence.length, 5);
  for (let x = 0; x <= fence.length; x += 12) {
    ctx.moveTo(x, -10); ctx.lineTo(x, 10);
  }
  ctx.stroke(); ctx.restore();
}

function drawCatCircle(ctx, circle) {
  const radius = 54;
  ctx.save(); ctx.translate(circle.x, circle.y);
  ctx.scale((circle.radius ?? 54) / radius, (circle.radius ?? 54) / radius);
  ctx.fillStyle = '#174f36'; ctx.globalAlpha *= .24;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .65; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, radius - 1, 0, Math.PI * 2); ctx.strokeStyle = '#174f36'; ctx.stroke();
  ctx.translate(0, -7);
  ctx.globalAlpha = .72; ctx.fillStyle = '#174f36';
  ctx.beginPath();
  ctx.moveTo(-22, 18); ctx.lineTo(-22, -15); ctx.lineTo(-9, -9);
  ctx.quadraticCurveTo(0, -13, 9, -9); ctx.lineTo(22, -15); ctx.lineTo(22, 18);
  ctx.quadraticCurveTo(22, 29, 11, 29); ctx.lineTo(-11, 29);
  ctx.quadraticCurveTo(-22, 29, -22, 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9dbb9e'; ctx.globalAlpha = .8;
  for (const x of [-9, 9]) {
    ctx.beginPath(); ctx.ellipse(x, 8, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(-3, 18); ctx.lineTo(0, 21); ctx.lineTo(3, 18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 21); ctx.lineTo(0, 25); ctx.strokeStyle = '#9dbb9e'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

function goalLines(part) {
  const x = part.x + 2, y = part.y + 2, right = part.x + part.w - 2, bottom = part.y + part.h - 2;
  const vertical = part.h > part.w;
  const frame = vertical ? part.x < 100 ? `M${right} ${y} H${x} V${bottom} H${right}` : `M${x} ${y} H${right} V${bottom} H${x}`
    : part.y < 100 ? `M${x} ${bottom} V${y} H${right} V${bottom}` : `M${x} ${y} V${bottom} H${right} V${y}`;
  let mesh = '';
  for (let xx = x + 6; xx < right; xx += 7) mesh += `M${xx} ${y} V${bottom} `;
  for (let yy = y + 6; yy < bottom; yy += 7) mesh += `M${x} ${yy} H${right} `;
  return { frame, mesh };
}

function drawGoal(ctx, members, glowColor = null) {
  ctx.save();
  if (glowColor) { ctx.shadowColor = glowColor; ctx.shadowBlur = 12; }
  for (const part of goalTiles(members)) {
    const { frame, mesh } = goalLines(part);
    ctx.fillStyle = '#20392c'; ctx.fillRect(part.x, part.y, part.w, part.h);
    ctx.strokeStyle = glowColor ?? '#ffffff'; ctx.lineWidth = .8; ctx.stroke(new Path2D(mesh));
    ctx.strokeStyle = '#79878d'; ctx.lineWidth = 4; ctx.stroke(new Path2D(frame));
    ctx.strokeStyle = glowColor ?? '#dce4e7'; ctx.lineWidth = 2; ctx.stroke(new Path2D(frame));
  }
  ctx.restore();
}

function drawSoccerBall(ctx, ball) {
  const radius = ball.radius ?? 16;
  ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle ?? 0);
  const face = ctx.createRadialGradient(-radius * .35, -radius * .4, 1, 0, 0, radius);
  face.addColorStop(0, '#ffffff'); face.addColorStop(.7, '#f1f3f2'); face.addColorStop(1, '#a0afb4');
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = face; ctx.fill(); ctx.strokeStyle = '#253039'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.clip();
  const pentagon = (x, y, size, angle) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = angle + i * Math.PI * 2 / 5;
      const px = x + Math.cos(a) * size, py = y + Math.sin(a) * size;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = '#20272e'; pentagon(0, 0, radius * .4, -Math.PI / 2);
  ctx.strokeStyle = '#68767c'; ctx.lineWidth = .8;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const x = Math.cos(a), y = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x * radius * .4, y * radius * .4); ctx.lineTo(x * radius, y * radius); ctx.stroke();
    pentagon(x * radius, y * radius, radius * .3, a + Math.PI);
  }
  ctx.restore();
}

function drawObstruction(ctx, obstruction) {
  const { radius, width, height } = obstructionGeometry(obstruction);
  const vertices = obstructionVertices(obstruction);
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(...vertices[0]);
    for (const point of vertices.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
  };
  ctx.save(); ctx.translate(obstruction.x, obstruction.y);
  ctx.rotate((obstruction.rotation ?? 0) * Math.PI / 180);
  if (obstruction.spiked) {
    ctx.beginPath();
    for (const [a, b, c] of obstructionSpikes({ ...obstruction, x: 0, y: 0, rotation: 0 })) {
      ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath();
    }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#aab9c5'; ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.fill(); ctx.stroke();
  }
  trace();
  ctx.fillStyle = obstruction.color ?? OBJECTS[obstruction.type].color;
  ctx.fill();
  ctx.save(); ctx.clip();
  ctx.save();
  ctx.fillStyle = obstruction.patternColor ?? '#dbe6ed';
  if (obstruction.pattern === 'polka-dots') {
    for (let y = -height / 2; y <= height / 2; y += 14) for (let x = -width / 2; x <= width / 2; x += 14) {
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (obstruction.pattern === 'stripes') {
    const reach = Math.hypot(width, height) / 2;
    ctx.rotate(-Math.PI / 4);
    for (let x = -reach; x < reach; x += 16) ctx.fillRect(x, -reach, 7, reach * 2);
  } else if (obstruction.pattern === 'checkered') {
    for (let row = 0; row * 12 < height; row++) for (let column = 0; column * 12 < width; column++) {
      if ((row + column) % 2 === 0) ctx.fillRect(-width / 2 + column * 12, -height / 2 + row * 12, 12, 12);
    }
  }
  ctx.restore();
  const bevel = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  bevel.addColorStop(0, '#ffffff99');
  bevel.addColorStop(.45, '#ffffff20');
  bevel.addColorStop(.55, '#00000020');
  bevel.addColorStop(1, '#00000099');
  trace(); ctx.strokeStyle = bevel; ctx.lineWidth = 12;
  ctx.lineJoin = OBJECTS[obstruction.type].obstruction === 'v' ? 'round' : 'miter'; ctx.stroke();
  ctx.restore();
  trace();
  ctx.strokeStyle = '#17232c'; ctx.lineWidth = 2.5;
  ctx.lineJoin = OBJECTS[obstruction.type].obstruction === 'v' ? 'round' : 'miter'; ctx.stroke();
  if (obstruction.destructible) {
    ctx.save();
    const face = ctx.createLinearGradient(-18, -13, 18, 13);
    face.addColorStop(0, '#fff');
    face.addColorStop(.45, '#f8fafc');
    face.addColorStop(1, '#b8c1cb');
    ctx.shadowColor = '#0009'; ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2;
    ctx.fillStyle = face; ctx.fillRect(-18, -13, 36, 26);
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    const rim = ctx.createLinearGradient(-18, -13, 18, 13);
    rim.addColorStop(0, '#ff8880');
    rim.addColorStop(.35, '#e53632');
    rim.addColorStop(1, '#891e25');
    ctx.strokeStyle = rim; ctx.lineWidth = 3; ctx.strokeRect(-18, -13, 36, 26);
    ctx.strokeStyle = '#ffffffb3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-16, 11); ctx.lineTo(-16, -11); ctx.lineTo(16, -11); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, 1, 30);
    ctx.restore();
  }
  ctx.restore();
}

function drawObstructionDestruction(ctx, effect) {
  const progress = Math.min(1, effect.age / effect.duration);
  const { width, height } = obstructionGeometry(effect);
  const columns = Math.min(8, Math.max(2, Math.ceil(width / 32)));
  const rows = Math.min(8, Math.max(2, Math.ceil(height / 32)));
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = effect.x - width / 2 + column * width / columns;
    const y = effect.y - height / 2 + row * height / rows;
    const cx = x + width / columns / 2, cy = y + height / rows / 2;
    const cell = row * columns + column + 1;
    const angle = Math.atan2(cy - effect.y, cx - effect.x);
    const offset = progress * (18 + cell % 7 * 3);
    const jitterX = Math.sin(cell * 2.4) * Math.min(14, width / columns * .3);
    const jitterY = Math.cos(cell * 3.1) * Math.min(14, height / rows * .3);
    ctx.save();
    ctx.globalAlpha *= Math.max(0, 1 - progress * 2);
    ctx.translate(Math.cos(angle) * offset, Math.sin(angle) * offset + progress * progress * 35);
    ctx.beginPath(); ctx.rect(x, y, width / columns, height / rows); ctx.clip();
    drawObstruction(ctx, { ...effect, destructible: false });
    ctx.restore();
    const shape = OBJECTS[effect.type].obstruction;
    const dx = cx - effect.x, dy = cy - effect.y;
    if (shape === 'circle' ? Math.hypot(dx, dy) > width / 2
      : shape === 'diamond' && Math.abs(dx) + Math.abs(dy) > width / 2) continue;
    ctx.save();
    ctx.globalAlpha *= Math.sin(Math.PI * progress) * .7;
    ctx.fillStyle = '#92979b';
    ctx.beginPath(); ctx.arc(cx + jitterX + Math.cos(angle) * offset, cy + jitterY + Math.sin(angle) * offset - progress * 18,
      4 + progress * Math.min(24, Math.max(width / columns, height / rows)) * (.7 + cell % 4 * .1), 0, Math.PI * 2); ctx.fill();
    if ((row + column) % 2 === 0) {
      ctx.globalAlpha *= Math.max(0, 1 - progress);
      ctx.fillStyle = '#ef5633'; ctx.beginPath(); ctx.arc(cx + jitterX, cy + jitterY, 3 + Math.sin(progress * Math.PI) * 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb543'; ctx.beginPath(); ctx.arc(cx + jitterX - 1, cy + jitterY - 1, 2 + Math.sin(progress * Math.PI) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPaintSplash(ctx, effect) {
  const progress = Math.max(0, Math.min(1, effect.age / effect.duration));
  const expansion = 1 - (1 - progress) ** 3;
  const spread = 24 + 90 * expansion;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, (1 - progress) / .45);
  ctx.fillStyle = ITEMS[effect.type].color;
  ctx.strokeStyle = '#26323c'; ctx.lineWidth = 2.5;
  ctx.save();
  ctx.beginPath();
  for (const part of effect.members) ctx.rect(part.x, part.y, part.w, part.h);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 20 + 30 * expansion, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // The spray escapes the brick face so it remains visible against freshly matching paint.
  ctx.translate(effect.x + effect.nx * 8, effect.y + effect.ny * 8);
  ctx.rotate(Math.atan2(effect.ny, effect.nx));
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI * 2 / 24;
    const radius = (i % 2 ? 14 : 32 + i % 3 * 5) * (.7 + .3 * expansion);
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const angle = (i / 10 - .5) * Math.PI * .9;
    const reach = spread * (i % 2 ? .7 : 1);
    const x = Math.cos(angle) * reach, y = Math.sin(angle) * reach;
    ctx.beginPath();
    ctx.ellipse(x, y, 7 + 7 * (1 - progress), 4 + 4 * (1 - progress), angle, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.fillStyle = '#fff8e6';
    ctx.beginPath(); ctx.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawFlameHazard(ctx, parts, time = 0) {
  const shape = brickShape(parts);
  const loops = shape.path.split('M').slice(1).map(loop =>
    loop.replace('Z', '').split('L').map(pair => {
      const [x, y] = pair.split(' ').map(Number);
      return [shape.x + x * shape.w, shape.y + y * shape.h];
    }));
  ctx.save();
  ctx.beginPath();
  for (const [first, ...points] of loops) {
    ctx.moveTo(...first);
    for (const point of points) ctx.lineTo(...point);
    ctx.closePath();
  }
  ctx.strokeStyle = '#ff7928'; ctx.lineWidth = 10;
  ctx.shadowColor = '#ff7928'; ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffb52e';
  for (const points of loops) for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    const tx = (bx - ax) / length, ty = (by - ay) / length;
    for (let along = 6; along < length; along += 13) {
      const x = ax + tx * along, y = ay + ty * along;
      const reach = 7 + Math.sin(time * 12 + along) * 2;
      ctx.beginPath(); ctx.moveTo(x - tx * 5, y - ty * 5);
      ctx.lineTo(x + ty * reach, y - tx * reach);
      ctx.lineTo(x + tx * 5, y + ty * 5); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawItemCase(ctx, item, drawContent) {
  const radius = item.radius ?? OBJECTS['item-case'].radius;
  ctx.save(); ctx.translate(item.x, item.y);
  ctx.fillStyle = '#a8dcec22';
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.save(); ctx.scale(.65, .65);
  if (drawContent) drawContent(item.containsItem);
  else {
    const type = item.containsItem;
    const spawn = { kind: Object.hasOwn(WEAPONS, type) ? 'weapon' : 'item', type };
    ctx.strokeStyle = spawnColor(spawn); ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(spawnSymbol(spawn)));
  }
  ctx.restore();
  ctx.fillStyle = '#bce8f41c'; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.strokeStyle = '#8bc5d6'; ctx.lineWidth = 3;
  ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
  ctx.strokeStyle = '#e9fcff'; ctx.lineWidth = 1;
  ctx.strokeRect(-radius + 2, -radius + 2, radius * 2 - 4, radius * 2 - 4);
  ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-radius + 6, -radius + 15); ctx.lineTo(-radius + 15, -radius + 6);
  ctx.moveTo(-radius + 6, -radius + 25); ctx.lineTo(-radius + 25, -radius + 6); ctx.stroke();
  ctx.restore();
}

function drawGlassBreak(ctx, effect) {
  const progress = Math.min(1, effect.age / effect.duration);
  ctx.save(); ctx.translate(effect.x, effect.y);
  ctx.globalAlpha *= 1 - progress;
  ctx.fillStyle = '#bce8f4aa'; ctx.strokeStyle = '#ecfcff'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const distance = 16 + effect.age * (65 + i % 3 * 30);
    ctx.save(); ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance + effect.age ** 2 * 90);
    ctx.rotate(angle + effect.age * (i % 2 ? 5 : -5));
    ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(7, -3); ctx.lineTo(2, 8);
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function drawBumper(ctx, bumper, time = 0) {
  const radius = bumper.radius ?? 48;
  const color = OBJECTS[bumper.type]?.color ?? '#399d4a';
  const pulse = Number.isFinite(bumper.hitAt) ? Math.max(0, 1 - (time - bumper.hitAt) / .2) : 0;
  const compression = Math.sin(pulse * Math.PI) * .06;
  const shake = Math.sin(pulse * Math.PI * 6) * pulse * 1.2;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.translate(bumper.x + (bumper.hitNormal?.x ?? 0) * shake,
    bumper.y + (bumper.hitNormal?.y ?? 0) * shake);
  ctx.scale(1 + compression, 1 - compression);
  const face = ctx.createRadialGradient(-radius * .35, -radius * .4, 1, 0, 0, radius);
  face.addColorStop(0, '#ffffff'); face.addColorStop(.7, color); face.addColorStop(1, '#17232c');
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = face; ctx.fill(); ctx.strokeStyle = '#17232c'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#f6f7ef'; ctx.lineWidth = 2.2;
  for (const ring of [.72, .43, .14]) {
    ctx.beginPath(); ctx.arc(0, 0, radius * ring, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

const api = { FLAME, FENCE, drawCatTrack, drawBarrier, drawCatCircle, drawGoal, drawSoccerBall, drawItemCase, drawGlassBreak, drawBumper, drawFlameHazard, drawObstruction, drawObstructionDestruction, drawPaintbrush, drawPaintSplash, traceSawBlade, spawnSymbol, spawnColor, specialLabel, brickInfoBounds, decorateBrick, updateBrick, exposePortalCloud, exposeBrickInfo, drawBoost };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiBrickVisuals = api;
})();
