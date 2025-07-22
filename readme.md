# koishi-plugin-message-counter

Koishi 的消息数量统计插件。发言排行榜。

[![github](https://img.shields.io/badge/github-araea/message_counter-8da0cb?style=for-the-badge&labelColor=555555&logo=github)](https://github.com/araea/koishi-plugin-message-counter)
[![npm](https://img.shields.io/npm/v/koishi-plugin-message-counter.svg?style=for-the-badge&color=fc8d62&logo=npm)](https://www.npmjs.com/package/koishi-plugin-message-counter)

---

## 注意事项

- 仅记录群聊消息。
- 初始化需要权限等级 3 级。

---

## 关键指令

`messageCounter.查询 [指定用户]`
  查询指定用户的发言次数信息（次数[排名]）。

  选项:

- -d, --yesterday : 昨日发言次数[排名]
- -w              : 本周发言次数[排名]
- -m              : 本月发言次数[排名]
- -y              : 今年发言次数[排名]
- -t              : 总发言次数[排名]

- -a,   --dag     : 跨群今日发言次数[排名]
- --ydag          : 跨群昨日发言次数[排名]
- --wag           : 跨群本周发言次数[排名]
- --mag           : 跨群本月发言次数[排名]
- --yag           : 跨群今年发言次数[排名]

`messageCounter.排行榜 [显示的人数]`
  发言排行榜。默认为今日发言榜。

  选项:

- -d, --yesterday : 昨日发言排行榜
- -w              : 本周发言排行榜
- -m              : 本月发言排行榜
- -y              : 今年发言排行榜
- -t              : 总发言排行榜

- --dag           : 跨群今日发言排行榜
- --ydag          : 跨群昨日发言排行榜
- --wag           : 跨群本周发言排行榜
- --mag           : 跨群本月发言排行榜
- --yag           : 跨群今年发言排行榜
- --dragon        : 跨群总发言排行榜（圣龙王榜）

- --whites        : 白名单，只显示白名单用户
- --blacks        : 黑名单，不显示黑名单用户

`messageCounter.群排行榜 [number:number]`
  各群聊的发言排行榜。默认为今日发言榜。

  选项:

- -d, --yesterday : 昨日/今日/本周/本月/今年/总发言排行榜
- -w, -m, -y, -t

- -s              : 指定用户的群发言排行榜
- --whites        : 白名单，只显示白名单群
- --blacks        : 黑名单，不显示黑名单群

`messageCounter.上传柱状条背景`

- 为自己上传一张自定义的水平柱状条背景图片。
- 新图片会覆盖旧的图片。若上传失败，旧图片也会被删除。
- 使用此指令时需附带图片。

`messageCounter.重载资源`

- 实时重载用户图标和柱状条背景，使其更改即时生效。（需要权限等级 2）

---

## 自定义水平柱状图样式

1. 用户图标

   - 在 `data/messageCounterIcons` 文件夹下添加用户图标。
   - 文件名格式为 `用户ID.png` (例: `1234567890.png`)。
   - 支持多图标，文件名格式为 `用户ID-1.png`, `用户ID-2.png`。

2. 柱状条背景

   - 推荐方式: 使用 `messageCounter.上传柱状条背景` 指令。
   - 手动方式: 在 `data/messageCounterBarBgImgs` 文件夹下添加背景图片。
   - 支持多背景 (随机选用)，文件名格式为 `用户ID-1.png` 等。
   - 建议尺寸 850x50 像素，文件名 `用户ID.png`。

## 示例截图

![2ca8001d759e64dcecb8a952e3f23a4f](https://github.com/araea/koishi-plugin-message-counter/assets/120614554/3eb50393-00a2-4400-b4fd-d54d3acee390)

---

## 致谢

- [Koishi](https://koishi.chat/)         - 机器人框架
- [Akisa](https://forum.koishi.xyz/u/akisa/summary)          - Akisa 大人
- [shangxueink](https://github.com/araea/koishi-plugin-message-counter/pull/11)    - 上学大人
- [node-schedule](https://www.npmjs.com/package/node-schedule)   - 定时任务库
- [shangxue](https://forum.koishi.xyz/u/shangxue/summary)       - 推送所有频道的配置项
- [nullbczd](https://forum.koishi.xyz/u/nullbczd/summary)        - 水平柱状图样式等功能

---

## QQ 群

956758505

---

### License

_Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or [MIT license](LICENSE-MIT) at your option._

_Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions._
