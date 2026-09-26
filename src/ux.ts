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

/** 图文模式默认只发渲染图；完整文字只在用户切到「文字」模式时出现。偏好只影响本人。 */
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
    /** 图文模式只给图片；图片缺失或用户选了文字模式时才退回文字。 */
    present(session: Session, image: h.Fragment | null | undefined, text: h.Fragment): h.Fragment {
      if (!image || shared.modes.get(userKey(session))) return text
      return h.normalize(image)
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

/**
 * 渲染图的等价文字。图文模式随图片一起丢掉、文字模式展开成正文，
 * 因此它永远不会原样发到聊天平台。
 */
export const IMAGE_TEXT_TYPE = 'ux-image-text'
export function imageText(text: h.Fragment): h {
  return h(IMAGE_TEXT_TYPE, {}, h.normalize(text))
}
function isImage(element: h): boolean {
  return element.type === 'img' || element.type === 'image'
}
function isImageText(element: h): boolean {
  return element.type === IMAGE_TEXT_TYPE
}

/** 图文模式：保留图片与普通文字，去掉图片的等价文字。 */
export function imagesOnly(content: h.Fragment): h[] {
  const walk = (elements: h[]): h[] => elements.flatMap(element => {
    if (isImageText(element)) return []
    if (isImage(element) || !element.children.length) return [element]
    return [h(element.type, element.attrs, walk(element.children))]
  })
  return walk(h.normalize(content))
}

/** 文字模式：去掉图片，把等价文字展开成普通文本。 */
export function withoutImages(content: h.Fragment): h[] {
  const walk = (elements: h[]): h[] => elements.flatMap(element => {
    if (isImage(element)) return []
    if (isImageText(element)) return walk(element.children)
    if (element.children.length) return [h(element.type, element.attrs, walk(element.children))]
    return [element]
  })
  return walk(h.normalize(content))
}

/** 发送前的统一选择：文字模式去掉图片，图文模式去掉等价文字。 */
export function choosePresentation(content: h.Fragment, textOnly: boolean): h[] {
  return textOnly ? withoutImages(content) : imagesOnly(content)
}
export function isTextOnly(ctx: Context, session: Session): boolean {
  return state(ctx).modes.get(userKey(session)) === true
}
