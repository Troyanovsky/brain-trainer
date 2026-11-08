import type { GameId } from '../domain/types';
import { generateFitQuestion, type FitQuestion } from './fit';
import { generateFocusQuestion, type FocusQuestion } from './focus';
import { generateRouteQuestion, type RouteQuestion } from './route';

export type { FitQuestion } from './fit';
export type { FocusDirection, FocusNeighbor, FocusQuestion } from './focus';
export type { RoutePoint, RouteQuestion } from './route';
export type Random = () => number;
export const SHAPES = ['circle', 'triangle', 'square', 'star', 'diamond'] as const;
export const COLOR_OPTIONS = [
  { label: '红色', color: '#C95053' },
  { label: '蓝色', color: '#4276AD' },
  { label: '绿色', color: '#397B56' },
  { label: '紫色', color: '#805BA5' },
  { label: '橙色', color: '#A65B21' },
  { label: '青色', color: '#237D81' },
];
export interface VisualToken {
  shape: string;
  color: string;
}
export type Question =
  | FocusQuestion
  | RouteQuestion
  | FitQuestion
  | { kind: 'color'; target: VisualToken; options: VisualToken[]; answer: number }
  | { kind: 'tiles'; size: number; targets: number[] }
  | { kind: 'sequence'; sequence: number[] }
  | { kind: 'odd'; size: number; answer: number; rotation: number; base: string; odd: string }
  | { kind: 'schulte'; size: number; values: number[] }
  | {
      kind: 'choice';
      game: GameId;
      prompt: string;
      options: string[];
      answer: number;
      pattern?: string[];
      reverse?: boolean;
      presentation?: 'quantity-pattern' | 'quantity-compare' | 'quantity-math';
      quantities?: number[];
      groups?: number[];
      removed?: number;
    };
