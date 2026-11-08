import { useState } from 'react';
import { Compass, Flower2, Focus, Lightbulb, Shapes, Zap } from 'lucide-react';
import type { GameId, Profile, Skill } from '../domain/types';
import { GAMES, SKILLS } from '../domain/catalog';
import { GameCard } from '../components/GameCard';
const icons = {
  memory: Flower2,
  logic: Lightbulb,
  attention: Focus,
  speed: Zap,
  flexibility: Shapes,
};
export function Library({ profile, onPlay }: { profile: Profile; onPlay: (id: GameId) => void }) {
  const [filter, setFilter] = useState<Skill | 'all'>('all');
  return (
    <>
      <header className="page-header">
        <div>
          <div className="date-label">把好奇心带进来</div>
          <h1>
            游戏乐园
            <Compass className="greeting-sun" size={30} />
          </h1>
          <p>{GAMES.length} 种小挑战，总有一种让你心动。</p>
        </div>
        <span className="header-badge">短短一局，满满乐趣</span>
      </header>
      <div className="filter-chips" aria-label="筛选游戏">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
        >
          全部游戏<span>{GAMES.length}</span>
        </button>
        {(Object.keys(SKILLS) as Skill[]).map((skill) => {
          const Icon = icons[skill];
          return (
            <button
              key={skill}
              className={filter === skill ? 'active' : ''}
              aria-pressed={filter === skill}
              onClick={() => setFilter(skill)}
            >
              <Icon size={17} />
              {SKILLS[skill].name}
            </button>
          );
        })}
      </div>
      <div className="library-grid">
        {GAMES.filter((g) => filter === 'all' || g.skill === filter).map((game) => (
          <GameCard key={game.id} id={game.id} profile={profile} onPlay={onPlay} />
        ))}
      </div>
      <div className="library-note">
        <LeafIcon />
        <p>不必和别人比较。每一次挑战，都是自己的小进步。</p>
      </div>
    </>
  );
}
function LeafIcon() {
  return <Flower2 size={25} />;
}
