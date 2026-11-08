import type { CSSProperties } from 'react';
import type { GameId } from '../domain/types';

export function Flower({ className = '', variant = 0 }: { className?: string; variant?: number }) {
  const colors = ['#F0CA69', '#A5BB95', '#C8B9DF', '#EEAE91'];
  return (
    <svg
      className={className}
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <g fill={colors[variant % 4]}>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="60" cy="32" rx="19" ry="25" transform={`rotate(${a} 60 60)`} />
        ))}
      </g>
      <circle cx="60" cy="60" r="24" fill="#FFF8DF" />
      <ellipse cx="52" cy="57" rx="2.3" ry="3.5" fill="#3C5843" />
      <ellipse cx="68" cy="57" rx="2.3" ry="3.5" fill="#3C5843" />
      <path d="M53 67Q60 73 67 67" stroke="#3C5843" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="45" cy="65" rx="4" ry="2" fill="#F2BEB1" />
      <ellipse cx="75" cy="65" rx="4" ry="2" fill="#F2BEB1" />
    </svg>
  );
}
export function GardenArt() {
  return (
    <svg viewBox="0 0 480 300" className="garden-art" fill="none" aria-hidden="true">
      <circle cx="275" cy="128" r="111" fill="#F9E8A9" />
      <path d="M65 260C120 225 355 214 440 263" fill="#E2D78D" />
      <path
        d="M280 254V126M194 254V184M360 252V171"
        stroke="#527956"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M282 222C222 220 220 175 230 171C264 170 286 199 282 222ZM283 201C328 203 337 162 327 159C294 161 284 181 283 201Z"
        fill="#6E9362"
      />
      <path
        d="M192 237C150 238 143 209 151 204C179 202 193 224 192 237ZM360 228C395 231 410 198 400 193C373 194 358 209 360 228Z"
        fill="#8DA773"
      />
      <g transform="translate(219 57)">
        <Flower />
      </g>
      <g transform="translate(156 139) scale(.64)">
        <Flower variant={2} />
      </g>
      <g transform="translate(329 124) scale(.55)">
        <Flower variant={3} />
      </g>
      <path d="M101 239C92 212 100 195 111 193C126 204 123 225 115 240" fill="#97AD72" />
      <path d="M121 242C121 219 143 215 147 222C144 238 132 245 121 242" fill="#B4BD7A" />
      <path d="M411 94l4-10 4 10 10 4-10 4-4 10-4-10-10-4Z" fill="#B58D46" />
      <path d="m146 109 3-7 3 7 7 3-7 3-3 7-3-7-7-3Z" fill="#B58D46" />
      <path
        d="M369 44c9-11 23-5 20 5-4 11-17 14-22 25-2-13-13-25-7-29 3-2 6-2 9-1"
        fill="#B0B77C"
      />
      <circle cx="125" cy="167" r="4" fill="#D7AE61" />
      <circle cx="428" cy="207" r="4" fill="#D7AE61" />
      <path d="M237 275h78" stroke="#B8AE68" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
export function Shape({
  name,
  color = 'currentColor',
  className = '',
  style,
}: {
  name: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`shape ${className}`}
      viewBox="0 0 48 48"
      style={style}
      fill={color}
      aria-hidden="true"
    >
      {name === 'circle' ? (
        <circle cx="24" cy="24" r="16" />
      ) : name === 'triangle' ? (
        <path d="M24 5 45 41H3Z" />
      ) : name === 'square' ? (
        <rect x="8" y="8" width="32" height="32" rx="5" />
      ) : name === 'diamond' ? (
        <path d="m24 3 21 21-21 21L3 24Z" />
      ) : name === 'leaf' ? (
        <path d="M8 38C-2 9 18 1 42 6 47 34 25 47 8 38Z" />
      ) : (
        <path d="m24 2 7 14 15 2-11 12 3 15-14-7-14 7 3-15L2 18l15-2Z" />
      )}
    </svg>
  );
}
export function GameArt({ id, small = false }: { id: GameId; small?: boolean }) {
  return (
    <div className={`game-art art-${id} ${small ? 'small' : ''}`} aria-hidden="true">
      {id === 'tiles' ? (
        <div className="art-tiles">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={[0, 2, 4, 7].includes(i) ? 'lit' : ''} />
          ))}
        </div>
      ) : id === 'sequence' ? (
        <div className="art-sequence">
          {[0, 1, 2].map((i) => (
            <Shape
              key={i}
              name="star"
              style={{ transform: `translateY(${i === 1 ? -16 : 4}px) rotate(${i * 15 - 15}deg)` }}
            />
          ))}
        </div>
      ) : id === 'pattern' ? (
        <div className="art-pattern">
          <Shape name="triangle" />
          <Shape name="circle" />
          <Shape name="square" />
          <b>?</b>
        </div>
      ) : id === 'numbers' ? (
        <div className="art-quantities">
          {[1, 2, 3].map((count) => (
            <span key={count}>
              <ArtDots count={count} />
            </span>
          ))}
          <svg width="20" height="28" viewBox="0 0 20 28">
            <path d="M2 14h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      ) : id === 'odd' ? (
        <div className="art-odd">
          {Array.from({ length: 9 }, (_, i) => (
            <Shape key={i} name={i === 4 ? 'diamond' : 'circle'} />
          ))}
        </div>
      ) : id === 'stroop' ? (
        <div className="art-color-match">
          <Shape name="star" color="#397B56" />
          <Shape name="circle" color="#397B56" />
          <Shape name="star" color="#C95053" />
        </div>
      ) : id === 'compare' ? (
        <div className="art-piles">
          <ArtDots count={2} />
          <ArtDots count={7} />
        </div>
      ) : id === 'schulte' ? (
        <div className="art-stamps">
          {['triangle', 'circle', 'star', 'square'].map((shape) => (
            <span key={shape}>
              <Shape name={shape} />
            </span>
          ))}
        </div>
      ) : id === 'math' ? (
        <div className="art-merge">
          <div>
            <ArtDots count={2} />
            <ArtDots count={3} />
          </div>
          <svg viewBox="0 0 60 18">
            <path
              d="M10 0v6h40V0M30 6v10m-5-5 5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <ArtDots count={5} />
        </div>
      ) : id === 'focus' ? (
        <div className="art-focus">
          {['left', 'up', 'right', 'left'].map((direction, index) => (
            <i key={index} className={`art-focus-neighbor direction-${direction}`} />
          ))}
          <span className="art-focus-center">
            <svg viewBox="0 0 32 32">
              <path
                d="M16 27V5m-8 8 8-8 8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      ) : id === 'route' ? (
        <div className="art-route">
          <span className="art-route-work">
            <i />
          </span>
          <span className="art-route-arrow">↗</span>
          <span className="art-route-arrow">→</span>
          <span className="art-route-package">
            <PackageGlyph />
          </span>
          <span className="art-route-door">
            <DoorGlyph />
          </span>
        </div>
      ) : id === 'fit' ? (
        <div className="art-fit">
          <span className="art-fit-target">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="art-fit-turn">
            <RotateGlyph />
          </span>
          <span className="art-fit-piece">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      ) : (
        <div className="art-flip">
          <span>←</span>
          <span>→</span>
        </div>
      )}
    </div>
  );
}

function PackageGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="m4 10 12-6 12 6v14l-12 6-12-6Z" fill="#E8C77A" stroke="currentColor" />
      <path d="m4 10 12 6 12-6M16 16v14" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m10 7 12 6" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function DoorGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 28V5h20v23" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M11 9h10v19H11Z" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="19" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function RotateGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M25 13V5m-5 3 5-3 3 5M25 13A10 10 0 1 0 22 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArtDots({ count }: { count: number }) {
  return (
    <svg className="art-dots" viewBox="0 0 48 48">
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={12 + (i % 3) * 12}
          cy={12 + Math.floor(i / 3) * 12}
          r="4"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
