// Shared source: koishi-plugin-markdown-to-image-service/src/ux.ts
// Generated copies are checked by scripts/sync-design-system.mjs.
import { Context, h, Session } from 'koishi'

const KEY = Symbol.for('araea.koishi.ux.v1')
type Owner = { name: string; matches: (session: Session) => boolean | Promise<boolean> }
interface State { modes: Map<string, boolean>; owners: Set<Owner> }
function state(ctx: Context): State {
  const root = ctx.root as any
  return root[KEY] ??= { modes: new Map(), owners: new Set() }
}
const userKey = (session: Session) => `${session.platform}:${session.selfId}:${session.userId}`

/** Default output is an image plus its usable text equivalent. Preferences affect this user only. */
export function usePresentation(ctx: Context, command: string) {
  const shared = state(ctx)
  ctx.command(`${command}.显示 [mode:string]`, '选择图文或文字输出')
    .action(({ session }, mode) => {
      if (!mode) return `当前：${shared.modes.get(userKey(session)) ? '文字' : '图文'}。发送「${command}.显示 文字」或「${command}.显示 图文」。设置对本机器人各插件生效，重启后恢复图文。`
      if (!['文字', '图文'].includes(mode)) return '请选择「文字」或「图文」。'
      shared.modes.set(userKey(session), mode === '文字')
      return `已切换为${mode}输出。`
    })
  return {
    textOnly: (session: Session) => shared.modes.get(userKey(session)) === true,
    present(session: Session, image: h.Fragment | null | undefined, text: h.Fragment): h.Fragment {
      if (!image || shared.modes.get(userKey(session))) return text
      return [...h.normalize(image), h('p', {}, h.normalize(text))]
    },
  }
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

/** No hidden time limit: users can extend the non-game input step without losing context. */
export async function promptInput(session: Session, instruction: string): Promise<string | undefined> {
  for (;;) {
    await session.send(`${instruction}\n请在 5 分钟内回复；发送「延长」重新计时，发送「取消」退出。`)
    const input = await session.prompt(300000)
    if (input?.trim() === '延长') continue
    return input
  }
}

export const IMAGE_FAILURE = '图片暂时无法生成，已保留文字内容。可以稍后重试；若持续失败，请联系管理员。'

/** Preserve companion text when image messages are switched to text mode. */
export function withoutImages(content: h.Fragment): h[] {
  const walk = (elements: h[]): h[] => elements.flatMap(element => {
    if (element.type === 'img' || element.type === 'image') return []
    if (element.children.length) return [h(element.type, element.attrs, walk(element.children))]
    return [element]
  })
  return walk(h.normalize(content))
}
export function isTextOnly(ctx: Context, session: Session): boolean {
  return state(ctx).modes.get(userKey(session)) === true
}
