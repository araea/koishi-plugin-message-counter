koishi-plugin-message-counter
=============================

[<img alt="github" src="https://img.shields.io/badge/github-araea/koishi__plugin__message__counter-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-message-counter)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-message-counter.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-message-counter)

Koishi 的发言排行榜插件。

## 使用

统计群聊发言次数，生成水平柱状图排行榜。

## 指令

| 指令 | 说明 |
| --- | --- |
| `messageCounter` | 查看帮助 |
| `messageCounter.查询 [用户]` | 发言次数与排名 |
| `messageCounter.排行榜 [人数]` | 发言榜 |
| `messageCounter.群排行榜 [人数]` | 各群发言榜 |
| `messageCounter.上传柱状条背景` | 上传个人柱状条底图 |
| `messageCounter.重载资源` | 重载图标与字体（权限 2） |
| `messageCounter.清理缓存` | 清理头像缓存（权限 3） |
| `messageCounter.初始化` | 清空发言记录（权限 3） |

时段选项：`-d` 今日、`--yd` 昨日、`-w` 本周、`-m` 本月、`-y` 今年、`-t` 总计。

样式资源目录：`data/messageCounter/icons/`、`barBgImgs/`、`fonts/`。

## QQ 群

956758505

<br>

#### License

<sup>
Licensed under either of <a href="LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="LICENSE-MIT">MIT license</a> at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>
