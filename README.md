# 脑力花园

一个完全本地运行的简体中文脑力训练应用。React + TypeScript + Vite，无后端、账号、外部 AI 或远程媒体依赖。

[在线体验](https://brain-trainer-ezz.pages.dev) · [GitHub 源码](https://github.com/Troyanovsky/brain-trainer)

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
- 十款独立游戏：记忆闪格、星光顺序、图形接龙、点点规律、火眼金睛、缤纷找色、大小速判、图案追踪、点点合合、反向指令。
- 五个难度，依据最近表现与场内连续正确逐步调整；正确率与实际作答速度决定得分。
- 七日活动、14 日表现、五种能力覆盖、每款游戏的个人最好、连续练习与六枚成就。
- 档案新增、编辑、切换、确认删除；历史、推荐与设置完全隔离。多标签页切换会结束过期游戏会话。
- 原创 SVG 花园插画、手机底部导航、大按钮、键盘支持、对话框焦点管理、减少动画与独立音效设置。
- 逐游戏具体图形示范、同向/反向冗余规则图例、可纠错不计分试玩；正式游戏在隐藏辅助文字并静音后仍可完成。

## 验证

```sh
npm test
npm run build
npm run test:e2e
```

浏览器测试使用串行运行，并自动启动/关闭生产预览服务器。在 macOS 自动使用已安装的 Google Chrome；其他系统先运行 `npx playwright install chromium`，或设置 `BRAIN_GARDEN_BROWSER` 为 Chromium/Chrome 可执行文件路径。

逻辑测试涵盖推荐稳定与轮换、难度、计分、连续天数、成就、档案隔离、损坏存储保护，以及十款游戏各五个难度的 100 个种子。浏览器测试实际完成十款游戏、每日训练全流程、档案 CRUD、跨标签页同步、最高难度触控、移动布局、键盘焦点、自动化无障碍检查和离线游玩。详细结果与审查限制见 [交付与审查记录](docs/brain-garden/verification.md)。

## 文档与结构

- [产品需求与验收标准](docs/brain-garden/spec.md)
- [交互与信息架构](docs/brain-garden/ux.md)
- [十款游戏机制与计分](docs/brain-garden/games.md)
- [技术架构与数据契约](docs/brain-garden/design.md)
- [视觉设计系统](docs/visual.md)
- [无识字玩法审查与修订](docs/brain-garden/literacy-review.md)
- [GitHub 与 Cloudflare Pages 自动部署](docs/deployment.md)

`src/domain/` 包含可独立测试的目录、推荐、统计与存储；`src/games/engine.ts` 生成题目，`Visuals.tsx` 提供点阵/图章/方向规则图例，`GameDemo.tsx` 提供图解和不计分试玩，`GameBoard.tsx` 渲染不同题型，`GamePlayer.tsx` 管理场次和计时；`src/pages/` 为三个主界面和档案管理；`src/components/` 为复用组件与本地 SVG 插画。

添加游戏时，为 `GameId`、`catalog.ts` 和生成器增加规则，按需添加独立棋盘适配器，配套生成器与真实作答测试；推荐会从目录按能力自动选择。

## 数据与限制

数据保存在当前浏览器的 `brain-garden-v1` localStorage 键中。没有云同步或跨设备恢复；清理浏览器数据会清空档案。损坏的原始数据会在被替换前保留到 `brain-garden-recovery-v1`；如果恢复副本无法写入，则拒绝覆盖原始数据并提示保存失败。此副本仅用于手动故障恢复，不是持续备份功能。

游戏 ID 与旧历史保持不变；六款调整机制的游戏标记 `rulesVersion: 2`。旧记录仍计入整体活动，但不决定新版起始难度或新版个人最好。

音效需要浏览器支持 Web Audio，离线缓存需要 HTTPS 或 localhost 及 Service Worker；首次缓存完成前不能保证离线。当前以 Chromium 自动化验证为主，尚未在真实 iOS/Android 设备完成触控与读屏器测试。图形游戏不能完全替代非视觉练习；缤纷找色需要辨色能力；正式回合不要求识别文字、数字或算式，但仍需理解基本数量、方向和匹配关系。表现图只表示游戏练习结果，不属于认知或医学评估。
