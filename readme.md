# koishi-plugin-message-counter 📊

[![npm](https://img.shields.io/npm/v/koishi-plugin-message-counter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-message-counter)

## 🎉 简介

用于统计群聊成员的发言活跃度。 📈 它能够追踪群内用户的每日、每周、每月、每年以及总发言次数，并自动生成美观的排行榜，包括日榜、周榜、月榜、年榜、总榜以及跨群总榜（圣龙王榜）🐲。

你可以配置插件自动推送排行榜到指定群聊，也可以通过指令手动查询。此外，插件还提供了丰富的自定义选项，例如是否统计机器人自身的发言 🤖、是否禁言每日发言最多的用户（龙王）🙊、自定义排行榜显示人数、隐藏特定用户或频道等等。

## 📦 安装

```
前往 Koishi 插件市场添加该插件即可 🚀
```

## 🎮 使用指南

### 基本使用

- 插件仅统计群聊消息，私聊消息不会被记录 🙈。
- 建议为插件指令设置别名，方便用户快速查询 🚀。

### 高级功能：自定义水平柱状图

水平柱状图样式 3 支持强大的自定义功能，让你的排行榜更加个性化！🎨

* **自定义用户图标**:
  - 在 `data/messageCounterIcons` 文件夹下添加用户图标，文件名为用户 ID (例如 `1234567890.png`)。
  - 支持为同一用户添加多个图标，它们会同时显示。多个图标的文件名需形如  `1234567890-1.png`、 `1234567890-2.png` 。
* **自定义水平柱状条背景**:
  - 在 `data/messageCounterBarBgImgs` 文件夹下添加水平柱状条背景图片，建议图片尺寸为 850*50 像素，文件名为用户 ID (例如
    `1234567890.png`)。
  - 支持为同一用户添加多个背景图片，插件会随机选择一个显示。多个图片的文件名需形如 `1234567890-1.png`、`1234567890-2.png`。

> 添加完图片后，记得重启插件以使更改生效！ 🔄

## ⚙️ 配置项

### 功能设置

- `isYesterdayCommentRankingDisabled`: 是否禁用昨日发言排行榜，默认为 `false` 🔕。

### 排行榜显示设置

- `defaultMaxDisplayCount`: 排行榜默认显示的人数，默认为 `20` 👥。
- `isTimeInfoSupplementEnabled`: 是否在显示排行榜时补充时间信息，默认为 `true` ⏰。
- `isUserMessagePercentageVisible`: 是否在排行榜中显示用户消息占比，默认为 `false` 📊。
- `hiddenUserIdsInLeaderboard`: 在排行榜中隐藏的用户 ID 列表，默认为空数组 [] 👤。
- `hiddenChannelIdsInLeaderboard`: 在排行榜中隐藏的频道 ID 列表，默认为空数组 [] 📡。

### 消息追踪设置

- `isBotMessageTrackingEnabled`: 是否统计机器人自身发送的消息，默认为 `false` 🤖。

### 图片转换功能设置

- `isTextToImageConversionEnabled`: 是否开启将文本转换为图片的功能（可选），需启用 `markdownToImage` 服务 🖼️。
- `isLeaderboardToHorizontalBarChartConversionEnabled`: 是否开启将排行榜转换为水平柱状图的功能（可选），需启用
  `markdownToImage` 服务 📊。
- `imageType`: 图片类型，可选值为 `png`、`jpeg`、`webp`，默认为 `png` 🖼️。
- `width`: 图片宽度，默认为 `600` 📏。
- `isFirstProgressFullyVisible`: 横向柱状图第一名的进度条是否占满（对样式 3 无效），默认为 `false` 📊。
- `maxHorizontalBarLabelLengthBeforeTruncation`: 横向柱状图标签最大长度，超过则截断，默认为 `10` 🏷️。
- `waitUntil`: （仅样式 3）等待页面加载的事件 ⏳。
- `shouldMoveIconToBarEndLeft`: （仅样式 3）是否将自定义图标移动到水平柱状条末端的左侧（默认放在用户名的右侧），默认为
  `false` 📍。
- `horizontalBarBackgroundOpacity`: （仅样式 3）水平柱状图背景图片不透明度，默认为 `0.6` 🌫️。
- `horizontalBarBackgroundFullOpacity`: （仅样式 3）水平柱状图背景图片整条的不透明度，默认为 `0` 🌫️。
- `horizontalBarChartStyle`: 水平柱状图样式，可选值为 `1`、`2`、`3`，默认为 `3` 📊。

### 自动推送设置

- `autoPush`: 是否自动推送排行榜，默认为 `false` 👌。
  - `shouldSendDailyLeaderboardAtMidnight`: 是否在每日 0 点自动发送排行榜，默认为 `true` 🕛。
  - `dailyScheduledTimers`: 每日定时发送用户今日发言排行榜的时间列表（中国北京时间），例如 `08:00`、`18:45`。如果开启
    `shouldSendDailyLeaderboardAtMidnight` 选项，则自动包含 0 点 ⏰。
  - `isGeneratingRankingListPromptVisible`: 是否在生成排行榜时显示提示信息，默认为 `true` 💬。
  - `leaderboardGenerationWaitTime`: 提示消息发送后，自动生成排行榜的等待时间，单位是秒，默认为 `3` ⏳。
  - `pushChannelIds`: 启用自动推送排行榜功能的频道 ID 列表 [] 📢。
  - `shouldSendLeaderboardNotificationsToAllChannels`: 是否向所有频道推送排行榜，默认为 `false` 🌐。
  - `excludedLeaderboardChannels`:  不推送排行榜的频道 ID 列表 [] 🔕。
  - `delayBetweenGroupPushesInSeconds`: 群组推送之间的延迟时间，单位是秒，默认为 `5` ⏱️。
  - `groupPushDelayRandomizationSeconds`:  群组推送延迟时间的随机化时间，单位是秒，默认为 `10` 🎲。

### 用户禁言设置

- `enableMostActiveUserMuting`: 是否禁言每天发言最多的用户（龙王），默认为 `false` 🙊。
  - `dragonKingDetainmentTime`:  关押龙王的等待时间，单位是秒，默认为 `5` ⏳。
  - `detentionDuration`:  关押时长，单位是天，默认为 `1` 📅。
  - `muteChannelIds`: 启用关押龙王功能的频道 ID 列表 [] 🙊。

## 📝 命令

### messageCounter

- `messageCounter`: 查看 messageCounter 插件帮助 ❓。
- `messageCounter.初始化`: 初始化插件，清空数据表，将插件还原至初始状态，需要权限等级 3 级及以上 🙏。
- `messageCounter.查询 [targetUser]`: 查询指定用户的发言次数信息（次数[排名]）🔍。

  - `--yesterday`/`-d`/`-w`/`-m`/`-y`/`-t`: 分别查询昨日/今日/本周/本月/今年/总发言次数[排名] 🗓️。
  - `--ydag`/`--dag`/`--wag`/`--mag`/`--yag`/`-a`: 分别查询跨群昨日/今日/本周/本月/今年/总发言次数[排名] 🌎。


- `messageCounter.排行榜 [number]`: 发言排行榜，可以指定显示的人数，也可以使用以下选项来指定排行榜的类型 🏆：

  - `--whites`: 白名单，只显示白名单用户，可用空格、中英文逗号和顿号作为分隔符 👼。
  - `--blacks`: 黑名单，不显示黑名单用户，可用空格、中英文逗号和顿号作为分隔符 👿。
  - `--yesterday`/`-d`/`-w`/`-m`/`-y`/`-t`:  分别查询昨日/今日/本周/本月/今年/总发言排行榜 🗓️。
  - `--ydag`/`--dag`/`--wag`/`--mag`/`--yag`/`--dragon`: 分别查询跨群昨日/今日/本周/本月/今年/总发言排行榜（圣龙王榜）
    🌎🐲。
  - 若未指定排行榜类型，则默认为今日发言榜 💬。

- `messageCounter.群排行榜 [number:number]`:  各个群聊的发言排行榜，可以指定显示的数量，也可以使用以下选项来指定排行榜的类型
  🏆：

  - `-s`: 指定用户的群发言排行榜，可用 at 或 用户 ID 指定 👤。
  - `--whites`: 白名单，只显示白名单群，可用空格、中英文逗号和顿号作为分隔符 👼。
  - `--blacks`: 黑名单，不显示黑名单群，可用空格、中英文逗号和顿号作为分隔符 👿。
  - `-d`/`-w`/`-m`/`-y`/`-t`/`--yesterday`: 分别查询昨日/今日/本周/本月/今年/总发言排行榜 🗓️。
  - 若未指定排行榜类型，则默认为今日发言榜 💬。

## 🌸 示例截图

> 特此感谢 [nullbczd](https://forum.koishi.xyz/u/nullbczd/summary) 大人！喵 ~！！！ 😽
![2ca8001d759e64dcecb8a952e3f23a4f](https://github.com/araea/koishi-plugin-message-counter/assets/120614554/3eb50393-00a2-4400-b4fd-d54d3acee390)

## 🙏 致谢

* [Koishi](https://koishi.chat/) - 机器人框架 🤖
* [Akisa](https://forum.koishi.xyz/u/akisa/summary) - Akisa 大人我爱你！💖
* [node-schedule](https://www.npmjs.com/package/node-schedule) - 定时任务库 🕒
* [shangxue](https://forum.koishi.xyz/u/shangxue/summary) - 感谢上学大人对推送所有频道配置项的建议！👍
* [nullbczd](https://forum.koishi.xyz/u/nullbczd/summary) - 感谢 nullbczd 大人对水平柱状图样式等功能的贡献！👍

## 🐱 QQ 群

- 956758505

## ✨ License

MIT License © 2024

希望您喜欢这款插件！ 💫

如有任何问题或建议，欢迎联系我！ 🎈
