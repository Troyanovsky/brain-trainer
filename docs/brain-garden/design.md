# Technical architecture

## Approach

项目最初从空仓库建立。当前继续采用 React + TypeScript + Vite、CSS 自定义属性、
lucide-react 图标和本地原创 SVG 插图。Vitest 测试纯业务、生成器与持久化，Playwright
验证完整用户流程。当前实现以 [PRD](spec.md)、[UX](ux.md) 和[游戏契约](games.md)为产品边界。

## Change map

| Path                                     | Responsibility                                            |
| ---------------------------------------- | --------------------------------------------------------- |
| `src/domain/types.ts`                    | 游戏、档案、记录、每日计划、设置数据契约                  |
| `src/domain/catalog.ts`                  | 13 款注册信息、能力、规则版本、配色                       |
| `src/domain/training.ts`                 | 日期、推荐、难度、统计、成就、通用分数纯函数              |
| `src/domain/storage.ts`                  | 存储状态、严格校验、锁、事务、恢复副本与档案删除          |
| `src/domain/migrations.ts`               | 外壳常量、编解码、指纹、恢复快照和初始化标记              |
| `src/games/engine.ts`                    | 各游戏的独立题目生成与答案数据，不包含 React              |
| `src/games/{focus,route,fit}.ts`         | 三款新游戏的纯生成、几何/路线求解与专用计分               |
| `src/games/GamePlayer.tsx`               | 游戏状态机、试玩入口、反馈、计时、计分和结果              |
| `src/games/GameBoard.tsx`                | 通用题型分发；专用 `FocusBoard`、`RouteBoard`、`FitBoard` |
| `src/games/ExpansionPractice.tsx`        | 三款新游戏必做、可纠错且不计分的图示试玩                  |
| `src/games/GameDemo.tsx` / `Visuals.tsx` | 具体图解、点阵、图章、方向规则符号                        |
| `src/components/`                        | SVG 插画、导航、游戏卡片、对话框                          |
| `src/pages/`                             | 今日、游戏库、进度、档案设置                              |
| `src/App.tsx`                            | 页面、游戏会话、存储状态和跨标签页协调                    |
| `public/sw.js`                           | 构建时注入资源清单，生产离线缓存                          |
| `tests/`                                 | 域逻辑、生成器、持久化与浏览器端到端测试                  |

## Contracts and flow

后续存储、游戏规则、计分和每日推荐的版本演进遵循
[本地数据兼容策略](../data-compatibility/design.md)。该文档区分已实现的受保护存储切换与仍未实现的
完整迁移、便携备份和细粒度版本字段。

### Store and transaction boundary

内层 `Store` 仍为
`{version:1, activeProfileId, profiles:[{id,name,avatar,settings,history,plans}]}`，ID 使用
`crypto.randomUUID`。当前规范键为 `brain-garden-store`，外壳严格为
`{format:'brain-garden-store', schemaVersion:1, revision, store}`。应用只通过
`openStore()` 和 `transactStore(mutation)` 读写。

`openStore()` 返回 `ready | recovered | unsupported | corrupt | unavailable` 状态、
`canPersist`、原始数据和可选警告。`transactStore` 的 mutation 接收锁内重读的最新 `Store`，
必须是纯更新器：不得原地修改供入快照，必须返回新的 `Store`。事务用修改前后的序列化结果判断
是否有实际变化；原地污染会破坏“最新状态更新器”的比较和并发语义。

所有持久化变更在 `navigator.locks` 的 `brain-garden-store-write` 独占锁中执行。每次锁内重读
外壳、校验 schema/revision、应用完整 `Store` mutation、严格验证输出并写入，
`revision + 1` 后回读确认。没有 Web Locks 时可读取并临时游玩，但 `canPersist` 为 false，
不执行修改。陈旧事务或校验失败不覆盖当前规范数据。

### Legacy cutover and fail-closed states

首次打开旧版数据时，仅当规范键未初始化，才从 `brain-garden-v1` 做一次严格、全额校验导入。
`brain-garden-store-initialized` 标记保存 `pending | committed`、来源、指纹和时间；一条原始
`brain-garden-recovery` 快照保留导入前字节。流程先 pending、再规范记录、再 committed；
重载可识别并完成中断的初始化，但不会因规范键缺失或档案删除而回退重导旧数据。

