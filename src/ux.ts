// Shared source: koishi-plugin-markdown-to-image-service/src/ux.ts
// Generated copies are checked by scripts/sync-design-system.mjs.
import { Context, h, Session } from 'koishi'

const KEY = Symbol.for('araea.koishi.ux.v1')
type Owner = { name: string; matches: (session: Session) => boolean | Promise<boolean> }
interface State { owners: Set<Owner> }
function state(ctx: Context): State {
  const root = ctx.root as any
  return root[KEY] ??= { owners: new Set() }
}

/** 渲染图优先，只发图片；图片缺失时才退回等价文字。 */
export function present(image: h.Fragment | null | undefined, text: h.Fragment): h.Fragment {
  return image ? h.normalize(image) : text
}

/** Plugins register their active input grammar; overlapping messages are never executed. */
export function registerDirectInput(ctx: Context, name: string, matches: Owner['matches']) {
  const owner = { name, matches }
  state(ctx).owners.add(owner)
  ctx.on('dispose', () => { state(ctx).owners.delete(owner) })
}

export async function directInputConflict(ctx: Context, session: Session): Promise<boolean> {
  if (session.event.user?.isBot) return true
  const owners: string[] = []
  for (const owner of state(ctx).owners) {
    try { if (await owner.matches(session)) owners.push(owner.name) }
    catch { /* An unavailable game cannot claim input. Its explicit command reports the error. */ }
  }
  if (owners.length < 2) return false
  await session.send(`这条消息同时适用于 ${owners.join('、')}，尚未执行。请使用对应游戏的完整指令。`)
  return true
}

/** 等待下一句回复。提问本身已经写明了可回复的内容与「取消」，这里不再追加说明。 */
export function promptInput(session: Session): Promise<string | undefined> {
  return session.prompt(300000)
}
