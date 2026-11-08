import type { Random } from './engine';

export const FOCUS_DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type FocusDirection = (typeof FOCUS_DIRECTIONS)[number];
export type FocusMajority = 'matching' | 'conflicting';

export interface FocusNeighbor {
  direction: FocusDirection;
  slot: number;
}

export interface FocusQuestion {
  kind: 'focus';
  centerDirection: FocusDirection;
  neighbors: FocusNeighbor[];
  controls: readonly FocusDirection[];
  answer: number;
  availableDirections: number;
  majority: FocusMajority;
}

const NEIGHBOR_COUNTS = [4, 6, 8, 10, 12] as const;
const MAJORITY_COUNTS = [3, 4, 5, 6, 7] as const;
const SLOT_COUNT = 12;

function shuffledSlots(rng: Random): number[] {
  const slots = Array.from({ length: SLOT_COUNT }, (_, slot) => slot);
  for (let index = slots.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
  }
  return slots;
}

function pickDirection(directions: readonly FocusDirection[], rng: Random): FocusDirection {
  return directions[Math.floor(rng() * directions.length)];
}

/**
 * The center is the instruction while neighbors are interference. Trials alternate between
 * neighbor majorities that agree and disagree with the center so neither is a reliable shortcut.
 */
export function generateFocusQuestion(level: number, rng: Random): FocusQuestion {
  const safeLevel = Math.max(1, Math.min(5, Math.floor(level)));
  const availableDirections = safeLevel === 1 ? 2 : 4;
  const directions = FOCUS_DIRECTIONS.slice(0, availableDirections);
  const centerDirection = pickDirection(directions, rng);
  const conflicting = rng() < 0.5;
  const otherDirections = directions.filter((direction) => direction !== centerDirection);
  const majorityDirection = conflicting
    ? otherDirections[Math.floor(rng() * otherDirections.length)]
    : centerDirection;
  const neighborCount = NEIGHBOR_COUNTS[safeLevel - 1];
  const majorityCount = MAJORITY_COUNTS[safeLevel - 1];
  const neighborDirections = Array.from({ length: majorityCount }, () => majorityDirection);

  while (neighborDirections.length < neighborCount) {
    const direction = pickDirection(directions, rng);
    neighborDirections.push(direction);
  }

  const neighbors = shuffledSlots(rng)
    .slice(0, neighborCount)
    .map((slot, index) => ({ slot, direction: neighborDirections[index] }));

  const controls = FOCUS_DIRECTIONS;
  return {
    kind: 'focus',
    centerDirection,
    neighbors,
    controls,
    answer: controls.indexOf(centerDirection),
    availableDirections,
    majority: conflicting ? 'conflicting' : 'matching',
  };
}
