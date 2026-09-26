import { clientColorScript, LEGACY_CHART_SIZE } from './m3'
import { createClearAction } from './clear'
import { usePresentation } from './ux'
import { Context, h, Logger, Schema, sleep, Bot, Dict, $ } from "koishi";
import {
  baseline,
  components,
  EMPHASIZED_WEIGHT,
  FONT_STACK,
  lch,
  scheme,
  SHAPE,
} from "./m3";
import {} from "koishi-plugin-cron";
import {} from "koishi-plugin-puppeteer";
import path from "path";
import { pathToFileURL } from "url";
import {} from "@koishijs/canvas";
import * as fs from "fs/promises";
import { constants as fsConstants } from "fs";
import * as crypto from "crypto";
import {
  lookup,
  rankChannels,
  rankUsers,
  statOf,
  summarize,
  type Summary,
} from "./ranking";

const assetsDir = path.resolve(__dirname, "..", "assets");
let fallbackBase64: string[] = [""];

export const name = "message-counter";
export const inject = {
  required: ["database", "cron"],
  optional: ["puppeteer", "canvas"],
};

export const usage = `## 使用

发送 \`msgcount.排行榜\` 查看本频道的发言排行，\`msgcount.查询\` 看某个人的发言次数与排名。

## 指令

| 指令 | 说明 |
| --- | --- |
| \`msgcount\` | 帮助 |
| \`msgcount.查询 [用户]\` | 发言次数与排名 |
| \`msgcount.排行榜 [人数]\` | 本频道发言排行 |
| \`msgcount.频道排行榜 [人数]\` | 各频道发言排行 |
| \`msgcount.上传柱状条背景\` | 上传个人柱状条底图 |
| \`msgcount.重载资源\` | 重载图标与字体，权限 2 |
| \`msgcount.清理缓存\` | 清理头像缓存，权限 3 |
| \`msgcount.清空记录\` | 清空全部发言记录，权限 3 |

时段选项：\`-d\` 今日、\`--yd\` 昨日、\`-w\` 本周、\`-m\` 本月、\`-y\` 今年、\`-t\` 总计。关闭「统计昨日发言」后，\`--yd\` 与「抓龙王」不可用。

资源目录为 \`data/messageCounter/\` 下的 \`icons\`、\`barBgImgs\` 与 \`fonts\`。`;

const logger = new Logger("messageCounter");

// --- 定义字体选项常量 ---
const FONT_OPTIONS = {
  // acumen 的 stats 图表原先的字体（线上现在配的是 MiSans，但不能假定装了它）。
  // 系统里没有时，行内字体栈会退回到随包带的 HarmonyOS_Sans_Medium。
  TITLE: "Noto Sans CJK SC",
  NICKNAME: "Noto Sans CJK SC",
};

/**
 * acumen 的字号换算成 CSS 字号的系数。
 *
 * acumen 用 plotters + ab_glyph 画字，那边写的「字号」是 ab_glyph 的 PxScale——
 * 字体上伸部到下伸部的总高，不是 CSS 的 em。线上那支 MiSans Medium 每 em 1000
 * 单位，上伸 1044、下伸 282，所以那边写 30，画出来的 em 只有 30 × 1000 / 1326
 * ≈ 22.6px。从前这里把 acumen 的数照抄成 CSS px，整张图的字都大了三成多。
 * 版式里的字号仍按 acumen 的数写，出图时统一乘上它（再乘配置里的倍率）。
 */
const ACUMEN_EM = 1000 / (1044 + 282);

/**
 * 图表的纸色与墨色，取自 acumen 的 `ColorScheme::default`（scheme-manual）。
 *
 * acumen 的发言榜与本插件的排行榜会在同一个群里并排出现，纸色、墨色与每行的
 * 条色都按同一套来，两边的图才谈得上一致。下面这五个值与 acumen 的
 * `chart/utils.rs`、`chart/renderer.rs` 一一对应，改一处要两边一起改。
 */
const SCHEME = scheme(268);
const PAPER = SCHEME.surface; // surface，页面底色
const INK = SCHEME.onSurface; // on-surface，标题
const INK_SOFT = SCHEME.onSurfaceVariant; // on-surface-variant，元信息行
/** on-surface-faint 在暖白纸上差一线（4.44∶1），这是它过 4.5∶1 之后的值，
 *  即 acumen 的 `ColorScheme::readable_faint()`：名次这类参照数字的墨色。 */
const INK_FAINT = SCHEME.onSurfaceVariant;
/** 刻度竖线：8% 的黑，压在轨道或实色条上都读得出来，与 acumen 的构图线同一档。 */
const HAIRLINE = "rgba(0, 0, 0, 0.08)";
/** 头像底下那圈发丝细的边。acumen 用的是不透明的 outline-variant，
 *  垫在头像下面收住浅色头像的圆边；它压在纸上，不是一个半透明遮罩。 */
const GRID_LINE = SCHEME.outlineVariant;
/** 前三名的名次色：金、银、铜。含义在颜色本身，不跟主题也不跟头像走。 */
const MEDALS = [SCHEME.primary, SCHEME.secondary, SCHEME.tertiary];
/** 取不到头像时的兜底色，即 acumen 的 FALLBACK_THEME（主色）。 */
const FALLBACK_THEME = SCHEME.primary;

/**
 * 用户可选的背景方案仍按本插件的主色相推：那是配置项，与图表的默认纸色无关。
 */
const HUE = 268;


export interface Config {
  // --- 核心功能 ---
  /** 是否统计 Bot 自己发送的消息。 */
  isBotMessageTrackingEnabled: boolean;
  /** 是否启用跨机器人消息去重（同一群多个机器人时防止重复计数）。 */
  enableCrossBotDeduplication: boolean;
  /** 是否统计昨日发言。 */
  enableYesterdayRanking: boolean;

  // --- 排行榜设置 ---
  /** 排行榜默认显示的人数。 */
  defaultMaxDisplayCount: number;
  /** 是否在显示排行榜时补充时间信息。 */
  isTimeInfoSupplementEnabled: boolean;
  /** 是否在排行榜中显示用户消息占比。 */
  isUserMessagePercentageVisible: boolean;
  /** 在排行榜中全局隐藏的用户 ID 列表。 */
  hiddenUserIdsInLeaderboard: string[];
  /** 在频道排行榜中全局隐藏的频道 ID 列表。 */
  hiddenChannelIdsInLeaderboard: string[];

  // --- 图片生成 ---
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
  /** 排行榜中头像的形状。 */
  avatarShape: "circle" | "rounded" | "square";
  /** 刻度竖线是否压在柱状条之上。默认压在条上，关闭则由柱状条盖住刻度。 */
  gridLinesOverBars: boolean;
  /**
   * 排行榜的发言次数与占比写在哪儿。
   * 默认紧跟在自己那根条的尾巴后面；关闭则右对齐成固定的两列。
   */
  valueFollowsBar: boolean;
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
  /** 渐变背景的配色预设。 */
  gradientPreset: string;
  /** 自定义渐变的起始颜色。 */
  gradientStartColor: string;
  /** 自定义渐变的结束颜色。 */
  gradientEndColor: string;
  /** 自定义渐变的角度（度）。 */
  gradientAngle: number;
  /** 纯色背景的颜色。 */
  solidColor: string;
  /** 图片背景的地址（网络链接或本地文件路径）。 */
  backgroundImageSource: string;
  /** 图片背景的填充方式。 */
  backgroundImageFit: "cover" | "contain" | "stretch" | "repeat";
  /** 图片背景的模糊半径（像素）。 */
  backgroundBlur: number;
  /** 图片背景上的白色蒙版不透明度，用于提升文字可读性。 */
  backgroundMaskOpacity: number;
  /** API 背景配置。 */
  apiBackgroundConfig: apiBackgroundConfig;
  /** 自定义背景的 CSS 代码。 */
  backgroundValue: string;

  // --- 字体设置 ---
  /** 水平柱状图 - 标题的字体。 */
  chartTitleFont: string;
  /** 水平柱状图 - 成员昵称和发言次数的字体。 */
  chartNicknameFont: string;
  /** 水平柱状图 - 字号倍率，1 即与 acumen 的 stats 图表同大。 */
  chartFontScale: number;

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
      .description("统计 Bot 自己发送的消息。"),
    enableCrossBotDeduplication: Schema.boolean()
      .default(true)
      .description(
        "跨机器人消息去重。同一个群里接入多个机器人账号时，开启可避免同一条消息被重复计数。",
      ),
    enableYesterdayRanking: Schema.boolean()
      .default(true)
      .description(
        "统计昨日发言。零点重置时要把今日数据结转到昨日，长期运行、记录极多的实例可以关掉它来缩短零点的处理时间。关闭后 `--yd` 昨日榜、跨频道昨日榜与「抓龙王」都不可用，相关选项会从指令里隐藏；重新开启后，要等到下一个零点才重新有昨日数据。",
      ),
  }).description("核心功能"),

  // --- 排行榜设置 ---
  Schema.object({
    defaultMaxDisplayCount: Schema.number()
      .min(0)
      .default(20)
      .description("排行榜默认显示的人数，0 表示全部显示。"),
    isTimeInfoSupplementEnabled: Schema.boolean()
      .default(true)
      .description("在排行榜标题里显示生成时间。"),
    isUserMessagePercentageVisible: Schema.boolean()
      .default(true)
      .description("在排行榜里显示各人的消息数占比。"),
    hiddenUserIdsInLeaderboard: Schema.array(String)
      .role("table")
      .description("全局隐藏的用户 ID 列表，在所有用户排行榜中生效。"),
    hiddenChannelIdsInLeaderboard: Schema.array(String)
      .role("table")
      .description("全局隐藏的频道 ID 列表，在频道排行榜中生效。"),
  }).description("排行榜设置"),

  // --- 图片生成 ---
  Schema.intersect([
    Schema.object({
      isLeaderboardToHorizontalBarChartConversionEnabled: Schema.boolean()
        .default(false)
        .description("把排行榜渲染成水平柱状图，需要 `puppeteer` 服务。"),
    }).description("图片生成"),

    // 仅在开启柱状图功能时显示以下详细选项
    Schema.union([
      Schema.intersect([
        Schema.object({
          isLeaderboardToHorizontalBarChartConversionEnabled:
            Schema.const(true).required(),
          imageType: Schema.union(["png", "jpeg", "webp"])
            .default("png")
            .description(`柱状图的图片格式。`),
        }).description("柱状图基础设置"),

        Schema.object({
          chartViewportWidth: Schema.number()
            .min(1)
            .default(1080)
            .description(
              "渲染页面的视口宽度（像素）。此值会影响图片清晰度及背景图的展示。",
            ),
          deviceScaleFactor: Schema.number()
            .min(0.1)
            .max(4)
            .step(0.1)
            .default(1)
            .description(
              "设备像素比 (DPR)。更高的值可生成更清晰的图片（如 2 倍图），但会增加文件体积。",
            ),
          waitUntil: Schema.union([
            "load",
            "domcontentloaded",
            "networkidle0",
            "networkidle2",
          ])
            .default("load")
            .description(
              "页面加载等待策略，影响图片生成速度和稳定性。`load` 在速度与稳定性之间较为均衡。",
            ),
        }).description("渲染与性能"),

        Schema.object({
          avatarCacheTTL: Schema.number()
            .default(86400) // 24 hours
            .description(
              "头像缓存有效期（秒）。设置为 0 则永不刷新。过短的有效期会增加网络请求。",
            ),
          avatarFailureCacheTTL: Schema.number()
            .default(300) // 5 minutes
            .description(
              "头像获取失败后的重试间隔（秒）。期间将使用默认头像，避免频繁请求无效链接。",
            ),
        }).description("缓存设置"),

        Schema.object({
          shouldMoveIconToBarEndLeft: Schema.boolean()
            .default(true)
            .description(
              "把自定义图标放在进度条末端。关闭则显示在用户名旁。",
            ),
          showStarInChart: Schema.boolean()
            .default(true)
            .description(
              "在图表里给触发指令的用户或群聊名称前加 ★ 高亮。",
            ),
          avatarShape: Schema.union([
            Schema.const("circle").description("圆形（推荐）"),
            Schema.const("rounded").description("圆角方形"),
            Schema.const("square").description("方形"),
          ])
            .default("circle")
            .description("排行榜中头像的形状。"),
          gridLinesOverBars: Schema.boolean()
            .default(true)
            .description(
              "刻度竖线是否压在柱状条之上。开启（默认）则刻度贯穿整行；关闭则由柱状条盖住刻度，每根条是完整的一块颜色。两种都只差遮挡关系，文字始终在最上层。",
            ),
          valueFollowsBar: Schema.boolean()
            .default(true)
            .description(
              "发言次数与占比是否紧跟在自己那根条的尾巴后面。开启（默认）时眼睛被条的颜色牵到条尾，答案就在那里；代价是二十个数字排成一串阶梯。关闭则右对齐成固定的两列，上下扫一眼就能比大小，但读完条还得横着扫到画面最右边再回头认这是哪一行。",
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
            .description("允许上传的背景图最大宽度（像素）。0 为不限制。"),
          maxBarBgHeight: Schema.number()
            .min(0)
            .default(50)
            .description("允许上传的背景图最大高度（像素）。0 为不限制。"),
          maxBarBgSize: Schema.number()
            .min(0)
            .default(5)
            .description("允许上传的背景图最大体积（MB）。0 为不限制。"),
        }).description("上传限制"),

        // 背景设置（条件化）
        Schema.intersect([
          Schema.object({
            backgroundType: Schema.union([
              Schema.const("none").description("默认背景 —— 暖白纸"),
              Schema.const("gradient").description("渐变色 —— 内置配色或自选双色"),
              Schema.const("solid").description("纯色 —— 只用一种颜色"),
              Schema.const("image").description("图片 —— 网络链接或本地图片"),
              Schema.const("api").description("随机图 —— 由 API 每次返回一张"),
              Schema.const("css").description("自定义 CSS —— 高级玩法"),
            ])
              .default("none")
              .description(
                "排行榜图片的整体背景。默认背景最省心；想换风格建议先试「渐变色」里的内置配色。",
              ),
          }),
          Schema.union([
            Schema.object({
              backgroundType: Schema.const("gradient").required(),
              gradientPreset: Schema.union([
                Schema.const("paper").description("暖白纸 —— 与默认背景同款"),
              Schema.const("cloud").description("云白 —— 淡雅灰白"),
                Schema.const("sunrise").description("晨曦 —— 暖橙"),
                Schema.const("ocean").description("海洋 —— 清透蓝"),
                Schema.const("sakura").description("樱花 —— 粉紫"),
                Schema.const("mint").description("薄荷 —— 清新绿"),
                Schema.const("cream").description("奶油 —— 米白"),
                Schema.const("custom").description("自定义 —— 用下面的两种颜色"),
              ])
                .default("cloud")
                .description("内置配色。选「自定义」后才会使用下面填的颜色。"),
              /* 自定义渐变的两个默认端点取设计系统的表面色，
                 与未配置时那条内置渐变（surfaceBright -> surfaceContainer）同源。 */
              gradientStartColor: Schema.string()
                .role("color")
                .default(SCHEME.surfaceBright)
                .description("自定义渐变的起始颜色。"),
              gradientEndColor: Schema.string()
                .role("color")
                .default(SCHEME.surfaceContainer)
                .description("自定义渐变的结束颜色。"),
              gradientAngle: Schema.number()
                .min(0)
                .max(360)
                .step(15)
                .default(135)
                .description(
                  "渐变方向（角度）。0 = 自下而上，90 = 自左向右，135 = 左上到右下。",
                ),
            }),
            Schema.object({
              backgroundType: Schema.const("solid").required(),
              solidColor: Schema.string()
                .role("color")
                .default(SCHEME.surfaceContainerLow)
                .description("背景颜色。建议选浅色，否则文字会看不清。"),
            }),
            Schema.object({
              backgroundType: Schema.const("image").required(),
              backgroundImageSource: Schema.string()
                .default("")
                .description(
                  "图片地址：可填网络链接（http/https），也可填本地图片路径（相对路径基于 Koishi 根目录，如 `data/messageCounter/bg.png`）。留空则回退为默认背景。",
                ),
              backgroundImageFit: Schema.union([
                Schema.const("cover").description("铺满（裁掉多余部分，推荐）"),
                Schema.const("contain").description("完整显示（可能留白边）"),
                Schema.const("stretch").description("拉伸填满（可能变形）"),
                Schema.const("repeat").description("平铺（适合小图案）"),
              ])
                .default("cover")
                .description("图片的填充方式。"),
              backgroundBlur: Schema.number()
                .min(0)
                .max(40)
                .step(1)
                .default(0)
                .description("背景模糊程度（像素）。图片太花时调大一点更好看。"),
              backgroundMaskOpacity: Schema.number()
                .min(0)
                .max(1)
                .step(0.05)
                .default(0.15)
                .description(
                  "背景上叠加的白色蒙版浓度。数值越大背景越淡、文字越清楚。",
                ),
            }),
            Schema.object({
              backgroundType: Schema.const("api").required(),
              apiBackgroundConfig: Schema.object({
                apiUrl: Schema.string()
                  .description("获取背景图的 API 地址。")
                  .required(),
                apiKey: Schema.string()
                  .role("secret")
                  .description("API 的访问凭证（可选）。"),
                responseType: Schema.union([
                  Schema.const("binary").description("直接返回图片文件"),
                  Schema.const("url").description("返回图片链接"),
                  Schema.const("base64").description("返回 Base64 字符串"),
                ])
                  .default("binary")
                  .description("API 返回的数据类型。不确定就先用「直接返回图片文件」。"),
              }).description("API 背景配置"),
              backgroundImageFit: Schema.union([
                Schema.const("cover").description("铺满（裁掉多余部分，推荐）"),
                Schema.const("contain").description("完整显示（可能留白边）"),
                Schema.const("stretch").description("拉伸填满（可能变形）"),
                Schema.const("repeat").description("平铺（适合小图案）"),
              ])
                .default("cover")
                .description("图片的填充方式。"),
              backgroundBlur: Schema.number()
                .min(0)
                .max(40)
                .step(1)
                .default(0)
                .description("背景模糊程度（像素）。图片太花时调大一点更好看。"),
              backgroundMaskOpacity: Schema.number()
                .min(0)
                .max(1)
                .step(0.05)
                .default(0.15)
                .description(
                  "背景上叠加的白色蒙版浓度。数值越大背景越淡、文字越清楚。",
                ),
            }),
            Schema.object({
              backgroundType: Schema.const("css").required(),
              backgroundValue: Schema.string()
                .role("textarea", { rows: [2, 4] })
                .default(
                  `html {\n  background: linear-gradient(135deg, ${SCHEME.surfaceBright} 0%, ${SCHEME.surfaceContainer} 100%);\n}`,
                )
                .description(
                  "自定义背景的 CSS 代码。建议使用 `html` 选择器来设置背景。",
                ),
            }),
            Schema.object({}),
          ]),
        ]).description("背景设置"),

        Schema.object({
          chartTitleFont: Schema.string()
            .default(FONT_OPTIONS.TITLE)
            .description(
              `标题字体。填写 'data/messageCounter/fonts' 目录中的字体文件名（不含后缀）。`,
            ),
          chartNicknameFont: Schema.string()
            .default(FONT_OPTIONS.NICKNAME)
            .description(
              `昵称与计数字体。填写 'data/messageCounter/fonts' 目录中的字体文件名（不含后缀），或使用通用字体名称。`,
            ),
          chartFontScale: Schema.number()
            .min(0.6)
            .max(1.6)
            .step(0.05)
            .default(1)
            .description(
              "字号倍率。1 即与 acumen 的发言榜同大；标题、元信息、名次、昵称与读数一起缩放，行高、条长不变。",
            ),
        }).description("字体设置"),
      ]),
      Schema.object({}),
    ]),
  ]),

  // --- 自动推送 ---
  Schema.intersect([
    Schema.object({
      autoPush: Schema.boolean()
        .default(false)
        .description("按时自动推送排行榜。"),
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
              "其他定时发送今日排行榜的时间点（24小时制，如 `08:00`）。",
            ),
        }).description("推送时机"),

        Schema.object({
          pushChannelIds: Schema.array(String)
            .role("table")
            .description("需要接收自动推送的频道 ID 列表。"),
          shouldSendLeaderboardNotificationsToAllChannels: Schema.boolean()
            .default(false)
            .description(
              "向机器人所在的全部群聊推送。打扰面较大，开启前先想清楚。",
            ),
          excludedLeaderboardChannels: Schema.array(String)
            .role("table")
            .description(
              "「向所有群聊推送」开启时，这里指定的频道不会收到推送。",
            ),
        }).description("推送目标"),

        Schema.object({
          isGeneratingRankingListPromptVisible: Schema.boolean()
            .default(true)
            .description("发送排行榜前，先发一条「正在生成」的提示。"),
          leaderboardGenerationWaitTime: Schema.number()
            .min(0)
            .default(3)
            .description("发送提示消息后，等待多少秒再发送排行榜图片。"),
          delayBetweenGroupPushesInSeconds: Schema.number()
            .min(0)
            .default(5)
            .description(
              "批量推送时，每个群之间的基础发送延迟（秒），以防风控。",
            ),
          groupPushDelayRandomizationSeconds: Schema.number()
            .min(0)
            .default(10)
            .description(
              "在基础延迟之上，增加一个随机波动范围（秒），以模拟人工操作。",
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
        .description("每日 0 点自动禁言昨日发言最多的人，即「抓龙王」。"),
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
          .description("在哪些频道执行「抓龙王」。"),
      }),
      Schema.object({}),
    ]),
  ]),
]) as Schema<Config>;

