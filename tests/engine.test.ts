import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/domain/catalog';
import { generateQuestion } from '../src/games/engine';
function random(seed: number) {
  let n = seed;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
const legacyGames = GAMES.filter((game) => !['focus', 'route', 'fit'].includes(game.id));

describe.each(legacyGames)('$name game generator', (game) => {
  it('has a solvable, unambiguous board at every level over 100 seeds', () => {
    for (let level = 1; level <= 5; level++)
      for (let seed = 0; seed < 100; seed++) {
        const q = generateQuestion(game.id, level, random(seed));
        if (q.kind === 'choice') {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          if (q.presentation) {
            expect(q.prompt).toBe('');
            expect(q.options.every((option) => Number(option) >= 0 && Number(option) <= 16)).toBe(
              true,
            );
          }
          if (game.id === 'math')
            expect(Number(q.options[q.answer])).toBe(
              q.groups!.reduce((sum, n) => sum + n, 0) - (q.removed ?? 0),
            );
          if (game.id === 'compare')
            expect(Number(q.options[q.answer])).toBeGreaterThan(Number(q.options[1 - q.answer]));
          if (game.id === 'flip') {
            const opposite: Record<string, string> = {
              '←': '→',
              '→': '←',
              '↑': '↓',
              '↓': '↑',
              '↖': '↘',
              '↘': '↖',
              '↗': '↙',
              '↙': '↗',
            };
            expect(q.options[q.answer]).toBe(q.reverse ? opposite[q.prompt] : q.prompt);
          }
          if (game.id === 'pattern') {
            const half = q.pattern!.length / 2;
            expect(q.pattern!.slice(0, half)).toEqual(q.pattern!.slice(half));
            expect(q.options[q.answer]).toBe(q.pattern![0]);
          }
          if (game.id === 'numbers') {
            const values = q.quantities!,
              gap = values[3] - values[2];
            expect(Number(q.options[q.answer])).toBe(
              values[3] + gap + (level === 4 ? 1 : level === 5 ? -1 : 0),
            );
          }
        } else if (q.kind === 'color') {
          expect(q.options[q.answer].color).toBe(q.target.color);
          expect(q.options[q.answer].shape).not.toBe(q.target.shape);
          expect(new Set(q.options.map((option) => option.color)).size).toBe(q.options.length);
          expect(
            q.options.some((option, i) => i !== q.answer && option.shape === q.target.shape),
          ).toBe(true);
        } else if (q.kind === 'tiles') {
          expect(new Set(q.targets).size).toBe(q.targets.length);
          expect(q.targets.length).toBe(level + 1);
          q.targets.forEach((i) => expect(i).toBeLessThan(q.size ** 2));
        } else if (q.kind === 'sequence') {
          expect(q.sequence).toHaveLength(level + 1);
          q.sequence.forEach((i) => expect(i).toBeLessThan(4));
        } else if (q.kind === 'schulte')
          expect([...q.values].sort((a, b) => a - b)).toEqual(
            Array.from({ length: q.size ** 2 }, (_, i) => i + 1),
          );
        else {
          expect(q.answer).toBeLessThan(q.size ** 2);
          expect(q.base !== q.odd || q.rotation !== 0).toBe(true);
        }
      }
  });
});

it('adds extra discrimination and directional complexity at the highest levels', () => {
  const colors = generateQuestion('stroop', 5, random(32));
  expect(colors.kind).toBe('color');
  if (colors.kind === 'color') expect(colors.options).toHaveLength(6);
  const directions = generateQuestion('flip', 5, random(48));
  expect(directions.kind).toBe('choice');
  if (directions.kind === 'choice') {
    expect(directions.options).toHaveLength(8);
    expect(directions.options).toContain('↖');
  }
});
