import { useEffect, useRef, useState } from 'react';
import { Check, FlipHorizontal2, Hand, RotateCw, X } from 'lucide-react';
import {
  fitDimensions,
  fitsTarget,
  normalizeCells,
  type FitQuestion,
  type GridPoint,
  reflectCells,
  rotateCells,
} from './fit';

function PieceGlyph({ cells, className = '' }: { cells: GridPoint[]; className?: string }) {
  const normalized = normalizeCells(cells);
  const { rows, columns } = fitDimensions(normalized);
  const filled = new Set(normalized.map((cell) => `${cell.x}:${cell.y}`));
  return (
    <span
      className={`fit-glyph ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: rows * columns }, (_, index) => {
        const x = index % columns;
        const y = Math.floor(index / columns);
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

export function FitBoard({
  question,
  answering,
  onResult,
  allowRetry = false,
}: {
  question: FitQuestion;
  answering: boolean;
  onResult: (correct: boolean) => void;
  allowRetry?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [previewCells, setPreviewCells] = useState<GridPoint[]>(() =>
    normalizeCells(question.pieces[0].cells),
  );
  const [attempted, setAttempted] = useState(false);
  const [solved, setSolved] = useState(false);
  const settled = useRef(false);
  const previewFits = fitsTarget(previewCells, question.targetCells);

  useEffect(() => {
    setSelected(0);
    setPreviewCells(normalizeCells(question.pieces[0].cells));
    setAttempted(false);
    setSolved(false);
    settled.current = false;
  }, [question]);

  function clearCorrection() {
    if (!allowRetry || !attempted || !answering || solved) return;
    setAttempted(false);
  }

  function choose(index: number) {
    if (!answering || solved) return;
    clearCorrection();
    setSelected(index);
    setPreviewCells(normalizeCells(question.pieces[index].cells));
  }

  function rotate() {
    if (!answering || solved) return;
    clearCorrection();
    setPreviewCells(rotateCells(previewCells));
  }

  function reflect() {
    if (!answering || solved) return;
    clearCorrection();
    setPreviewCells(reflectCells(previewCells));
  }

  function place() {
    if (!answering || solved || settled.current || (attempted && !allowRetry)) return;
    settled.current = true;
    setAttempted(true);
    if (previewFits) {
      setSolved(true);
      onResult(true);
      return;
    }
    onResult(false);
    if (allowRetry) settled.current = false;
  }

  return (
    <div
      className={`fit-board ${attempted ? (previewFits ? 'fit-success' : 'fit-miss') : ''}`}
      data-testid="fit-board"
    >
      <div className="fit-workbench">
        <div className="fit-target-panel">
          <PieceGlyph cells={question.targetCells} className="fit-target" />
          <button
            type="button"
            className={`fit-slot ${attempted ? 'revealed' : ''}`}
            data-testid="fit-slot"
            aria-label="把当前拼块放进空位"
            disabled={!answering || solved}
            onClick={place}
          >
            <span className="fit-slot-outline" />
            {attempted && (
              <span className="fit-slot-result" aria-hidden="true">
                {previewFits ? <Check /> : <X />}
                <Hand />
              </span>
            )}
          </button>
        </div>
        <div className="fit-preview-panel">
          <PieceGlyph cells={previewCells} className="fit-preview" />
          <span className="fit-preview-ring" aria-hidden="true" />
        </div>
        {attempted && !previewFits && (
          <div className="fit-solved-overlay" role="img" aria-label="正确的拼块方向和空位">
            <PieceGlyph cells={question.targetCells} className="fit-solved-piece" />
            <Hand />
            <Check />
          </div>
        )}
      </div>
      <div className="fit-transform-tools" role="group" aria-label="调整拼块">
        <button
          type="button"
          data-testid="fit-rotate"
          aria-label="顺时针旋转拼块"
          disabled={!answering || solved}
          onClick={rotate}
        >
          <RotateCw />
        </button>
        <span className="fit-transform-link" aria-hidden="true" />
        <button
          type="button"
          data-testid="fit-reflect"
          aria-label="左右翻面"
          disabled={!answering || solved}
          onClick={reflect}
        >
          <FlipHorizontal2 />
        </button>
      </div>
      <div className="fit-piece-tray" role="group" aria-label="选择拼块">
        {question.pieces.map((option, index) => (
          <button
            key={index}
            type="button"
            className={[
              'fit-piece',
              selected === index ? 'selected-piece' : '',
              attempted && index === question.answer ? 'correct-piece' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-testid={`fit-piece-${index}`}
            aria-label={`拼块 ${index + 1}`}
            aria-pressed={selected === index}
            disabled={!answering || solved}
            onClick={() => choose(index)}
          >
            <PieceGlyph cells={option.cells} />
            {attempted && index === question.answer && (
              <span className="correct-piece-mark">
                <Check />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