declare module "koishi" {
  interface Tables {
    message_counter_records: MessageCounterRecord;
    message_counter_state: MessageCounterState;
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

/**
 * 清洗待入库的文本（如用户名、频道名），移除可能破坏数据库驱动的非法字符。
 *
 * 某些平台昵称中可能混入空字节、控制字符或不成对的代理字符（乱码 / 富文本），
 * 这些非法内容会导致 PostgreSQL 等数据库驱动报 "invalid message format" 错误。
 * 此函数会：
 *  - 移除空字节（NUL）与 C0/C1 控制字符；
 *  - 移除不成对的 UTF-16 代理字符（保留正常的 emoji 等成对代理）；
 *  - 去除首尾空白。
 *
 * @param text 原始文本
 * @returns 清洗后的安全文本
 */
function sanitizeText(text: string | undefined | null): string {
  if (typeof text !== "string") return text ?? "";
  return (
    text
      // 移除空字节及 C0/C1 控制字符（换行、制表符等一并清除，避免破坏消息格式）
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      // 移除高位代理但后面没有跟随低位代理的情况
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
      // 移除低位代理但前面没有高位代理的情况
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
      .trim()
  );
}

const periodMapping: Record<PeriodKey, { field: CountField; name: string }> = {
  today: { field: "todayPostCount", name: "今日" },
  yesterday: { field: "yesterdayPostCount", name: "昨日" },
  week: { field: "thisWeekPostCount", name: "本周" },
  month: { field: "thisMonthPostCount", name: "本月" },
  year: { field: "thisYearPostCount", name: "今年" },
  total: { field: "totalPostCount", name: "总" },
};

export async function apply(ctx: Context, config: Config) {
  const presentation = usePresentation(ctx, 'msgcount')
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
    logger.debug(`已创建空的渲染模板文件: emptyHtml.html`);
  }

  // 加载内置回退头像 base64
  try {
    const fallbackJson = await fs.readFile(
      path.join(assetsDir, "fallbackBase64.json"),
      "utf-8",
    );
    fallbackBase64 = JSON.parse(fallbackJson);
  } catch (error) {
    logger.warn("无法加载 fallbackBase64.json，将使用空的回退头像。", error);
  }

  // 拷贝内置字体
  const fontFiles = ["HarmonyOS_Sans_Medium.ttf"];
  for (const fontFile of fontFiles) {
    await copyAssetIfNotExists(
      path.join(assetsDir, "fonts"),
      fontsPath,
      fontFile,
    );
  }

  // 缓存
  const avatarCache = new Map<string, AvatarCacheEntry>();
  let iconCache: AssetData[] = [];
  let barBgImgCache: AssetData[] = [];
  let fontFilesCache: string[] = []; // 字体文件缓存

  // 同类问题只在首次出现时 warn，之后降级为 debug。
  // 渲染、消息事件都是高频路径，重复提示同一件事只会淹没真正有用的日志。
  const warnedOnceKeys = new Set<string>();
  function warnOnce(key: string, message: any, ...args: any[]) {
    if (warnedOnceKeys.has(key)) {
      logger.debug(message, ...args);
      return;
    }
    warnedOnceKeys.add(key);
    logger.warn(message, ...args);
  }

  // 跨机器人消息去重缓存：dedupKey -> 过期时间戳（毫秒）
  // 同一群接入多个机器人时，同一条消息会被每个机器人各触发一次中间件，
  // 通过缓存消息唯一标识在短时间窗口内去重，避免重复计数。
  const processedMessages = new Map<string, number>();
  const MESSAGE_DEDUP_TTL = 60 * 1000; // 去重记录的有效期（60 秒）

  // Minato 的函数式 upsert 会先读取旧行再写入；同一用户的并发消息可能同时
  // 判断为“尚无记录”，最终撞上复合主键。按计数主键串行化写入，既保留
  // 表达式增量更新，也不会阻塞其他用户或频道。
  const counterUpdateQueues = new Map<string, Promise<void>>();
  async function serializeCounterUpdate(key: string, update: () => Promise<void>) {
    const previous = counterUpdateQueues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(update);
    counterUpdateQueues.set(key, current);
    try {
      await current;
    } finally {
      if (counterUpdateQueues.get(key) === current) {
        counterUpdateQueues.delete(key);
      }
    }
  }

