import {
  ArrowRight,
  Check,
  DoorOpen,
  Eye,
  FlipHorizontal2,
  Hand,
  Package,
  Play,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { useState } from 'react';
import type { GameId } from '../domain/types';
import { Shape } from '../components/Artwork';
import { Modal } from '../components/Modal';
import { GameBoard } from './GameBoard';
import { PipGroup, RuleBadge, TrackingGlyph, GameCue } from './Visuals';
import type { Question } from './engine';
import { DirectionArrow } from './FocusBoard';
import { createFitPracticeQuestion, fitDimensions } from './fit';

const EXAMPLES: Partial<Record<GameId, Question>> = {
  pattern: {
    kind: 'choice',
    game: 'pattern',
    prompt: '',
    pattern: ['circle', 'triangle', 'circle', 'triangle'],
    options: ['circle', 'triangle', 'square'],
    answer: 0,
  },
  numbers: {
    kind: 'choice',
    game: 'numbers',
    prompt: '',
    presentation: 'quantity-pattern',
    quantities: [1, 2, 3, 4],
    options: ['5', '3', '2', '6'],
    answer: 0,
  },
  odd: { kind: 'odd', size: 3, answer: 4, base: 'circle', odd: 'diamond', rotation: 0 },
  stroop: {
    kind: 'color',
    target: { shape: 'star', color: '#397B56' },
    options: [
      { shape: 'circle', color: '#397B56' },
      { shape: 'star', color: '#C95053' },
    ],
    answer: 0,
  },
  compare: {
    kind: 'choice',
    game: 'compare',
    prompt: '',
    presentation: 'quantity-compare',
    options: ['2', '5'],
    answer: 1,
  },
  math: {
    kind: 'choice',
    game: 'math',
    prompt: '',
    presentation: 'quantity-math',
    groups: [2, 3],
    removed: 0,
    options: ['5', '2', '3', '6'],
    answer: 0,
  },
  schulte: { kind: 'schulte', size: 2, values: [2, 1, 3, 4] },
};
/** A solved picture example, rather than a decorative cover or written rule. */
export function GameDemo({ gameId }: { gameId: GameId }) {
  const example = EXAMPLES[gameId];
  return (
    <figure
      className={`game-demo demo-${gameId}`}
      aria-label="图形示范：看目标，跟手指选择，再收获勾号"
    >
      <div className="demo-flow" aria-hidden="true">
        <Eye />
        <ArrowRight />
        <Hand />
        <ArrowRight />
        <Check />
      </div>
      {gameId === 'flip' ? (
        <div className="direction-examples">
          {[false, true].map((reverse) => (
            <div key={String(reverse)}>
              <RuleBadge reverse={reverse} />
              <b>←</b>
              <ArrowRight size={20} />
              <span className="example-answer">
                {reverse ? '→' : '←'}
                <Hand size={23} />
              </span>
              <Check size={21} />
            </div>
          ))}
        </div>
      ) : gameId === 'tiles' ? (
        <div className="memory-example">
          <div className="example-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={[0, 4, 7].includes(i) ? 'lit' : ''} />
            ))}
          </div>
          <ArrowRight />
          <div className="example-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={[0, 4, 7].includes(i) ? 'chosen' : ''}>
                {i === 4 && <Hand size={25} />}
              </i>
            ))}
          </div>
        </div>
      ) : gameId === 'sequence' ? (
        <div className="sequence-example">
          <div>
            {['circle', 'triangle', 'star'].map((shape, i) => (
              <span key={shape}>
                <Shape name={shape} />
                {i < 2 && <ArrowRight size={16} />}
              </span>
            ))}
          </div>
          <div>
            {['circle', 'triangle', 'star'].map((shape) => (
              <span key={shape} className="example-answer">
                <Shape name={shape} />
                <Hand size={19} />
              </span>
            ))}
          </div>
        </div>
      ) : gameId === 'focus' ? (
        <div className="focus-demo-example">
          <div className="focus-demo-scene" aria-hidden="true">
            <span className="demo-pointer demo-pointer-a">
              <DirectionArrow direction="left" />
            </span>
            <span className="demo-pointer demo-pointer-b">
              <DirectionArrow direction="up" />
            </span>
            <span className="demo-pointer demo-pointer-c">
              <DirectionArrow direction="right" />
            </span>
            <span className="demo-center-pointer">
              <DirectionArrow direction="up" />
            </span>
          </div>
          <ArrowRight size={20} />
          <span className="focus-demo-answer">
            <DirectionArrow direction="up" />
            <Hand size={23} />
          </span>
          <Check size={23} />
        </div>
      ) : gameId === 'route' ? (
        <div className="route-demo-example" aria-label="方格示范：拿到包裹，沿通路走到出口">
          <div className="route-demo-grid" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (
              <i
                key={index}
                className={[
                  index === 2 ? 'demo-route-block' : '',
                  [3, 5, 6, 7, 8].includes(index) ? 'demo-route-trail' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {index === 8 ? <Package /> : index === 5 ? <DoorOpen /> : null}
                {index === 3 && <span className="demo-route-walker" />}
                {index === 3 && <DirectionArrow direction="down" />}
                {index === 6 && (
                  <>
                    <DirectionArrow direction="right" />
                    <Hand className="demo-route-hand" />
                  </>
                )}
                {index === 7 && <DirectionArrow direction="right" />}
                {index === 8 && <DirectionArrow direction="up" />}
              </i>
            ))}
          </div>
          <ArrowRight size={20} />
          <span className="route-demo-slots" aria-hidden="true">
            <Package />
            <Check />
          </span>
          <Check size={23} />
        </div>
      ) : gameId === 'fit' ? (
        <FitDemo />
      ) : example ? (
        <>
          <div className="demo-board">
            {gameId === 'schulte' && (
              <div className="demo-tracking-target">
                <TrackingGlyph value={1} />
                <ArrowRight size={17} />
              </div>
            )}
            <GameBoard
              question={example}
              gameId={gameId}
              phase="feedback"
              picked={['odd'].includes(gameId) ? [4] : []}
              activeSequence={-1}
              sequenceCount={0}
              nextNumber={1}
              wrongCell={-1}
              example
              onSelect={() => {}}
            />
          </div>
        </>
      ) : null}
      {gameId === 'math' && (
        <div className="removal-example" role="img" aria-label="六个圆点划掉两个，剩下四个">
          <PipGroup count={6} removed={2} />
          <ArrowRight size={20} />
          <span className="remaining-pile">
            <PipGroup count={4} />
          </span>
          <Check size={22} />
        </div>
      )}
    </figure>
  );
}

