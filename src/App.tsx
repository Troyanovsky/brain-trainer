import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  Flower2,
  Gamepad2,
  Home as HomeIcon,
  Leaf,
  Settings,
  Sprout,
  Trash2,
  TrendingUp,
  WifiOff,
} from 'lucide-react';
import type { GameId, Store, Result } from './domain/types';
import {
  clearRecoverySnapshot,
  openStore,
  readRecoverySnapshot,
  STORAGE_KEY,
  transactStore,
  type OpenStoreResult,
  type StoreTransactionResult,
} from './domain/storage';
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

function mergeProfileEditorChanges(base: Store, edited: Store, latest: Store): Store {
  const baseIds = new Set(base.profiles.map((profile) => profile.id));
  const editedById = new Map(edited.profiles.map((profile) => [profile.id, profile]));
  const removedIds = new Set(
    base.profiles.filter((profile) => !editedById.has(profile.id)).map((profile) => profile.id),
  );
  const profiles = latest.profiles
    .filter((profile) => !removedIds.has(profile.id))
    .map((profile) => {
      const before = base.profiles.find((candidate) => candidate.id === profile.id);
      const after = editedById.get(profile.id);
      if (!before || !after) return profile;
      return {
        ...profile,
        ...(before.name !== after.name ? { name: after.name } : {}),
        ...(before.avatar !== after.avatar ? { avatar: after.avatar } : {}),
        ...(before.settings.sound !== after.settings.sound
          ? { settings: { ...profile.settings, sound: after.settings.sound } }
          : {}),
        ...(before.settings.reducedMotion !== after.settings.reducedMotion
          ? {
              settings: {
                ...profile.settings,
                ...(before.settings.sound !== after.settings.sound
                  ? { sound: after.settings.sound }
                  : {}),
                reducedMotion: after.settings.reducedMotion,
              },
            }
          : {}),
      };
    });
  for (const profile of edited.profiles) {
    if (!baseIds.has(profile.id) && !profiles.some((candidate) => candidate.id === profile.id))
      profiles.push(profile);
  }
  const activeProfileId = profiles.some((profile) => profile.id === edited.activeProfileId)
    ? edited.activeProfileId
    : (profiles.find((profile) => profile.id === latest.activeProfileId)?.id ?? profiles[0].id);
  return { ...latest, activeProfileId, profiles };
}

function recoveryRawForResult(
  result: OpenStoreResult,
  persisted: ReturnType<typeof readRecoverySnapshot>,
): string | null {
  if (!result.canPersist && result.raw) return result.raw;
  return persisted?.raw ?? null;
}

export default function App() {
  const [initial, setInitial] = useState<OpenStoreResult | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void openStore()
      .then((result) => {
        if (active) setInitial(result);
      })
      .catch(() => {
        if (active)
          setOpenError(
            '本地花园暂时无法打开。请刷新页面；若问题持续，请检查浏览器是否允许本地存储。',
          );
      });
    return () => {
      active = false;
    };
  }, []);

  if (!initial)
    return (
      <main className="main-content" id="main" tabIndex={-1}>
        <div className="storage-warning" role={openError ? 'alert' : 'status'}>
          {openError ?? '正在打开你的小花园…'}
        </div>
      </main>
    );
  return <GardenApp initial={initial} />;
}

