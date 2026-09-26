import { randomUUID } from 'node:crypto'
/** Per-user, per-channel confirmation; the caller enforces authority 3. */
export function createClearAction(database: any, now: () => number = Date.now) {
  const requests = new Map<string, {token: string; expires: number}>()
  return async ({session, options}: any) => {
    if (!session) return
    const key = `${session.platform}:${session.selfId}:${session.userId}:${session.channelId}`
    const pending = requests.get(key)
    if (!options.confirm) {
      const count = (await database.get('message_counter_records', {})).length
      const token = randomUUID().slice(0, 8)
      requests.set(key, {token, expires: now() + 300000})
      return `将清空所有频道的全部发言记录（当前 ${count} 条，含确认前新增的记录），此操作无法撤销。\n如确认，请在 5 分钟内发送「msgcount.清空记录 --confirm ${token}」。不发送确认即取消。`
    }
    if (!pending || pending.token !== options.confirm || pending.expires < now()) return '确认码无效或已过期。请重新发送「msgcount.清空记录」预览。'
    requests.delete(key)
    await database.remove('message_counter_records', {})
    return '所有频道的发言记录已清空。'
  }
}
