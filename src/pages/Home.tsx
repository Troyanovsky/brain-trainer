import {
  ArrowRight,
  Check,
  ChevronRight,
  Flame,
  Leaf,
  Play,
  Sparkles,
  Sun,
  Timer,
  Trophy,
} from 'lucide-react';
import type { GameId, Plan, Profile } from '../domain/types';
import { GAMES, getGame, SKILLS } from '../domain/catalog';
import { dateKey, getStreak, getWeekActivity } from '../domain/training';
import { Flower, GameArt, GardenArt } from '../components/Artwork';
import { GameCard } from '../components/GameCard';
export function WeekFlowers({ profile }: { profile: Profile }) {
  const days = getWeekActivity(profile.history);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return (
    <div className="week-flowers">
      {days.map((day) => {
        const weekday = new Date(`${day.date}T12:00:00`).getDay();
        const today = day.date === dateKey();
        return (
          <div
            key={day.date}
            className={`${day.count ? 'active' : ''} ${today ? 'today' : ''}`}
            title={`${day.date}：${day.count} 次练习`}
          >
            <span className="week-flower">
              {day.count ? <Flower variant={weekday % 4} /> : <Flower variant={1} />}
            </span>
            <span>{today ? '今天' : `周${weekdays[weekday]}`}</span>
            {day.count > 0 && <i />}
          </div>
        );
      })}
    </div>
  );
}
export function Home({
  profile,
  plan,
  onDaily,
  onPlay,
  onLibrary,
}: {
  profile: Profile;
  plan: Plan;
  onDaily: (gameId?: GameId) => void;
  onPlay: (id: GameId) => void;
  onLibrary: () => void;
}) {
  const done = plan.completedIds.length,
    complete = done === plan.gameIds.length;
  const streak = getStreak(profile.history);
  const hour = new Date().getHours();
  const greeting = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const featured = GAMES.filter((g) => !plan.gameIds.includes(g.id)).slice(0, 4);
  return (
    <>
      <header className="page-header">
        <div>
          <div className="date-label">
            {new Date().toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </div>
          <h1>
            {greeting}，{profile.name}
            <Sun className="greeting-sun" size={29} />
          </h1>
          <p>给自己几分钟，让思维轻盈起来。</p>
        </div>
        <span className="header-badge">
          <Leaf size={16} />
          今天也是成长的好日子
        </span>
      </header>
      <div className="home-top">
        <section className="hero-card">
          <div className="hero-top">
            <span>
              <Sparkles size={15} />
              你的每日脑力小旅行
            </span>
            <span className="hero-progress">{done} / 4 已完成</span>
          </div>
          <div className="hero-content">
            <div className="hero-copy">
              <h2>
                每天一点，
                <br />
                脑力开花<span>。</span>
              </h2>
              <p>
                专属于你的训练，已经准备好啦。
                <br />
                不用纠结选什么，跟着花园一起出发。
              </p>
              <button className="primary-button hero-button" onClick={() => onDaily()}>
                {complete ? <Trophy size={20} /> : <Play size={18} fill="currentColor" />}
                {complete ? '今日已完成，去逛逛' : done ? '继续今日训练' : '开始今日训练'}
                <ArrowRight size={20} />
              </button>
            </div>
            <GardenArt />
          </div>
          <div className="hero-footer">
            <span>
              <span className="mini-icon">✦</span>4 个趣味小游戏
            </span>
            <span>
              <Timer size={15} />约 5 分钟
            </span>
            <span>
              <Leaf size={15} />
              难度随你成长
            </span>
          </div>
        </section>
        <aside className="weekly-card">
          <div className="section-eyebrow">
            <span className="icon-soft">
              <Flame size={19} />
            </span>
            <span>一点坚持，很多改变</span>
          </div>
          <div className="streak-number">
            {streak}
            <span>天</span>
            <Flower variant={2} />
          </div>
          <h3>{streak ? '连续练习的小日子' : '从今天，种下第一颗种子'}</h3>
          <p>{streak ? '每一次到来，都在让花园更丰盛。' : '不必很厉害，也可以开始。'}</p>
          <WeekFlowers profile={profile} />
          <div className="week-note">
            <span className="green-dot" />
            最近 7 天 · {profile.history.length ? '你的努力都被记住了' : '练习后，小花就会盛开'}
          </div>
        </aside>
      </div>
      <div className="home-middle">
        <section className="daily-section">
          <div className="section-heading">
            <div>
              <h2>
                今天，为你精选<span className="count-pill">{done} / 4</span>
              </h2>
              <p>四种能力，刚刚好的平衡</p>
            </div>
            <span className="quiet-label">
              为你搭配
              <Sparkles size={14} />
            </span>
          </div>
          <div className="daily-games">
            {plan.gameIds.map((id, index) => {
              const game = getGame(id),
                completed = plan.completedIds.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => onDaily(id)}
                  className={`daily-game ${completed ? 'completed' : ''}`}
                  aria-label={`${index + 1} ${game.name}${completed ? ' 已完成，再玩一局' : '，开始这项训练'}`}
                  style={
                    { '--game-color': game.color, '--game-bg': game.bg } as React.CSSProperties
                  }
                >
                  <span className="step-number">
                    {completed ? <Check size={14} /> : `0${index + 1}`}
                  </span>
                  <GameArt id={id} small />
                  <h3>{game.name}</h3>
                  <span className="daily-skill">{SKILLS[game.skill].name}</span>
                  <span className="daily-status">
                    {completed ? '已完成' : '等你挑战'}
                    {completed ? <Check size={13} /> : <ChevronRight size={13} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="tip-card">
          <div>
            <Leaf size={19} />
            <span>花园小贴士</span>
          </div>
          <h3>慢一点，也没关系。</h3>
          <p>
            专注此刻的每一次选择，
            <br />
            比追赶分数更有意义。
          </p>
          <div className="tip-leaves">
            <Leaf />
            <Leaf />
            <Leaf />
          </div>
          <span>享受练习，让成长自然发生</span>
        </aside>
      </div>
      <section className="explore-section">
        <div className="section-heading">
          <div>
            <h2>给大脑，换点新花样</h2>
            <p>随心玩一局，发现更多小乐趣</p>
          </div>
          <button className="text-button" onClick={onLibrary}>
            全部游戏
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="featured-grid">
          {featured.map((game) => (
            <GameCard key={game.id} id={game.id} profile={profile} onPlay={onPlay} />
          ))}
        </div>
      </section>
      <div className="garden-footer">
        <Flower />
        <span>每天一小步，思维一大步。</span>
        <Leaf size={14} />
      </div>
    </>
  );
}
