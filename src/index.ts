import {Context, h, Logger, Schema, sleep, noop} from 'koishi'

import schedule from 'node-schedule';
import {} from 'koishi-plugin-markdown-to-image-service'
import {} from 'koishi-plugin-puppeteer'
import path from "path";
import {} from '@koishijs/canvas'
import * as fs from 'fs';


export const name = 'message-counter'
export const inject = {
  required: ['database'],
  optional: ['markdownToImage', 'puppeteer', 'canvas'],
}
export const usage = `## 🎮 使用指南

### 基本使用

- 插件仅统计群聊消息，私聊消息不会被记录 🙈。
- 建议为插件指令设置别名，方便用户快速查询 🚀。

### 高级功能：自定义水平柱状图

水平柱状图样式 3 支持强大的自定义功能，让你的排行榜更加个性化！🎨

* **自定义用户图标**:
  - 在 \`data/messageCounterIcons\` 文件夹下添加用户图标，文件名为用户 ID (例如 \`1234567890.png\`)。
  - 支持为同一用户添加多个图标，它们会同时显示。多个图标的文件名需形如  \`1234567890-1.png\`、 \`1234567890-2.png\` 。
* **自定义水平柱状条背景**:
  - 在 \`data/messageCounterBarBgImgs\` 文件夹下添加水平柱状条背景图片，建议图片尺寸为 850*50 像素，文件名为用户 ID (例如
    \`1234567890.png\`)。
  - 支持为同一用户添加多个背景图片，插件会随机选择一个显示。多个图片的文件名需形如 \`1234567890-1.png\`、\`1234567890-2.png\`。

> 添加完图片后，记得重启插件以使更改生效！ 🔄

## 📝 命令

### messageCounter

- \`messageCounter\`: 查看 messageCounter 插件帮助 ❓。
- \`messageCounter.初始化\`: 初始化插件，清空数据表，将插件还原至初始状态，需要权限等级 3 级及以上 🙏。
- \`messageCounter.查询 [targetUser]\`: 查询指定用户的发言次数信息（次数[排名]）🔍。

  - \`--yesterday\`/\`-d\`/\`-w\`/\`-m\`/\`-y\`/\`-t\`: 分别查询昨日/今日/本周/本月/今年/总发言次数[排名] 🗓️。
  - \`--ydag\`/\`--dag\`/\`--wag\`/\`--mag\`/\`--yag\`/\`-a\`: 分别查询跨群昨日/今日/本周/本月/今年/总发言次数[排名] 🌎。


- \`messageCounter.排行榜 [number]\`: 发言排行榜，可以指定显示的人数，也可以使用以下选项来指定排行榜的类型 🏆：

  - \`--whites\`: 白名单，只显示白名单用户，可用空格、中英文逗号和顿号作为分隔符 👼。
  - \`--blacks\`: 黑名单，不显示黑名单用户，可用空格、中英文逗号和顿号作为分隔符 👿。
  - \`--yesterday\`/\`-d\`/\`-w\`/\`-m\`/\`-y\`/\`-t\`:  分别查询昨日/今日/本周/本月/今年/总发言排行榜 🗓️。
  - \`--ydag\`/\`--dag\`/\`--wag\`/\`--mag\`/\`--yag\`/\`--dragon\`: 分别查询跨群昨日/今日/本周/本月/今年/总发言排行榜（圣龙王榜）
    🌎🐲。
  - 若未指定排行榜类型，则默认为今日发言榜 💬。

- \`messageCounter.群排行榜 [number:number]\`:  各个群聊的发言排行榜，可以指定显示的数量，也可以使用以下选项来指定排行榜的类型
  🏆：

  - \`-s\`: 指定用户的群发言排行榜，可用 at 或 用户 ID 指定 👤。
  - \`--whites\`: 白名单，只显示白名单群，可用空格、中英文逗号和顿号作为分隔符 👼。
  - \`--blacks\`: 黑名单，不显示黑名单群，可用空格、中英文逗号和顿号作为分隔符 👿。
  - \`-d\`/\`-w\`/\`-m\`/\`-y\`/\`-t\`/\`--yesterday\`: 分别查询昨日/今日/本周/本月/今年/总发言排行榜 🗓️。
  - 若未指定排行榜类型，则默认为今日发言榜 💬。

## 🐱 QQ 群

- 956758505`

const logger = new Logger('messageCounter')

export interface Config {
  isTimeInfoSupplementEnabled: boolean
  isUserMessagePercentageVisible: boolean
  defaultMaxDisplayCount: number
  isBotMessageTrackingEnabled: boolean
  isTextToImageConversionEnabled: boolean
  autoPush: boolean
  leaderboardGenerationWaitTime: number
  pushChannelIds: string[]
  enableMostActiveUserMuting: boolean
  dragonKingDetainmentTime: number
  muteGuildIds: string[]
  detentionDuration: number
  imageType: 'png' | 'jpeg' | 'webp'
  width: number
  isLeaderboardToHorizontalBarChartConversionEnabled: boolean
  isFirstProgressFullyVisible: boolean
  horizontalBarChartStyle: string
  maxHorizontalBarLabelLengthBeforeTruncation: number
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  shouldMoveIconToBarEndLeft: boolean
  horizontalBarBackgroundOpacity: number
  horizontalBarBackgroundFullOpacity: number
  dailyScheduledTimers: string[];
  shouldSendDailyLeaderboardAtMidnight: boolean;
  shouldSendLeaderboardNotificationsToAllChannels: boolean;
  excludedLeaderboardChannels: string[];
  delayBetweenGroupPushesInSeconds: number;
  isGeneratingRankingListPromptVisible: boolean;
  groupPushDelayRandomizationSeconds: number;
  hiddenUserIdsInLeaderboard: string[];
  hiddenChannelIdsInLeaderboard: string[];
  isYesterdayCommentRankingDisabled: boolean;
}

// pz* pzx*
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    isYesterdayCommentRankingDisabled: Schema.boolean().default(false).description('是否禁用昨日发言排行榜。开启后可用于解决群组消息过多导致的每日 0 点卡顿问题。'),
  }).description('功能设置'),
  Schema.object({
    defaultMaxDisplayCount: Schema.number()
      .min(0).default(20).description('排行榜默认显示的人数。'),
    isTimeInfoSupplementEnabled: Schema.boolean().default(true).description('是否在显示排行榜时补充时间信息。'),
    isUserMessagePercentageVisible: Schema.boolean().default(true).description('是否在排行榜中显示用户消息占比。'),
    hiddenUserIdsInLeaderboard: Schema.array(String).role('table').description('在排行榜中隐藏的用户列表。'),
    hiddenChannelIdsInLeaderboard: Schema.array(String).role('table').description('在排行榜中隐藏的频道列表。'),
  }).description('排行榜显示设置'),
  Schema.object({
    isBotMessageTrackingEnabled: Schema.boolean().default(false).description('是否统计 Bot 自己发送的消息。'),
  }).description('消息追踪设置'),
  Schema.object({
    isTextToImageConversionEnabled: Schema.boolean().default(false).description(`（可以同时开启下面的功能）是否开启将文本转为图片的功能（可选），如需启用，需要启用 \`markdownToImage\` 服务。`),
    isLeaderboardToHorizontalBarChartConversionEnabled: Schema.boolean().default(false).description('是否开启排行榜转为水平柱状图的功能（可选），如需启用，需要启用 `puppeteer` 服务。'),
    imageType: Schema.union(['png', 'jpeg', 'webp']).default('png').description(`发送的水平柱状图片类型。`),
    width: Schema.number().default(600).description('水平柱状图的图片宽度（对样式 3 无效）。'),
    isFirstProgressFullyVisible: Schema.boolean().default(true).description('横向柱状图第一名的进度条是否占满（对样式 3 无效）。'),
    maxHorizontalBarLabelLengthBeforeTruncation: Schema.number().min(1).default(6).description('水平柱状图的标签最大长度，超过该长度的标签将被截断（对样式 3 无效）。'),
    waitUntil: Schema.union(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).default('networkidle0').description('（仅样式 3）等待页面加载的事件。'),
    shouldMoveIconToBarEndLeft: Schema.boolean().default(true).description('（仅样式 3）是否将自定义图标移动到水平柱状条末端的左侧，关闭后将放在用户名的右侧。'),
    horizontalBarBackgroundOpacity: Schema.number().min(0).max(1).default(0.6).description('（仅样式 3）自定义水平柱状条背景的不透明度，值越小则越透明。'),
    horizontalBarBackgroundFullOpacity: Schema.number().min(0).max(1).default(0).description('（仅样式 3）自定义水平柱状条背景整条的不透明度，值越小则越透明。'),
    horizontalBarChartStyle: Schema.union([
      Schema.const('1').description('样式 1 (名称与柱状条不同一行)'),
      Schema.const('2').description('样式 2 (名称与柱状条同一行)'),
      Schema.const('3').description('样式 3 (默认) 理论上最好看'),
    ]).role('radio').default('3').description('水平柱状图的样式。'),
  }).description('图片转换功能设置'),
  Schema.intersect([
    Schema.object({
      autoPush: Schema.boolean().default(false).description('是否自动推送排行榜。'),
    }).description('自动推送设置'),
    Schema.union([
      Schema.object({
        autoPush: Schema.const(true).required(),
        shouldSendDailyLeaderboardAtMidnight: Schema.boolean().default(true).description('是否在每天 0 点发送排行榜。'),
        dailyScheduledTimers: Schema.array(String).role('table').description('每日定时发送用户今日发言排行榜的时间列表（中国北京时间），例如 `08:00`、`18:45`。如果开启上面的选项，则自动包含 0 点。'),
        isGeneratingRankingListPromptVisible: Schema.boolean().default(true).description('是否在生成排行榜时发送提示消息。'),
        leaderboardGenerationWaitTime: Schema.number().min(0).default(3).description(`提示消息发送后，自动生成排行榜的等待时间，单位是秒。`),
        pushChannelIds: Schema.array(String).role('table').description('启用自动推送排行榜功能的频道列表。'),
        shouldSendLeaderboardNotificationsToAllChannels: Schema.boolean().default(false).description('是否向所有频道推送排行榜。'),
        excludedLeaderboardChannels: Schema.array(String).role('table').description('不推送排行榜的频道列表。'),
        delayBetweenGroupPushesInSeconds: Schema.number().min(0).default(5).description('群组推送之间的延迟时间，单位是秒。'),
        groupPushDelayRandomizationSeconds: Schema.number().min(0).default(10).description('群组推送延迟时间的随机化范围（上下波动范围），单位是秒。'),
      }), Schema.object({}),]),
  ]),
  Schema.intersect([
    Schema.object({enableMostActiveUserMuting: Schema.boolean().default(false).description('是否禁言每天发言最多的人，即龙王。'),}).description('用户禁言设置'),
    Schema.union([
      Schema.object({
        enableMostActiveUserMuting: Schema.const(true).required(),
        dragonKingDetainmentTime: Schema.number().min(0).default(5).description(`关押龙王的等待时间，单位是秒。`),
        detentionDuration: Schema.number().default(1).description(`关押时长，单位是天。`),
        muteChannelIds: Schema.array(String).role('table').description('生效的频道。'),
      }),
      Schema.object({}),
    ]),
  ]),]) as any

