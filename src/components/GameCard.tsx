import { ArrowUpRight, Clock3 } from 'lucide-react';
import { getGame, SKILLS } from '../domain/catalog';
import type { GameId, Profile } from '../domain/types';
import { getGameResults } from '../domain/training';
import { GameArt } from './Artwork';
export function GameCard({
  id,
  profile,
  onPlay,
}: {
  id: GameId;
  profile: Profile;
  onPlay: (id: GameId) => void;
}) {
  const game = getGame(id),
    skill = SKILLS[game.skill];
  const best = Math.max(0, ...getGameResults(profile, id).map((r) => r.score));
  return (
    <button
      className="game-card"
      onClick={() => onPlay(id)}
      style={{ '--game-color': game.color, '--game-bg': game.bg } as React.CSSProperties}
      aria-label={`开始${game.name}`}
    >
      <div className="game-card-art">
        <GameArt id={id} />
        <span className="card-play">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="game-card-body">
        <div className="game-card-title">
          <h3>{game.name}</h3>
          <span className="skill-dot" style={{ background: game.color }} />
        </div>
        <p>{game.description}</p>
        <div className="game-card-meta">
          <span style={{ color: game.color }}>{skill.name}</span>
          <span>
            <Clock3 size={12} />
            {game.duration}
          </span>
        </div>
        {best > 0 && (
          <small className="card-best">个人最好 {best.toLocaleString('zh-CN')} 分</small>
        )}
      </div>
    </button>
  );
}
