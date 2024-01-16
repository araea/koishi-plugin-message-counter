import { Context, Logger, Schema, sleep } from 'koishi'

import schedule from 'node-schedule';

export const name = 'message-counter'
export const usage = `## 🎮 使用

- 该插件仅记录群聊消息，私聊消息不会被统计。🙈
- 该插件建议为指令添加指令别名，以方便用户快速查询。🚀

## 📝 命令

- \`messageCounter\`：查看 messageCounter 帮助。❓
- \`messageCounter.初始化\`：初始化，清空数据表，将插件还原，需要权限等级 3 级及以上。🙏
- \`messageCounter.查询 [targetUser]\`：查询指定用户的发言次数信息（次数[排名]）。🔍
  - \`-d\`：今日发言次数[排名]。🌞
  - \`-w\`：本周发言次数[排名]。🌙
  - \`-m\`：本月发言次数[排名]。📅
  - \`-y\`：今年发言次数[排名]。🎊
  - \`-t\`：总发言次数[排名]。👑
  - \`--dag\`：跨群今日发言总次数[排名]。👑
  - \`-a\`：跨群发言总次数[排名]。🐲
- \`messageCounter.排行榜 [number]\`：发言排行榜，可以指定显示的人数，也可以使用以下选项来指定排行榜的类型：🏆
  - \`-d\`：今日发言榜。🌞
  - \`-w\`：本周发言榜。🌙
  - \`-m\`：本月发言榜。📅
  - \`-y\`：今年发言榜。🎊
  - \`-t\`：总发言榜。👑
  - \`--dag\`：跨群今日发言榜。👑
  - \`--dragon\`：圣龙王榜，显示每个用户在所有群中的总发言次数。🐲
  - 若未指定排行榜类型，则默认为今日发言榜。💬`

const logger = new Logger('messageCounter')

export interface Config {
  defaultMaxDisplayCount: number
  isBotMessageTrackingEnabled: boolean
  autoPush: boolean
  leaderboardGenerationWaitTime
  pushGuildIds
  enableMostActiveUserMuting: boolean
  dragonKingDetainmentTime
  muteGuildIds
  detentionDuration
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    defaultMaxDisplayCount: Schema.number()
      .min(0).default(20).description('排行榜默认显示的人数，默认值为 20。'),
    isBotMessageTrackingEnabled: Schema.boolean().default(false).description('是否统计 Bot 自己发送的消息。'),
  }),
  Schema.intersect([
    Schema.object({
      autoPush: Schema.boolean().default(false).description('是否自动推送排行榜'),
    }),
    Schema.union([
      Schema.object({
        autoPush: Schema.const(true).required(),
        leaderboardGenerationWaitTime: Schema.number().min(0).default(3).description(`自动生成排行榜的等待时间，单位是秒。`),
        pushGuildIds: Schema.array(String).role('table').description('启用自动推送排行榜功能的群组列表。'),
      }), Schema.object({}),]),
  ]),
  Schema.intersect([
    Schema.object({ enableMostActiveUserMuting: Schema.boolean().default(false).description('是否禁言每天发言最多的人，即龙王。'), }),
    Schema.union([
      Schema.object({
        enableMostActiveUserMuting: Schema.const(true).required(),
        dragonKingDetainmentTime: Schema.number().min(0).default(5).description(`关押龙王的等待时间，单位是秒。`),
        detentionDuration: Schema.number().default(1).description(`关押时长，单位是天。`),
        muteGuildIds: Schema.array(String).role('table').description('生效的群组。'),
      }),
      Schema.object({}),
    ]),
  ]),]) as any

declare module 'koishi' {
  interface Tables {
    message_counter_records: MessageCounterRecord;

  }
}

interface MessageCounterRecord {
  id: number;
  guildId: string;
  userId: string;
  username: string;
  todayPostCount: number;
  thisWeekPostCount: number;
  thisMonthPostCount: number;
  thisYearPostCount: number;
  totalPostCount: number;
}

