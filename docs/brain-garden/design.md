# Technical architecture

## Approach
空仓库，无既有约束。采用 React + TypeScript + Vite，CSS 自定义属性，lucide-react 图标，本地原创 SVG 插图。Vitest 测试纯业务与生成器，Playwright 验证完整用户流程。实现 [PRD](spec.md)、[UX](ux.md)、[游戏契约](games.md)。

## Change map
| Path | Responsibility |
|---|---|
| src/domain/types.ts | 游戏、档案、记录、每日计划、设置数据契约 |
| src/domain/catalog.ts | 10 款注册信息、能力、配色、图形标识 |
| src/domain/training.ts | 日期、推荐、难度、统计、成就、分数纯函数 |
| src/domain/storage.ts | 版本化本地存储、严格校验、失败回报 |
| src/games/engine.ts | 各游戏的独立题目生成与答案数据，不包含 React |
| src/games/GamePlayer.tsx | 游戏状态机、演示、反馈、计时、结果 |
| src/games/GameBoard.tsx | 独立题型棋盘适配器，不接触数据存储 |
| src/games/Visuals.tsx / GameDemo.tsx | 点阵、图章、规则符号、具体图解和不计分纠错试玩 |
| src/components/ | SVG 插画、导航、游戏卡片、对话框 |
| src/pages/ | 今日、游戏库、进度、档案设置 |
| src/App.tsx | 活跃档案、页面和游戏会话协调 |
| public/sw.js | 构建时注入资源清单，生产离线缓存 |
| tests/ | 域逻辑、生成器与浏览器端到端测试 |

## Contracts and flow
存储一个版本化对象：`{version:1, activeProfileId, profiles:[{id,name,avatar,settings,history,plans}]}`。ID 用 crypto.randomUUID。结果可有向后兼容的 `rulesVersion`（缺省为旧玩法 1）；六款机制调整后的当前版本为 2，旧历史保留在活动统计中，但新版难度与个人最好只采用当前版本记录。history 中每场唯一 ID、gameId、level、score、correct、rounds、completedAt、duration、mode、planDate（仅今日）。plans 按 YYYY-MM-DD 存四个 gameId 及 completedIds。一次状态更新原子写入，只有完成场次产生记录。计划完成必须来自对应档案、对应日期、对应计划游戏的今日会话；重复完成不重复增加进度。

推荐：固定同日计划；对五项能力按近 7 天覆盖少优先，以近期准确率偏低为次优先并对日期稳定轮换。选四种不同能力；每类候选按昨日出现惩罚、近七天次数惩罚、未玩奖励、历史弱项奖励排序，稳定哈希打破平局。使用本地日期，不用 UTC 截断。完成时归属发起档案 ID；切换/其他标签数据变化时退出活动会话。

GamePlayer 使用 intro → preview → answering → feedback → result 状态，退出清理所有计时器。每个生成器提供题型数据；专门渲染适配器避免十套应用壳。计时按 performance.now，隐藏标签时暂停；取消场次不保存。错误反馈不设自动跳过计时器，靠前进图标进入下一轮；成功反馈保留自动续接。结果动作由 replay/next/finish 枚举决定，不根据中文标签推断行为。回调携带 session ID 幂等去重。存储读取捕获 JSON 错误，对每层验证并隔离损坏记录；不可用时临时内存工作且明确警告。覆盖损坏原文前先写入恢复副本，副本失败则拒绝覆盖。

## Decisions and risks
- localStorage 足以支撑本地轻量记录，减少依赖；容量不足会提示，未来可迁移 IndexedDB。
- 纯客户端无需认证与外部 API；字体、插画、音效均本地。
- Service worker 仅生产注册；缓存构建 hash 资源并按版本清理旧缓存。首次加载完成缓存前不能保证离线。
- 不提供科学量表，能力图只表示练习覆盖，趋势只表示游戏表现。

## Verification
Vitest：计划稳定、每日不同、覆盖、历史频率、难度边界、计分、日历/连续天数、档案隔离、坏数据。对每款生成器多级多种子检查唯一正确答案与可完成性。浏览器：10 款真实作答、今日串联与刷新恢复、档案 CRUD 与隔离、手机布局、键盘对话框、生产离线打开。类型检查与生产构建必须通过；修复缺陷先增加失败回归测试。
