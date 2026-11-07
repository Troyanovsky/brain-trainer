import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Flower2,
  Gamepad2,
  Home as HomeIcon,
  Leaf,
  Settings,
  Sprout,
  TrendingUp,
  WifiOff,
} from 'lucide-react';
import type { GameId, Store, Result } from './domain/types';
import { loadStore, parseStore, saveStore, STORAGE_KEY } from './domain/storage';
import { createPlan, dateKey, getLevel, getGameResults, recordResult } from './domain/training';
import { Flower } from './components/Artwork';
import { Modal } from './components/Modal';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { Progress } from './pages/Progress';
import { Profiles } from './pages/Profiles';
import { GamePlayer } from './games/GamePlayer';

type Page = 'home' | 'library' | 'progress';
interface Session {
  id: string;
  profileId: string;
  gameId: GameId;
  level: number;
  previousBest: number;
  mode: 'daily' | 'free';
  planDate?: string;
}
function withPlan(store: Store, date = dateKey()): Store {
  return {
    ...store,
    profiles: store.profiles.map((p) =>
      p.id === store.activeProfileId && !p.plans[date]
        ? { ...p, plans: { ...p.plans, [date]: createPlan(p, date) } }
        : p,
    ),
  };
}
export default function App() {
  const [initial] = useState(() => loadStore());
  const [store, setStore] = useState(() => withPlan(initial.store));
  const storeRef = useRef(store);
  storeRef.current = store;
  const [warning, setWarning] = useState<string | null>(initial.warning);
  const [page, setPage] = useState<Page>('home'),
    [profilesOpen, setProfilesOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null),
    [celebrate, setCelebrate] = useState(false);
  const [today, setToday] = useState(dateKey()),
    [offline, setOffline] = useState(!navigator.onLine);
  const mainRef = useRef<HTMLElement>(null);
  const profile = store.profiles.find((p) => p.id === store.activeProfileId)!;
  const plan = profile.plans[today] ?? createPlan(profile, today);
  function commit(next: Store) {
    const ready = withPlan(next);
    storeRef.current = ready;
    setStore(ready);
    const saved = saveStore(ready);
    setWarning(saved.ok ? null : saved.error!);
  }
  useEffect(() => {
    if (!initial.warning) {
      const saved = saveStore(storeRef.current);
      if (!saved.ok) setWarning(saved.error!);
    }
  }, [initial]);
  useEffect(() => {
    const update = () => setToday(dateKey());
    const connection = () => setOffline(!navigator.onLine);
    const interval = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      setSession(null);
      setProfilesOpen(false);
      setSettingsOpen(false);
      if (event.newValue) {
        try {
          const loaded = parseStore(event.newValue);
          const next = withPlan(loaded.store);
          storeRef.current = next;
          setStore(next);
          setWarning(loaded.warning);
        } catch {
          setWarning('另一个页面的数据无法读取，请刷新检查。');
        }
      } else {
        const loaded = loadStore();
        const next = withPlan(loaded.store);
        storeRef.current = next;
        setStore(next);
        setWarning('浏览器中的数据已被清除，已开启新的临时花园。');
      }
    };
    window.addEventListener('storage', sync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('storage', sync);
    };
  }, []);
  useEffect(() => {
    if (!profile.plans[today]) commit(withPlan(storeRef.current, today));
  }, [today, profile.id]);
  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', profile.settings.reducedMotion);
  }, [profile.settings.reducedMotion]);
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [page, session?.id]);
  function navigate(next: Page) {
    setPage(next);
  }
  function start(gameId: GameId, mode: 'daily' | 'free', planDate?: string) {
    const current = storeRef.current.profiles.find(
      (p) => p.id === storeRef.current.activeProfileId,
    )!;
    setSession({
      id: crypto.randomUUID(),
      profileId: current.id,
      gameId,
      level: getLevel(current, gameId),
      previousBest: Math.max(0, ...getGameResults(current, gameId).map((r) => r.score)),
      mode,
      planDate,
    });
  }
  function startDaily(date = today, selectedId?: GameId) {
    const current = storeRef.current.profiles.find(
      (p) => p.id === storeRef.current.activeProfileId,
    )!;
    const currentPlan = current.plans[date] ?? createPlan(current, date);
    if (selectedId && currentPlan.gameIds.includes(selectedId)) {
      start(
        selectedId,
        currentPlan.completedIds.includes(selectedId) ? 'free' : 'daily',
        currentPlan.completedIds.includes(selectedId) ? undefined : date,
      );
      return;
    }
    const next = currentPlan.gameIds.find((id) => !currentPlan.completedIds.includes(id));
    if (next) start(next, 'daily', date);
    else {
      setSession(null);
      setPage('library');
    }
  }
  function finish(result: Result) {
    if (!session || session.profileId !== storeRef.current.activeProfileId) return;
    commit({
      ...storeRef.current,
      profiles: storeRef.current.profiles.map((p) =>
        p.id === session.profileId ? recordResult(p, result) : p,
      ),
    });
  }
  function nextGame() {
    if (!session) return;
    if (session.mode === 'free') {
      start(session.gameId, 'free');
      return;
    }
    const current = storeRef.current.profiles.find((p) => p.id === session.profileId)!;
    const activePlan = current.plans[session.planDate!];
    if (activePlan && activePlan.completedIds.length === 4) {
      setSession(null);
      setPage('home');
      setCelebrate(true);
    } else startDaily(session.planDate);
  }
  const navItems = [
    { id: 'home' as const, name: '今日训练', Icon: Sprout },
    { id: 'library' as const, name: '游戏乐园', Icon: Gamepad2 },
    { id: 'progress' as const, name: '成长足迹', Icon: TrendingUp },
  ];
  const activePlan = session?.planDate ? profile.plans[session.planDate] : undefined;
  return (
    <>
      {session ? (
        <GamePlayer
          key={session.id}
          gameId={session.gameId}
          sessionId={session.id}
          initialLevel={session.level}
          mode={session.mode}
          planDate={session.planDate}
          previousBest={session.previousBest}
          sound={profile.settings.sound}
          dailyStep={activePlan ? activePlan.gameIds.indexOf(session.gameId) + 1 : undefined}
          onFinish={finish}
          onExit={() => setSession(null)}
          onNext={nextGame}
          nextAction={
            session.mode === 'free'
              ? 'replay'
              : activePlan?.completedIds.length === 4
                ? 'finish'
                : 'next'
          }
        />
      ) : (
        <div className="app-layout">
          <a className="skip-link" href="#main">
            跳到主要内容
          </a>
          <aside className="sidebar">
            <a
              className="brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('home');
              }}
            >
              <span className="brand-mark">
                <Flower />
              </span>
              <div>
                <strong>脑力花园</strong>
                <span>让思维，悄悄发芽</span>
              </div>
            </a>
            <div className="nav-caption">属于你的脑力时光</div>
            <nav aria-label="主要导航">
              {navItems.map(({ id, name, Icon }) => (
                <button
                  key={id}
                  className={page === id ? 'active' : ''}
                  onClick={() => navigate(id)}
                  aria-current={page === id ? 'page' : undefined}
                >
                  <Icon size={21} />
                  <span>{name}</span>
                  {page === id && <i />}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="sidebar-garden">
                <Flower variant={1} />
                <span className="little-star">✧</span>
                <h3>让成长，每天发生</h3>
                <p>
                  不求一步千里，
                  <br />
                  只愿每天一点点。
                </p>
                <div className="dotted-line" />
                <span>
                  <Leaf size={13} />
                  你的大脑，值得被照顾
                </span>
              </div>
              <button className="sidebar-settings" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
                偏好设置
              </button>
              <button
                className="profile-button"
                onClick={() => setProfilesOpen(true)}
                aria-label="管理用户档案"
              >
                <span className="avatar">
                  <Flower variant={profile.avatar} />
                </span>
                <span>
                  <strong>{profile.name}</strong>
                  <small>我的小花园</small>
                </span>
                <ArrowRight size={17} />
              </button>
            </div>
          </aside>
          <div className="mobile-header">
            <button className="mobile-brand" onClick={() => navigate('home')}>
              <Flower />
              <strong>脑力花园</strong>
            </button>
            <button
              className="avatar"
              onClick={() => setProfilesOpen(true)}
              aria-label="管理用户档案"
            >
              <Flower variant={profile.avatar} />
            </button>
          </div>
          <main className="main-content" id="main" tabIndex={-1} ref={mainRef}>
            {warning && (
              <div className="storage-warning" role="alert">
                {warning}
              </div>
            )}
            {offline && (
              <div className="offline-banner">
                <WifiOff size={15} />
                离线也可以，安心练习吧。
              </div>
            )}
            {page === 'home' ? (
              <Home
                profile={profile}
                plan={plan}
                onDaily={(id) => startDaily(today, id)}
                onPlay={(id) => start(id, 'free')}
                onLibrary={() => navigate('library')}
              />
            ) : page === 'library' ? (
              <Library profile={profile} onPlay={(id) => start(id, 'free')} />
            ) : (
              <Progress profile={profile} />
            )}
          </main>
          <nav className="bottom-nav" aria-label="移动导航">
            {navItems.map(({ id, name, Icon }) => (
              <button
                key={id}
                className={page === id ? 'active' : ''}
                onClick={() => navigate(id)}
                aria-current={page === id ? 'page' : undefined}
              >
                <Icon size={22} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
      {(profilesOpen || settingsOpen) && (
        <Profiles
          store={store}
          initialSettings={settingsOpen}
          onChange={(next) => {
            setSession(null);
            commit(next);
          }}
          onClose={() => {
            setProfilesOpen(false);
            setSettingsOpen(false);
          }}
        />
      )}
      {celebrate && (
        <Modal title="今天的花园，盛开啦！" onClose={() => setCelebrate(false)}>
          <div className="celebration">
            <Flower />
            <div className="celebration-check">
              <Check size={22} />
            </div>
            <h3>四项训练，全部完成</h3>
            <p>
              给坚持的自己一个大大的赞。
              <br />
              明天，花园会准备新的小挑战。
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setCelebrate(false);
                navigate('progress');
              }}
            >
              <Flower2 size={19} />
              看看我的成长
            </button>
            <button
              className="text-button centered"
              onClick={() => setCelebrate(false)}
              aria-label="回到花园"
            >
              <HomeIcon size={22} />
              <span className="reader-help">回到花园</span>
            </button>
          </div>
        </Modal>
      )}
      {warning && session && (
        <div className="player-storage-warning" role="alert">
          {warning}
        </div>
      )}
    </>
  );
}
