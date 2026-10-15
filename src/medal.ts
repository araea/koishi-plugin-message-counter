/*
 * 排行榜前三名的头像奖牌圈：奖牌色的渐变圈；榜首另有一圈柔光与一顶斜戴的小皇冠。
 *
 * 这是 acumen `stats/chart/medal.rs` 的搬字版，几何与配色逐项相同（那边以 2 倍尺寸绘制，
 * 这里的单位是 1 倍图的像素，即那边的 `s` = 1）。两张榜会在同一个群里并排出现，
 * 奖牌的色、圈的粗细、皇冠的形状都得是同一套。**message-counter 与 monetary-rank
 * 各带一份，两份逐字相同**——改一处，另一处用 md5 对一遍。
 *
 * 本模块只算数，不画：返回的 `MedalSpec` 是以头像中心为原点的纯数据（可以 JSON 序列化），
 * message-counter 把它注入浏览器、用 canvas 画，monetary-rank 用它拼 SVG。
 *
 * **克制是设计的一部分。** 名次那一列早已用奖牌色写了「第几名」，头像上这一圈只是
 * 把同一个含义再说一遍，让榜首一眼落在名字之前；它不能比头像本身还抢眼。所以：
 *
 * - 圈只有头像半径的 8%—10%，圈与头像之间留一道纸色的缝，头像不被颜色压住；
 * - 渐变只走同一支色相里很窄的一段（左上略亮、右下略深），读成「有一点金属光泽」，
 *   而不是一条彩虹；两端对纸面都过非文字的 3∶1，深端就是名次数字用的那一档；
 * - 柔光只给榜首：金色 30% 起、向外平方衰减，画在所有条与文字**之下**，只染纸面；
 * - 银、铜不加任何饰物，名次之间靠「有没有柔光和皇冠」拉开层次，而不是靠颜色更艳。
 *
 * 测试在 message-counter 的 `test/medal.test.ts`。
 */

export type Point = readonly [number, number]
/** 仿射变换 `(a b c d e f)`：(x, y) → (a·x + c·y + e, b·x + d·y + f)，与 SVG、canvas 的 `transform` 同一个顺序。 */
export type Matrix = [number, number, number, number, number, number]

/**
 * 前三名的名次色，也是圈的深端：金、银、铜。语义固定的元素不跟随主题变色。
 * 取的是能在暖白纸上过正文对比度的深调，不是屏幕上那种亮闪闪的金银；名次的数字本身
 * 是第二个通道，色觉障碍下丢掉颜色也还认得出第几名。即 acumen 的 `MEDALS`。
 */
export const MEDAL_INK = ['#8a640a', '#687076', '#8c5834'] as const

/** 圈的亮端：在对纸面 3∶1 之内尽量往亮处走（算出来的：金 3.2、银 3.0、铜 3.2）。 */
const LIGHT = ['#b2820e', '#889098', '#be7c4c'] as const

/** 榜首柔光的色：比圈亮得多的暖金。它不承载信息（只是一圈光），没有对比度要求。 */
const GLOW_COLOR = '#e8b83e'
/** 柔光的最大不透明度（贴着圈的那一圈）。 */
const GLOW_PEAK = 0.3
/** 柔光向外延伸多远。 */
const GLOW_REACH = 8

/** 圈与头像之间的纸缝。 */
const GAP = 1.5

/** 皇冠的轮廓（本地坐标：x 沿底边、y 从底边向上，0 在底、10 在最高的尖）。 */
const CROWN_BODY: readonly Point[] = [
  [-7, 0], [-7, 7.4], [-3.4, 3.8], [0, 9.6], [3.4, 3.8], [7, 7.4], [7, 0],
]
const CROWN_TIPS: readonly Point[] = [[-7, 7.9], [0, 10], [7, 7.9]]
const CROWN_TIP_RADIUS = 1.05
/** 底边那一条压深一档的带有多高；帽身自这里往上由深到亮。 */
const CROWN_BAND = 2.2
const CROWN_HEIGHT = 10
/** 皇冠戴在圈的 −50° 处（右上），整体沿径向朝外倾。 */
const CROWN_ANGLE = (-50 * Math.PI) / 180

