import { Context, h, Logger, Schema, sleep, Bot, Dict, $ } from "koishi";
import schedule from "node-schedule";
import {} from "koishi-plugin-markdown-to-image-service";
import {} from "koishi-plugin-puppeteer";
import path from "path";
import {} from "@koishijs/canvas";
import * as fs from "fs/promises";
import { constants as fsConstants } from "fs";

export const name = "message-counter";
export const inject = {
  required: ["database"],
  optional: ["markdownToImage", "puppeteer", "canvas"],
};

export const usage = `## 注意事项

- 仅记录群聊消息。
- 初始化需要权限等级 3 级。

---

## 关键指令

\`messageCounter.查询 [指定用户]\`
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

\`messageCounter.排行榜 [显示的人数]\`
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

\`messageCounter.群排行榜 [number:number]\`
  各群聊的发言排行榜。默认为今日发言榜。

  选项:

- -d, --yesterday : 昨日/今日/本周/本月/今年/总发言排行榜
- -w, -m, -y, -t

- -s              : 指定用户的群发言排行榜
- --whites        : 白名单，只显示白名单群
- --blacks        : 黑名单，不显示黑名单群

\`messageCounter.上传柱状条背景\`

- 为自己上传一张自定义的水平柱状条背景图片 (用于样式3)。
- 使用此指令时需附带图片。

\`messageCounter.删除柱状条背景 [编号|all]\`

- 删除自己上传的背景图片。
- 不带参数则列出所有已上传图片。
- 使用编号删除指定图片；使用 \`all\` 删除所有图片。

\`messageCounter.重载资源\`

- 实时重载用户图标和柱状条背景，使其更改即时生效。（需要权限等级 2）

---

## 自定义水平柱状图样式

1. 用户图标

  - 在 \`data/messageCounterIcons\` 文件夹下添加用户图标。
  - 文件名格式为 \`用户ID.png\` (例: \`1234567890.png\`)。
  - 支持多图标，文件名格式为 \`用户ID-1.png\`, \`用户ID-2.png\`。

2. 柱状条背景

  - 推荐方式: 使用 \`messageCounter.上传柱状条背景\` 指令。
  - 手动方式: 在 \`data/messageCounterBarBgImgs\` 文件夹下添加背景图片。
  - 支持多背景 (随机选用)，文件名格式为 \`用户ID-1.png\` 等。
  - 建议尺寸 850x50 像素，文件名 \`用户ID.png\`。

---

## QQ 群

- 956758505`;

const logger = new Logger("messageCounter");

export interface Config {
  // --- 核心功能 ---
  /** 是否统计 Bot 自己发送的消息。 */
  isBotMessageTrackingEnabled: boolean;
  /** 是否禁用昨日发言排行榜，以解决潜在的 0 点卡顿问题。 */
  isYesterdayCommentRankingDisabled: boolean;

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
  /** 页面加载等待事件，影响图片生成速度和稳定性。 */
  waitUntil: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  /** 是否将自定义图标显示在柱状条的末端。 */
  shouldMoveIconToBarEndLeft: boolean;
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

  // --- 自动推送 ---
  /** 是否启用定时自动推送排行榜功能。 */
  autoPush: boolean;

