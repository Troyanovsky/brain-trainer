import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Star,
  Trophy,
  Home,
} from 'lucide-react';
import { getGame, SKILLS } from '../domain/catalog';
import type { GameId, Result } from '../domain/types';
import { scoreRound } from '../domain/training';
import { Shape } from '../components/Artwork';
import { GameDemo, GuidedPractice } from './GameDemo';
import { GameCue } from './Visuals';
import { GameBoard } from './GameBoard';
import { Modal } from '../components/Modal';
import { generateQuestion, type Question } from './engine';
import { playTone } from './sound';

const INSTRUCTIONS: Record<GameId, [string, string, string]> = {
  tiles: ['记住亮起的格子', '格子藏起来后，把它们找出来', '先看亮格，再点回原来的位置'],
  sequence: ['记住星光的顺序', '跟着闪烁顺序，依次点按图形', '看一遍，再按相同顺序点一点'],
  pattern: ['接上下一块图形', '观察图形的重复顺序，选出下一块', '圆形、三角形……接下来是什么？'],
  numbers: ['找到圆点的规律', '看看圆点怎样变多或变少，补上下一组', '只看小圆点，不用认数字'],
  odd: ['找出不一样的图形', '仔细看，点出唯一不同的那个', '形状或方向不同，就选它'],
  stroop: [
    '找同色，别看形状',
    '点和上面颜色相同的图形，形状不同也没关系',
    '先试一试：绿色星星，要选绿色圆形',
  ],
  compare: ['点圆点更多的一边', '比较两堆小圆点，点数量更多的一边', '只看哪边的圆点多，不用认数字'],
  schulte: [
    '照着图案找一找',
    '看上方的目标图案，在方格里点出一样的',
    '点对后目标会更换，跟着新图案继续找',
  ],
  math: [
    '小圆点，合在一起',
    '把几堆圆点放在一起，划掉的不要算',
    '点下方和剩余圆点一样多的一组，不用认数字',
  ],
  flip: ['听清方向小指令', '「一样」跟着箭头，「相反」就换个方向', '箭头向左，要求相反时就点右'],
};
const STANDARD_ROUNDS = 6;
const TRACKING_ROUNDS = 3;
const FEEDBACK_MS = 1100;
export interface GamePlayerProps {
  gameId: GameId;
  sessionId: string;
  initialLevel: number;
  mode: 'daily' | 'free';
  planDate?: string;
  previousBest: number;
  sound: boolean;
  dailyStep?: number;
  onFinish: (result: Result) => void;
  onExit: () => void;
  onNext: () => void;
  nextAction: 'replay' | 'next' | 'finish';
}
export function GamePlayer(props: GamePlayerProps) {
  const game = getGame(props.gameId),
    skill = SKILLS[game.skill];
  const nextLabel = { replay: '再玩一局', next: '下一项训练', finish: '完成今日训练' }[
    props.nextAction
  ];
  const initialLevel = useRef(props.initialLevel).current;
  const total = props.gameId === 'schulte' ? TRACKING_ROUNDS : STANDARD_ROUNDS;
  const [phase, setPhase] = useState<'intro' | 'preview' | 'answer' | 'feedback' | 'result'>(
    'intro',
  );
  const [question, setQuestion] = useState<Question>(() =>
    generateQuestion(props.gameId, initialLevel),
  );
  const [level, setLevel] = useState(initialLevel);
  const [round, setRound] = useState(0),
    [score, setScore] = useState(0),
    [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<number[]>([]),
    [activeSequence, setActiveSequence] = useState(-1),
    [sequenceCount, setSequenceCount] = useState(0);
  const [nextNumber, setNextNumber] = useState(1),
    [wrongCell, setWrongCell] = useState(-1);
  const [feedback, setFeedback] = useState({ ok: false, earned: 0, message: '' });
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [paused, setPaused] = useState(false),
    [exitConfirm, setExitConfirm] = useState(false);
  const lock = useRef(false),
    errors = useRef(0),
    streak = useRef(0),
    elapsed = useRef(0),
    totalElapsed = useRef(0),
    started = useRef(0),
    saved = useRef(false);
  const onFinish = useRef(props.onFinish);
  onFinish.current = props.onFinish;
  const isMemory = question.kind === 'tiles' || question.kind === 'sequence';
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && (phase === 'answer' || phase === 'preview' || phase === 'feedback'))
        setPaused(true);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'answer' || paused || exitConfirm) return;
    started.current = performance.now();
    return () => {
      elapsed.current += performance.now() - started.current;
    };
  }, [phase, paused, exitConfirm]);
  useEffect(() => {
    if (phase !== 'preview' || paused || exitConfirm) return;
    if (question.kind === 'tiles') {
      const timer = window.setTimeout(
        () => {
          elapsed.current = 0;
          lock.current = false;
          setPhase('answer');
        },
        1900 + question.targets.length * 180,
      );
      return () => window.clearTimeout(timer);
    }
    if (question.kind === 'sequence') {
      setActiveSequence(-1);
      const timers: number[] = [];
      question.sequence.forEach((value, index) => {
        const delay = 450 + index * (900 - level * 45);
        timers.push(window.setTimeout(() => setActiveSequence(value), delay));
        timers.push(window.setTimeout(() => setActiveSequence(-1), delay + 460));
      });
      timers.push(
        window.setTimeout(
          () => {
            elapsed.current = 0;
            lock.current = false;
            setPhase('answer');
          },
          550 + question.sequence.length * (900 - level * 45),
        ),
      );
      return () => timers.forEach(window.clearTimeout);
    }
  }, [phase, question, paused, exitConfirm, level]);
  function advanceRound() {
    if (phase !== 'feedback' || paused || exitConfirm || !lock.current) return;
    lock.current = false;
    if (round + 1 >= total) {
      setPhase('result');
      if (!saved.current) {
        saved.current = true;
        onFinish.current({
          id: props.sessionId,
          gameId: props.gameId,
          level: initialLevel,
          rulesVersion: game.rulesVersion ?? 1,
          score,
          correct,
          rounds: total,
          completedAt: new Date().toISOString(),
          duration: Math.round(totalElapsed.current),
          mode: props.mode,
          ...(props.planDate ? { planDate: props.planDate } : {}),
        });
      }
      return;
    }
    const nextLevel = Math.max(
      1,
      Math.min(5, level + (feedback.ok && streak.current >= 2 ? 1 : !feedback.ok ? -1 : 0)),
    );
    if (streak.current >= 2) streak.current = 0;
    setLevel(nextLevel);
    setRound(round + 1);
    setPicked([]);
    setSequenceCount(0);
    setNextNumber(1);
    setWrongCell(-1);
    errors.current = 0;
    elapsed.current = 0;
    const next = generateQuestion(props.gameId, nextLevel);
    setQuestion(next);
    setPhase(next.kind === 'tiles' || next.kind === 'sequence' ? 'preview' : 'answer');
  }
  useEffect(() => {
    // A correction stays visible until the player chooses the forward icon.
    // Success still flows automatically; hiding the tab pauses both states.
    if (phase !== 'feedback' || !feedback.ok || paused || exitConfirm) return;
    const timer = window.setTimeout(advanceRound, FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [
    phase,
    paused,
    exitConfirm,
    round,
    total,
    level,
    feedback,
    score,
    correct,
    props.sessionId,
    props.gameId,
    props.mode,
    props.planDate,
    initialLevel,
  ]);
  function begin() {
    elapsed.current = 0;
    lock.current = false;
    setPhase(isMemory ? 'preview' : 'answer');
  }
  function finishRound(ok: boolean, message?: string) {
    if (lock.current || phase !== 'answer' || paused || exitConfirm) return;
    lock.current = true;
    const time = elapsed.current + performance.now() - started.current;
    totalElapsed.current += time;
    const earned = scoreRound(ok, level, time);
    setScore((value) => value + earned);
    setCorrect((value) => value + (ok ? 1 : 0));
    streak.current = ok ? streak.current + 1 : 0;
    setFeedback({
      ok,
      earned,
      message: message ?? (ok ? '太棒了，继续发光！' : '没关系，下一轮再试试'),
    });
    if (props.sound) playTone(ok);
    setPhase('feedback');
  }
  function select(index: number) {
    if (phase !== 'answer' || lock.current || paused || exitConfirm) return;
    if (question.kind === 'tiles') {
      if (picked.includes(index)) return;
      setPicked([...picked, index]);
      if (!question.targets.includes(index)) finishRound(false, '记住这些亮格，下次一定可以');
      else if (picked.length + 1 === question.targets.length) finishRound(true);
    } else if (question.kind === 'sequence') {
      setPicked([index]);
      if (question.sequence[sequenceCount] !== index) finishRound(false, '顺序差一点点，再来一轮');
      else if (sequenceCount + 1 === question.sequence.length) {
        setSequenceCount(question.sequence.length);
        finishRound(true);
      } else setSequenceCount(sequenceCount + 1);
    } else if (question.kind === 'schulte') {
      if (question.values[index] < nextNumber) return;
      if (question.values[index] === nextNumber) {
        setWrongCell(-1);
        setNextNumber(nextNumber + 1);
        if (nextNumber === question.values.length)
          finishRound(
            errors.current === 0,
            errors.current
              ? `全部找到了！这一轮点错 ${errors.current} 次，再接再厉`
              : '一个不漏，专注力满满！',
          );
      } else {
        errors.current++;
        setWrongCell(index);
        if (props.sound) playTone(false);
      }
    } else if (question.kind === 'odd') {
      setPicked([index]);
      finishRound(index === question.answer);
    } else {
      setPicked([index]);
      finishRound(index === question.answer);
    }
  }
  const playing = phase !== 'intro' && phase !== 'result';
  const feedbackActionLabel = round + 1 >= total ? '查看本场结果' : '继续下一轮';
  const hint =
    question.kind === 'tiles'
      ? phase === 'preview'
        ? '记住亮格的位置'
        : `找回 ${question.targets.length} 个亮格`
      : question.kind === 'sequence'
        ? phase === 'preview'
          ? '看星光怎样闪烁'
          : `按顺序点一遍 · ${sequenceCount}/${question.sequence.length}`
        : question.kind === 'schulte'
          ? '找到和上面一样的图案'
          : question.kind === 'odd'
            ? '点出唯一不同的图形'
            : props.gameId === 'stroop'
              ? '找同色，别看形状'
              : props.gameId === 'flip' && question.kind === 'choice'
                ? question.reverse
                  ? '和箭头相反'
                  : '和箭头一样'
                : INSTRUCTIONS[props.gameId][0];
  return (
    <div
      className="player-shell"
      style={{ '--game-color': game.color, '--game-bg': game.bg } as React.CSSProperties}
    >
      <header className="player-header">
        <button
          className="icon-button"
          aria-label="退出游戏"
          onClick={() => (playing ? setExitConfirm(true) : props.onExit())}
        >
          <ArrowLeft />
        </button>
        <div>
          <strong>{game.name}</strong>
          <span>
            {props.mode === 'daily' ? `今日训练 · 第 ${props.dailyStep ?? 1} 项` : '自由练习'} ·{' '}
            {skill.name}
          </span>
        </div>
        <div className="level-chip">难度 {level}</div>
      </header>
      <main className="player-main">
        {phase === 'intro' ? (
          <div className="game-intro">
            <span className="eyebrow">给大脑一点新鲜感</span>
            <GameDemo gameId={game.id} />
            <h1>{INSTRUCTIONS[game.id][0]}</h1>
            <p>{INSTRUCTIONS[game.id][1]}</p>
            <div className="demo-note">{INSTRUCTIONS[game.id][2]}</div>
            {(game.id === 'flip' || game.id === 'stroop') && (
              <button
                className="secondary-button practice-button"
                onClick={() => setPracticeOpen(true)}
              >
                <Hand size={22} />
                <span>先试一试 · 不计分</span>
              </button>
            )}
            <button className="primary-button" onClick={begin} aria-label="开始挑战">
              <Play size={19} fill="currentColor" />
              <span className="reader-help">开始挑战</span>
            </button>
            <small>{total} 轮小挑战 · 不用着急，慢慢来也很棒</small>
          </div>
        ) : phase === 'result' ? (
          <div className="game-result">
            <div className="result-trophy">
              <Trophy size={56} />
              <i>✦</i>
              <i>✧</i>
            </div>
            <div className="result-stars">
              {[1, 2, 3].map((n) => (
                <Star
                  key={n}
                  size={32}
                  fill={correct / total >= (n - 1) / 3 ? '#E1B251' : 'transparent'}
                  color="#C69B43"
                />
              ))}
            </div>
            <h1>{correct / total >= 0.8 ? '脑力开花，表现真棒！' : '每次练习，都在成长'}</h1>
            <p>又给大脑浇了一点水，明天也要来哦</p>
            <div className="result-score">
              <strong>{score.toLocaleString('zh-CN')}</strong>
              <span>本次得分</span>
            </div>
            {score > props.previousBest && (
              <div className="best-pill">
                <Trophy size={15} />
                新的个人最好！
              </div>
            )}
            <div className="result-details">
              <div>
                <strong>
                  {Math.round((correct / total) * 100)}
                  <small>%</small>
                </strong>
                <span>正确率</span>
              </div>
              <div>
                <strong>
                  {correct}
                  <small> / {total}</small>
                </strong>
                <span>答对回合</span>
              </div>
              <div>
                <strong>
                  {Math.max(1, Math.round(totalElapsed.current / 1000))}
                  <small> 秒</small>
                </strong>
                <span>思考时间</span>
              </div>
            </div>
            <button className="primary-button" onClick={props.onNext} aria-label={nextLabel}>
              {props.nextAction === 'replay' ? (
                <RotateCcw size={24} />
              ) : props.nextAction === 'finish' ? (
                <Trophy size={24} />
              ) : (
                <ArrowRight size={24} />
              )}
              <span className="reader-help">{nextLabel}</span>
            </button>
            <button className="text-button" onClick={props.onExit} aria-label="返回花园">
              <Home size={23} />
              <span className="reader-help">返回花园</span>
            </button>
          </div>
        ) : (
          <>
            <div className="round-top">
              <span>
                第 {round + 1} / {total} 轮
              </span>
              <span>
                <Star size={17} />
                {score} 分
              </span>
              <button className="icon-button" aria-label="暂停游戏" onClick={() => setPaused(true)}>
                <Pause size={20} />
              </button>
            </div>
            <div
              className="round-dots"
              role="img"
              aria-label={`第 ${round + 1} 轮，共 ${total} 轮`}
            >
              {Array.from({ length: total }, (_, i) => (
                <i key={i} className={i < round ? 'done' : i === round ? 'current' : ''} />
              ))}
            </div>
            <div className="round-progress">
              <div style={{ width: `${(round / total) * 100}%` }} />
            </div>
            <GameCue question={question} preview={phase === 'preview'} nextNumber={nextNumber} />
            <div className={`game-hint reader-help ${phase === 'preview' ? 'preview-hint' : ''}`}>
              <span>{phase === 'preview' ? <Eye size={20} /> : <Hand size={20} />}</span>
              <h2>{hint}</h2>
            </div>
            <div
              className={`game-board ${phase === 'feedback' ? (feedback.ok ? 'board-correct' : 'board-incorrect') : ''}`}
            >
              <GameBoard
                question={question}
                gameId={props.gameId}
                phase={phase}
                picked={picked}
                activeSequence={activeSequence}
                sequenceCount={sequenceCount}
                nextNumber={nextNumber}
                wrongCell={wrongCell}
                onSelect={select}
              />
            </div>
            <div
              className={`game-feedback ${phase === 'feedback' ? (feedback.ok ? 'success' : 'try-again') : ''}`}
              role="status"
            >
              {phase === 'feedback' ? (
                <>
                  {feedback.ok ? <Check size={24} /> : <RotateCcw size={22} />}
                  <span className="reader-help">{feedback.message}</span>
                  {feedback.earned > 0 && <strong>+{feedback.earned}</strong>}
                  {!feedback.ok && question.kind === 'choice' && question.game === 'flip' && (
                    <div className="direction-correction" role="img" aria-label="正确方向示范">
                      <span>{question.prompt}</span>
                      <ArrowRight size={19} />
                      <strong>{question.options[question.answer]}</strong>
                    </div>
                  )}
                  {!feedback.ok && question.kind === 'sequence' && (
                    <div className="sequence-correction">
                      {question.sequence.map((value, i) => (
                        <span key={i}>
                          <Shape name={['circle', 'triangle', 'square', 'star'][value]} />
                          {i < question.sequence.length - 1 && <ArrowRight size={13} />}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <span className="reader-help">
                  {phase === 'preview' ? '先看看，现在不用点' : '准备好就点一点，没有倒计时'}
                </span>
              )}
            </div>
            {phase === 'feedback' && !feedback.ok && (
              <button
                className="primary-button feedback-continue"
                aria-label={feedbackActionLabel}
                onClick={advanceRound}
              >
                <ArrowRight size={27} />
                <span className="reader-help">{feedbackActionLabel}</span>
              </button>
            )}
          </>
        )}
      </main>
      {practiceOpen && (props.gameId === 'flip' || props.gameId === 'stroop') && (
        <GuidedPractice
          gameId={props.gameId}
          onClose={() => setPracticeOpen(false)}
          onPlay={() => {
            setPracticeOpen(false);
            begin();
          }}
        />
      )}
      {paused && !exitConfirm && (
        <Modal title="歇一小会儿" onClose={() => setPaused(false)}>
          <div className="pause-content">
            <Pause size={48} />
            <p>大脑也喜欢小憩，准备好了就继续吧。</p>
            <button
              className="primary-button"
              onClick={() => setPaused(false)}
              aria-label="继续挑战"
            >
              <Play size={23} fill="currentColor" />
              <span className="reader-help">继续挑战</span>
            </button>
          </div>
        </Modal>
      )}
      {exitConfirm && (
        <Modal title="先回花园休息？" onClose={() => setExitConfirm(false)}>
          <p className="modal-copy">这场挑战还没完成，离开后本场进度不会保存。</p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={props.onExit} aria-label="退出本场">
              <Home size={23} />
              <span className="reader-help">退出本场</span>
            </button>
            <button
              className="primary-button"
              onClick={() => setExitConfirm(false)}
              aria-label="继续挑战"
            >
              <Play size={23} fill="currentColor" />
              <span className="reader-help">继续挑战</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
