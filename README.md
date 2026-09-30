# 发言计数器

Koishi 插件：统计群内发言次数，生成用户与频道排行榜及柱状图

[![GitHub](https://img.shields.io/badge/GitHub-araea%2Fkoishi--plugin--message--counter-181717?logo=github&logoColor=white)](https://github.com/araea/koishi-plugin-message-counter)
[![npm](https://img.shields.io/npm/v/koishi-plugin-message-counter?logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/koishi-plugin-message-counter)

## 安装

```sh
npm i koishi-plugin-message-counter
```

启用插件，并安装 `database` 与 `cron` 服务。柱状图需要 `puppeteer` 与 `canvas` 服务。资源目录为 `data/messageCounter/`，含 `icons`、`barBgImgs` 与 `fonts`。

## 快速使用

| 指令 | 说明 |
| --- | --- |
| `msgcount` | 查看帮助 |
| `msgcount.查询 [用户]` | 查看发言次数与排名 |
| `msgcount.排行榜 [人数]` | 查看本频道用户排行 |
| `msgcount.频道排行榜 [人数]` | 查看各频道排行 |
| `msgcount.上传柱状条背景` | 上传个人柱状条底图 |
| `msgcount.重载资源` | 重载图标、背景与字体（权限 2） |
| `msgcount.清理缓存` | 清理过期头像缓存（权限 3） |
| `msgcount.清空记录` | 清空全部发言记录（权限 3） |

时间范围选项：`-d` 今日、`--yd` 昨日、`-w` 本周、`-m` 本月、`-y` 今年、`-t` 总计。`msgcount.排行榜` 与 `msgcount.查询` 支持跨频道变体（`dag` / `wag` / `mag` / `yag` / `tag` 等），`msgcount.频道排行榜` 支持 `-s <用户>` 只看某人。

`msgcount.清空记录` 先显示影响范围与确认码，须在 5 分钟内由同一用户、同一频道以 `--confirm <确认码>` 确认后才执行。

## 配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `isBotMessageTrackingEnabled` | boolean | `false` | 统计 Bot 自己发送的消息 |
| `enableCrossBotDeduplication` | boolean | `true` | 跨机器人消息去重 |
| `enableYesterdayRanking` | boolean | `true` | 统计昨日发言 |
| `defaultMaxDisplayCount` | number | `20` | 排行榜默认显示人数，0 表示全部（仍受上限约束） |
| `maxDisplayCount` | number | `100` | 排行榜最多显示人数，指令后的数字超过按它出图；0 表示不设上限 |
| `isTimeInfoSupplementEnabled` | boolean | `true` | 在排行榜标题显示生成时间 |
| `isUserMessagePercentageVisible` | boolean | `true` | 显示各人的消息数占比 |
| `hiddenUserIdsInLeaderboard` | string[] | `[]` | 全局隐藏的用户 ID |
| `hiddenChannelIdsInLeaderboard` | string[] | `[]` | 全局隐藏的频道 ID |
| `isLeaderboardToHorizontalBarChartConversionEnabled` | boolean | `false` | 渲染成水平柱状图 |
| `autoPush` | boolean | `false` | 定时自动推送排行榜 |
| `enableMostActiveUserMuting` | boolean | `false` | 每日 0 点禁言昨日发言最多者 |

其余为渲染与背景主题的视觉选项（图片格式、视口宽度、头像形状、背景类型与配色、字体、推送时机与「抓龙王」参数等），可在插件配置面板中调整。

## 限制 / 风险

关闭 `enableYesterdayRanking` 后，昨日榜、跨频道昨日榜与「抓龙王」禁用，相关选项从指令中隐藏；重新开启需等到下一个零点才有昨日数据。

柱状图需要 `puppeteer` 与 `canvas`，未安装时仅文字排行榜可用。水平柱状图中，昵称超出条长时以 `…` 截断。

`enableMostActiveUserMuting` 开启后，每日 0 点会禁言昨日发言最多者；启用前确认频道允许自动禁言。

## 必要链接

- [设计系统](DESIGN_SYSTEM.md)
- [MIT](LICENSE-MIT) / [Apache-2.0](LICENSE-APACHE)