  // 定期清理过期的去重记录，防止内存无限增长（ctx.setInterval 会在插件卸载时自动清理）
  ctx.setInterval(() => {
    const now = Date.now();
    for (const [key, expiry] of processedMessages) {
      if (expiry <= now) processedMessages.delete(key);
    }
  }, MESSAGE_DEDUP_TTL);

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
    },
  );

  ctx.model.extend(
    "message_counter_state",
    {
      key: "string",
      value: "timestamp",
    },
    { primary: "key" },
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
        if (config.enableYesterdayRanking) {
          const task = ctx.cron("1 0 * * *", () =>
            generateAndPushLeaderboard("yesterday"),
          );
          scheduledTasks.push(task);
          logger.debug("[自动推送] 已设置每日 00:01 推送昨日排行榜的任务。");
        } else {
          logger.warn(
            "[自动推送] 昨日发言统计已关闭，每日 00:01 的昨日排行榜推送不会执行。",
          );
        }
      }
      (config.dailyScheduledTimers || []).forEach((time) => {
        const match = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/.exec(time);
        if (match) {
          const [_, hour, minute] = match;
          const cron = `${minute} ${hour} * * *`;
          const task = ctx.cron(cron, () =>
            generateAndPushLeaderboard("today"),
          );
          scheduledTasks.push(task);
          logger.debug(`[自动推送] 已设置每日 ${time} 推送今日排行榜的任务。`);
        } else {
          logger.warn(
            `[自动推送] 时间格式 "${time}" 无法解析，已跳过。格式应为 "HH:mm"。`,
          );
        }
      });
    }

    // 2. 抓龙王（禁言）的定时任务
    if (config.enableMostActiveUserMuting) {
      if (config.enableYesterdayRanking) {
        const task = ctx.cron("1 0 * * *", () => performDragonKingMuting());
        scheduledTasks.push(task);
        logger.debug("[抓龙王] 已设置每日 00:01 执行的禁言任务。");
      } else {
        // 抓龙王依据的就是昨日发言数，统计关闭后只会读到不再更新的陈旧数据，
        // 必须一并停用，否则会每天禁言同一个人。
        logger.warn(
          "[抓龙王] 昨日发言统计已关闭，禁言任务不会执行。如需使用请重新开启昨日发言统计。",
        );
      }
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
      // 当天到期的重置合并到同一个事务里，整批只提交一次。

      const jobs: ResetJob[] = [
        // 每日重置 (总是执行), 它会顺带把 today 结转到 yesterday
        {
          period: "daily",
          field: "todayPostCount",
          message: "今日发言榜已置空",
        },
      ];

      // 每周重置 (在周一 00:00 执行)
      if (dayOfWeek === 1) {
        jobs.push({
          period: "weekly",
          field: "thisWeekPostCount",
          message: "本周发言榜已置空",
        });
      }

      // 每月重置 (在每月1号 00:00 执行)
      if (dayOfMonth === 1) {
        jobs.push({
          period: "monthly",
          field: "thisMonthPostCount",
          message: "本月发言榜已置空",
        });
      }

      // 每年重置 (在1月1号 00:00 执行)
      if (dayOfMonth === 1 && month === 0) {
        jobs.push({
          period: "yearly",
          field: "thisYearPostCount",
          message: "今年发言榜已置空",
        });
      }

      await runResets(jobs);
    });

    // 将这一个统一的任务添加到待清理列表
    scheduledTasks.push(resetTask);
    logger.debug("已设置统一的推送与数据重置任务（每日、周、月、年）。");
  });

  // --- 资源清理 ---
  ctx.on("dispose", () => {
    // 调用 disposer 函数来取消定时任务
    scheduledTasks.forEach((task) => task());
    avatarCache.clear();
    counterUpdateQueues.clear();
    iconCache = [];
    barBgImgCache = [];
    fontFilesCache = [];
    warnedOnceKeys.clear();
    logger.debug("所有已安排的任务和缓存都已清除。");
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

    // 跨机器人去重：同一群接入多个机器人时，同一条消息会被每个机器人各触发一次。
    // 以「平台:频道:消息ID」为唯一键，在短时间窗口内只统计一次，避免重复计数。
    if (config.enableCrossBotDeduplication && session.messageId) {
      const dedupKey = `${session.platform}:${channelId}:${session.messageId}`;
      if (processedMessages.has(dedupKey)) {
        return next();
      }
      processedMessages.set(dedupKey, Date.now() + MESSAGE_DEDUP_TTL);
    }

    let sessionChannelName = session.event.channel.name;
    const username = sanitizeText(author?.nick || author?.name) || userId;
    const userAvatar = author?.avatar;

    try {
      const channelName = sanitizeText(
        sessionChannelName ||
          (channelId ? await getChannelName(session.bot, channelId) : channelId),
      );

      await serializeCounterUpdate(`${channelId}\n${userId}`, async () => {
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
          ["channelId", "userId"],
        );
      });
    } catch (error) {
      logger.error(
        "Failed to update message count for user %s in channel %s:",
        userId,
        channelId,
        error,
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
        warnOnce(
          `bot-user-undefined:${bot.platform}`,
          "Bot user is undefined, skipping bot message tracking.",
        );
        return;
      }

      try {
        const channelName = sanitizeText(
          sessionChannelName ||
            (await getChannelName(bot, channelId)) ||
            channelId,
        );

        await serializeCounterUpdate(`${channelId}\n${botUser.id}`, async () => {
          await ctx.database.upsert(
            "message_counter_records",
            (row) => [
              {
                channelId,
                userId: botUser.id,

                username: sanitizeText(botUser.name) || botUser.id,
                userAvatar: botUser.avatar,
                channelName: channelName || row.channelName,

                todayPostCount: $.add(row.todayPostCount, 1),
                thisWeekPostCount: $.add(row.thisWeekPostCount, 1),
                thisMonthPostCount: $.add(row.thisMonthPostCount, 1),
                thisYearPostCount: $.add(row.thisYearPostCount, 1),
                totalPostCount: $.add(row.totalPostCount, 1),
              },
            ],
            ["channelId", "userId"],
          );
        });
      } catch (error) {
        logger.error(
          "Failed to update bot message count in channel %s:",
          channelId,
          error,
        );
      }
    });
  }

  // --- 指令定义 ---
  // zl*
  ctx
    .command("msgcount", "发言计数器 · 谁在说话")
    .alias("messageCounter")
    .action(({ session }) => session?.execute(`help msgcount`));

  ctx.command('msgcount.清空记录', '预览并确认清空全部发言记录', { authority: 3 })
    .option('confirm', '--confirm <token:string> 确认码')
    .action(createClearAction(ctx.database));

  // 查询指令
  const queryCommand = ctx
    .command(
      "msgcount.查询 [targetUser:text]",
      "查看发言次数与排名",
    )
    .userFields(["id", "name"]);

  // 关闭昨日发言统计时，相关选项不再注册，帮助文本与实际行为保持一致
  if (config.enableYesterdayRanking) {
    queryCommand.option("yesterday", "--yd 昨日发言");
  }

  queryCommand
    .option("day", "-d 今日发言")
    .option("week", "-w 本周发言")
    .option("month", "-m 本月发言")
    .option("year", "-y 今年发言")
    .option("total", "-t 总发言");

  if (config.enableYesterdayRanking) {
    queryCommand.option("ydag", "跨频道昨日发言");
  }

  queryCommand
    .option("dag", "跨频道今日发言")
    .option("wag", "跨频道本周发言")
    .option("mag", "跨频道本月发言")
    .option("yag", "跨频道今年发言")
    .option("tag", "跨频道总发言")
    .action(async ({ session, options }, targetUser) => {
      // -- 1. 选项解析 --
      const optionKeys = [
        "day",
        "week",
        "month",
        "year",
        "total",
        "dag",
        "wag",
        "mag",
        "yag",
        "tag",
        // 关闭昨日统计后必须从这里剔除：不带任何选项时会把 optionKeys 全部置为
        // 选中，否则残留的 yesterdayPostCount 仍会被展示出来。
        ...(config.enableYesterdayRanking ? ["yesterday", "ydag"] : []),
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
      if (targetUserRecord.length === 0) return `📋 这个用户还没有发言记录\n从下一条消息起就会开始计数。`;

      // 求和交给数据库：每人一行，而不是每人每群一行
      const [channelSummary, acrossSummary]: [Summary[], Summary[]] =
        await Promise.all([
          summarize(ctx, { channelId }),
          summarize(ctx, {}),
        ]);

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

      const push = (
        target: StatRow[],
        rows: Summary[],
        period: "yesterday" | "today" | "week" | "month" | "year" | "total",
        label: string,
        enabled: boolean,
      ) => {
        const { count, total, rank } = statOf(rows, userId, period);
        target.push({ label, count, total, rank, enabled });
      };

      if (config.enableYesterdayRanking) {
        push(channelStats, channelSummary, "yesterday", "昨日", selectedOptions.yesterday);
      }
      push(channelStats, channelSummary, "today", "今日", selectedOptions.day);
      push(channelStats, channelSummary, "week", "本周", selectedOptions.week);
      push(channelStats, channelSummary, "month", "本月", selectedOptions.month);
      push(channelStats, channelSummary, "year", "今年", selectedOptions.year);
      push(channelStats, channelSummary, "total", "总计", selectedOptions.total);

      if (config.enableYesterdayRanking) {
        push(acrossStats, acrossSummary, "yesterday", "昨日", selectedOptions.ydag);
      }
      push(acrossStats, acrossSummary, "today", "今日", selectedOptions.dag);
      push(acrossStats, acrossSummary, "week", "本周", selectedOptions.wag);
      push(acrossStats, acrossSummary, "month", "本月", selectedOptions.mag);
      push(acrossStats, acrossSummary, "year", "今年", selectedOptions.yag);
      push(acrossStats, acrossSummary, "total", "总计", selectedOptions.tag);

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
          formatPercentage(s.count, s.total),
        );

        const maxCountWidth = Math.max(0, ...counts.map((s) => s.length));
        const maxPercentWidth = Math.max(0, ...percents.map((s) => s.length));

        let table = `${title}\n`;
        for (const row of activeStats) {
          const label = row.label.padEnd(2, "　"); // 使用全角空格对齐中文
          const countStr = String(row.count).padStart(maxCountWidth, " ");
          const percentStr = formatPercentage(row.count, row.total).padEnd(
            maxPercentWidth,
            " ",
          );
          const rankStr = row.rank ? `#${row.rank}` : "#-";
          table += `${label} ${countStr}  ${percentStr}  ${rankStr}\n`;
        }
        return table;
      };

      const channelTable = formatStatsTable("频道发言", channelStats);
      const acrossTable = formatStatsTable("跨频道发言", acrossStats);

      const body = [channelTable, acrossTable].filter(Boolean).join("\n");
      if (!body) return `📋 这个用户在所选时段内没有发言记录\n换一个时段选项，或用 \`-t\` 看总计。`;

      // 使用 'sv-SE' locale 可以方便地得到 YYYY-MM-DD HH:MM:SS 格式
      const timestamp = new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Shanghai",
      });
      const header = `📋 ${targetUserRecord[0].username} 的发言次数\n${timestamp}\n\n`;
      const message = header + body;

      return message;
    });

  // 排行榜指令
  const rankCommand = ctx
    .command("msgcount.排行榜 [count:posint]", "查看用户发言排行榜")
    .userFields(["id", "name"])
    .option("whites", "<users:text> 空格或逗号分隔的白名单")
    .option("blacks", "<users:text> 空格或逗号分隔的黑名单");

  // 关闭昨日发言统计时，相关选项不再注册，帮助文本与实际行为保持一致
  if (config.enableYesterdayRanking) {
    rankCommand.option("yesterday", "--yd 昨日发言榜");
  }

  rankCommand
    .option("day", "-d 今日发言榜")
    .option("week", "-w 本周发言榜")
    .option("month", "-m 本月发言榜")
    .option("year", "-y 今年发言榜")
    .option("total", "-t 总发言榜");

  if (config.enableYesterdayRanking) {
    rankCommand.option("ydag", "跨频道昨日发言榜");
  }

  rankCommand
    .option("dag", "跨频道今日发言榜")
    .option("wag", "跨频道本周发言榜")
    .option("mag", "跨频道本月发言榜")
    .option("yag", "跨频道今年发言榜")
    .option("tag", "跨频道总发言榜")
    .action(async ({ session, options }, count) => {
      if (!session) return;

      const number = count ?? config.defaultMaxDisplayCount;

      const whites = parseList(options?.whites);
      const blacks = [
        ...parseList(options?.blacks),
        ...config.hiddenUserIdsInLeaderboard,
      ];

      const period = getPeriodFromOptions(options, "today");
      const isAcross = isAcrossChannel(options);

      const { field, name: periodName } = periodMapping[period];
      const scopeName = isAcross ? "跨频道" : "本频道";
      const rankTitle = `${scopeName}${periodName}发言排行榜`;
      const rankTimeTitle = getCurrentBeijingTime();

      const { rows, total: totalCount } = await rankUsers(ctx, {
        field,
        channelId: isAcross ? undefined : session.channelId,
        whites,
        blacks,
        limit: number,
        pin: session.userId,
      });

      if (rows.length === 0) {
        return "📋 这个范围内还没有发言记录\n换一个时段选项，或用 `-t` 看总计。";
      }

      const rankingData: RankingData[] = rows.map((row) => ({
        name: (row.key === session.userId ? "★" : "") + row.name,
        userId: row.key,
        avatar: row.avatar,
        count: row.count,
        percentage: calculatePercentage(row.count, totalCount),
      }));

      return renderLeaderboard({
        textOnly: presentation.textOnly(session),
        rankTimeTitle,
        rankTitle,
        rankingData,
        totalCount,
      });
    });

  const channelRankCommand = ctx
    .command("msgcount.频道排行榜 [count:posint]", "查看各频道发言排行榜")
    .option("specificUser", "-s <user:text> 只看某个用户的频道发言榜")
    .option("whites", "<channels:text> 白名单频道号")
    .option("blacks", "<channels:text> 黑名单频道号");

  // 关闭昨日发言统计时，相关选项不再注册，帮助文本与实际行为保持一致
  if (config.enableYesterdayRanking) {
    channelRankCommand.option("yesterday", "--yd 昨日发言榜");
  }

  channelRankCommand
    .option("day", "-d 今日发言榜")
    .option("week", "-w 本周发言榜")
    .option("month", "-m 本月发言榜")
    .option("year", "-y 今年发言榜")
    .option("total", "-t 总发言榜")
    .action(async ({ session, options }, count) => {
      if (!session) return;

      const number = count ?? config.defaultMaxDisplayCount;

      const whites = parseList(options?.whites);
      const blacks = [
        ...parseList(options?.blacks),
        ...config.hiddenChannelIdsInLeaderboard,
      ];
      const period = getPeriodFromOptions(options, "today");
      const { field, name: periodName } = periodMapping[period];

      let rankTitle: string;
      let userId: string | undefined;
      const rankTimeTitle = getCurrentBeijingTime();

      if (options?.specificUser) {
        const at = h.select(options.specificUser, "at");
        userId = at.length ? at[0].attrs.id : options.specificUser;

        const [record] = await ctx.database.get(
          "message_counter_records",
          { userId, channelId: session.channelId },
          ["username"],
        );
        rankTitle = `${record?.username || `用户${userId}`}的${periodName}频道发言排行榜`;
      } else {
        rankTitle = `全频道${periodName}发言排行榜`;
      }

      const { rows, total: totalCount } = await rankChannels(ctx, {
        field,
        userId,
        whites,
        blacks,
        limit: number,
        pin: session.channelId,
      });

      if (rows.length === 0) {
        return `📋 这些条件下还没有频道发言记录\n放宽黑白名单，或换一个时段选项。`;
      }

      const rankingData: RankingData[] = rows.map((row) => ({
        name: (row.key === session.channelId ? "★" : "") + row.name,
        userId: row.key,
        avatar: row.avatar,
        count: row.count,
        percentage: calculatePercentage(row.count, totalCount),
      }));

      return renderLeaderboard({
        textOnly: presentation.textOnly(session),
        rankTimeTitle,
        rankTitle,
        rankingData,
        totalCount,
      });
    });

  // 上传柱状条背景
  ctx
    .command(
      "msgcount.上传柱状条背景",
      "上传个人柱状条底图",
    )
    .action(async ({ session }) => {
      if (!session || !session.userId) {
        return "❌ 读不到用户信息，稍后再试一次。";
      }
      if (!session.content) {
        return "⚠️ 指令里没有附带图片\n把图片和指令发在同一条消息里，新图会覆盖旧背景。";
      }

      const imageElements = h.select(session.content, "img");
      if (imageElements.length === 0) {
        return "⚠️ 指令里没有附带图片\n把图片和指令发在同一条消息里，新图会覆盖旧背景。";
      }

      const { userId } = session;

      // 辅助函数：清理用户旧的背景图
      const cleanupOldBackground = async () => {
        try {
          const allFiles = await fs.readdir(barBgImgsPath);
          // 查找所有以 "用户ID." 开头的文件，以匹配不同后缀名
          const userFiles = allFiles.filter((file) =>
            file.startsWith(`${userId}.`),
          );
          if (userFiles.length > 0) {
            await Promise.all(
              userFiles.map((file) =>
                fs.unlink(path.join(barBgImgsPath, file)),
              ),
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
          await ctx.http.get(imageUrl, { responseType: "arraybuffer" }),
        );

        // 检查文件大小
        const imageSizeInMB = buffer.byteLength / 1024 / 1024;
        if (config.maxBarBgSize > 0 && imageSizeInMB > config.maxBarBgSize) {
          return `⚠️ 图片文件过大\n当前 ${imageSizeInMB.toFixed(2)}MB，上限 ${config.maxBarBgSize}MB。\n换一张更小的图片再传一次。`;
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
              return `⚠️ 图片尺寸超出限制\n当前 ${image.naturalWidth}x${image.naturalHeight}，上限 ${config.maxBarBgWidth}x${config.maxBarBgHeight}。\n换一张 850x50 像素左右的图片再传一次。`;
            }
          } catch (error) {
            logger.error("解析图片尺寸失败:", error);
            return "⚠️ 图片格式读不出来\n换一张 PNG 或 JPEG 格式的图片再传一次。";
          }
        } else {
          warnOnce("canvas-missing", "Canvas 服务未启用，跳过背景图尺寸检查。");
        }

        // 所有检查通过，先清理旧图，再保存新图
        await cleanupOldBackground();

        // 统一保存为 png 格式，文件名为 用户ID.png
        const newFileName = `${userId}.png`;
        const newFilePath = path.join(barBgImgsPath, newFileName);

        await fs.writeFile(newFilePath, buffer);
        await reloadBarBgImgCache();

        return "✅ 自定义柱状条背景已更新\n发送「msgcount.排行榜」看看效果。";
      } catch (error) {
        logger.error(`为用户 ${userId} 上传背景图失败:`, error);

        // 上传失败，清理旧的背景图
        await cleanupOldBackground();
        await reloadBarBgImgCache(); // 清理后同样需要重载缓存

        const userMessage =
          error instanceof Error
            ? error.message
            : "图片保存时出了未知的错。";
        return `❌ 背景图没能保存\n${userMessage}\n原有的自定义背景已一并移除，可以重新上传一张。`;
      }
    });

  // 重载资源
  ctx
    .command("msgcount.重载资源", "重载图标、背景与字体", {
      authority: 2,
    })
    .action(async ({ session }) => {
      if (!session) return;

      await session.send("⏳ 正在重载图标、背景与字体缓存……");

      await reloadIconCache();
      await reloadBarBgImgCache();
      await reloadFontCache(); // 调用字体缓存重载

      return `✅ 资源重载完毕\n• 用户图标 ${iconCache.length} 个\n• 柱状条背景 ${barBgImgCache.length} 张\n• 字体文件 ${fontFilesCache.length} 个`;
    });

  // 清理缓存
  ctx
    .command("msgcount.清理缓存", "清理过期的头像缓存", {
      authority: 3,
    })
    .option(
      "days",
      "-d <days:natural> 清理天数",
    )
    .action(async ({ session, options }) => {
      if (!session) return;

      const days = options.days ?? 30;

      await session.send(`⏳ 正在清理 ${days} 天前的头像缓存……`);

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
        return `✅ 缓存清理完成\n• 删除过期文件 ${deletedCount} 个\n• 释放空间约 ${freedSizeFormatted}`;
      } catch (error) {
        if (error.code === "ENOENT") {
          return "📋 头像缓存目录还不存在，没有要清理的。";
        }
        logger.error("清理头像缓存时发生未知错误:", error);
        return "❌ 清理没能完成\n详细原因见后台日志，稍后再试一次。";
      }
    });

  // --- 辅助函数 ---
  // hs*

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
        `读取字体文件 "${path.basename(filePath)}" 失败，已跳过。错误: ${
          readError.message
        }`,
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
            logger.debug(
              `检测到字体 "${path.basename(
                filePath,
              )}" 不规范，正在创建修复版本 "${patchedFilename}"……`,
            );
            const CORRECT_VERSION = 0x00010000; // 65536
            buffer.writeUInt32BE(CORRECT_VERSION, tableOffset);
            try {
              await fs.writeFile(patchedFilePath, buffer);
              logger.info(`已修复不规范的字体文件 "${patchedFilename}"。`);
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
    } as const;

    const { field, name: periodName } = pushPeriodConfig[period];

    logger.debug(`[自动推送] 开始执行 ${periodName} 发言排行榜推送任务。`);

    const scopeName = "本频道"; // 自动推送总是基于单个群聊的视角
    const rankTimeTitle = getCurrentBeijingTime();

    // 1. 优先获取所有机器人能触及的群聊列表，并建立一个 ID -> 带平台前缀ID 的映射
    // guildChannelIdMap 仅包含真实的群聊（来自 bot.getGuildList），用于“推送到所有群”
    // lookupChannelIdMap 在 guild 基础上叠加数据库记录，仅用于解析配置中指定的频道 ID
    const guildChannelIdMap = new Map<string, string>();
    const lookupChannelIdMap = new Map<string, string>();

    // 判断是否为私聊频道（Koishi 约定的私聊 channelId 形如 "private:..."）
    const isDirectChannelId = (id: string) => {
      const sepIdx = id.indexOf(":");
      const unprefixed = sepIdx !== -1 ? id.substring(sepIdx + 1) : id;
      return (
        id.startsWith("private:") ||
        unprefixed.startsWith("private:") ||
        unprefixed.startsWith("private_")
      );
    };

    // --- 增强获取逻辑，防止 Adapter 报错导致任务中断 ---
    try {
      const channelListPromises = ctx.bots.map(async (bot) => {
        if (!bot.online || !bot.getGuildList) return [];
        try {
          let next: string | undefined;
          do {
            const result = await bot.getGuildList(next);
            if (!result || !result.data) {
              break;
            }
            // 确保 result.data 是数组
            if (Array.isArray(result.data)) {
              result.data.forEach((channel) => {
                // 跳过私聊目标，避免误将私聊用户当作群聊推送
                if (isDirectChannelId(channel.id)) return;
                // 避免因多个机器人同在一个群而覆盖
                if (!guildChannelIdMap.has(channel.id)) {
                  const prefixed = `${bot.platform}:${channel.id}`;
                  guildChannelIdMap.set(channel.id, prefixed);
                  lookupChannelIdMap.set(channel.id, prefixed);
                }
              });
            }
            next = result.next;
          } while (next);
        } catch (error) {
          // 捕获单个 Bot 获取列表时的错误（如 OneBot 的 retcode 1400），避免炸毁整个任务
          logger.warn(
            `[自动推送] 机器人 ${bot.platform} 获取群聊列表失败，将尝试使用数据库记录回退: ${error.message}`,
          );
        }
      });
      await Promise.all(channelListPromises);
    } catch (error) {
      logger.error("[自动推送] 获取群聊列表的主流程发生错误:", error);
    }

    // --- 数据库回退机制 ---
    // 仅用于解析配置中显式指定的 pushChannelIds，不会污染“推送到所有群”的目标列表
    try {
      const allRecords = await ctx.database.get("message_counter_records", {}, [
        "channelId",
      ]);
      const dbChannelIds = new Set(allRecords.map((r) => r.channelId));
      const activeBot = ctx.bots.find((b) => b.status === 1);

      for (const dbCid of dbChannelIds) {
        if (isDirectChannelId(dbCid)) continue;
        if (!lookupChannelIdMap.has(dbCid) && activeBot) {
          lookupChannelIdMap.set(dbCid, `${activeBot.platform}:${dbCid}`);
        }
      }
    } catch (dbError) {
      logger.warn("[自动推送] 读取数据库记录进行回退时出错:", dbError);
    }

    // 2. 确定需要推送的频道列表（使用 Set 自动去重）
    const targetChannels = new Set<string>();

    // 2.1 解析配置中的 pushChannelIds，利用映射表转换为带前缀的 ID
    for (const channelId of config.pushChannelIds || []) {
      if (channelId.includes(":")) {
        // 本身就是带前缀的 ID
        targetChannels.add(channelId);
      } else if (lookupChannelIdMap.has(channelId)) {
        // 在映射表中找到了对应的带前缀 ID
        targetChannels.add(lookupChannelIdMap.get(channelId)!);
      } else {
        // 如果映射表没找到（且之前 DB 回退也没找到），尝试用第一个在线 Bot 强行构建
        const activeBot = ctx.bots.find((b) => b.status === 1);
        if (activeBot) {
          targetChannels.add(`${activeBot.platform}:${channelId}`);
        } else {
          logger.warn(
            `[自动推送] 无法处理配置的频道 ID: ${channelId}，未找到在线 Bot。`,
          );
        }
      }
    }

    // 2.2 如果开启了“向所有群聊推送”，仅添加来自 getGuildList 的真实群聊，避免私聊误推
    if (config.shouldSendLeaderboardNotificationsToAllChannels) {
      guildChannelIdMap.forEach((prefixedId) => targetChannels.add(prefixedId));
    }

    // 2.3 应用排除列表
    const excluded = new Set(config.excludedLeaderboardChannels || []);
    if (excluded.size > 0) {
      for (const id of Array.from(targetChannels)) {
        // 兼容带前缀和不带前缀的排除项
        const separatorIdx = id.indexOf(":");
        const unprefixedId =
          separatorIdx !== -1 ? id.substring(separatorIdx + 1) : id;
        if (excluded.has(id) || excluded.has(unprefixedId)) {
          targetChannels.delete(id);
        }
      }
    }

    if (targetChannels.size === 0) {
      logger.debug("[自动推送] 没有配置任何需要推送的频道，任务结束。");
      return;
    }

    logger.debug(`[自动推送] 将向 ${targetChannels.size} 个频道进行推送。`);

    let pushedCount = 0;
    let failedCount = 0;

    // 3. 遍历频道并推送 (修改点在于 field 和 periodName 已被通用化)
    for (const prefixedChannelId of targetChannels) {
      try {
        const platformSeparatorIndex = prefixedChannelId.indexOf(":");
        const channelId =
          platformSeparatorIndex === -1
            ? prefixedChannelId
            : prefixedChannelId.substring(platformSeparatorIndex + 1);

        const { rows, total: totalCount } = await rankUsers(ctx, {
          field,
          channelId,
          blacks: config.hiddenUserIdsInLeaderboard,
          limit: config.defaultMaxDisplayCount,
        });

        const ranked = rows.filter((row) => row.count > 0);
        if (ranked.length === 0) {
          logger.debug(
            `[自动推送] 频道 ${prefixedChannelId} 在 ${periodName} 榜单上无有效数据，跳过。`,
          );
          continue;
        }

        const rankingData: RankingData[] = ranked.map((row) => ({
          name: row.name,
          userId: row.key,
          avatar: row.avatar,
          count: row.count,
          percentage: calculatePercentage(row.count, totalCount),
        }));

        if (config.isGeneratingRankingListPromptVisible) {
          // 忽略发送提示消息的错误（例如禁言导致），不中断后续发送图片
          try {
            await ctx.broadcast(
              [prefixedChannelId],
              `⏳ 正在生成本频道的${periodName}发言排行榜……`,
            );
          } catch (e) {}
          await sleep(config.leaderboardGenerationWaitTime * 1000);
        }

        // 渲染时，使用我们动态选择的 `periodName`
        const rankTitle = `${scopeName}${periodName}发言排行榜`;
        const renderedMessage = await renderLeaderboard({
          rankTimeTitle,
          rankTitle,
          rankingData,
          totalCount,
        });
        await ctx.broadcast([prefixedChannelId], renderedMessage);

        pushedCount++;
        logger.debug(
          `[自动推送] 已成功向频道 ${prefixedChannelId} 推送${periodName}排行榜。`,
        );

        const randomDelay =
          Math.random() * config.groupPushDelayRandomizationSeconds;
        const delay =
          (config.delayBetweenGroupPushesInSeconds + randomDelay) * 1000;
        if (delay > 0) {
          await sleep(delay);
        }
      } catch (error) {
        failedCount++;
        logger.error(
          `[自动推送] 向频道 ${prefixedChannelId} 推送时发生错误:`,
          error,
        );
      }
    }

    // 真正推送出去（或出错）时才汇总一行；空转的任务不必打扰控制台。
    if (pushedCount > 0 || failedCount > 0) {
      logger.info(
        `[自动推送] ${periodName}排行榜推送完成：成功 ${pushedCount} 个频道${
          failedCount > 0 ? `，失败 ${failedCount} 个` : ""
        }。`,
      );
    } else {
      logger.debug(`[自动推送] ${periodName}排行榜没有需要推送的频道。`);
    }
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
    logger.debug("[抓龙王] 开始执行禁言任务。");

    // 等待设定的延迟时间
    await sleep(config.dragonKingDetainmentTime * 1000);

    for (const channelId of config.muteChannelIds) {
      try {
        // 只要昨日发言最多的那一位，排序与截断都交给数据库
        const [topUser] = await ctx.database
          .select("message_counter_records")
          .where({ channelId, yesterdayPostCount: { $gt: 0 } })
          .orderBy("yesterdayPostCount", "desc")
          .limit(1)
          .execute();

        if (!topUser) {
          logger.debug(`[抓龙王] 频道 ${channelId} 昨日无人发言，跳过。`);
          continue;
        }

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
              `[抓龙王] Bot ${bot.selfId} 已在频道 ${channelId} 将昨日龙王 ${topUser.username} (${topUser.userId}) 禁言 ${config.detentionDuration} 天。`,
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
            `✅ 昨日发言最多的是 ${h("at", {
              id: topUser.userId,
              name: topUser.username,
            })}，已禁言 ${config.detentionDuration} 天。`,
          );
        } else {
          // 如果所有机器人都尝试失败了
          logger.warn(
            `[抓龙王] 在频道 ${channelId} 执行禁言失败。可能没有任何机器人拥有该群的管理员权限，或目标用户是管理员。`,
          );
        }
      } catch (error) {
        logger.error(`[抓龙王] 在频道 ${channelId} 查找龙王时出错:`, error);
      }
    }
  }

  const scheduledTasks: (() => void)[] = [];
  type PeriodIdentifier = "daily" | "weekly" | "monthly" | "yearly";

  /** 一次计数器重置任务。 */
  interface ResetJob {
    period: PeriodIdentifier;
    field: CountField;
    message: string;
  }

  /**
   * 初始化重置状态，防止首次启动时发生破坏性数据清除。
   * 此函数会在插件启动时运行，为每个周期检查并创建基准重置时间记录。
   */
  async function initializeResetStates() {
    logger.debug("正在初始化并验证发言计数器的重置状态...");
    const now = new Date();
    const initializedPeriods: PeriodIdentifier[] = [];
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
        initializedPeriods.push(period);
        logger.debug(
          `已为 '${period}' 周期初始化重置状态，基准时间：${baselineDate.toISOString()}`,
        );
      }
    }
    // 只有首次安装或数据被清空时才会真正写入基准时间，这时才值得提示一次。
    if (initializedPeriods.length) {
      logger.info(
        `已初始化 ${initializedPeriods.join("、")} 周期的重置基准时间。`,
      );
    } else {
      logger.debug("所有周期的重置状态已验证完毕。");
    }
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
    logger.debug("正在检查错过的计数器重置任务...");

    // 定义任务，以便循环处理
    const jobDefinitions: ResetJob[] = [
      {
        period: "daily",
        field: "todayPostCount",
        message: "已补上错过的每日发言榜重置",
      },
      {
        period: "weekly",
        field: "thisWeekPostCount",
        message: "已补上错过的每周发言榜重置",
      },
      {
        period: "monthly",
        field: "thisMonthPostCount",
        message: "已补上错过的每月发言榜重置",
      },
      {
        period: "yearly",
        field: "thisYearPostCount",
        message: "已补上错过的每年发言榜重置",
      },
    ];

    const dueJobs: ResetJob[] = [];
    for (const job of jobDefinitions) {
      if (await isResetDue(job.period)) {
        logger.debug(`检测到错过的 ${job.period} 重置任务，正在执行...`);
        dueJobs.push(job);
      }
    }
    await runResets(dueJobs);

    logger.debug("错过的计数器重置任务检查完毕。");
  }

  /**
   * 在单个事务中执行一批重置。
   *
   * 逐行更新时每条语句都是一次独立提交，包进事务后整批只提交一次；实测在同样的
   * 数据规模下还能再快约 2.7 倍，是方案效果不理想时的兜底。个别驱动（如单节点
   * MongoDB）不支持事务，此时回退为直接执行；事务失败会整体回滚，重试是安全的。
   */
  async function runResets(jobs: ResetJob[]) {
    if (!jobs.length) return;

    const apply = async (database: typeof ctx.database) => {
      for (const job of jobs) {
        await resetCounter(database, job);
      }
    };

    try {
      await ctx.database.withTransaction(apply);
    } catch (error) {
      logger.debug("以事务方式重置失败，回退为直接执行：%o", error);
      await apply(ctx.database);
    }

    // 提交成功后才播报，避免回滚重试时重复输出
    for (const job of jobs) {
      logger.success(job.message);
    }
  }

  /**
   * 重置计数器并更新状态
   * @param database 数据库句柄（可能是事务句柄）
   * @param job 待执行的重置任务
   */
  async function resetCounter(
    database: typeof ctx.database,
    { field, period }: ResetJob,
  ) {
    if (field === "todayPostCount" && config.enableYesterdayRanking) {
      // 把“昨日 = 今日”与“今日 = 0”合并为一次更新，并且只触及今日或昨日有发言的行。
      // 绝大多数历史记录当天并没有发言，原先的整表两次重写正是零点卡顿的根源；
      // 这里的开销只与当日活跃人数有关，与累积的历史数据量无关。
      // 注意：yesterdayPostCount 必须写在 todayPostCount 之前，赋值按字段顺序生效。
      await database.set(
        "message_counter_records",
        {
          $or: [
            { todayPostCount: { $gt: 0 } },
            { yesterdayPostCount: { $gt: 0 } },
          ],
        },
        (row) => ({
          yesterdayPostCount: row.todayPostCount,
          todayPostCount: 0,
        }),
      );
    } else {
      // 关闭昨日统计后，todayPostCount 走的就是这条普通清零路径：不再结转、
      // 也不必扫昨日有发言的那批行，零点要动的行数与写入量都进一步减少。
      // 残留的 yesterdayPostCount 不再更新，但所有读取入口都已同步关闭。
      // 其余周期同理：非零的行才需要清零，已经是 0 的行没有任何写入的必要。
      await database.set(
        "message_counter_records",
        { [field]: { $gt: 0 } } as any,
        { [field]: 0 },
      );
    }

    // 更新状态表，记录本次重置时间。与数据重置同处一个事务，
    // 因此不会出现“记了时间却没重置成功”的中间状态。
    await database.upsert("message_counter_state", [
      {
        key: `last_${period}_reset`,
        value: new Date(),
      },
    ]);
    logger.debug(`已更新 ${period} 周期的最后重置时间。`);
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

  /** 按文件头认浏览器能解的几种位图：PNG、JPEG、GIF、WebP、BMP。 */
  function looksLikeImage(bytes: Buffer): boolean {
    const startsWith = (...signature: number[]) =>
      signature.every((byte, index) => bytes[index] === byte);
    return (
      startsWith(0x89, 0x50, 0x4e, 0x47) ||
      startsWith(0xff, 0xd8, 0xff) ||
      startsWith(0x47, 0x49, 0x46, 0x38) ||
      (startsWith(0x52, 0x49, 0x46, 0x46) &&
        bytes.toString("ascii", 8, 12) === "WEBP") ||
      startsWith(0x42, 0x4d)
    );
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
      // 设置5秒超时，防止请求卡死
      const buffer = await ctx.http.get(url, {
        responseType: "arraybuffer",
        timeout: 5000,
      });
      if (ctx.canvas) {
        // 有 canvas 服务：统一缩到 50×50 的 PNG，缓存更小
        const image = await ctx.canvas.loadImage(buffer);
        const canvas = await ctx.canvas.createCanvas(50, 50);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, 50, 50);
        finalBase64 = (await canvas.toBuffer("image/png")).toString("base64");
      } else {
        // 没有 canvas 服务：原图直接存下来。图表的浏览器端会自己缩到 50×50，
        // 头像照样画得出来，取主色也在那边做——这条路径不需要 canvas。
        // 但这里没人解码，状态码 200 的错误页也会被当成头像长期缓存，所以先认一下文件头。
        const bytes = Buffer.from(buffer as ArrayBuffer);
        if (!looksLikeImage(bytes)) {
          throw new Error(`返回的不是图片（${bytes.length} 字节）`);
        }
        finalBase64 = bytes.toString("base64");
      }
    } catch (error) {
      warnOnce(
        `avatar-fetch-failed:${error?.message ?? error}`,
        `获取或处理头像失败 (URL: ${url})，将使用默认头像并缓存失败状态:`,
        error.message || error,
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
        cacheError,
      );
    }

    return newEntry.base64;
  }

  async function reloadIconCache() {
    iconCache = await loadAssetsFromFolder(iconsPath);
    logger.debug(`已加载 ${iconCache.length} 个用户图标。`);
  }

  async function reloadBarBgImgCache() {
    barBgImgCache = await loadAssetsFromFolder(barBgImgsPath);
    logger.debug(`已加载 ${barBgImgCache.length} 个柱状图背景图片。`);
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
      logger.debug(`已加载 ${fontFilesCache.length} 个可用字体文件。`);
    } catch (error) {
      logger.warn(`无法读取或重载字体目录 ${fontsPath}:`, error);
      fontFilesCache = [];
    }
  }

  // 自动迁移旧资源文件到新目录结构
  async function migrateFolder(oldPath: string, newPath: string) {
    try {
      await fs.access(oldPath, fsConstants.F_OK); // 检查旧文件夹是否存在
      logger.debug(`检测到旧资源文件夹: ${oldPath}，将迁移至: ${newPath}`);
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
  ) {
    const destPath = path.join(destDir, filename);
    try {
      // 仅当目标文件不存在时才拷贝
      await fs.access(destPath, fsConstants.F_OK);
    } catch {
      const sourcePath = path.join(sourceDir, filename);
      try {
        await fs.access(sourcePath, fsConstants.F_OK);
      } catch {
        logger.warn(`插件资源文件未找到，无法拷贝: ${filename}`);
        return;
      }
      await fs.copyFile(sourcePath, destPath);
      logger.debug(`已拷贝资源文件 ${filename} 到 ${destDir}`);
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
    folderPath: string,
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

  // --- 辅助函数：图表生成 ---

  /** 页面左右留白（像素），同时用于计算截图宽度。与 acumen 的图表取同一档。 */
  const CHART_PAGE_PADDING_X = 24;
  /** 等画布画完的上限（毫秒）。头像都是内联的 data URL，正常几十毫秒就画完。 */
  const CHART_DRAW_TIMEOUT = 15000;
  /** 页面上下留白（像素）。 */
  const CHART_PAGE_PADDING_Y = 24;
  /** 字号倍率，旧配置里没有这一项时按 1。 */
  const CHART_FONT_SCALE = config.chartFontScale || 1;
  /** acumen 的字号 → 本页的 CSS 字号，见 ACUMEN_EM。 */
  const chartFontPx = (acumenSize: number) =>
    +((LEGACY_CHART_SIZE[acumenSize] ?? acumenSize) * CHART_FONT_SCALE).toFixed(2);

  /**
   * 生成图表的静态 CSS 样式。
   * @returns 包含基本元素样式的 CSS 字符串。
   */
  function _getChartBaseStyles(): string {
    return `
      ${baseline(SCHEME)}
      ${components()}

      html {
        min-height: 100%;
      }

      body {
        font-family: ${FONT_STACK};
        /* 底色由 html 上的可配置样式承载（渐变 / 图片 / 自定义 CSS），
           baseline 给 body 铺的背景色会把它整个盖住，这里保持透明。 */
        background: transparent;
        margin: 0;
        padding: ${CHART_PAGE_PADDING_Y}px ${CHART_PAGE_PADDING_X}px;
        width: 100%;
        min-height: 100%;
        box-sizing: border-box;
        position: relative;
        color: ${INK};
        -webkit-font-smoothing: antialiased;
        font-variant-numeric: tabular-nums;
      }

      /* 背景图层：承载模糊与蒙版，位于内容之下 */
      .bg-layer {
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
      }

      /* 页眉居中：标题、元信息行的高与间距逐项按 acumen 的标题区来（32 / 12 / 18），
         下面的榜单因此落在与 acumen 同一个纵坐标上。组件自带的 padding 与间隙
         会把这块撑高，这里按图表的原样压回去。
         行高是 acumen 给这两行留的位（随倍率缩放），字号是那边实际画出来的 em。 */
      .chart-header {
        margin: 0 0 24px;
        padding: 0;
        gap: 12px;
        align-items: center;
        text-align: center;
      }

      /* 标题：与 acumen 的 title_font_size（32）同档 */
      .ranking-title {
        margin: 0;
        font-size: ${chartFontPx(32)}px;
        line-height: ${32 * CHART_FONT_SCALE}px;
        font-weight: ${EMPHASIZED_WEIGHT.headline};
        color: ${INK};
      }

      /* 元信息行（m3-header__support）：与 acumen 的 meta_font_size（18）同档。
         分隔点自己带匀称的左右间距，不依赖字体里「·」的空腔。 */
      .ranking-subtitle {
        font-size: ${chartFontPx(18)}px;
        line-height: ${18 * CHART_FONT_SCALE}px;
        font-weight: 400;
        color: ${INK_SOFT};
      }
      .ranking-subtitle .sep {
        margin: 0 ${chartFontPx(9)}px;
        opacity: 0.55;
      }

      #rankingCanvas {
        display: block;
        margin: 0 auto;
      }

      /* 预加载字体用，不显示 */
      .font-preload {
        display: none;
      }
    `;
  }

  /**
   * 内置渐变配色：预设名 -> [起始色, 结束色]。
   *
   * 每个预设只是换一个色相，色调固定走 98 -> 92 这一档。
   * 于是无论选哪个，背景与榜单之间的明度差都一样，条色不会忽然被背景吃掉。
   */
  const GRADIENT_PRESETS: Record<string, [string, string]> = Object.fromEntries(
    (
      [
        ["paper", 82, 6],
        ["cloud", 240, 8],
        ["sunrise", 52, 26],
        ["ocean", 250, 22],
        ["sakura", 340, 22],
        ["mint", 160, 20],
        ["cream", 68, 18],
      ] as [string, number, number][]
    ).map(([name, hue, chroma]) => [name, [lch(98, chroma * 0.5, hue), lch(92, chroma, hue)]]),
  ) as Record<string, [string, string]>;

  /** 未配置或配置无效时使用的默认背景：与 acumen 的图表同一张纸。
   *  纯白在整屏两千像素上看久了刺眼，退半档到暖白（surface），
   *  acumen 的淡色轨道与横条也是画在这张纸上。 */
  const DEFAULT_BACKGROUND_CSS = `html {
      background: ${PAPER};
    }`;

  /** 图片背景的尺寸与平铺方式对应的 CSS 片段。 */
  function _backgroundSizingCss(fit: string): string {
    if (fit === "repeat") {
      return "background-size: auto; background-repeat: repeat;";
    }
    const size =
      fit === "stretch" ? "100% 100%" : fit === "contain" ? "contain" : "cover";
    return `background-size: ${size}; background-repeat: no-repeat;`;
  }

  /**
   * 生成图片类背景（本地图片 / 网络图片 / API 随机图）的 CSS。
   * 清晰的原图铺在 `html` 上，模糊与白色蒙版叠加在 `.bg-layer` 上，避免影响正文。
   */
  function _imageBackgroundCss(imageUrl: string, config: Config): string {
    const sizing = _backgroundSizingCss(config.backgroundImageFit || "cover");
    const blur = Math.max(0, Number(config.backgroundBlur) || 0);
    const mask = Math.min(
      1,
      Math.max(0, Number(config.backgroundMaskOpacity) || 0),
    );

    let css = `html {
      background-color: ${SCHEME.surfaceContainer};
      background-image: ${imageUrl};
      background-position: center;
      ${sizing}
    }`;

    if (blur > 0) {
      css += `
    .bg-layer {
      background-image: ${imageUrl};
      background-position: center;
      ${sizing}
      filter: blur(${blur}px);
    }`;
    }

    if (mask > 0) {
      css += `
    .bg-layer::after {
      content: "";
      position: absolute;
      inset: 0;
      /* 全库唯一保留的 rgba：这是真的压在图片上的半透明遮罩，
         浓度由用户配置，换成不透明色就不是蒙版了 */
      background: rgba(255, 255, 255, ${mask});
    }`;
    }

    return css;
  }

  /** 把背景图地址转成可直接用于 CSS 的 url()：本地文件读成 data URI，链接原样使用。 */
  async function _resolveBackgroundImageUrl(
    source: string,
  ): Promise<string | null> {
    const src = (source || "").trim();
    if (!src) return null;
    if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) {
      return `url('${src}')`;
    }
    try {
      const filePath = path.isAbsolute(src)
        ? src
        : path.resolve(ctx.baseDir, src);
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mime =
        ext === "jpg" ? "jpeg" : ext === "svg" ? "svg+xml" : ext || "png";
      return `url('data:image/${mime};base64,${buffer.toString("base64")}')`;
    } catch (error) {
      logger.error(`读取本地背景图片失败（${src}），将使用默认背景：`, error);
      return null;
    }
  }

  /** 从 API 获取一张背景图，返回可用于 CSS 的 url()。 */
  async function _fetchApiBackgroundUrl(config: Config): Promise<string | null> {
    try {
      const { apiUrl, apiKey, responseType } = config.apiBackgroundConfig;
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

      switch (responseType) {
        case "url": {
          // API 返回一个包含图片 URL 的 JSON 或纯文本
          const response = await ctx.http.get(apiUrl, { headers });
          const imageUrl =
            typeof response === "string" ? response : response?.url;
          if (!imageUrl || typeof imageUrl !== "string") {
            throw new Error('API response for "url" type is not a valid string.');
          }
          return `url('${imageUrl}')`;
        }

        case "base64": {
          // API 返回一个包含 Base64 数据的 JSON 或纯文本
          const response = await ctx.http.get(apiUrl, { headers });
          const base64Data =
            typeof response === "string" ? response : response?.data;
          if (!base64Data || typeof base64Data !== "string") {
            throw new Error(
              'API response for "base64" type is not a valid string.',
            );
          }
          // 自动检测并添加 data URI scheme
          const prefix = base64Data.startsWith("data:image")
            ? ""
            : "data:image/png;base64,";
          return `url('${prefix}${base64Data}')`;
        }

        case "binary":
        default: {
          // API 返回原始图片数据（二进制）
          const responseBuffer = await ctx.http.get<ArrayBuffer>(apiUrl, {
            headers,
            responseType: "arraybuffer",
          });
          const base64 = Buffer.from(responseBuffer).toString("base64");
          return `url('data:image/png;base64,${base64}')`;
        }
      }
    } catch (error) {
      logger.error("获取 API 背景图失败，将使用默认背景:", error);
      return null;
    }
  }

  /**
   * 准备图表的背景样式。
   * 此函数根据配置生成应用于整个 HTML 页面的背景 CSS。
   * 通过将样式应用于 `<html>` 标签，确保背景能完全覆盖 `fullPage` 截图的区域。
   * @param config 插件配置对象。
   * @returns 一个包含背景样式的 CSS 字符串。
   */
  async function _prepareBackgroundStyle(config: Config): Promise<string> {
    switch (config.backgroundType) {
      case "gradient": {
        const preset = GRADIENT_PRESETS[config.gradientPreset];
        const from = preset?.[0] ?? config.gradientStartColor ?? SCHEME.surfaceBright;
        const to = preset?.[1] ?? config.gradientEndColor ?? SCHEME.surfaceContainer;
        const angle = Number.isFinite(config.gradientAngle)
          ? config.gradientAngle
          : 135;
        return `html {
      background: linear-gradient(${angle}deg, ${from} 0%, ${to} 100%);
    }`;
      }

      case "solid": {
        const color = (config.solidColor || "").trim();
        if (!color) break;
        return `html {
      background: ${color};
    }`;
      }

      case "image": {
        const imageUrl = await _resolveBackgroundImageUrl(
          config.backgroundImageSource,
        );
        if (!imageUrl) break;
        return _imageBackgroundCss(imageUrl, config);
      }

      case "api": {
        if (!config.apiBackgroundConfig?.apiUrl) break;
        const imageUrl = await _fetchApiBackgroundUrl(config);
        if (!imageUrl) break;
        return _imageBackgroundCss(imageUrl, config);
      }

      case "css": {
        if (config.backgroundValue) return config.backgroundValue;
        break;
      }
    }

    return DEFAULT_BACKGROUND_CSS;
  }

  /**
   * 获取在浏览器端执行的绘图脚本。
   * @returns 一个 IIFE (立即调用函数表达式) 字符串，用于在浏览器中绘制 Canvas。
   */
  function _getClientScript(): string {
    // 此函数返回一个字符串，该字符串是将在 Puppeteer 浏览器上下文中执行的完整脚本。
    // 使用 IIFE (async (...) => { ... }) 格式，以便在 HTML 中清晰地传递参数。
    return `
      async ({ rankingData, iconData, barBgImgs, fallbackAvatar, config }) => {
        // --- 版式常量：集中控制头像、柱状条与文字的尺寸和留白 ---
        // 这一组数值与 acumen 的 draw_bar_chart 逐项对齐（那边以 2 倍尺寸绘制，
        // 这里是 1 倍）：行高 50、条最短 150、随发言数增长 700、名字左内缩 10、
        // 条尾到发言数 10、发言数与占比之间 8、名次字号 22、名次到头像 12。
        // 改动时三处一起改。
        //
        // 字号照 acumen 的数写，再乘 fontScale：那边的字号是字体上下伸的总高，
        // 不是 em，照抄成 CSS px 会大三成多（见 ACUMEN_EM）。
        // 取两位小数，与 monetary-rank 的 fontSizes 落到同一个数（名次列宽要逐像素一致）
        const fontPx = (size) => +((config.typeSizes[size] ?? size) * config.fontScale).toFixed(2);
        const LAYOUT = {
          avatarSize: 50,       // 头像边长，也是每一行的高度
          rowGap: 10,           // 行与行之间的空隙
          avatarGap: 6,         // 头像与柱状条之间的空隙
          barMinWidth: 150,     // 柱状条的最小长度
          barSpan: 700,         // 柱状条随发言数增长的最大长度
          barRadius: 10,        // 柱状条圆角：条高的两成
          avatarRadius: ${SHAPE.full}, // 头像圆角，行高的一半即正圆
          namePad: 10,          // 名称距柱状条左端的距离
          textGap: 10,          // 柱状条末端与发言数之间的空隙
          columnGap: 14,        // 读数排成两列时，轨道右端到数值列的空隙
          countFontSize: fontPx(30),   // 发言数字号，与 acumen 的 font_size 同档
          percentFontSize: fontPx(20), // 百分比字号，与 acumen 的 pct_font_size 同档
          percentGap: 8,        // 发言数与百分比之间的空隙
          rankFontSize: fontPx(22),    // 名次字号：比昵称小两档，只作次序参照
          rankGap: 12,          // 名次列与头像之间的空隙
        };
        const ROW_HEIGHT = LAYOUT.avatarSize + LAYOUT.rowGap;
        // 轨道是定长的：条最长就铺满它，数值写在轨道右侧的留白上，与 acumen 一致。
        const TRACK_WIDTH = LAYOUT.barMinWidth + LAYOUT.barSpan;

        // 三个纵列的左边界（名次 / 头像 / 轨道）。名次列要按最长的那一号现量宽度，
        // 所以在 drawRanking 里才落定；其余函数都从 drawRanking 里调，读到的是终值。
        let RANK_RIGHT_X = 0;
        let AVATAR_X = 0;
        let BAR_X = 0;
        // 读数排成两列时，数值与占比各自的右端
        let VALUE_RIGHT_X = 0;
        let PCT_RIGHT_X = 0;

        /* 行内文字只用一支字体，与 acumen 相同——那边整张图的昵称与读数都不走等宽栈。
           字体栈照那边的取字体顺序：先系统里的 Noto Sans CJK SC（acumen 原先的
           font_family），再是本插件随包带的那支。 */
        const chartFont = (size) => \`\${size}px "\${config.chartNicknameFont}", HarmonyOS_Sans_Medium, "Microsoft YaHei", sans-serif\`;

        // --- 主绘制函数 ---
        async function drawRanking() {
          const maxCount = rankingData.reduce((max, item) => Math.max(max, item.count), 0) || 1;
          const canvas = document.getElementById('rankingCanvas');
          let context = canvas.getContext('2d');

          // 版式分五个纵列：名次 → 头像 → 横条（实色进度 + 淡色轨道）→ 数值 → 占比。
          //
          // 名次单独成列：从前这张榜只能靠数行数才知道第几名。前三名走固定的奖牌色，
          // 不跟头像色走——名次的颜色本身就是含义，跟着主题走一遍就不认得了。
          //
          // 列宽按「字号的 0.6 倍 × 位数」估，不拿画布去真量：monetary-rank 那边量不了字，
          // 两张榜必须落到同一个数，所以两边共用这一个模型（与那边估数字宽度的模型一致）。
          // 名次右对齐，模型比真实字宽略宽，多出来的那一点落在数字左边，看不出来。
          const rankDigits = String(rankingData.length).length;
          RANK_RIGHT_X = Math.ceil(LAYOUT.rankFontSize * 0.6 * rankDigits);
          AVATAR_X = RANK_RIGHT_X + LAYOUT.rankGap;
          BAR_X = AVATAR_X + LAYOUT.avatarSize + LAYOUT.avatarGap;

          // 逐行量一遍右侧文字，用最宽的一行决定画布宽度，避免数字被裁掉
          let maxTextWidth = 0;
          let valueColumnWidth = 0;
          let percentColumnWidth = 0;
          for (const data of rankingData) {
            const block = measureCountBlock(context, data);
            maxTextWidth = Math.max(maxTextWidth, block.width);
            valueColumnWidth = Math.max(valueColumnWidth, block.countWidth);
            percentColumnWidth = Math.max(percentColumnWidth, block.percentWidth);
          }

          // 读数写在哪儿由 valueFollowsBar 决定，两种都要留位：跟着条尾时按最宽的
          // 那一串在轨道右边留（榜首那根条恰好顶到轨道尽头，所以 textGap + 最宽的一串
          // 就够）；排成两列时按两列各自最宽的一行留。
          const valueEndX = BAR_X + TRACK_WIDTH;
          if (config.valueFollowsBar) {
            canvas.width = Math.ceil(valueEndX + LAYOUT.textGap + maxTextWidth);
          } else {
            VALUE_RIGHT_X = valueEndX + LAYOUT.columnGap + valueColumnWidth;
            PCT_RIGHT_X = VALUE_RIGHT_X + LAYOUT.percentGap + percentColumnWidth;
            canvas.width = Math.ceil(PCT_RIGHT_X);
          }
          canvas.height = ROW_HEIGHT * rankingData.length - LAYOUT.rowGap;

          // 重新获取上下文，因为尺寸变化会重置状态
          context = canvas.getContext('2d');
          context.textBaseline = "alphabetic";

          // 每行的配色只算一次，全部出自 acumen 那套运算
          const rows = [];
          for (const [index, data] of rankingData.entries()) {
            // 取不到头像的用兜底色，与 acumen 的 FALLBACK_THEME 同一支
            const theme = data.avatarBase64 === fallbackAvatar
              ? hexToRgb(FALLBACK_THEME)
              : await avatarThemeColor(data.avatarBase64);
            const bar = harmonizeTheme(theme);
            const track = trackTone(bar);
            // 数字踩在什么底上，就按什么底量对比度：跟着条尾时压在淡色轨道上
            // （榜首那一行越过轨道落在纸上，纸更浅，一并够）；排成列时全在纸上。
            const ground = config.valueFollowsBar ? track : hexToRgb(PAPER);
            const valueTone = ensureContrast(deepTone(bar, 0.34), ground, 4.5);
            rows.push({
              data,
              y: ROW_HEIGHT * index,
              // 条长取整：monetary-rank 那边是 DOM 盒子，浏览器会把盒子的边落到整像素，
              // 画布这边跟着取整，两张榜的条尾、读数与名字的起点才落在同一个位置。
              barWidth: Math.round(LAYOUT.barMinWidth + (LAYOUT.barSpan * data.count) / maxCount),
              bar: rgbToHex(bar),
              track: rgbToHex(track),
              valueInk: rgbToHex(valueTone),
              // 占比是次要信息：把数值的墨往底色里调一点，同一支色相退半档，
              // 退到刚好还在正文阈值上为止
              pctInk: rgbToHex(ensureContrast(mixWithColor(valueTone, ground, 0.62), ground, 4.5)),
              nameInk: rgbToHex(contrastInk(bar)),
            });
          }

          // 图层顺序：轨道 → (刻度) → 实色条 → (刻度) → 头像 → 文字。
          // 文字永远在最上面，刻度压不到名字和数字上。
          drawTracks(context, rows, TRACK_WIDTH);
          if (!config.gridLinesOverBars) drawGridLines(context, TRACK_WIDTH);
          await drawBars(context, rows, TRACK_WIDTH);
          if (config.gridLinesOverBars) drawGridLines(context, TRACK_WIDTH);
          await drawAvatars(context);
          await drawTexts(context, rows);
        }

        // --- 核心绘图逻辑 ---

        /** 轨道：整行的淡色底，四角圆润。 */
        function drawTracks(context, rows, trackWidth) {
          for (const row of rows) {
            context.save();
            traceRoundRect(context, BAR_X, row.y, trackWidth, LAYOUT.avatarSize, LAYOUT.barRadius);
            context.fillStyle = row.track;
            context.fill();
            context.restore();
          }
        }

        /** 实色条：轨道内的已达成部分，右端平切，与轨道接成一条。 */
        async function drawBars(context, rows, trackWidth) {
          for (const row of rows) {
            context.save();
            traceRoundRect(context, BAR_X, row.y, trackWidth, LAYOUT.avatarSize, LAYOUT.barRadius);
            context.clip();

            context.fillStyle = row.bar;
            context.fillRect(BAR_X, row.y, row.barWidth, LAYOUT.avatarSize);

            // 自定义背景图：铺在条上，名字的字色改用背景图的调子
            const userBarBgImgs = findAssets(row.data.userId, barBgImgs, 'barBgImgBase64');
            if (userBarBgImgs.length > 0) {
              const pick = userBarBgImgs[Math.floor(Math.random() * userBarBgImgs.length)];
              const newAvg = await drawCustomBarBackground(
                context, pick, BAR_X, row.y, row.barWidth, LAYOUT.avatarSize, trackWidth
              );
              row.nameInk = rgbToHex(contrastInk(newAvg));
            }
            context.restore();
          }
        }

        async function drawCustomBarBackground(context, base64, x, y, barWidth, barHeight, trackWidth) {
            return new Promise(async (resolve) => {
                const barBgImg = new Image();
                barBgImg.src = "data:image/png;base64," + base64;
                barBgImg.onload = async () => {
                    context.save();
                    // 绘制整行背景（如果透明度 > 0）
                    if (config.horizontalBarBackgroundFullOpacity > 0) {
                        context.globalAlpha = config.horizontalBarBackgroundFullOpacity;
                        context.drawImage(barBgImg, x, y, trackWidth, barHeight); // 铺满整条轨道
                    }
                    // 绘制进度条区域背景
                    context.globalAlpha = config.horizontalBarBackgroundOpacity;
                    context.drawImage(barBgImg, 0, 0, barWidth, barHeight, x, y, barWidth, barHeight);
                    context.restore();
                    const newAvgColor = averageColor(await readAvatarCircle(base64));
                    resolve(newAvgColor);
                };
                barBgImg.onerror = async () => {
                    const originalColor = averageColor(await readAvatarCircle(base64));
                    resolve(originalColor); // 发生错误则返回原始颜色
                }
            });
        }

        /** 量出「发言数 + 百分比」整块文字的尺寸，用于排版与画布宽度计算。 */
        function measureCountBlock(context, data) {
            context.font = chartFont(LAYOUT.countFontSize);
            const countText = Number(data.count).toLocaleString('en-US');
            const countWidth = context.measureText(countText).width;

            const percentText = formatPercent(data.percentage);
            let percentWidth = 0;
            if (percentText) {
                context.font = chartFont(LAYOUT.percentFontSize);
                percentWidth = context.measureText(percentText).width;
            }

            return {
                countText,
                countWidth,
                percentText,
                percentWidth,
                width: countWidth + (percentText ? LAYOUT.percentGap + percentWidth : 0),
            };
        }

        /** 百分比文案：一律取整——一列数字里不夹小数点看着才干净；
         *  不足半个百分点写 "<1%"，免得非零的零头被舍成没意义的 "0%"。 */
        function formatPercent(percentage) {
            if (!config.isUserMessagePercentageVisible) return '';
            const value = Number(percentage) || 0;
            if (value <= 0) return '0%';
            const rounded = Math.round(value);
            return rounded === 0 ? '<1%' : rounded + '%';
        }

        /** 行内文字：名次、名字写在条内，发言数与占比跟着条尾或排成右边两列。 */
        async function drawTexts(context, rows) {
          for (const [index, row] of rows.entries()) {
            await drawRowText(context, row, index + 1);
          }
        }

        /**
         * 行内文字的基线（相对行顶），按 CSS 行盒的算法来：上伸、下伸各自取整，
         * 半行距向下取整。monetary-rank 的同一张榜是 HTML 排的，走的正是这套，
         * 两边的字才落在同一个像素上——拿字号乘系数去估，换一档字号就差 1px。
         */
        function rowBaseline(context, height) {
            context.font = chartFont(LAYOUT.countFontSize);
            const metrics = context.measureText('国');
            if (metrics.fontBoundingBoxAscent === undefined) {
                // 量不了字体度量的老内核：按中日韩字体的常见比例估
                return height / 2 + LAYOUT.countFontSize * 0.35 + 2;
            }
            const ascent = Math.round(metrics.fontBoundingBoxAscent);
            const descent = Math.round(metrics.fontBoundingBoxDescent);
            return Math.floor((height - ascent - descent) / 2) + ascent;
        }

        async function drawRowText(context, row, rank) {
            const { data, y: barY, barWidth } = row;
            const barHeight = LAYOUT.avatarSize;
            const baselineY = barY + rowBaseline(context, barHeight);
            const block = measureCountBlock(context, data);

            // --- 名次：右对齐收在头像左边。前三名是奖牌色，固定不跟主题也不跟头像走 ---
            context.textAlign = "right";
            context.font = chartFont(LAYOUT.rankFontSize);
            context.fillStyle = rankInk(rank);
            context.fillText(String(rank), RANK_RIGHT_X, baselineY);

            // --- 发言次数与百分比：同色相的深调，落在自己那行的轨道或纸面上 ---
            context.font = chartFont(LAYOUT.countFontSize);
            context.fillStyle = row.valueInk;
            if (config.valueFollowsBar) {
                // 条铺满整条轨道时这串读数就在轨道外，画布按最宽的一行留过位置
                context.textAlign = "left";
                const textX = BAR_X + barWidth + LAYOUT.textGap;
                context.fillText(block.countText, textX, baselineY);
                // 百分比小一号、退半档，作为发言数的附注
                if (block.percentText) {
                    context.font = chartFont(LAYOUT.percentFontSize);
                    context.fillStyle = row.pctInk;
                    context.fillText(block.percentText, textX + block.countWidth + LAYOUT.percentGap, baselineY);
                }
            } else {
                // 两列各自右对齐：上下扫一眼就能比大小
                context.fillText(block.countText, VALUE_RIGHT_X, baselineY);
                if (block.percentText) {
                    context.font = chartFont(LAYOUT.percentFontSize);
                    context.fillStyle = row.pctInk;
                    context.fillText(block.percentText, PCT_RIGHT_X, baselineY);
                }
            }

            // --- 用户名（带截断），写在实色条内 ---
            context.textAlign = "left";
            context.font = chartFont(LAYOUT.countFontSize);
            context.fillStyle = row.nameInk;

            // 名字能用满整根条：只有这个人确实挂了图标，才给图标留出那一格，
            // 否则每行都白白少掉 44px，短条上的昵称会被截得只剩两三个字
            const userIcons = findAssets(data.userId, iconData, 'iconBase64');
            const iconReserve = userIcons.length > 0 ? 44 : LAYOUT.namePad;

            let nameText = data.name;
            const maxNameWidth = barWidth - LAYOUT.namePad - iconReserve;
            if (context.measureText(nameText).width > maxNameWidth) {
                const ellipsis = "…";
                while (context.measureText(nameText + ellipsis).width > maxNameWidth && nameText.length > 0) {
                    nameText = nameText.slice(0, -1);
                }
                nameText += ellipsis;
            }
            const nameTextX = BAR_X + LAYOUT.namePad;
            context.fillText(nameText, nameTextX, baselineY);

            // 绘制用户自定义图标
            if (userIcons.length > 0) {
                await drawUserIcons(context, userIcons, {
                    nameTextX: context.measureText(nameText).width + nameTextX,
                    barX: BAR_X,
                    barWidth: barWidth,
                    rowY: barY
                });
            }
        }

        async function drawUserIcons(context, icons, positions) {
            const { nameTextX, barX, barWidth, rowY } = positions;

            // 使用 Promise.all 等待所有图片加载和绘制
            await Promise.all(icons.map((iconBase64, i) => {
                return new Promise((resolve, reject) => {
                    const icon = new Image();
                    icon.src = "data:image/png;base64," + iconBase64;
                    icon.onload = () => {
                        const iconSize = 40;
                        // 在行里居中，不跟着文字基线走：字号一调，基线就挪了
                        const iconY = rowY + (LAYOUT.avatarSize - iconSize) / 2;
                        let iconX = config.shouldMoveIconToBarEndLeft
                            ? barX + barWidth - (iconSize * (i + 1)) - 6
                            : nameTextX + (iconSize * i) + 8;
                        context.drawImage(icon, iconX, iconY, iconSize, iconSize);
                        resolve(); // 图片绘制成功
                    };
                    icon.onerror = () => {
                        resolve(); // 即使单个图标加载失败，也继续执行，不中断整个排行榜生成
                    };
                });
            }));
        }

        /** 加载一张 base64 图片；加载失败也照常返回，由调用方看 width 判断。 */
        async function loadImage(base64) {
            const image = new Image();
            image.src = "data:image/png;base64," + base64;
            await new Promise(resolve => {
                image.onload = resolve;
                image.onerror = resolve; // 即使加载失败也继续
            });
            return image;
        }

        async function drawAvatars(context) {
          const size = LAYOUT.avatarSize;
          const shape = config.avatarShape || 'circle';

          for (const [index, data] of rankingData.entries()) {
            const y = ROW_HEIGHT * index;
            let image = await loadImage(data.avatarBase64);
            // 解不开的头像（旧版缓存下的坏字节）换成默认头像，与取不到头像的行一个样
            if (!image.width) image = await loadImage(fallbackAvatar);
            if (!image.width) continue;

            if (shape === 'circle') {
              // 头像底下垫一圈发丝细的暗边：浅色头像贴在暖白纸上边缘会化掉。
              // 与 acumen 同法——半径比头像大 1px 的实心圆，垫在头像下面。
              context.save();
              context.beginPath();
              context.arc(AVATAR_X + size / 2, y + size / 2, size / 2 + 1, 0, Math.PI * 2);
              context.closePath();
              context.fillStyle = GRID_LINE;
              context.fill();
              context.restore();
            } else {
              // 非圆形的头像（用户配置的形状）仍用一圈描边收边
              context.save();
              traceAvatarShape(context, AVATAR_X + 0.5, y + 0.5, size - 1, shape);
              context.strokeStyle = GRID_LINE;
              context.lineWidth = 1;
              context.stroke();
              context.restore();
            }

            context.save();
            traceAvatarShape(context, AVATAR_X, y, size, shape);
            context.clip();
            context.drawImage(image, AVATAR_X, y, size, size);
            context.restore();
          }
        }

        /** 按配置勾勒头像轮廓：圆形 / 圆角方形 / 方形。 */
        function traceAvatarShape(context, x, y, size, shape) {
            if (shape === 'circle') {
                context.beginPath();
                context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
                context.closePath();
            } else if (shape === 'rounded') {
                traceRoundRect(context, x, y, size, size, LAYOUT.avatarRadius);
            } else {
                context.beginPath();
                context.rect(x, y, size, size);
                context.closePath();
            }
        }

        /** 刻度线：自条的零点起一格一道，只刻在轨道里，行间空隙保持干净。
         *  末道收在圆角之前，不落到轨迹的圆角上；与实色条的上下关系由
         *  gridLinesOverBars 决定，文字始终压在最上层。 */
        function drawGridLines(context, trackWidth) {
            const firstLineX = BAR_X + LAYOUT.barMinWidth;
            const step = LAYOUT.barSpan / 7;
            const lastLineX = firstLineX + LAYOUT.barSpan - LAYOUT.barRadius;

            context.save();
            // 刻度线与 acumen 同为一档 8% 的黑：压在轨道与实色条上都读得出来
            context.fillStyle = HAIRLINE;
            for (let row = 0; row < rankingData.length; row++) {
                const y = ROW_HEIGHT * row;
                context.save();
                traceRoundRect(context, BAR_X, y, trackWidth, LAYOUT.avatarSize, LAYOUT.barRadius);
                context.clip();
                for (let x = firstLineX; x <= lastLineX; x += step) {
                    context.fillRect(x, y, 2, LAYOUT.avatarSize);
                }
                context.restore();
            }
            context.restore();
        }

        // --- 与 acumen 同一套配色 ---
        //
        // 条色是从头像里取的平均色，什么都有：雪白的自拍、全黑的剪影、荧光的二次元图。
        // 直接拿来铺条，一张二十行的榜就是二十种互不相干的颜色，字色也只能碰运气。
        // acumen 的图表先把它收一道：色相留给个人，明度归一到同一个点（相对亮度，
        // 不是 HSL 明度），条上的字、条外的读数与占比都从同一支色相里取。
        //
        // 下面这几个函数是从 acumen 的 chart/utils.rs 逐行搬过来的，连「as u8」
        // 的截断、二分与 round() 的位置都没改：两张榜会在同一个群里并排出现，
        // 颜色只有逐位相同才算一致。改了这里，acumen 那边要对着一起改。

        /** 刻度竖线的颜色：8% 的黑，压在轨道或实色条上都读得出来。 */
        const HAIRLINE = '${HAIRLINE}';
        /** 纸面：与 acumen 的 surface 同一支。读数排成两列时全落在纸上，按纸量对比度。 */
        ${clientColorScript()}
        const PAPER = '${PAPER}';
        /** 取不到头像、或头像读不出色相时的兜底色。这一行漏注入过：浏览器里一引用就抛错，整张画布空白（#29）。 */
        const FALLBACK_THEME = '${FALLBACK_THEME}';
        /** 头像底下那圈发丝细的边：不透明的 outline-variant，垫在头像下面。 */
        const GRID_LINE = '${GRID_LINE}';
        /** 名次色：前三名金银铜，其余用弱化的前景色。 */
        const MEDALS = ${JSON.stringify(MEDALS)};
        const INK_FAINT = '${INK_FAINT}';

        const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

        const hexToRgb = (hex) => [
            parseInt(hex.slice(1, 3), 16) || 0,
            parseInt(hex.slice(3, 5), 16) || 0,
            parseInt(hex.slice(5, 7), 16) || 0,
        ];

        const rgbToHex = (color) => '#' + color
            .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
            .join('');

        // Rust 里「x as u8」是截断，不是四舍五入
        const to8 = (value) => clamp(Math.trunc(value), 0, 255);

        /** RGB -> HSL，H 为 0—360，S/L 为 0—1。 */
        function toHsl(color) {
            const [r, g, b] = color.map((value) => value / 255);
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const l = (max + min) / 2;
            const d = max - min;
            if (Math.abs(d) < 1e-6) return [0, 0, l];
            const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            const h = max === r
                ? 60 * (((g - b) / d) % 6)
                : max === g
                    ? 60 * ((b - r) / d + 2)
                    : 60 * ((r - g) / d + 4);
            return [(h + 360) % 360, s, l];
        }

        /** HSL -> RGB。 */
        function fromHsl(h, s, l) {
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const hp = (h % 360) / 60;
            const x = c * (1 - Math.abs((hp % 2) - 1));
            const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
                : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
            const m = l - c / 2;
            const channel = (value) => clamp(Math.round(clamp(value + m, 0, 1) * 255), 0, 255);
            return [channel(r), channel(g), channel(b)];
        }

        const yiq = (color) => (color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000;

        // --- 对比度：可达性，不是风格 ---
        // 阈值由 WCAG 2.2 定，正文 4.5∶1，大字与图形元素 3∶1。条色来自头像，什么
        // 都可能，所以「同一支色相的深调」这种算法给出来的字色得逐对量过才敢用。

        /** WCAG 2.2 的相对亮度。 */
        function relativeLuminance(color) {
            const channel = (value) => {
                const s = value / 255;
                return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
        }

        /** 两色之间的对比度，1—21。 */
        const contrastRatio = (a, b) => {
            const la = relativeLuminance(a);
            const lb = relativeLuminance(b);
            return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };

        /** 这块底上该写深字还是浅字：黑与白各量一次，谁的对比度高就往谁那边走。 */
        const prefersDarkInk = (bg) => contrastRatio([0, 0, 0], bg) >= contrastRatio([255, 255, 255], bg);

        /**
         * 把前景一档档推开，直到它在 bg 上够 minRatio。色相不动，只动明度。
         *
         * 每档走掉剩余距离的 6%，且至少走一格：单纯按比例混色到了两端会因为取整
         * 原地打转，字色就停在离阈值一线的地方。
         */
        function ensureContrast(fg, bg, minRatio) {
            const target = prefersDarkInk(bg) ? [0, 0, 0] : [255, 255, 255];
            const step = (value, t) => {
                const moved = value + (t - value) * 0.06;
                if (t > value) return Math.min(Math.ceil(moved), t);
                if (t < value) return Math.max(Math.floor(moved), t);
                return value;
            };
            let color = fg;
            for (let i = 0; i < 255; i++) {
                if (contrastRatio(color, bg) >= minRatio
                    || (color[0] === target[0] && color[1] === target[1] && color[2] === target[2])) break;
                color = [step(color[0], target[0]), step(color[1], target[1]), step(color[2], target[2])];
            }
            return color;
        }

        // --- 同一支色相里的调子 ---
        //
        // M3 的 tonal palette 用感知明度（HCT 的 tone）把同一档上的所有色相归到一样重。
        // 这里用 WCAG 的相对亮度做同样的归一：HSL 明度不是视觉亮度，同一条明度带上
        // 黄比紫亮将近三倍，于是黄绿那几行在榜上永远比别人扎眼，整张图的重量忽轻忽重。

        /** 实色条的目标亮度：相对亮度 0.16。 */
        const BAR_LUMINANCE = 0.16;
        /** 淡色轨道的目标亮度：与条色的对比度约 3.5∶1，过非文字元素的 3∶1。 */
        const TRACK_LUMINANCE = 0.68;
        /** 彩度上限与下限：亮度归一之后，各行之间剩下的差别只有色相与彩度。 */
        const MAX_SATURATION = 0.30;
        const MIN_SATURATION = 0.16;
        /**
         * 读不出色相的下限：RGB 三分量的极差（彩度）不到这个比例，剩下的方向就是噪声。
         *
         * 判彩度要看极差，不能看 HSL 的 S：雪白的自拍三分量只差 10，HSL 却因为明度
         * 贴着顶而算出 0.23 的饱和度——照着它染，一张白头像会得到一条橘色的条。
         */
        const HUE_NOISE_FLOOR = 0.02;

        /** 回退色相：系统主色的那一支。灰头像不是「没有颜色」，是「没有自己的颜色」。 */
        const fallbackHue = () => toHsl(hexToRgb(FALLBACK_THEME))[0];

        /** 定住色相与饱和度，把明度推到指定的相对亮度上。相对亮度对 HSL 明度单调，二分即可。 */
        function atLuminance(h, s, target) {
            let low = 0;
            let high = 1;
            for (let i = 0; i < 24; i++) {
                const mid = (low + high) / 2;
                if (relativeLuminance(fromHsl(h, s, mid)) < target) low = mid;
                else high = mid;
            }
            return fromHsl(h, s, (low + high) / 2);
        }

        /** 主题色只留色相，彩度收进窄带，亮度归一到 BAR_LUMINANCE。 */
        function harmonizeTheme(color) {
            return hexToRgb(M3.harmonize('#' + color.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), 45, 36, 268));
        }

        /** 这一行的淡色轨道：同一支色相，亮度归一到 TRACK_LUMINANCE。
         *  「混一半白」得到的是固定的比例、不是固定的对比度：一支本来就亮的黄，
         *  混一半白之后与自己只差 1.50∶1，条尾在哪根本看不出来。 */
        function trackTone(bar) {
            return hexToRgb(M3.harmonize('#' + bar.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), 90, 24, 268));
        }

        const mixWithWhite = (color, opacity) => color
            .map((value) => to8(value * opacity + 255 * (1 - opacity)));

        const mixWithColor = (color, base, opacity) => {
            const t = clamp(opacity, 0, 1);
            return color.map((value, i) => to8(value * t + base[i] * (1 - t)));
        };

        /** 同色相的深调：给淡底上的字用。一次压暗对本来就很浅的色还不够，
         *  再压到 YIQ 亮度 96 以下为止。 */
        function deepTone(color, strength) {
            let out = mixWithColor(color, [0, 0, 0], clamp(strength, 0.05, 1));
            for (let i = 0; i < 4; i++) {
                if (yiq(out) <= 96) break;
                out = mixWithColor(out, [0, 0, 0], 0.75);
            }
            return out;
        }

        /** 实色条上的字色。纯白/纯黑盖在彩色上像两片贴纸；取同色相的极浅调或极深调，
         *  对比度一样够，字却像是从这块颜色里长出来的。最后一律过一遍阈值再交出去。 */
        function contrastInk(bg) {
            const seed = prefersDarkInk(bg) ? deepTone(bg, 0.26) : mixWithWhite(bg, 0.10);
            return ensureContrast(seed, bg, 4.5);
        }

        /** 第 rank 名（从 1 起）该用的墨色：前三名是奖牌色，其余是弱化的前景色。 */
        const rankInk = (rank) => MEDALS[rank - 1] || INK_FAINT;

        // --- 辅助工具函数 ---

        /** 勾勒圆角矩形路径（不填充），兼容不支持 roundRect 的环境。 */
        function traceRoundRect(context, x, y, width, height, radius) {
          const r = Math.max(0, Math.min(radius, width / 2, height / 2));
          context.beginPath();
          if (typeof context.roundRect === 'function') {
            context.roundRect(x, y, width, height, r);
          } else {
            context.moveTo(x + r, y);
            context.lineTo(x + width - r, y);
            context.quadraticCurveTo(x + width, y, x + width, y + r);
            context.lineTo(x + width, y + height - r);
            context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            context.lineTo(x + r, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - r);
            context.lineTo(x, y + r);
            context.quadraticCurveTo(x, y, x + r, y);
          }
          context.closePath();
        }

        function findAssets(userId, assetList, key) {
          return assetList
            .filter(data => data.userId === userId)
            .map(data => data[key]);
        }

        /**
         * 把头像缩到 50×50 并把圆外的像素读出来。
         *
         * acumen 缓存里存的是**圆裁之后**的缩略图，圆外是透明的、求平均时不计入；
         * 这里没有那一步，所以圆外的像素由这道遮罩剔除，两边看到的是同一批像素。
         * 没有 canvas 服务时缓存里存的是原图（可能上千像素），缩过之后既快，
         * 结果也只跟这一档尺寸有关，与 monetary-rank 的取法一致。
         *
         * 解不开的图只会触发 onerror、永远等不到 onload，所以两个都要接；
         * 读不出像素就返回空，由调用方落到兜底色，不能让一张坏头像卡住整张榜。
         */
        async function readAvatarCircle(base64) {
            const image = new Image();
            image.src = "data:image/png;base64," + base64;
            const loaded = await new Promise(r => {
                image.onload = () => r(true);
                image.onerror = () => r(false);
            });
            if (!loaded || !image.width) return [];

            const size = 50;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            canvas.width = size; canvas.height = size;
            ctx.drawImage(image, 0, 0, size, size);

            const center = size / 2;
            const radius = center - 1;
            const pixels = ctx.getImageData(0, 0, size, size).data;
            const inside = [];
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - center + 0.5;
                    const dy = y - center + 0.5;
                    if (Math.hypot(dx, dy) > radius + 0.5) continue;
                    inside.push([pixels[(y * size + x) * 4], pixels[(y * size + x) * 4 + 1], pixels[(y * size + x) * 4 + 2]]);
                }
            }
            return inside;
        }

        /** 这一圈像素的朴素平均，即 acumen 的 get_average_color。 */
        function averageColor(pixels) {
            if (!pixels.length) return hexToRgb(FALLBACK_THEME);
            let r = 0, g = 0, b = 0;
            for (const pixel of pixels) { r += pixel[0]; g += pixel[1]; b += pixel[2]; }
            const n = pixels.length;
            return [Math.floor(r / n), Math.floor(g / n), Math.floor(b / n)];
        }

        /**
         * 头像的调子：**明度取整张图的均色，色相取「有颜色的那部分」的均色。**
         *
         * 与 acumen 的 avatar_theme_color 逐字对应。一大半头像是「大片白底 + 中间一小块
         * 彩色」，白底一平均就把那一小块的方向稀释到快没有了；所以给每个像素按它自己的
         * 彩度加一份权重（+0.04 的底让纯灰头像退化成朴素平均），明度仍按整张图算，
         * 否则一张暗底亮标的头像会被那一点亮色带偏。最后把明度落进收调的窄带里。
         */
        async function avatarThemeColor(base64) {
            const pixels = await readAvatarCircle(base64);
            const plain = averageColor(pixels);

            let r = 0, g = 0, b = 0, weight = 0;
            for (const pixel of pixels) {
                const chroma = (Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])) / 255;
                const w = chroma + 0.04;
                r += pixel[0] * w; g += pixel[1] * w; b += pixel[2] * w;
                weight += w;
            }
            if (weight <= 0) return plain;
            const tinted = [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)];

            const [h, s] = toHsl(tinted);
            const l = toHsl(plain)[2];
            return fromHsl(h, s, clamp(l, 0.36, 0.50));
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
    /** 榜单统计范围内的总发言数，用于元信息行；0 表示不显示。 */
    totalCount: number;
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
      totalCount,
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
      // 取不到头像时客户端用兜底色，与 acumen 的 FALLBACK_THEME 同一支
      fallbackAvatar: fallbackBase64[0],
      config: chartConfig,
    };

    // 元信息行：上榜人数 + 合计（每行的百分比正是以它为基数）+ 出图时间
    const metaParts: string[] = [];
    if (data.length > 1) metaParts.push(`前 ${data.length} 名`);
    if (totalCount > 0) metaParts.push(`合计 ${totalCount.toLocaleString("en-US")}`);
    if (config.isTimeInfoSupplementEnabled) metaParts.push(rankTimeTitle);
    const metaLine = metaParts.length
      ? `<p class="ranking-subtitle m3-header__support">${metaParts.join(
          '<span class="sep">·</span>',
        )}</p>`
      : "";

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>排行榜</title>
          <style>${_getChartBaseStyles()}</style>
          <style>${backgroundStyle}</style>
          <style>${fontFacesCSS}</style>
          <style>
            .ranking-title, .ranking-subtitle { font-family: "${
              chartConfig.chartTitleFont
            }", HarmonyOS_Sans_Medium, "Microsoft YaHei", sans-serif; }
          </style>
      </head>
      <body>
          <div class="bg-layer"></div>
          <header class="chart-header m3-header">
            <h1 class="ranking-title m3-header__title">${rankTitle}</h1>
            ${metaLine}
          </header>
          <div class="font-preload">
            <span style="font-family: '${
              chartConfig.chartNicknameFont
            }';">预加载</span>
            <span style="font-family: '${
              chartConfig.chartTitleFont
            }';">预加载</span>
          </div>
          <canvas id="rankingCanvas"></canvas>
          <script>
            // 立即执行的异步函数，用于绘制图表。Promise 挂在 window 上，截图前要等它落定
            window.rankingDrawn = (async () => {
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
      totalCount,
      data,
    }: {
      rankTimeTitle: string;
      rankTitle: string;
      totalCount: number;
      data: RankingData[];
    },
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
    },
  ): Promise<Buffer> {
    if (!ctx.puppeteer) {
      throw new Error("Puppeteer 服务未启用，无法生成图表。");
    }

    const page = await ctx.puppeteer.page();
    try {
      const fontFaces = generateFontFacesCSS(fontFilesCache);
      const backgroundStyle = await _prepareBackgroundStyle(config);

      const chartConfigForClient = {
        shouldMoveIconToBarEndLeft: config.shouldMoveIconToBarEndLeft,
        horizontalBarBackgroundOpacity: config.horizontalBarBackgroundOpacity,
        horizontalBarBackgroundFullOpacity:
          config.horizontalBarBackgroundFullOpacity,
        isUserMessagePercentageVisible: config.isUserMessagePercentageVisible,
        avatarShape: config.avatarShape,
        gridLinesOverBars: config.gridLinesOverBars,
        valueFollowsBar: config.valueFollowsBar,
        chartTitleFont: config.chartTitleFont,
        chartNicknameFont: config.chartNicknameFont,
        // acumen 字号 → CSS 字号的整体系数（换算系数 × 配置倍率）
        typeSizes: LEGACY_CHART_SIZE,
        fontScale: CHART_FONT_SCALE,
      };

      const htmlContent = _getChartHtmlContent({
        rankTimeTitle,
        rankTitle,
        totalCount,
        data,
        iconCache,
        barBgImgCache,
        backgroundStyle,
        fontFacesCSS: fontFaces,
        chartConfig: chartConfigForClient,
      });

      // 字体是相对路径 `fonts/...`，先落到数据目录下的空白页才读得到。
      await page.goto(pathToFileURL(emptyHtmlPath).href, { waitUntil: "load" });

      await page.setContent(h.unescape(htmlContent), {
        waitUntil: config.waitUntil,
      });
      await page.evaluate(async () => {
        await (document as any).fonts?.ready;
      });

      // 等画布画完再截图。从前不等：页面里一抛错，截到的就是只有标题的空白图，
      // 日志里也什么都没有（#29）。画不完或抛错都在这里报出来。
      const drawError = await page.evaluate(async (timeout: number) => {
        try {
          await Promise.race([
            (window as any).rankingDrawn,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`${timeout} ms 内没有画完`)), timeout),
            ),
          ]);
          return null;
        } catch (error) {
          return String(error?.stack || error);
        }
      }, CHART_DRAW_TIMEOUT);
      if (drawError) throw new Error(`排行榜画布绘制失败：${drawError}`);

      const calculatedWidth = await page.evaluate((bodyPadding: number) => {
        const canvas = document.getElementById(
          "rankingCanvas",
        ) as HTMLCanvasElement | null;
        // 如果 canvas 存在，则返回其宽度加上页面的左右 padding；否则返回一个默认值。
        return canvas ? canvas.width + bodyPadding : 1080;
      }, CHART_PAGE_PADDING_X * 2);

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
      await page.close();
    }
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
              userId,
            );
            if (
              channelMember &&
              channelMember.user &&
              channelMember.user.name
            ) {
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
    channelId: string,
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
    if (options?.total || options?.tag) return "total";
    return fallback;
  }

  function isAcrossChannel(options: any): boolean {
    return ["ydag", "dag", "wag", "mag", "yag", "tag"].some(
      (opt) => options?.[opt],
    );
  }

  function calculatePercentage(number: number, total: number): number {
    if (total === 0) return 0;
    return (number / total) * 100;
  }

  function getCurrentBeijingTime(): string {
    return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  }

  async function renderLeaderboard({
    textOnly = false,
    rankTimeTitle,
    rankTitle,
    rankingData,
    totalCount = 0,
  }: {
    textOnly?: boolean;
    rankTimeTitle: string;
    rankTitle: string;
    rankingData: RankingData[];
    /** 统计范围内的总发言数，写在元信息行上；0 表示不显示。 */
    totalCount?: number;
  }): Promise<string | h> {
    // 渲染为水平柱状图
    if (!textOnly && config.isLeaderboardToHorizontalBarChartConversionEnabled) {
      if (!ctx.puppeteer) {
        warnOnce(
          "puppeteer-missing",
          "Puppeteer service is not enabled. Falling back to text.",
        );
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
            }),
          );

          const imageBuffer = await generateRankingChart(
            { rankTimeTitle, rankTitle, totalCount, data: chartReadyData },
            { iconCache, barBgImgCache, fontFilesCache, emptyHtmlPath },
          );
          return h('p', {}, [h.image(imageBuffer, `image/${config.imageType}`), h('p', {}, h.text(formatLeaderboardAsText(rankTimeTitle, rankTitle, rankingData, config.isUserMessagePercentageVisible)))]);
        } catch (error) {
          logger.error("Failed to generate leaderboard chart:", error);
        }
      }
    }

    // 默认渲染为纯文本
    return formatLeaderboardAsText(
      rankTimeTitle,
      rankTitle,
      rankingData,
      config.isUserMessagePercentageVisible,
    );
  }

  function formatLeaderboardAsText(
    rankTimeTitle: string,
    rankTitle: string,
    data: RankingData[],
    showPercentage: boolean,
  ): string {
    // 首行给榜单标题（带状态符），出图时间退到第二行，与出图版的页眉同序
    let result = `📋 ${rankTitle}\n${rankTimeTitle}\n\n`;
    // 文字输出保留请求范围内的全部条目
    const shown = data;
    shown.forEach((item, index) => {
      const percentageStr = showPercentage
        ? ` (${Math.round(item.percentage)}%)`
        : "";
      result += `${index + 1}. ${item.name}：${
        item.count
      } 次${percentageStr}\n`;
    });
    const hidden = data.length - shown.length;
    if (hidden > 0) result += `…… 另有 ${hidden} 人未列\n`;
    return result.trim();
  }
}