declare module 'koishi' {
  interface Tables {
    message_counter_records: MessageCounterRecord;

  }
}

// jk*
interface MessageCounterRecord {
  id: number;
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  todayPostCount: number;
  thisWeekPostCount: number;
  thisMonthPostCount: number;
  thisYearPostCount: number;
  totalPostCount: number;
  yesterdayPostCount: number
}

interface RankingData {
  name: string;
  userId: string;
  avatar: string;
  count: number;
  percentage: number;
  avatarBase64?: string;
}

interface IconData {
  userId: string;
  iconBase64: string;
}

interface BarBgImgs {
  userId: string;
  barBgImgBase64: string;
}

interface UserRecord {
  userId: string;
  postCountAll: number;
  username: string;
}

// zhs*
export async function apply(ctx: Context, config: Config) {
  // wj*
  const messageCounterIconsPath = path.join(ctx.baseDir, 'data', 'messageCounterIcons');
  const messageCounterBarBgImgsPath = path.join(ctx.baseDir, 'data', 'messageCounterBarBgImgs');
  const filePath = path.join(__dirname, 'emptyHtml.html').replace(/\\/g, '/');
  await ensureDirExists(messageCounterIconsPath);
  await ensureDirExists(messageCounterBarBgImgsPath);
  // cl*
  const scheduledJobs = [];
  const iconData: IconData[] = readIconsFromFolder(messageCounterIconsPath);
  const barBgImgs: BarBgImgs[] = readBgImgsFromFolder(messageCounterBarBgImgsPath);
  const {
    autoPush,
    defaultMaxDisplayCount,
    isBotMessageTrackingEnabled,
    isTimeInfoSupplementEnabled,
    isTextToImageConversionEnabled,
    enableMostActiveUserMuting,
    pushChannelIds,
    muteGuildIds,
    detentionDuration,
    dragonKingDetainmentTime,
    leaderboardGenerationWaitTime,
    isUserMessagePercentageVisible,
  } = config

  // dsq* ds*
  createScheduledTasks(config.dailyScheduledTimers);

  // tzb*
  ctx.model.extend('message_counter_records', {
    id: 'unsigned',
    channelId: 'string',
    channelName: 'string',
    userId: 'string',
    username: 'string',
    todayPostCount: 'unsigned',
    thisWeekPostCount: 'unsigned',
    thisMonthPostCount: 'unsigned',
    thisYearPostCount: 'unsigned',
    totalPostCount: 'unsigned',
    yesterdayPostCount: 'unsigned',
  }, {primary: 'id', autoInc: true});

  // 限定在群组中
  ctx = ctx.guild()

  // jt*
  ctx.on('message', async (session) => {
    const {channelId, event, userId, username} = session
    const groupList = await session.bot.getGuildList()
    const groups = groupList.data;
    const channelName = getNameFromChannelId(groups, channelId);
    await ctx.database.set('message_counter_records', {channelId}, {channelName})
    // 判断该用户是否在数据表中
    const getUser = await ctx.database.get('message_counter_records', {channelId, userId})
    if (getUser.length === 0) {
      await ctx.database.create('message_counter_records', {
        channelId,
        channelName: channelName ?? event.channel.name ?? channelId,
        userId,
        username,
        todayPostCount: 1,
        thisWeekPostCount: 1,
        thisMonthPostCount: 1,
        thisYearPostCount: 1,
        totalPostCount: 1
      })
    } else {
      const user = getUser[0]
      await ctx.database.set('message_counter_records', {channelId, userId}, {
        channelName: channelName ?? event.channel.name ?? channelId,
        username,
        todayPostCount: user.todayPostCount + 1,
        thisWeekPostCount: user.thisWeekPostCount + 1,
        thisMonthPostCount: user.thisMonthPostCount + 1,
        thisYearPostCount: user.thisYearPostCount + 1,
        totalPostCount: user.totalPostCount + 1,
      })
    }
  });

  if (isBotMessageTrackingEnabled) {
    ctx.before('send', async (session) => {
      if (isBotMessageTrackingEnabled) {
        const {channelId, bot, event} = session
        const groupList = await session.bot.getGuildList()
        const groups = groupList.data;
        const channelName = getNameFromChannelId(groups, channelId);
        await ctx.database.set('message_counter_records', {channelId}, {channelName})
        // 判断该用户是否在数据表中
        const getUser = await ctx.database.get('message_counter_records', {channelId, userId: bot.user.id})
        if (getUser.length === 0) {
          await ctx.database.create('message_counter_records', {
            channelId,
            channelName: channelName ?? event.channel.name ?? channelId,
            userId: bot.user.id,
            username: bot.user.name,
            todayPostCount: 1,
            thisWeekPostCount: 1,
            thisMonthPostCount: 1,
            thisYearPostCount: 1,
            totalPostCount: 1
          })
        } else {
          const user = getUser[0]
          await ctx.database.set('message_counter_records', {channelId, userId: bot.user.id}, {
            channelName: channelName ?? event.channel.name ?? channelId,
            username: bot.user.name,
            todayPostCount: user.todayPostCount + 1,
            thisWeekPostCount: user.thisWeekPostCount + 1,
            thisMonthPostCount: user.thisMonthPostCount + 1,
            thisYearPostCount: user.thisYearPostCount + 1,
            totalPostCount: user.totalPostCount + 1,
          })
        }
      }
    });
  }
  // mc* h*
  ctx.command('messageCounter', '查看messageCounter帮助')
    .action(async ({session}) => {
      await session.execute(`messageCounter -h`);
    });
  // csh*
  ctx.command('messageCounter.初始化', '初始化', {authority: 3})
    .action(async ({session}) => {
      await session.send('嗯~')
      await ctx.database.remove('message_counter_records', {})
      await session.send('好啦~')
    });

  // cx* Query
  ctx.command('messageCounter.查询 [targetUser:text]', '查询')
    .option('yesterday', '--yesterday 昨日发言总次数[排名]')
    .option('day', '-d 今日发言次数[排名]')
    .option('week', '-w 本周发言次数[排名]')
    .option('month', '-m 本月发言次数[排名]')
    .option('year', '-y 今年发言次数[排名]')
    .option('total', '-t 总发言次数[排名]')
    .option('ydag', '--ydag 跨群昨日发言总次数[排名]')
    .option('dag', '--dag 跨群今日发言总次数[排名]')
    .option('wag', '--wag 跨群本周发言总次数[排名]')
    .option('mag', '--mag 跨群本月发言总次数[排名]')
    .option('yag', '--yag 跨群本年发言总次数[排名]')
    .option('across', '-a 跨群发言总次数[排名]')
    .action(async ({session, options}, targetUser) => {
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
      if (options.day) {
        selectedOptions.day = true;
      }
      if (options.week) {
        selectedOptions.week = true;
      }
      if (options.month) {
        selectedOptions.month = true;
      }
      if (options.year) {
        selectedOptions.year = true;
      }
      if (options.total) {
        selectedOptions.total = true;
      }
      if (options.yesterday) {
        selectedOptions.yesterday = true;
      }
      if (options.across) {
        selectedOptions.across = true;
      }
      if (options.dag) {
        selectedOptions.dag = true;
      }
      if (options.wag) {
        selectedOptions.wag = true;
      }
      if (options.mag) {
        selectedOptions.mag = true;
      }
      if (options.yag) {
        selectedOptions.yag = true;
      }
      if (options.ydag) {
        selectedOptions.ydag = true;
      }

      // 如果没有选项被选择，则将所有选项设置为 true
      const allOptionsSelected = Object.values(selectedOptions).every(value => value === false);
      if (allOptionsSelected) {
        Object.keys(selectedOptions).forEach(key => {
          selectedOptions[key] = true;
        });
      }

      const {day, week, month, year, total, across, dag, yesterday, wag, yag, mag, ydag} = selectedOptions;
      // selectedOptions 对象包含了用户选择的选项

      // 查询： 直接获取 返回提示 跨群总榜
      let {channelId, userId, username} = session
      let targetUserRecord: MessageCounterRecord[] = []
      const originalUerId = userId
      if (targetUser) {
        targetUser = await replaceAtTags(session, targetUser)
        const userIdRegex = /<at id="([^"]+)"(?: name="([^"]+)")?\/>/;
        const match = targetUser.match(userIdRegex);
        userId = match?.[1] ?? userId;
        username = match?.[2] ?? username;
        if (originalUerId === userId) {
          targetUserRecord = await ctx.database.get('message_counter_records', {channelId, userId: targetUser})
          if (targetUserRecord.length !== 0) {
            userId = targetUser
          }
        } else {
          targetUserRecord = await ctx.database.get('message_counter_records', {channelId, userId})
        }
      } else {
        targetUserRecord = await ctx.database.get('message_counter_records', {channelId, userId})
      }

      if (targetUserRecord.length === 0) {
        return `被查询对象无任何发言记录。`
      }
      const guildUsers: MessageCounterRecord[] = await ctx.database.get('message_counter_records', {channelId});
      const getDragons = await ctx.database.get('message_counter_records', {});

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

      const accumulateSums = (sums, user) => {
        sums.todayPostCount += user.todayPostCount;
        sums.thisWeekPostCount += user.thisWeekPostCount;
        sums.thisMonthPostCount += user.thisMonthPostCount;
        sums.thisYearPostCount += user.thisYearPostCount;
        sums.totalPostCount += user.totalPostCount;
        sums.yesterdayPostCount += user.yesterdayPostCount;
      };

      guildUsers.forEach(user => accumulateSums(totalSums, user));
      getDragons.forEach(user => accumulateSums(acrossTotalSums, user));
      // 获取 userId 对应对象的各种种类的排名数据
      const getUserRanking = (userId: string) => {
        const userRecords = guildUsers.find(user => user.userId === userId);
        if (userRecords) {
          return {
            todayRank: getRank('todayPostCount', userId),
            thisWeekRank: getRank('thisWeekPostCount', userId),
            thisMonthRank: getRank('thisMonthPostCount', userId),
            thisYearRank: getRank('thisYearPostCount', userId),
            totalRank: getRank('totalPostCount', userId),
            yesterdayRank: getRank('yesterdayPostCount', userId),
          };
        } else {
          return null; // 如果找不到对应 userId 的记录，返回 null 或者其他适当的值
        }
      };

      // 获取指定属性的排名
      const getRank = (property: keyof MessageCounterRecord, userId: string) => {
        const sortedUsers = guildUsers.slice().sort((a, b) => (b[property] as number) - (a[property] as number));

        const userIndex = sortedUsers.findIndex(user => user.userId === userId);
        return userIndex !== -1 ? userIndex + 1 : null; // 如果找不到对应 userId 的记录，返回 null 或者其他适当的值
      };

      // 使用方法获取 userId 对应对象的各种种类的排名数据
      const userRankingData = getUserRanking(userId);

      const {todayRank, thisWeekRank, thisMonthRank, thisYearRank, totalRank, yesterdayRank} = userRankingData

      function getAcrossUserRank(userId: string, dragons: [string, number][]): number {
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
      const dragons = getSortedDragons(getDragons)
      const acrossRank = getAcrossUserRank(userId, dragons);

      const userRecords: MessageCounterRecord[] = await ctx.database.get('message_counter_records', {userId});

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
      } = targetUserRecord[0]

      let message = isTextToImageConversionEnabled ? `# 查询对象：${targetUserRecord[0].username}\n\n` : `查询对象：${targetUserRecord[0].username}\n\n`;
      if (isTimeInfoSupplementEnabled) {
        const currentBeijingTime = getCurrentBeijingTime();
        message = isTextToImageConversionEnabled ? `# ${currentBeijingTime}\n${message}` : `${currentBeijingTime}\n${message}`
      }
      if (yesterday) {
        message += `${isTextToImageConversionEnabled ? '## ' : ''}本群昨日发言次数[排名]：${yesterdayPostCount} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(yesterdayPostCount, totalSums.yesterdayPostCount)}` : ''}[${yesterdayRank}]\n`;
      }
      if (day) {
        message += `${isTextToImageConversionEnabled ? '## ' : ''}本群今日发言次数[排名]：${todayPostCount} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(todayPostCount, totalSums.todayPostCount)}` : ''}[${todayRank}]\n`;
      }
      if (week) {
        message += `${isTextToImageConversionEnabled ? '## ' : ''}本群本周发言次数[排名]：${thisWeekPostCount} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(thisWeekPostCount, totalSums.thisWeekPostCount)}` : ''}[${thisWeekRank}]\n`;
      }
      if (month) {
        message += `${isTextToImageConversionEnabled ? '## ' : ''}本群本月发言次数[排名]：${thisMonthPostCount} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(thisMonthPostCount, totalSums.thisMonthPostCount)}` : ''}[${thisMonthRank}]\n`;
      }
      if (year) {
        message += `${isTextToImageConversionEnabled ? '## ' : ''}本群今年发言次数[排名]：${thisYearPostCount} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(thisYearPostCount, totalSums.thisYearPostCount)}` : ''}[${thisYearRank}]\n`;
      }
      if (total) {
        message += `${isTextToImageConversionEnabled ? '## ' : ''}本群总发言次数[排名]：${totalPostCount} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(totalPostCount, totalSums.totalPostCount)}` : ''}[${totalRank}]\n`;
      }
      if (ydag) {
        const ydagResult = getUserRankAndRecord(getDragons, userId, 'yesterdayPostCount');
        const ydagUserRecord = ydagResult.userRecord;
        const ydagRank = ydagResult.acrossRank;
        message += `${isTextToImageConversionEnabled ? '## ' : ''}跨群昨日发言次数[排名]：${ydagUserRecord.postCountAll} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(ydagUserRecord.postCountAll, acrossTotalSums.yesterdayPostCount)}` : ''}[${ydagRank}]\n`;
      }
      if (dag) {
        const dagResult = getUserRankAndRecord(getDragons, userId, 'todayPostCount');
        const dagUserRecord = dagResult.userRecord;
        const dagRank = dagResult.acrossRank;
        message += `${isTextToImageConversionEnabled ? '## ' : ''}跨群今日发言次数[排名]：${dagUserRecord.postCountAll} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(dagUserRecord.postCountAll, acrossTotalSums.todayPostCount)}` : ''}[${dagRank}]\n`;
      }
      if (wag) {
        const wagResult = getUserRankAndRecord(getDragons, userId, 'thisWeekPostCount');
        const wagUserRecord = wagResult.userRecord;
        const wagRank = wagResult.acrossRank;
        message += `${isTextToImageConversionEnabled ? '## ' : ''}跨群本周发言次数[排名]：${wagUserRecord.postCountAll} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(wagUserRecord.postCountAll, acrossTotalSums.thisWeekPostCount)}` : ''}[${wagRank}]\n`;
      }
      if (mag) {
        const magResult = getUserRankAndRecord(getDragons, userId, 'thisMonthPostCount');
        const magUserRecord = magResult.userRecord;
        const magRank = magResult.acrossRank;
        message += `${isTextToImageConversionEnabled ? '## ' : ''}跨群本月发言次数[排名]：${magUserRecord.postCountAll} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(magUserRecord.postCountAll, acrossTotalSums.thisMonthPostCount)}` : ''}[${magRank}]\n`;
      }
      if (yag) {
        const yagResult = getUserRankAndRecord(getDragons, userId, 'thisYearPostCount');
        const yagUserRecord = yagResult.userRecord;
        const yagRank = yagResult.acrossRank;
        message += `${isTextToImageConversionEnabled ? '## ' : ''}跨群本年发言次数[排名]：${yagUserRecord.postCountAll} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(yagUserRecord.postCountAll, acrossTotalSums.thisYearPostCount)}` : ''}[${yagRank}]\n`;
      }
      if (across) {
        message += `${isTextToImageConversionEnabled ? '## ' : ''}跨群总发言次数[排名]：${totalPostCountAcrossGuilds} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(totalPostCountAcrossGuilds, acrossTotalSums.totalPostCount)}` : ''}[${acrossRank}]\n`;
      }

      if (isTextToImageConversionEnabled) {
        const imageBuffer = await ctx.markdownToImage.convertToImage(message)
        return h.image(imageBuffer, `image/${config.imageType}`)
      }
      // 返回消息
      return message;
    });

  // gqfyphb* r* qr* qphb*
  ctx.command('messageCounter.群排行榜 [number:number]', '群发言排行榜')
    .option('specificUser', '-s <user:text> 特定用户的群发言榜', {fallback: ''})
    .option('whites', '--whites <whites:text> 白名单（仅显示）', {fallback: ''})
    .option('blacks', '--blacks <blacks:text> 黑名单（排除）', {fallback: ''})
    .option('yesterday', '--yesterday 昨日发言榜')
    .option('day', '-d 今日发言榜')
    .option('week', '-w 本周发言榜')
    .option('month', '-m 本月发言榜')
    .option('year', '-y 今年发言榜')
    .option('total', '-t 总发言榜')
    .action(async ({session, options}, number) => {

      if (!number) {
        number = defaultMaxDisplayCount;
      }

      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return '请输入大于等于 0 的数字作为排行榜的参数。';
      }

      if (config.hiddenChannelIdsInLeaderboard.length !== 0) {
        options.blacks += '' + config.hiddenChannelIdsInLeaderboard.join(' ');
      }

      let userId = ''
      if (options.specificUser) {
        const atElements = h.select(options.specificUser, 'at')
        if (atElements.length > 0) {
          userId = atElements[0].attrs.id
        }
        if (!userId) {
          userId = options.specificUser
        }
      }

      let username = ''
      if (userId) {
        const userRecords: MessageCounterRecord[] = await ctx.database.get('message_counter_records', {userId});
        if (userRecords.length === 0) {
          return `指定用户不存在。`
        }
        username = getUsernameByChannelId(userRecords, session.channelId)
        if (!username) {
          username = userRecords[0].username
        }
      }

      const whites = splitWhitesOrBlacksString(options.whites)
      const blacks = splitWhitesOrBlacksString(options.blacks)

      let messageCounterRecords: MessageCounterRecord[] = await ctx.database.get('message_counter_records', {});

      if (messageCounterRecords.length === 0) {
        return;
      }

      messageCounterRecords = filterRecordsByWhitesAndBlacks(whites, blacks, messageCounterRecords, 'channelId')

      let sortByProperty: keyof MessageCounterRecord;
      let countProperty: string;

      if (options.day) {
        sortByProperty = 'todayPostCount';
        countProperty = '今日发言次数';
      } else if (options.week) {
        sortByProperty = 'thisWeekPostCount';
        countProperty = '本周发言次数';
      } else if (options.month) {
        sortByProperty = 'thisMonthPostCount';
        countProperty = '本月发言次数';
      } else if (options.year) {
        sortByProperty = 'thisYearPostCount';
        countProperty = '今年发言次数';
      } else if (options.total) {
        sortByProperty = 'totalPostCount';
        countProperty = '总发言次数';
      } else if (options.yesterday) {
        sortByProperty = 'yesterdayPostCount';
        countProperty = '昨日发言次数';
      } else {
        sortByProperty = 'todayPostCount'
        countProperty = '今日发言次数';
      }

      const result = sumValuesByKey(messageCounterRecords, sortByProperty, userId);
      const totalSum = calculateTotalSum(result);
      const currentBeijingTime = getCurrentBeijingTime();
      const rankTimeTitle = `${currentBeijingTime}`
      const prefix = `群排行榜：` + (username ? `${username} 的` : ``);
      const rankTitle = `${prefix}${countProperty}`
      const rankingData: RankingData[] = [];
      let rank = `${isTextToImageConversionEnabled ? `# ` : ``}${prefix}${countProperty}\n`;
      const rankingString = await generateRankingString(result, totalSum, rankingData, number);

      if (isTimeInfoSupplementEnabled) {
        rank = isTextToImageConversionEnabled ? `# ${currentBeijingTime}\n${rank}\n${rankingString}` : `${currentBeijingTime}\n${rank}\n${rankingString}`
      }

      if (config.isLeaderboardToHorizontalBarChartConversionEnabled) {
        const imageBuffer = await LeaderboardToHorizontalBarChartConversion(rankTimeTitle, rankTitle, rankingData)
        return h.image(imageBuffer, `image/${config.imageType}`)
      }

      if (isTextToImageConversionEnabled) {
        const imageBuffer = await ctx.markdownToImage.convertToImage(rank)
        return h.image(imageBuffer, `image/${config.imageType}`)
      }

      return rank;

    })
  // phb* r*
  ctx.command('messageCounter.排行榜 [number:number]', '用户发言排行榜')
    .option('whites', '--whites <whites:text> 白名单（仅显示）', {fallback: ''})
    .option('blacks', '--blacks <blacks:text> 黑名单（排除）', {fallback: ''})
    .option('yesterday', '--yesterday 昨日发言榜')
    .option('day', '-d 今日发言榜')
    .option('week', '-w 本周发言榜')
    .option('month', '-m 本月发言榜')
    .option('year', '-y 今年发言榜')
    .option('total', '-t 总发言榜')
    .option('ydag', '--ydag 跨群昨日发言榜')
    .option('dag', '--dag 跨群日发言榜')
    .option('wag', '--wag 跨群周发言榜')
    .option('mag', '--mag 跨群月发言榜')
    .option('yag', '--yag 跨群年发言榜')
    .option('dragon', '--dragon 圣龙王榜')
    .action(async ({session, options}, number) => {
      const {channelId} = session;

      if (!number) {
        number = defaultMaxDisplayCount;
      }

      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return '请输入大于等于 0 的数字作为排行榜的参数。';
      }

      if (config.hiddenUserIdsInLeaderboard.length !== 0) {
        options.blacks += '' + config.hiddenUserIdsInLeaderboard.join(' ');
      }

      const whites = splitWhitesOrBlacksString(options.whites)
      const blacks = splitWhitesOrBlacksString(options.blacks)

      let getUsers = await ctx.database.get('message_counter_records', {channelId});
      let acrossGetUsers = await ctx.database.get('message_counter_records', {});
      getUsers = filterRecordsByWhitesAndBlacks(whites, blacks, getUsers, 'userId')
      acrossGetUsers = filterRecordsByWhitesAndBlacks(whites, blacks, acrossGetUsers, 'userId')

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

      const accumulateSums = (sums, user) => {
        sums.todayPostCount += user.todayPostCount;
        sums.thisWeekPostCount += user.thisWeekPostCount;
        sums.thisMonthPostCount += user.thisMonthPostCount;
        sums.thisYearPostCount += user.thisYearPostCount;
        sums.totalPostCount += user.totalPostCount;
        sums.yesterdayPostCount += user.yesterdayPostCount;
      };

      getUsers.forEach(user => accumulateSums(totalSums, user));
      acrossGetUsers.forEach(user => accumulateSums(acrossTotalSums, user));

      if (getUsers.length === 0 || acrossGetUsers.length === 0) {
        return;
      }

      let sortByProperty: string;
      let countProperty: string;

      if (options.day) {
        sortByProperty = 'todayPostCount';
        countProperty = '今日发言次数';
      } else if (options.week) {
        sortByProperty = 'thisWeekPostCount';
        countProperty = '本周发言次数';
      } else if (options.month) {
        sortByProperty = 'thisMonthPostCount';
        countProperty = '本月发言次数';
      } else if (options.year) {
        sortByProperty = 'thisYearPostCount';
        countProperty = '今年发言次数';
      } else if (options.total) {
        sortByProperty = 'totalPostCount';
        countProperty = '总发言次数';
      } else if (options.yesterday) {
        sortByProperty = 'yesterdayPostCount';
        countProperty = '昨日发言次数';
      } else {
        sortByProperty = 'todayPostCount'
        countProperty = '今日发言次数';
      }

      const currentBeijingTime = getCurrentBeijingTime();

      // 跨群日榜
      if (options.dag) {
        return generateAcrossRanking(`排行榜：跨群今日总发言次数`, acrossGetUsers, number, currentBeijingTime, accumulateSums, 'todayPostCount')
      }

      // 跨群周榜
      if (options.wag) {
        return generateAcrossRanking(`排行榜：跨群本周总发言次数`, acrossGetUsers, number, currentBeijingTime, accumulateSums, 'thisWeekPostCount')
      }

      // 跨群月榜
      if (options.mag) {
        return generateAcrossRanking(`排行榜：跨群本月总发言次数`, acrossGetUsers, number, currentBeijingTime, accumulateSums, 'thisMonthPostCount')
      }

      // 跨群年榜
      if (options.yag) {
        return generateAcrossRanking(`排行榜：跨群今年总发言次数`, acrossGetUsers, number, currentBeijingTime, accumulateSums, 'thisYearPostCount')
      }

      // 跨群昨日发言榜
      if (options.ydag) {
        return generateAcrossRanking(`排行榜：跨群昨日总发言次数`, acrossGetUsers, number, currentBeijingTime, accumulateSums, 'yesterdayPostCount')
      }

      // 圣龙王榜
      if (options.dragon) {
        const dragons = getSortedDragons(acrossGetUsers)

        // 只保留前 number 个用户
        const topDragons = dragons.slice(0, number);

        const rankingData: RankingData[] = [];
        // 获取用户信息并构建结果数组
        const resultPromises = topDragons.map(async ([key, dragonPostCount], index) => {
          const getUser = await ctx.database.get('message_counter_records', {userId: key});
          const user = getUser[0];
          addToRankingData(rankingData, user.username, key, dragonPostCount, acrossTotalSums.totalPostCount);
          if (user) {
            return `${isTextToImageConversionEnabled ? '## ' : ''}${index + 1}. ${user.username}：${dragonPostCount} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(dragonPostCount, acrossTotalSums.totalPostCount)}` : ''}`;
          }
          return null;
        });

        const result = (await Promise.all(resultPromises)).filter((item) => item !== null) as string[];

        let rank = isTextToImageConversionEnabled ? `# 圣龙王榜: \n${result.join('\n')}` : `圣龙王榜: \n${result.join('\n')}`
        if (isTimeInfoSupplementEnabled) {
          rank = isTextToImageConversionEnabled ? `# ${currentBeijingTime}\n${rank}` : `${currentBeijingTime}\n${rank}`
        }
        if (config.isLeaderboardToHorizontalBarChartConversionEnabled) {

          const imageBuffer = await LeaderboardToHorizontalBarChartConversion(`${currentBeijingTime}`, `圣龙王榜`, rankingData)
          return h.image(imageBuffer, `image/${config.imageType}`)
        }
        if (isTextToImageConversionEnabled) {
          const imageBuffer = await ctx.markdownToImage.convertToImage(rank)
          return h.image(imageBuffer, `image/${config.imageType}`)
        }
        await session.send(rank);
        return;
      }

      const rankingData: RankingData[] = [];
      getUsers.sort((a, b) => b[sortByProperty] - a[sortByProperty]);
      const topUsers = getUsers.slice(0, number);
      let i = 1;
      const result = topUsers.map(user => {
        addToRankingData(rankingData, user.username, user.userId, user[sortByProperty], totalSums[sortByProperty]);
        return `${isTextToImageConversionEnabled ? '## ' : ''}${i++}. ${user.username}：${user[sortByProperty]} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(user[sortByProperty], totalSums[sortByProperty])}` : ''}`
      }).join('\n');
      let rank = isTextToImageConversionEnabled ? `# 排行榜：${countProperty}\n${result}` : `排行榜：${countProperty}\n${result}`
      if (isTimeInfoSupplementEnabled) {
        rank = isTextToImageConversionEnabled ? `# ${currentBeijingTime}\n${rank}` : `${currentBeijingTime}\n${rank}`
      }
      if (config.isLeaderboardToHorizontalBarChartConversionEnabled) {

        const imageBuffer = await LeaderboardToHorizontalBarChartConversion(`${currentBeijingTime}`, `排行榜：${countProperty}`, rankingData)
        return h.image(imageBuffer, `image/${config.imageType}`)
      }
      if (isTextToImageConversionEnabled) {
        const imageBuffer = await ctx.markdownToImage.convertToImage(rank)
        return h.image(imageBuffer, `image/${config.imageType}`)
      }
      await session.send(rank);
    });

  // hs*
  function getUsernameByChannelId(records: MessageCounterRecord[], channelId: string): string | undefined {
    const record = records.find(record => record.channelId === channelId);
    return record ? record.username : undefined;
  }

  async function resetCounter(_key, countKey: string, message: string) {
    const getUsers = await ctx.database.get('message_counter_records', {});
    if (getUsers.length === 0) {
      return;
    }

    // autoPush
    if (autoPush && config.shouldSendDailyLeaderboardAtMidnight) {
      generateLeaderboard(getUsers, countKey);
    }

    if (enableMostActiveUserMuting && countKey === 'todayPostCount') {
      for (const currentBot of ctx.bots) {
        for (const channelId of muteGuildIds) {
          const usersByGuild = getUsers.filter(user => user.channelId === channelId);
          if (usersByGuild.length !== 0) {
            await currentBot.sendMessage(channelId, `正在尝试自动捕捉龙王......`);
            const dragonUser = usersByGuild[0];
            try {
              // 禁言龙王 1 天
              await sleep(dragonKingDetainmentTime * 1000);
              await currentBot.muteGuildMember(channelId, dragonUser.userId, detentionDuration * 24 * 60 * 60 * 1000);
              await currentBot.sendMessage(channelId, `诸位请放心，龙王已被成功捕捉，关押时间为 ${detentionDuration} 天！`);
            } catch (error) {
              logger.error(`在【${channelId}】中禁言用户【${dragonUser.username}】（${dragonUser.userId}）失败！${error}`);
            }
          }
        }
      }
    }

    if (countKey === 'todayPostCount' && !config.isYesterdayCommentRankingDisabled) {
      updateYesterdayCount(getUsers)
    }
    await ctx.database.set('message_counter_records', {}, {[countKey]: 0});

    logger.success(message);
  }

  async function updateYesterdayCount(users: MessageCounterRecord[]): Promise<void> {
    const batchSize = 100;
    const totalUsers = users.length;

    for (let i = 0; i < totalUsers; i += batchSize) {
      const batchUsers = users.slice(i, i + batchSize);

      const batchPromises = batchUsers.map(user => {
        return ctx.database.set('message_counter_records', {
          userId: user.userId,
          channelId: user.channelId
        }, {yesterdayPostCount: user.todayPostCount});
      });

      await Promise.all(batchPromises);
    }
  }

  async function replaceAtTags(session, content: string): Promise<string> {
    // 正则表达式用于匹配 at 标签
    const atRegex = /<at id="(\d+)"(?: name="([^"]*)")?\/>/g;

    // 匹配所有 at 标签
    let match;
    while ((match = atRegex.exec(content)) !== null) {
      const userId = match[1];
      const name = match[2];

      // 如果 name 不存在，根据 userId 获取相应的 name
      if (!name) {
        let guildMember;
        try {
          guildMember = await session.bot.getGuildMember(session.guildId, userId);
        } catch (error) {
          guildMember = {
            user: {
              name: '未知用户',
            },
          };
        }

        // 替换原始的 at 标签
        const newAtTag = `<at id="${userId}" name="${guildMember.user.name}"/>`;
        content = content.replace(match[0], newAtTag);
      }
    }

    return content;
  }

  function getUserRankAndRecord(getDragons: MessageCounterRecord[], userId: string, postCountType: 'todayPostCount' | 'thisWeekPostCount' | 'thisMonthPostCount' | 'thisYearPostCount' | 'totalPostCount' | 'yesterdayPostCount'): {
    acrossRank: number,
    userRecord: UserRecord
  } | undefined {
    if (getDragons.length === 0) {
      return;
    }

    const aggregatedUserRecords: { [key: string]: UserRecord } = getDragons.reduce((acc, user) => {
      if (!acc[user.userId]) {
        acc[user.userId] = {
          userId: user.userId,
          postCountAll: 0,
          username: user.username
        };
      }

      let postCount = 0;
      switch (postCountType) {
        case 'todayPostCount':
          postCount = user.todayPostCount;
          break;
        case 'thisWeekPostCount':
          postCount = user.thisWeekPostCount;
          break;
        case 'thisMonthPostCount':
          postCount = user.thisMonthPostCount;
          break;
        case 'thisYearPostCount':
          postCount = user.thisYearPostCount;
          break;
        case 'totalPostCount':
          postCount = user.totalPostCount;
          break;
        case 'yesterdayPostCount':
          postCount = user.yesterdayPostCount;
          break;
        default:
          postCount = user.todayPostCount;
          break;
      }

      acc[user.userId].postCountAll += postCount;
      return acc;
    }, {});

    const sortedUserRecords = Object.values(aggregatedUserRecords).sort((a, b) => b.postCountAll - a.postCountAll);

    const userIndex = sortedUserRecords.findIndex(user => user.userId === userId);
    const userRecord = sortedUserRecords[userIndex];
    const acrossRank = userIndex + 1;

    return {acrossRank, userRecord};
  }

  async function generateAcrossRanking(rankTitle: string, acrossGetUsers: MessageCounterRecord[], number: number, currentBeijingTime: string, acrossTotalSums: any, postCountType: 'todayPostCount' | 'thisWeekPostCount' | 'thisMonthPostCount' | 'thisYearPostCount' | 'totalPostCount' | 'yesterdayPostCount'): Promise<any> {
    const userMap = new Map();
    const usernameMap = new Map();

    for (const user of acrossGetUsers) {
      const {
        userId,
        todayPostCount,
        username,
        thisWeekPostCount,
        thisMonthPostCount,
        thisYearPostCount,
        totalPostCount,
        yesterdayPostCount
      } = user;
      let postCount = 0;

      switch (postCountType) {
        case 'todayPostCount':
          postCount = todayPostCount;
          break;
        case 'thisWeekPostCount':
          postCount = thisWeekPostCount;
          break;
        case 'thisMonthPostCount':
          postCount = thisMonthPostCount;
          break;
        case 'thisYearPostCount':
          postCount = thisYearPostCount;
          break;
        case 'totalPostCount':
          postCount = totalPostCount;
          break;
        case 'yesterdayPostCount':
          postCount = yesterdayPostCount;
          break;
        default:
          postCount = todayPostCount;
          break;
      }

      if (userMap.has(userId)) {
        userMap.set(userId, userMap.get(userId) + postCount);
      } else {
        userMap.set(userId, postCount);
        usernameMap.set(userId, username);
      }
    }

    const sortedUsers = Array.from(userMap).sort((a, b) => b[1] - a[1]).slice(0, number);

    const rankingData: RankingData[] = [];

    let rank = isTextToImageConversionEnabled ? `# ${rankTitle}：\n` : `${rankTitle}：\n`;
    const rankTimeTitle = `${currentBeijingTime}`;

    sortedUsers.forEach((user, index) => {
      const userId = user[0];
      const postCountAll = user[1];
      const username = usernameMap.get(userId);
      addToRankingData(rankingData, username, userId, postCountAll, acrossTotalSums[postCountType]);
      rank += `${isTextToImageConversionEnabled ? '## ' : ''}${index + 1}. ${username}：${postCountAll} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(postCountAll, acrossTotalSums.totalPostCount)}` : ''}\n`;
    });

    if (isTimeInfoSupplementEnabled) {
      rank = isTextToImageConversionEnabled ? `# ${currentBeijingTime}\n${rank}` : `${currentBeijingTime}\n${rank}`;
    }

    if (config.isLeaderboardToHorizontalBarChartConversionEnabled) {
      const imageBuffer = await LeaderboardToHorizontalBarChartConversion(rankTimeTitle, rankTitle, rankingData);
      return h.image(imageBuffer, `image/${config.imageType}`);
    }

    if (isTextToImageConversionEnabled) {
      const imageBuffer = await ctx.markdownToImage.convertToImage(rank);
      return h.image(imageBuffer, `image/${config.imageType}`);
    }

    return rank;
  }

  function filterRecordsByWhitesAndBlacks(whites: any[], blacks: any[], messageCounterRecords: any[], property: 'userId' | 'channelId') {
    if (whites.length !== 0) {
      messageCounterRecords = filterRecordsByProperty(messageCounterRecords, property, whites, true);
    }
    if (blacks.length !== 0) {
      messageCounterRecords = filterRecordsByProperty(messageCounterRecords, property, blacks, false);
    }

    return messageCounterRecords;
  }

  function filterRecordsByProperty(messageCounterRecords: MessageCounterRecord[], property: 'userId' | 'channelId', values: string[], whitelist: boolean): MessageCounterRecord[] {
    if (whitelist) {
      return messageCounterRecords.filter(record => values.includes(record[property]));
    } else {
      return messageCounterRecords.filter(record => !values.includes(record[property]));
    }
  }

  function splitWhitesOrBlacksString(whitesOrBlacks: string): string[] {
    if (!whitesOrBlacks) {
      return [];
    }

    const result: string[] = [];
    let currentWord = '';
    let inWord = false;

    for (const char of whitesOrBlacks) {
      if (char === ' ' || char === '，' || char === ',' || char === '、') {
        if (inWord) {
          result.push(currentWord);
          currentWord = '';
          inWord = false;
        }
      } else {
        currentWord += char;
        inWord = true;
      }
    }

    if (inWord) {
      result.push(currentWord);
    }

    return result;
  }

  function getNameFromChannelId(groups: any[], channelId: string): string | undefined {
    if (!Array.isArray(groups)) {
      groups = [groups];
      groups = groups.map((group: any) => ({id: group.guildId}));
    }

    const group = groups.find(group => group.id === channelId);
    return group ? group.name : undefined;
  }

  function createScheduledTasks(dailyScheduledTimers: string[]) {
    const uniqueTimers = Array.from(new Set(dailyScheduledTimers));

    uniqueTimers.forEach(time => {
      time = time.replace('：', ':');

      const [hour, minute] = time.split(':');
      const rule = new schedule.RecurrenceRule();
      rule.hour = parseInt(hour);
      rule.minute = parseInt(minute);

      const currentTime = new Date();
      logger.success(`每日 ${time}:00 的定时器创建成功！当前时间为：${currentTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);

      const job = schedule.scheduleJob(rule, async function () {
        const currentTime = new Date();
        logger.success(`任务执行中...当前时间为：${currentTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);
        const getUsers = await ctx.database.get('message_counter_records', {});
        if (getUsers.length === 0) {
          return;
        }
        generateLeaderboard(getUsers, 'todayPostCount', true);
      });

      scheduledJobs.push(job);
    });
  }

  async function generateLeaderboard(getUsers, countKey: string, isScheduled = false) { // ts*
    getUsers = filterRecordsByWhitesAndBlacks([], config.hiddenUserIdsInLeaderboard, getUsers, 'userId')
    let channelIds: string[] = pushChannelIds
    for (const currentBot of ctx.bots) {
      if (config.shouldSendLeaderboardNotificationsToAllChannels) {
        const groupList = await currentBot.getGuildList()
        const groups = groupList.data;
        channelIds = groups.map(group => group.id);
      }
      for (const channelId of channelIds) {
        if (config.excludedLeaderboardChannels.includes(channelId)) {
          continue;
        }
        const usersByGuild = getUsers.filter(user => user.channelId === channelId);
        if (usersByGuild.length !== 0) {
          const {year, month, day} = getYesterdayDateParts(isScheduled);
          let sortByProperty: string;
          let countProperty: string;
          let dateStr: string;
          switch (countKey) {
            case 'todayPostCount':
              sortByProperty = 'todayPostCount';
              countProperty = '今日发言次数';
              dateStr = `${year}年${month}月${day}日`;
              break;
            case 'thisWeekPostCount':
              sortByProperty = 'thisWeekPostCount';
              countProperty = '本周发言次数';
              dateStr = `${year}年${month}月${day}日`;
              break;
            case 'thisMonthPostCount':
              sortByProperty = 'thisMonthPostCount';
              countProperty = '本月发言次数';
              dateStr = `${year}年${month}月`;
              break;
            case 'thisYearPostCount':
              sortByProperty = 'thisYearPostCount';
              countProperty = '今年发言次数';
              dateStr = `${year}年`;
              break;
            default:
              return;
          }

          const getUsers = await ctx.database.get('message_counter_records', {channelId});
          const totalSums = {
            todayPostCount: 0,
            thisWeekPostCount: 0,
            thisMonthPostCount: 0,
            thisYearPostCount: 0,
            totalPostCount: 0,
            yesterdayPostCount: 0,
          };

          const accumulateSums = (sums, user) => {
            sums.todayPostCount += user.todayPostCount;
            sums.thisWeekPostCount += user.thisWeekPostCount;
            sums.thisMonthPostCount += user.thisMonthPostCount;
            sums.thisYearPostCount += user.thisYearPostCount;
            sums.totalPostCount += user.totalPostCount;
            sums.yesterdayPostCount += user.yesterdayPostCount;
          };

          getUsers.forEach(user => accumulateSums(totalSums, user));
          if (config.isGeneratingRankingListPromptVisible) {
            await currentBot.sendMessage(channelId, `正在尝试自动生成${countProperty}榜......`);
          }
          usersByGuild.sort((a, b) => b[sortByProperty] - a[sortByProperty]);
          const topUsers = usersByGuild.slice(0, defaultMaxDisplayCount);
          const rankingData: RankingData[] = [];
          const result = topUsers.map((user, index) => {
            addToRankingData(rankingData, user.username, user.userId, user[sortByProperty], totalSums[sortByProperty]);
            return `${isTextToImageConversionEnabled ? '## ' : ''}${index + 1}. ${user.username}：${user[sortByProperty]} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(user[sortByProperty], totalSums[sortByProperty])}` : ''}`
          }).join('\n');
          let rank = isTextToImageConversionEnabled ? `# 排行榜：${countProperty}\n${result}` : `排行榜：${countProperty}\n${result}`
          if (isTimeInfoSupplementEnabled) {
            rank = isTextToImageConversionEnabled ? `# ${dateStr}\n${rank}` : `${dateStr}\n${rank}`
          }
          if (config.isGeneratingRankingListPromptVisible) {
            await sleep(leaderboardGenerationWaitTime * 1000);
          }
          if (config.isLeaderboardToHorizontalBarChartConversionEnabled) {

            const imageBuffer = await LeaderboardToHorizontalBarChartConversion(`${dateStr}`, `排行榜：${countProperty}`, rankingData)
            await currentBot.sendMessage(channelId, h.image(imageBuffer, `image/${config.imageType}`));
          } else if (isTextToImageConversionEnabled) {
            const imageBuffer = await ctx.markdownToImage.convertToImage(rank);
            await currentBot.sendMessage(channelId, h.image(imageBuffer, `image/${config.imageType}`));
          } else {
            await currentBot.sendMessage(channelId, rank);
          }

        }
        const randomDelay = (Math.random() * config.groupPushDelayRandomizationSeconds * 2 - config.groupPushDelayRandomizationSeconds) * 1000;

        const seconds = config.delayBetweenGroupPushesInSeconds * 1000 + randomDelay;
        await sleep(seconds)
      }
    }
  }

  function calculateTotalSum(result: { channelId: string, channelName: string, sum: number }[]): number {
    let totalSum = 0;

    for (const entry of result) {
      totalSum += entry.sum;
    }

    return totalSum;
  }

  async function generateRankingString(result: {
    channelId: string,
    channelName: string,
    sum: number
  }[], totalSum: number, rankingData: RankingData[], number): Promise<string> {
    result.sort((a, b) => b.sum - a.sum);

    const topTen = result.slice(0, number);

    let rankingString = ``;
    for (const entry of topTen) {
      const index = topTen.indexOf(entry);
      addToRankingData(rankingData, entry.channelName, entry.channelId.includes(`#`) ? '426230045' : entry.channelId, entry.sum, totalSum, true);
      rankingString += `${isTextToImageConversionEnabled ? `## ` : ``}${index + 1}. ${entry.channelName}：${entry.sum} 次${isUserMessagePercentageVisible ? ` ${calculatePercentage(entry.sum, totalSum)}` : ''}\n`;
    }

    return rankingString;
  }

  function sumValuesByKey(records: MessageCounterRecord[], key: keyof MessageCounterRecord, userId: string = ''): {
    channelId: string,
    channelName: string,
    sum: number
  }[] {
    const channelMap = new Map<string, { channelName?: string, sum: number }>();

    const filteredRecords = userId
      ? records.filter(record => record.userId === userId)
      : records;

    for (const record of filteredRecords) {
      const {channelId, channelName} = record;
      const value = record[key];

      channelMap.set(channelId, {
        channelName,
        sum: (channelMap.get(channelId)?.sum || 0) + Number(value)
      });
    }

    return Array.from(channelMap.entries()).map(([channelId, {channelName, sum}]) => ({
      channelId,
      channelName,
      sum
    }));
  }


  function addToRankingData(rankingData: RankingData[], username: string, userId: string, postCountAll: number, totalPostCount: number, isChannel?: boolean): void {
    if (!isChannel) {
      isChannel = false;
    }
    rankingData.push({
      name: username,
      userId: userId,
      avatar: isChannel ? `https://p.qlogo.cn/gh/${userId}/${userId}/640/` : `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`,
      count: postCountAll,
      percentage: calculatePercentage2(postCountAll, totalPostCount)
    });
  }

  function readIconsFromFolder(folderPath: string): IconData[] {
    const iconData: IconData[] = [];

    try {
      const files = fs.readdirSync(folderPath);

      files.forEach((file) => {
        const userId = path.parse(file).name.split('-')[0].trim();
        const filePath = path.join(folderPath, file);
        const fileData = fs.readFileSync(filePath);
        const iconBase64 = fileData.toString('base64');

        iconData.push({userId, iconBase64});
      });

    } catch (err) {
      logger.error('读取图标时出错：', err);
    }

    return iconData;
  }

  function readBgImgsFromFolder(folderPath: string): BarBgImgs[] {
    const barBgImgs: BarBgImgs[] = [];

    try {
      const files = fs.readdirSync(folderPath);

      files.forEach((file) => {
        const userId = path.parse(file).name.split('-')[0].trim();
        const filePath = path.join(folderPath, file);
        const fileData = fs.readFileSync(filePath);
        const barBgImgBase64 = fileData.toString('base64');

        barBgImgs.push({userId, barBgImgBase64});
      });

    } catch (err) {
      logger.error('读取水平柱状图背景图时出错：', err);
    }

    return barBgImgs;
  }

  async function ensureDirExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, {recursive: true});
    }
  }

  const resizeImageToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    const canvas = await ctx.canvas.createCanvas(50, 50);
    const context = canvas.getContext('2d');

    const image = await ctx.canvas.loadImage(imageBuffer);
    context.drawImage(image, 0, 0, 50, 50);

    const buffer = await canvas.toBuffer('image/png');
    return buffer.toString('base64');
  };

  async function updateDataWithBase64(data: RankingData[]) {
    await Promise.all(
      data.map(async (item) => {
        item.avatarBase64 = await resizeImageToBase64(item.avatar);
      })
    );
  }

  // 加深颜色
  function darkenColor(color: string, amount: number): string {
    const [r, g, b] = color.match(/\d+/g).map(Number);
    const newR = Math.max(0, r - Math.floor(r * amount));
    const newG = Math.max(0, g - Math.floor(g * amount));
    const newB = Math.max(0, b - Math.floor(b * amount));
    return `rgb(${newR}, ${newG}, ${newB})`;
  }

  async function generateRankingChartStyle3(rankTimeTitle, rankTitle, data: RankingData[]) {
    await updateDataWithBase64(data)
    let browser;
    ctx.inject(['puppeteer'], async (ctx) => {
      browser = ctx.puppeteer.browser;
    });
    const context = await browser.createBrowserContext()
    const page = await context.newPage()

    const htmlContent = `
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ranking Board</title>
    <style>
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

            .ranking-title {
            text-align: center;
            margin-bottom: 20px;
        }

    body {
      font-family: 'JMH', 'SJbangkaijianti', 'SJkaishu';
    }
    </style>
</head>
<body>
      <h1 class="ranking-title" style="font-family: 'JMH'; font-weight: normal; font-style: normal;">${rankTimeTitle}</h1>
      <h1 class="ranking-title" style="font-family: 'JMH'; font-weight: normal; font-style: normal;">${rankTitle}</h1>
      <h1 class="ranking-title" style="display: none;font-family: 'SJkaishu'; font-weight: normal; font-style: normal;">SJkaishu</h1>
      <h1 class="ranking-title" style="display: none;font-family: 'SJbangkaijianti'; font-weight: normal; font-style: normal;">SJbangkaijianti</h1>
<canvas id="rankingCanvas"></canvas>

<script>
    window.onload = async () => {
        await drawRanking();
    }

    async function drawRanking() {
        let rankingData = ${JSON.stringify(data)};
        let iconData = ${JSON.stringify(iconData)};
        let barBgImgs = ${JSON.stringify(barBgImgs)};
        const maxCount = rankingData.reduce((max, item) => Math.max(max, item.count), 0);
        const maxCountText = maxCount.toString()
        const userNum = rankingData.length;
        const userAvatarSize = 50;
        const firstVerticalLineX = 200;
        const verticalLineWidth = 3;
        const tableWidth = 200 + 100 * 7;
        const canvasWidth = tableWidth + 100;
        const canvasHeight = 50 * userNum;

        const canvas = document.getElementById('rankingCanvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        let context = canvas.getContext('2d');
        const maxCountTextWidth = context.measureText(maxCountText).width
        canvas.width = canvasWidth + maxCountTextWidth;
        canvas.height = canvasHeight;
        context = canvas.getContext('2d');


        // 绘制用户头像
        await drawAvatars(context, rankingData, userAvatarSize);
        // 绘制发言次数柱状条、发言次数、用户名
        await drawRankingBars(rankingData, maxCount, context, userAvatarSize, tableWidth);
        // 绘制垂直线
        drawVerticalLines(context, firstVerticalLineX, canvasHeight, verticalLineWidth);

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
            ;(r /= 255), (g /= 255), (b /= 255)
            const max = Math.max(r, g, b),
                min = Math.min(r, g, b)
            let h,
                s,
                l = (max + min) / 2

            if (max === min) {
                h = s = 0
            } else {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                switch (max) {
                    case r:
                        h = (g - b) / d + (g < b ? 6 : 0)
                        break
                    case g:
                        h = (b - r) / d + 2
                        break
                    case b:
                        h = (r - g) / d + 4
                        break
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

            return {
                r: Math.round(r * 255),
                g: Math.round(g * 255),
                b: Math.round(b * 255)
            }
        }

        function rgbToHex(r, g, b) {
            const toHex = c => {
                const hex = c.toString(16)
                return hex.length === 1 ? "0" + hex : hex
            }

            return \`#\${toHex(r)}\${toHex(g)}\${toHex(b)}\`
        }

        async function drawRankingBars(
            rankingData,
            maxCount,
            context,
            userAvatarSize,
            tableWidth,
        ) {
            for (const data of rankingData) {
                const index = rankingData.indexOf(data)
                const countBarWidth = 150 + (700 * data.count) / maxCount
                const countBarX = 50
                const countBarY = 50 * index

                // 绘制发言次数柱状条
                let avgColor = await getAverageColor(data.avatarBase64)
                // const avgColor = await getAverageColor(data.avatarBase64)
                const colorWithOpacity = addOpacityToColor(avgColor, 0.5)

                context.fillStyle = \`\${avgColor}\`
                context.fillRect(countBarX, countBarY, countBarWidth, userAvatarSize)

                const barBgImgsBase64 = findBarBgImgBase64(data.userId, barBgImgs);
                if (barBgImgs.length > 0 && barBgImgsBase64 !== null) {
                        const randomBarBgImg = getRandomBarBgImg(barBgImgsBase64);
                        const barBgImg = new Image();
                        barBgImg.src = "data:image/png;base64," + randomBarBgImg;
                        barBgImg.onload = () => {

                          context.globalAlpha = ${config.horizontalBarBackgroundFullOpacity};
                          context.drawImage(barBgImg, countBarX, countBarY, tableWidth - countBarX, userAvatarSize);
                          context.globalAlpha = 1;
                          context.globalAlpha = ${config.horizontalBarBackgroundOpacity};
                          context.drawImage(barBgImg, 0, 0, countBarWidth, userAvatarSize, countBarX, countBarY, countBarWidth, userAvatarSize);
                          context.globalAlpha = 1;
                        }
                        avgColor = await getAverageColor(randomBarBgImg)
                }

                // 绘制剩余部分
                if (data.count !== maxCount) {
                    context.fillStyle = \`\${colorWithOpacity}\`
                    context.fillRect(
                        countBarX + countBarWidth,
                        countBarY,
                        tableWidth - countBarWidth - 50,
                        userAvatarSize
                    )
                }

                // 绘制用户发言次数
                context.fillStyle = "rgba(0, 0, 0, 1)" // 黑色，不透明度100%
                context.font = "30px JMH SJbangkaijianti SJkaishu"
                context.textAlign = "center"

                const countText = data.count.toString()
                const textWidth = context.measureText(countText).width

                const textX = countBarX + countBarWidth + 10 + textWidth / 2 // 根据数字宽度调整位置居中
                const textY = countBarY + userAvatarSize / 2 + 10.5

                context.fillText(countText, textX, textY)

                // 绘制用户名
                context.fillStyle = chooseColorAdjustmentMethod(avgColor);
                context.font = "30px SJbangkaijianti JMH SJkaishu";
                context.textAlign = "center";

                let nameText = data.name;
                let nameTextWidth = context.measureText(nameText).width;

                let nameTextX = countBarX + 10 + nameTextWidth / 2;
                const nameTextY = countBarY + userAvatarSize / 2 + 10.5;

                const textMaxWidth = countBarX + countBarWidth - 80;

                if (nameTextWidth > textMaxWidth) {
                    const ellipsis = "...";
                    const ellipsisWidth = context.measureText(ellipsis).width;
                    let maxNameWidth = textMaxWidth - ellipsisWidth;

                    while (nameTextWidth > maxNameWidth && nameText.length > 0) {
                        nameText = nameText.slice(0, -1);
                        nameTextWidth = context.measureText(nameText).width;
                    }
                    nameText += ellipsis;

                    nameTextX = countBarX + 10 + nameTextWidth / 2 + 13
                    context.fillText(nameText, nameTextX, nameTextY);
                } else {
                    context.fillText(nameText, nameTextX, nameTextY);
                }

                // 绘制图标
                const userIconBase64 = findIconBase64(data.userId, iconData);
                if (iconData.length > 0 && userIconBase64 !== null) {
                // 遍历 userIconBase64 数组，依次绘制图标，图标大小为 40*40，绘制在发言次数柱状条末端左侧/右侧

                for (let i = 0; i < userIconBase64.length; i++) {
                    const icon = new Image();
                    icon.src = "data:image/png;base64," + userIconBase64[i];
                    icon.onload = () => {
                                    ${config.shouldMoveIconToBarEndLeft ? `context.drawImage(icon, countBarX + countBarWidth - 40 * i - 40,  nameTextY - 30, 40, 40);` : `context.drawImage(icon, nameTextX + nameTextWidth / 2 + 40 * i + 2, nameTextY - 30, 40, 40);`}
                        // context.drawImage(icon, countBarX + countBarWidth - 40 * i - 40,  nameTextY - 30, 40, 40);
                    } // onload
                } // for
            } // if

                // for
            }

            // function
        }

          function getRandomBarBgImg(barBgImgsBase64) {
              const randomIndex = Math.floor(Math.random() * barBgImgsBase64.length);
              return barBgImgsBase64[randomIndex];
          }

         function findIconBase64(userId, iconData) {
            const foundIcons = iconData.filter((data) => data.userId === userId);

            if (foundIcons.length > 0) {
                return foundIcons.map((icon) => icon.iconBase64);
            } else {
                return null;
            }
        }

        function findBarBgImgBase64(userId, barBgImgs) {
            const foundBarBgImgs = barBgImgs.filter((data) => data.userId === userId);

            if (foundBarBgImgs.length > 0) {
                return foundBarBgImgs.map((barBgImg) => barBgImg.barBgImgBase64);
            } else {
                return null;
            }
        }

        function addOpacityToColor(color, opacity) {
            const opacityHex = Math.round(opacity * 255)
                .toString(16)
                .padStart(2, "0")
            return \`\${color}\${opacityHex}\`
        }

      function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function removeCanvas(canvas) {
    canvas.remove();
}

async function getAverageColor(avatarBase64) {
    const image = new Image();
    // image.src = url;
    image.src = "data:image/png;base64," + avatarBase64;

    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const data = imageData.data;

    let totalRed = 0;
    let totalGreen = 0;
    let totalBlue = 0;

    for (let i = 0; i < data.length; i += 4) {
        totalRed += data[i];
        totalGreen += data[i + 1];
        totalBlue += data[i + 2];
    }

    const pixelCount = data.length / 4;
    const avgRed = Math.round(totalRed / pixelCount);
    const avgGreen = Math.round(totalGreen / pixelCount);
    const avgBlue = Math.round(totalBlue / pixelCount);

    const hexRed = avgRed.toString(16).padStart(2, "0");
    const hexGreen = avgGreen.toString(16).padStart(2, "0");
    const hexBlue = avgBlue.toString(16).padStart(2, "0");

    removeCanvas(canvas);

    return \`#\${hexRed}\${hexGreen}\${hexBlue}\`;
}



        function drawVerticalLines(
            context,
            firstVerticalLineX,
            canvasHeight,
            verticalLineWidth
        ) {
            context.fillStyle = "rgba(0, 0, 0, 0.12)" // 设置线条颜色为黑色，不透明度为12%
            context.fillRect(firstVerticalLineX, 0, verticalLineWidth, canvasHeight) // 绘制第 1 条垂直线
            // 绘制第 2~8 条垂直线
            for (let i = 1; i < 8; i++) {
                const x = firstVerticalLineX + 100 * i
                context.fillRect(x, 0, verticalLineWidth, canvasHeight)
            }
        }

        async function drawAvatars(context, rankingData, userAvatarSize) {
            let y = 0
            for (const data of rankingData) {
            const image = new Image();
            // image.src = data.avatar;
            image.src = "data:image/png;base64," + data.avatarBase64;

                image.onload = () => {
                    context.drawImage(image, 0, y, userAvatarSize, userAvatarSize)
                    y += userAvatarSize
                }

            }
        }
    }

</script>
</body>
</html>
`

    // 把 htmlContent 写入文件
    // const filePath = path.join(__dirname, 'ranking.html');
    // fs.writeFileSync(filePath, htmlContent);
    await page.setViewport({width: 1080, height: 256, deviceScaleFactor: 1})
    await page.goto('file://' + filePath);

    await page.setContent(h.unescape(htmlContent), {waitUntil: config.waitUntil});

    const buffer = await page.screenshot({type: config.imageType, fullPage: true});
    await page.close();
    await context.close()

    return buffer

  }

  async function generateRankingChartStyle2(rankTimeTitle, rankTitle, data: RankingData[]) {
    const maxCount = data.reduce((max, item) => Math.max(max, item.count), 0);
    const maxHorizontalBarLabelLengthBeforeTruncation = config.maxHorizontalBarLabelLengthBeforeTruncation
    const maxNameLength = Math.max(...data.map(item => item.name.length > maxHorizontalBarLabelLengthBeforeTruncation ? maxHorizontalBarLabelLengthBeforeTruncation : item.name.length)); // 获取最长名称长度

    const chartHtml = [];
    for (const item of data) {
      const {name, avatar, count, percentage} = item;
      const truncatedName = name.length > maxHorizontalBarLabelLengthBeforeTruncation ? name.slice(0, maxHorizontalBarLabelLengthBeforeTruncation) + '...' : name.padEnd(maxNameLength, ' '); // 使用 padEnd 补全名称长度
      const barColor = await getBarColor(percentage, count, maxCount);
      const progressColor = darkenColor(barColor, 0.2);

      const itemHtml = `
    <div class="ranking-item">
      <img src="${avatar}" alt="${name}" class="avatar" />
      <span class="name">${truncatedName}</span>
      <div class="bar-container">
        <div class="bar" style="width: ${config.isFirstProgressFullyVisible ? count / maxCount * 100 : percentage}%; background-color: ${barColor};">
          <div class="progress" style="width: 100%; background-color: ${progressColor};"></div>
        </div>
      </div>
      <span class="count">${count}${isUserMessagePercentageVisible ? ` 次 ${percentage}%` : ''}</span>
    </div>
  `;

      chartHtml.push(itemHtml);
    }

    const finalHtml = chartHtml.join('');


    const rankingHtml = `
    <div class="ranking-chart">
      ${finalHtml}
    </div>
  `;
    const html = `
        <html lang="">
<head>
    <meta charset="UTF-8">
    <title>发言排行榜</title>
    <style>
            .ranking-title {
            text-align: center;
            margin-bottom: 20px;
        }
        .ranking-chart {
            font-family: Arial, sans-serif;
            width: 100%;
            border-collapse: collapse;
        }

        .ranking-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
        }

        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 10px;
        }

        .name {
            font-weight: bold;
            margin-right: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .bar-container {
            flex: 1;
            height: 20px;
            background-color: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin-right: 10px;
            position: relative;
        }

        .bar {
            height: 100%;
            border-radius: 10px;
        }

        .progress {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            border-radius: 10px;
            transition: width 0.5s ease;
        }

        .count {
            font-size: 14px;
            color: #888;
        }

        .ranking-item:first-child {
            border-top: 2px solid #e0e0e0;
        }

        .ranking-item:not(:last-child) {
            border-bottom: 1px solid #e0e0e0;
        }

        .ranking-item:last-child {
            border-bottom: 2px solid #e0e0e0;
        }
    </style>
</head>
<body class="">
      <h2 class="ranking-title">${rankTitle}</h2>
      <h2 class="ranking-title">${rankTimeTitle}</h2>
${rankingHtml}
</body>
</html>`
    let browser;
    ctx.inject(['puppeteer'], async (ctx) => {
      browser = ctx.puppeteer.browser;
    });
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport({width: config.width, height: 100, deviceScaleFactor: 1});
    await page.setContent(html, {waitUntil: 'load'});
    const imageBuffer = await page.screenshot({fullPage: true, type: config.imageType});
    await page.close();
    await context.close();
    return imageBuffer
  }

  function getBarColor(percentage, count, maxCount): string {
    if (config.isFirstProgressFullyVisible) {
      percentage = count / maxCount * 100
      if (percentage >= 80) {
        return '#4caf50'; // 绿色
      } else if (percentage >= 50) {
        return '#2196f3'; // 蓝色
      } else if (percentage >= 30) {
        return '#ff9800'; // 橙色
      } else {
        return '#f44336'; // 红色
      }
    }
    if (percentage >= 40) {
      return '#4caf50'; // 绿色
    } else if (percentage >= 25) {
      return '#2196f3'; // 蓝色
    } else if (percentage >= 15) {
      return '#ff9800'; // 橙色
    } else {
      return '#f44336'; // 红色
    }
  }

  async function LeaderboardToHorizontalBarChartConversion(rankTimeTitle, rankTitle, rankingData: RankingData[]) {
    if (config.horizontalBarChartStyle === '3') {
      return await generateRankingChartStyle3(rankTimeTitle, rankTitle, rankingData)
    } else if (config.horizontalBarChartStyle === '2') {
      return await generateRankingChartStyle2(rankTimeTitle, rankTitle, rankingData)
    }
    const maxCount = rankingData.reduce((max, item) => Math.max(max, item.count), 0);

    function generateRankingHtml(data: RankingData[]): string {

      const html = `
    <div class="ranking">
      <h2 class="ranking-title">${rankTitle}</h2>
      <h2 class="ranking-title">${rankTimeTitle}</h2>
      ${data.map((item, index) => `
        <div class="ranking-item">
          <div class="ranking-avatar">
            <img src="${item.avatar}" alt="${item.name}">
          </div>
          <div class="ranking-info">
            <div class="ranking-name">${item.name}</div>
            <div class="ranking-bar">
              <div class="ranking-bar-fill" style="width: ${config.isFirstProgressFullyVisible ? item.count / maxCount * 100 : item.percentage}%; background-color: ${getBarColor(item.percentage, item.count, maxCount)};"></div>
            </div>
            <div class="ranking-percentage">${item.count} 次 ${item.percentage}%</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

      return html;
    }

    const rankingHtml = generateRankingHtml(rankingData);
    const html = `
        <html lang="">
<head>
    <meta charset="UTF-8">
    <title>发言排行榜</title>
    <style>
        .ranking {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
        }

        .ranking-title {
            text-align: center;
            margin-bottom: 20px;
        }

        .ranking-item {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }

        .ranking-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            overflow: hidden;
            margin-right: 10px;
        }

        .ranking-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .ranking-info {
            flex: 1;
        }

        .ranking-name {
            font-weight: bold;
            margin-bottom: 5px;
        }

        .ranking-bar {
            height: 10px;
            background-color: #f0f0f0;
            border-radius: 5px;
            overflow: hidden;
        }

        .ranking-bar-fill {
            height: 100%;
        }

        .ranking-percentage {
            margin-top: 5px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body class="">
${rankingHtml}
</body>
</html>`
    let browser;
    ctx.inject(['puppeteer'], async (ctx) => {
      browser = ctx.puppeteer.browser;
    });
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport({width: config.width, height: 100, deviceScaleFactor: 1});
    await page.setContent(html, {waitUntil: 'load'});
    const imageBuffer = await page.screenshot({fullPage: true, type: config.imageType});
    await page.close();
    await context.close()
    return imageBuffer
  }

  function calculatePercentage(number: number, total: number): string {
    if (total === 0) {
      return `0%`;
    }

    const percentage = Math.round((number / total) * 100);
    return `${percentage}%`;
  }

  function calculatePercentage2(number: number, total: number): number {
    if (total === 0) {
      return 0;
    }

    const percentage = Math.round((number / total) * 100);
    return percentage;
  }

  function getYesterdayDateParts(isScheduled: boolean): { year: number, month: number, day: number } {
    // 获取当前时间
    const today = new Date();
    // 获取昨天的日期
    const yesterday = new Date(today);

    if (isScheduled) {
      noop()
    } else {
      yesterday.setDate(today.getDate() - 1);
    }

    // 获取年、月、日信息
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai'
    };
    const yesterdayDateString = yesterday.toLocaleString('zh-CN', options);
    const [year, month, day] = yesterdayDateString.split('/').map(Number);

    return {year, month, day};
  }

  function getYesterdayDateString(): string {
    // 获取当前时间
    const today = new Date();
    // 获取昨天的日期
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    // 设置时区为中国标准时间
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai'
    };
    // 格式化日期为字符串
    return yesterday.toLocaleString('zh-CN', options);
  }

  function getCurrentBeijingTime(): string {
    const beijingTime = new Date().toLocaleString("zh-CN", {timeZone: "Asia/Shanghai"});
    const date = beijingTime.split(" ")[0];
    const time = beijingTime.split(" ")[1];

    return `${date} ${time}`;
  }

  function getSortedDragons(records: MessageCounterRecord[]): [string, number][] {
    const dragonsMap: { [userId: string]: number } = {};
    for (const dragon of records) {
      const {userId, totalPostCount} = dragon;
      const key = `${userId}`;
      dragonsMap[key] = (dragonsMap[key] || 0) + totalPostCount;
    }

    return Object.entries(dragonsMap).sort((a, b) => b[1] - a[1]);
  }

  async function day() {
    await resetCounter('message_counter_records', 'todayPostCount', '今日发言榜已成功置空！');
  }

  // 创建每天的 0 点定时任务
  const dayJob = schedule.scheduleJob('0 0 * * *', day);

  async function week() {
    await resetCounter('message_counter_records', 'thisWeekPostCount', '本周发言榜已成功置空！');
  }

  // 创建每周一的 0 点定时任务
  const weekJob = schedule.scheduleJob('0 0 * * 1', week);

  async function month() {
    await resetCounter('message_counter_records', 'thisMonthPostCount', '本月发言榜已成功置空！');
  }

  // 创建每月的 1 号 0 点定时任务
  const monthJob = schedule.scheduleJob('0 0 1 * *', month);

  async function year() {
    await resetCounter('message_counter_records', 'thisYearPostCount', '今年发言榜已成功置空！');
  }

  // 创建每年的 1 月 1 号 0 点定时任务
  const yearJob = schedule.scheduleJob('0 0 1 1 *', year);

  function disposeJobs() {
    dayJob.cancel();
    weekJob.cancel();
    monthJob.cancel();
    yearJob.cancel();
    scheduledJobs.forEach(job => {
      job.cancel();
    });
  }

  const exitListener = () => disposeJobs();

  if (process.listenerCount('exit') === 0) {
    process.on('exit', exitListener);
  }

  if (process.listenerCount('SIGINT') === 0) {
    process.on('SIGINT', exitListener);
  }

  if (process.listenerCount('SIGTERM') === 0) {
    process.on('SIGTERM', exitListener);
  }

  ctx.on('dispose', () => {
    // 在插件停用时取消所有定时任务
    disposeJobs()
  })
}
