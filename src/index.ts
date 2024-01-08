import { Context, Logger, Schema } from 'koishi'

import schedule from 'node-schedule';

export const name = 'message-counter'
export const usage = `## 🎮 使用

- 该插件仅记录群聊消息，私聊消息不会被统计。🙈
- 该插件建议为指令添加指令别名，以方便用户快速查询。🚀

## ⚙️ 配置项

- \`defaultMaxDisplayCount\`：默认显示的人数，默认为 \`20\`。👥
- \`isBotMessageTrackingEnabled\`：是否统计机器人自己发送的消息，默认为 \`false\`。🤖
- \`autoPush\`：是否自动推送排行榜，默认为 \`false\`。👌
  - \`pushGuildIds\`：启用自动推送排行榜功能的群组列表。⌚️
- \`enableMostActiveUserMuting\`：是否禁言每天发言最多的用户，即龙王，默认为 \`false\`。🙊
  - \`detentionDuration\`：关押时长，单位是天，默认为 \`1\`。🙊
  - \`muteGuildIds\`：启用关押龙王功能的群组列表。⌚️

## 📝 命令

- \`messageCounter\`：查看 messageCounter 帮助。❓
- \`messageCounter.initialize\`：初始化，清空数据表，将插件还原，需要权限等级 3 级及以上。🙏
- \`messageCounter.rank [number]\`：发言排行榜，可以指定显示的人数，也可以使用以下选项来指定排行榜的类型：🏆
  - \`-d\`：今日发言榜。🌞
  - \`-w\`：本周发言榜。🌙
  - \`-m\`：本月发言榜。📅
  - \`-y\`：今年发言榜。🎊
  - \`-t\`：总发言榜。👑
  - \`--dragon\`：圣龙王榜，显示每个用户在所有群中的总发言次数。🐲
  - 若未指定排行榜类型，则默认为今日发言榜。💬`

const logger = new Logger('messageCounter')

export interface Config {
  defaultMaxDisplayCount: number
  isBotMessageTrackingEnabled: boolean
  autoPush: boolean
  pushGuildIds
  enableMostActiveUserMuting: boolean
  muteGuildIds
  detentionDuration
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    defaultMaxDisplayCount: Schema.number()
      .min(0).default(20).description('默认显示的人数。'),
    isBotMessageTrackingEnabled: Schema.boolean().default(false).description('是否统计 Bot 自己发送的消息。'),
  }),
  Schema.intersect([
    Schema.object({
      autoPush: Schema.boolean().default(false).description('是否自动推送排行榜'),
    }),
    Schema.union([
      Schema.object({
        autoPush: Schema.const(true).required(),
        pushGuildIds: Schema.array(String).role('table').description('启用自动推送排行榜功能的群组列表。'),
      }), Schema.object({}),]),
  ]),
  Schema.intersect([
    Schema.object({ enableMostActiveUserMuting: Schema.boolean().default(false).description('是否禁言每天发言最多的人，即龙王。'), }),
    Schema.union([
      Schema.object({
        enableMostActiveUserMuting: Schema.const(true).required(),
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

  const { autoPush, defaultMaxDisplayCount, isBotMessageTrackingEnabled, enableMostActiveUserMuting, pushGuildIds, muteGuildIds, detentionDuration } = config

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

  ctx.command('messageCounter', '查看messageCounter帮助')
    .action(async ({ session }) => {
      await session.execute(`messageCounter -h`);
    });

  ctx.command('messageCounter.initialize', '初始化', { authority: 3 })
    .action(async ({ session }) => {
      await session.send('嗯~')
      await ctx.database.remove('message_counter_records', {})
      await session.send('好啦~')
    });

  ctx.command('messageCounter.rank [number:number]', '发言排行榜')
    .option('day', '-d 今日发言榜')
    .option('week', '-w 本周发言榜')
    .option('month', '-m 本月发言榜')
    .option('year', '-y 今年发言榜')
    .option('total', '-t 总发言榜')
    .option('dragon', '--dragon 圣龙王榜')
    .action(async ({ session, options }, number) => {
      const { guildId } = session;

      if (!number) {
        number = defaultMaxDisplayCount;
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

      if (options.dragon) {
        const getDragons = await ctx.database.get('message_counter_records', {});
        if (getDragons.length === 0) {
          return;
        }

        const dragonsMap = new Map<string, number>(); // 用于存储每个 userId 对应的总发言次数

        for (const dragon of getDragons) {
          const { userId, totalPostCount } = dragon;
          const key = `${userId}`;

          if (dragonsMap.has(key)) {
            // 如果已经存在同一个 userId 的记录，则累加总发言次数
            dragonsMap.set(key, dragonsMap.get(key)! + totalPostCount);
          } else {
            // 否则，添加新的记录
            dragonsMap.set(key, totalPostCount);
          }
        }

        // 将 dragonsMap 转换为数组，并按照总发言次数降序排序
        const dragons = Array.from(dragonsMap.entries()).sort((a, b) => b[1] - a[1]);

        // 只保留前 number 个用户
        const topDragons = dragons.slice(0, number);

        const result = [];
        let i = 1;
        for (const [key, dragonPostCount] of topDragons) {
          const getUser = await ctx.database.get('message_counter_records', { userId: key }); // 假设可以根据 userId 查询用户信息的方法为 ctx.database.get，并且返回一个用户对象
          const user = getUser[0];
          if (user) {
            result.push(`${i++}. ${user.username}: ${dragonPostCount}`);
          }
        }

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
