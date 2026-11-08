import { useEffect, useRef, useState } from 'react';
import { Check, DoorOpen, LockKeyhole, Package, RotateCcw, Undo2, X } from 'lucide-react';
import {
  isAdjacent,
  pointKey,
  samePoint,
  type RouteErrorKind,
  type RoutePoint,
  type RouteQuestion,
} from './route';

interface RouteAttemptError {
  kind: RouteErrorKind;
  point: RoutePoint;
}

function deliveryWalker() {
  return (
    <svg className="route-walker" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="11" r="6" fill="currentColor" />
      <path
        d="M20 18v10m0-7-8 5m8-5 8 5m-8 2-5 7m5-7 5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M13 25h14l-2 9H15Z" fill="currentColor" opacity=".85" />
    </svg>
  );
}

function Parcel({ collected = false }: { collected?: boolean }) {
  return (
    <span className={`route-parcel ${collected ? 'collected' : ''}`}>
      <Package aria-hidden="true" />
      {collected && <Check className="parcel-check" aria-hidden="true" />}
    </span>
  );
}

function collectedFromPath(path: RoutePoint[], pickups: RoutePoint[]): boolean[] {
  return pickups.map((pickup) => path.some((step) => samePoint(step, pickup)));
}

export function RouteBoard({
  question,
  answering,
  onResult,
}: {
  question: RouteQuestion;
  answering: boolean;
  onResult: (moves: number) => void;
}) {
  const [path, setPath] = useState<RoutePoint[]>([question.start]);
  const pathRef = useRef(path);
  const [attemptError, setAttemptError] = useState<RouteAttemptError | null>(null);
  const completed = useRef(false);
  const collected = collectedFromPath(path, question.pickups);
  const position = path.at(-1)!;
  const allCollected = collected.every(Boolean);
  const exitKey = pointKey(question.exit);
  const trail = new Set(path.slice(1).map(pointKey));
  const blocked = new Set(question.blocked.map(pointKey));

  useEffect(() => {
    pathRef.current = [question.start];
    setPath(pathRef.current);
    setAttemptError(null);
    completed.current = false;
  }, [question]);

  function reset() {
    if (!answering || completed.current) return;
    pathRef.current = [question.start];
    setPath(pathRef.current);
    setAttemptError(null);
  }

  function undo() {
    if (!answering || completed.current || pathRef.current.length <= 1) return;
    pathRef.current = pathRef.current.slice(0, -1);
    setPath(pathRef.current);
    setAttemptError(null);
  }

  function moveTo(point: RoutePoint) {
    if (!answering || completed.current) return;
    const currentPath = pathRef.current;
    const currentPosition = currentPath.at(-1)!;
    const currentCollected = collectedFromPath(currentPath, question.pickups);
    const currentAllCollected = currentCollected.every(Boolean);
    if (blocked.has(pointKey(point))) {
      setAttemptError({ kind: 'blocked', point });
      return;
    }
    if (!isAdjacent(currentPosition, point)) {
      setAttemptError({ kind: 'not-adjacent', point });
      return;
    }
    if (samePoint(point, question.exit) && !currentAllCollected) {
      setAttemptError({ kind: 'exit-locked', point });
      return;
    }
    const nextPath = [...currentPath, point];
    pathRef.current = nextPath;
    setPath(nextPath);
    setAttemptError(null);
    if (samePoint(point, question.exit)) {
      completed.current = true;
      onResult(nextPath.length - 1);
    }
  }

  return (
    <div className="route-board" data-testid="route-board">
      <div className="route-goals" role="img" aria-label="今日送物目标">
        <div className="route-slots">
          {question.pickups.map((_, index) => (
            <Parcel key={index} collected={collected[index]} />
          ))}
        </div>
        <span className={`route-exit-goal ${allCollected ? 'ready' : ''}`}>
          <DoorOpen aria-hidden="true" />
          <small aria-hidden="true">
            {question.pickups.map((_, i) => (collected[i] ? '●' : '○')).join('')}
          </small>
        </span>
      </div>
      <div
        className="route-grid"
        style={{ gridTemplateColumns: `repeat(${question.width}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: question.width * question.height }, (_, index) => {
          const point = { x: index % question.width, y: Math.floor(index / question.width) };
          const key = pointKey(point);
          const pickupIndex = question.pickups.findIndex((pickup) => pointKey(pickup) === key);
          const hasError = attemptError && pointKey(attemptError.point) === key;
          return (
            <button
              key={key}
              type="button"
              className={[
                'route-cell',
                blocked.has(key) ? 'route-blocked' : '',
                trail.has(key) ? 'route-trail' : '',
                samePoint(point, position) ? 'route-player' : '',
                samePoint(point, question.start) ? 'route-start' : '',
                key === exitKey ? `route-exit ${allCollected ? 'ready' : ''}` : '',
                hasError ? `route-error error-${attemptError.kind}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-testid={`route-cell-${point.x}-${point.y}`}
              aria-label={
                blocked.has(key)
                  ? '挡住的道路'
                  : key === exitKey
                    ? '出口'
                    : pickupIndex >= 0
                      ? `${collected[pickupIndex] ? '已收集' : '待收集'}包裹`
                      : `第 ${point.y + 1} 行第 ${point.x + 1} 格`
              }
              disabled={!answering}
              onClick={() => moveTo(point)}
            >
              {blocked.has(key) && <span className="route-stones" aria-hidden="true" />}
              {key === exitKey && (
                <span className="route-door">{allCollected ? <DoorOpen /> : <LockKeyhole />}</span>
              )}
              {pickupIndex >= 0 && !collected[pickupIndex] && <Parcel />}
              {pickupIndex >= 0 && collected[pickupIndex] && (
                <span className="route-collected-mark">
                  <Check />
                </span>
              )}
              {samePoint(point, position) && deliveryWalker()}
              {hasError && (
                <span className="route-error-mark">
                  {attemptError.kind === 'exit-locked' ? <LockKeyhole /> : <X />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="route-tools">
        <button
          type="button"
          className="route-tool"
          data-testid="route-undo"
          aria-label="撤销一步"
          disabled={!answering || path.length <= 1}
          onClick={undo}
        >
          <Undo2 />
        </button>
        <div
          className="route-path-progress"
          role="img"
          aria-label={`已经走了 ${path.length - 1} 步`}
        >
          {path
            .slice(1)
            .slice(-8)
            .map((_, index) => (
              <i key={index} />
            ))}
        </div>
        <button
          type="button"
          className="route-tool"
          data-testid="route-restart"
          aria-label="重新开始路线"
          disabled={!answering || path.length <= 1}
          onClick={reset}
        >
          <RotateCcw />
        </button>
      </div>
      <div className="route-error-note" aria-live="polite">
        {attemptError && (
          <>
            <span className="route-error-note-icon">
              {attemptError.kind === 'exit-locked' ? <LockKeyhole /> : <X />}
            </span>
            {attemptError.kind === 'blocked' && (
              <span className="route-stones" aria-hidden="true" />
            )}
            {attemptError.kind === 'not-adjacent' && (
              <svg viewBox="0 0 60 30" aria-hidden="true">
                <path d="M4 15h42m-8-8 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" />
              </svg>
            )}
            {attemptError.kind === 'exit-locked' && <Parcel />}
          </>
        )}
      </div>
    </div>
  );
}
