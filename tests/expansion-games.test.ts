import { describe, expect, it } from 'vitest';
import { fitDimensions, normalizeCells, orientationSet, orientCells } from '../src/games/fit';
import { generateQuestion } from '../src/games/engine';
import {
  generateRouteQuestion,
  isAdjacent,
  pointKey,
  routeOptimalMoves,
  scoreRoute,
  type RouteQuestion,
} from '../src/games/route';

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function connected(cells: { x: number; y: number }[]): boolean {
  const remaining = new Set(cells.map(pointKey));
  const queue = [cells[0]];
  remaining.delete(pointKey(cells[0]));
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const next of queue[cursor] ? cells : []) {
      if (!remaining.has(pointKey(next)) || !isAdjacent(queue[cursor], next)) continue;
      remaining.delete(pointKey(next));
      queue.push(next);
    }
  }
  return remaining.size === 0;
}

function referenceRouteOptimum(question: RouteQuestion): number {
  const pickupIndex = new Map(question.pickups.map((point, index) => [pointKey(point), index]));
  const allCollected = (1 << question.pickups.length) - 1;
  const stateCount = question.width * question.height * (allCollected + 1);
  const distance = new Map<string, number>([[`${question.start.x}:${question.start.y}:0`, 0]]);
  const blocked = new Set(question.blocked.map(pointKey));

  for (let pass = 0; pass < stateCount; pass++) {
    let changed = false;
    for (const [key, currentDistance] of [...distance]) {
      const [x, y, maskText] = key.split(':').map(Number);
      const point = { x, y };
      for (const direction of ['up', 'right', 'down', 'left'] as const) {
        const next =
          direction === 'up'
            ? { x, y: y - 1 }
            : direction === 'right'
              ? { x: x + 1, y }
              : direction === 'down'
                ? { x, y: y + 1 }
                : { x: x - 1, y };
        if (
          next.x < 0 ||
          next.y < 0 ||
          next.x >= question.width ||
          next.y >= question.height ||
          blocked.has(pointKey(next)) ||
          (samePoint(next, question.exit) && maskText !== allCollected)
        )
          continue;
        const pickup = pickupIndex.get(pointKey(next));
        const mask = pickup === undefined ? maskText : maskText | (1 << pickup);
        const nextKey = `${next.x}:${next.y}:${mask}`;
        const nextDistance = currentDistance + 1;
        if (nextDistance >= (distance.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
        distance.set(nextKey, nextDistance);
        changed = true;
      }
      void point;
    }
    if (!changed) break;
  }
  return distance.get(`${question.exit.x}:${question.exit.y}:${allCollected}`) ?? -1;
}

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x === right.x && left.y === right.y;
}

function legalRouteCompletion(question: RouteQuestion, path: { x: number; y: number }[]) {
  if (!samePoint(path[0], question.start) || !samePoint(path.at(-1)!, question.exit)) return false;
  const blocked = new Set(question.blocked.map(pointKey));
  const collected = new Set<string>();
  for (let index = 0; index < path.length; index++) {
    const point = path[index];
    if (blocked.has(pointKey(point))) return false;
    if (index > 0 && !isAdjacent(path[index - 1], point)) return false;
    if (question.pickups.some((pickup) => samePoint(pickup, point))) collected.add(pointKey(point));
    if (samePoint(point, question.exit)) {
      return index === path.length - 1 && collected.size === question.pickups.length;
    }
  }
  return false;
}

describe('central direction generator', () => {
  it('is determinate and balanced across five levels and 100 seeds', () => {
    for (let level = 1; level <= 5; level++) {
      const majorities = new Set<string>();
      for (let seed = 0; seed < 100; seed++) {
        const question = generateQuestion('focus', level, random(seed));
        expect(question.kind).toBe('focus');
        if (question.kind !== 'focus') continue;
        expect(question.controls).toHaveLength(4);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.controls.length);
        expect(question.controls[question.answer]).toBe(question.centerDirection);
        expect(new Set(question.neighbors.map((neighbor) => neighbor.slot)).size).toBe(
          question.neighbors.length,
        );
        expect(question.neighbors).toHaveLength([4, 6, 8, 10, 12][level - 1]);
        expect(question.availableDirections).toBe(level === 1 ? 2 : 4);
        const allowed = question.controls.slice(0, question.availableDirections);
        question.neighbors.forEach((neighbor) => expect(allowed).toContain(neighbor.direction));
        majorities.add(question.majority);
      }
      expect(majorities).toEqual(new Set(['matching', 'conflicting']));
    }
  });
});