const int = (max: number, rng: Random) => Math.floor(rng() * max);
export function shuffle<T>(values: T[], rng: Random = Math.random): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = int(i + 1, rng);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const MAX_DOTS = 16;
function quantityOptions(answer: number, rng: Random): { options: string[]; answer: number } {
  const candidates = shuffle([-1, 1, -2, 2, -3, 3], rng)
    .map((offset) => answer + offset)
    .filter((value) => value >= 0 && value <= MAX_DOTS);
  const values = [
    ...new Set([answer, ...candidates, ...Array.from({ length: MAX_DOTS + 1 }, (_, i) => i)]),
  ].slice(0, 4);
  const options = shuffle(values.map(String), rng);
  return { options, answer: options.indexOf(String(answer)) };
}
/** Each generator owns its game rules; the player only interprets the returned board. */
export function generateQuestion(
  game: GameId,
  requestedLevel: number,
  rng: Random = Math.random,
): Question {
  const level = Math.max(1, Math.min(5, requestedLevel));
  if (game === 'focus') return generateFocusQuestion(level, rng);
  if (game === 'route') return generateRouteQuestion(level, rng);
  if (game === 'fit') return generateFitQuestion(level, rng);
  if (game === 'tiles') {
    const size = level < 3 ? 3 : level < 5 ? 4 : 5;
    return {
      kind: 'tiles',
      size,
      targets: shuffle(
        Array.from({ length: size * size }, (_, i) => i),
        rng,
      ).slice(0, level + 1),
    };
  }
  if (game === 'sequence')
    return { kind: 'sequence', sequence: Array.from({ length: level + 1 }, () => int(4, rng)) };
  if (game === 'odd')
    return {
      kind: 'odd',
      size: level < 3 ? 3 : level < 5 ? 4 : 5,
      answer: int((level < 3 ? 3 : level < 5 ? 4 : 5) ** 2, rng),
      rotation: level >= 3 ? 90 : 0,
      base: level >= 3 ? 'leaf' : 'circle',
      odd: level >= 3 ? 'leaf' : 'diamond',
    };
  if (game === 'schulte') {
    const size = level < 2 ? 2 : level < 4 ? 3 : 4;
    return {
      kind: 'schulte',
      size,
      values: shuffle(
        Array.from({ length: size * size }, (_, i) => i + 1),
        rng,
      ),
    };
  }
  if (game === 'pattern') {
    const pattern = shuffle([...SHAPES], rng).slice(0, Math.min(5, level + 1));
    const length = pattern.length * 2;
    const sequence = Array.from({ length }, (_, i) => pattern[i % pattern.length]);
    const options = shuffle(
      [...new Set([...pattern, ...SHAPES])].slice(0, Math.max(3, pattern.length)),
      rng,
    );
    return {
      kind: 'choice',
      game,
      prompt: '下一块是什么？',
      pattern: sequence,
      options,
      answer: options.indexOf(pattern[length % pattern.length]),
    };
  }
  if (game === 'numbers') {
    const gap = level === 2 || level === 3 ? 2 : 1;
    const start = level === 3 ? 10 + int(4, rng) : level === 5 ? 11 + int(4, rng) : 1 + int(3, rng);
    const values = [start];
    for (let i = 1; i <= 4; i++) {
      const step = level >= 4 ? i : gap;
      values.push(values[i - 1] + (level === 3 || level === 5 ? -step : step));
    }
    return {
      kind: 'choice',
      game,
      prompt: '',
      presentation: 'quantity-pattern',
      quantities: values.slice(0, 4),
      ...quantityOptions(values[4], rng),
    };
  }
  if (game === 'stroop') {
    const palette = COLOR_OPTIONS.slice(0, level + 1);
    const target = {
      color: palette[int(palette.length, rng)].color,
      shape: SHAPES[int(SHAPES.length, rng)],
    };
    const colors = shuffle(palette, rng);
    const answer = colors.findIndex((color) => color.color === target.color);
    const sameShapeDistractor = (answer + 1) % colors.length;
    const options = colors.map((color, index) => ({
      color: color.color,
      shape:
        index === sameShapeDistractor
          ? target.shape
          : SHAPES[
              (SHAPES.indexOf(target.shape) + 1 + int(SHAPES.length - 1, rng)) % SHAPES.length
            ],
    }));
    return { kind: 'color', target, options, answer };
  }
  if (game === 'compare') {
    const smaller = 2 + int(level * 2 + 1, rng);
    const larger = smaller + Math.max(1, 5 - level);
    const options = shuffle([String(smaller), String(larger)], rng);
    return {
      kind: 'choice',
      game,
      prompt: '',
      presentation: 'quantity-compare',
      options,
      answer: options.indexOf(String(larger)),
    };
  }
  if (game === 'math') {
    const groupCount = level >= 4 ? 3 : level === 3 ? 1 : 2;
    const groups = Array.from({ length: groupCount }, () =>
      level === 3 ? 7 + int(4, rng) : 1 + int(level === 1 ? 3 : 4, rng),
    );
    const removed = level === 3 ? 1 + int(4, rng) : level === 5 ? 1 + int(groups.at(-1)!, rng) : 0;
    const answer = groups.reduce((sum, count) => sum + count, 0) - removed;
    return {
      kind: 'choice',
      game,
      prompt: '',
      presentation: 'quantity-math',
      groups,
      removed,
      ...quantityOptions(answer, rng),
    };
  }
  const arrows =
    level >= 5
      ? ['←', '→', '↑', '↓', '↖', '↘', '↗', '↙']
      : level >= 3
        ? ['←', '→', '↑', '↓']
        : ['←', '→'];
  const arrow = int(arrows.length, rng);
  const reverse = level > 1 && rng() < 0.65;
  const options = level >= 4 ? shuffle(arrows, rng) : arrows;
  return {
    kind: 'choice',
    game: 'flip',
    prompt: arrows[arrow],
    options,
    answer: options.indexOf(arrows[reverse ? arrow ^ 1 : arrow]),
    reverse,
  };
}
