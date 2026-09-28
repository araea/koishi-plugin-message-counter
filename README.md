# 发言计数器

Koishi 插件：统计群内发言次数，生成用户与频道排行榜及柱状图

[![GitHub](https://img.shields.io/badge/GitHub-仓库-181717)](https://github.com/araea/koishi-plugin-message-counter) [![npm](https://img.shields.io/badge/npm-包-CB3837)](https://www.npmjs.com/package/koishi-plugin-message-counter)

## 安装

```sh
yarn add koishi-plugin-message-counter
```

启用插件，并安装 `database` 与 `cron` 服务。生成柱状图需要 `puppeteer` 与 `canvas` 服务。资源目录为 `data/messageCounter/`，含 `icons`、`barBgImgs` 与 `fonts`。

## 快速使用

启用后在群内使用指令：

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

时间范围选项：`-d` 今日、`--yd` 昨日、`-w` 本周、`-m` 本月、`-y` 今年、`-t` 总计。`msgcount.排行榜` 与 `msgcount.查询` 支持跨频道变体（`dag`/`wag`/`mag`/`yag`/`tag` 等），`msgcount.频道排行榜` 支持 `-s <用户>` 只看某人。

`msgcount.清空记录` 先显示影响范围与确认码，须在 5 分钟内由同一用户、同一频道以 `--confirm <确认码>` 确认后才执行。

## 配置

| 配置项 | 类型 | 默认值 |
| --- | --- | --- |
| `isBotMessageTrackingEnabled` | boolean | `false` |
| `enableCrossBotDeduplication` | boolean | `true` |
| `enableYesterdayRanking` | boolean | `true` |
| `defaultMaxDisplayCount` | number | `20` |
| `isTimeInfoSupplementEnabled` | boolean | `true` |
| `isUserMessagePercentageVisible` | boolean | `true` |
| `hiddenUserIdsInLeaderboard` | string[] | `[]` |
| `hiddenChannelIdsInLeaderboard` | string[] | `[]` |
| `isLeaderboardToHorizontalBarChartConversionEnabled` | boolean | `false` |
| `autoPush` | boolean | `false` |
| `enableMostActiveUserMuting` | boolean | `false` |

其余为渲染与背景主题的视觉选项（图片格式、视口宽度、头像形状、背景类型与配色、字体、推送时机与「抓龙王」参数等），可在插件配置面板中调整。

## 限制 / 风险

关闭 `enableYesterdayRanking` 后，`--yd` 昨日榜、跨频道昨日榜与「抓龙王」禁用，相关选项从指令中隐藏；重新开启需等到下一个零点才有昨日数据。

生成柱状图需要 `puppeteer` 与 `canvas`，未安装时仅文字排行榜可用。

在水平柱状图中，昵称超出条长时以 `…` 截断收尾。

`enableMostActiveUserMuting` 开启后，每日 0 点会禁言昨日发言最多者，启用前确认频道允许自动禁言。

## 必要链接

- GitHub：<https://github.com/araea/koishi-plugin-message-counter>
- npm：<https://www.npmjs.com/package/koishi-plugin-message-counter>
