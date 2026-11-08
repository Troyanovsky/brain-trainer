import { Check, Hand } from 'lucide-react';
import type { FocusDirection, FocusNeighbor, FocusQuestion } from './engine';

const SLOT_POSITIONS = [
  { x: 14, y: 10 },
  { x: 50, y: 9 },
  { x: 86, y: 10 },
  { x: 90, y: 37 },
  { x: 90, y: 67 },
  { x: 86, y: 90 },
  { x: 50, y: 90 },
  { x: 14, y: 90 },
  { x: 10, y: 67 },
  { x: 10, y: 37 },
  { x: 24, y: 56 },
  { x: 76, y: 56 },
] as const;

const DIRECTION_LABELS: Record<FocusDirection, string> = {
  up: '向上',
  right: '向右',
  down: '向下',
  left: '向左',
};

export function DirectionArrow({ direction }: { direction: FocusDirection }) {
  const rotations = { up: 0, right: 90, down: 180, left: 270 };
  return (
    <svg
      className="direction-arrow"
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ transform: `rotate(${rotations[direction]}deg)` }}
    >
      <path
        d="M16 26V6m-8 8 8-8 8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FocusMotif({
  direction,
  center = false,
}: {
  direction: FocusDirection;
  center?: boolean;
}) {
  return (
    <span className={`focus-motif ${center ? 'focus-center-motif' : ''}`}>
      <span className="focus-motif-shape" />
      <DirectionArrow direction={direction} />
    </span>
  );
}

function FocusNeighborToken({ neighbor }: { neighbor: FocusNeighbor }) {
  const position = SLOT_POSITIONS[neighbor.slot];
  return (
    <span
      className="focus-neighbor"
      style={
        { '--focus-x': `${position.x}%`, '--focus-y': `${position.y}%` } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <FocusMotif direction={neighbor.direction} />
    </span>
  );
}

export function FocusBoard({
  question,
  answering,
  picked,
  onSelect,
  showCorrection = false,
}: {
  question: FocusQuestion;
  answering: boolean;
  picked: number[];
  onSelect: (index: number) => void;
  showCorrection?: boolean;
}) {
  return (
    <div className="focus-board" data-testid="focus-trial">
      <div
        className="focus-scene"
        role="img"
        aria-label={`中央指针${DIRECTION_LABELS[question.centerDirection]}`}
      >
        {question.neighbors.map((neighbor, index) => (
          <FocusNeighborToken key={index} neighbor={neighbor} />
        ))}
        <span className="focus-anchor">
          <span className="focus-anchor-ring">
            <FocusMotif direction={question.centerDirection} center />
          </span>
        </span>
      </div>
      {showCorrection && (
        <div className="focus-correction" role="img" aria-label="跟着中央指针选择方向">
          <FocusMotif direction={question.centerDirection} />
          <Hand size={23} />
        </div>
      )}
      <div className="focus-controls" role="group" aria-label="方向选择">
        {question.controls.map((direction, index) => {
          const unavailable =
            ['up', 'right', 'down', 'left'].indexOf(direction) >= question.availableDirections;
          const correct = showCorrection && index === question.answer;
          return (
            <button
              key={direction}
              type="button"
              className={`focus-arrow focus-arrow-${direction} ${unavailable ? 'direction-unavailable' : ''} ${correct ? 'correction-target' : ''} ${picked.includes(index) && index !== question.answer ? 'wrong' : ''}`}
              data-testid={`focus-arrow-${direction}`}
              data-direction={direction}
              aria-label={DIRECTION_LABELS[direction]}
              disabled={!answering || unavailable}
              onClick={() => onSelect(index)}
            >
              <DirectionArrow direction={direction} />
              {correct && (
                <>
                  <Check className="focus-control-check" size={18} />
                  <Hand className="focus-answer-hand" size={23} />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
