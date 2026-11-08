import { ArrowRight, Check, Hand, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { GameId } from '../domain/types';
import { Modal } from '../components/Modal';
import { FocusBoard } from './FocusBoard';
import { RouteBoard } from './RouteBoard';
import { FitBoard } from './FitBoard';
import { createFitPracticeQuestion } from './fit';
import type { FocusQuestion } from './focus';
import type { RouteQuestion } from './route';

const FOCUS_PRACTICE: FocusQuestion[] = [
  {
    kind: 'focus',
    centerDirection: 'up',
    neighbors: [
      { direction: 'up', slot: 0 },
      { direction: 'left', slot: 2 },
      { direction: 'up', slot: 5 },
      { direction: 'right', slot: 8 },
    ],
    controls: ['up', 'right', 'down', 'left'],
    answer: 0,
    availableDirections: 4,
    majority: 'matching',
  },
  {
    kind: 'focus',
    centerDirection: 'right',
    neighbors: [
      { direction: 'left', slot: 0 },
      { direction: 'left', slot: 2 },
      { direction: 'left', slot: 5 },
      { direction: 'right', slot: 8 },
      { direction: 'up', slot: 10 },
    ],
    controls: ['up', 'right', 'down', 'left'],
    answer: 1,
    availableDirections: 4,
    majority: 'conflicting',
  },
];

const ROUTE_PRACTICE: RouteQuestion = {
  kind: 'route',
  width: 3,
  height: 3,
  start: { x: 0, y: 2 },
  exit: { x: 2, y: 0 },
  pickups: [{ x: 1, y: 2 }],
  blocked: [{ x: 1, y: 1 }],
  optimalMoves: 4,
};

const FIT_PRACTICE = [
  createFitPracticeQuestion('rotate'),
  createFitPracticeQuestion('reflect'),
] as const;

export function ExpansionPractice({
  gameId,
  onClose,
  onPlay,
}: {
  gameId: Extract<GameId, 'focus' | 'route' | 'fit'>;
  onClose: () => void;
  onPlay: () => void;
}) {
  const [step, setStep] = useState(0);
  const [solved, setSolved] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);
  const steps = gameId === 'focus' ? 2 : gameId === 'fit' ? 2 : 1;

  function nextStep() {
    if (step + 1 >= steps) {
      onPlay();
      return;
    }
    setStep(step + 1);
    setSolved(false);
    setWrong(false);
    setPicked([]);
  }

  return (
    <Modal
      title="先试一试 · 不计分"
      onClose={onClose}
      className="practice-modal expansion-practice"
    >
      <div className="practice-goal-strip" role="img" aria-label="先看示范，再动手试，最后开始挑战">
        <Hand size={25} />
        <ArrowRight size={17} />
        <Check size={25} />
        <ArrowRight size={17} />
        <Play size={23} fill="currentColor" />
      </div>
      <div className={`game-board practice-board practice-${gameId}`}>
        {gameId === 'focus' && (
          <FocusBoard
            question={FOCUS_PRACTICE[step]}
            answering={!solved}
            picked={picked}
            showCorrection={wrong && !solved}
            onSelect={(index) => {
              if (solved) return;
              setPicked([index]);
              const correct = index === FOCUS_PRACTICE[step].answer;
              setWrong(!correct);
              setSolved(correct);
            }}
          />
        )}
        {gameId === 'route' && (
          <RouteBoard
            question={ROUTE_PRACTICE}
            answering={!solved}
            onResult={() => setSolved(true)}
          />
        )}
        {gameId === 'fit' && (
          <FitBoard
            key={`fit-practice-${step}`}
            question={FIT_PRACTICE[step]}
            answering={!solved}
            allowRetry
            onResult={(correct) => {
              setWrong(!correct);
              setSolved(correct);
            }}
          />
        )}
      </div>
      <div
        className={`practice-status ${wrong && !solved ? 'needs-correction' : ''}`}
        role="status"
      >
        {solved ? <Check size={30} /> : wrong ? <RotateCcw size={25} /> : <Hand size={29} />}
        <span className="reader-help">
          {solved ? '对啦！' : wrong ? '看看正确图形，再试一次' : '跟着图示做一做'}
        </span>
        {gameId === 'focus' && step === 0 && <span className="practice-mode-dot match" />}
        {gameId === 'focus' && step === 1 && <span className="practice-mode-dot conflict" />}
        {gameId === 'fit' && step === 0 && <span className="practice-transform-cue rotate-cue" />}
        {gameId === 'fit' && step === 1 && <span className="practice-transform-cue reflect-cue" />}
      </div>
      {solved && (
        <button
          className="primary-button full-width"
          aria-label={step + 1 >= steps ? '开始挑战' : '下一步'}
          onClick={nextStep}
        >
          {step + 1 >= steps ? <Play fill="currentColor" size={23} /> : <ArrowRight size={23} />}
          <span className="reader-help">{step + 1 >= steps ? '开始挑战' : '下一步'}</span>
        </button>
      )}
      <div className="practice-progress" role="img" aria-label={`${step + 1}/${steps}`}>
        {Array.from({ length: steps }, (_, index) => (
          <i key={index} className={index <= step ? 'done' : ''} />
        ))}
      </div>
    </Modal>
  );
}
