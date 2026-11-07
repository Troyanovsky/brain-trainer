import { expect, it } from 'vitest';
import { generateQuestion } from '../src/games/engine';
import { createProfile } from '../src/domain/storage';
import { getLevel } from '../src/domain/training';

it('replaces word Stroop with a visible color target and a same-shape distractor', () => {
  const question = generateQuestion('stroop', 4, () => 0.4);
  expect(question.kind).toBe('color');
  if (question.kind !== 'color') return;
  const q = question;
  expect(q.options[q.answer].color).toBe(q.target.color);
  expect(q.options[q.answer].shape).not.toBe(q.target.shape);
  expect(q.options.some((option, i) => i !== q.answer && option.shape === q.target.shape)).toBe(
    true,
  );
});
it('presents quantity tasks as bounded pictorial data, not word or digit prompts', () => {
  for (const id of ['numbers', 'compare', 'math'] as const) {
    for (let level = 1; level <= 5; level++) {
      const q = generateQuestion(id, level);
      expect(q.kind).toBe('choice');
      if (q.kind !== 'choice') continue;
      expect(q.presentation).toBe(`quantity-${id === 'numbers' ? 'pattern' : id}`);
      expect(q.prompt).toBe('');
      expect(q.options.every((value: string) => Number(value) >= 0 && Number(value) <= 16)).toBe(
        true,
      );
    }
  }
});
it('keeps legacy records but starts new mechanics at a fresh difficulty', () => {
  const profile = createProfile('花朵');
  profile.history.push({
    id: 'legacy',
    gameId: 'stroop',
    level: 5,
    score: 4000,
    correct: 6,
    rounds: 6,
    completedAt: new Date().toISOString(),
    duration: 5000,
    mode: 'free',
  });
  expect(getLevel(profile, 'stroop')).toBe(1);
  expect(profile.history).toHaveLength(1);
});

it('restores both legacy and current records but computes new bests only from current mechanics', async () => {
  const { createStore, parseStore } = await import('../src/domain/storage');
  const { getGameResults } = await import('../src/domain/training');
  const store = createStore();
  const base = {
    gameId: 'math' as const,
    level: 5,
    score: 5000,
    correct: 6,
    rounds: 6,
    completedAt: new Date().toISOString(),
    duration: 8000,
    mode: 'free' as const,
  };
  store.profiles[0].history = [
    { ...base, id: 'old' },
    { ...base, id: 'new', rulesVersion: 2, level: 1, score: 600 },
  ];
  const profile = parseStore(JSON.stringify(store)).store.profiles[0];
  expect(profile.history).toHaveLength(2);
  expect(getGameResults(profile, 'math').map((record) => record.score)).toEqual([600]);
  expect(getLevel(profile, 'math')).toBe(2);
});

it('adds a color choice at each difficulty instead of keeping early levels identical', () => {
  for (let level = 1; level <= 5; level++) {
    const question = generateQuestion('stroop', level);
    expect(question.kind).toBe('color');
    if (question.kind === 'color') expect(question.options).toHaveLength(level + 1);
  }
});
