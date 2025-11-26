import { Context, h, Logger, Schema, sleep, Bot, Dict, $ } from "koishi";
import { } from "koishi-plugin-markdown-to-image-service";
import { } from "koishi-plugin-cron";
import { } from "koishi-plugin-puppeteer";
import path from "path";
import { } from "@koishijs/canvas";
import * as fs from "fs/promises";
import { constants as fsConstants } from "fs";
import * as crypto from "crypto";

import fallbackBase64 from "./assets/fallbackBase64.json";

export const name = "message-counter";
export const inject = {
  required: ["database", "cron"],
  optional: ["markdownToImage", "puppeteer"],
};

export const usage = `## 📝 注意事项

- 只统计群聊消息
- 初始化需权限等级 3
- 依赖 database 与 cron 服务
- 生成图片时，需 puppeteer 提供 canvas 支持

## 🔍 关键指令

### \`messageCounter.查询 [指定用户]\`

查询指定用户的发言次数信息（次数[排名]）。若不带任何选项，则显示所有时段的数据。

**选项:**

| 参数 | 说明 |
|------|------|
| \`-d, --day\` | 今日发言次数[排名] |
| \`--yd, --yesterday\` | 昨日发言次数[排名] |
| \`-w, --week\` | 本周发言次数[排名] |
| \`-m, --month\` | 本月发言次数[排名] |
| \`-y, --year\` | 今年发言次数[排名] |
| \`-t, --total\` | 总发言次数[排名] |
| \`--dag\` | 跨群今日发言次数[排名] |
| \`--ydag\` | 跨群昨日发言次数[排名] |
| \`--wag\` | 跨群本周发言次数[排名] |
| \`--mag\` | 跨群本月发言次数[排名] |
| \`--yag\` | 跨群本年发言次数[排名] |
| \`-a, --across\` | 跨群总发言次数[排名] |

### \`messageCounter.排行榜 [显示的人数]\`

发言排行榜。默认为今日发言榜。

**选项:**

| 参数 | 说明 |
|------|------|
| \`--yd, --yesterday\` | 昨日发言排行榜 |
| \`-w\` | 本周发言排行榜 |
| \`-m\` | 本月发言排行榜 |
| \`-y\` | 今年发言排行榜 |
| \`-t\` | 总发言排行榜 |
| \`--dag\` | 跨群今日发言排行榜 |
| \`--ydag\` | 跨群昨日发言排行榜 |
| \`--wag\` | 跨群本周发言排行榜 |
| \`--mag\` | 跨群本月发言排行榜 |
| \`--yag\` | 跨群今年发言排行榜 |
| \`--dragon\` | 跨群总发言排行榜（圣龙王榜） |
| \`--whites\` | 白名单，只显示白名单用户 |
| \`--blacks\` | 黑名单，不显示黑名单用户 |

### \`messageCounter.群排行榜 [number:number]\`

各群聊的发言排行榜。默认为今日发言榜。

**选项:**

| 参数 | 说明 |
|------|------|
| \`--yd, --yesterday\` | 昨日发言排行榜 |
| \`-w, -m, -y, -t\` | 本周/本月/今年/总发言排行榜 |
| \`-s\` | 指定用户的群发言排行榜 |
| \`--whites\` | 白名单，只显示白名单群 |
| \`--blacks\` | 黑名单，不显示黑名单群 |

### \`messageCounter.时间分布 [top]\`

展示指定时间段内 Top N（默认 10）用户在不同时间段的发言量三维图（需开启 Puppeteer 与时间序列记录）。

**选项:**

| 参数 | 说明 |
|------|------|
| \`-s, --start\` | 起始时间（YYYY-MM-DD 或 YYYY-MM-DD HH:mm，北京时间） |
| \`-e, --end\` | 结束时间（默认当前时间） |
| \`-H, --hours\` | 回溯小时数，未指定起始时间时生效（默认 24 小时） |
| \`-t, --type\` | 图表类型：\`bar\`（柱状）或 \`line\`（曲线） |

### \`messageCounter.上传柱状条背景\`

- 为自己上传一张自定义的水平柱状条背景图片
- 新图片会覆盖旧的图片。若上传失败，旧图片也会被删除
- 使用此指令时需附带图片

### \`messageCounter.重载资源\`

- 实时重载用户图标、柱状条背景和字体文件，使其更改即时生效（需要权限等级 2）

### \`messageCounter.清理缓存\`

- 清理过期的头像缓存文件，以释放磁盘空间（需要权限等级 3）
- 用户更换头像后，旧的头像缓存会变成“孤儿缓存”。此指令可以安全地移除它们。

## 🎨 自定义水平柱状图样式

- 重载插件或使用 \`messageCounter.重载资源\` 指令可使新增的文件立即生效。

### 1. 用户图标

- 在 \`data/messageCounter/icons\` 文件夹下添加用户图标
- 文件名格式为 \`用户ID.png\`（例：\`1234567890.png\`）
- 支持多图标，文件名格式为 \`用户ID-1.png\`, \`用户ID-2.png\`

### 2. 柱状条背景

- **推荐方式**：使用 \`messageCounter.上传柱状条背景\` 指令
- **手动方式**：在 \`data/messageCounter/barBgImgs\` 文件夹下添加背景图片
- 支持多背景（随机选用），文件名格式为 \`用户ID-1.png\` 等
- 建议尺寸 850x50 像素，文件名 \`用户ID.png\`

### 3. 自定义字体

- 插件启动时，会自动将内置字体 \`HarmonyOS_Sans_Medium.ttf\` 拷贝到 \`data/messageCounter/fonts/\` 目录下。
- 您可以将自己喜爱的字体文件放入此文件夹，并在配置项的“字体设置”中填入该字体的文件名称（不带后缀）。

---

## 💬 QQ 群

- 956758505`;

const logger = new Logger("messageCounter");

// --- 定义字体选项常量 ---
const FONT_OPTIONS = {
  TITLE: "HarmonyOS_Sans_Medium",
  NICKNAME: "HarmonyOS_Sans_Medium",
};

export interface Config {
  // --- 核心功能 ---
  /** 是否统计 Bot 自己发送的消息。 */
  isBotMessageTrackingEnabled: boolean;

  // --- 排行榜设置 ---
  /** 排行榜默认显示的人数。 */
  defaultMaxDisplayCount: number;
  /** 是否在显示排行榜时补充时间信息。 */
  isTimeInfoSupplementEnabled: boolean;
  /** 是否在排行榜中显示用户消息占比。 */
  isUserMessagePercentageVisible: boolean;
  /** 在排行榜中全局隐藏的用户 ID 列表。 */
  hiddenUserIdsInLeaderboard: string[];
  /** 在群排行榜中全局隐藏的频道 ID 列表。 */
  hiddenChannelIdsInLeaderboard: string[];

  // --- 图片生成 ---
  /** 是否将文本排行榜转为 Markdown 图片。 */
  isTextToImageConversionEnabled: boolean;
  /** 是否将排行榜渲染为水平柱状图。 */
  isLeaderboardToHorizontalBarChartConversionEnabled: boolean;

  // -- 柱状图专属设置 --
  /** 生成的柱状图图片类型。 */
  imageType: "png" | "jpeg" | "webp";
  /** 头像缓存的有效期（秒）。设置为 0 可禁用缓存刷新。 */
  avatarCacheTTL: number;
  /** 头像获取失败后的重试间隔（秒）。 */
  avatarFailureCacheTTL: number;
  /** 页面加载等待事件，影响图片生成速度和稳定性。 */
  waitUntil: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  /**
   * 生成水平柱状图时，渲染页面的视口宽度（像素）。
   * @default 1080
   */
  chartViewportWidth: number;
  /**
   * 渲染时的设备像素比 (DPR)。
   * 更高的值可以生成更清晰的图片（例如，设置为 2 相当于 2x 图），但也会增加图片文件体积。
   * @default 1
   */
  deviceScaleFactor: number;
  /** 是否将自定义图标显示在柱状条的末端。 */
  shouldMoveIconToBarEndLeft: boolean;
  /** 是否在生成水平柱状图时，在当前用户/群聊名称前显示★以高亮。 */
  showStarInChart: boolean;
  /** 自定义背景图在进度条区域的不透明度。 */
  horizontalBarBackgroundOpacity: number;
  /** 自定义背景图在整行背景的不透明度。 */
  horizontalBarBackgroundFullOpacity: number;
  /** 允许上传的背景图最大宽度（像素）。 */
  maxBarBgWidth: number;
  /** 允许上传的背景图最大高度（像素）。 */
  maxBarBgHeight: number;
  /** 允许上传的背景图最大体积（MB）。 */
  maxBarBgSize: number; // in MB

  // -- 柱状图背景设置 --
  /** 图片整体背景的类型。 */
  backgroundType: string;
  /** API 背景配置。 */
  apiBackgroundConfig: apiBackgroundConfig;
  /** 自定义背景的 CSS 代码。 */
  backgroundValue: string;

  // --- 时间序列统计 ---
  /** 是否记录时间序列数据以生成三维时间分布图。 */
  enableTimelineTracking: boolean;
  /** 时间序列聚合的粒度（分钟）。 */
  timelineBucketMinutes: number;
  /** 时序数据的保留天数（天）。设置为 0 表示不自动清理。 */
  timelineRetentionDays: number;

  // --- 字体设置 ---
  /** 水平柱状图 - 标题的字体。 */
  chartTitleFont: string;
  /** 水平柱状图 - 成员昵称和发言次数的字体。 */
  chartNicknameFont: string;

  // --- 自动推送 ---
  /** 是否启用定时自动推送排行榜功能。 */
  autoPush: boolean;

  // -- 自动推送详细选项 --
  /** 是否在每日 0 点自动发送昨日排行榜。 */
  shouldSendDailyLeaderboardAtMidnight: boolean;
  /** 是否在每周一 0 点自动发送上周排行榜。 */
  shouldSendWeeklyLeaderboard: boolean;
  /** 是否在每月第一天 0 点自动发送上月排行榜。 */
  shouldSendMonthlyLeaderboard: boolean;
  /** 是否在每年第一天 0 点自动发送去年排行榜。 */
  shouldSendYearlyLeaderboard: boolean;
  /** 其他定时发送今日排行榜的时间点（24小时制）。 */
  dailyScheduledTimers: string[];
  /** 发送排行榜前是否发送提示消息。 */
  isGeneratingRankingListPromptVisible: boolean;
  /** 发送提示后等待多少秒再发送图片。 */
  leaderboardGenerationWaitTime: number;
  /** 需要接收自动推送的频道 ID 列表。 */
  pushChannelIds: string[];
  /** 是否向机器人所在的所有群聊推送。 */
  shouldSendLeaderboardNotificationsToAllChannels: boolean;
  /** "向所有群聊推送" 开启时的排除列表。 */
  excludedLeaderboardChannels: string[];
  /** 批量推送时，每个群之间的发送延迟（秒）。 */
  delayBetweenGroupPushesInSeconds: number;
  /** 延迟时间的随机波动范围（秒）。 */
  groupPushDelayRandomizationSeconds: number;

  // --- 龙王禁言 ---
  /** 是否在每日 0 点自动禁言昨日发言最多的人。 */
  enableMostActiveUserMuting: boolean;

  // -- 龙王禁言详细选项 --
  /** 0 点后，等待多少秒再执行禁言操作。 */
  dragonKingDetainmentTime: number;
  /** 禁言时长（天）。 */
  detentionDuration: number;
  /** 在哪些频道中执行“抓龙王”操作。 */
  muteChannelIds: string[];
}
// pz*
// pz*
export const Config: Schema<Config> = Schema.intersect([
  // --- 核心功能 ---
  Schema.object({
    isBotMessageTrackingEnabled: Schema.boolean()
      .default(false)
      .description("是否统计 Bot 自己发送的消息。"),
  }).description("核心功能"),

  // --- 排行榜设置 ---
  Schema.object({
    defaultMaxDisplayCount: Schema.number()
      .min(0)
      .default(20)
      .description("排行榜默认显示的人数。设置为 0 则显示所有。"),
    isTimeInfoSupplementEnabled: Schema.boolean()
      .default(true)
      .description("是否在排行榜标题中显示生成时间。"),
    isUserMessagePercentageVisible: Schema.boolean()
      .default(true)
      .description("是否在排行榜中显示用户的消息数占比。"),
    hiddenUserIdsInLeaderboard: Schema.array(String)
      .role("table")
      .description("全局隐藏的用户 ID 列表，在所有用户排行榜中生效。"),
    hiddenChannelIdsInLeaderboard: Schema.array(String)
      .role("table")
      .description("全局隐藏的频道 ID 列表，在群排行榜中生效。"),
  }).description("排行榜设置"),

  // --- 图片生成 ---
  Schema.intersect([
    Schema.object({
      isTextToImageConversionEnabled: Schema.boolean()
        .default(false)
        .description(
          "是否将文本排行榜转为 Markdown 图片（依赖 `markdownToImage` 服务）。"
        ),
      isLeaderboardToHorizontalBarChartConversionEnabled: Schema.boolean()
        .default(false)
        .description("是否将排行榜渲染为水平柱状图（依赖 `puppeteer` 服务）。"),
    }).description("图片生成"),

    // 仅在开启柱状图功能时显示以下详细选项
    Schema.union([
      Schema.intersect([
        Schema.object({
          isLeaderboardToHorizontalBarChartConversionEnabled:
            Schema.const(true).required(),
          imageType: Schema.union(["png", "jpeg", "webp"])
            .default("png")
            .description(`生成的柱状图图片格式。`),
        }).description("柱状图基础设置"),

        Schema.object({
          chartViewportWidth: Schema.number()
            .min(1)
            .default(1080)
            .description(
              "渲染页面的视口宽度（像素）。此值会影响图片清晰度及背景图的展示。"
            ),
          deviceScaleFactor: Schema.number()
            .min(0.1)
            .max(4)
            .step(0.1)
            .default(1)
            .description(
              "设备像素比 (DPR)。更高的值可生成更清晰的图片（如 2 倍图），但会增加文件体积。"
            ),
          waitUntil: Schema.union([
            "load",
            "domcontentloaded",
            "networkidle0",
            "networkidle2",
          ])
            .default("networkidle0")
            .description(
              "页面加载等待策略，影响图片生成速度和稳定性。`networkidle0` 最稳定。"
            ),
        }).description("渲染与性能"),

        Schema.object({
          avatarCacheTTL: Schema.number()
            .default(86400) // 24 hours
            .description(
              "头像缓存有效期（秒）。设置为 0 则永不刷新。过短的有效期会增加网络请求。"
            ),
          avatarFailureCacheTTL: Schema.number()
            .default(300) // 5 minutes
            .description(
              "头像获取失败后的重试间隔（秒）。期间将使用默认头像，避免频繁请求无效链接。"
            ),
        }).description("缓存设置"),

        Schema.object({
          shouldMoveIconToBarEndLeft: Schema.boolean()
            .default(true)
            .description(
              "是否将自定义图标显示在进度条的末端。关闭则显示在用户名旁。"
            ),
          showStarInChart: Schema.boolean()
            .default(true)
            .description(
              "是否在图表中对触发指令的用户/群聊名称前添加 ★ 以高亮显示。"
            ),
          horizontalBarBackgroundOpacity: Schema.number()
            .min(0)
            .max(1)
            .step(0.05)
            .default(0.6)
            .description("自定义背景图在进度条区域的不透明度。"),
          horizontalBarBackgroundFullOpacity: Schema.number()
            .min(0)
            .max(1)
            .step(0.05)
            .default(0)
            .description("自定义背景图在整行背景区域的不透明度。"),
        }).description("样式定制"),

        Schema.object({
          maxBarBgWidth: Schema.number()
            .min(0)
            .default(850)
            .description("允许上传的背景图最大宽度（像素）。0为不限制。"),
          maxBarBgHeight: Schema.number()
            .min(0)
            .default(50)
            .description("允许上传的背景图最大高度（像素）。0为不限制。"),
          maxBarBgSize: Schema.number()
            .min(0)
            .default(5)
            .description("允许上传的背景图最大体积（MB）。0为不限制。"),
        }).description("上传限制"),

        // 背景设置（条件化）
        Schema.intersect([
          Schema.object({
            backgroundType: Schema.union([
              Schema.const("none").description("默认渐变"),
              Schema.const("api").description("API 获取"),
              Schema.const("css").description("自定义 CSS"),
            ])
              .default("none")
              .description("图片整体背景类型。"),
          }),
          Schema.union([
            Schema.object({
              backgroundType: Schema.const("api").required(),
              apiBackgroundConfig: Schema.object({
                apiUrl: Schema.string()
                  .description("获取背景图的 API 地址。")
                  .required(),
                apiKey: Schema.string()
                  .role("secret")
                  .description("API 的访问凭证（可选）。"),
                responseType: Schema.union(["binary", "url", "base64"])
                  .default("binary")
                  .description("API 返回的数据类型。"),
              })
                .description("API 背景配置")
                .collapse(),
            }),
            Schema.object({
              backgroundType: Schema.const("css").required(),
              backgroundValue: Schema.string()
                .role("textarea", { rows: [2, 4] })
                .default(
                  `html {\n  background: linear-gradient(135deg, #f6f8f9 0%, #e5ebee 100%);\n}`
                )
                .description(
                  "自定义背景的 CSS 代码。建议使用 `html` 选择器来设置背景。"
                ),
            }),
            Schema.object({}),
          ]),
        ]).description("背景设置"),

        Schema.object({
          chartTitleFont: Schema.string()
            .default(FONT_OPTIONS.TITLE)
            .description(
              `标题字体。填写 'data/messageCounter/fonts' 目录中的字体文件名（不含后缀）。`
            ),
          chartNicknameFont: Schema.string()
            .default(FONT_OPTIONS.NICKNAME)
            .description(
              `昵称与计数字体。填写 'data/messageCounter/fonts' 目录中的字体文件名（不含后缀），或使用通用字体名称。`
            ),
        }).description("字体设置"),
      ]),
      Schema.object({}),
    ]),
  ]),

  // --- 时间序列统计 ---
  Schema.object({
    enableTimelineTracking: Schema.boolean()
      .default(true)
      .description("是否记录时间序列数据，以生成三维时间分布图。"),
    timelineBucketMinutes: Schema.number()
      .min(5)
      .max(180)
      .step(5)
      .default(60)
      .description("时间序列聚合的粒度（分钟）。"),
    timelineRetentionDays: Schema.number()
      .min(0)
      .default(60)
      .description("时序数据的保留天数（0 表示不自动清理）。"),
  }).description("时间序列统计"),

  // --- 自动推送 ---
  Schema.intersect([
    Schema.object({
      autoPush: Schema.boolean()
        .default(false)
        .description("是否启用定时自动推送排行榜功能。"),
    }).description("自动推送"),
    Schema.union([
      Schema.intersect([
        Schema.object({
          autoPush: Schema.const(true).required(),
          shouldSendDailyLeaderboardAtMidnight: Schema.boolean()
            .default(true)
            .description("每日 0 点自动发送昨日排行榜。"),
          shouldSendWeeklyLeaderboard: Schema.boolean()
            .default(false)
            .description("每周一 0 点自动发送上周排行榜。"),
          shouldSendMonthlyLeaderboard: Schema.boolean()
            .default(false)
            .description("每月一日 0 点自动发送上月排行榜。"),
          shouldSendYearlyLeaderboard: Schema.boolean()
            .default(false)
            .description("每年一日 0 点自动发送去年排行榜。"),
          dailyScheduledTimers: Schema.array(String)
            .role("table")
            .description(
              "其他定时发送今日排行榜的时间点（24小时制，如 `08:00`）。"
            ),
        }).description("推送时机"),

        Schema.object({
          pushChannelIds: Schema.array(String)
            .role("table")
            .description("需要接收自动推送的频道 ID 列表。"),
          shouldSendLeaderboardNotificationsToAllChannels: Schema.boolean()
            .default(false)
            .description(
              "是否向机器人所在的所有群聊推送（可能造成打扰，请谨慎开启）。"
            ),
          excludedLeaderboardChannels: Schema.array(String)
            .role("table")
            .description(
              "当“向所有群聊推送”开启时，此处指定的频道将不会收到推送。"
            ),
        }).description("推送目标"),

        Schema.object({
          isGeneratingRankingListPromptVisible: Schema.boolean()
            .default(true)
            .description("发送排行榜前，是否先发送一条“正在生成”的提示消息。"),
          leaderboardGenerationWaitTime: Schema.number()
            .min(0)
            .default(3)
            .description("发送提示消息后，等待多少秒再发送排行榜图片。"),
          delayBetweenGroupPushesInSeconds: Schema.number()
            .min(0)
            .default(5)
            .description(
              "批量推送时，每个群之间的基础发送延迟（秒），以防风控。"
            ),
          groupPushDelayRandomizationSeconds: Schema.number()
            .min(0)
            .default(10)
            .description(
              "在基础延迟之上，增加一个随机波动范围（秒），以模拟人工操作。"
            ),
        }).description("推送行为"),
      ]),
      Schema.object({}),
    ]),
  ]),

  // --- 龙王禁言 ---
  Schema.intersect([
    Schema.object({
      enableMostActiveUserMuting: Schema.boolean()
        .default(false)
        .description("是否在每日 0 点自动禁言昨日发言最多的人（“抓龙王”）。"),
    }).description("龙王禁言"),
    Schema.union([
      Schema.object({
        enableMostActiveUserMuting: Schema.const(true).required(),
        dragonKingDetainmentTime: Schema.number()
          .min(0)
          .default(5)
          .description("0 点后，等待多少秒再执行禁言操作。"),
        detentionDuration: Schema.number()
          .min(1)
          .default(1)
          .description("禁言时长（天）。"),
        muteChannelIds: Schema.array(String)
          .role("table")
          .description("在哪些频道中执行“抓龙王”操作。"),
      }),
      Schema.object({}),
    ]),
  ]),
]) as Schema<Config>;

