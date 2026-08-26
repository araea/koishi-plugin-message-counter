koishi-plugin-message-counter
========================

[<img alt="github" src="https://img.shields.io/badge/github-araea/message_counter-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-message-counter)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-message-counter.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-message-counter)

Koishi 的消息数量统计插件。发言排行榜。

## 📝 注意事项

- 只统计群聊消息
- 初始化需权限等级 3
- 依赖 database 与 cron 服务
- 生成图片时，需 puppeteer 提供 canvas 支持

## 🔍 关键指令

### `messageCounter.查询 [指定用户]`

查询指定用户的发言次数信息（次数[排名]）。若不带任何选项，则显示所有时段的数据。

**选项:**

| 参数 | 说明 |
|------|------|
| `-d, --day` | 今日发言次数[排名] |
| `--yd, --yesterday` | 昨日发言次数[排名] |
| `-w, --week` | 本周发言次数[排名] |
| `-m, --month` | 本月发言次数[排名] |
| `-y, --year` | 今年发言次数[排名] |
| `-t, --total` | 总发言次数[排名] |
| `--dag` | 跨群今日发言次数[排名] |
| `--ydag` | 跨群昨日发言次数[排名] |
| `--wag` | 跨群本周发言次数[排名] |
| `--mag` | 跨群本月发言次数[排名] |
| `--yag` | 跨群本年发言次数[排名] |
| `-a, --across` | 跨群总发言次数[排名] |

### `messageCounter.排行榜 [显示的人数]`

发言排行榜。默认为今日发言榜。

**选项:**

| 参数 | 说明 |
|------|------|
| `--yd, --yesterday` | 昨日发言排行榜 |
| `-w` | 本周发言排行榜 |
| `-m` | 本月发言排行榜 |
| `-y` | 今年发言排行榜 |
| `-t` | 总发言排行榜 |
| `--dag` | 跨群今日发言排行榜 |
| `--ydag` | 跨群昨日发言排行榜 |
| `--wag` | 跨群本周发言排行榜 |
| `--mag` | 跨群本月发言排行榜 |
| `--yag` | 跨群今年发言排行榜 |
| `--dragon` | 跨群总发言排行榜（圣龙王榜） |
| `--whites` | 白名单，只显示白名单用户 |
| `--blacks` | 黑名单，不显示黑名单用户 |

### `messageCounter.群排行榜 [number:number]`

各群聊的发言排行榜。默认为今日发言榜。

**选项:**

| 参数 | 说明 |
|------|------|
| `--yd, --yesterday` | 昨日发言排行榜 |
| `-w, -m, -y, -t` | 本周/本月/今年/总发言排行榜 |
| `-s` | 指定用户的群发言排行榜 |
| `--whites` | 白名单，只显示白名单群 |
| `--blacks` | 黑名单，不显示黑名单群 |

### `messageCounter.上传柱状条背景`

- 为自己上传一张自定义的水平柱状条背景图片
- 新图片会覆盖旧的图片。若上传失败，旧图片也会被删除
- 使用此指令时需附带图片

### `messageCounter.重载资源`

- 实时重载用户图标、柱状条背景和字体文件，使其更改即时生效（需要权限等级 2）

### `messageCounter.清理缓存`

- 清理过期的头像缓存文件，以释放磁盘空间（需要权限等级 3）
- 用户更换头像后，旧的头像缓存会变成“孤儿缓存”。此指令可以安全地移除它们。

## 🎨 自定义水平柱状图样式

- 重载插件或使用 `messageCounter.重载资源` 指令可使新增的文件立即生效。

### 1. 用户图标

- 在 `data/messageCounter/icons` 文件夹下添加用户图标
- 文件名格式为 `用户ID.png`（例：`1234567890.png`）
- 支持多图标，文件名格式为 `用户ID-1.png`, `用户ID-2.png`

### 2. 柱状条背景

- **推荐方式**：使用 `messageCounter.上传柱状条背景` 指令
- **手动方式**：在 `data/messageCounter/barBgImgs` 文件夹下添加背景图片
- 支持多背景（随机选用），文件名格式为 `用户ID-1.png` 等
- 建议尺寸 850x50 像素，文件名 `用户ID.png`

### 3. 自定义字体

- 插件启动时，会自动将内置字体 `HarmonyOS_Sans_Medium.ttf` 拷贝到 `data/messageCounter/fonts/` 目录下。
- 您可以将自己喜爱的字体文件放入此文件夹，并在配置项的“字体设置”中填入该字体的文件名称（不带后缀）。

### 4. 头像形状

- 配置项「样式定制 → 头像形状」可在 **圆形**（默认）、**圆角方形**、**方形** 之间切换。

### 5. 图片背景

- 配置项「背景设置 → 背景类型」提供了几种开箱即用的方式：
  - **默认背景**：简洁灰白渐变，什么都不用填。
  - **渐变色**：内置「云白 / 晨曦 / 海洋 / 樱花 / 薄荷 / 奶油」六套配色，也可以选「自定义」自己挑两个颜色与渐变角度。
  - **纯色**：只填一个颜色。
  - **图片**：填网络链接（http/https）或本地图片路径（相对路径基于 Koishi 根目录），可再调「模糊程度」和「白色蒙版浓度」，背景越淡文字越清楚。
  - **随机图**：由 API 每次返回一张，同样支持模糊与蒙版。
  - **自定义 CSS**：高级玩法，直接写 `html { ... }`。

## 📷 示例截图

![排行榜示例](https://github.com/user-attachments/assets/a893f995-a74f-4170-a417-e826cf73f6a2)

## 🙏 致谢

| 项目/贡献者 | 贡献 |
|------------|------|
| [Koishi](https://koishi.chat/) | 机器人框架 |
| [Akisa](https://forum.koishi.xyz/u/akisa/summary) | Akisa 大人 |
| [shangxueink](https://github.com/araea/koishi-plugin-message-counter/pull/11) | 上学大人 |
| [shangxue](https://forum.koishi.xyz/u/shangxue/summary) | 推送所有频道的配置项 |
| [nullbczd](https://forum.koishi.xyz/u/nullbczd/summary) | 水平柱状图样式等功能 |

## 💬 QQ 群

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
