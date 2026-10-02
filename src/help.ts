import { Session } from 'koishi'

export interface HelpEntry { name: string; description: string }

/**
 * 主指令帮助的内容：从已注册的指令树现取标题与直接子指令，不依赖 help 插件，也不会和指令脱节。
 * 权限与 help 插件同口径（走权限服务），管理员专用的指令不会摆给普通成员；
 * 调用它的主指令需要 `.userFields(['authority'])`，否则读不到用户权限、会把所有指令都列出来。
 * `order` 列出希望靠前的子指令（完整指令名），没列到的按注册顺序排在后面；排版交给各插件。
 * 不要在动作里 `session.execute('… -h')` 或 `session.execute('help …')` 转发：
 * `-h` 与 help 指令都由 help 插件提供，缺它前者会无限调用自己，后者什么也不会回应。
 */
export async function helpOf(session: Session, name: string, order: string[] = []): Promise<{ title: string; entries: HelpEntry[] }> {
  const describe = (command: string) => session.text([`commands.${command}.description`, ''])
  const rank = (command: string) => { const i = order.indexOf(command); return i < 0 ? order.length : i }
  const cache = new Map<string, Promise<boolean>>()
  const entries: HelpEntry[] = []
  for (const child of session.app.$commander.get(name)?.children ?? []) {
    // `hidden` 是 help 插件补进指令配置的字段；没装它时为 undefined，指令照常列出。
    const { hidden } = child.config as { hidden?: boolean | ((session: Session) => boolean) }
    if (!child.match(session) || session.resolve(hidden)) continue
    if (!await session.app.permissions.test(`command:${child.name}`, session, cache)) continue
    entries.push({ name: child.name, description: describe(child.name) })
  }
  entries.sort((a, b) => rank(a.name) - rank(b.name))
  return { title: describe(name), entries }
}