declare module "koishi" {
  interface Tables {
    message_counter_records: MessageCounterRecord;
    message_counter_state: MessageCounterState;
    message_counter_timeline: MessageCounterTimelineRecord;
  }
}

interface apiBackgroundConfig {
  apiUrl: string;
  apiKey: string;
  responseType: string;
}

interface MessageCounterRecord {
  // id: number;
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  userAvatar: string;
  todayPostCount: number;
  thisWeekPostCount: number;
  thisMonthPostCount: number;
  thisYearPostCount: number;
  totalPostCount: number;
  yesterdayPostCount: number;
}

interface MessageCounterState {
  key: string;
  value: Date;
}

interface MessageCounterTimelineRecord {
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  bucket: string;
  bucketTimestamp: Date;
  count: number;
}

interface RankingData {
  name: string;
  userId: string;
  avatar: string;
  count: number;
  percentage: number;
  avatarBase64?: string;
}

interface AssetData {
  userId: string;
  base64: string;
}

interface UserRecord {
  userId: string;
  postCountAll: number;
  username: string;
}

interface AvatarCacheEntry {
  base64: string;
  timestamp: number; // 存储 Unix 时间戳 (毫秒)
}

type PeriodKey = "today" | "yesterday" | "week" | "month" | "year" | "total";

type CountField =
  | "todayPostCount"
  | "yesterdayPostCount"
  | "thisWeekPostCount"
  | "thisMonthPostCount"
  | "thisYearPostCount"
  | "totalPostCount";

const periodMapping: Record<PeriodKey, { field: CountField; name: string }> = {
  today: { field: "todayPostCount", name: "今日" },
  yesterday: { field: "yesterdayPostCount", name: "昨日" },
  week: { field: "thisWeekPostCount", name: "本周" },
  month: { field: "thisMonthPostCount", name: "本月" },
  year: { field: "thisYearPostCount", name: "今年" },
  total: { field: "totalPostCount", name: "总" },
};

const BEIJING_TIME_OFFSET = 8 * 60 * 60 * 1000;

function pad(num: number): string {
  return num.toString().padStart(2, "0");
}

function alignToBucketStart(
  timestamp: number,
  bucketMinutes: number
): number {
  const bucketSizeMs = bucketMinutes * 60 * 1000;
  const shifted = timestamp + BEIJING_TIME_OFFSET;
  const floored = Math.floor(shifted / bucketSizeMs) * bucketSizeMs;
  return floored - BEIJING_TIME_OFFSET;
}

