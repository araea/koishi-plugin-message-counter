# koishi-plugin-message-counter

[![npm](https://img.shields.io/npm/v/koishi-plugin-message-counter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-message-counter)

## 🎈 介绍

koishi-plugin-message-counter 是一个基于 [Koishi](https://koishi.chat/) 的机器人插件，用于统计群聊中用户的发言次数，并生成各种排行榜，包括日榜、周榜、月榜、年榜、总榜和圣龙王榜。🐉

该插件可以自动推送排行榜，也可以手动查询。还可以选择是否统计机器人自己的发言，以及是否禁言每天发言最多的用户（即龙王）。🤐

该插件使用了 [node-schedule](https://www.npmjs.com/package/node-schedule) 来实现定时任务，以及 [koishi](https://koishi.chat/) 的数据库接口来存储用户数据。📚

## 📦 安装

```
前往 Koishi 插件市场添加该插件即可
```

## 🎮 使用

- 该插件仅记录群聊消息，私聊消息不会被统计。🙈
- 该插件建议为指令添加指令别名，以方便用户快速查询。🚀

## ⚙️ 配置项

- `defaultMaxDisplayCount`：排行榜默认显示的人数，默认为 `20`。👥
- `isBotMessageTrackingEnabled`：是否统计机器人自己发送的消息，默认为 `false`。🤖
- `isTextToImageConversionEnabled`：是否开启将文本转为图片的功能（可选），如需启用，需要启用 `markdownToImage` 服务。🤖
- `autoPush`：是否自动推送排行榜，默认为 `false`。👌
  - `leaderboardGenerationWaitTime`：自动生成排行榜的等待时间，单位是秒，默认为 `3`。⌚️
  - `pushGuildIds`：启用自动推送排行榜功能的群组列表。⌚️
- `enableMostActiveUserMuting`：是否禁言每天发言最多的用户，即龙王，默认为 `false`。🙊
  - `dragonKingDetainmentTime`：关押龙王的等待时间，单位是秒，默认为 `5`。🙊
  - `detentionDuration`：关押时长，单位是天，默认为 `1`。🙊
  - `muteGuildIds`：启用关押龙王功能的群组列表。⌚️

## 📝 命令

- `messageCounter`：查看 messageCounter 帮助。❓
- `messageCounter.初始化`：初始化，清空数据表，将插件还原，需要权限等级 3 级及以上。🙏
- `messageCounter.查询 [targetUser]`：查询指定用户的发言次数信息（次数[排名]）。🔍
  - `-d`：今日发言次数[排名]。🌞
  - `-w`：本周发言次数[排名]。🌙
  - `-m`：本月发言次数[排名]。📅
  - `-y`：今年发言次数[排名]。🎊
  - `-t`：总发言次数[排名]。👑
  - `--dag`：跨群今日发言总次数[排名]。👑
  - `-a`：跨群发言总次数[排名]。🐲
- `messageCounter.排行榜 [number]`：发言排行榜，可以指定显示的人数，也可以使用以下选项来指定排行榜的类型：🏆
  - `-d`：今日发言榜。🌞
  - `-w`：本周发言榜。🌙
  - `-m`：本月发言榜。📅
  - `-y`：今年发言榜。🎊
  - `-t`：总发言榜。👑
  - `--dag`：跨群今日发言榜。👑
  - `--dragon`：圣龙王榜，显示每个用户在所有群中的总发言次数。🐲
  - 若未指定排行榜类型，则默认为今日发言榜。💬

## 🙏 致谢

* [Akisa](https://forum.koishi.xyz/u/akisa/summary) - 永动机需要一个理由
* [Koishi](https://koishi.chat/) - 机器人框架
* [node-schedule](https://www.npmjs.com/package/node-schedule) - 定时任务库

## 📄 License

MIT License © 2023
