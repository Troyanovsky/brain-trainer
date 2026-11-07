---
version: alpha
name: 脑力花园
colors:
  primary: "#426B50"
  on-primary: "#FFFFFF"
  background: "#F8F9F4"
  surface: "#FFFFFF"
  on-surface: "#293C32"
  outline: "#E4E9DF"
  secondary: "#F3D576"
  tertiary: "#DAD6F1"
  error: "#B54740"
  warning: "#856219"
  success: "#426B50"
  info: "#466C90"
typography:
  headline-lg: {fontFamily: "PingFang SC, Microsoft YaHei, sans-serif", fontSize: 36px, fontWeight: 700, lineHeight: 1.4}
  body-md: {fontFamily: "PingFang SC, Microsoft YaHei, sans-serif", fontSize: 16px, fontWeight: 400, lineHeight: 1.6}
spacing: {xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px}
rounded: {sm: 12px, md: 18px, lg: 28px, full: 9999px}
components:
  button-primary: {backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.full}", padding: "16px 28px"}
  card: {backgroundColor: "{colors.surface}", rounded: "{rounded.lg}", padding: "{spacing.lg}"}
---

# Visual system
## Overview
温柔、自然、轻松的花园游乐场。奶油底色、森林绿、柠檬黄、薰衣草紫和手绘几何植物。用可亲的花朵角色代替科技大脑图标。留白丰富，层级鲜明；不能做成密集企业仪表盘。
## Colors
绿色用于主要动作，黄色用于今日主卡；五能力各有淡彩底和深色文字。深绿文字在浅底可读。反馈必须搭配勾/叉与文案。
## Typography
使用设备中文系统字体，不下载网络字体。标题粗体 28–36px，正文 16px，辅助 12–14px；游戏数字 32–56px。
## Layout
桌面 232px 侧栏，主内容最大 1220px，内边距 44px。今日主区域 2:1 双栏。≤900px 收起侧栏并使用底部导航，≤600px 单栏、边距 20px，底部预留 safe-area。游戏台面最大 620px，格子最小 48px。
## Elevation & Depth
柔和边线，极浅阴影；主卡不使用玻璃效果或强渐变。卡片 hover 上浮 3px，点击缩小，反馈短暂弹跳。
## Shapes
大圆角卡片、胶囊按钮、圆形头像；花园 SVG 用不规则叶片、花瓣与微笑面孔。
## Components
导航图标配中文标签；活跃态淡绿底。游戏卡片上半部分为原创图形画面，下半部分标题、能力点和时长。对话框有遮罩、明显标题和关闭按钮。所有控件最少 48px，键盘焦点 3px。
## Guardrails
不展示虚构统计，不用 emoji 作为所有插画的替代。装饰图隐藏于辅助技术；遵从 prefers-reduced-motion 与档案设置，颜色辨认游戏同时提供文字答案。趣味来自游戏与图形，而非长篇规则。