function FitDemo() {
  const rotation = createFitPracticeQuestion('rotate');
  const reflection = createFitPracticeQuestion('reflect');
  return (
    <div className="fit-demo-example">
      <div className="fit-demo-step" aria-label="旋转拼块后放进空位">
        <DemoGridPiece cells={rotation.pieces[rotation.answer].cells} />
        <span>
          <RotateCw size={22} />
          <Hand size={22} />
        </span>
        <DemoGridPiece cells={rotation.targetCells} />
        <Check size={21} />
      </div>
      <div className="fit-demo-step" aria-label="翻面拼块后放进空位">
        <DemoGridPiece cells={reflection.pieces[reflection.answer].cells} />
        <span>
          <FlipHorizontal2 size={22} />
          <Hand size={22} />
        </span>
        <DemoGridPiece cells={reflection.targetCells} />
        <Check size={21} />
      </div>
    </div>
  );
}

function DemoGridPiece({ cells }: { cells: { x: number; y: number }[] }) {
  const dimensions = fitDimensions(cells);
  const filled = new Set(cells.map((cell) => `${cell.x}:${cell.y}`));
  return (
    <span
      className="demo-grid-piece"
      style={{ gridTemplateColumns: `repeat(${dimensions.columns}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: dimensions.rows * dimensions.columns }, (_, index) => {
        const x = index % dimensions.columns;
        const y = Math.floor(index / dimensions.columns);
        return (
          <i
            key={index}
            className={filled.has(`${x}:${y}`) ? 'filled' : ''}
            data-cell-x={filled.has(`${x}:${y}`) ? x : undefined}
            data-cell-y={filled.has(`${x}:${y}`) ? y : undefined}
          />
        );
      })}
    </span>
  );
}

const PRACTICE: Record<'flip' | 'stroop', Question[]> = {
  flip: [
    { kind: 'choice', game: 'flip', prompt: '←', options: ['←', '→'], answer: 0, reverse: false },
    { kind: 'choice', game: 'flip', prompt: '←', options: ['←', '→'], answer: 1, reverse: true },
  ],
  stroop: [
    EXAMPLES.stroop!,
    {
      kind: 'color',
      target: { shape: 'triangle', color: '#4276AD' },
      options: [
        { shape: 'triangle', color: '#A65B21' },
        { shape: 'square', color: '#4276AD' },
      ],
      answer: 1,
    },
  ],
};
/** Correctable, unscored rehearsal. It never touches profile history or adaptive difficulty. */
export function GuidedPractice({
  gameId,
  onClose,
  onPlay,
}: {
  gameId: 'flip' | 'stroop';
  onClose: () => void;
  onPlay: () => void;
}) {
  const [step, setStep] = useState(0),
    [picked, setPicked] = useState<number[]>([]),
    [solved, setSolved] = useState(false);
  const question = PRACTICE[gameId][step];
  const wrong = picked.length > 0 && !solved;
  return (
    <Modal title="先试一试 · 不计分" onClose={onClose} className="practice-modal">
      <GameCue question={question} preview={false} nextNumber={1} />
      <div className={`game-board practice-board ${solved ? 'board-correct' : ''}`}>
        <GameBoard
          question={question}
          gameId={gameId}
          phase={solved ? 'feedback' : 'answer'}
          picked={picked}
          activeSequence={-1}
          sequenceCount={0}
          nextNumber={1}
          wrongCell={-1}
          onSelect={(index) => {
            if (solved) return;
            setPicked([index]);
            setSolved(index === ('answer' in question ? question.answer : 0));
          }}
        />
      </div>
      <div className="practice-status" role="status">
        {solved ? (
          <Check size={30} />
        ) : wrong ? (
          <>
            <RotateCcw size={25} />
            <Hand size={25} />
            {question.kind === 'color' ? (
              <Shape
                name={question.options[question.answer].shape}
                color={question.options[question.answer].color}
              />
            ) : question.kind === 'choice' ? (
              <b>{question.options[question.answer]}</b>
            ) : null}
          </>
        ) : (
          <Hand size={29} />
        )}
        <span className="reader-help">
          {solved ? '对啦！' : wrong ? '再点一次，看看这个图形' : '跟着图示点一点'}
        </span>
      </div>
      {solved && (
        <button
          className="primary-button full-width"
          aria-label={step === PRACTICE[gameId].length - 1 ? '开始挑战' : '下一步'}
          onClick={() => {
            if (step === PRACTICE[gameId].length - 1) {
              onPlay();
              return;
            }
            setStep(step + 1);
            setPicked([]);
            setSolved(false);
          }}
        >
          <Play fill="currentColor" size={23} />
          <span className="reader-help">
            {step === PRACTICE[gameId].length - 1 ? '开始挑战' : '下一步'}
          </span>
        </button>
      )}
      <div
        className="practice-progress"
        role="img"
        aria-label={`${step + 1}/${PRACTICE[gameId].length}`}
      >
        {PRACTICE[gameId].map((_, i) => (
          <i key={i} className={i <= step ? 'done' : ''} />
        ))}
      </div>
    </Modal>
  );
}
