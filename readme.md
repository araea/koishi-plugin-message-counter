# koishi-plugin-message-counter

[![npm](https://img.shields.io/npm/v/koishi-plugin-message-counter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-message-counter)

## 简介

Koishi 的消息数量统计插件。发言排行榜。

## 注意事项

- 仅记录群聊消息。
- 初始化：需要权限等级 3 级。

## 关键指令

- `messageCounter.查询 [指定用户]`: 查询指定用户的发言次数信息（次数[排名]）。

  - `--yesterday`/`-d`/`-w`/`-m`/`-y`/`-t`: 分别查询昨日/今日/本周/本月/今年/总发言次数[排名] 。
  - `--ydag`/`--dag`/`--wag`/`--mag`/`--yag`/`-a`: 分别查询跨群昨日/今日/本周/本月/今年/总发言次数[排名]。


- `messageCounter.排行榜 [显示的人数]`: 发言排行榜，使用以下选项指定类型：

  - `--whites`: 白名单，只显示白名单用户，以空格、中英文逗号和顿号作为分隔符。
  - `--blacks`: 黑名单，不显示黑名单用户，以空格、中英文逗号和顿号作为分隔符。
  - `--yesterday`/`-d`/`-w`/`-m`/`-y`/`-t`:  分别查询昨日/今日/本周/本月/今年/总发言排行榜。
  - `--ydag`/`--dag`/`--wag`/`--mag`/`--yag`/`--dragon`: 分别查询跨群昨日/今日/本周/本月/今年/总发言排行榜（圣龙王榜）。
  - 默认为今日发言榜。

- `messageCounter.群排行榜 [number:number]`:  各个群聊的发言排行榜，可以指定显示的数量，也可以使用以下选项来指定排行榜的类型：

  - `-s`: 指定用户的群发言排行榜，可用 at 或 用户 ID 指定。
  - `--whites`: 白名单，只显示白名单群，以空格、中英文逗号和顿号作为分隔符。
  - `--blacks`: 黑名单，不显示黑名单群，以空格、中英文逗号和顿号作为分隔符。
  - `-d`/`-w`/`-m`/`-y`/`-t`/`--yesterday`: 分别查询昨日/今日/本周/本月/今年/总发言排行榜️。
  - 默认为今日发言榜。

## 自定义水平柱状图 3

1. 用户图标:

- 支持为同一用户添加多个图标，它们会同时显示。
- 在 `data/messageCounterIcons` 文件夹下添加用户图标，文件名为用户 ID (例如 `1234567890.png`)。
- 多个图标的文件名需形如  `1234567890-1.png`、 `1234567890-2.png` 。

2. 柱状条背景：

- 支持为同一用户添加多个背景图片，插件会随机选择一个显示。
- 在 `data/messageCounterBarBgImgs` 文件夹下添加水平柱状条背景图片。
- 多个图片的文件名需形如 `1234567890-1.png`、`1234567890-2.png`。
- 建议图片尺寸为 850x50 像素，文件名为用户 ID (例如`1234567890.png`)。

> 重启插件以使更改生效。

## 示例截图

![2ca8001d759e64dcecb8a952e3f23a4f](https://github.com/araea/koishi-plugin-message-counter/assets/120614554/3eb50393-00a2-4400-b4fd-d54d3acee390)

## 致谢

* [Koishi](https://koishi.chat/) - 机器人框架
* [Akisa](https://forum.koishi.xyz/u/akisa/summary) - Akisa 大人
* [node-schedule](https://www.npmjs.com/package/node-schedule) - 定时任务库
* [shangxue](https://forum.koishi.xyz/u/shangxue/summary) - 推送所有频道的配置项
* [nullbczd](https://forum.koishi.xyz/u/nullbczd/summary) - 水平柱状图样式等功能

## QQ 群

- 956758505

## License

MIT License © 2024
