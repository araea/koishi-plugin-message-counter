koishi-plugin-message-counter
=============================

[<img alt="github" src="https://img.shields.io/badge/github-araea/message_counter-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-message-counter)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-message-counter.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-message-counter)

Koishi 的消息数量统计插件。发言排行榜。

只统计群聊。水平柱状图可换图标、底图和字体。

## 使用

1. 启用 `database` 与 `cron` 服务。
2. 出图需要 `puppeteer`（canvas 支持）。
3. 设置指令别名。

## 指令

| 指令 | 说明 |
| --- | --- |
| `messageCounter` | 查看帮助 |
| `messageCounter.查询 [用户]` | 发言次数与排名。不带选项则列出全部时段 |
| `messageCounter.排行榜 [人数]` | 发言榜，默认今日 |
| `messageCounter.群排行榜 [人数]` | 各群发言榜，默认今日 |
| `messageCounter.上传柱状条背景` | 为自己上传水平柱状条底图，需附带图片 |
| `messageCounter.重载资源` | 重载图标、底图与字体（权限 2） |
| `messageCounter.清理缓存` | 清理过期头像缓存（权限 3） |
| `messageCounter.初始化` | 清空全部发言记录（权限 3） |

查询与两张榜都带时段选项：`-d` 今日、`--yd` 昨日、`-w` 本周、`-m` 本月、`-y` 今年、`-t` 总计。对应跨群为 `--dag` / `--ydag` / `--wag` / `--mag` / `--yag`；查询的跨群总计是 `-a`，总榜是 `--dragon`（圣龙王榜）。

排行榜另有 `--whites` / `--blacks`，后面跟用户 ID，空白名单或逗号分隔。群排行榜的 `-s` 只看指定用户在各群的发言。

上传底图会覆盖旧图；失败时旧图也会被删掉。清理缓存默认去掉 30 天未用的头像，可用 `-d <天数>` 改。

## 样式

重载插件或发 `messageCounter.重载资源` 后，新文件立即生效。

**用户图标** — 放到 `data/messageCounter/icons/`，文件名 `用户ID.png`。多图标：`用户ID-1.png`、`用户ID-2.png`。

**柱状条背景** — 推荐用上传指令。也可放到 `data/messageCounter/barBgImgs/`，建议 850×50。多图随机：`用户ID-1.png`。

**字体** — 启动时会把内置 `HarmonyOS_Sans_Medium.ttf` 拷到 `data/messageCounter/fonts/`。把字体放进该目录，配置里填文件名（不带后缀）。

**头像** — 配置「样式定制 → 头像形状」：圆形、圆角方形、方形。

**图片背景** — 配置「背景设置 → 背景类型」：

- 默认：灰白渐变
- 渐变色：云白 / 晨曦 / 海洋 / 樱花 / 薄荷 / 奶油，或自定义两色与角度
- 纯色
- 图片：网络链接或相对 Koishi 根目录的本地路径，可调模糊与白色蒙版
- 随机图：API 每次一张
- 自定义 CSS：写 `html { ... }`

## 示例

![排行榜示例](https://github.com/user-attachments/assets/a893f995-a74f-4170-a417-e826cf73f6a2)

## 致谢

- [Koishi](https://koishi.chat/)
- [Akisa](https://forum.koishi.xyz/u/akisa/summary)
- [shangxueink](https://github.com/araea/koishi-plugin-message-counter/pull/11)
- [shangxue](https://forum.koishi.xyz/u/shangxue/summary)
- [nullbczd](https://forum.koishi.xyz/u/nullbczd/summary)

## QQ 群

- 956758505

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