function formatBucketLabel(bucketStart: number): string {
  const beijingDate = new Date(bucketStart + BEIJING_TIME_OFFSET);
  const year = beijingDate.getUTCFullYear();
  const month = pad(beijingDate.getUTCMonth() + 1);
  const day = pad(beijingDate.getUTCDate());
  const hour = pad(beijingDate.getUTCHours());
  const minute = pad(beijingDate.getUTCMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function parseBucketLabel(bucketLabel: string): number {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(bucketLabel);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match;
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  return utc - BEIJING_TIME_OFFSET;
}

function formatBeijingDateTime(timestamp: number): string {
  const beijingDate = new Date(timestamp + BEIJING_TIME_OFFSET);
  const year = beijingDate.getUTCFullYear();
  const month = pad(beijingDate.getUTCMonth() + 1);
  const day = pad(beijingDate.getUTCDate());
  const hour = pad(beijingDate.getUTCHours());
  const minute = pad(beijingDate.getUTCMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function parseDateInputToTimestamp(input?: string): number | null {
  if (!input) return null;
  const normalized = input.replace("T", " ").trim();
  const hasTimezone =
    /([zZ])|(\+|-)\d{2}:?\d{2}$/.test(normalized) ||
    /GMT\s*[+-]\d{4}/i.test(normalized);
  const date = new Date(
    hasTimezone ? normalized : `${normalized} GMT+0800`
  );
  const value = date.getTime();
  return Number.isNaN(value) ? null : value;
}

function buildBucketLabels(
  startTime: number,
  endTime: number,
  bucketMinutes: number
): { labels: string[]; bucketStarts: number[] } {
  const labels: string[] = [];
  const bucketStarts: number[] = [];
  const bucketSizeMs = bucketMinutes * 60 * 1000;
  let current = alignToBucketStart(startTime, bucketMinutes);
  const endBucket = alignToBucketStart(endTime, bucketMinutes);

  while (current <= endBucket) {
    labels.push(formatBucketLabel(current));
    bucketStarts.push(current);
    current += bucketSizeMs;
  }

  return { labels, bucketStarts };
}

export async function apply(ctx: Context, config: Config) {
  // cl*
  // 定义一个唯一的 Symbol 作为处理标记，防止与其他插件冲突
  const PROCESSED = Symbol("message-counter.processed");
  // --- 资源路径和缓存初始化 ---
  const dataRoot = path.join(ctx.baseDir, "data");
  const messageCounterRoot = path.join(dataRoot, "messageCounter"); // 统一资源根目录
  const iconsPath = path.join(messageCounterRoot, "icons");
  const barBgImgsPath = path.join(messageCounterRoot, "barBgImgs");
  const fontsPath = path.join(messageCounterRoot, "fonts"); // 字体目录路径
  const avatarsPath = path.join(messageCounterRoot, "avatars");
  const emptyHtmlPath = path
    .join(messageCounterRoot, "emptyHtml.html")
    .replace(/\\/g, "/");

  // 兼容旧版插件的资源路径
  const oldIconsPath = path.join(dataRoot, "messageCounterIcons");
  const oldBarBgImgsPath = path.join(dataRoot, "messageCounterBarBgImgs");

  // 自动创建所有必要的目录
  await fs.mkdir(fontsPath, { recursive: true });
  await fs.mkdir(iconsPath, { recursive: true });
  await fs.mkdir(barBgImgsPath, { recursive: true });
  await fs.mkdir(avatarsPath, { recursive: true });

  await migrateFolder(oldIconsPath, iconsPath);
  await migrateFolder(oldBarBgImgsPath, barBgImgsPath);

  // 确保 emptyHtml.html 存在，用于 puppeteer 渲染
  try {
    await fs.access(emptyHtmlPath, fsConstants.F_OK);
  } catch {
    // 文件不存在，则创建一个空文件
    await fs.writeFile(emptyHtmlPath, "");
    logger.info(`已创建空的渲染模板文件: emptyHtml.html`);
  }

  // 拷贝内置字体
  const fontFiles = ["HarmonyOS_Sans_Medium.ttf"];
  for (const fontFile of fontFiles) {
    // 假设字体文件在打包后的 assets/fonts 目录
    await copyAssetIfNotExists(__dirname, fontsPath, fontFile, "assets/fonts");
  }

  // 缓存
  const avatarCache = new Map<string, AvatarCacheEntry>();
  let iconCache: AssetData[] = [];
  let barBgImgCache: AssetData[] = [];
  let fontFilesCache: string[] = []; // 字体文件缓存
  const scheduledTasks: (() => void)[] = [];

  // --- 数据库表定义 ---
  ctx.model.extend(
    "message_counter_records",
    {
      // id: "unsigned",
      channelId: "string",
      channelName: "string",
      userId: "string",
      username: "string",
      userAvatar: "string",
      todayPostCount: "unsigned",
      thisWeekPostCount: "unsigned",
      thisMonthPostCount: "unsigned",
      thisYearPostCount: "unsigned",
      totalPostCount: "unsigned",
      yesterdayPostCount: "unsigned",
    },
    {
      primary: ["channelId", "userId"],
    }
  );

  ctx.model.extend(
    "message_counter_state",
    {
      key: "string",
      value: "timestamp",
    },
    { primary: "key" }
  );

  ctx.model.extend(
    "message_counter_timeline",
    {
      channelId: "string",
      channelName: "string",
      userId: "string",
      username: "string",
      bucket: "string",
      bucketTimestamp: "timestamp",
      count: "unsigned",
    },
    {
      primary: ["channelId", "userId", "bucket"],
    }
  );

  // 限定在群组中
  const channelCtx = ctx.channel();

  // 在插件启动完成后设置定时任务
  ctx.on("ready", async () => {
    // 启动时加载缓存
    await reloadIconCache();
    await reloadBarBgImgCache();
    await reloadFontCache();

    // 执行非破坏性的状态初始化
    await initializeResetStates();

    // 安全地检查并弥补真正错过的重置任务
    await checkForMissedResets();

    // --- 设置所有定时任务 ---

    // 1. 自动推送排行榜的定时任务
    if (config.autoPush) {
      if (config.shouldSendDailyLeaderboardAtMidnight) {
        const task = ctx.cron("1 0 * * *", () =>
          generateAndPushLeaderboard("yesterday")
        );
        scheduledTasks.push(task);
        logger.info("[自动推送] 已设置每日 00:01 推送昨日排行榜的任务。");
      }
      (config.dailyScheduledTimers || []).forEach((time) => {
        const match = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/.exec(time);
        if (match) {
          const [_, hour, minute] = match;
          const cron = `${minute} ${hour} * * *`;
          const task = ctx.cron(cron, () =>
            generateAndPushLeaderboard("today")
          );
          scheduledTasks.push(task);
          logger.info(`[自动推送] 已设置每日 ${time} 推送今日排行榜的任务。`);
        } else {
          logger.warn(
            `[自动推送] 无效的时间格式: "${time}"，已跳过。请使用 "HH:mm" 格式。`
          );
        }
      });
    }

    // 2. 抓龙王（禁言）的定时任务
    if (config.enableMostActiveUserMuting) {
      const task = ctx.cron("1 0 * * *", () => performDragonKingMuting());
      scheduledTasks.push(task);
      logger.info("[抓龙王] 已设置每日 00:01 执行的禁言任务。");
    }

    // 3. 统一的推送与数据库重置定时任务
    // 此任务在每天 00:00 执行
    const resetTask = ctx.cron("0 0 * * *", async () => {
      const now = new Date();
      const dayOfMonth = now.getDate();
      const month = now.getMonth(); // 0-11
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday

      // --- 周期性推送 (在数据重置之前执行) ---

      // 在每年1月1日 00:00，重置年度数据前，推送去年的排行榜
      if (
        config.autoPush &&
        config.shouldSendYearlyLeaderboard &&
        dayOfMonth === 1 &&
        month === 0
      ) {
        await generateAndPushLeaderboard("year");
      }

      // 在每月1日 00:00，重置月度数据前，推送上个月的排行榜
      if (
        config.autoPush &&
        config.shouldSendMonthlyLeaderboard &&
        dayOfMonth === 1
      ) {
        await generateAndPushLeaderboard("month");
      }

      // 在每周一 00:00，重置周数据前，推送上一周的排行榜
      if (
        config.autoPush &&
        config.shouldSendWeeklyLeaderboard &&
        dayOfWeek === 1
      ) {
        await generateAndPushLeaderboard("week");
      }

      // --- 数据重置 (在周期性推送之后执行) ---

      // 每日重置 (总是执行), 它会先把 today 备份到 yesterday
      await resetCounter("todayPostCount", "今日发言榜已成功置空！", "daily");

      // 每周重置 (在周一 00:00 执行)
      if (dayOfWeek === 1) {
        await resetCounter(
          "thisWeekPostCount",
          "本周发言榜已成功置空！",
          "weekly"
        );
      }

      // 每月重置 (在每月1号 00:00 执行)
      if (dayOfMonth === 1) {
        await resetCounter(
          "thisMonthPostCount",
          "本月发言榜已成功置空！",
          "monthly"
        );
      }

      // 每年重置 (在1月1号 00:00 执行)
      if (dayOfMonth === 1 && month === 0) {
        await resetCounter(
          "thisYearPostCount",
          "今年发言榜已成功置空！",
          "yearly"
        );
      }

      await cleanupTimelineData();
    });

    // 将这一个统一的任务添加到待清理列表
    scheduledTasks.push(resetTask);
    logger.info("已设置统一的推送与数据重置任务（每日、周、月、年）。");
  });

  // --- 资源清理 ---
  ctx.on("dispose", () => {
    // 调用 disposer 函数来取消定时任务
    scheduledTasks.forEach((task) => task());
    avatarCache.clear();
    iconCache = [];
    barBgImgCache = [];
    fontFilesCache = [];
    logger.info("所有已安排的任务和缓存都已清除。");
  });

  // --- 核心消息监听器 ---
  // jt*
  channelCtx.middleware(async (session, next) => {
    // 检查此消息是否已被本插件处理过，如果是，则直接跳过
    if (session[PROCESSED]) return next();

    // 忽略无效会话或机器人自身消息（除非配置允许）
    if (
      !session.userId ||
      !session.channelId ||
      (session.author?.isBot && !config.isBotMessageTrackingEnabled)
    ) {
      return next();
    }

    session[PROCESSED] = true;

    const { userId, channelId, author } = session;
    let sessionChannelName = session.event.channel.name;
    const username = author?.nick || author?.name || userId;
    const userAvatar = author?.avatar;

    try {
      const channelName =
        sessionChannelName ||
        (channelId ? await getChannelName(session.bot, channelId) : channelId);

      await ctx.database.upsert(
        "message_counter_records",
        (row) => [
          {
            channelId,
            userId,

            username,
            userAvatar: userAvatar || row.userAvatar,
            channelName: channelName || row.channelName,

            todayPostCount: $.add(row.todayPostCount, 1),
            thisWeekPostCount: $.add(row.thisWeekPostCount, 1),
            thisMonthPostCount: $.add(row.thisMonthPostCount, 1),
            thisYearPostCount: $.add(row.thisYearPostCount, 1),
            totalPostCount: $.add(row.totalPostCount, 1),
          },
        ],
        ["channelId", "userId"]
      );

      await recordTimelineCount({
        channelId,
        channelName: channelName || channelId,
        userId,
        username,
        timestamp: session?.timestamp ?? Date.now(),
      });
    } catch (error) {
      logger.error(
        "Failed to update message count for user %s in channel %s:",
        userId,
        channelId,
        error
      );
    }

    // 继续消息处理链
    return next();
  }, true);

  // 统计机器人自身消息
  if (config.isBotMessageTrackingEnabled) {
    ctx.before("send", async (session) => {
      if (!session.channelId) return;

      const { channelId, bot } = session;
      let sessionChannelName = session.event.channel.name;
      const botUser = bot.user;
      if (!botUser) {
        logger.warn("Bot user is undefined, skipping bot message tracking.");
        return;
      }

      try {
        const channelName =
          sessionChannelName || (await getChannelName(bot, channelId)) || channelId;

        await ctx.database.upsert(
          "message_counter_records",
          (row) => [
            {
              channelId,
              userId: botUser.id,

              username: botUser.name,
              userAvatar: botUser.avatar,
              channelName: channelName || row.channelName,

              todayPostCount: $.add(row.todayPostCount, 1),
              thisWeekPostCount: $.add(row.thisWeekPostCount, 1),
              thisMonthPostCount: $.add(row.thisMonthPostCount, 1),
              thisYearPostCount: $.add(row.thisYearPostCount, 1),
              totalPostCount: $.add(row.totalPostCount, 1),
            },
          ],
          ["channelId", "userId"]
        );

        await recordTimelineCount({
          channelId,
          channelName: channelName || channelId,
          userId: botUser.id,
          username: botUser.name,
          timestamp: session?.timestamp ?? Date.now(),
        });
      } catch (error) {
        logger.error(
          "Failed to update bot message count in channel %s:",
          channelId,
          error
        );
      }
    });
  }

  // --- 指令定义 ---
  // zl*
  ctx
    .command("messageCounter", "查看messageCounter帮助")
    .action(({ session }) => session?.execute(`help messageCounter`));

  ctx
    .command("messageCounter.初始化", "初始化", { authority: 3 })
    .action(async ({ session }) => {
      if (!session) return;
      await session.send("正在清空所有发言记录，请稍候...");
      await ctx.database.remove("message_counter_records", {});
      await session.send("所有发言记录已清空！");
    });

  // 查询指令
  ctx
    .command(
      "messageCounter.查询 [targetUser:text]",
      "查询指定用户的发言次数信息"
    )
    .userFields(["id", "name"])
    .option("yesterday", "--yd 昨日发言")
    .option("day", "-d 今日发言")
    .option("week", "-w 本周发言")
    .option("month", "-m 本月发言")
    .option("year", "-y 今年发言")
    .option("total", "-t 总发言")
    .option("ydag", "跨群昨日发言")
    .option("dag", "跨群今日发言")
    .option("wag", "跨群本周发言")
    .option("mag", "跨群本月发言")
    .option("yag", "跨群本年发言")
    .option("across", "-a 跨群总发言")
    .action(async ({ session, options }, targetUser) => {
      // -- 1. 选项解析 --
      const optionKeys = [
        "day",
        "week",
        "month",
        "year",
        "total",
        "yesterday",
        "dag",
        "wag",
        "mag",
        "yag",
        "ydag",
        "across",
      ];
      const selectedOptions: Dict<boolean> = {};
      let noOptionSelected = true;
      for (const key of optionKeys) {
        if (options[key]) {
          selectedOptions[key] = true;
          noOptionSelected = false;
        }
      }
      if (noOptionSelected) {
        for (const key of optionKeys) {
          selectedOptions[key] = true;
        }
      }

      // -- 2. 用户信息与数据获取 --
      let channelId = session?.channelId;
      let userId = session?.userId;
      let targetUserRecord: MessageCounterRecord[] = [];

      if (targetUser) {
        if (session) targetUser = await replaceAtTags(session, targetUser);
        const match = targetUser.match(/<at id="([^"]+)"/);
        if (match) userId = match[1];
      }

      targetUserRecord = await ctx.database.get("message_counter_records", {
        channelId,
        userId,
      });
      if (targetUserRecord.length === 0) return `被查询对象无任何发言记录。`;

      const channelUsers = await ctx.database.get("message_counter_records", {
        channelId,
      });
      const allUsers = await ctx.database.get("message_counter_records", {});

      // -- 3. 数据处理与结构化 --
      // 定义数据行接口
      interface StatRow {
        label: string;
        count: number;
        total: number;
        rank: number | null;
        enabled: boolean;
      }
      const channelStats: StatRow[] = [];
      const acrossStats: StatRow[] = [];

      // 累加总数
      const accumulate = (records: MessageCounterRecord[]) =>
        records.reduce((sums, user) => {
          for (const key in periodMapping) {
            sums[periodMapping[key].field] =
              (sums[periodMapping[key].field] || 0) +
              user[periodMapping[key].field];
          }
          return sums;
        }, {} as Record<CountField, number>);

      const channelTotals = accumulate(channelUsers);
      const acrossTotals = accumulate(allUsers);

      // 获取排名
      const getRank = (
        records: MessageCounterRecord[],
        field: CountField,
        uid: string
      ) => {
        const sorted = [...records].sort((a, b) => b[field] - a[field]);
        const index = sorted.findIndex((u) => u.userId === uid);
        return index !== -1 ? index + 1 : null;
      };

      const getAcrossRank = (
        records: MessageCounterRecord[],
        field: CountField,
        uid: string
      ) => {
        const userTotals = records.reduce((acc, cur) => {
          acc[cur.userId] = (acc[cur.userId] || 0) + cur[field];
          return acc;
        }, {} as Dict<number>);
        const sorted = Object.entries(userTotals).sort(([, a], [, b]) => b - a);
        const index = sorted.findIndex(([id]) => id === uid);
        return index !== -1 ? index + 1 : null;
      };

      const getAcrossCount = (
        records: MessageCounterRecord[],
        field: CountField,
        uid: string
      ) => {
        return records
          .filter((r) => r.userId === uid)
          .reduce((sum, r) => sum + r[field], 0);
      };

      // 填充本群数据
      channelStats.push({
        label: "昨日",
        count: targetUserRecord[0].yesterdayPostCount,
        total: channelTotals.yesterdayPostCount,
        rank: getRank(channelUsers, "yesterdayPostCount", userId),
        enabled: selectedOptions.yesterday,
      });
      channelStats.push({
        label: "今日",
        count: targetUserRecord[0].todayPostCount,
        total: channelTotals.todayPostCount,
        rank: getRank(channelUsers, "todayPostCount", userId),
        enabled: selectedOptions.day,
      });
      channelStats.push({
        label: "本周",
        count: targetUserRecord[0].thisWeekPostCount,
        total: channelTotals.thisWeekPostCount,
        rank: getRank(channelUsers, "thisWeekPostCount", userId),
        enabled: selectedOptions.week,
      });
      channelStats.push({
        label: "本月",
        count: targetUserRecord[0].thisMonthPostCount,
        total: channelTotals.thisMonthPostCount,
        rank: getRank(channelUsers, "thisMonthPostCount", userId),
        enabled: selectedOptions.month,
      });
      channelStats.push({
        label: "全年",
        count: targetUserRecord[0].thisYearPostCount,
        total: channelTotals.thisYearPostCount,
        rank: getRank(channelUsers, "thisYearPostCount", userId),
        enabled: selectedOptions.year,
      });
      channelStats.push({
        label: "总计",
        count: targetUserRecord[0].totalPostCount,
        total: channelTotals.totalPostCount,
        rank: getRank(channelUsers, "totalPostCount", userId),
        enabled: selectedOptions.total,
      });

      // 填充跨群数据
      acrossStats.push({
        label: "昨日",
        count: getAcrossCount(allUsers, "yesterdayPostCount", userId),
        total: acrossTotals.yesterdayPostCount,
        rank: getAcrossRank(allUsers, "yesterdayPostCount", userId),
        enabled: selectedOptions.ydag,
      });
      acrossStats.push({
        label: "今日",
        count: getAcrossCount(allUsers, "todayPostCount", userId),
        total: acrossTotals.todayPostCount,
        rank: getAcrossRank(allUsers, "todayPostCount", userId),
        enabled: selectedOptions.dag,
      });
      acrossStats.push({
        label: "本周",
        count: getAcrossCount(allUsers, "thisWeekPostCount", userId),
        total: acrossTotals.thisWeekPostCount,
        rank: getAcrossRank(allUsers, "thisWeekPostCount", userId),
        enabled: selectedOptions.wag,
      });
      acrossStats.push({
        label: "本月",
        count: getAcrossCount(allUsers, "thisMonthPostCount", userId),
        total: acrossTotals.thisMonthPostCount,
        rank: getAcrossRank(allUsers, "thisMonthPostCount", userId),
        enabled: selectedOptions.mag,
      });
      acrossStats.push({
        label: "全年",
        count: getAcrossCount(allUsers, "thisYearPostCount", userId),
        total: acrossTotals.thisYearPostCount,
        rank: getAcrossRank(allUsers, "thisYearPostCount", userId),
        enabled: selectedOptions.yag,
      });
      acrossStats.push({
        label: "总计",
        count: getAcrossCount(allUsers, "totalPostCount", userId),
        total: acrossTotals.totalPostCount,
        rank: getAcrossRank(allUsers, "totalPostCount", userId),
        enabled: selectedOptions.across,
      });

      // -- 4. 格式化与输出 --
      const formatPercentage = (count: number, total: number): string => {
        if (total === 0) return "(0%)";
        const percentage = (count / total) * 100;
        const numStr =
          percentage % 1 === 0 ? String(percentage) : percentage.toFixed(2);
        return `(${numStr}%)`;
      };

      const formatStatsTable = (title: string, stats: StatRow[]): string => {
        const activeStats = stats.filter((s) => s.enabled && s.count > 0);
        if (activeStats.length === 0) return "";

        const counts = activeStats.map((s) => String(s.count));
        const percents = activeStats.map((s) =>
          formatPercentage(s.count, s.total)
        );

        const maxCountWidth = Math.max(0, ...counts.map((s) => s.length));
        const maxPercentWidth = Math.max(0, ...percents.map((s) => s.length));

        let table = `${title}\n`;
        for (const row of activeStats) {
          const label = row.label.padEnd(2, "　"); // 使用全角空格对齐中文
          const countStr = String(row.count).padStart(maxCountWidth, " ");
          const percentStr = formatPercentage(row.count, row.total).padEnd(
            maxPercentWidth,
            " "
          );
          const rankStr = row.rank ? `#${row.rank}` : "#-";
          table += `${label} ${countStr}  ${percentStr}  ${rankStr}\n`;
        }
        return table;
      };

      const channelTable = formatStatsTable("群发言", channelStats);
      const acrossTable = formatStatsTable("跨群发言", acrossStats);

      const body = [channelTable, acrossTable].filter(Boolean).join("\n");
      if (!body) return `被查询对象在指定时段内无发言记录。`;

      // 使用 'sv-SE' locale 可以方便地得到 YYYY-MM-DD HH:MM:SS 格式
      const timestamp = new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Shanghai",
      });
      const header = `${timestamp}\n${targetUserRecord[0].username}\n\n`;
      const message = header + body;

      // -- 5. 图片转换 --
      if (config.isTextToImageConversionEnabled && ctx.markdownToImage) {
        try {
          const imageBuffer = await ctx.markdownToImage.convertToImage(message);
          return h.image(imageBuffer, `image/${config.imageType}`);
        } catch (error) {
          logger.warn("生成图片失败，将回退到文本输出:", error);
        }
      }
      // -- 6. 文本输出 (如果图片转换失败，或者未开启图片转换) --
      return message;
    });

  // 排行榜指令
  ctx
    .command("messageCounter.排行榜 [limit:number]", "用户发言排行榜")
    .userFields(["id", "name"])
    .option("whites", "<users:text> 白名单，用空格、逗号等分隔")
    .option("blacks", "<users:text> 黑名单，用空格、逗号等分隔")
    .option("yesterday", "--yd")
    .option("day", "-d")
    .option("week", "-w")
    .option("month", "-m")
    .option("year", "-y")
    .option("total", "-t")
    .option("ydag", "跨群昨日")
    .option("dag", "跨群今日")
    .option("wag", "跨群本周")
    .option("mag", "跨群本月")
    .option("yag", "跨群本年")
    .option("dragon", "圣龙王榜 (跨群总榜)")
    .action(async ({ session, options }, limit) => {
      if (!session) return;

      const number = limit ?? config.defaultMaxDisplayCount;
      if (typeof number !== "number" || isNaN(number) || number < 0) {
        return "请输入大于等于 0 的数字作为排行榜显示人数。";
      }

      const whites = parseList(options?.whites);
      const blacks = [
        ...parseList(options?.blacks),
        ...config.hiddenUserIdsInLeaderboard,
      ];

      const period = getPeriodFromOptions(options, "today");
      const isAcross = isAcrossChannel(options);

      const { field, name: periodName } = periodMapping[period];
      const scopeName = isAcross ? "跨群" : "本群";
      const rankTitle = `${scopeName}${periodName}发言排行榜`;
      const rankTimeTitle = getCurrentBeijingTime();

      let records;
      if (isAcross) {
        records = await ctx.database.get("message_counter_records", {});
      } else {
        records = await ctx.database.get("message_counter_records", {
          channelId: session.channelId,
        });
      }

      const filteredRecords = filterRecordsByWhitesAndBlacks(
        records,
        "userId",
        whites,
        blacks
      );

      if (filteredRecords.length === 0) {
        return "当前范围内暂无发言记录。";
      }

      // 聚合数据
      const userPostCounts: Dict<number> = {};
      const userInfo: Dict<{ username: string; avatar: string }> = {};
      let totalCount = 0;

      for (const record of filteredRecords) {
        const count = record[field] as number;
        userPostCounts[record.userId] =
          (userPostCounts[record.userId] || 0) + count;
        if (!userInfo[record.userId]) {
          userInfo[record.userId] = {
            username: record.username,
            avatar:
              record.userAvatar ||
              `https://q1.qlogo.cn/g?b=qq&nk=${record.userId}&s=640`,
          };
        }
        totalCount += count;
      }

      const sortedUsers = Object.entries(userPostCounts).sort(
        ([, a], [, b]) => b - a
      );

      const rankingData: RankingData[] = prepareRankingData(
        sortedUsers,
        userInfo,
        totalCount,
        number,
        session.userId
      );

      return renderLeaderboard({
        rankTimeTitle,
        rankTitle,
        rankingData,
      });
    });

  ctx
    .command("messageCounter.群排行榜 [limit:number]", "群发言排行榜")
    .option("specificUser", "-s <user:text> 特定用户的群发言榜")
    .option("whites", "<channels:text> 白名单群号")
    .option("blacks", "<channels:text> 黑名单群号")
    .option("yesterday", "--yd")
    .option("day", "-d")
    .option("week", "-w")
    .option("month", "-m")
    .option("year", "-y")
    .option("total", "-t")
    .action(async ({ session, options }, limit) => {
      if (!session) return;

      const number = limit ?? config.defaultMaxDisplayCount;
      if (typeof number !== "number" || isNaN(number) || number < 0) {
        return "请输入大于等于 0 的数字作为排行榜显示人数。";
      }

      const whites = parseList(options?.whites);
      const blacks = [
        ...parseList(options?.blacks),
        ...config.hiddenChannelIdsInLeaderboard,
      ];
      const period = getPeriodFromOptions(options, "today");
      const { field, name: periodName } = periodMapping[period];

      let records: MessageCounterRecord[];
      let rankTitle: string;
      const rankTimeTitle = getCurrentBeijingTime();

      if (options?.specificUser) {
        const at = h.select(options.specificUser, "at");
        const userId = at.length ? at[0].attrs.id : options.specificUser;

        const userRecords = await ctx.database.get("message_counter_records", {
          userId,
          channelId: session.channelId,
        });
        const username =
          userRecords.length > 0
            ? userRecords[0].username || `用户${userId}`
            : `用户${userId}`;

        rankTitle = `${username}的${periodName}群发言排行榜`;
        records = await ctx.database.get("message_counter_records", { userId });
      } else {
        rankTitle = `全群${periodName}发言排行榜`;
        records = await ctx.database.get("message_counter_records", {});
      }

      const filteredRecords = filterRecordsByWhitesAndBlacks(
        records,
        "channelId",
        whites,
        blacks
      );

      if (filteredRecords.length === 0) {
        return `在当前条件下找不到任何群聊发言记录。`;
      }

      const { channelPostCounts, channelInfo, totalCount } =
        aggregateChannelData(filteredRecords, field);
      const sortedChannels = Object.entries(channelPostCounts).sort(
        ([, a], [, b]) => b - a
      );

      const rankingData = prepareChannelRankingData(
        sortedChannels,
        channelInfo,
        totalCount,
        number,
        session.channelId
      );

      return renderLeaderboard({
        rankTimeTitle,
        rankTitle,
        rankingData,
      });
    });

  guildCtx
    .command(
      "messageCounter.时间分布 [top:number]",
      "生成群聊发言时间分布的三维图表"
    )
    .option(
      "start",
      "-s <start:string> 起始时间（YYYY-MM-DD 或 YYYY-MM-DD HH:mm，北京时间）"
    )
    .option(
      "end",
      "-e <end:string> 结束时间（默认当前时间，北京时间）"
    )
    .option(
      "hours",
      "-H <hours:number> 回溯的小时数（未指定起始时间时生效，默认 24 小时）"
    )
    .option(
      "type",
      "-t <type:string> 图表类型：bar 或 line（默认 bar）"
    )
    .action(async ({ session, options }, top) => {
      try {
        if (!session) return;
        if (!config.enableTimelineTracking) {
          return "尚未开启时间序列统计，请在配置中启用后再试。";
        }
        if (!session.channelId) {
          return "该指令仅支持在群聊中使用。";
        }
        if (!ctx.puppeteer) {
          return "Puppeteer 服务未启用，无法生成三维时间分布图。";
        }

        const limitRaw = typeof top === "number" ? top : 10;
        const topLimit = Math.min(Math.max(Math.round(limitRaw), 1), 20);

        const chartType: "bar" | "line" =
          (options?.type || "").toLowerCase() === "line" ? "line" : "bar";
        const parsedEnd =
          parseDateInputToTimestamp(options?.end) ?? Date.now();
        const fallbackHours =
          typeof options?.hours === "number" && options.hours > 0
            ? options.hours
            : 24;
        const parsedStart =
          parseDateInputToTimestamp(options?.start) ??
          parsedEnd - fallbackHours * 60 * 60 * 1000;

        if (parsedStart >= parsedEnd) {
          return "开始时间需要早于结束时间。";
        }

        const bucketMinutes = config.timelineBucketMinutes;
        const { labels: bucketLabels } = buildBucketLabels(
          parsedStart,
          parsedEnd,
          bucketMinutes
        );
        if (!bucketLabels.length) {
          return "时间范围过短，无法生成图表。";
        }

        const startBucket = alignToBucketStart(parsedStart, bucketMinutes);
        const endBucket = alignToBucketStart(parsedEnd, bucketMinutes);
        const records = await loadTimelineRecordsForRange(
          session.channelId,
          startBucket,
          endBucket
        );
        if (records.length === 0) {
          return "所选时间范围内没有发言记录。";
        }

        const userTotals = new Map<string, number>();
        const usernameMap = new Map<string, string>();
        for (const record of records) {
          userTotals.set(
            record.userId,
            (userTotals.get(record.userId) || 0) + (record.count || 0)
          );
          if (!usernameMap.has(record.userId)) {
            usernameMap.set(record.userId, record.username || record.userId);
          }
        }

        const sortedUsers = Array.from(userTotals.entries()).sort(
          ([, a], [, b]) => b - a
        );
        const topUsers = sortedUsers.slice(0, topLimit);
        if (!topUsers.length) {
          return "所选时间范围内没有发言记录。";
        }

        const userLabels = topUsers.map(([userId]) => {
          const displayName = usernameMap.get(userId) || userId;
          return config.showStarInChart && userId === session.userId
            ? `★${displayName}`
            : displayName;
        });

        const seriesData = buildTimelineSeriesData({
          records,
          bucketLabels,
          topUsers,
          userLabels,
        });

        if (seriesData.maxValue === 0) {
          return "所选时间范围内没有发言记录。";
        }

        const rangeLabel = `${formatBeijingDateTime(
          parsedStart
        )} - ${formatBeijingDateTime(parsedEnd)}`;

        const imageBuffer = await generateTimelineChartImage({
          bucketLabels,
          userLabels,
          barData: seriesData.barData,
          lineSeries: seriesData.lineSeries,
          chartType,
          rangeLabel,
          maxValue: seriesData.maxValue,
          topLimit,
        });
        return h.image(imageBuffer, `image/${config.imageType}`);
      } catch (error) {
        logger.error("生成时间分布图失败:", error);
        return "生成时间分布图时出现问题，请稍后再试。";
      }
    });

  // 上传柱状条背景
  ctx
    .command(
      "messageCounter.上传柱状条背景",
      "上传/更新自定义的水平柱状条背景图"
    )
    .action(async ({ session }) => {
      if (!session || !session.userId) {
        return "无法获取用户信息，请稍后再试。";
      }
      if (!session.content) {
        return "请在发送指令的同时附带一张图片。新图片将会覆盖旧的背景。";
      }

      const imageElements = h.select(session.content, "img");
      if (imageElements.length === 0) {
        return "请在发送指令的同时附带一张图片。新图片将会覆盖旧的背景。";
      }

      const { userId } = session;

      // 辅助函数：清理用户旧的背景图
      const cleanupOldBackground = async () => {
        try {
          const allFiles = await fs.readdir(barBgImgsPath);
          // 查找所有以 "用户ID." 开头的文件，以匹配不同后缀名
          const userFiles = allFiles.filter((file) =>
            file.startsWith(`${userId}.`)
          );
          if (userFiles.length > 0) {
            await Promise.all(
              userFiles.map((file) => fs.unlink(path.join(barBgImgsPath, file)))
            );
          }
        } catch (error) {
          // 如果目录不存在，则无需处理，这是正常情况
          if (error.code !== "ENOENT") {
            logger.warn(`清理用户 ${userId} 的旧背景图时出错:`, error);
          }
        }
      };

      try {
        const imageUrl = imageElements[0].attrs.src;
        if (!imageUrl) {
          throw new Error("未能从消息中提取图片 URL。");
        }

        const buffer = Buffer.from(
          await ctx.http.get(imageUrl, { responseType: "arraybuffer" })
        );

        // 检查文件大小
        const imageSizeInMB = buffer.byteLength / 1024 / 1024;
        if (config.maxBarBgSize > 0 && imageSizeInMB > config.maxBarBgSize) {
          throw new Error(
            `图片文件过大（${imageSizeInMB.toFixed(2)}MB），请上传小于 ${config.maxBarBgSize
            }MB 的图片。`
          );
        }

        // 检查图片尺寸
        if (ctx.canvas) {
          try {
            const image = await ctx.canvas.loadImage(buffer);
            if (
              (config.maxBarBgWidth > 0 &&
                image.naturalWidth > config.maxBarBgWidth) ||
              (config.maxBarBgHeight > 0 &&
                image.naturalHeight > config.maxBarBgHeight)
            ) {
              throw new Error(
                `图片尺寸（${image.naturalWidth}x${image.naturalHeight}）超出限制（最大 ${config.maxBarBgWidth}x${config.maxBarBgHeight}）。\n建议尺寸为 850x50 像素。`
              );
            }
          } catch (error) {
            logger.error("解析图片尺寸失败:", error);
            throw new Error(
              "无法解析图片尺寸，请尝试使用其他标准图片格式（如 PNG, JPEG）。"
            );
          }
        } else {
          logger.warn("Canvas 服务未启用，跳过背景图尺寸检查。");
        }

        // 所有检查通过，先清理旧图，再保存新图
        await cleanupOldBackground();

        // 统一保存为 png 格式，文件名为 用户ID.png
        const newFileName = `${userId}.png`;
        const newFilePath = path.join(barBgImgsPath, newFileName);

        await fs.writeFile(newFilePath, buffer);
        await reloadBarBgImgCache();

        return "您的自定义柱状条背景已成功更新！";
      } catch (error) {
        logger.error(`为用户 ${userId} 上传背景图失败:`, error);

        // 上传失败，清理旧的背景图
        await cleanupOldBackground();
        await reloadBarBgImgCache(); // 清理后同样需要重载缓存

        const userMessage =
          error instanceof Error
            ? error.message
            : "图片保存时发生未知错误，请联系管理员。";
        return `图片上传失败: ${userMessage}\n您之前的自定义背景（如有）已被移除。`;
      }
    });

  // 重载资源
  ctx
    .command("messageCounter.重载资源", "重载图标、背景和字体资源", {
      authority: 2,
    })
    .action(async ({ session }) => {
      if (!session) return;

      await session.send("正在重新加载用户图标、背景图片和字体文件缓存...");

      await reloadIconCache();
      await reloadBarBgImgCache();
      await reloadFontCache(); // 调用字体缓存重载

      return `资源重载完毕！\n- 已加载 ${iconCache.length} 个用户图标。\n- 已加载 ${barBgImgCache.length} 个柱状条背景图片。\n- 已加载 ${fontFilesCache.length} 个字体文件。`;
    });

  // 清理缓存
  ctx
    .command("messageCounter.清理缓存", "清理过期的头像缓存文件", {
      authority: 3,
    })
    .option(
      "days",
      "-d <days:number> 清理超过指定天数未使用的缓存文件 (默认: 30)"
    )
    .action(async ({ session, options }) => {
      if (!session) return;

      const days = options.days ?? 30;
      if (typeof days !== "number" || days < 0) {
        return "请输入一个有效的天数（大于等于0）。";
      }

      await session.send(`正在开始清理 ${days} 天前的头像缓存，请稍候...`);

      const cacheDir = avatarsPath; // 使用已定义的头像缓存路径
      let deletedCount = 0;
      let totalFreedSize = 0;
      const now = Date.now();
      const expirationTime = now - days * 24 * 60 * 60 * 1000;

      try {
        const files = await fs.readdir(cacheDir);

        for (const file of files) {
          if (!file.endsWith(".json")) continue; // 只处理 .json 缓存文件

          const filePath = path.join(cacheDir, file);
          try {
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, "utf-8");
            const entry: AvatarCacheEntry = JSON.parse(content);

            // 检查时间戳是否早于我们设定的过期时间点
            if (entry.timestamp < expirationTime) {
              await fs.unlink(filePath);
              deletedCount++;
              totalFreedSize += stats.size;
            }
          } catch (error) {
            logger.warn(`处理缓存文件 ${file} 时出错，已跳过:`, error);
          }
        }

        const freedSizeFormatted = formatBytes(totalFreedSize);
        return `缓存清理完成！\n- 共删除 ${deletedCount} 个过期缓存文件。\n- 释放磁盘空间约 ${freedSizeFormatted}。`;
      } catch (error) {
        if (error.code === "ENOENT") {
          return "头像缓存目录不存在，无需清理。";
        }
        logger.error("清理头像缓存时发生未知错误:", error);
        return "清理过程中发生错误，请查看控制台日志。";
      }
    });

  // --- 辅助函数 ---
  // hs*

  async function recordTimelineCount(params: {
    channelId: string;
    channelName?: string;
    userId: string;
    username: string;
    timestamp: number;
  }) {
    if (!config.enableTimelineTracking) return;
    const bucketStart = alignToBucketStart(
      params.timestamp,
      config.timelineBucketMinutes
    );
    const bucketLabel = formatBucketLabel(bucketStart);

    try {
      await ctx.database.upsert(
        "message_counter_timeline",
        (row) => [
          {
            channelId: params.channelId,
            channelName: params.channelName || row.channelName,
            userId: params.userId,
            username: params.username || row.username,
            bucket: bucketLabel,
            bucketTimestamp: new Date(bucketStart),
            count: $.add(row.count, 1),
          },
        ],
        ["channelId", "userId", "bucket"]
      );
    } catch (error) {
      logger.warn(
        "记录时间序列数据失败: channel %s user %s bucket %s",
        params.channelId,
        params.userId,
        bucketLabel,
        error
      );
    }
  }

  async function cleanupTimelineData() {
    if (!config.enableTimelineTracking) return;
    if (config.timelineRetentionDays <= 0) return;

    const thresholdTime =
      Date.now() - config.timelineRetentionDays * 24 * 60 * 60 * 1000;
    const thresholdBucket = formatBucketLabel(
      alignToBucketStart(thresholdTime, config.timelineBucketMinutes)
    );

    try {
      await ctx.database.remove("message_counter_timeline", {
        bucket: { $lt: thresholdBucket } as any,
      });
    } catch (error) {
      logger.warn("清理过期时序数据失败:", error);
      try {
        const records = await ctx.database.get("message_counter_timeline", {});
        const expired = records.filter((record) => record.bucket < thresholdBucket);
        for (const record of expired) {
          await ctx.database.remove("message_counter_timeline", {
            channelId: record.channelId,
            userId: record.userId,
            bucket: record.bucket,
          });
        }
      } catch (fallbackError) {
        logger.warn("在回退清理时序数据时失败:", fallbackError);
      }
    }
  }

  /**
   * 检查字体文件，如果存在不规范的 vhea 版本，则创建一个修复后的副本，并返回可用字体的路径。
   * @param filePath 原始字体的绝对路径
   * @returns 一个保证可用的字体文件的绝对路径（可能是原始路径或修复后的副本路径）
   */
  async function patchAndGetUsableFontPath(filePath: string): Promise<string> {
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch (readError) {
      logger.warn(
        `读取字体文件 "${path.basename(filePath)}" 失败，已跳过。错误: ${readError.message
        }`
      );
      return filePath; // 返回原始路径，让后续流程处理错误
    }

    // --- 核心检查逻辑 (与之前相同) ---
    if (buffer.length < 12) return filePath;
    const numTables = buffer.readUInt16BE(4);
    for (let i = 0; i < numTables; i++) {
      const recordOffset = 12 + i * 16;
      if (recordOffset + 16 > buffer.length) break;
      if (buffer.toString("ascii", recordOffset, recordOffset + 4) === "vhea") {
        const tableOffset = buffer.readUInt32BE(recordOffset + 8);
        if (tableOffset + 4 > buffer.length) break;

        const version = buffer.readUInt32BE(tableOffset);
        const INCORRECT_VERSION = 0x00010001; // 65537

        if (version === INCORRECT_VERSION) {
          // --- 新的修复逻辑：创建副本 ---
          const parsedPath = path.parse(filePath);
          const patchedFilename = `${parsedPath.name}-patched${parsedPath.ext}`;
          const patchedFilePath = path.join(parsedPath.dir, patchedFilename);

          try {
            // 检查修复后的文件是否已存在。如果存在，就直接使用它，避免重复写入。
            await fs.access(patchedFilePath);
            return patchedFilePath;
          } catch (e) {
            // 修复后的文件不存在，现在创建它。
            logger.info(
              `检测到字体 "${path.basename(
                filePath
              )}" 不规范，正在创建修复版本 "${patchedFilename}"...`
            );
            const CORRECT_VERSION = 0x00010000; // 65536
            buffer.writeUInt32BE(CORRECT_VERSION, tableOffset);
            try {
              await fs.writeFile(patchedFilePath, buffer);
              logger.success(
                `已成功创建修复后的字体文件 "${patchedFilename}"。`
              );
              return patchedFilePath;
            } catch (writeError) {
              logger.warn(`创建修复字体副本失败: ${writeError.message}`);
              return filePath; // 创建失败，回退到使用原始文件
            }
          }
        }
        break; // 找到 vhea 表后即可退出
      }
    }
    // 如果字体本身没问题，返回原始路径
    return filePath;
  }

  /**
   * 将字节数格式化为易于阅读的字符串 (B, KB, MB, GB...)
   * @param bytes - 要格式化的字节数
   * @param decimals - 保留的小数位数
   * @returns 格式化后的字符串
   */
  function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  type PushPeriod = "today" | "yesterday" | "week" | "month" | "year";

  /**
   * 为自动推送功能生成并发送排行榜。
   * @param period - 排行榜的周期 ('today' 或 'yesterday')。
   */
  async function generateAndPushLeaderboard(period: PushPeriod) {
    const pushPeriodConfig = {
      today: { field: "todayPostCount", name: "今日" },
      yesterday: { field: "yesterdayPostCount", name: "昨日" },
      week: { field: "thisWeekPostCount", name: "上周" },
      month: { field: "thisMonthPostCount", name: "上月" },
      year: { field: "thisYearPostCount", name: "去年" },
    } as const; // 使用 as const 保证类型安全

    const { field, name: periodName } = pushPeriodConfig[period];

    logger.info(`[自动推送] 开始执行 ${periodName} 发言排行榜推送任务。`);

    const scopeName = "本群"; // 自动推送总是基于单个群聊的视角
    const rankTimeTitle = getCurrentBeijingTime();

    // 1. 优先获取所有机器人能触及的群聊列表，并建立一个 ID -> 带平台前缀ID 的映射
    const channelIdMap = new Map<string, string>(); // key: unprefixedId, value: prefixedId
    try {
      const channelListPromises = ctx.bots.map(async (bot) => {
        if (!bot.online || !bot.getChannelList) return [];
        let next: string | undefined;
        do {
          const result = await bot.getChannelList(next);
          if (!result || !result.data) {
            logger.warn(
              `[自动推送] 机器人 ${bot.platform} 获取群聊列表失败，已跳过。`
            );
            return [];
          }
          // 如果 result.data 没有 forEach 方法，可能是因为它不是数组
          if (!Array.isArray(result.data)) {
            logger.warn(
              `[自动推送] 机器人 ${bot.platform} 获取的群聊列表格式不正确，已跳过。`
            );
            return [];
          }
          result.data.forEach((channel) => {
            // 避免因多个机器人同在一个群而覆盖
            if (!channelIdMap.has(channel.id)) {
              channelIdMap.set(channel.id, `${bot.platform}:${channel.id}`);
            }
          });
          next = result.next;
        } while (next);
      });
      await Promise.all(channelListPromises);
    } catch (error) {
      logger.error("[自动推送] 获取所有群聊列表时出错，任务可能不完整:", error);
    }

    // 2. 确定需要推送的频道列表（使用 Set 自动去重）
    const targetChannels = new Set<string>();

    // 2.1 解析配置中的 pushChannelIds，利用映射表转换为带前缀的 ID
    for (const channelId of config.pushChannelIds || []) {
      if (channelId.includes(":")) {
        // 本身就是带前缀的 ID
        targetChannels.add(channelId);
      } else if (channelIdMap.has(channelId)) {
        // 在映射表中找到了对应的带前缀 ID
        targetChannels.add(channelIdMap.get(channelId)!);
      } else {
        logger.warn(
          `[自动推送] 无法在任何机器人实例中找到频道 ID: ${channelId}，已跳过。`
        );
      }
    }

    // 2.2 如果开启了“向所有群聊推送”，则添加所有已知的频道
    if (config.shouldSendLeaderboardNotificationsToAllChannels) {
      channelIdMap.forEach((prefixedId) => targetChannels.add(prefixedId));
    }

    // 2.3 应用排除列表
    const excluded = new Set(config.excludedLeaderboardChannels || []);
    if (excluded.size > 0) {
      for (const id of Array.from(targetChannels)) {
        // 兼容带前缀和不带前缀的排除项
        const unprefixedId = id.slice(id.indexOf(":") + 1);
        if (excluded.has(id) || excluded.has(unprefixedId)) {
          targetChannels.delete(id);
        }
      }
    }

    if (targetChannels.size === 0) {
      logger.info("[自动推送] 没有配置任何需要推送的频道，任务结束。");
      return;
    }

    logger.info(`[自动推送] 将向 ${targetChannels.size} 个频道进行推送。`);

    // 3. 遍历频道并推送 (修改点在于 field 和 periodName 已被通用化)
    for (const prefixedChannelId of targetChannels) {
      try {
        const platformSeparatorIndex = prefixedChannelId.indexOf(":");
        const channelId =
          platformSeparatorIndex === -1
            ? prefixedChannelId
            : prefixedChannelId.substring(platformSeparatorIndex + 1);

        const records = await ctx.database.get("message_counter_records", {
          channelId,
        });

        if (records.length === 0) {
          logger.info(
            `[自动推送] 频道 ${prefixedChannelId} 无发言记录，跳过。`
          );
          continue;
        }

        // 聚合数据时，使用我们动态选择的 `field`
        const userPostCounts: Dict<number> = {};
        const userInfo: Dict<{ username: string; avatar: string }> = {};
        let totalCount = 0;

        for (const record of records) {
          const count = (record[field] as number) || 0; // 读取正确的周期数据
          userPostCounts[record.userId] =
            (userPostCounts[record.userId] || 0) + count;
          if (!userInfo[record.userId]) {
            userInfo[record.userId] = {
              username: record.username,
              avatar:
                record.userAvatar ||
                `https://q1.qlogo.cn/g?b=qq&nk=${record.userId}&s=640`,
            };
          }
          totalCount += count;
        }

        const sortedUsers = Object.entries(userPostCounts)
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => b - a);

        if (sortedUsers.length === 0) {
          logger.info(
            `[自动推送] 频道 ${prefixedChannelId} 在 ${periodName} 榜单上无有效数据，跳过。`
          );
          continue;
        }

        const rankingData = prepareRankingData(
          sortedUsers,
          userInfo,
          totalCount,
          config.defaultMaxDisplayCount
        );

        if (config.isGeneratingRankingListPromptVisible) {
          await ctx.broadcast(
            [prefixedChannelId],
            `正在为本群生成${periodName}发言排行榜...`
          );
          await sleep(config.leaderboardGenerationWaitTime * 1000);
        }

        // 渲染时，使用我们动态选择的 `periodName`
        const rankTitle = `${scopeName}${periodName}发言排行榜`;
        const renderedMessage = await renderLeaderboard({
          rankTimeTitle,
          rankTitle,
          rankingData,
        });
        await ctx.broadcast([prefixedChannelId], renderedMessage);

        logger.success(
          `[自动推送] 已成功向频道 ${prefixedChannelId} 推送${periodName}排行榜。`
        );

        const randomDelay =
          Math.random() * config.groupPushDelayRandomizationSeconds;
        const delay =
          (config.delayBetweenGroupPushesInSeconds + randomDelay) * 1000;
        if (delay > 0) {
          await sleep(delay);
        }
      } catch (error) {
        logger.error(
          `[自动推送] 向频道 ${prefixedChannelId} 推送时发生错误:`,
          error
        );
      }
    }
    logger.info(`[自动推送] 所有推送任务执行完毕。`);
  }

  /**
   * 执行“抓龙王”禁言操作
   */
  async function performDragonKingMuting() {
    if (
      !config.enableMostActiveUserMuting ||
      !config.muteChannelIds ||
      config.muteChannelIds.length === 0
    ) {
      return;
    }
    logger.info("[抓龙王] 开始执行禁言任务。");

    // 等待设定的延迟时间
    await sleep(config.dragonKingDetainmentTime * 1000);

    for (const channelId of config.muteChannelIds) {
      try {
        const records = await ctx.database.get("message_counter_records", {
          channelId,
          yesterdayPostCount: { $gt: 0 }, // 只查找昨日有发言的
        });

        if (records.length === 0) {
          logger.info(`[抓龙王] 频道 ${channelId} 昨日无人发言，跳过。`);
          continue;
        }

        // 找出昨日发言最多的人
        const topUser = records.sort(
          (a, b) => b.yesterdayPostCount - a.yesterdayPostCount
        )[0];

        if (!topUser) continue;

        const durationInMs = config.detentionDuration * 24 * 60 * 60 * 1000;
        let isMuted = false;

        // 遍历所有在线的机器人，尝试使用标准 API 执行禁言
        for (const bot of ctx.bots) {
          // 只尝试在线的机器人
          if (bot.status !== 1) continue;
          try {
            // 使用标准的 bot.muteGuildMember API
            await bot.muteGuildMember(channelId, topUser.userId, durationInMs);

            // 只要有一个 bot 成功，就标记成功并停止尝试
            isMuted = true;
            logger.success(
              `[抓龙王] Bot ${bot.selfId} 已在频道 ${channelId} 将昨日龙王 ${topUser.username} (${topUser.userId}) 禁言 ${config.detentionDuration} 天。`
            );
            break; // 禁言成功，跳出循环
          } catch (e) {
            // 这个机器人可能不在该群或权限不足，这是正常现象，静默处理并尝试下一个
          }
        }

        if (isMuted) {
          // 禁言成功后，再向群内发送通知
          await ctx.broadcast(
            [channelId],
            `根据统计，昨日发言最多的是 ${h("at", {
              id: topUser.userId,
              name: topUser.username,
            })}，现执行禁言 ${config.detentionDuration} 天。`
          );
        } else {
          // 如果所有机器人都尝试失败了
          logger.warn(
            `[抓龙王] 在频道 ${channelId} 执行禁言失败。可能没有任何机器人拥有该群的管理员权限，或目标用户是管理员。`
          );
        }
      } catch (error) {
        logger.error(`[抓龙王] 在频道 ${channelId} 查找龙王时出错:`, error);
      }
    }
  }

  type PeriodIdentifier = "daily" | "weekly" | "monthly" | "yearly";

  /**
   * 初始化重置状态，防止首次启动时发生破坏性数据清除。
   * 此函数会在插件启动时运行，为每个周期检查并创建基准重置时间记录。
   */
  async function initializeResetStates() {
    logger.info("正在初始化并验证发言计数器的重置状态...");
    const now = new Date();
    const state = await ctx.database.get("message_counter_state", {});
    const stateMap = new Map(state.map((s) => [s.key, s.value]));

    const periods: PeriodIdentifier[] = [
      "daily",
      "weekly",
      "monthly",
      "yearly",
    ];

    for (const period of periods) {
      const key = `last_${period}_reset`;
      if (!stateMap.has(key)) {
        // 如果状态不存在，说明是首次运行或数据被清除。
        // 我们不执行重置，而是创建一个安全的基准时间点。
        let baselineDate: Date;
        switch (period) {
          case "daily":
            baselineDate = new Date();
            baselineDate.setHours(0, 0, 0, 0);
            break;
          case "weekly":
            baselineDate = new Date(now);
            baselineDate.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            baselineDate.setHours(0, 0, 0, 0);
            break;
          case "monthly":
            baselineDate = new Date(now.getFullYear(), now.getMonth(), 1);
            baselineDate.setHours(0, 0, 0, 0);
            break;
          case "yearly":
            baselineDate = new Date(now.getFullYear(), 0, 1);
            baselineDate.setHours(0, 0, 0, 0);
            break;
        }

        await ctx.database.upsert("message_counter_state", [
          { key, value: baselineDate },
        ]);
        logger.info(
          `已为 '${period}' 周期初始化重置状态，基准时间：${baselineDate.toISOString()}`
        );
      }
    }
    logger.info("所有周期的重置状态已验证完毕。");
  }

  /**
   * 检查指定周期的重置任务是否应该执行。
   * 通过查询数据库中的最后重置时间，并与当前周期的起始时间对比，来防止重复执行。
   * @param period 要检查的周期 ('daily', 'weekly', 'monthly', 'yearly')。
   * @returns 如果需要重置，则返回 true；否则返回 false。
   */
  async function isResetDue(period: PeriodIdentifier): Promise<boolean> {
    const now = new Date();
    const state = await ctx.database.get("message_counter_state", {
      key: `last_${period}_reset`,
    });
    // 如果数据库中没有记录，则认为它从未重置过，使用一个很早的时间点。
    const lastReset = state.length ? new Date(state[0].value) : new Date(0);

    let periodStart: Date;

    switch (period) {
      case "daily":
        periodStart = new Date();
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        // 将日期设置为本周的周一。 (day + 6) % 7 是从周一算起的天数。
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "yearly":
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodStart.setHours(0, 0, 0, 0);
        break;
    }

    // 核心判断：如果上次重置时间早于当前周期的起始时间，那么就需要执行重置。
    return lastReset < periodStart;
  }

  /**
   * 检查并执行错过的重置任务
   * 现在将使用 isResetDue() 来判断是否需要补上任务。
   */
  async function checkForMissedResets() {
    logger.info("正在检查错过的计数器重置任务...");

    // 定义任务，以便循环处理
    const jobDefinitions: {
      period: PeriodIdentifier;
      field: CountField;
      message: string;
    }[] = [
        {
          period: "daily",
          field: "todayPostCount",
          message: "已补上错过的每日发言榜重置！",
        },
        {
          period: "weekly",
          field: "thisWeekPostCount",
          message: "已补上错过的每周发言榜重置！",
        },
        {
          period: "monthly",
          field: "thisMonthPostCount",
          message: "已补上错过的每月发言榜重置！",
        },
        {
          period: "yearly",
          field: "thisYearPostCount",
          message: "已补上错过的每年发言榜重置！",
        },
      ];

    for (const job of jobDefinitions) {
      if (await isResetDue(job.period)) {
        logger.info(`检测到错过的 ${job.period} 重置任务，正在执行...`);
        await resetCounter(job.field, job.message, job.period);
      }
    }

    logger.info("错过的计数器重置任务检查完毕。");
  }

  /**
   * 重置计数器并更新状态
   * @param field 要重置的数据库字段
   * @param message 重置后发送的消息
   * @param period 周期标识符
   */
  async function resetCounter(
    field: CountField,
    message: string,
    period: PeriodIdentifier
  ) {
    // 当重置“今日”发言时，首先把“今日”的数据备份到“昨日”
    if (field === "todayPostCount") {
      logger.info("正在更新昨日发言数...");
      await ctx.database.set("message_counter_records", {}, (row) => ({
        yesterdayPostCount: row.todayPostCount,
      }));
      logger.success("更新昨日发言数完成。");
    }

    // 然后将相应的字段置零
    await ctx.database.set("message_counter_records", {}, { [field]: 0 });
    logger.success(message);

    // 更新状态表，记录本次重置时间
    await ctx.database.upsert("message_counter_state", [
      {
        key: `last_${period}_reset`,
        value: new Date(),
      },
    ]);
    logger.success(`已更新 ${period} 周期的最后重置时间。`);
  }

  // 将数字格式化为保留两位小数的百分比字符串，例如 "12.34%"
  function formatPercentageForDisplay(count: number, total: number): string {
    if (total === 0) {
      return "(0%)";
    }
    const percentage = (count / total) * 100;
    // 使用 toFixed(2) 保证最多两位小数，然后用 parseFloat 去掉末尾多余的 .0 和 0
    const formattedNumber = parseFloat(percentage.toFixed(2));
    return `(${formattedNumber}%)`;
  }

  async function loadTimelineRecordsForRange(
    channelId: string,
    startBucket: number,
    endBucket: number
  ): Promise<MessageCounterTimelineRecord[]> {
    try {
      return await ctx.database.get("message_counter_timeline", {
        channelId,
        bucketTimestamp: {
          $gte: new Date(startBucket),
          $lte: new Date(endBucket),
        } as any,
      });
    } catch (error) {
      logger.warn(
        "按时间范围获取时序数据失败，改为在内存中过滤: %o",
        error
      );
      const all = await ctx.database.get("message_counter_timeline", {
        channelId,
      });
      return all.filter((record) => {
        const tsFromDate = new Date(record.bucketTimestamp).getTime();
        const ts =
          Number.isNaN(tsFromDate) && record.bucket
            ? parseBucketLabel(record.bucket)
            : tsFromDate;
        return ts >= startBucket && ts <= endBucket;
      });
    }
  }

  function buildTimelineSeriesData(params: {
    records: MessageCounterTimelineRecord[];
    bucketLabels: string[];
    topUsers: [string, number][];
    userLabels: string[];
  }): {
    barData: number[][];
    lineSeries: { name: string; data: number[][] }[];
    maxValue: number;
  } {
    const bucketIndexMap = new Map(
      params.bucketLabels.map((label, index) => [label, index])
    );
    const userIndexMap = new Map(
      params.topUsers.map(([userId], index) => [userId, index])
    );
    const matrix = params.bucketLabels.map(() =>
      new Array(params.topUsers.length).fill(0)
    );

    let maxValue = 0;

    for (const record of params.records) {
      const xIndex = bucketIndexMap.get(record.bucket);
      const yIndex = userIndexMap.get(record.userId);
      if (xIndex === undefined || yIndex === undefined) continue;

      const value = (matrix[xIndex][yIndex] || 0) + (record.count || 0);
      matrix[xIndex][yIndex] = value;
      if (value > maxValue) {
        maxValue = value;
      }
    }

    const barData: number[][] = [];
    for (let i = 0; i < params.bucketLabels.length; i++) {
      for (let j = 0; j < params.topUsers.length; j++) {
        const value = matrix[i][j] || 0;
        barData.push([i, j, value]);
        if (value > maxValue) {
          maxValue = value;
        }
      }
    }

    const lineSeries = params.topUsers.map(([,], userIndex) => ({
      name: params.userLabels[userIndex],
      data: params.bucketLabels.map((_, bucketIndex) => [
        bucketIndex,
        userIndex,
        matrix[bucketIndex][userIndex] || 0,
      ]),
    }));

    return { barData, lineSeries, maxValue };
  }

  /**
   * getAvatarAsBase64 函数
   * 实现了成功的长 TTL 缓存和失败的短 TTL 缓存策略。
   * @param url 头像的URL
   * @returns 处理后的头像 base64 字符串
   */
  async function getAvatarAsBase64(url: string): Promise<string> {
    if (!url) {
      return fallbackBase64[0];
    }

    const now = Date.now();
    // 从配置中获取成功和失败的缓存有效期（转换为毫秒）
    const successTtl = config.avatarCacheTTL * 1000;
    const failureTtl = config.avatarFailureCacheTTL * 1000;

    // 辅助函数，用于检查缓存条目是否过期
    const isEntryExpired = (entry: AvatarCacheEntry): boolean => {
      // 判断缓存的头像是真实头像还是备用头像
      const isFallback = entry.base64 === fallbackBase64[0];
      // 根据情况选择对应的 TTL
      const ttl = isFallback ? failureTtl : successTtl;
      // 如果 TTL 设置为 0 且不是失败缓存，则永不过期
      if (ttl === 0 && !isFallback) return false;
      // 检查当前时间是否已超过缓存的创建时间+有效期
      return now - entry.timestamp >= ttl;
    };

    // 1. 检查内存缓存 (Hot Cache)，用于最快的响应
    if (avatarCache.has(url)) {
      const entry = avatarCache.get(url)!;
      if (!isEntryExpired(entry)) {
        // 内存缓存命中且未过期，直接返回
        return entry.base64;
      }
    }

    // 2. 检查磁盘缓存 (Persistent Cache)，用于持久化
    // 使用 URL 的 MD5 哈希作为文件名，避免特殊字符和路径过长问题
    const hash = crypto.createHash("md5").update(url).digest("hex");
    const cacheFilePath = path.join(avatarsPath, `${hash}.json`);

    try {
      const cachedFile = await fs.readFile(cacheFilePath, "utf-8");
      const entry: AvatarCacheEntry = JSON.parse(cachedFile);

      if (!isEntryExpired(entry)) {
        // 磁盘缓存命中且未过期，将其加载到内存并返回
        avatarCache.set(url, entry); // 更新内存缓存
        return entry.base64;
      }
    } catch (error) {
      // 捕获错误（如文件不存在、JSON解析失败），意味着磁盘缓存无效，继续执行网络请求
    }

    // 3. 从网络获取，并根据结果应用不同的缓存策略
    let finalBase64 = fallbackBase64[0];
    try {
      if (!ctx.canvas) {
        throw new Error("Canvas service is not available.");
      }
      // 设置5秒超时，防止请求卡死
      const buffer = await ctx.http.get(url, {
        responseType: "arraybuffer",
        timeout: 5000,
      });
      // 使用 canvas 将图片统一处理为 50x50 的 PNG
      const image = await ctx.canvas.loadImage(buffer);
      const canvas = await ctx.canvas.createCanvas(50, 50);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, 50, 50);
      finalBase64 = (await canvas.toBuffer("image/png")).toString("base64");
    } catch (error) {
      logger.warn(
        `获取或处理头像失败 (URL: ${url})，将使用默认头像并缓存失败状态:`,
        error.message || error
      );
      // 如果获取或处理失败，finalBase64 保持为 fallbackBase64
    }

    // 4. 将获取结果（无论成功或失败）写入缓存
    const newEntry: AvatarCacheEntry = {
      base64: finalBase64,
      timestamp: now,
    };

    try {
      // 同时写入磁盘和内存，确保数据同步
      await fs.writeFile(cacheFilePath, JSON.stringify(newEntry));
      avatarCache.set(url, newEntry);
    } catch (cacheError) {
      logger.error(
        `无法写入头像缓存文件 (Path: ${cacheFilePath}):`,
        cacheError
      );
    }

    return newEntry.base64;
  }

  async function reloadIconCache() {
    iconCache = await loadAssetsFromFolder(iconsPath);
    logger.info(`已加载 ${iconCache.length} 个用户图标。`);
  }

  async function reloadBarBgImgCache() {
    barBgImgCache = await loadAssetsFromFolder(barBgImgsPath);
    logger.info(`已加载 ${barBgImgCache.length} 个柱状图背景图片。`);
  }

  /**
   * 重新加载字体缓存，自动修复不规范的 TTF/OTF 文件，并包含 WOFF/WOFF2 等其他格式。
   */
  async function reloadFontCache() {
    try {
      await fs.access(fontsPath);
      const files = await fs.readdir(fontsPath);
      const usableFontBasenames = new Set<string>(); // 使用 Set 自动处理重复项

      for (const file of files) {
        // 跳过我们自己创建的 "-patched" 文件，避免将其作为原始文件处理
        if (file.toLowerCase().includes("-patched.")) {
          continue;
        }

        const lowerCaseFile = file.toLowerCase();

        if (lowerCaseFile.endsWith(".ttf") || lowerCaseFile.endsWith(".otf")) {
          // 对 TTF/OTF 文件应用修复逻辑
          const filePath = path.join(fontsPath, file);
          const usablePath = await patchAndGetUsableFontPath(filePath);
          usableFontBasenames.add(path.basename(usablePath));
        } else if (
          lowerCaseFile.endsWith(".woff2") ||
          lowerCaseFile.endsWith(".woff")
        ) {
          // 对于 WOFF/WOFF2 文件，直接视为可用并添加
          usableFontBasenames.add(file);
        }
        // 其他非字体文件将被忽略
      }

      // 将 Set 转换为数组，更新缓存
      fontFilesCache = [...usableFontBasenames];
      logger.info(`已加载 ${fontFilesCache.length} 个可用字体文件。`);
    } catch (error) {
      logger.warn(`无法读取或重载字体目录 ${fontsPath}:`, error);
      fontFilesCache = [];
    }
  }

  // 自动迁移旧资源文件到新目录结构
  async function migrateFolder(oldPath: string, newPath: string) {
    try {
      await fs.access(oldPath, fsConstants.F_OK); // 检查旧文件夹是否存在
      logger.info(`检测到旧资源文件夹: ${oldPath}，将迁移至: ${newPath}`);
      const files = await fs.readdir(oldPath);
      for (const file of files) {
        const oldFile = path.join(oldPath, file);
        const newFile = path.join(newPath, file);
        try {
          // 尝试移动，如果目标文件已存在则跳过
          await fs.rename(oldFile, newFile);
        } catch (renameError) {
          if (renameError.code !== "EEXIST") {
            logger.warn(`迁移文件 ${file} 失败:`, renameError);
          }
        }
      }
      await sleep(100); // 短暂等待以确保文件系统同步
      await fs.rmdir(oldPath);
      logger.info(`旧资源文件夹 ${oldPath} 迁移成功并已删除。`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // ENOENT (Not Found) 是正常情况，说明无需迁移
        logger.warn(`处理旧文件夹 ${oldPath} 时出错:`, error);
      }
    }
  }

  // 拷贝渲染所需的核心文件 (HTML 和内置字体)
  async function copyAssetIfNotExists(
    sourceDir: string,
    destDir: string,
    filename: string,
    assetSubDir: string = "" // 用于处理打包后资源路径的变化
  ) {
    const destPath = path.join(destDir, filename);
    try {
      // 仅当目标文件不存在时才拷贝
      await fs.access(destPath, fsConstants.F_OK);
    } catch {
      // 目标文件不存在，开始拷贝
      let sourcePath = path.join(sourceDir, assetSubDir, filename);
      try {
        await fs.access(sourcePath, fsConstants.F_OK);
      } catch {
        // 如果在 assetSubDir 找不到，尝试在根目录找
        sourcePath = path.join(sourceDir, filename);
        try {
          await fs.access(sourcePath, fsConstants.F_OK);
        } catch {
          logger.warn(`插件资源文件未找到，无法拷贝: ${filename}`);
          return;
        }
      }
      await fs.copyFile(sourcePath, destPath);
      logger.info(`已拷贝资源文件 ${filename} 到 ${destDir}`);
    }
  }

  /**
   * 根据字体缓存动态生成 @font-face CSS 规则。
   * @param fontFiles - 缓存的字体文件名列表。
   * @returns 包含所有 @font-face 规则的 CSS 字符串。
   */
  function generateFontFacesCSS(fontFiles: string[]): string {
    let css = "";
    for (const file of fontFiles) {
      // 原始文件名（不含后缀），用于生成安全的 CSS 名称
      const rawFontName = path.parse(file).name.replace(/-patched$/i, "");
      const ext = path.parse(file).ext.toLowerCase();
      let format: string;

      switch (ext) {
        case ".woff2":
          format = "woff2";
          break;
        case ".woff":
          format = "woff";
          break;
        case ".ttf":
          format = "truetype";
          break;
        case ".otf":
          format = "opentype";
          break;
        default:
          continue; // 跳过不支持或非字体的文件
      }

      const fontUrl = `fonts/${file}`;

      css += `
        @font-face {
          font-family: '${rawFontName}';
          src: url("${fontUrl}") format('${format}');
        }
      `;
    }

    return css;
  }

  /** 缓存加载函数 */
  async function loadAssetsFromFolder(
    folderPath: string
  ): Promise<AssetData[]> {
    const assetData: AssetData[] = [];
    try {
      await fs.access(folderPath, fsConstants.R_OK); // 检查目录是否存在且可读
      const files = await fs.readdir(folderPath);

      for (const file of files) {
        const userId = path.parse(file).name.split("-")[0].trim();
        const filePath = path.join(folderPath, file);
        try {
          const fileData = await fs.readFile(filePath);
          assetData.push({ userId, base64: fileData.toString("base64") });
        } catch (readError) {
          logger.warn(`Failed to read asset file ${filePath}:`, readError);
        }
      }
    } catch (err) {
      logger.warn(`Error accessing asset folder ${folderPath}:`, err);
    }
    return assetData;
  }

  /** 聚合群组数据 */
  function aggregateChannelData(
    records: MessageCounterRecord[],
    field: CountField
  ) {
    const channelPostCounts: Dict<number> = {};
    const channelInfo: Dict<{ channelName: string }> = {};
    let totalCount = 0;

    for (const record of records) {
      const count = (record[field] as number) || 0;
      channelPostCounts[record.channelId] =
        (channelPostCounts[record.channelId] || 0) + count;
      if (!channelInfo[record.channelId]) {
        channelInfo[record.channelId] = {
          channelName: record.channelName || `群聊${record.channelId}`,
        };
      }
      totalCount += count;
    }
    return { channelPostCounts, channelInfo, totalCount };
  }

  /** 为群组排行榜准备 RankingData，并确保当前群在榜单中 */
  function prepareChannelRankingData(
    sortedChannels: [string, number][],
    channelInfo: Dict<{ channelName: string }>,
    totalCount: number,
    limit: number,
    currentChannelId?: string
  ): RankingData[] {
    const topChannels = sortedChannels.slice(0, limit);
    const isCurrentInTop =
      currentChannelId &&
      topChannels.some(([channelId]) => channelId === currentChannelId);

    // 如果当前群聊不在榜单上，则找到它的数据并直接追加到末尾
    if (currentChannelId && !isCurrentInTop) {
      const currentChannelData = sortedChannels.find(
        ([channelId]) => channelId === currentChannelId
      );
      if (currentChannelData) {
        topChannels.push(currentChannelData);
      }
    }

    return topChannels.map(([channelId, count]) => ({
      // 增加★高亮当前群聊
      name:
        (channelId === currentChannelId ? "★" : "") +
        (channelInfo[channelId]?.channelName || `群聊${channelId}`),
      // 使用 channelId 作为 RankingData 的 userId 和头像源
      userId: channelId,
      avatar: `https://p.qlogo.cn/gh/${channelId === "#" ? "426230045" : channelId
        }/${channelId === "#" ? "426230045" : channelId}/100`, // QQ群头像URL格式
      count,
      percentage: calculatePercentage(count, totalCount),
    }));
  }

  // --- 辅助函数：图表生成 ---

  /**
   * 生成图表的静态 CSS 样式。
   * @returns 包含基本元素样式的 CSS 字符串。
   */
  function _getChartBaseStyles(): string {
    return `
      html {
        min-height: 100%;
      }

      body {
        font-family: sans-serif;
        margin: 0;
        padding: 20px;
        width: 100%;
        min-height: 100%;
        box-sizing: border-box;
      }

    .ranking-title {
      text-align: center;
      margin-bottom: 20px;
      color: #333;
      font-style: normal;
    }

      /* 预加载字体用，不显示 */
      .font-preload {
        display: none;
      }
    `;
  }

  /**
   * 准备图表的背景样式。
   * 此函数根据配置生成应用于整个 HTML 页面的背景 CSS。
   * 通过将样式应用于 `<html>` 标签，确保背景能完全覆盖 `fullPage` 截图的区域。
   * @param config 插件配置对象。
   * @returns 一个包含背景样式的 CSS 字符串。
   */
  async function _prepareBackgroundStyle(config: Config): Promise<string> {
    if (config.backgroundType === "api" && config.apiBackgroundConfig?.apiUrl) {
      try {
        const { apiUrl, apiKey, responseType } = config.apiBackgroundConfig;
        const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
        let backgroundImage: string;

        switch (responseType) {
          case "url": {
            // API 返回一个包含图片 URL 的 JSON 或纯文本
            const response = await ctx.http.get(apiUrl, { headers });
            const imageUrl =
              typeof response === "string" ? response : response?.url;
            if (!imageUrl || typeof imageUrl !== "string") {
              throw new Error(
                'API response for "url" type is not a valid string.'
              );
            }
            backgroundImage = `url('${imageUrl}')`;
            break;
          }

          case "base64": {
            // API 返回一个包含 Base64 数据的 JSON 或纯文本
            const response = await ctx.http.get(apiUrl, { headers });
            const base64Data =
              typeof response === "string" ? response : response?.data;
            if (!base64Data || typeof base64Data !== "string") {
              throw new Error(
                'API response for "base64" type is not a valid string.'
              );
            }
            // 自动检测并添加 data URI scheme
            const prefix = base64Data.startsWith("data:image")
              ? ""
              : "data:image/png;base64,";
            backgroundImage = `url('${prefix}${base64Data}')`;
            break;
          }

          case "binary":
          default: {
            // API 返回原始图片数据（二进制）
            const responseBuffer = await ctx.http.get<ArrayBuffer>(apiUrl, {
              headers,
              responseType: "arraybuffer",
            });
            const base64 = Buffer.from(responseBuffer).toString("base64");
            backgroundImage = `url('data:image/png;base64,${base64}')`;
            break;
          }
        }

        return `html {
          background-image: ${backgroundImage};
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }`;
      } catch (error) {
        logger.error("获取 API 背景图失败，将使用默认背景:", error);
      }
    }

    if (config.backgroundType === "css" && config.backgroundValue) {
      return config.backgroundValue;
    }

    return `html {
      background: linear-gradient(135deg, #f6f8f9 0%, #e5ebee 100%);
    }`;
  }

  /**
   * 获取在浏览器端执行的绘图脚本。
   * @returns 一个 IIFE (立即调用函数表达式) 字符串，用于在浏览器中绘制 Canvas。
   */
  function _getClientScript(): string {
    // 此函数返回一个字符串，该字符串是将在 Puppeteer 浏览器上下文中执行的完整脚本。
    // 使用 IIFE (async (...) => { ... }) 格式，以便在 HTML 中清晰地传递参数。
    return `
      async ({ rankingData, iconData, barBgImgs, config }) => {
        // --- 主绘制函数 ---
        async function drawRanking() {
          const maxCount = rankingData.reduce((max, item) => Math.max(max, item.count), 0) || 1;
          const userNum = rankingData.length;
          const userAvatarSize = 50;
          const tableWidth = 200 + 7 * 100; // 固定宽度
          const canvasHeight = 50 * userNum;

          const canvas = document.getElementById('rankingCanvas');
          let context = canvas.getContext('2d');

          // 根据最大计数的文本宽度动态调整画布宽度，以防数字溢出
          context.font = \`30px "\${config.chartNicknameFont}", HarmonyOS_Sans_Medium, "Microsoft YaHei", sans-serif\`;
          // 找到拥有最大发言数的条目，因为它的文本通常最长
          const maxCountData = rankingData.find(d => d.count === maxCount) || rankingData[0] || { count: 1, percentage: 0 };
          let maxCountText = maxCount.toString();
          if (config.isUserMessagePercentageVisible && maxCountData) {
              const percentage = maxCountData.percentage;
              let percentageStr = percentage < 0.01 && percentage > 0 ? '<0.01' : percentage.toFixed(percentage < 1 ? 2 : 0);
              maxCountText += \` ( \${percentageStr}%)\`;
          }
          const maxCountTextWidth = context.measureText(maxCountText).width;

          // 最长进度条的宽度是固定的
          const maxBarWidth = 150 + 700; // 进度条区域总宽度

          // 计算最终画布宽度：头像(50) + 进度条(850) + 文本与进度条间距(10) + 文本宽度 + 右侧留白(20)
          // 头像左侧的空白由页面 body 的 padding 提供
          canvas.width = 50 + maxBarWidth + 10 + maxCountTextWidth + 20;
          canvas.height = canvasHeight;

          // 重新获取上下文，因为尺寸变化会重置状态
          context = canvas.getContext('2d');

          // 按顺序绘制图层
          await drawRankingBars(context, maxCount, userAvatarSize, tableWidth); // 传递动态的 canvas.width
          await drawAvatars(context, userAvatarSize);
          drawVerticalLines(context, canvas.height, tableWidth); // 竖线仍然可以按旧的固定宽度绘制，不影响主体
        }

        // --- 核心绘图逻辑 ---

        async function drawRankingBars(context, maxCount, userAvatarSize, canvasWidth) { // 接收 canvasWidth
          for (const [index, data] of rankingData.entries()) {
            const countBarWidth = 150 + (700 * data.count) / maxCount;
            const countBarX = 50; // 头像宽度
            const countBarY = 50 * index;

            let avgColor = await getAverageColor(data.avatarBase64);
            const colorWithOpacity = addOpacityToColor(avgColor, 0.5);

            // 绘制底色进度条
            context.fillStyle = avgColor;
            context.fillRect(countBarX, countBarY, countBarWidth, userAvatarSize);

            // 绘制自定义背景图
            const userBarBgImgs = findAssets(data.userId, barBgImgs, 'barBgImgBase64');
            if (userBarBgImgs.length > 0) {
              const randomBarBgImgBase64 = userBarBgImgs[Math.floor(Math.random() * userBarBgImgs.length)];
              avgColor = await drawCustomBarBackground(context, randomBarBgImgBase64, countBarX, countBarY, countBarWidth, userAvatarSize, canvasWidth); // 传递 canvasWidth
            }

            // 绘制剩余部分灰色背景
            const remainingBarX = countBarX + countBarWidth;
            // 确保灰色背景能填满到画布最右侧，减去文本区域
            context.fillStyle = colorWithOpacity;
            context.fillRect(remainingBarX, countBarY, canvasWidth - remainingBarX, userAvatarSize);

            // 绘制文本和图标
            await drawTextAndIcons(context, data, index, avgColor, countBarX, countBarY, countBarWidth, userAvatarSize);
          }
        }

        async function drawCustomBarBackground(context, base64, x, y, barWidth, barHeight, canvasWidth) { // 接收 canvasWidth
            return new Promise(async (resolve) => {
                const barBgImg = new Image();
                barBgImg.src = "data:image/png;base64," + base64;
                barBgImg.onload = async () => {
                    context.save();
                    // 绘制整行背景（如果透明度 > 0）
                    if (config.horizontalBarBackgroundFullOpacity > 0) {
                        context.globalAlpha = config.horizontalBarBackgroundFullOpacity;
                        context.drawImage(barBgImg, x, y, canvasWidth - x, barHeight); // 填充到画布右侧
                    }
                    // 绘制进度条区域背景
                    context.globalAlpha = config.horizontalBarBackgroundOpacity;
                    context.drawImage(barBgImg, 0, 0, barWidth, barHeight, x, y, barWidth, barHeight);
                    context.restore();
                    const newAvgColor = await getAverageColor(base64);
                    resolve(newAvgColor);
                };
                barBgImg.onerror = async () => {
                    const originalColor = await getAverageColor(base64);
                    resolve(originalColor); // 发生错误则返回原始颜色
                }
            });
        }

        async function drawTextAndIcons(context, data, index, avgColor, barX, barY, barWidth, barHeight) {
            // 字体栈包含了用户选择的字体、插件内置字体和通用字体，以确保兼容性。
            context.font = \`30px "\${config.chartNicknameFont}", HarmonyOS_Sans_Medium, "Microsoft YaHei", sans-serif\`;
            const textY = barY + barHeight / 2 + 10.5;


            // 绘制发言次数和百分比
            let countText = data.count.toString();
            if (config.isUserMessagePercentageVisible) {
                const percentage = data.percentage;
                let percentageStr = percentage < 0.01 && percentage > 0 ? '<0.01' : percentage.toFixed(percentage < 1 ? 2 : 0);
                countText += \` ( \${percentageStr}%)\`;
            }

            const countTextWidth = context.measureText(countText).width;
            const countTextX = barX + barWidth + 10;

            if (countTextX + countTextWidth > context.canvas.width - 5) {
                context.fillStyle = chooseColorAdjustmentMethod(avgColor);
                context.textAlign = "right";
                context.fillText(countText, barX + barWidth - 10, textY);
            } else {
                context.fillStyle = "rgba(0, 0, 0, 1)";
                context.textAlign = "left";
                context.fillText(countText, countTextX, textY);
            }

            // 绘制用户名（带截断）
            context.fillStyle = chooseColorAdjustmentMethod(avgColor);
            context.textAlign = "left"; // 重置对齐方式，以防被上一部分修改

            let nameText = data.name;
            const maxNameWidth = barWidth - 60;
            if (context.measureText(nameText).width > maxNameWidth) {
                const ellipsis = "...";
                while (context.measureText(nameText + ellipsis).width > maxNameWidth && nameText.length > 0) {
                    nameText = nameText.slice(0, -1);
                }
                nameText += ellipsis;
            }
            const nameTextX = barX + 10;
            context.fillText(nameText, nameTextX, textY);

            // 绘制用户自定义图标
            const userIcons = findAssets(data.userId, iconData, 'iconBase64');
            if (userIcons.length > 0) {
                await drawUserIcons(context, userIcons, {
                    nameText: data.name, // 传递原始nameText用于计算位置
                    nameTextX: context.measureText(nameText).width + nameTextX,
                    barX: barX,
                    barWidth: barWidth,
                    textY: textY
                });
            }
        }

        async function drawUserIcons(context, icons, positions) {
            const { nameTextX, barX, barWidth, textY } = positions;

            // 使用 Promise.all 等待所有图片加载和绘制
            await Promise.all(icons.map((iconBase64, i) => {
                return new Promise((resolve, reject) => {
                    const icon = new Image();
                    icon.src = "data:image/png;base64," + iconBase64;
                    icon.onload = () => {
                        const iconSize = 40;
                        const iconY = textY - 30;
                        let iconX = config.shouldMoveIconToBarEndLeft
                            ? barX + barWidth - (iconSize * (i + 1))
                            : nameTextX + (iconSize * i) + 5;
                        context.drawImage(icon, iconX, iconY, iconSize, iconSize);
                        resolve(); // 图片绘制成功
                    };
                    icon.onerror = () => {
                        resolve(); // 即使单个图标加载失败，也继续执行，不中断整个排行榜生成
                    };
                });
            }));
        }

        async function drawAvatars(context, userAvatarSize) {
          for (const [index, data] of rankingData.entries()) {
            const image = new Image();
            image.src = "data:image/png;base64," + data.avatarBase64;
            // onload不是必需的，因为图片已是base64，但为了健壮性可以保留
            await new Promise(resolve => {
                image.onload = () => {
                    context.drawImage(image, 0, 50 * index, userAvatarSize, userAvatarSize);
                    resolve();
                };
                image.onerror = resolve; // 即使加载失败也继续
            });
          }
        }

        function drawVerticalLines(context, canvasHeight, tableWidth) {
            context.fillStyle = "rgba(0, 0, 0, 0.12)";
            const verticalLineWidth = 3;
            const firstLineX = 200;
            for (let i = 0; i < 8; i++) {
                context.fillRect(firstLineX + 100 * i, 0, verticalLineWidth, canvasHeight);
            }
        }


        // --- 辅助工具函数 ---

        function findAssets(userId, assetList, key) {
          return assetList
            .filter(data => data.userId === userId)
            .map(data => data[key]);
        }

        function addOpacityToColor(color, opacity) {
          const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
          return \`\${color}\${opacityHex}\`;
        }

        function chooseColorAdjustmentMethod(hexcolor) {
            const rgb = hexToRgb(hexcolor)
            const yiqBrightness = calculateYiqBrightness(rgb)
            if (yiqBrightness > 0.2 && yiqBrightness < 0.8) {
                return adjustColorHsl(hexcolor)
            } else {
                return adjustColorYiq(hexcolor)
            }
        }

        function calculateYiqBrightness(rgb) {
            return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 / 255
        }

        function adjustColorYiq(hexcolor) {
            const rgb = hexToRgb(hexcolor)
            const yiqBrightness = calculateYiqBrightness(rgb)
            return yiqBrightness >= 0.8 ? "#000000" : "#FFFFFF"
        }

        function adjustColorHsl(hexcolor) {
            const rgb = hexToRgb(hexcolor)
            let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
            hsl.l = hsl.l < 0.5 ? hsl.l + 0.3 : hsl.l - 0.3
            hsl.s = hsl.s < 0.5 ? hsl.s + 0.3 : hsl.s - 0.3
            const contrastRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
            return rgbToHex(contrastRgb.r, contrastRgb.g, contrastRgb.b)
        }

        function hexToRgb(hex) {
            const sanitizedHex = String(hex).replace("#", "")
            const bigint = parseInt(sanitizedHex, 16)
            const r = (bigint >> 16) & 255
            const g = (bigint >> 8) & 255
            const b = bigint & 255
            return {r, g, b}
        }

        function rgbToHsl(r, g, b) {
            r /= 255, g /= 255, b /= 255
            const max = Math.max(r, g, b), min = Math.min(r, g, b)
            let h, s, l = (max + min) / 2
            if (max === min) {
                h = s = 0
            } else {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break
                    case g: h = (b - r) / d + 2; break
                    case b: h = (r - g) / d + 4; break
                }
                h /= 6
            }
            return {h, s, l}
        }

        function hslToRgb(h, s, l) {
            let r, g, b
            if (s === 0) {
                r = g = b = l
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1
                    if (t > 1) t -= 1
                    if (t < 1 / 6) return p + (q - p) * 6 * t
                    if (t < 1 / 2) return q
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
                    return p
                }
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s
                const p = 2 * l - q
                r = hue2rgb(p, q, h + 1 / 3)
                g = hue2rgb(p, q, h)
                b = hue2rgb(p, q, h - 1 / 3)
            }
            return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
        }

        function rgbToHex(r, g, b) {
            const toHex = c => {
                const hex = c.toString(16)
                return hex.length === 1 ? "0" + hex : hex
            }
            return \`#\${toHex(r)}\${toHex(g)}\${toHex(b)}\`
        }

        async function getAverageColor(base64) {
            const image = new Image();
            image.src = "data:image/png;base64," + base64;
            await new Promise(r => image.onload = r);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            canvas.width = image.width; canvas.height = image.height;
            ctx.drawImage(image, 0, 0);

            const data = ctx.getImageData(0, 0, image.width, image.height).data;
            let r = 0, g = 0, b = 0;

            for (let i = 0; i < data.length; i += 4) {
                r += data[i]; g += data[i+1]; b += data[i+2];
            }
            const count = data.length / 4;
            r = ~~(r / count); g = ~~(g / count); b = ~~(b / count);

            return \`#\${r.toString(16).padStart(2, "0")}\${g.toString(16).padStart(2, "0")}\${b.toString(16).padStart(2, "0")}\`;
        }

        // --- 启动绘制 ---
        await drawRanking();
      }
    `;
  }

  /**
   * 组装最终的 HTML 页面内容。
   * @param params 包含所有渲染所需数据的对象。
   * @returns 完整的 HTML 字符串。
   */
  function _getChartHtmlContent(params: {
    rankTimeTitle: string;
    rankTitle: string;
    data: RankingData[];
    iconCache: AssetData[];
    barBgImgCache: AssetData[];
    backgroundStyle: string;
    fontFacesCSS: string;
    chartConfig: any;
  }): string {
    const {
      rankTimeTitle,
      rankTitle,
      data,
      iconCache,
      barBgImgCache,
      backgroundStyle,
      fontFacesCSS,
      chartConfig,
    } = params;

    // 准备注入到客户端脚本的数据
    const clientData = {
      rankingData: data,
      iconData: iconCache.map((d) => ({
        userId: d.userId,
        iconBase64: d.base64,
      })),
      barBgImgs: barBgImgCache.map((d) => ({
        userId: d.userId,
        barBgImgBase64: d.base64,
      })),
      config: chartConfig,
    };

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF--8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>排行榜</title>
          <style>${_getChartBaseStyles()}</style>
          <style>${backgroundStyle}</style>
          <style>${fontFacesCSS}</style>
          <style>
            .ranking-title { font-family: "${chartConfig.chartTitleFont
      }", "Microsoft YaHei", sans-serif; }
          </style>
      </head>
      <body>
          <h1 class="ranking-title">${rankTimeTitle}</h1>
          <h1 class="ranking-title">${rankTitle}</h1>
          <div class="font-preload">
            <span style="font-family: '${chartConfig.chartNicknameFont
      }';">预加载</span>
            <span style="font-family: '${chartConfig.chartTitleFont
      }';">预加载</span>
          </div>
          <canvas id="rankingCanvas"></canvas>
          <script>
            // 立即执行的异步函数，用于绘制图表
            (async () => {
              const drawFunction = ${_getClientScript()};
              await drawFunction(${JSON.stringify(clientData)});
            })();
          </script>
      </body>
      </html>
    `;
  }

  /**
   * 生成排行榜图片。
   * 该函数通过组合多个辅助函数来创建 HTML 页面，并使用 Puppeteer 进行截图。
   * @param params 包含标题和数据的对象。
   * @returns 包含图表图片的 Buffer。
   */
  async function generateRankingChart(
    {
      rankTimeTitle,
      rankTitle,
      data,
    }: { rankTimeTitle: string; rankTitle: string; data: RankingData[] },
    {
      iconCache,
      barBgImgCache,
      fontFilesCache,
      emptyHtmlPath,
    }: {
      iconCache: AssetData[];
      barBgImgCache: AssetData[];
      fontFilesCache: string[];
      emptyHtmlPath: string;
    }
  ): Promise<Buffer> {
    if (!ctx.puppeteer) {
      throw new Error("Puppeteer 服务未启用，无法生成图表。");
    }
    const browser = ctx.puppeteer.browser;
    if (!browser) {
      throw new Error("Puppeteer 浏览器实例不可用。");
    }

    const page = await browser.newPage();
    try {
      const fontFaces = generateFontFacesCSS(fontFilesCache);
      const backgroundStyle = await _prepareBackgroundStyle(config);

      const chartConfigForClient = {
        shouldMoveIconToBarEndLeft: config.shouldMoveIconToBarEndLeft,
        horizontalBarBackgroundOpacity: config.horizontalBarBackgroundOpacity,
        horizontalBarBackgroundFullOpacity:
          config.horizontalBarBackgroundFullOpacity,
        isUserMessagePercentageVisible: config.isUserMessagePercentageVisible,
        chartTitleFont: config.chartTitleFont,
        chartNicknameFont: config.chartNicknameFont,
      };

      const htmlContent = _getChartHtmlContent({
        rankTimeTitle,
        rankTitle,
        data,
        iconCache,
        barBgImgCache,
        backgroundStyle,
        fontFacesCSS: fontFaces,
        chartConfig: chartConfigForClient,
      });

      // 加载本地空 HTML 文件作为起点
      const pageUrl = emptyHtmlPath.includes(":")
        ? `file:///${emptyHtmlPath}`
        : `file://${emptyHtmlPath}`;
      await page.goto(pageUrl, { waitUntil: "load" });

      // 调试：将 html 内容保存到文件中
      // const debugHtmlPath = path.join(
      //   ctx.baseDir,
      //   "data",
      //   "messageCounter",
      //   "debug-ranking-chart.html"
      // );
      // await fs.writeFile(debugHtmlPath, htmlContent, "utf-8");
      // logger.info(`排行榜 HTML 已保存到 ${debugHtmlPath}`);

      await page.setContent(h.unescape(htmlContent), {
        waitUntil: config.waitUntil,
      });

      const calculatedWidth = await page.evaluate(() => {
        const canvas = document.getElementById(
          "rankingCanvas"
        ) as HTMLCanvasElement | null;
        const bodyPadding = 40; // 对应 body 的左右 padding (20px + 20px)
        // 如果 canvas 存在，则返回其宽度加上页面的 padding；否则返回一个默认值。
        return canvas ? canvas.width + bodyPadding : 1080;
      });

      await page.setViewport({
        // 使用客户端计算出的宽度，但确保不小于用户在配置中设定的值
        width: Math.max(config.chartViewportWidth, Math.ceil(calculatedWidth)),
        // 高度在这里是次要的，因为 fullPage: true 会自动调整，但设置一个合理的值可以避免潜在问题
        height: 256,
        deviceScaleFactor: config.deviceScaleFactor,
      });

      const imageBuffer = await page.screenshot({
        type: config.imageType,
        fullPage: true,
      });

      return imageBuffer;
    } catch (error) {
      logger.error("生成排行榜图表时发生错误:", error);
      throw error; // 将错误向上抛出，以便调用者可以处理
    } finally {
      await page.close(); // 确保页面总是被关闭
    }
  }

  async function generateTimelineChartImage(params: {
    bucketLabels: string[];
    userLabels: string[];
    barData: number[][];
    lineSeries: { name: string; data: number[][] }[];
    chartType: "bar" | "line";
    rangeLabel: string;
    maxValue: number;
    topLimit: number;
  }): Promise<Buffer> {
    if (!ctx.puppeteer) {
      throw new Error("Puppeteer 服务未启用，无法生成时间分布图。");
    }
    const browser = ctx.puppeteer.browser;
    if (!browser) {
      throw new Error("Puppeteer 浏览器实例不可用。");
    }

    const safeBucketLabels = Array.isArray(params.bucketLabels)
      ? params.bucketLabels
      : [];
    const safeUserLabels = Array.isArray(params.userLabels)
      ? params.userLabels
      : [];
    const safeBarData = Array.isArray(params.barData) ? params.barData : [];
    const safeLineSeries = Array.isArray(params.lineSeries)
      ? params.lineSeries
      : [];
    const safeMaxValue = Number.isFinite(params.maxValue)
      ? params.maxValue
      : 0;

    const bucketCount = safeBucketLabels.length || 1;
    const viewportWidth = Math.min(
      2600,
      Math.max(1200, bucketCount * 90)
    );
    const viewportHeight = Math.min(
      1600,
      Math.max(820, safeUserLabels.length * 40 + 520)
    );

    const page = await browser.newPage();
    try {
      // 启用 WebGL 支持和相关 polyfill
      await page.evaluateOnNewDocument(() => {
        // 模拟 WebGL 上下文
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
          // UNMASKED_VENDOR_WEBGL
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          // UNMASKED_RENDERER_WEBGL
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter.call(this, parameter);
        };

        // 确保 WebGL 上下文可以被创建
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (contextType, contextAttributes) {
          if (contextType === 'webgl' || contextType === 'experimental-webgl') {
            const context = originalGetContext.call(this, contextType, {
              ...contextAttributes,
              failIfMajorPerformanceCaveat: false,
              preserveDrawingBuffer: true,
            });
            if (!context) {
              console.error('Failed to create WebGL context, trying experimental-webgl');
              return originalGetContext.call(this, 'experimental-webgl', {
                ...contextAttributes,
                failIfMajorPerformanceCaveat: false,
                preserveDrawingBuffer: true,
              });
            }
            return context;
          }
          return originalGetContext.call(this, contextType, contextAttributes);
        };
      });

      await page.setViewport({
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: config.deviceScaleFactor || 1,
      });

      const containerWidth = viewportWidth - 32;
      const containerHeight = viewportHeight - 24;

      await page.setContent(
        `<html><head><meta charset="UTF-8" />
          <style>
            body { margin: 0; padding: 12px 16px; background: #f7f7fa; }
            #chart { width: ${containerWidth}px; height: ${containerHeight}px; }
          </style>
        </head><body><div id="chart"></div></body></html>`,
        { waitUntil: "load" }
      );

      const echartsPath = require.resolve("echarts/dist/echarts.min.js");
      const echartsGLPath = require.resolve("echarts-gl/dist/echarts-gl.min.js");
      await page.addScriptTag({ path: echartsPath });
      await page.addScriptTag({ path: echartsGLPath });

      const axisInterval = Math.max(1, Math.floor(safeBucketLabels.length / 8));

      const baseOption = {
        backgroundColor: "#f7f7fa",
        title: [
          {
            text: "群聊发言时间分布 (3D)",
            left: "center",
            top: 6,
            textStyle: { fontSize: 20, fontWeight: "bold", color: "#1f1f1f" },
          },
          {
            text: `${params.rangeLabel} · Top ${params.topLimit} · ${params.chartType === "line" ? "曲线" : "柱状"
              }`,
            left: "center",
            top: 30,
            textStyle: { fontSize: 12, color: "#4a4a4a" },
          },
        ],
        xAxis3D: {
          type: "category",
          name: "时间",
          data: safeBucketLabels,
          axisLabel: { interval: axisInterval, rotate: -35 },
        },
        yAxis3D: {
          type: "category",
          name: "用户",
          data: safeUserLabels,
        },
        zAxis3D: { type: "value", name: "发言数" },
        grid3D: {
          boxWidth: Math.max(120, safeBucketLabels.length * 16),
          boxDepth: Math.max(120, safeUserLabels.length * 26),
          boxHeight: Math.max(80, safeMaxValue * 2),
          light: {
            main: { intensity: 1.2, shadow: true },
            ambient: { intensity: 0.35 },
          },
          viewControl: { alpha: 35, beta: 25, distance: 200 },
          environment: 'none', // 禁用环境贴图,减少 WebGL 依赖
        },
        visualMap: {
          show: false,
          max: Math.max(safeMaxValue, 1),
        },
        legend:
          params.chartType === "line"
            ? { show: true, top: 70, textStyle: { color: "#333" }, data: [] }
            : { show: false, data: [] },
        tooltip: {},
        series: [],
      };

      await page.evaluate(
        ({ option, chartType, barData, lineSeries, bucketLabels, userLabels, maxValue }) => {
          const palette = [
            "#2a9d8f",
            "#e76f51",
            "#577590",
            "#f4a261",
            "#6a4c93",
            "#43aa8b",
            "#f3722c",
            "#4d908e",
            "#f8961e",
            "#277da1",
            "#c44536",
            "#8ac926",
          ];
          const echartsInstance = (window as any).echarts;
          if (!echartsInstance) {
            throw new Error("ECharts library not loaded");
          }
          const chart = echartsInstance.init(
            document.getElementById("chart"),
            undefined,
            { renderer: "canvas" }
          );
          const mergedOption = { ...option };
          const xData = Array.isArray(bucketLabels)
            ? bucketLabels.map((v) => (v ?? "").toString())
            : [];
          const yData = Array.isArray(userLabels)
            ? userLabels.map((v) => (v ?? "").toString())
            : [];

          mergedOption.xAxis3D.data = xData;
          mergedOption.yAxis3D.data = yData;
          mergedOption.visualMap = Object.assign({}, option.visualMap, {
            max: Math.max(maxValue || 0, 1),
          });
          mergedOption.tooltip = {
            formatter: (params) => {
              const value = Array.isArray(params.value)
                ? params.value
                : params.value?.value || [];
              const [xIndex, yIndex, z] = value;
              const timeLabel = xData[xIndex] || xIndex;
              const userLabel = yData[yIndex] || params.seriesName;
              return `${userLabel}<br/>${timeLabel}<br/>发言数：${z}`;
            },
          };
          if (chartType === "bar") {
            mergedOption.series = [
              {
                type: "bar3D",
                shading: "lambert",
                data: (Array.isArray(barData) ? barData : []).map((value) => {
                  const safeValue = Array.isArray(value)
                    ? [0, 1, 2].map((idx) => {
                      const v = value[idx];
                      return typeof v === "number" && Number.isFinite(v)
                        ? v
                        : 0;
                    })
                    : [0, 0, 0];
                  const colorIndex =
                    typeof safeValue[1] === "number" && palette.length
                      ? ((safeValue[1] % palette.length) + palette.length) %
                      palette.length
                      : 0;
                  const color = palette[colorIndex] || "#4d908e";
                  return {
                    value: safeValue,
                    itemStyle: { color },
                  };
                }),
              },
            ];
          } else {
            const safeSeries = Array.isArray(lineSeries) ? lineSeries : [];
            mergedOption.series = safeSeries.map((series, index) => ({
              name: series?.name ?? `用户${index + 1}`,
              type: "line3D",
              data: Array.isArray(series?.data)
                ? series.data.map((row) => {
                  const safeRow = Array.isArray(row)
                    ? row.map((v) =>
                      typeof v === "number" && Number.isFinite(v) ? v : 0
                    )
                    : [0, 0, 0];
                  return safeRow;
                })
                : [],
              lineStyle: { width: 3 },
              itemStyle: { color: palette[index % palette.length] },
              emphasis: { focus: "series" },
            }));
            mergedOption.legend = Object.assign({}, mergedOption.legend, {
              show: true,
              data: yData,
            });
          }

          try {
            chart.setOption(mergedOption);
          } catch (e) {
            throw new Error("ECharts setOption failed: " + (e instanceof Error ? e.message : String(e)));
          }
          (window as any).__timelineChartReady = true;
        },
        {
          option: baseOption,
          chartType: params.chartType,
          barData: safeBarData,
          lineSeries: safeLineSeries,
          bucketLabels: safeBucketLabels,
          userLabels: safeUserLabels,
          maxValue: safeMaxValue,
        }
      );

      await page.waitForFunction("window.__timelineChartReady === true");
      const chartElement = await page.$("#chart");
      const buffer = await chartElement!.screenshot({
        type: config.imageType,
      });
      return buffer;
    } finally {
      await page.close();
    }
  }

  function getUserRankAndRecord(
    getDragons: MessageCounterRecord[],
    userId: string,
    postCountType:
      | "todayPostCount"
      | "thisWeekPostCount"
      | "thisMonthPostCount"
      | "thisYearPostCount"
      | "totalPostCount"
      | "yesterdayPostCount"
  ):
    | {
      acrossRank: number;
      userRecord: UserRecord;
    }
    | undefined {
    if (getDragons.length === 0) {
      return;
    }

    const aggregatedUserRecords = getDragons.reduce<{
      [key: string]: UserRecord;
    }>((acc, user) => {
      if (!acc[user.userId]) {
        acc[user.userId] = {
          userId: user.userId,
          postCountAll: 0,
          username: user.username,
        };
      }

      let postCount = 0;
      switch (postCountType) {
        case "todayPostCount":
          postCount = user.todayPostCount;
          break;
        case "thisWeekPostCount":
          postCount = user.thisWeekPostCount;
          break;
        case "thisMonthPostCount":
          postCount = user.thisMonthPostCount;
          break;
        case "thisYearPostCount":
          postCount = user.thisYearPostCount;
          break;
        case "totalPostCount":
          postCount = user.totalPostCount;
          break;
        case "yesterdayPostCount":
          postCount = user.yesterdayPostCount;
          break;
        default:
          postCount = user.todayPostCount;
          break;
      }

      acc[user.userId].postCountAll += postCount;
      return acc;
    }, {});

    const sortedUserRecords = Object.values(aggregatedUserRecords).sort(
      (a, b) => b.postCountAll - a.postCountAll
    );

    const userIndex = sortedUserRecords.findIndex(
      (user) => user.userId === userId
    );
    const userRecord = sortedUserRecords[userIndex];
    const acrossRank = userIndex + 1;

    return { acrossRank, userRecord };
  }

  function getSortedDragons(
    records: MessageCounterRecord[]
  ): [string, number][] {
    const dragonsMap: { [userId: string]: number } = {};
    for (const dragon of records) {
      const { userId, totalPostCount } = dragon;
      const key = `${userId}`;
      dragonsMap[key] = (dragonsMap[key] || 0) + totalPostCount;
    }

    return Object.entries(dragonsMap).sort((a, b) => b[1] - a[1]);
  }

  async function replaceAtTags(session: any, content: string): Promise<string> {
    const atRegex = /<at id="(\d+)"(?: name="([^"]*)")?\/>/g;

    let match: RegExpExecArray | null;
    while ((match = atRegex.exec(content)) !== null) {
      const userId: string = match[1];
      const name: string | undefined = match[2];

      if (!name) {
        let userName = "未知用户";
        try {
          if (
            typeof session.bot?.getChannelMember === "function" &&
            session.channelId
          ) {
            const channelMember = await session.bot.getChannelMember(
              session.channelId,
              userId
            );
            if (channelMember && channelMember.user && channelMember.user.name) {
              userName = channelMember.user.name;
            }
          }
        } catch (error) {
          logger.error(error);
        }

        const newAtTag = `<at id="${userId}" name="${userName}"/>`;
        content = content.replace(match[0], newAtTag);
      }
    }

    return content;
  }

  async function getChannelName(
    bot: Bot,
    channelId: string
  ): Promise<string | undefined> {
    try {
      const channel = await bot.getChannel(channelId);
      return channel?.name;
    } catch (error) {
      logger.warn(`Failed to get channelId name for ${channelId}:`, error);
      return undefined;
    }
  }

  function parseList(str?: string): string[] {
    if (!str) return [];
    return str.split(/[\s,，、]+/).filter(Boolean);
  }

  function getPeriodFromOptions(options: any, fallback: PeriodKey): PeriodKey {
    if (options?.yesterday || options?.ydag) return "yesterday";
    if (options?.day || options?.dag) return "today";
    if (options?.week || options?.wag) return "week";
    if (options?.month || options?.mag) return "month";
    if (options?.year || options?.yag) return "year";
    if (options?.total || options?.across || options?.dragon) return "total";
    return fallback;
  }

  function isAcrossChannel(options: any): boolean {
    return ["ydag", "dag", "wag", "mag", "yag", "across", "dragon"].some(
      (opt) => options?.[opt]
    );
  }

  function filterRecordsByWhitesAndBlacks(
    records: MessageCounterRecord[],
    key: "userId" | "channelId",
    whites: string[],
    blacks: string[]
  ): MessageCounterRecord[] {
    let result = records;
    if (whites.length > 0) {
      result = result.filter((r) => whites.includes(r[key]));
    }
    if (blacks.length > 0) {
      result = result.filter((r) => !blacks.includes(r[key]));
    }
    return result;
  }

  function prepareRankingData(
    sortedUsers: [string, number][],
    userInfo: Dict<{ username: string; avatar: string }>,
    totalCount: number,
    limit: number,
    requesterId?: string
  ): RankingData[] {
    const topUsers = sortedUsers.slice(0, limit);
    const isRequesterInTop =
      requesterId && topUsers.some(([userId]) => userId === requesterId);

    // 如果指令发送者不在榜单上，则找到他的数据并直接追加到末尾
    if (requesterId && !isRequesterInTop) {
      const requesterData = sortedUsers.find(
        ([userId]) => userId === requesterId
      );
      if (requesterData) {
        topUsers.push(requesterData);
      }
    }

    return topUsers.map(([userId, count]) => ({
      // 增加★高亮指令发送者
      name: (userId === requesterId ? "★" : "") + userInfo[userId].username,
      userId: userId,
      avatar: userInfo[userId].avatar,
      count,
      percentage: calculatePercentage(count, totalCount),
    }));
  }

  function calculatePercentage(number: number, total: number): number {
    if (total === 0) return 0;
    return (number / total) * 100;
  }

  function getCurrentBeijingTime(): string {
    return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  }

  async function renderLeaderboard({
    rankTimeTitle,
    rankTitle,
    rankingData,
  }: {
    rankTimeTitle: string;
    rankTitle: string;
    rankingData: RankingData[];
  }): Promise<string | h> {
    // 渲染为水平柱状图
    if (config.isLeaderboardToHorizontalBarChartConversionEnabled) {
      if (!ctx.puppeteer) {
        logger.warn("Puppeteer service is not enabled. Falling back to text.");
      } else {
        try {
          const chartReadyData = rankingData.map((item) => {
            const newItem = { ...item };
            if (!config.showStarInChart && newItem.name.startsWith("★")) {
              newItem.name = newItem.name.substring(1);
            }
            return newItem;
          });

          // 调用新的、带持久化缓存的函数来获取头像
          // 旧的逻辑是直接在这里操作内存缓存，现在封装到 getAvatarAsBase64 中
          await Promise.all(
            chartReadyData.map(async (item) => {
              item.avatarBase64 = await getAvatarAsBase64(item.avatar);
            })
          );

          const imageBuffer = await generateRankingChart(
            { rankTimeTitle, rankTitle, data: chartReadyData },
            { iconCache, barBgImgCache, fontFilesCache, emptyHtmlPath }
          );
          return h.image(imageBuffer, `image/${config.imageType}`);
        } catch (error) {
          logger.error("Failed to generate leaderboard chart:", error);
        }
      }
    }

    // 渲染为 Markdown 图片
    if (config.isTextToImageConversionEnabled) {
      if (!ctx.markdownToImage) {
        logger.warn(
          "markdownToImage service is not enabled. Falling back to text."
        );
      } else {
        const markdown = formatLeaderboardAsMarkdown(
          rankTimeTitle,
          rankTitle,
          rankingData,
          config.isUserMessagePercentageVisible
        );
        const imageBuffer = await ctx.markdownToImage.convertToImage(markdown);
        return h.image(imageBuffer, `image/${config.imageType}`);
      }
    }

    // 默认渲染为纯文本
    return formatLeaderboardAsText(
      rankTimeTitle,
      rankTitle,
      rankingData,
      config.isUserMessagePercentageVisible
    );
  }

  function formatLeaderboardAsMarkdown(
    title: string,
    subtitle: string,
    data: RankingData[],
    showPercentage: boolean
  ): string {
    let result = `# ${title}\n## ${subtitle}\n\n`;
    data.forEach((item, index) => {
      const percentageStr = showPercentage
        ? ` (${Math.round(item.percentage)}%)`
        : "";
      result += `${index + 1}. **${item.name}**: ${item.count
        } 次${percentageStr}\n`;
    });
    return result;
  }

  function formatLeaderboardAsText(
    title: string,
    subtitle: string,
    data: RankingData[],
    showPercentage: boolean
  ): string {
    let result = `${title}\n${subtitle}\n\n`;
    data.forEach((item, index) => {
      const percentageStr = showPercentage
        ? ` (${Math.round(item.percentage)}%)`
        : "";
      result += `${index + 1}. ${item.name}：${item.count
        } 次${percentageStr}\n`;
    });
    return result.trim();
  }
}