JSON 错误、结构错误、未知档案/游戏/字段或未来 schema 均失败关闭写入。当前实现保留原始规范字节，
不创建不透明归档，也不把未知记录解码为可写数据。应用最多保留一份恢复快照，原始字符串上限
1,000,000 字符；已有不同快照时不会覆盖。恢复下载优先使用仍受保护的当前规范原始字节，
不是便携恢复格式。

档案删除先删除 `brain-garden-v1`、`brain-garden-recovery` 和 `brain-garden-recovery-v1`
这组应用管理的本地副本，再提交删除后的规范记录。清理失败则保留当前档案并显示警告；清理成功但
规范写入失败时，当前档案仍保留且已清理副本不会恢复。其他当前档案保留。下载到应用外的文件不受
删除控制。

### Domain and gameplay flow

结果可有向后兼容的 `rulesVersion`（缺省为旧玩法 1）；六款早期机制调整游戏为 2，其余为 1。
旧规则历史保留在总活动统计中，但当前起始难度与个人最好只采用当前规则记录。
`history` 中每场唯一 ID、`gameId`、`level`、`score`、`correct`、`rounds`、`completedAt`、
`duration`、`mode` 和可选 `planDate`/`rulesVersion`。`plans` 按 `YYYY-MM-DD` 存四个
`gameId` 及 `completedIds`。计划完成必须来自对应档案、日期和计划游戏的今日会话；
自由练习和重复结果不增加计划进度。

推荐固定同日计划，从五项能力中选择四种。技能排序偏好近七日覆盖较少者，并参考近期准确率和
日期稳定哈希；每种能力选一款游戏，候选会惩罚昨日出现和近期高频，并用稳定哈希打破平局。
`route` 与 `fit` 同属逻辑力，因此不会同时进入一份新计划。已有保存计划不重抽。
使用本地日期，不用 UTC 截断。完成时归属发起档案 ID；切换或其他标签数据变化时退出活动会话。

GamePlayer 使用 `intro → preview → answer → feedback → result` 状态。标准游戏 6 回合，
`schulte`、`route`、`fit` 分别为 3、3、4 回合。每个生成器提供题型数据，通用棋盘负责分发，
路线、拼块和中央方向各有聚焦适配器。三款新游戏进入正式回合前必须完成可纠错、不计分试玩。
计时按 `performance.now`，隐藏标签时暂停；取消场次不保存。错误反馈不自动跳过，靠前进图标
继续；送物路线和拼块空位也使用手动续接。结果动作由 `replay/next/finish` 枚举决定。
回调携带 session ID 幂等去重。

## Decisions and risks

- localStorage 足以支撑本地轻量记录，减少依赖；容量不足会提示。当前没有通用备份恢复，
  超出容量时不能通过清空或裁剪记录“修复”。
- 纯客户端无需认证与外部 API；字体、插画、音效均本地。
- Service worker 仅生产注册；缓存构建 hash 资源并按版本清理旧缓存。首次加载完成缓存前不能保证离线。
- 不提供科学量表，能力图只表示练习覆盖，趋势只表示游戏表现。
- 本阶段没有 core/feature 分离、版本迁移注册表、未知记录不透明归档、通用备份/恢复/合并、
  `coreVersion`、`scoringVersion` 或 `algorithmVersion`。旧部署客户端也不理解当前规范外壳，
  不能作为数据安全回滚方案。

## Verification

Vitest 覆盖计划稳定与四技能覆盖、历史频率、难度边界、计分、日历/连续天数、档案隔离、
坏数据及受保护存储切换，包括已发布 v1 fixture、pending 恢复、未知/未来数据、锁内最新状态更新、
清理失败回滚、幂等和 6 个持久化边界。生成器覆盖 13 款游戏 × 5 个难度 × 100 个种子，
共 6,500 道题；路线有独立最优值、合法长路径与强制 fallback 检查，拼块有连通性和唯一变换等价答案。

浏览器历史记录保留在[验证与审查记录](verification.md)。当前扩展相关完整结果为 38/38 串行通过；
实际覆盖三款新游戏的图文示范、必做纠错试玩、隐藏文字/静音真实通关、聚焦日计划收尾、档案隔离、
离线重载、360px/768px 44px 触控、键盘、axe 和后台暂停。类型检查与生产构建必须通过；
修复缺陷先增加失败回归测试。文档中的自动化结果不能替代真实设备与目标人群测试。