export interface MedalSpec {
  rank: number
  /** 圈：沿中线描一道 `width` 宽的线，渐变沿左上 → 右下的对角线（用户坐标，原点在头像中心）。 */
  ring: {
    /** 圈中线的半径。 */
    radius: number
    width: number
    /** 圈外沿的半径。 */
    outer: number
    /** 渐变线的端点 `(−d, −d) → (d, d)` 中的 d。 */
    diagonal: number
    stops: [offset: number, color: string][]
  }
  /** 榜首的柔光：从半径 `from` 向外到 `to`，不透明度自 `peak` 起平方衰减；其余名次为 null。 */
  glow: null | {
    from: number
    to: number
    color: string
    stops: [offset: number, alpha: number][]
  }
  /** 榜首的小皇冠；其余名次为 null。`matrix` 把本地坐标变到以头像中心为原点的用户坐标。 */
  crown: null | {
    matrix: Matrix
    body: readonly Point[]
    tips: readonly Point[]
    tipRadius: number
    tipColor: string
    /** 帽身的渐变在本地 y 轴上从 `from`（深）走到 `to`（亮）。 */
    from: number
    to: number
    stops: [offset: number, color: string][]
  }
}

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const rgbToHex = (rgb: number[]) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')

/** 圈上某处的颜色：`t` 取 0—1，0 是亮端、1 是深端，过渡走 smoothstep。 */
function tone(rank: number, t: number) {
  const light = hexToRgb(LIGHT[rank - 1])
  const deep = hexToRgb(MEDAL_INK[rank - 1])
  const eased = t * t * (3 - 2 * t)
  return rgbToHex(light.map((value, i) => Math.round(value + (deep[i] - value) * eased)))
}

/** 圈的粗细：榜首厚一点点。 */
const thickness = (rank: number) => (rank === 1 ? 2.5 : 2)

/** 圈外沿的半径。 */
export const medalOuterRadius = (rank: number, avatarRadius: number) => avatarRadius + GAP + thickness(rank)

/**
 * 奖牌在头像之外最远伸出多少（取整）：画布要在榜首那一行的上方留出这一截，
 * 柔光与皇冠才不被裁掉。
 */
export const medalReach = (avatarRadius: number) =>
  Math.ceil(medalOuterRadius(1, avatarRadius) - 0.5 + GLOW_REACH - avatarRadius)

/** 第 `rank` 名（从 1 起）的奖牌；四名开外没有。`avatarRadius` 是头像半径。 */
export function medalSpec(rank: number, avatarRadius: number): MedalSpec | null {
  if (!Number.isInteger(rank) || rank < 1 || rank > 3) return null

  const width = thickness(rank)
  const inner = avatarRadius + GAP
  const radius = inner + width / 2
  const outer = medalOuterRadius(rank, avatarRadius)
  const STEPS = 12
  const ring = {
    radius,
    width,
    outer,
    // 沿对角线的投影在中线上恰好走完 −radius … radius
    diagonal: radius / Math.SQRT2,
    stops: Array.from({ length: STEPS + 1 }, (_, i): [number, string] => [i / STEPS, tone(rank, i / STEPS)]),
  }
  if (rank !== 1) return { rank, ring, glow: null, crown: null }

  const from = outer - 0.5
  const glow = {
    from,
    to: from + GLOW_REACH,
    color: GLOW_COLOR,
    stops: Array.from({ length: 11 }, (_, i): [number, number] => [i / 10, GLOW_PEAK * (1 - i / 10) ** 2]),
  }

  const [ux, uy] = [Math.cos(CROWN_ANGLE), Math.sin(CROWN_ANGLE)]
  const [vx, vy] = [-uy, ux] // 沿底边的方向
  const base = outer - 0.5
  const crownStops = Array.from({ length: 9 }, (_, i): [number, string] => [i / 8, tone(rank, 1 - i / 8)])
  const crown = {
    matrix: [vx, vy, ux, uy, ux * base, uy * base] as Matrix,
    body: CROWN_BODY,
    tips: CROWN_TIPS,
    tipRadius: CROWN_TIP_RADIUS,
    tipColor: LIGHT[rank - 1],
    from: CROWN_BAND,
    to: CROWN_HEIGHT,
    stops: crownStops,
  }
  return { rank, ring, glow, crown }
}
