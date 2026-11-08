import type { Random } from './engine';

export interface GridPoint {
  x: number;
  y: number;
}

export type FitRotation = 0 | 90 | 180 | 270;

export interface FitPiece {
  cells: GridPoint[];
  source: number;
}

export interface FitQuestion {
  kind: 'fit';
  targetCells: GridPoint[];
  pieces: FitPiece[];
  answer: number;
  requiredRotation: FitRotation;
  requiredReflection: boolean;
  rows: number;
  columns: number;
}

const SHAPES: GridPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],
];

export function normalizeCells(cells: GridPoint[]): GridPoint[] {
  const unique = new Map(cells.map((cell) => [`${cell.x}:${cell.y}`, cell]));
  const values = [...unique.values()];
  const minX = Math.min(...values.map((cell) => cell.x));
  const minY = Math.min(...values.map((cell) => cell.y));
  return values
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function rotateCells(cells: GridPoint[]): GridPoint[] {
  return normalizeCells(cells.map((cell) => ({ x: -cell.y, y: cell.x })));
}

/** Mirror across the vertical axis, using the same left/right control in every level. */
export function reflectCells(cells: GridPoint[]): GridPoint[] {
  return normalizeCells(cells.map((cell) => ({ x: -cell.x, y: cell.y })));
}

export function orientCells(
  cells: GridPoint[],
  rotation: FitRotation,
  reflected: boolean,
): GridPoint[] {
  let oriented = normalizeCells(cells);
  for (let turns = 0; turns < rotation / 90; turns++) oriented = rotateCells(oriented);
  if (reflected) oriented = reflectCells(oriented);
  return oriented;
}

export function orientationKey(cells: GridPoint[]): string {
  return normalizeCells(cells)
    .map((cell) => `${cell.x},${cell.y}`)
    .join(';');
}

export function orientationSet(cells: GridPoint[]): Set<string> {
  const keys = new Set<string>();
  for (const rotation of [0, 90, 180, 270] as const) {
    keys.add(orientationKey(orientCells(cells, rotation, false)));
    keys.add(orientationKey(orientCells(cells, rotation, true)));
  }
  return keys;
}

export function fitsTarget(cells: GridPoint[], target: GridPoint[]): boolean {
  return orientationKey(cells) === orientationKey(target);
}

export function fitDimensions(cells: GridPoint[]): { rows: number; columns: number } {
  const normalized = normalizeCells(cells);
  return {
    rows: Math.max(...normalized.map((cell) => cell.y)) + 1,
    columns: Math.max(...normalized.map((cell) => cell.x)) + 1,
  };
}

function shuffled<T>(values: T[], rng: Random): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

const DISTRACTOR_COUNTS = [2, 3, 3, 4, 4] as const;

/**
 * A target is generated from one piece. Every distractor is rejected if any rotation or
 * reflection could also form the target, leaving one geometrically valid choice.
 */
export function generateFitQuestion(level: number, rng: Random): FitQuestion {
  const safeLevel = Math.max(1, Math.min(5, Math.floor(level)));
  const source = Math.floor(rng() * SHAPES.length);
  const rotationChoices: FitRotation[] =
    safeLevel === 1 ? [0] : safeLevel === 2 ? [90, 180] : [0, 90, 180, 270];
  const requiredRotation = rotationChoices[Math.floor(rng() * rotationChoices.length)];
  const requiredReflection = safeLevel >= 4 && rng() < 0.55;
  const targetCells = orientCells(SHAPES[source], requiredRotation, requiredReflection);
  const targetKey = orientationKey(targetCells);
  const sourceIndexes = SHAPES.map((_, index) => index).filter(
    (index) => index !== source && !orientationSet(SHAPES[index]).has(targetKey),
  );
  const distractorSources = shuffled(sourceIndexes, rng).slice(
    0,
    DISTRACTOR_COUNTS[safeLevel - 1] - 1,
  );
  if (distractorSources.length < DISTRACTOR_COUNTS[safeLevel - 1] - 1)
    throw new Error('Unable to generate distinct fitting pieces');

  const answer = Math.floor(rng() * DISTRACTOR_COUNTS[safeLevel - 1]);
  const pieces = shuffled([source, ...distractorSources], rng).map((pieceSource) => ({
    cells: normalizeCells(SHAPES[pieceSource]),
    source: pieceSource,
  }));
  const correct = pieces.findIndex((piece) => piece.source === source);
  if (correct !== answer) {
    [pieces[answer], pieces[correct]] = [pieces[correct], pieces[answer]];
  }
  const dimensions = fitDimensions(targetCells);
  return {
    kind: 'fit',
    targetCells,
    pieces,
    answer,
    requiredRotation,
    requiredReflection,
    ...dimensions,
  };
}

export function createFitPracticeQuestion(mode: 'rotate' | 'reflect'): FitQuestion {
  const source = 0;
  const targetCells =
    mode === 'rotate'
      ? orientCells(SHAPES[source], 90, false)
      : orientCells(SHAPES[source], 0, true);
  const targetKey = orientationKey(targetCells);
  const distractor = SHAPES.findIndex(
    (_, index) => index !== source && !orientationSet(SHAPES[index]).has(targetKey),
  );
  if (distractor < 0) throw new Error('Unable to create fitting practice');
  const dimensions = fitDimensions(targetCells);
  return {
    kind: 'fit',
    targetCells,
    pieces: [
      { cells: normalizeCells(SHAPES[distractor]), source: distractor },
      { cells: normalizeCells(SHAPES[source]), source },
    ],
    answer: 1,
    requiredRotation: mode === 'rotate' ? 90 : 0,
    requiredReflection: mode === 'reflect',
    ...dimensions,
  };
}

export function scoreFitRound(correct: boolean, level: number): number {
  return correct ? 100 * Math.max(1, Math.min(5, level)) : 0;
}
