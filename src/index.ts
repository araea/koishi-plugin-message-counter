import { Context, Logger, Schema } from 'koishi'

import cron from 'node-cron';
import schedule from 'node-schedule';

export const name = 'message-counter'
export const usage = `## 🎮 使用

- 该插件仅记录群聊消息，私聊消息不会被统计。🙈
- 该插件建议为指令添加指令别名，以方便用户快速查询。🚀

## ⚙️ 配置项

- \`autoPush\`：是否自动推送排行榜，默认为 \`true\`。👌
- \`defaultMaxDisplayCount\`：默认显示的人数，默认为 \`20\`。👥
- \`isBotMessageTrackingEnabled\`：是否统计机器人自己发送的消息，默认为 \`false\`。🤖
- \`enableMostActiveUserMuting\`：是否禁言每天发言最多的用户，即龙王，默认为 \`false\`。🙊

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
  autoPush: boolean
  defaultMaxDisplayCount: number
  isBotMessageTrackingEnabled: boolean
  enableMostActiveUserMuting: boolean
}

export const Config: Schema<Config> = Schema.object({
  autoPush: Schema.boolean().default(true).description('是否自动推送排行榜'),
  defaultMaxDisplayCount: Schema.number()
    .min(0).default(20).description('默认显示的人数。'),
  isBotMessageTrackingEnabled: Schema.boolean().default(false).description('是否统计 Bot 自己发送的消息。'),
  enableMostActiveUserMuting: Schema.boolean().default(false).description('是否禁言每天发言最多的人，即龙王。'),
})

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

  const { autoPush, defaultMaxDisplayCount, isBotMessageTrackingEnabled, enableMostActiveUserMuting } = config

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
        const { guildId, bot, username } = session
        // 判断该用户是否在数据表中
        const getUser = await ctx.database.get('message_counter_records', { guildId, userId: bot.selfId })
        if (getUser.length === 0) {
          await ctx.database.create('message_counter_records', { guildId, userId: bot.selfId, username: bot.user.name, todayPostCount: 1, thisWeekPostCount: 1, thisMonthPostCount: 1, thisYearPostCount: 1, totalPostCount: 1 })
        } else {
          const user = getUser[0]
          await ctx.database.set('message_counter_records', { guildId, userId: bot.selfId }, {
            username,
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

  // ctx.on('ready', () => {
  // 初始化定时任务
  scheduleWeek(); // week
  scheduleMonthlyClear(); // month
  // logger.success('加载成功，定时任务已全部就绪！')
  // })

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

  async function resetCounter(_key: string, countKey: string, message: string) {
    const getUsers = await ctx.database.get('message_counter_records', {});
    if (getUsers.length === 0) {
      return;
    }

    if (autoPush) {
      const guildIds = getUsers
        .filter(user => user.guildId)
        .map(user => user.guildId);

      await Promise.all(
        guildIds.map(async (guildId) => {
          for (const currentBot of ctx.bots) {
            const usersByGuild = await ctx.database.get('message_counter_records', { guildId });

            if (usersByGuild.length === 0) {
              return;
            }

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
            }
            await currentBot.sendMessage(guildId, `正在尝试自动生成${countProperty}榜......`);
            usersByGuild.sort((a, b) => b[sortByProperty] - a[sortByProperty]);
            const topUsers = usersByGuild.slice(0, defaultMaxDisplayCount);
            let i = 1;
            const result = topUsers.map(user => `${i++}. ${user.username}: ${user[sortByProperty]}`).join('\n');
            await currentBot.sendMessage(guildId, `排行榜: ${countProperty}\n${result}`);
            if (enableMostActiveUserMuting && countKey === 'todayPostCount') {
              await currentBot.sendMessage(guildId, `正在尝试自动捕捉龙王......`);
              try {
                await currentBot.muteGuildMember(guildId, usersByGuild[0].userId, 24 * 60 * 60 * 1000);
                await currentBot.sendMessage(guildId, `诸位请放心，龙王已被成功捕捉，关押时间为 1 天！`);
              } catch (error) {
                logger.error('禁言失败：Bot 不是管理员，无法禁言龙王！')
              }
            }
          }
        })
      );
    }


    for (const user of getUsers) {
      const { guildId, userId } = user;
      await ctx.database.set('message_counter_records', { guildId, userId }, { [countKey]: 0 });
    }
    logger.success(message);
  }
  async function day() {
    await resetCounter('message_counter_records', 'todayPostCount', '今日发言榜已成功置空！');
  }


  // 创建每天的 0 点定时任务
  const job = schedule.scheduleJob('0 0 * * *', day);

  async function week() {
    await resetCounter('message_counter_records', 'thisWeekPostCount', '本周发言榜已成功置空！');
  }

  function scheduleWeek() {
    const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000; // 一周的毫秒数
    const now = new Date();
    const dayOfWeek = now.getDay(); // 当前是星期几
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();

    // 检查当前时间是否已经过了每周的星期一的0点
    if (dayOfWeek === 1 && hours === 0 && minutes === 0 && seconds === 0 && milliseconds === 0) {
      // 如果当前时间正好是星期一的0点，则立即执行函数
      week();
    } else {
      let timeUntilNextMonday = (1 + (7 - dayOfWeek)) % 7; // 距离下一个星期一的天数

      // 如果今天已经过了零点，则调整计算下一个星期一的逻辑
      if (dayOfWeek === 1 && hours > 0) {
        timeUntilNextMonday = 7 - (hours / 24 + minutes / (24 * 60) + seconds / (24 * 60 * 60) + milliseconds / (24 * 60 * 60 * 1000));
      }

      // 计算下一个星期一的时间戳
      const nextMondayTimestamp = now.getTime() + (timeUntilNextMonday * 24 * 60 * 60 * 1000);

      // 计算距离下一个星期一0点的毫秒数
      const timeUntilNextMondayMidnight = nextMondayTimestamp - (hours * 60 * 60 * 1000) - (minutes * 60 * 1000) - (seconds * 1000) - milliseconds;
      if (timeUntilNextMondayMidnight > 0) {
        if (timeUntilNextMondayMidnight > 2147483647) {
          // 如果延迟时间超过32位整数范围，则拆分成多个定时器
          const numberOfIntervals = Math.ceil(timeUntilNextMondayMidnight / 2147483647);
          const intervalDelay = Math.ceil(timeUntilNextMondayMidnight / numberOfIntervals);

          let currentDelay = intervalDelay;
          let intervalsCompleted = 0;

          ctx.on('dispose', () => {
            clearTimeout(timerId1);
          })

          const timerId1 = setTimeout(() => {
            week();
            intervalsCompleted++;

            if (intervalsCompleted < numberOfIntervals) {
              // 设置下一个定时器
              currentDelay += intervalDelay;
              ctx.on('dispose', () => {
                clearTimeout(timerId2);
              })
              const timerId2 = setTimeout(arguments.callee, currentDelay);
            } else {
              // 设置循环定时器
              ctx.on('dispose', () => {
                clearInterval(intervalId1);
              })
              const intervalId1 = setInterval(week, oneWeekInMilliseconds);
            }
          }, currentDelay);
        } else {
          // 如果延迟时间在32位整数范围内，则直接设置定时器
          ctx.on('dispose', () => {
            clearTimeout(timerId3);
          })
          const timerId3 = setTimeout(() => {
            week();
            ctx.on('dispose', () => {
              clearInterval(intervalId2);
            })
            const intervalId2 = setInterval(week, oneWeekInMilliseconds);
          }, timeUntilNextMondayMidnight);
        }
      } else {
        week();
        ctx.on('dispose', () => {
          clearInterval(intervalId3);
        })
        const intervalId3 = setInterval(week, oneWeekInMilliseconds);
      }

    }
  }


  async function month() {
    await resetCounter('message_counter_records', 'thisMonthPostCount', '本月发言榜已成功置空！');
  }

  function scheduleMonthlyClear() {
    const rule = '0 0 1 * *'; // 在每月的第一天的0点执行
    const monthlyClearJob = schedule.scheduleJob(rule, month);
    ctx.on('dispose', () => {
      monthlyClearJob.cancel();
      job.cancel
    })
  }


  async function year() {
    await resetCounter('message_counter_records', 'thisYearPostCount', '今年发言榜已成功置空！');
  }

  // 创建定时任务
  const task = cron.schedule('0 0 1 1 *', year, {
    scheduled: true,
    timezone: 'Asia/Shanghai',
  });

  ctx.on('dispose', () => {
    task.stop()
  })

}