  // -- 自动推送详细选项 --
  /** 是否在每日 0 点自动发送昨日排行榜。 */
  shouldSendDailyLeaderboardAtMidnight: boolean;
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
export const Config: Schema<Config> = Schema.intersect([
  // 核心功能设置
  Schema.object({
    isBotMessageTrackingEnabled: Schema.boolean()
      .default(false)
      .description("是否统计 Bot 自己发送的消息。"),
    isYesterdayCommentRankingDisabled: Schema.boolean()
      .default(false)
      .description(
        "是否禁用昨日发言排行榜。开启后可用于解决群组消息过多导致的每日 0 点卡顿问题。"
      ),
  }).description("核心功能"),

  // 排行榜基础设置
  Schema.object({
    defaultMaxDisplayCount: Schema.number()
      .min(0)
      .default(20)
      .description("排行榜默认显示的人数。"),
    isTimeInfoSupplementEnabled: Schema.boolean()
      .default(true)
      .description("是否在显示排行榜时补充时间信息。"),
    isUserMessagePercentageVisible: Schema.boolean()
      .default(true)
      .description("是否在排行榜中显示用户消息占比。"),
    hiddenUserIdsInLeaderboard: Schema.array(String)
      .role("table")
      .description("在排行榜中全局隐藏的用户列表。"),
    hiddenChannelIdsInLeaderboard: Schema.array(String)
      .role("table")
      .description("在群排行榜中全局隐藏的频道列表。"),
  }).description("排行榜设置"),

  // 图片生成设置
  Schema.intersect([
    Schema.object({
      isTextToImageConversionEnabled: Schema.boolean()
        .default(false)
        .description(
          "是否将文本排行榜转为图片（基于 `markdownToImage` 服务）。"
        ),
      isLeaderboardToHorizontalBarChartConversionEnabled: Schema.boolean()
        .default(false)
        .description(
          "是否将排行榜渲染为更美观的水平柱状图（基于 `puppeteer` 服务）。"
        ),
    }).description("图片生成"),

    // 仅在开启柱状图功能时显示以下详细选项
    Schema.union([
      Schema.object({
        isLeaderboardToHorizontalBarChartConversionEnabled:
          Schema.const(true).required(),
        imageType: Schema.union(["png", "jpeg", "webp"])
          .default("png")
          .description(`生成的柱状图图片类型。`),

        // --- 柱状图专属设置 ---
        waitUntil: Schema.union([
          "load",
          "domcontentloaded",
          "networkidle0",
          "networkidle2",
        ])
          .default("networkidle0")
          .description("页面加载等待事件，影响图片生成速度和稳定性。"),
        shouldMoveIconToBarEndLeft: Schema.boolean()
          .default(true)
          .description(
            "是否将自定义图标显示在柱状条的末端。关闭则显示在用户名旁。"
          ),
        horizontalBarBackgroundOpacity: Schema.number()
          .min(0)
          .max(1)
          .default(0.6)
          .description("自定义背景图在进度条区域的不透明度。"),
        horizontalBarBackgroundFullOpacity: Schema.number()
          .min(0)
          .max(1)
          .default(0)
          .description("自定义背景图在整行背景的不透明度。"),
        maxBarBgWidth: Schema.number()
          .min(0)
          .default(2000)
          .description("允许上传的背景图最大宽度（像素），0为不限制。"),
        maxBarBgHeight: Schema.number()
          .min(0)
          .default(200)
          .description("允许上传的背景图最大高度（像素），0为不限制。"),
        maxBarBgSize: Schema.number()
          .min(0)
          .default(5)
          .description("允许上传的背景图最大体积（MB），0为不限制。"),

        // --- 柱状图背景设置 ---
        backgroundType: Schema.union(["none", "api", "css"])
          .default("none")
          .description("图片整体背景的类型。"),
        apiBackgroundConfig: Schema.object({
          apiUrl: Schema.string().description("获取背景图的 API 地址。"),
          apiKey: Schema.string()
            .role("secret")
            .description("API 的访问凭证（可选）。"),
          responseType: Schema.union(["binary", "url", "base64"])
            .default("binary")
            .description("API 返回的数据类型。"),
        })
          .role("collapse")
          .description("API 背景配置（仅当类型为 API 时生效）。"),
        backgroundValue: Schema.string()
          .role("textarea", { rows: [2, 4] })
          .default(
            `body {\n  background: linear-gradient(135deg, #f6f8f9 0%, #e5ebee 100%);\n}`
          )
          .description("自定义背景的 CSS 代码（仅当类型为 CSS 时生效）。"),
      }),
      Schema.object({}),
    ]),
  ]),

  // 自动推送设置
  Schema.intersect([
    Schema.object({
      autoPush: Schema.boolean()
        .default(false)
        .description("是否启用定时自动推送排行榜功能。"),
    }).description("自动推送"),
    Schema.union([
      Schema.object({
        autoPush: Schema.const(true).required(),
        shouldSendDailyLeaderboardAtMidnight: Schema.boolean()
          .default(true)
          .description("是否在每日 0 点自动发送昨日排行榜。"),
        dailyScheduledTimers: Schema.array(String)
          .role("table")
          .description(
            "除 0 点外，其他定时发送今日排行榜的时间点（24小时制，如 `08:00`）。"
          ),
        isGeneratingRankingListPromptVisible: Schema.boolean()
          .default(true)
          .description("在生成并发送排行榜前，是否先发送一条提示消息。"),
        leaderboardGenerationWaitTime: Schema.number()
          .min(0)
          .default(3)
          .description("发送提示消息后，等待多少秒再发送排行榜图片。"),
        pushChannelIds: Schema.array(String)
          .role("table")
          .description(
            "需要接收自动推送的频道列表（留空则不推送到任何特定频道）。"
          ),
        shouldSendLeaderboardNotificationsToAllChannels: Schema.boolean()
          .default(false)
          .description(
            "是否向机器人所在的所有群聊推送（注意：这可能造成打扰）。"
          ),
        excludedLeaderboardChannels: Schema.array(String)
          .role("table")
          .description(
            "当“向所有群聊推送”开启时，此处指定的频道将不会收到推送。"
          ),
        delayBetweenGroupPushesInSeconds: Schema.number()
          .min(0)
          .default(5)
          .description("批量推送时，每个群之间的发送延迟（秒），以防风控。"),
        groupPushDelayRandomizationSeconds: Schema.number()
          .min(0)
          .default(10)
          .description("延迟时间的随机波动范围（秒），以进一步模拟人工操作。"),
      }),
      Schema.object({}),
    ]),
  ]),

  // 龙王禁言设置
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
          .default(1)
          .description("禁言时长，单位为天。"),
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
  }
}

interface apiBackgroundConfig {
  apiUrl: string;
  apiKey: string;
  responseType: string;
}

interface MessageCounterRecord {
  id: number;
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

export async function apply(ctx: Context, config: Config) {
  // --- 资源路径和缓存初始化 ---
  const dataRoot = path.join(ctx.baseDir, "data");
  const messageCounterIconsPath = path.join(dataRoot, "messageCounterIcons");
  const messageCounterBarBgImgsPath = path.join(
    dataRoot,
    "messageCounterBarBgImgs"
  );
  const emptyHtmlPath = path
    .join(__dirname, "emptyHtml.html")
    .replace(/\\/g, "/");

  // 缓存
  const avatarCache = new Map<string, string>();
  let iconCache: AssetData[] = [];
  let barBgImgCache: AssetData[] = [];

  // 确保目录存在
  await fs.mkdir(messageCounterIconsPath, { recursive: true });
  await fs.mkdir(messageCounterBarBgImgsPath, { recursive: true });

  // --- 缓存加载函数 ---
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

  const reloadIconCache = async () => {
    iconCache = await loadAssetsFromFolder(messageCounterIconsPath);
    logger.info(`Reloaded ${iconCache.length} user icons.`);
  };

  const reloadBarBgImgCache = async () => {
    barBgImgCache = await loadAssetsFromFolder(messageCounterBarBgImgsPath);
    logger.info(`Reloaded ${barBgImgCache.length} bar background images.`);
  };

  // 启动时加载缓存
  ctx.on("ready", async () => {
    await reloadIconCache();
    await reloadBarBgImgCache();
  });

  // --- 数据库表定义 ---
  ctx.model.extend(
    "message_counter_records",
    {
      id: "unsigned",
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
    { primary: "id", autoInc: true }
  );

  // 限定在群组中
  const guildCtx = ctx.guild();

  // --- 核心消息监听器 ---
  guildCtx.on("message", async (session) => {
    // 忽略无效会话或机器人自身消息
    if (!session.userId || !session.channelId || session.author?.isBot) return;

    const { userId, channelId, author, guildId } = session;
    let sessionChannelName = session.event.channel.name;
    const username = author?.name || author?.nick || userId;
    const userAvatar = author?.avatar;

    try {
      const channelName =
        sessionChannelName ||
        (guildId ? await getGuildName(session.bot, guildId) : channelId);

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
    } catch (error) {
      logger.error(
        "Failed to update message count for user %s in channel %s:",
        userId,
        channelId,
        error
      );
    }
  });

  // 统计机器人自身消息
  if (config.isBotMessageTrackingEnabled) {
    ctx.before("send", async (session) => {
      if (!session.channelId || !session.guildId) return;

      const { channelId, bot, guildId } = session;
      let sessionChannelName = session.event.channel.name;
      const botUser = bot.user;
      if (!botUser) {
        logger.warn("Bot user is undefined, skipping bot message tracking.");
        return;
      }

      try {
        const channelName =
          sessionChannelName || (await getGuildName(bot, guildId)) || channelId;

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
  ctx
    .command("messageCounter", "查看messageCounter帮助")
    .action(({ session }) => session?.execute(`help ${name}`));

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
    .option("yesterday", "-yd 昨日发言")
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
      // 初始化所有选项为 false
      const selectedOptions = {
        day: false,
        week: false,
        month: false,
        year: false,
        total: false,
        yesterday: false,
        across: false,
        dag: false,
        wag: false,
        mag: false,
        yag: false,
        ydag: false,
      };

      // 检查用户选择的选项，如果存在则将其设置为 true
      if (options?.day) {
        selectedOptions.day = true;
      }
      if (options?.week) {
        selectedOptions.week = true;
      }
      if (options?.month) {
        selectedOptions.month = true;
      }
      if (options?.year) {
        selectedOptions.year = true;
      }
      if (options?.total) {
        selectedOptions.total = true;
      }
      if (options?.yesterday) {
        selectedOptions.yesterday = true;
      }
      if (options?.across) {
        selectedOptions.across = true;
      }
      if (options?.dag) {
        selectedOptions.dag = true;
      }
      if (options?.wag) {
        selectedOptions.wag = true;
      }
      if (options?.mag) {
        selectedOptions.mag = true;
      }
      if (options?.yag) {
        selectedOptions.yag = true;
      }
      if (options?.ydag) {
        selectedOptions.ydag = true;
      }

      // 如果没有选项被选择，则将所有选项设置为 true
      const allOptionsSelected = Object.values(selectedOptions).every(
        (value) => value === false
      );
      if (allOptionsSelected) {
        (
          Object.keys(selectedOptions) as Array<keyof typeof selectedOptions>
        ).forEach((key) => {
          selectedOptions[key] = true;
        });
      }

      const {
        day,
        week,
        month,
        year,
        total,
        across,
        dag,
        yesterday,
        wag,
        yag,
        mag,
        ydag,
      } = selectedOptions;
      // selectedOptions 对象包含了用户选择的选项

      // 查询： 直接获取 返回提示 跨群总榜
      let channelId = session?.channelId;
      let userId = session?.userId;
      let username = session?.user?.name || "";
      let targetUserRecord: MessageCounterRecord[] = [];
      const originalUerId = userId;
      if (targetUser) {
        if (session) {
          targetUser = await replaceAtTags(session, targetUser);
        }
        const userIdRegex = /<at id="([^"]+)"(?: name="([^"]+)")?\/>/;
        const match = targetUser.match(userIdRegex);
        userId = match?.[1] ?? userId;
        username = match?.[2] ?? username;
        if (originalUerId === userId) {
          targetUserRecord = await ctx.database.get("message_counter_records", {
            channelId,
            userId: targetUser,
          });
          if (targetUserRecord.length !== 0) {
            userId = targetUser;
          }
        } else {
          targetUserRecord = await ctx.database.get("message_counter_records", {
            channelId,
            userId,
          });
        }
      } else {
        targetUserRecord = await ctx.database.get("message_counter_records", {
          channelId,
          userId,
        });
      }

      if (targetUserRecord.length === 0) {
        return `被查询对象无任何发言记录。`;
      }
      const guildUsers: MessageCounterRecord[] = await ctx.database.get(
        "message_counter_records",
        { channelId }
      );
      const getDragons = await ctx.database.get("message_counter_records", {});

      const totalSums = {
        todayPostCount: 0,
        thisWeekPostCount: 0,
        thisMonthPostCount: 0,
        thisYearPostCount: 0,
        totalPostCount: 0,
        yesterdayPostCount: 0,
      };

      const acrossTotalSums = {
        todayPostCount: 0,
        thisWeekPostCount: 0,
        thisMonthPostCount: 0,
        thisYearPostCount: 0,
        totalPostCount: 0,
        yesterdayPostCount: 0,
      };

      interface Sums {
        todayPostCount: number;
        thisWeekPostCount: number;
        thisMonthPostCount: number;
        thisYearPostCount: number;
        totalPostCount: number;
        yesterdayPostCount: number;
      }

      interface User {
        todayPostCount: number;
        thisWeekPostCount: number;
        thisMonthPostCount: number;
        thisYearPostCount: number;
        totalPostCount: number;
        yesterdayPostCount: number;
      }

      const accumulateSums = (sums: Sums, user: User): void => {
        sums.todayPostCount += user.todayPostCount;
        sums.thisWeekPostCount += user.thisWeekPostCount;
        sums.thisMonthPostCount += user.thisMonthPostCount;
        sums.thisYearPostCount += user.thisYearPostCount;
        sums.totalPostCount += user.totalPostCount;
        sums.yesterdayPostCount += user.yesterdayPostCount;
      };

      guildUsers.forEach((user) => accumulateSums(totalSums, user));
      getDragons.forEach((user) => accumulateSums(acrossTotalSums, user));
      // 获取 userId 对应对象的各种种类的排名数据
      const getUserRanking = (userId: string) => {
        const userRecords = guildUsers.find((user) => user.userId === userId);
        if (userRecords) {
          return {
            todayRank: getRank("todayPostCount", userId),
            thisWeekRank: getRank("thisWeekPostCount", userId),
            thisMonthRank: getRank("thisMonthPostCount", userId),
            thisYearRank: getRank("thisYearPostCount", userId),
            totalRank: getRank("totalPostCount", userId),
            yesterdayRank: getRank("yesterdayPostCount", userId),
          };
        } else {
          return null; // 如果找不到对应 userId 的记录，返回 null 或者其他适当的值
        }
      };

      // 获取指定属性的排名
      const getRank = (
        property: keyof MessageCounterRecord,
        userId: string
      ) => {
        const sortedUsers = guildUsers
          .slice()
          .sort((a, b) => (b[property] as number) - (a[property] as number));

        const userIndex = sortedUsers.findIndex(
          (user) => user.userId === userId
        );
        return userIndex !== -1 ? userIndex + 1 : null; // 如果找不到对应 userId 的记录，返回 null 或者其他适当的值
      };

      // 使用方法获取 userId 对应对象的各种种类的排名数据
      if (!userId) {
        return "无法获取用户ID，无法查询排名。";
      }
      const userRankingData = getUserRanking(userId);

      const {
        todayRank,
        thisWeekRank,
        thisMonthRank,
        thisYearRank,
        totalRank,
        yesterdayRank,
      } = userRankingData || {};

      function getAcrossUserRank(
        userId: string,
        dragons: [string, number][]
      ): number {
        const userIndex = dragons.findIndex(([id, _]) => id === userId);
        if (userIndex !== -1) {
          // 用户在 dragons 中的排名为索引加1
          return userIndex + 1;
        } else {
          // 如果用户不在 dragons 中，返回一个特定值（比如-1）表示未上榜
          return -1;
        }
      }

      // 跨群发言总次数和排名信息
      const dragons = getSortedDragons(getDragons);
      const acrossRank = getAcrossUserRank(userId, dragons);

      const userRecords: MessageCounterRecord[] = await ctx.database.get(
        "message_counter_records",
        { userId }
      );

      // 使用 reduce 方法计算跨群总发言次数
      const totalPostCountAcrossGuilds = userRecords.reduce((total, record) => {
        return total + record.totalPostCount;
      }, 0);

      const {
        todayPostCount,
        thisWeekPostCount,
        thisMonthPostCount,
        thisYearPostCount,
        totalPostCount,
        yesterdayPostCount,
      } = targetUserRecord[0];

      let message = config.isTextToImageConversionEnabled
        ? `# 查询对象：${targetUserRecord[0].username}\n\n`
        : `查询对象：${targetUserRecord[0].username}\n\n`;
      if (config.isTimeInfoSupplementEnabled) {
        const currentBeijingTime = getCurrentBeijingTime();
        message = config.isTextToImageConversionEnabled
          ? `# ${currentBeijingTime}\n${message}`
          : `${currentBeijingTime}\n${message}`;
      }
      if (yesterday) {
        message += `${
          config.isTextToImageConversionEnabled ? "## " : ""
        }本群昨日发言次数[排名]：${yesterdayPostCount} 次${
          config.isUserMessagePercentageVisible
            ? ` ${calculatePercentage(
                yesterdayPostCount,
                totalSums.yesterdayPostCount
              )}`
            : ""
        }[${yesterdayRank}]\n`;
      }
      if (day) {
        message += `${
          config.isTextToImageConversionEnabled ? "## " : ""
        }本群今日发言次数[排名]：${todayPostCount} 次${
          config.isUserMessagePercentageVisible
            ? ` ${calculatePercentage(
                todayPostCount,
                totalSums.todayPostCount
              )}`
            : ""
        }[${todayRank}]\n`;
      }
      if (week) {
        message += `${
          config.isTextToImageConversionEnabled ? "## " : ""
        }本群本周发言次数[排名]：${thisWeekPostCount} 次${
          config.isUserMessagePercentageVisible
            ? ` ${calculatePercentage(
                thisWeekPostCount,
                totalSums.thisWeekPostCount
              )}`
            : ""
        }[${thisWeekRank}]\n`;
      }
      if (month) {
        message += `${
          config.isTextToImageConversionEnabled ? "## " : ""
        }本群本月发言次数[排名]：${thisMonthPostCount} 次${
          config.isUserMessagePercentageVisible
            ? ` ${calculatePercentage(
                thisMonthPostCount,
                totalSums.thisMonthPostCount
              )}`
            : ""
        }[${thisMonthRank}]\n`;
      }
      if (year) {
        message += `${
          config.isTextToImageConversionEnabled ? "## " : ""
        }本群今年发言次数[排名]：${thisYearPostCount} 次${
          config.isUserMessagePercentageVisible
            ? ` ${calculatePercentage(
                thisYearPostCount,
                totalSums.thisYearPostCount
              )}`
            : ""
        }[${thisYearRank}]\n`;
      }
      if (total) {
        message += `${
          config.isTextToImageConversionEnabled ? "## " : ""
        }本群总发言次数[排名]：${totalPostCount} 次${
          config.isUserMessagePercentageVisible
            ? ` ${calculatePercentage(
                totalPostCount,
                totalSums.totalPostCount
              )}`
            : ""
        }[${totalRank}]\n`;
      }
      if (ydag) {
        const ydagResult = getUserRankAndRecord(
          getDragons,
          userId,
          "yesterdayPostCount"
        );
        if (ydagResult) {
          const ydagUserRecord = ydagResult.userRecord;
          const ydagRank = ydagResult.acrossRank;
          message += `${
            config.isTextToImageConversionEnabled ? "## " : ""
          }跨群昨日发言次数[排名]：${ydagUserRecord.postCountAll} 次${
            config.isUserMessagePercentageVisible
              ? ` ${calculatePercentage(
                  ydagUserRecord.postCountAll,
                  acrossTotalSums.yesterdayPostCount
                )}`
              : ""
          }[${ydagRank}]\n`;
        }
      }
      if (dag) {
        const dagResult = getUserRankAndRecord(
          getDragons,
          userId,
          "todayPostCount"
        );
        if (dagResult) {
          const dagUserRecord = dagResult.userRecord;
          const dagRank = dagResult.acrossRank;
          message += `${
            config.isTextToImageConversionEnabled ? "## " : ""
          }跨群今日发言次数[排名]：${dagUserRecord.postCountAll} 次${
            config.isUserMessagePercentageVisible
              ? ` ${calculatePercentage(
                  dagUserRecord.postCountAll,
                  acrossTotalSums.todayPostCount
                )}`
              : ""
          }[${dagRank}]\n`;
        }
      }
      if (wag) {
        const wagResult = getUserRankAndRecord(
          getDragons,
          userId,
          "thisWeekPostCount"
        );
        if (wagResult) {
          const wagUserRecord = wagResult.userRecord;
          const wagRank = wagResult.acrossRank;
          message += `${
            config.isTextToImageConversionEnabled ? "## " : ""
          }跨群本周发言次数[排名]：${wagUserRecord.postCountAll} 次${
            config.isUserMessagePercentageVisible
              ? ` ${calculatePercentage(
                  wagUserRecord.postCountAll,
                  acrossTotalSums.thisWeekPostCount
                )}`
              : ""
          }[${wagRank}]\n`;
        }
      }
      if (mag) {
        const magResult = getUserRankAndRecord(
          getDragons,
          userId,
          "thisMonthPostCount"
        );
        if (magResult) {
          const magUserRecord = magResult.userRecord;
          const magRank = magResult.acrossRank;
          message += `${
            config.isTextToImageConversionEnabled ? "## " : ""
          }跨群本月发言次数[排名]：${magUserRecord.postCountAll} 次${
            config.isUserMessagePercentageVisible
              ? ` ${calculatePercentage(
                  magUserRecord.postCountAll,
                  acrossTotalSums.thisMonthPostCount
                )}`
              : ""
          }[${magRank}]\n`;
        }
      }
      if (yag) {
        const yagResult = getUserRankAndRecord(
          getDragons,
          userId,
          "thisYearPostCount"
        );
        if (yagResult) {
          const yagUserRecord = yagResult.userRecord;
          const yagRank = yagResult.acrossRank;
          message += `${
            config.isTextToImageConversionEnabled ? "## " : ""
          }跨群本年发言次数[排名]：${yagUserRecord.postCountAll} 次${
            config.isUserMessagePercentageVisible
              ? ` ${calculatePercentage(
                  yagUserRecord.postCountAll,
                  acrossTotalSums.thisYearPostCount
                )}`
              : ""
          }[${yagRank}]\n`;
        }
      }
      if (across) {
        message += `${
          config.isTextToImageConversionEnabled ? "## " : ""
        }跨群总发言次数[排名]：${totalPostCountAcrossGuilds} 次${
          config.isUserMessagePercentageVisible
            ? ` ${calculatePercentage(
                totalPostCountAcrossGuilds,
                acrossTotalSums.totalPostCount
              )}`
            : ""
        }[${acrossRank}]\n`;
      }

      if (config.isTextToImageConversionEnabled) {
        const imageBuffer = await ctx.markdownToImage.convertToImage(message);
        return h.image(imageBuffer, `image/${config.imageType}`);
      }
      // 返回消息
      return message;
    });

  // 排行榜指令
  ctx
    .command("messageCounter.排行榜 [limit:number]", "用户发言排行榜")
    .userFields(["id", "name"])
    .option("whites", "<users:text> 白名单，用空格、逗号等分隔")
    .option("blacks", "<users:text> 黑名单，用空格、逗号等分隔")
    .option("yesterday", "-yd")
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
      const isAcross = isAcrossGuild(options);

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
    .option("yesterday", "-yd")
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

        const userRecords = await ctx.database.get("user", { id: userId });
        const username =
          userRecords.length > 0
            ? userRecords[0].name || `用户${userId}`
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

  // 上传柱状条背景
  ctx
    .command(
      "messageCounter.上传柱状条背景",
      "为样式3上传自定义的水平柱状条背景图"
    )
    .action(async ({ session }) => {
      if (!session || !session.content) {
        return "请在发送指令的同时附带一张图片。图片将用于排行榜样式3的柱状条背景。";
      }
      const imageElements = h.select(session.content ?? "", "img");
      if (imageElements.length === 0) {
        return "请在发送指令的同时附带一张图片。图片将用于排行榜样式3的柱状条背景。";
      }

      const imageUrl = imageElements[0].attrs.src;
      if (!imageUrl) {
        return "未能识别图片，请再试一次。";
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(
          await ctx.http.get(imageUrl, { responseType: "arraybuffer" })
        );
      } catch (error) {
        logger.error(
          "Failed to download user-uploaded background image:",
          error
        );
        return "图片下载失败，请检查图片链接或稍后再试。";
      }

      // 检查文件大小
      const imageSizeInMB = buffer.byteLength / 1024 / 1024;
      if (config.maxBarBgSize > 0 && imageSizeInMB > config.maxBarBgSize) {
        return `图片文件过大（${imageSizeInMB.toFixed(2)}MB），请上传小于 ${
          config.maxBarBgSize
        }MB 的图片。`;
      }

      // 检查图片尺寸 (需要 canvas 服务)
      if (!ctx.canvas) {
        logger.warn(
          "Canvas service not available, skipping image dimension check for background upload."
        );
      } else {
        try {
          const image = await ctx.canvas.loadImage(buffer);
          if (
            (config.maxBarBgWidth > 0 &&
              image.naturalWidth > config.maxBarBgWidth) ||
            (config.maxBarBgHeight > 0 &&
              image.naturalHeight > config.maxBarBgHeight)
          ) {
            return `图片尺寸（${image.naturalWidth}x${image.naturalHeight}）超出限制（最大 ${config.maxBarBgWidth}x${config.maxBarBgHeight}）。\n建议尺寸为 850x50 像素。`;
          }
        } catch (error) {
          logger.error("Failed to read image dimensions:", error);
          return "无法解析图片尺寸，请尝试使用其他图片格式。";
        }
      }

      if (!session) {
        return "无法获取会话信息，请重试。";
      }
      const userId = session.userId;

      try {
        const files = await fs.readdir(messageCounterBarBgImgsPath);
        const allUserFiles = files.filter(
          (file) => path.parse(file).name.split("-")[0] === userId
        );
        const currentCount = allUserFiles.length;

        const userFilesWithIndex = files.filter((file) =>
          file.match(new RegExp(`^${userId}-(\\d+)\\..+`))
        );
        const indices = userFilesWithIndex.map((file) => {
          const match = file.match(new RegExp(`^${userId}-(\\d+)\\..+`));
          return match ? parseInt(match[1]) : 0;
        });

        const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;

        // 为便于管理，统一保存为 png 格式
        const newFileName = `${userId}-${nextIndex}.png`;
        const newFilePath = path.join(messageCounterBarBgImgsPath, newFileName);

        await fs.writeFile(newFilePath, buffer);

        await reloadBarBgImgCache();

        return `背景图上传成功！这是您的第 ${
          currentCount + 1
        } 张背景图（将随机使用）。\n建议图片尺寸为 850x50 像素。`;
      } catch (error) {
        logger.error("Failed to save user-uploaded background image:", error);
        return "图片保存失败，请联系管理员。";
      }
    });

  // 删除柱状条背景
  ctx
    .command(
      "messageCounter.删除柱状条背景 [target:text]",
      "删除自己上传的柱状条背景图"
    )
    .action(async ({ session }, target) => {
      if (!session) {
        return "无法获取会话信息，请重试。";
      }
      const userId = session.userId;

      // 查找用户的背景图片文件
      let allFiles;
      try {
        allFiles = await fs.readdir(messageCounterBarBgImgsPath);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as any).code === "ENOENT"
        ) {
          // 目录不存在
          return "您还没有上传过任何背景图片。";
        }
        logger.error("读取背景图片目录失败:", error);
        return "读取背景图片时出错，请联系管理员。";
      }

      const userFiles = allFiles.filter(
        (file) => path.parse(file).name.split("-")[0] === userId
      );

      if (userFiles.length === 0) {
        return "您没有上传任何背景图片。";
      }

      // 如果未指定目标，则列出可供删除的图片
      if (!target) {
        const fileList = userFiles
          .map((file) => {
            const match = file.match(new RegExp(`^${userId}-(\\d+)\\..+`));
            return match ? `编号 ${match[1]}` : file; // 显示索引号
          })
          .join("\n");
        return `您已上传的背景图：\n${fileList}\n\n请使用“删除柱状条背景 <编号>”来删除指定图片，或使用“删除柱状条背景 all”删除所有图片。`;
      }

      // 处理 'all' 目标
      if (target.toLowerCase() === "all") {
        try {
          await Promise.all(
            userFiles.map((file) =>
              fs.unlink(path.join(messageCounterBarBgImgsPath, file))
            )
          );
          await reloadBarBgImgCache();
          return `已成功删除您的全部 ${userFiles.length} 张背景图片。`;
        } catch (error) {
          logger.error(`为用户 ${userId} 删除所有背景图片失败:`, error);
          return "删除图片时发生错误，请联系管理员。";
        }
      }

      // 处理指定索引的目标
      const indexToDelete = parseInt(target, 10);
      if (isNaN(indexToDelete)) {
        return "请输入有效的图片编号或“all”。";
      }

      const fileToDelete = userFiles.find((file) => {
        const match = file.match(new RegExp(`^${userId}-(\\d+)\\..+`));
        return match && parseInt(match[1]) === indexToDelete;
      });

      if (!fileToDelete) {
        return `未找到编号为 ${indexToDelete} 的背景图片。`;
      }

      try {
        await fs.unlink(path.join(messageCounterBarBgImgsPath, fileToDelete));
        return `已成功删除编号为 ${indexToDelete} 的背景图片。`;
      } catch (error) {
        logger.error(
          `为用户 ${userId} 删除背景图片 ${fileToDelete} 失败:`,
          error
        );
        return "删除图片时发生错误，请联系管理员。";
      }
    });

  // 重载资源
  ctx
    .command("messageCounter.重载资源", "重载图标和背景资源", { authority: 2 })
    .action(async ({ session }) => {
      if (!session) return;

      await session.send("正在重新加载用户图标和背景图片缓存...");

      await reloadIconCache();
      await reloadBarBgImgCache();

      return `资源重载完毕！\n- 已加载 ${iconCache.length} 个用户图标。\n- 已加载 ${barBgImgCache.length} 个柱状条背景图片。`;
    });

  // --- 定时任务与重置逻辑 ---
  const scheduledJobs: schedule.Job[] = [];

  async function resetCounter(field: CountField, message: string) {
    if (
      field === "todayPostCount" &&
      !config.isYesterdayCommentRankingDisabled
    ) {
      logger.info("Updating yesterday's post count...");
      // 批量更新昨日发言数
      const allRecords = await ctx.database.get("message_counter_records", {});
      const updates = allRecords.map((user) =>
        ctx.database.set(
          "message_counter_records",
          { id: user.id },
          { yesterdayPostCount: user.todayPostCount }
        )
      );
      await Promise.all(updates);
      logger.success("Finished updating yesterday's post count.");
    }

    await ctx.database.set("message_counter_records", {}, { [field]: 0 });
    logger.success(message);
  }

  // 创建定时任务
  const jobs: { cron: string; field: CountField; message: string }[] = [
    {
      cron: "0 0 * * *",
      field: "todayPostCount",
      message: "今日发言榜已成功置空！",
    },
    {
      cron: "0 0 * * 1",
      field: "thisWeekPostCount",
      message: "本周发言榜已成功置空！",
    },
    {
      cron: "0 0 1 * *",
      field: "thisMonthPostCount",
      message: "本月发言榜已成功置空！",
    },
    {
      cron: "0 0 1 1 *",
      field: "thisYearPostCount",
      message: "今年发言榜已成功置空！",
    },
  ];

  jobs.forEach(({ cron, field, message }) => {
    const job = schedule.scheduleJob(cron, () => resetCounter(field, message));
    scheduledJobs.push(job);
  });

  // --- 资源清理 ---
  ctx.on("dispose", () => {
    scheduledJobs.forEach((job) => job.cancel());
    avatarCache.clear();
    iconCache = [];
    barBgImgCache = [];
    logger.info("All scheduled jobs and caches have been cleared.");
  });

  // --- 辅助函数 ---
  // hs*

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

    if (currentChannelId && !isCurrentInTop) {
      const currentChannelData = sortedChannels.find(
        ([channelId]) => channelId === currentChannelId
      );
      if (currentChannelData) {
        topChannels.push(currentChannelData);
      }
    }

    return topChannels.map(([channelId, count]) => ({
      name: channelInfo[channelId]?.channelName || `群聊${channelId}`,
      // 使用 channelId 作为 RankingData 的 userId 和头像源
      userId: channelId,
      avatar: `https://p.qlogo.cn/gh/${
        channelId === "#" ? "426230045" : channelId
      }/${channelId === "#" ? "426230045" : channelId}/100`, // QQ群头像URL格式
      count,
      percentage: calculatePercentage(count, totalCount),
    }));
  }

