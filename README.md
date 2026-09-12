# koishi-plugin-message-counter

发言次数统计与排行榜，可生成水平柱状图

## 安装

```sh
yarn add koishi-plugin-message-counter
```

在 Koishi 配置中启用，并提供 database 与 cron 服务。生成图表需要 puppeteer，上传柱状条背景需要 canvas。

## 指令

| 指令 | 说明 |
| --- | --- |
| `msgcount` | 帮助 |
| `msgcount.查询 [用户]` | 发言次数与排名 |
| `msgcount.排行榜 [人数]` | 本群发言排行 |
| `msgcount.群排行榜 [人数]` | 各群发言排行 |
| `msgcount.上传柱状条背景` | 上传个人柱状条底图 |
| `msgcount.重载资源` | 重载图标与字体，权限 2 |
| `msgcount.清理缓存` | 清理头像缓存，权限 3 |
| `msgcount.初始化` | 清空发言记录，权限 3 |

时段选项：`-d` 今日、`--yd` 昨日、`-w` 本周、`-m` 本月、`-y` 今年、`-t` 总计。关闭「统计昨日发言」后，`--yd` 与「抓龙王」不可用。

资源目录为 `data/messageCounter/` 下的 `icons`、`barBgImgs` 与 `fonts`。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
