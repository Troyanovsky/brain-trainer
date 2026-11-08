import { ArrowDown, ArrowRight, Eye, Hand, Paintbrush, Shapes, ScanSearch } from 'lucide-react';
import { Shape } from '../components/Artwork';
import type { Question } from './engine';

/** Quantities are objects, not digit glyphs. Crossed objects are visibly removed. */
export function PipGroup({ count, removed = 0 }: { count: number; removed?: number }) {
  const columns = count > 9 ? 4 : count > 4 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(count / columns));
  return (
    <svg
      className="pip-group"
      viewBox="0 0 76 76"
      role="img"
      aria-label={`${count - removed} 个圆点${removed ? `，移走 ${removed} 个` : ''}`}
    >
      {count === 0 ? (
        <circle
          className="empty-pile"
          cx="38"
          cy="38"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      ) : (
        Array.from({ length: count }, (_, i) => {
          const x = 38 + ((i % columns) - (columns - 1) / 2) * 16;
          const y = 38 + (Math.floor(i / columns) - (rows - 1) / 2) * 16;
          const crossed = i >= count - removed;
          return (
            <g key={i} className={crossed ? 'removed-object' : 'quantity-object'}>
              <circle
                cx={x}
                cy={y}
                r="5"
                fill={crossed ? 'none' : 'currentColor'}
                stroke="currentColor"
                strokeWidth="1.7"
              />
              {crossed && (
                <path
                  d={`M${x - 6} ${y - 6}l12 12m0-12-12 12`}
                  stroke="#A95047"
                  strokeWidth="2.5"
                />
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}

const TRACK_SHAPES = ['circle', 'triangle', 'square', 'star'];
export function TrackingGlyph({ value }: { value: number }) {
  return (
    <span className="tracking-glyph" role="img" aria-label={`图章 ${value}`}>
      <Shape name={TRACK_SHAPES[(value - 1) % 4]} />
      <svg className="tracking-marks" viewBox="0 0 48 10" aria-hidden="true">
        {Array.from({ length: Math.floor((value - 1) / 4) + 1 }, (_, i) => (
          <circle
            key={i}
            cx={24 + (i - Math.floor((value - 1) / 4) / 2) * 10}
            cy="5"
            r="3"
            fill="currentColor"
          />
        ))}
      </svg>
    </span>
  );
}

export function RuleBadge({ reverse }: { reverse: boolean }) {
  return (
    <svg
      className={`rule-badge ${reverse ? 'opposite-rule' : 'same-rule'}`}
      viewBox="0 0 80 80"
      role="img"
      aria-label={reverse ? '反向：紫色菱形，对向双箭头' : '同向：绿色圆形，平行双箭头'}
    >
      {reverse ? (
        <path d="M40 3 77 40 40 77 3 40Z" fill="#EFE8F8" stroke="#75549F" strokeWidth="2.5" />
      ) : (
        <circle cx="40" cy="40" r="35" fill="#E5F0E3" stroke="#426B50" strokeWidth="2.5" />
      )}
      <g
        fill="none"
        stroke={reverse ? '#75549F' : '#426B50'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M29 55V26m-8 9 8-9 8 9" />
        <path d={reverse ? 'M51 25v29m-8-9 8 9 8-9' : 'M51 55V26m-8 9 8-9 8 9'} />
      </g>
    </svg>
  );
}

/** One active rule, with a small passive key; these are not answer buttons. */
export function DirectionCue({ reverse }: { reverse: boolean }) {
  return (
    <div
      className="direction-guidance"
      role="group"
      aria-label={`当前规则：${reverse ? '反向' : '同向'}`}
    >
      <div className="active-rule">
        <RuleBadge reverse={reverse} />
        <span className="reader-help">{reverse ? '和箭头相反' : '和箭头一样'}</span>
      </div>
      <div className="passive-rule-key" aria-hidden="true">
        <RuleBadge reverse={false} />
        <RuleBadge reverse={true} />
      </div>
    </div>
  );
}

export function GameCue({
  question,
  preview,
  nextNumber,
}: {
  question: Question;
  preview: boolean;
  nextNumber: number;
}) {
  if (question.kind === 'focus' || question.kind === 'route' || question.kind === 'fit')
    return null;
  if (question.kind === 'choice' && question.game === 'flip')
    return <DirectionCue reverse={!!question.reverse} />;
  if (question.kind === 'schulte')
    return (
      <div className="visual-cue tracking-target">
        <ScanSearch size={27} />
        <TrackingGlyph value={Math.min(nextNumber, question.values.length)} />
        <ArrowDown size={26} />
      </div>
    );
  if (question.kind === 'tiles' || question.kind === 'sequence')
    return (
      <div
        className={`visual-cue phase-cue ${preview ? 'watch-phase' : 'touch-phase'}`}
        role="img"
        aria-label={preview ? '先看示范，现在不用点' : '现在请点选'}
      >
        {preview ? <Eye size={34} /> : <Hand size={34} />}
        <ArrowRight size={20} />
        {question.kind === 'tiles' ? (
          <div className="target-stars">
            {question.targets.map((_, i) => (
              <span key={i}>✦</span>
            ))}
          </div>
        ) : (
          <Shapes size={32} />
        )}
      </div>
    );
  if (question.kind === 'choice' && question.presentation === 'quantity-compare')
    return (
      <div className="visual-cue more-goal" role="img" aria-label="点圆点更多的一堆">
        <svg viewBox="0 0 100 66">
          <path
            d="M12 12v40q0 7 7 7h38q7 0 7-7V12M82 53V12m-9 10 9-10 9 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <circle
              key={i}
              cx={24 + (i % 3) * 14}
              cy={24 + Math.floor(i / 3) * 12}
              r="4"
              fill="currentColor"
            />
          ))}
        </svg>
        <Hand size={28} />
      </div>
    );
  if (question.kind === 'choice') return null;
  return (
    <div className="visual-cue" aria-hidden="true">
      {question.kind === 'color' ? <Paintbrush size={30} /> : <ScanSearch size={30} />}
      <ArrowRight size={21} />
      <Hand size={27} />
    </div>
  );
}