describe('route generator and solver', () => {
  it('emits bounded, connected-state solvable boards over five levels and 100 seeds', () => {
    for (let level = 1; level <= 5; level++) {
      for (let seed = 0; seed < 100; seed++) {
        const question = generateQuestion('route', level, random(seed));
        expect(question.kind).toBe('route');
        if (question.kind !== 'route') continue;
        const points = [question.start, question.exit, ...question.pickups, ...question.blocked];
        points.forEach((point) => {
          expect(Number.isInteger(point.x)).toBe(true);
          expect(Number.isInteger(point.y)).toBe(true);
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThan(question.width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThan(question.height);
        });
        expect(new Set(question.pickups.map(pointKey)).size).toBe(question.pickups.length);
        expect(new Set(question.blocked.map(pointKey)).size).toBe(question.blocked.length);
        const reserved = new Set(
          [question.start, question.exit, ...question.pickups].map(pointKey),
        );
        question.blocked.forEach((point) => expect(reserved.has(pointKey(point))).toBe(false));
        expect(question.optimalMoves).toBeGreaterThan(0);
        expect(referenceRouteOptimum(question)).toBe(question.optimalMoves);
      }
    }
  });

  it('uses observable deterministic fallbacks for known unsolvable constant RNGs', () => {
    const provokingValues = [0.185, 0.185, 0.115, 0.04, 0.03];
    for (let level = 1; level <= 5; level++) {
      let calls = 0;
      const question = generateRouteQuestion(level, () => {
        calls++;
        return provokingValues[level - 1];
      });
      expect(calls).toBeGreaterThan(800);
      expect(question.blocked).toEqual([]);
      expect(question.optimalMoves).toBeGreaterThan(0);
      expect(referenceRouteOptimum(question)).toBe(question.optimalMoves);
    }
  });

  it('accepts a longer legal completion instead of requiring one stored optimum path', () => {
    const question: RouteQuestion = {
      kind: 'route',
      width: 3,
      height: 3,
      start: { x: 0, y: 2 },
      exit: { x: 2, y: 0 },
      pickups: [{ x: 1, y: 2 }],
      blocked: [{ x: 1, y: 1 }],
      optimalMoves: 4,
    };
    const alternate = [
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ];
    expect(alternate.length - 1).toBeGreaterThan(referenceRouteOptimum(question));
    expect(legalRouteCompletion(question, alternate)).toBe(true);
    expect(scoreRoute(1, question.optimalMoves, alternate.length - 1)).toBeGreaterThan(0);
  });

  it('scores completion independently of speed with bounded efficiency', () => {
    expect(scoreRoute(3, 5, 5)).toBe(450);
    expect(scoreRoute(3, 5, 200)).toBe(338);
    expect(scoreRoute(3, 5, 200)).toBeGreaterThan(0);
  });
});

describe('fitting generator and solver', () => {
  it('has one transform-equivalent answer and connected pieces over five levels and 100 seeds', () => {
    for (let level = 1; level <= 5; level++) {
      for (let seed = 0; seed < 100; seed++) {
        const question = generateQuestion('fit', level, random(seed));
        expect(question.kind).toBe('fit');
        if (question.kind !== 'fit') continue;
        const answer = question.pieces[question.answer];
        expect(
          orientCells(answer.cells, question.requiredRotation, question.requiredReflection),
        ).toEqual(normalizeCells(question.targetCells));
        const matching = question.pieces.filter((piece) =>
          orientationSet(piece.cells).has(
            question.targetCells.map((cell) => `${cell.x},${cell.y}`).join(';'),
          ),
        );
        expect(matching).toHaveLength(1);
        expect(question.pieces).toHaveLength([2, 3, 3, 4, 4][level - 1]);
        question.pieces.forEach((piece) => expect(connected(piece.cells)).toBe(true));
        const dimensions = fitDimensions(question.targetCells);
        expect(dimensions.rows).toBe(question.rows);
        expect(dimensions.columns).toBe(question.columns);
        if (level === 1) {
          expect(question.requiredRotation).toBe(0);
          expect(question.requiredReflection).toBe(false);
        }
      }
    }
  });
});