function GardenApp({ initial }: { initial: OpenStoreResult }) {
  const [store, setStore] = useState(() => initial.store);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [warning, setWarning] = useState<string | null>(initial.warning);
  const canPersistRef = useRef(initial.canPersist);
  const revisionRef = useRef(initial.revision);
  const protectedRawRef = useRef<string | null>(initial.canPersist ? null : initial.raw);
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(() => {
    const persisted = readRecoverySnapshot();
    return recoveryRawForResult(initial, persisted);
  });
  const [hasRecoverySnapshot, setHasRecoverySnapshot] = useState(
    () => readRecoverySnapshot() !== null,
  );
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
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

  function applyCommittedStore(result: StoreTransactionResult) {
    if (
      result.saved &&
      result.revision !== null &&
      (revisionRef.current === null || result.revision >= revisionRef.current)
    ) {
      revisionRef.current = result.revision;
      storeRef.current = result.store;
      setStore(result.store);
      canPersistRef.current = true;
      protectedRawRef.current = null;
      setWarning(result.warning ?? null);
      const recovery = readRecoverySnapshot();
      setHasRecoverySnapshot(recovery !== null);
      setRecoveryRaw(recovery?.raw ?? null);
    }
  }

  function applyOpenedStore(result: OpenStoreResult) {
    if (
      result.revision !== null &&
      revisionRef.current !== null &&
      result.revision < revisionRef.current
    )
      return;
    storeRef.current = result.store;
    setStore(result.store);
    revisionRef.current = result.revision;
    canPersistRef.current = result.canPersist;
    protectedRawRef.current = result.canPersist ? null : result.raw;
    setWarning(result.warning);
    const recovery = readRecoverySnapshot();
    setHasRecoverySnapshot(recovery !== null);
    setRecoveryRaw(recoveryRawForResult(result, recovery));
  }

  function commitUpdate(update: (latest: Store) => Store): Promise<void> {
    let proposed: Store;
    try {
      proposed = update(storeRef.current);
    } catch {
      setWarning('这次修改无法安全应用，已保留原有记录。');
      return Promise.resolve();
    }
    storeRef.current = proposed;
    setStore(proposed);
    const task = mutationQueueRef.current.then(async () => {
      if (!canPersistRef.current) {
        setWarning(
          (current) =>
            current ?? '当前记录处于未保存模式。请保持页面打开，并在存储恢复后重新载入页面。',
        );
        return;
      }
      const result = await transactStore(update);
      if (result.saved) {
        applyCommittedStore(result);
        return;
      }
      if (result.rollback) {
        storeRef.current = result.store;
        setStore(result.store);
        revisionRef.current = result.revision;
      }
      canPersistRef.current = false;
      setWarning(result.error ?? '本次修改尚未保存，请保持页面打开。');
    });
    mutationQueueRef.current = task.catch(() => {
      canPersistRef.current = false;
      setWarning('本次修改尚未保存，请保持页面打开并检查浏览器存储设置。');
    });
    return mutationQueueRef.current;
  }
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
      void openStore()
        .then(applyOpenedStore)
        .catch(() =>
          setWarning(
            '另一个页面更新了本地记录，但当前页面无法安全读取。请刷新检查；原记录不会被覆盖。',
          ),
        );
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
    if (!profile.plans[today]) void commitUpdate((latest) => withPlan(latest, today));
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
    const sessionProfileId = session.profileId;
    void commitUpdate((latest) => {
      if (latest.activeProfileId !== sessionProfileId) return latest;
      return {
        ...latest,
        profiles: latest.profiles.map((p) =>
          p.id === sessionProfileId ? recordResult(p, result) : p,
        ),
      };
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
  function downloadRecovery() {
    if (!recoveryRaw) return;
    const blob = new Blob([recoveryRaw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `brain-garden-raw-${dateKey()}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function discardRecoverySnapshot() {
    const result = await clearRecoverySnapshot();
    if (!result.ok) {
      setWarning(result.error ?? '恢复快照未能删除，请稍后重试。');
      return;
    }
    setHasRecoverySnapshot(false);
    setRecoveryRaw(protectedRawRef.current);
  }
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
            {(warning || recoveryRaw) && (
              <div className="storage-warning" role={warning ? 'alert' : 'status'}>
                {warning && <span>{warning}</span>}
                {recoveryRaw && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: warning ? 10 : 0,
                    }}
                  >
                    <span>
                      {warning
                        ? '可先下载原始数据留存。'
                        : hasRecoverySnapshot
                          ? '本机保留了一次已校验的原始数据快照。'
                          : '可下载当前原始数据留存。'}
                    </span>
                    <button className="secondary-button" type="button" onClick={downloadRecovery}>
                      <Download size={16} />
                      下载原始数据
                    </button>
                    {hasRecoverySnapshot && (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void discardRecoverySnapshot()}
                      >
                        <Trash2 size={16} />
                        删除恢复快照
                      </button>
                    )}
                  </div>
                )}
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
            const editorBase = store;
            void commitUpdate((latest) => mergeProfileEditorChanges(editorBase, next, latest));
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