  async function updateDataWithBase64(data: RankingData[]) {
    await Promise.all(
      data.map(async (item) => {
        item.avatarBase64 = await resizeImageToBase64(ctx, item.avatar);
      })
    );
  }

  // --- 辅助函数：图表生成 ---

  /**
   * 生成图表的静态 CSS 样式。
   * @returns 包含 @font-face 和基本元素样式的 CSS 字符串。
   */
  function _getChartStyles(): string {
    return `
      @font-face {
        font-family: 'JMH';
        src: local('JMH'), url('./assets/fonts/JMH.woff2') format('woff2');
      }
      @font-face {
        font-family: 'SJkaishu';
        src: local('SJkaishu'), url('./assets/fonts/SJkaishu.woff2') format('woff2');
      }
      @font-face {
        font-family: 'SJbangkaijianti';
        src: local('SJbangkaijianti'), url('./assets/fonts/SJbangkaijianti-Regular.woff2') format('woff2');
      }

      body {
        font-family: 'JMH', 'SJbangkaijianti', 'SJkaishu';
        margin: 0;
        padding: 20px;
      }
      
      .ranking-title {
        text-align: center;
        margin-bottom: 20px;
        color: #333;
        font-family: 'JMH'; 
        font-weight: normal; 
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
   * 修复了 responseType 配置项未被使用的问题。
   * @param config 插件配置对象。
   * @returns 一个包含 body 背景样式的 CSS 字符串。
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

        return `body {
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

    // 默认或失败时的回退背景
    return `body {
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
          const tableWidth = 950; // 固定宽度
          const canvasHeight = 50 * userNum;

          const canvas = document.getElementById('rankingCanvas');
          let context = canvas.getContext('2d');
          
          // 根据最大计数的文本宽度动态调整画布宽度，以防数字溢出
          context.font = "30px JMH, SJbangkaijianti, SJkaishu";
          const maxCountTextWidth = context.measureText(maxCount.toString()).width;
          canvas.width = tableWidth + maxCountTextWidth + 50; // 增加一些边距
          canvas.height = canvasHeight;

          // 重新获取上下文，因为尺寸变化会重置状态
          context = canvas.getContext('2d');

          // 按顺序绘制图层
          await drawRankingBars(context, maxCount, userAvatarSize, tableWidth);
          await drawAvatars(context, userAvatarSize);
          drawVerticalLines(context, canvas.height, tableWidth);
        }

        // --- 核心绘图逻辑 ---

        async function drawRankingBars(context, maxCount, userAvatarSize, tableWidth) {
          for (const [index, data] of rankingData.entries()) {
            const countBarWidth = 150 + (700 * data.count) / maxCount;
            const countBarX = 50;
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
              avgColor = await drawCustomBarBackground(context, randomBarBgImgBase64, countBarX, countBarY, countBarWidth, userAvatarSize, tableWidth);
            }
            
            // 绘制剩余部分灰色背景
            context.fillStyle = colorWithOpacity;
            context.fillRect(countBarX + countBarWidth, countBarY, tableWidth - (countBarX + countBarWidth), userAvatarSize);
            
            // 绘制文本和图标
            drawTextAndIcons(context, data, index, avgColor, countBarX, countBarY, countBarWidth, userAvatarSize);
          }
        }
        
        async function drawCustomBarBackground(context, base64, x, y, barWidth, barHeight, tableWidth) {
            return new Promise(async (resolve) => {
                const barBgImg = new Image();
                barBgImg.src = "data:image/png;base64," + base64;
                barBgImg.onload = async () => {
                    context.save();
                    // 绘制整行背景（如果透明度 > 0）
                    if (config.horizontalBarBackgroundFullOpacity > 0) {
                        context.globalAlpha = config.horizontalBarBackgroundFullOpacity;
                        context.drawImage(barBgImg, x, y, tableWidth - x, barHeight);
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

        function drawTextAndIcons(context, data, index, avgColor, barX, barY, barWidth, barHeight) {
            context.font = "30px JMH, SJbangkaijianti, SJkaishu";
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
            
            // 检查文字是否会超出画布，如果会，则移入柱状条内并改变颜色
            if (countTextX + countTextWidth > context.canvas.width - 5) {
                context.fillStyle = chooseTextColor(avgColor);
                context.textAlign = "right";
                context.fillText(countText, barX + barWidth - 10, textY);
            } else {
                context.fillStyle = "rgba(0, 0, 0, 1)";
                context.textAlign = "left";
                context.fillText(countText, countTextX, textY);
            }

            // 绘制用户名（带截断）
            context.fillStyle = chooseTextColor(avgColor);
            context.font = "30px SJbangkaijianti, JMH, SJkaishu";
            context.textAlign = "left";

            let nameText = data.name;
            const maxNameWidth = barWidth - 60; // 留出空间给头像和边距
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
                drawUserIcons(context, userIcons, {
                    nameText: data.name, // 传递原始nameText用于计算位置
                    nameTextX: context.measureText(nameText).width + nameTextX, 
                    barX: barX,
                    barWidth: barWidth,
                    textY: textY
                });
            }
        }
        
        function drawUserIcons(context, icons, positions) {
            const { nameText, nameTextX, barX, barWidth, textY } = positions;
            icons.forEach((iconBase64, i) => {
                const icon = new Image();
                icon.src = "data:image/png;base64," + iconBase64;
                icon.onload = () => {
                    const iconSize = 40;
                    const iconY = textY - 30;
                    let iconX;
                    if (config.shouldMoveIconToBarEndLeft) {
                        iconX = barX + barWidth - (iconSize * (i + 1));
                    } else {
                        iconX = nameTextX + (iconSize * i) + 5;
                    }
                    context.drawImage(icon, iconX, iconY, iconSize, iconSize);
                };
            });
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

        function chooseTextColor(hexcolor) {
            const { r, g, b } = hexToRgb(hexcolor);
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            return (yiq >= 128) ? '#000000' : '#FFFFFF';
        }

        function hexToRgb(hex) {
            const bigint = parseInt(String(hex).replace("#", ""), 16);
            return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
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
    chartConfig: any;
  }): string {
    const {
      rankTimeTitle,
      rankTitle,
      data,
      iconCache,
      barBgImgCache,
      backgroundStyle,
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
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>排行榜</title>
          <style>${_getChartStyles()}</style>
          <style>${backgroundStyle}</style>
      </head>
      <body>
          <h1 class="ranking-title">${rankTimeTitle}</h1>
          <h1 class="ranking-title">${rankTitle}</h1>
          <div class="font-preload">
            <span style="font-family: 'SJkaishu';">预加载</span>
            <span style="font-family: 'SJbangkaijianti';">预加载</span>
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
   * @param context 包含图标和背景缓存的对象。
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
      emptyHtmlPath,
    }: {
      iconCache: AssetData[];
      barBgImgCache: AssetData[];
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
      const backgroundStyle = await _prepareBackgroundStyle(config);

      const chartConfigForClient = {
        shouldMoveIconToBarEndLeft: config.shouldMoveIconToBarEndLeft,
        horizontalBarBackgroundOpacity: config.horizontalBarBackgroundOpacity,
        horizontalBarBackgroundFullOpacity:
          config.horizontalBarBackgroundFullOpacity,
        isUserMessagePercentageVisible: config.isUserMessagePercentageVisible,
      };

      const htmlContent = _getChartHtmlContent({
        rankTimeTitle,
        rankTitle,
        data,
        iconCache,
        barBgImgCache,
        backgroundStyle,
        chartConfig: chartConfigForClient,
      });

      await page.goto(`file://${emptyHtmlPath}`);
      await page.setViewport({
        width: 1080,
        height: 256,
        deviceScaleFactor: 1,
      });
      await page.setContent(h.unescape(htmlContent), {
        waitUntil: config.waitUntil,
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
            typeof session.bot?.getGuildMember === "function" &&
            session.guildId
          ) {
            const guildMember = await session.bot.getGuildMember(
              session.guildId,
              userId
            );
            if (guildMember && guildMember.user && guildMember.user.name) {
              userName = guildMember.user.name;
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

  async function getGuildName(
    bot: Bot,
    guildId: string
  ): Promise<string | undefined> {
    try {
      const guild = await bot.getGuild(guildId);
      return guild?.name;
    } catch (error) {
      logger.warn(`Failed to get guild name for ${guildId}:`, error);
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

  function isAcrossGuild(options: any): boolean {
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

    if (requesterId && !isRequesterInTop) {
      const requesterData = sortedUsers.find(
        ([userId]) => userId === requesterId
      );
      if (requesterData) {
        topUsers.push(requesterData);
      }
    }

    return topUsers.map(([userId, count]) => ({
      name: userInfo[userId].username,
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
          // 在生成图表前，填充头像的 base64 缓存
          await Promise.all(
            rankingData.map(async (item) => {
              if (!avatarCache.has(item.avatar)) {
                const base64 = await resizeImageToBase64(ctx, item.avatar);
                avatarCache.set(item.avatar, base64);
              }
              item.avatarBase64 = avatarCache.get(item.avatar);
            })
          );
          // 调用唯一的柱状图生成函数
          const imageBuffer = await generateRankingChart(
            { rankTimeTitle, rankTitle, data: rankingData },
            { iconCache, barBgImgCache, emptyHtmlPath }
          );
          return h.image(imageBuffer, `image/${config.imageType}`);
        } catch (error) {
          logger.error("Failed to generate leaderboard chart:", error);
          // 发生错误时，降级为 Markdown 图片或纯文本
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
      result += `${index + 1}. **${item.name}**: ${
        item.count
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
      result += `${index + 1}. ${item.name}：${
        item.count
      } 次${percentageStr}\n`;
    });
    return result.trim();
  }

  async function resizeImageToBase64(
    ctx: Context,
    url: string
  ): Promise<string> {
    if (!ctx.canvas) {
      throw new Error("Canvas service is not available for image processing.");
    }
    const MAX_RETRIES = 2;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const buffer = await ctx.http.get(url, {
          responseType: "arraybuffer",
          timeout: 5000,
        });
        const image = await ctx.canvas.loadImage(buffer);
        const canvas = await ctx.canvas.createCanvas(50, 50);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, 50, 50);
        return (await canvas.toBuffer("image/png")).toString("base64");
      } catch (error) {
        logger.warn(
          `Failed to process image from ${url} (attempt ${i + 1}):`,
          error
        );
        if (i === MAX_RETRIES - 1) {
          // 如果是最后一次尝试，返回一个备用或占位图
          logger.error(`Giving up on image ${url}. Using fallback.`);
          // 返回一个 1x1 的透明像素
          return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        }
        await sleep(500);
      }
    }
    // 理论上不会执行到这里
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  }
}
