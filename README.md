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

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。

## 显示与交互

发送 `msgcount.显示 文字` 或 `msgcount.显示 图文` 切换个人显示偏好。同一机器人中的配套插件共享选择，重启后恢复图文。图文模式中的信息图片附带文字说明；作品素材与感官测试的适用边界见 [设计系统](./DESIGN_SYSTEM.md)。

本次更新：M3 图表颜色与字阶、完整文字排行榜、个人文字模式；清空前预览并确认。昵称截断的测量与省略号策略保持不变。

`msgcount.清空记录` 先显示影响范围和确认码，只有在 5 分钟内由同一用户、同一频道确认后才清空。
