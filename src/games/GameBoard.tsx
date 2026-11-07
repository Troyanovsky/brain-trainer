import { Check, Star, X, Hand } from 'lucide-react';
import type { GameId } from '../domain/types';
import { getGame } from '../domain/catalog';
import { Shape } from '../components/Artwork';
import { COLOR_OPTIONS, SHAPES, type Question, type VisualToken } from './engine';
import { PipGroup, TrackingGlyph } from './Visuals';
const shapeNames = ['圆形', '三角形', '方形', '星形', '菱形'];
const directionNames: Record<string, string> = {
  '←': '向左',
  '→': '向右',
  '↑': '向上',
  '↓': '向下',
  '↖': '向左上',
  '↘': '向右下',
  '↗': '向右上',
  '↙': '向左下',
};
function describeColorToken(token: VisualToken): string {
  return `${COLOR_OPTIONS.find((color) => color.color === token.color)?.label ?? ''}${shapeNames[SHAPES.findIndex((shape) => shape === token.shape)] ?? '图形'}`;
}
const sequenceShapes = ['circle', 'triangle', 'square', 'star'];
const sequenceColors = ['#B16C61', '#B38B37', '#628AA3', '#8771AF'];
interface GameBoardProps {
  question: Question;
  gameId: GameId;
  phase: 'intro' | 'preview' | 'answer' | 'feedback' | 'result';
  picked: number[];
  activeSequence: number;
  sequenceCount: number;
  nextNumber: number;
  wrongCell: number;
  onSelect: (index: number) => void;
  example?: boolean;
}
/** Board adapters render each game independently of session timing and persistence. */
export function GameBoard({
  question,
  gameId,
  phase,
  picked,
  activeSequence,
  sequenceCount,
  nextNumber,
  wrongCell,
  onSelect,
  example = false,
}: GameBoardProps) {
  const answering = phase === 'answer';
  const gridSize = 'size' in question ? question.size : 0;
  const game = getGame(gameId);
  const isExampleAnswer = (index: number) =>
    'answer' in question
      ? index === question.answer
      : question.kind === 'schulte'
        ? question.values[index] === nextNumber
        : false;
  return (
    <>
      {question.kind === 'tiles' ? (
        <div className="play-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
          {Array.from({ length: gridSize ** 2 }, (_, i) => {
            const revealed =
              (phase === 'preview' || phase === 'feedback') && question.targets.includes(i);
            return (
              <button
                key={i}
                aria-label={`第 ${i + 1} 格${revealed ? '，亮起' : ''}`}
                disabled={!answering}
                className={`tile ${revealed ? 'revealed' : ''} ${picked.includes(i) ? (question.targets.includes(i) ? 'selected' : 'wrong') : ''}`}
                onClick={() => onSelect(i)}
              >
                {revealed || picked.includes(i) ? <Star size={28} fill="currentColor" /> : null}
                {example && isExampleAnswer(i) && (
                  <Hand className="example-pointer" size={27} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      ) : question.kind === 'color' ? (
        <>
          <div className="color-target" role="img" aria-label={describeColorToken(question.target)}>
            <Shape name={question.target.shape} color={question.target.color} />
          </div>
          <div className="answer-options color-options">
            {question.options.map((option, i) => (
              <button
                key={i}
                aria-label={describeColorToken(option)}
                disabled={!answering}
                onClick={() => onSelect(i)}
                className={`answer-option ${phase === 'feedback' && i === question.answer ? 'selected' : ''} ${picked.includes(i) && i !== question.answer ? 'wrong' : ''}`}
              >
                <Shape name={option.shape} color={option.color} />
                {example && isExampleAnswer(i) && (
                  <Hand className="example-pointer" size={27} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </>
      ) : question.kind === 'sequence' ? (
        <>
          <div className="sequence-progress">
            {question.sequence.map((_, i) => (
              <span key={i} className={i < sequenceCount ? 'done' : ''} />
            ))}
          </div>
          <div className="sequence-grid">
            {sequenceShapes.map((shape, i) => (
              <button
                key={shape}
                aria-label={shapeNames[i]}
                className={`sequence-pad ${activeSequence === i ? 'flashing' : ''} ${answering && picked.includes(i) ? 'touched' : ''}`}
                disabled={!answering}
                onClick={() => onSelect(i)}
                style={{ '--pad-color': sequenceColors[i] } as React.CSSProperties}
              >
                <Shape name={shape} />
                {example && isExampleAnswer(i) && (
                  <Hand className="example-pointer" size={27} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </>
      ) : question.kind === 'odd' ? (
        <div
          className="play-grid odd-grid"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {Array.from({ length: gridSize ** 2 }, (_, i) => (
            <button
              key={i}
              aria-label={`图形 ${i + 1}`}
              className={`odd-cell ${phase === 'feedback' && i === question.answer ? 'selected' : ''} ${picked.includes(i) && i !== question.answer ? 'wrong' : ''}`}
              disabled={!answering}
              onClick={() => onSelect(i)}
            >
              <Shape
                name={i === question.answer ? question.odd : question.base}
                style={{
                  transform: i === question.answer ? `rotate(${question.rotation}deg)` : undefined,
                }}
              />
              {example && isExampleAnswer(i) && (
                <Hand className="example-pointer" size={27} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      ) : question.kind === 'schulte' ? (
        <>
          <div className="play-grid" style={{ gridTemplateColumns: `repeat(${gridSize},1fr)` }}>
            {question.values.map((n, i) => (
              <button
                key={i}
                aria-label={`图章 ${n}`}
                className={`number-cell ${n < nextNumber ? 'found' : ''} ${wrongCell === i ? 'wrong' : ''}`}
                disabled={!answering || n < nextNumber}
                onClick={() => onSelect(i)}
              >
                {n < nextNumber ? <Check size={25} /> : <TrackingGlyph value={n} />}
                {wrongCell === i && (
                  <X className="wrong-mark" size={17} aria-label="这次没有点对" />
                )}
                {example && isExampleAnswer(i) && (
                  <Hand className="example-pointer" size={27} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          <p className="board-note reader-help" aria-live="polite">
            {wrongCell >= 0 ? '再找找，找到和上面一样的图案' : '点出和上面一样的图案'}
          </p>
        </>
      ) : (
        <>
          {question.presentation === 'quantity-pattern' ? (
            <div className="question-pattern quantity-pattern">
              {question.quantities!.map((count, i) => (
                <span key={i}>
                  <PipGroup count={count} />
                </span>
              ))}
              <span className="answer-slot" aria-label="下一组圆点">
                <HandPlaceholder />
              </span>
            </div>
          ) : question.presentation === 'quantity-math' ? (
            <div className="quantity-equation">
              <div className="source-groups">
                {question.groups!.map((count, i) => (
                  <div key={i}>
                    <PipGroup
                      count={count}
                      removed={i === question.groups!.length - 1 ? question.removed : 0}
                    />
                  </div>
                ))}
              </div>
              <svg className="merge-path" viewBox="0 0 280 32" aria-hidden="true">
                <path
                  d="M35 1v10q0 7 10 7h190q10 0 10-7V1M140 18v12m-6-6 6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
              </svg>
              <span className="answer-bowl" aria-label="合起来还剩多少圆点" />
            </div>
          ) : question.presentation === 'quantity-compare' ? null : question.pattern ? (
            <div className="question-pattern">
              {question.pattern.map((item, i) => (
                <span key={i}>
                  <Shape name={item} />
                </span>
              ))}
              <b className="answer-slot">
                <HandPlaceholder />
              </b>
            </div>
          ) : (
            <div
              className={`question-prompt ${gameId === 'flip' ? 'arrow-prompt' : ''}`}
              style={{ color: game.color }}
              role={gameId === 'flip' ? 'img' : undefined}
              aria-label={gameId === 'flip' ? directionNames[question.prompt] : undefined}
            >
              {question.prompt}
            </div>
          )}
          <div
            className={`answer-options ${gameId === 'compare' ? 'compare-options' : ''} ${gameId === 'flip' ? 'arrow-options' : ''}`}
          >
            {question.options.map((option, i) => (
              <button
                key={`${i}-${option}`}
                aria-label={
                  gameId === 'pattern'
                    ? shapeNames[
                        ['circle', 'triangle', 'square', 'star', 'diamond'].indexOf(option)
                      ]
                    : gameId === 'flip'
                      ? directionNames[option]
                      : question.presentation
                        ? `${option} 个圆点`
                        : option
                }
                disabled={!answering}
                onClick={() => onSelect(i)}
                className={`answer-option ${phase === 'feedback' && i === question.answer ? 'selected' : ''} ${picked.includes(i) && i !== question.answer ? 'wrong' : ''}`}
              >
                {gameId === 'pattern' ? (
                  <Shape name={option} />
                ) : question.presentation ? (
                  <PipGroup count={Number(option)} />
                ) : (
                  option
                )}
                {example && isExampleAnswer(i) && (
                  <Hand className="example-pointer" size={27} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function HandPlaceholder() {
  return (
    <svg className="slot-arrow" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M4 16h24m-9-9 9 9-9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
