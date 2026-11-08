# 脑力花园

一个完全本地运行的简体中文脑力训练应用。React + TypeScript + Vite，无后端、账号、外部 AI 或远程媒体依赖。

[在线体验](https://brain-trainer-ezz.pages.dev) · [GitHub 源码](https://github.com/Troyanovsky/brain-trainer)

在线地址由 Cloudflare Pages 随 `main` 最近一次成功构建与部署更新。

## 启动

需要 Node.js 22 或更高版本。

```sh
npm ci
npm run dev
```

打开终端输出的本地地址（通常为 http://localhost:5173）。

```sh
npm run build
npm run preview
```

生产产物位于 `dist/`，可部署到任意支持 HTTPS 的静态站点根目录。首次在线打开生产版并完成 Service Worker 安装后，可以断网刷新并继续游戏。开发模式不注册离线缓存。

## 功能

- 每日四项均衡训练，一键开始、逐项续接，刷新后保留完成进度。
- 十三款独立游戏：原有十款全部保留，并加入中央方向、送物路线、拼块空位。
- 五个难度，依据当前规则的近期表现与场内连续正确逐步调整。
- 七日活动、14 日表现、五种能力覆盖、每款游戏的个人最好、连续练习与六枚成就。
- 档案新增、编辑、切换、确认删除；历史、推荐与设置完全隔离。多标签页切换会结束过期游戏会话。
- 原创 SVG 花园插画、手机底部导航、大按钮、键盘支持、对话框焦点管理、减少动画与独立音效设置。
- 逐游戏具体图形示范；三款新游戏必须先完成可纠错、不计分试玩，正式游戏在隐藏辅助文字并静音后仍可完成。
- 每日计划仍选四种不同能力。送物路线和拼块空位同属逻辑力，因此不会同时进入同一份均衡计划；已保存计划不会重抽。
- 标准游戏与中央方向按正确率和实际作答速度计分；送物路线按完成与有上限的路径效率计分；
  拼块空位按正确放置计分。送物路线与拼块空位都不奖励速度。

## 验证

```sh
npm test
npm run build
npm run test:e2e
```

浏览器测试使用串行运行，并自动启动/关闭生产预览服务器。在 macOS 自动使用已安装的 Google Chrome；其他系统先运行 `npx playwright install chromium`，或设置 `BRAIN_GARDEN_BROWSER` 为 Chromium/Chrome 可执行文件路径。

2026-11-08 的最终本地检查为：`npm test` 55/55、`npm run check`、`npm run build`、Prettier（`src` 与
`tests`）及 `git diff --check` 通过；完整串行浏览器验收
`npm run test:e2e` 38/38，在 8 个文件中用时约 5.2 分钟。十三款游戏各五个难度的 100 个种子共生成
6,500 道题。初始 30 项逻辑测试、20 项浏览器场景等较早记录保留在
[交付与审查记录](docs/brain-garden/verification.md) 中，并已明确标为历史记录。

浏览器验收覆盖隐藏辅助文字且静音后的全部十三款游戏、三款新游戏的试玩与纠错、360px/768px
触控尺寸、键盘、axe、后台暂停、每日计划收尾、档案隔离、离线重载，以及 6 个持久化场景。
独立代码审查修复并复查后无剩余 P1/P2 源代码问题。真实儿童、老人、iOS/Android 设备和读屏器
测试仍未进行；这些游戏是娱乐练习，不是临床认知评估。

## 文档与结构

- [产品需求与验收标准](docs/brain-garden/spec.md)
- [交互与信息架构](docs/brain-garden/ux.md)
- [十三款游戏机制、回合与计分](docs/brain-garden/games.md)
- [技术架构与数据契约](docs/brain-garden/design.md)
- [视觉设计系统](docs/visual.md)
- [无识字玩法审查与修订](docs/brain-garden/literacy-review.md)
- [GitHub 与 Cloudflare Pages 自动部署](docs/deployment.md)
- [本地数据兼容策略与受保护存储切换状态](docs/data-compatibility/design.md)
- [开发与部署规则](AGENTS.md)
- [Lumosity 游戏扩展调研与建议](docs/game-expansion-research.md)
- [三款游戏扩展实现设计](docs/game-expansion/design.md)
- [独立审查与修复记录](docs/game-expansion/review.md)
- [游戏扩展最终验证](docs/game-expansion/verification.md)

`src/domain/` 包含可独立测试的目录、推荐、统计、数据契约、存储事务和存储外壳适配；
`src/games/engine.ts` 生成题目，`Visuals.tsx` 提供点阵/图章/方向规则图例，
`GameDemo.tsx` 与 `ExpansionPractice.tsx` 提供图解和试玩，`GameBoard.tsx` 选择题型棋盘，
`GamePlayer.tsx` 管理场次、计时、计分与结果。`src/App.tsx` 通过 `openStore` / `transactStore`
协调读写；页面与棋盘不直接写 localStorage。`src/pages/` 为主要页面和档案管理，
`src/components/` 为复用组件与本地 SVG 插画。

添加游戏时，为 `GameId`、`catalog.ts` 和生成器增加规则，按需添加独立棋盘适配器，
配套生成器、可玩与兼容测试；推荐会从目录按能力自动选择。不得复用 ID，机制或计分变化必须先评估
`rulesVersion` 与分数可比性。

## 数据与限制

当前受保护记录使用 `brain-garden-store`，外壳为
`{format:'brain-garden-store', schemaVersion:1, revision, store}`；内层档案契约保持
`version: 1`。首次打开旧版数据时，只会从 `brain-garden-v1` 做一次严格校验导入，
并用 `brain-garden-store-initialized` 的 pending → committed 标记和指纹防止重复导入。
实际数据变更通过 `navigator.locks` 的 `brain-garden-store-write` 串行执行，每次锁内重读最新
revision 和记录。没有 Web Locks 的浏览器可以读取并临时游玩，但不会假装保存成功。

无法读取、含未知记录或来自更新 schema 的规范数据会失败关闭写入，并保留原始数据。
应用最多保存一份 `brain-garden-recovery` 原始快照，记录最长 1,000,000 字符；
旧应用可能留下的副本键为 `brain-garden-recovery-v1`。界面可下载当前受保护原始数据或一份快照，
“删除恢复快照”会清除应用管理的新旧恢复副本，不会删除受保护的当前规范原始数据；
处于不可读保护状态时，当前原始数据仍可单独下载。
下载文件在应用控制之外，**不是**可导入的跨设备恢复功能。

删除档案会先清除整个本地旧版与恢复副本，避免已删除档案残留在旧副本中；这些副本可能也包含
其他档案的旧备份，因此会整份清除。当前规范记录中的其他档案保持不变。任一副本清理失败时，
删除不会提交并显示警告。已下载到应用外的文件需自行处理。

游戏 ID 与旧历史保持不变；六款旧游戏调整机制后为 `rulesVersion: 2`，三款新游戏为 1，
其余旧游戏仍为 1。旧规则记录保留在活动统计中，但不决定当前规则下的起始难度或个人最好。
“全能园丁”仍以十款不同游戏解锁，文案为「体验 10 款不同游戏」；游戏库数量从目录派生为
十三款。

本次完成的是受保护存储切换，不是完整迁移平台或通用备份产品。core/feature 数据拆分、
`coreVersion`、`scoringVersion`、`algorithmVersion`、版本迁移注册表、可导入导出/合并的便携备份、
未知记录的不透明归档，以及完整降级保护仍未实现。具体当前边界与后续验收门见
[数据兼容策略](docs/data-compatibility/design.md)。

音效需要浏览器支持 Web Audio，离线缓存需要 HTTPS 或 localhost 及 Service Worker；首次缓存完成前不能保证离线。当前以 Chromium 自动化验证为主，尚未在真实 iOS/Android 设备完成触控与读屏器测试。图形游戏不能完全替代非视觉练习；缤纷找色需要辨色能力；正式回合不要求识别文字、数字或算式，但仍需理解基本数量、方向和匹配关系。表现图只表示游戏练习结果，不属于认知或医学评估。
