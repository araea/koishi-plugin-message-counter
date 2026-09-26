# 发言计数器

Koishi 插件，统计发言次数并生成频道排行榜和柱状图。

## 安装

```sh
yarn add koishi-plugin-message-counter
```

在 Koishi 中启用，并安装 `database` 与 `cron` 服务。生成图表需要 `puppeteer`；`canvas` 用于头像缓存和柱状条背景上传。

## 指令

| 指令 | 说明 |
| --- | --- |
| `msgcount` | 查看帮助 |
| `msgcount.查询 [用户]` | 查看发言次数与排名 |
| `msgcount.排行榜 [人数]` | 查看本频道排行 |
| `msgcount.频道排行榜 [人数]` | 查看各频道排行 |
| `msgcount.上传柱状条背景` | 上传个人柱状条底图 |
| `msgcount.重载资源` | 重载图标与字体，权限 2 |
| `msgcount.清理缓存` | 清理头像缓存，权限 3 |
| `msgcount.清空记录` | 清空全部发言记录，权限 3 |

时间范围：`-d` 今日、`--yd` 昨日、`-w` 本周、`-m` 本月、`-y` 今年、`-t` 总计。关闭「统计昨日发言」后，`--yd` 和「抓龙王」不可用。

资源目录位于 `data/messageCounter/`，包括 `icons`、`barBgImgs` 和 `fonts`。

`msgcount.清空记录` 先显示影响范围和确认码，只有在 5 分钟内由同一用户、同一频道确认后才清空。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
