import type { GameId, GameMeta, Skill } from './types';
export const SKILLS: Record<Skill, { name: string; color: string; bg: string }> = {
  memory: { name: '记忆力', color: '#7460A8', bg: '#EEE9F8' },
  logic: { name: '逻辑力', color: '#926026', bg: '#FCEDD9' },
  attention: { name: '专注力', color: '#48745E', bg: '#E4F0E6' },
  speed: { name: '反应力', color: '#3F7090', bg: '#E4F0F7' },
  flexibility: { name: '灵活力', color: '#9D5062', bg: '#F8E7EC' },
};
const games: [GameId, string, Skill, string, string][] = [
  ['tiles', '记忆闪格', 'memory', '记住闪亮的位置，让记忆发光', '约 1 分钟'],
  ['sequence', '星光顺序', 'memory', '跟着星光，找回闪烁的顺序', '约 1 分钟'],
  ['pattern', '图形接龙', 'logic', '发现小规律，接上下一块', '约 1 分钟'],
  ['numbers', '点点规律', 'logic', '看看小圆点，找到下一组', '约 1 分钟'],
  ['route', '送物路线', 'logic', '收齐小包裹，再走到明亮的出口', '约 1 分钟'],
  ['fit', '拼块空位', 'logic', '转一转、翻一翻，让拼块住进空位', '约 1 分钟'],
  ['odd', '火眼金睛', 'attention', '找出那个不一样的小家伙', '约 1 分钟'],
  ['stroop', '缤纷找色', 'attention', '找相同颜色，别被形状带跑啦', '约 1 分钟'],
  ['focus', '中央方向', 'attention', '盯住中心指针，跟着它选方向', '约 1 分钟'],
  ['compare', '大小速判', 'speed', '不用认数字，点出圆点更多的一边', '约 1 分钟'],
  ['schulte', '图案追踪', 'speed', '看目标图案，在方格里找到它', '约 1 分钟'],
  ['math', '点点合合', 'flexibility', '把小圆点放一起，看看还剩多少', '约 1 分钟'],
  ['flip', '反向指令', 'flexibility', '跟着箭头，换个方向想一想', '约 1 分钟'],
];
export const GAMES: GameMeta[] = games.map(([id, name, skill, description, duration]) => ({
  id,
  name,
  skill,
  description,
  duration,
  rulesVersion:
    ['numbers', 'stroop', 'compare', 'schulte', 'math', 'flip'].includes(id) &&
    !['focus', 'route', 'fit'].includes(id)
      ? 2
      : 1,
  color: SKILLS[skill].color,
  bg: SKILLS[skill].bg,
}));
export function getGame(id: GameId): GameMeta {
  return GAMES.find((game) => game.id === id)!;
}