export function apply(ctx: Context, config: Config) {

  const { autoPush, defaultMaxDisplayCount, isBotMessageTrackingEnabled, enableMostActiveUserMuting, pushGuildIds,
    muteGuildIds, detentionDuration, dragonKingDetainmentTime, leaderboardGenerationWaitTime } = config

  ctx.model.extend('message_counter_records', {
    id: 'unsigned',
    guildId: 'string',
    userId: 'string',
    username: 'string',
    todayPostCount: 'integer',
    thisWeekPostCount: 'integer',
    thisMonthPostCount: 'integer',
    thisYearPostCount: 'integer',
    totalPostCount: 'integer',
  }, { primary: 'id', autoInc: true, });

  // 限定在群组中
  ctx = ctx.guild()

  ctx.on('message', async (session) => {
    const { guildId, userId, username } = session
    // 判断该用户是否在数据表中
    const getUser = await ctx.database.get('message_counter_records', { guildId, userId })
    if (getUser.length === 0) {
      await ctx.database.create('message_counter_records', { guildId, userId, username, todayPostCount: 1, thisWeekPostCount: 1, thisMonthPostCount: 1, thisYearPostCount: 1, totalPostCount: 1 })
    } else {
      const user = getUser[0]
      await ctx.database.set('message_counter_records', { guildId, userId }, {
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
        const { guildId, bot } = session
        // 判断该用户是否在数据表中
        const getUser = await ctx.database.get('message_counter_records', { guildId, userId: bot.user.id })
        if (getUser.length === 0) {
          await ctx.database.create('message_counter_records', { guildId, userId: bot.user.id, username: bot.user.name, todayPostCount: 1, thisWeekPostCount: 1, thisMonthPostCount: 1, thisYearPostCount: 1, totalPostCount: 1 })
        } else {
          const user = getUser[0]
          await ctx.database.set('message_counter_records', { guildId, userId: bot.user.id }, {
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
  // mc*
  ctx.command('messageCounter', '查看messageCounter帮助')
    .action(async ({ session }) => {
      await session.execute(`messageCounter -h`);
    });
  // csh*
  ctx.command('messageCounter.初始化', '初始化', { authority: 3 })
    .action(async ({ session }) => {
      await session.send('嗯~')
      await ctx.database.remove('message_counter_records', {})
      await session.send('好啦~')
    });
  // cx* Query
  ctx.command('messageCounter.查询 [targetUser:text]', '查询')
    .option('day', '-d 今日发言次数[排名]')
    .option('week', '-w 本周发言次数[排名]')
    .option('month', '-m 本月发言次数[排名]')
    .option('year', '-y 今年发言次数[排名]')
    .option('total', '-t 总发言次数[排名]')
    .option('dag', '--dag 跨群今日发言总次数[排名]')
    .option('across', '-a 跨群发言总次数[排名]')
    .action(async ({ session, options }, targetUser) => {
      // 初始化所有选项为 false
      const selectedOptions = {
        day: false,
        week: false,
        month: false,
        year: false,
        total: false,
        across: false,
        dag: false
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
      if (options.across) {
        selectedOptions.across = true;
      }
      if (options.dag) {
        selectedOptions.dag = true;
      }

      // 如果没有选项被选择，则将所有选项设置为 true
      const allOptionsSelected = Object.values(selectedOptions).every(value => value === false);
      if (allOptionsSelected) {
        Object.keys(selectedOptions).forEach(key => {
          selectedOptions[key] = true;
        });
      }

      const { day, week, month, year, total, across, dag } = selectedOptions;
      // selectedOptions 对象包含了用户选择的选项

      // 查询： 直接获取 返回提示 跨群总榜
      let { guildId, userId, username } = session
      if (targetUser) {
        const userIdRegex = /<at id="([^"]+)"(?: name="([^"]+)")?\/>/;
        const match = targetUser.match(userIdRegex);
        userId = match?.[1] ?? userId;
        username = match?.[2] ?? username;
      }
      const targetUserRecord = await ctx.database.get('message_counter_records', { guildId, userId })
      if (targetUserRecord.length === 0) {
        await ctx.database.create('message_counter_records', { guildId, userId, username })
        return `查询对象：${username}

无任何发言记录。`
      }
      const guildUsers: MessageCounterRecord[] = await ctx.database.get('message_counter_records', { guildId });

      // 获取 userId 对应对象的各种种类的排名数据
      const getUserRanking = (userId: string) => {
        const userRecords = guildUsers.find(user => user.userId === userId);
        if (userRecords) {
          const rankingData = {
            todayRank: getRank('todayPostCount', userId),
            thisWeekRank: getRank('thisWeekPostCount', userId),
            thisMonthRank: getRank('thisMonthPostCount', userId),
            thisYearRank: getRank('thisYearPostCount', userId),
            totalRank: getRank('totalPostCount', userId)
          };
          return rankingData;
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

      const { todayRank, thisWeekRank, thisMonthRank, thisYearRank, totalRank } = userRankingData

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
      const getDragons = await ctx.database.get('message_counter_records', {});
      const dragons = getSortedDragons(getDragons)
      const acrossRank = getAcrossUserRank(userId, dragons);

      const userRecords: MessageCounterRecord[] = await ctx.database.get('message_counter_records', { userId });

      // 使用 reduce 方法计算跨群总发言次数
      const totalPostCountAcrossGuilds = userRecords.reduce((total, record) => {
        return total + record.totalPostCount;
      }, 0);

      // 跨群今日发言总次数和排名信息
      const getUsers = await ctx.database.get('message_counter_records', {});
      if (getUsers.length === 0) {
        return;
      }
      // 创建新数组
      const aggregatedUserRecords: { [key: string]: { userId: string, todayPostCountAll: number, username: string } } = getUsers.reduce((acc, user) => {
        if (!acc[user.userId]) {
          acc[user.userId] = {
            userId: user.userId,
            todayPostCountAll: 0,
            username: user.username
          };
        }
        acc[user.userId].todayPostCountAll += user.todayPostCount;
        return acc;
      }, {});

      // 转换为数组并按 todayPostCountAll 降序排序
      const sortedUserRecords = Object.values(aggregatedUserRecords).sort((a, b) => b.todayPostCountAll - a.todayPostCountAll);


      // 找到 userId 对应的记录
      const userIndex = sortedUserRecords.findIndex(user => user.userId === userId);
      const userRecord = sortedUserRecords[userIndex];
      const dayAcrossRank = userIndex + 1; // 排名从 1 开始

      const { todayPostCount, thisWeekPostCount, thisMonthPostCount, thisYearPostCount, totalPostCount } = targetUserRecord[0]


      let message = `查询对象：${username}\n\n`;

      if (day) {
        message += `今日发言次数[排名]：${todayPostCount}[${todayRank}]\n`;
      }
      if (week) {
        message += `本周发言次数[排名]：${thisWeekPostCount}[${thisWeekRank}]\n`;
      }
      if (month) {
        message += `本月发言次数[排名]：${thisMonthPostCount}[${thisMonthRank}]\n`;
      }
      if (year) {
        message += `今年发言次数[排名]：${thisYearPostCount}[${thisYearRank}]\n`;
      }
      if (total) {
        message += `总发言次数[排名]：${totalPostCount}[${totalRank}]\n`;
      }
      if (dag) {
        message += `跨群今日发言次数[排名]：${userRecord.todayPostCountAll}[${dayAcrossRank}]\n`;
      }
      if (across) {
        message += `跨群发言总次数[排名]：${totalPostCountAcrossGuilds}[${acrossRank}]\n`;
      }

      // 返回消息
      return message;
    });

  // phb* r*
  ctx.command('messageCounter.排行榜 [number:number]', '发言排行榜')
    .option('day', '-d 今日发言榜')
    .option('week', '-w 本周发言榜')
    .option('month', '-m 本月发言榜')
    .option('year', '-y 今年发言榜')
    .option('total', '-t 总发言榜')
    .option('dag', '--dag 跨群日发言榜')
    .option('dragon', '--dragon 圣龙王榜')
    .action(async ({ session, options }, number) => {
      const { guildId } = session;

      if (!number) {
        number = defaultMaxDisplayCount;
      }

      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return '请输入大于等于 0 的数字作为排行榜的参数。';
      }

      const getUsers = await ctx.database.get('message_counter_records', { guildId });
      if (getUsers.length === 0) {
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
      } else {
        sortByProperty = 'todayPostCount';
        countProperty = '今日发言次数';
      }

      if (options.dag) {
        const getUsers = await ctx.database.get('message_counter_records', {});
        if (getUsers.length === 0) {
          return;
        }

        // 处理 getUsers 数组，生成排行榜 rank
        const userMap = new Map(); // 用于存储 userId 对应的总 todayPostCountAll
        const usernameMap = new Map(); // 用于存储 userId 对应的 username

        // 遍历 getUsers，将所有 userId 相同的记录的 todayPostCount 全部加在一起
        for (const user of getUsers) {
          const { userId, todayPostCount, username } = user;
          if (userMap.has(userId)) {
            userMap.set(userId, userMap.get(userId) + todayPostCount);
          } else {
            userMap.set(userId, todayPostCount);
            usernameMap.set(userId, username);
          }
        }

        // 将 userMap 转换为数组并按 todayPostCountAll 降序排序
        const sortedUsers = Array.from(userMap).sort((a, b) => b[1] - a[1]).slice(0, number);

        // 生成排行榜 rank
        let rank = '排行榜：跨群今日总发言次数：\n';
        sortedUsers.forEach((user, index) => {
          const userId = user[0];
          const todayPostCountAll = user[1];
          const username = usernameMap.get(userId);
          rank += `${index + 1}. ${username}: ${todayPostCountAll}\n`;
        });

        return (rank);
      }

      if (options.dragon) {
        const getDragons = await ctx.database.get('message_counter_records', {});
        if (getDragons.length === 0) {
          return;
        }

        const dragons = getSortedDragons(getDragons)

        // 只保留前 number 个用户
        const topDragons = dragons.slice(0, number);

        // 获取用户信息并构建结果数组
        const resultPromises = topDragons.map(async ([key, dragonPostCount], index) => {
          const getUser = await ctx.database.get('message_counter_records', { userId: key });
          const user = getUser[0];
          if (user) {
            return `${index + 1}. ${user.username}: ${dragonPostCount}`;
          }
          return null;
        });

        const result = (await Promise.all(resultPromises)).filter((item) => item !== null) as string[];

        await session.send(`圣龙王榜: \n${result.join('\n')}`);
        return;
      }


      getUsers.sort((a, b) => b[sortByProperty] - a[sortByProperty]);
      const topUsers = getUsers.slice(0, number);
      let i = 1;
      const result = topUsers.map(user => `${i++}. ${user.username}: ${user[sortByProperty]}`).join('\n');
      await session.send(`排行榜: ${countProperty}\n${result}`);
    });

  async function resetCounter(_key, countKey: string, message: string) {
    // countKey 排行榜类型 message 成功清除消息
    const getUsers = await ctx.database.get('message_counter_records', {});
    if (getUsers.length === 0) {
      return;
    }
    // autoPush
    if (autoPush) {
      // 遍历 bots 获取 bot 信息，以便发送信息
      for (const currentBot of ctx.bots) {
        // 遍历 pushGuildIds 字符串数组 为每一个群组发送排行榜信息
        pushGuildIds.map(async (guildId) => {
          // 获取推送群组中的用户发言信息
          const usersByGuild = getUsers.filter(user => user.guildId === guildId);
          // 根据 countKey 类型，对数据进行排序，并返回最终排行榜结果
          // 有数据再继续
          if (usersByGuild.length !== 0) {

            let sortByProperty: string;
            let countProperty: string;

            switch (countKey) {
              case 'todayPostCount':
                sortByProperty = 'todayPostCount';
                countProperty = '今日发言次数';
                break;
              case 'thisWeekPostCount':
                sortByProperty = 'thisWeekPostCount';
                countProperty = '本周发言次数';
                break;
              case 'thisMonthPostCount':
                sortByProperty = 'thisMonthPostCount';
                countProperty = '本月发言次数';
                break;
              case 'thisYearPostCount':
                sortByProperty = 'thisYearPostCount';
                countProperty = '今年发言次数';
                break;
              default:
                return; // 这种情况理论上不会出现
            }

            await currentBot.sendMessage(guildId, `正在尝试自动生成${countProperty}榜......`);
            usersByGuild.sort((a, b) => b[sortByProperty] - a[sortByProperty]);
            const topUsers = usersByGuild.slice(0, defaultMaxDisplayCount);
            const result = topUsers.map((user, index) => `${index + 1}. ${user.username}: ${user[sortByProperty]}`).join('\n');
            await sleep(leaderboardGenerationWaitTime * 1000)
            await currentBot.sendMessage(guildId, `排行榜: ${countProperty}\n${result}`);
          }
        });
      }
    }

    // enableMostActiveUserMuting
    if (enableMostActiveUserMuting && countKey === 'todayPostCount') {
      // 遍历 bots 获取 bot 信息，以便发送信息
      for (const currentBot of ctx.bots) {
        // 遍历 pushGuildIds 字符串数组 为每一个群组禁言龙王
        muteGuildIds.map(async (guildId) => {
          // 找到那个在当前群聊中每日发言最多的人
          // 获取当前群组中的用户发言信息
          const usersByGuild = getUsers.filter(user => user.guildId === guildId);
          // 有数据再继续
          if (usersByGuild.length !== 0) {
            await currentBot.sendMessage(guildId, `正在尝试自动捕捉龙王......`);
            // 拉出来
            const dragonUser = usersByGuild[0]
            try {
              // 禁言当前群组里的龙王 1 天
              await sleep(dragonKingDetainmentTime * 1000)
              await currentBot.muteGuildMember(guildId, dragonUser.userId, detentionDuration * 24 * 60 * 60 * 1000);
              await currentBot.sendMessage(guildId, `诸位请放心，龙王已被成功捕捉，关押时间为 ${detentionDuration} 天！`);
            } catch (error) {
              logger.error(`在【${guildId}】中禁言用户【${dragonUser.username}】（${dragonUser.userId}）失败！${error}`);
            }
          }
        })
      }
    }
    // 排行榜推送和禁言龙王搞定之后
    // 该干正事了 置零！
    await ctx.database.set('message_counter_records', {}, { [countKey]: 0 });

    logger.success(message);
  }

  function getSortedDragons(records: MessageCounterRecord[]): [string, number][] {
    const dragonsMap: { [userId: string]: number } = {};
    for (const dragon of records) {
      const { userId, totalPostCount } = dragon;
      const key = `${userId}`;
      dragonsMap[key] = (dragonsMap[key] || 0) + totalPostCount;
    }

    const dragons = Object.entries(dragonsMap).sort((a, b) => b[1] - a[1]);
    return dragons;
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
  }

  // 当应用程序退出时，取消所有定时任务
  process.on('exit', disposeJobs);
  process.on('SIGINT', disposeJobs);
  process.on('SIGTERM', disposeJobs);

  ctx.on('dispose', () => {
    // 在插件停用时取消所有定时任务
    disposeJobs()
  })
}
