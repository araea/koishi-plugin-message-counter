import { $, Context, Query } from 'koishi'

export type CountField =
  | 'todayPostCount'
  | 'yesterdayPostCount'
  | 'thisWeekPostCount'
  | 'thisMonthPostCount'
  | 'thisYearPostCount'
  | 'totalPostCount'

export interface RankRow {
  /** 用户榜是 userId，群榜是 channelId。 */
  key: string
  name: string
  avatar: string
  count: number
}

export interface RankResult {
  rows: RankRow[]
  /** 参与统计的全部消息数，用于算占比。 */
  total: number
  /** 被置顶的那一行在完整榜单里的名次，未上榜时为 undefined。 */
  pinnedRank?: number
}

export interface RankQuery {
  field: CountField
  /** 限定频道（本群榜）。 */
  channelId?: string
  /** 限定用户（某人的群榜）。 */
  userId?: string
  whites?: string[]
  blacks?: string[]
  /** 取前几名，0 表示全部。 */
  limit: number
  /** 即便没上榜也要出现在结果里的 key。 */
  pin?: string
}

const QQ_AVATAR = (userId: string) => `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
const QQ_GROUP_AVATAR = (channelId: string) => {
  const id = channelId === '#' ? '426230045' : channelId
  return `https://p.qlogo.cn/gh/${id}/${id}/100`
}

function buildQuery(by: 'userId' | 'channelId', query: RankQuery) {
  const where: Query.Expr<any> = {}
  if (query.channelId) where.channelId = query.channelId
  if (query.userId) where.userId = query.userId
  // 名单过滤下推到数据库，不必把整张表拉进内存再筛
  const filters: any = {}
  if (query.whites?.length) filters.$in = query.whites
  if (query.blacks?.length) filters.$nin = query.blacks
  if (Object.keys(filters).length) where[by] = { ...(where[by] as object), ...filters }
  return where
}

/**
 * 按用户或频道聚合排行榜。
 * 求和、排序、截断全部交给数据库，只有前 N 行会进内存。
 */
async function rank(ctx: Context, by: 'userId' | 'channelId', query: RankQuery): Promise<RankResult> {
  const where = buildQuery(by, query)
  const { field } = query

  const total = await ctx.database
    .select('message_counter_records')
    .where(where)
    .execute((row) => $.sum(row[field])) ?? 0

  const nameField = by === 'userId' ? 'username' : 'channelName'
  const selection = ctx.database
    .select('message_counter_records')
    .where(where)
    .groupBy(by, (row) => ({
      count: $.sum(row[field]),
      name: $.max(row[nameField]),
      avatar: by === 'userId' ? $.max(row.userAvatar) : $.max(row.channelId),
    }))
    .orderBy('count', 'desc')

  const top = await (query.limit > 0 ? selection.limit(query.limit) : selection).execute()

  const toRow = (item: any): RankRow => ({
    key: item[by],
    name: item.name || (by === 'userId' ? `用户${item[by]}` : `群聊${item[by]}`),
    avatar: by === 'userId' ? (item.avatar || QQ_AVATAR(item[by])) : QQ_GROUP_AVATAR(item[by]),
    count: item.count ?? 0,
  })

  const rows = top.map(toRow)
  let pinnedRank: number

  // 被名单过滤掉的人不该因为「置顶」又被塞回榜单
  const pinAllowed = query.pin
    && !(query.whites?.length && !query.whites.includes(query.pin))
    && !query.blacks?.includes(query.pin)

  if (pinAllowed && !rows.some((row) => row.key === query.pin)) {
    const [pinned] = await ctx.database
      .select('message_counter_records')
      .where({ ...where, [by]: query.pin })
      .groupBy(by, (row) => ({
        count: $.sum(row[field]),
        name: $.max(row[nameField]),
        avatar: by === 'userId' ? $.max(row.userAvatar) : $.max(row.channelId),
      }))
      .execute()
    if (pinned) {
      // 名次 = 比他多的人数 + 1，同样在数据库里数，不用把全榜拉下来
      const ahead = await ctx.database
        .select('message_counter_records')
        .where(where)
        .groupBy(by, (row) => ({ count: $.sum(row[field]) }))
        .execute()
      pinnedRank = ahead.filter((item) => item.count > (pinned as any).count).length + 1
      rows.push(toRow(pinned))
    }
  }

  return { rows, total, pinnedRank }
}

export const rankUsers = (ctx: Context, query: RankQuery) => rank(ctx, 'userId', query)
export const rankChannels = (ctx: Context, query: RankQuery) => rank(ctx, 'channelId', query)

/** 某人在指定范围内的名次与发言数。 */
export async function lookup(ctx: Context, query: RankQuery & { pin: string }) {
  const where = buildQuery('userId', query)
  const grouped = await ctx.database
    .select('message_counter_records')
    .where(where)
    .groupBy('userId', (row) => ({ count: $.sum(row[query.field]) }))
    .execute()

  const mine = grouped.find((item) => item.userId === query.pin)
  if (!mine) return null
  return {
    count: mine.count ?? 0,
    rank: grouped.filter((item) => (item.count ?? 0) > (mine.count ?? 0)).length + 1,
    total: grouped.reduce((sum, item) => sum + (item.count ?? 0), 0),
  }
}

export const PERIODS = {
  yesterday: { field: 'yesterdayPostCount', label: '昨日' },
  today: { field: 'todayPostCount', label: '今日' },
  week: { field: 'thisWeekPostCount', label: '本周' },
  month: { field: 'thisMonthPostCount', label: '本月' },
  year: { field: 'thisYearPostCount', label: '全年' },
  total: { field: 'totalPostCount', label: '总计' },
} as const satisfies Record<string, { field: CountField; label: string }>

export type PeriodKey = keyof typeof PERIODS

export type Summary = { userId: string } & Record<PeriodKey, number>

/**
 * 一次查询拿到范围内每个用户六个时段的发言数。
 * 求和在数据库里完成，返回的是每人一行，而不是每人每群一行。
 */
export async function summarize(ctx: Context, where: Query.Expr<any>): Promise<Summary[]> {
  const rows = await ctx.database
    .select('message_counter_records')
    .where(where)
    .groupBy('userId', (row) => ({
      yesterday: $.sum(row.yesterdayPostCount),
      today: $.sum(row.todayPostCount),
      week: $.sum(row.thisWeekPostCount),
      month: $.sum(row.thisMonthPostCount),
      year: $.sum(row.thisYearPostCount),
      total: $.sum(row.totalPostCount),
    }))
    .execute()
  return rows as Summary[]
}

/** 从 summarize 的结果里取出某人在某时段的发言数、占比分母与名次。 */
export function statOf(rows: Summary[], userId: string, period: PeriodKey) {
  let count = 0
  let total = 0
  let ahead = 0
  let found = false
  for (const row of rows) {
    const value = row[period] ?? 0
    total += value
    if (row.userId === userId) { count = value; found = true } 
  }
  if (!found) return { count: 0, total, rank: null as number | null }
  for (const row of rows) if ((row[period] ?? 0) > count) ahead++
  return { count, total, rank: ahead + 1 }
}
