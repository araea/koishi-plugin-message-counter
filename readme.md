# koishi-plugin-message-counter

[![npm](https://img.shields.io/npm/v/koishi-plugin-message-counter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-message-counter)

## 🎈 介绍

koishi-plugin-message-counter 是一个基于 [Koishi](https://koishi.chat/) 的机器人插件，用于统计群聊中用户的发言次数，并生成各种排行榜，包括日榜、周榜、月榜、年榜、总榜和圣龙王榜。🐉

该插件可以自动推送排行榜，也可以手动查询。还可以选择是否统计机器人自己的发言，以及是否禁言每天发言最多的用户（即龙王）。🤐

该插件使用了 [node-schedule](https://www.npmjs.com/package/node-schedule) 来实现定时任务，以及 [Koishi](https://koishi.chat/) 的数据库接口来存储用户数据。📚

## 📦 安装

```
前往 Koishi 插件市场添加该插件即可 🚀
```

## 🎮 使用

- 该插件仅记录群聊消息，私聊消息不会被统计。🙈
- 该插件建议为指令添加指令别名，以方便用户快速查询。🚀
- 水平柱状图样式 3，可以为用户添加自定义图标，可在 `data/messageCounterIcons` 文件夹下添加用户图标，文件名为 userId，例如：`1234567890.png`。🎨
  - 同一个用户可以添加多个图标，会同时显示。多个图片请使用文件名形如：`1234567890-1.png`, `1234567890-2.png`（防止文件名相同）。🎨
- 水平柱状图样式 3，可以为用户添加自定义水平柱状条，可在 `data/messageCounterBarBgImgs` 文件夹下添加水平柱状条，图片大小请最好设置宽高为 850*50，文件名为 userId，例如：`1234567890.png`。🎨
  - 同一个用户可以添加多个水平柱状条，会随机选择一个。多个图片请使用文件名形如：`1234567890-1.png`, `1234567890-2.png`（防止文件名相同）。🎨
> 添加完图片后，记得重启插件哦 ~

## ⚙️ 配置项

### 排行榜显示设置

- `defaultMaxDisplayCount`：排行榜默认显示的人数，默认为 `20`。👥
- `isTimeInfoSupplementEnabled`：是否在显示排行榜时补充时间信息，默认值为 `true`。
- `isUserMessagePercentageVisible`：是否在排行榜中显示用户消息占比，默认值为 `false`。
- `hiddenUserIdsInLeaderboard`：在排行榜中隐藏的用户 ID 列表，默认为空。👤
- `hiddenChannelIdsInLeaderboard`：在排行榜中隐藏的频道 ID 列表，默认为空。📡

### 消息追踪设置

- `isBotMessageTrackingEnabled`：是否统计机器人自己发送的消息，默认为 `false`。🤖

### 图片转换功能设置

- `isTextToImageConversionEnabled`：是否开启将文本转为图片的功能（可选），如需启用，需要启用 `markdownToImage` 服务。🤖
- `isLeaderboardToHorizontalBarChartConversionEnabled`：是否开启排行榜转为水平柱状图的功能（可选），如需启用，需要启用 `markdownToImage` 服务。🤖
- `imageType`：图片类型，可选值为 `png`、`jpeg`、`webp`，默认为 `png`。🤖
- `width`：图片宽度，默认为 `600`。🤖
- `isFirstProgressFullyVisible`：横向柱状图第一名的进度条是否占满（对样式 3 无效）。🤖
- `maxHorizontalBarLabelLengthBeforeTruncation`：横向柱状图标签最大长度，超过则截断，默认为 `10`。🤖
- `waitUntil`：（仅样式 3）等待页面加载的事件。🤖
- `shouldMoveIconToBarEndLeft`：（仅样式 3）是否将自定义图标移动到水平柱状条末端的左侧（默认则是放在用户名的右侧）。🤖
- `horizontalBarBackgroundOpacity`：（仅样式 3）水平柱状图背景图片不透明度，默认为 `0.6`。🤖
- `horizontalBarBackgroundFullOpacity`：（仅样式 3）水平柱状图背景图片整条的不透明度，默认为 `0`。🤖
- `horizontalBarChartStyle`：水平柱状图样式，可选值为 `1`、`2`、`3`，默认为 `3`。🤖

### 自动推送设置

- `autoPush`：是否自动推送排行榜，默认为 `false`。👌
  - `shouldSendDailyLeaderboardAtMidnight`：是否在每日 0 点自动发送排行榜，默认为 `true`。🌞
  - `dailyScheduledTimers`：每日定时发送用户今日发言排行榜的时间列表（中国北京时间），例如 `08:00`、`18:45`。如果开启上面的选项，则自动包含 0 点。🌞
  - `isGeneratingRankingListPromptVisible`：是否在生成排行榜时显示提示信息，默认为 `true`。🌞
  - `leaderboardGenerationWaitTime`：提示消息发送后，自动生成排行榜的等待时间，单位是秒，默认为 `3`。⌚️
  - `pushChannelIds`：启用自动推送排行榜功能的频道列表。⌚️
  - `shouldSendLeaderboardNotificationsToAllChannels`：是否向所有频道推送排行榜，默认为 `false`。🌐
  - `excludedLeaderboardChannels`：不推送排行榜的频道列表，默认为 `false`。🌐
  - `delayBetweenGroupPushesInSeconds`：群组推送之间的延迟时间，单位是秒，默认为 `5`。⌚️
  - `groupPushDelayRandomizationSeconds`：群组推送延迟时间的随机化时间，单位是秒，默认为 `10`。⌚️

### 用户禁言设置

- `enableMostActiveUserMuting`：是否禁言每天发言最多的用户，即龙王，默认为 `false`。🙊
  - `dragonKingDetainmentTime`：关押龙王的等待时间，单位是秒，默认为 `5`。🙊
  - `detentionDuration`：关押时长，单位是天，默认为 `1`。🙊
  - `muteChannelIds`：启用关押龙王功能的频道列表。⌚️

## 📝 命令

### messageCounter

- `messageCounter`：查看 messageCounter 帮助。❓
- `messageCounter.初始化`：初始化，清空数据表，将插件还原，需要权限等级 3 级及以上。🙏
- `messageCounter.查询 [targetUser]`：查询指定用户的发言次数信息（次数[排名]）。🔍

  - `--yesterday`：昨日发言次数[排名]。⬅️
  - `-d`：今日发言次数[排名]。🌞
  - `-w`：本周发言次数[排名]。🌙
  - `-m`：本月发言次数[排名]。📅
  - `-y`：今年发言次数[排名]。🎊
  - `-t`：总发言次数[排名]。👑
  - `--ydag`：跨群昨日发言次数[排名]。👑
  - `--dag`：跨群今日发言次数[排名]。👑
  - `--wag`：跨群本周发言次数[排名]。👑
  - `--mag`：跨群本月发言次数[排名]。👑
  - `--yag`：跨群今年发言次数[排名]。👑
  - `-a`：跨群发言总次数[排名]。🐲

- `messageCounter.排行榜 [number]`：发言排行榜，可以指定显示的人数，也可以使用以下选项来指定排行榜的类型：🏆

  - `--whites`：白名单，只显示白名单用户，可用`空格`、中英文`逗号`和`、`作为分隔符。👼
  - `--blacks`：黑名单，不显示黑名单用户，可用`空格`、中英文`逗号`和`、`作为分隔符。👿
  - `--yesterday`：昨日发言榜。⬅️
  - `-d`：今日发言榜。🌞
  - `-w`：本周发言榜。🌙
  - `-m`：本月发言榜。📅
  - `-y`：今年发言榜。🎊
  - `-t`：总发言榜。👑
  - `--ydag`：跨群昨日发言榜。👑
  - `--dag`：跨群今日发言榜。👑
  - `--wag`：跨群本周发言榜。👑
  - `--mag`：跨群本月发言榜。👑
  - `--yag`：跨群今年发言榜。👑
  - `--dragon`：圣龙王榜，显示每个用户在所有群中的总发言次数。🐲
  - 若未指定排行榜类型，则默认为今日发言榜。💬

- `messageCounter.群排行榜 [number:number]`：各个群聊的发言排行榜，可以指定显示的数量，也可以使用以下选项来指定排行榜的类型：🏆

  - `--whites`：白名单，只显示白名单群，可用`空格`、中英文`逗号`和`、`作为分隔符。👼
  - `--blacks`：黑名单，不显示黑名单群，可用`空格`、中英文`逗号`和`、`作为分隔符。👿
  - `-d`：今日发言榜。🌞
  - `-w`：本周发言榜。🌙
  - `-m`：本月发言榜。📅
  - `-y`：今年发言榜。🎊
  - `-t`：总发言榜。👑
  - `--yesterday`：昨日发言榜。⬅️
  - 若未指定排行榜类型，则默认为今日发言榜。💬

## 🌸 测试图
> 特此感谢 [nullbczd](https://forum.koishi.xyz/u/nullbczd/summary) 大人！喵 ~！！！
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

如有任何问题或建议，欢迎联系我哈~ 🎈
