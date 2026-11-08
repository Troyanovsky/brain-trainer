import type { Random } from './engine';

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RouteQuestion {
  kind: 'route';
  width: number;
  height: number;
  start: RoutePoint;
  exit: RoutePoint;
  pickups: RoutePoint[];
  blocked: RoutePoint[];
  optimalMoves: number;
}

export type RouteErrorKind = 'blocked' | 'not-adjacent' | 'exit-locked';

export interface RouteSolution {
  moves: RoutePoint[];
  collected: boolean[];
}

const DIMENSIONS = [
  { width: 4, height: 4 },
  { width: 4, height: 5 },
  { width: 5, height: 5 },
  { width: 5, height: 6 },
  { width: 6, height: 6 },
] as const;
const PICKUP_COUNTS = [1, 1, 2, 2, 3] as const;
const BLOCKED_COUNTS = [2, 3, 4, 6, 8] as const;

export const pointKey = ({ x, y }: RoutePoint) => `${x}:${y}`;
export const samePoint = (a: RoutePoint, b: RoutePoint) => a.x === b.x && a.y === b.y;
export const isAdjacent = (a: RoutePoint, b: RoutePoint) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

function shuffled<T>(values: T[], rng: Random): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function nextRoutePosition(
  position: RoutePoint,
  direction: 'up' | 'right' | 'down' | 'left',
): RoutePoint {
  if (direction === 'up') return { x: position.x, y: position.y - 1 };
  if (direction === 'right') return { x: position.x + 1, y: position.y };
  if (direction === 'down') return { x: position.x, y: position.y + 1 };
  return { x: position.x - 1, y: position.y };
}

export function routeOptimalMoves(question: RouteQuestion): number {
  const blocked = new Set(question.blocked.map(pointKey));
  const pickupIndex = new Map(question.pickups.map((point, index) => [pointKey(point), index]));
  const allCollected = (1 << question.pickups.length) - 1;
  const startKey = `${question.start.x}:${question.start.y}:0`;
  const distance = new Map<string, number>([[startKey, 0]]);
  const queue: Array<{ point: RoutePoint; collected: number }> = [
    { point: question.start, collected: 0 },
  ];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    const currentDistance = distance.get(`${state.point.x}:${state.point.y}:${state.collected}`)!;
    if (samePoint(state.point, question.exit) && state.collected === allCollected)
      return currentDistance;

    for (const direction of ['up', 'right', 'down', 'left'] as const) {
      const next = nextRoutePosition(state.point, direction);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= question.width ||
        next.y >= question.height ||
        blocked.has(pointKey(next)) ||
        (samePoint(next, question.exit) && state.collected !== allCollected)
      )
        continue;
      const collectedIndex = pickupIndex.get(pointKey(next));
      const collected =
        collectedIndex === undefined ? state.collected : state.collected | (1 << collectedIndex);
      const key = `${next.x}:${next.y}:${collected}`;
      if (distance.has(key)) continue;
      distance.set(key, currentDistance + 1);
      queue.push({ point: next, collected });
    }
  }
  return -1;
}

function pointsForBoard(width: number, height: number): RoutePoint[] {
  return Array.from({ length: width * height }, (_, index) => ({
    x: index % width,
    y: Math.floor(index / width),
  }));
}

function createCandidate(level: number, rng: Random): RouteQuestion {
  const { width, height } = DIMENSIONS[level - 1];
  const start = { x: 0, y: height - 1 };
  const exit = { x: width - 1, y: 0 };
  const candidates = pointsForBoard(width, height).filter(
    (point) => !samePoint(point, start) && !samePoint(point, exit),
  );
  const blocked = shuffled(candidates, rng).slice(0, BLOCKED_COUNTS[level - 1]);
  const blockedKeys = new Set(blocked.map(pointKey));
  const available = candidates.filter((point) => !blockedKeys.has(pointKey(point)));
  const pickups = shuffled(available, rng).slice(0, PICKUP_COUNTS[level - 1]);
  return {
    kind: 'route',
    width,
    height,
    start,
    exit,
    pickups,
    blocked,
    optimalMoves: 0,
  };
}

function createFallback(level: number): RouteQuestion {
  const { width, height } = DIMENSIONS[level - 1];
  const pickupCount = PICKUP_COUNTS[level - 1];
  const question: RouteQuestion = {
    kind: 'route',
    width,
    height,
    start: { x: 0, y: height - 1 },
    exit: { x: width - 1, y: 0 },
    pickups: Array.from({ length: pickupCount }, (_, index) => ({
      x: index + 1,
      y: height - 1,
    })),
    blocked: [],
    optimalMoves: 0,
  };
  return { ...question, optimalMoves: routeOptimalMoves(question) };
}

/** Random layouts are emitted only after a state-space solver proves every pickup and exit reachable. */
export function generateRouteQuestion(level: number, rng: Random): RouteQuestion {
  const safeLevel = Math.max(1, Math.min(5, Math.floor(level)));
  for (let attempt = 0; attempt < 40; attempt++) {
    const question = createCandidate(safeLevel, rng);
    const optimalMoves = routeOptimalMoves(question);
    if (optimalMoves > 0) return { ...question, optimalMoves };
  }
  const fallback = createFallback(safeLevel);
  if (fallback.optimalMoves <= 0) throw new Error('Route fallback invariant failed');
  return fallback;
}

/** Completion points dominate; route efficiency is bounded and independent of elapsed time. */
export function scoreRoute(level: number, optimalMoves: number, actualMoves: number): number {
  const boundedLevel = Math.max(1, Math.min(5, level));
  const efficiency = Math.max(
    0.25,
    Math.min(1, optimalMoves / Math.max(optimalMoves, actualMoves)),
  );
  return Math.round((100 + efficiency * 50) * boundedLevel);
}
