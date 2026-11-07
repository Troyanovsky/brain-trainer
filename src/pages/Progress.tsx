import { Award, Compass, Flame, Flower2, Sprout, Sun, Target, Trophy } from 'lucide-react';
import type { Profile } from '../domain/types';
import { GAMES, SKILLS, getGame } from '../domain/catalog';
import {
  dateKey,
  getGameResults,
  getAchievements,
  getSkillCoverage,
  getStreak,
  shiftDate,
} from '../domain/training';
import { Flower } from '../components/Artwork';
import { WeekFlowers } from './Home';
const achievementIcons = {
  sprout: Sprout,
  compass: Compass,
  flower: Flower2,
  sun: Sun,
  flame: Flame,
  target: Target,
};
export function Progress({ profile }: { profile: Profile }) {
  const history = profile.history,
    achievements = getAchievements(profile),
    coverage = getSkillCoverage(history),
    maxCoverage = Math.max(1, ...coverage.map((c) => c.count));
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = shiftDate(dateKey(), i - 13);
    const records = history.filter((r) => dateKey(new Date(r.completedAt)) === date);
    return {
      date,
      accuracy: records.length
        ? records.reduce((sum, r) => sum + r.correct / r.rounds, 0) / records.length
        : null,
    };
  });
  const points = days.map((day, i) =>
    day.accuracy === null ? null : `${36 + i * 36},${158 - day.accuracy * 120}`,
  );
  const activeDays = new Set(history.map((r) => dateKey(new Date(r.completedAt)))).size;
  return (
    <>
      <header className="page-header">
        <div>
          <div className="date-label">每一份努力，都在这里</div>
          <h1>
            成长足迹
            <Sprout className="greeting-sun" size={31} />
          </h1>
          <p>不用每天完美，只要每天向前一点。</p>
        </div>
        <span className="header-badge">
          <Flower2 size={17} />
          你的专属成长花园
        </span>
      </header>
      <div className="progress-summary">
        {[
          { icon: Sprout, value: history.length, label: '累计练习', unit: '次', bg: '#E7F0E2' },
          { icon: Flame, value: getStreak(history), label: '当前连续', unit: '天', bg: '#FCEDDC' },
          { icon: Sun, value: activeDays, label: '活跃日子', unit: '天', bg: '#FBF0CA' },
          {
            icon: Award,
            value: achievements.filter((a) => a.unlocked).length,
            label: '收获徽章',
            unit: '枚',
            bg: '#EEE9F8',
          },
        ].map((item) => (
          <div className="summary-card" key={item.label}>
            <span style={{ background: item.bg }}>
              <item.icon size={24} />
            </span>
            <div>
              <strong>
                {item.value}
                <small>{item.unit}</small>
              </strong>
              <p>{item.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="progress-columns">
        <section className="panel activity-panel">
          <div className="section-heading">
            <h2>最近一周的小坚持</h2>
            <span className="quiet-label">最近 7 天</span>
          </div>
          <WeekFlowers profile={profile} />
          <p className="panel-note">
            {history.length ? '花朵记得你来过的每一天。' : '完成一场练习，让第一朵花为你盛开。'}
          </p>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>能力花园</h2>
            <span className="quiet-label">练习覆盖</span>
          </div>
          <div className="coverage-bars">
            {coverage.map(({ skill, count }) => (
              <div key={skill}>
                <span style={{ color: SKILLS[skill].color }}>{SKILLS[skill].name}</span>
                <div className="coverage-track">
                  <i
                    style={{
                      width: `${(count / maxCoverage) * 100}%`,
                      background: SKILLS[skill].color,
                    }}
                  />
                </div>
                <small>{count} 次</small>
              </div>
            ))}
          </div>
          <p className="panel-note">这里展示练习分布，陪你均衡探索。</p>
        </section>
      </div>
      <section className="panel trend-panel">
        <div className="section-heading">
          <div>
            <h2>一点点，看见变化</h2>
            <p>最近 14 天 · 每日平均正确率</p>
          </div>
          <span className="trend-legend">
            <i />
            正确率
          </span>
        </div>
        <div className="chart-wrap">
          <svg
            viewBox="0 0 540 195"
            role="img"
            aria-label={
              history.length
                ? `近14天正确率：${
                    days
                      .filter((d) => d.accuracy !== null)
                      .map((d) => `${d.date} ${Math.round(d.accuracy! * 100)}%`)
                      .join('，') || '暂无记录'
                  }`
                : '还没有练习数据'
            }
          >
            {[0, 50, 100].map((n) => (
              <g key={n}>
                <line
                  x1="36"
                  x2="516"
                  y1={158 - n * 1.2}
                  y2={158 - n * 1.2}
                  stroke="#E6EBE1"
                  strokeDasharray="4 5"
                />
                <text x="5" y={162 - n * 1.2} fill="#718071" fontSize="11">
                  {n}%
                </text>
              </g>
            ))}
            {points.map(
              (point, i) =>
                point && (
                  <g key={i}>
                    {i > 0 && points[i - 1] && (
                      <line
                        x1={36 + (i - 1) * 36}
                        y1={158 - days[i - 1].accuracy! * 120}
                        x2={36 + i * 36}
                        y2={158 - days[i].accuracy! * 120}
                        stroke="#608467"
                        strokeWidth="3"
                      />
                    )}
                    <circle
                      cx={36 + i * 36}
                      cy={158 - days[i].accuracy! * 120}
                      r="5"
                      fill="#608467"
                    />
                  </g>
                ),
            )}
            {[0, 6, 13].map((i) => (
              <text
                key={i}
                x={36 + i * 36}
                y="185"
                textAnchor="middle"
                fill="#718071"
                fontSize="11"
              >
                {days[i].date.slice(5).replace('-', '/')}
              </text>
            ))}
          </svg>
          {!days.some((d) => d.accuracy !== null) && (
            <div className="chart-empty">
              <Flower variant={1} />
              <p>第一场练习之后，成长曲线就会开始</p>
            </div>
          )}
        </div>
      </section>
      <section className="achievements">
        <div className="section-heading">
          <div>
            <h2>每一枚徽章，都有故事</h2>
            <p>小小的里程碑，大大的成就感</p>
          </div>
          <span className="quiet-label">
            {achievements.filter((a) => a.unlocked).length} / 6 已解锁
          </span>
        </div>
        <div className="achievement-grid">
          {achievements.map((a) => {
            const Icon = achievementIcons[a.icon as keyof typeof achievementIcons] ?? Award;
            return (
              <div className={`achievement ${a.unlocked ? 'unlocked' : ''}`} key={a.id}>
                <span className="medal">
                  <Icon size={28} />
                </span>
                <h3>{a.name}</h3>
                <p>{a.description}</p>
                <small>{a.unlocked ? '已解锁' : '等待盛开'}</small>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel personal-bests">
        <div className="section-heading">
          <h2>我的游戏记录</h2>
          <Trophy size={21} />
        </div>
        {history.some(
          (result) => (result.rulesVersion ?? 1) !== (getGame(result.gameId).rulesVersion ?? 1),
        ) && (
          <p className="panel-note legacy-record-note">
            旧玩法记录仍计入成长足迹；新版玩法的难度和个人最好从新开始。
          </p>
        )}
        <div className="best-list">
          {GAMES.map((game) => {
            const records = getGameResults(profile, game.id);
            return (
              <div key={game.id}>
                <span className="skill-dot" style={{ background: game.color }} />
                <strong>{game.name}</strong>
                <span>{records.length} 次练习</span>
                <b>
                  {records.length
                    ? `${Math.max(...records.map((r) => r.score)).toLocaleString('zh-CN')} 分`
                    : '尚未体验'}
                </b>
              </div>
            );
          })}
        </div>
      </section>
      <p className="disclaimer">游戏表现仅用于记录练习，不代表医学或专业认知评估。</p>
    </>
  );
}
