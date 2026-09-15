/**
 * Material 3 Expressive 设计系统。
 *
 * 只依赖标准库，输出纯 CSS 变量与常量，任何渲染后端（puppeteer / canvas）都能用。
 * 色板按 M3 的做法从一个源色推出六套色调板，再按角色映射成明暗两套配色。
 */

// ---------------------------------------------------------------------------
// 色彩：CIELCh 色调板
// ---------------------------------------------------------------------------

/** M3 的「色调」就是 CIE L*，0 为黑、100 为白。 */
export type Tone = number

const WHITE_X = 95.047
const WHITE_Y = 100
const WHITE_Z = 108.883

function labToXyz(l: number, a: number, b: number) {
  const fy = (l + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const f = (t: number) => (t > 6 / 29 ? t * t * t : (3 * (6 / 29) ** 2) * (t - 4 / 29))
  return [f(fx) * WHITE_X, f(fy) * WHITE_Y, f(fz) * WHITE_Z]
}

/** 线性分量 -> sRGB 分量，返回值可能越界，交给调用方判断。 */
function gamma(value: number) {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
}

function xyzToRgb(x: number, y: number, z: number) {
  x /= 100
  y /= 100
  z /= 100
  return [
    gamma(3.2406 * x - 1.5372 * y - 0.4986 * z),
    gamma(-0.9689 * x + 1.8758 * y + 0.0415 * z),
    gamma(0.0557 * x - 0.204 * y + 1.057 * z),
  ]
}

const EPSILON = 1 / 512

/** LCh -> #rrggbb。超出 sRGB 色域时按二分法降低彩度，色调与色相保持不变。 */
export function lch(tone: Tone, chroma: number, hue: number) {
  const radian = (hue * Math.PI) / 180
  const at = (c: number) => xyzToRgb(...labToXyz(tone, Math.cos(radian) * c, Math.sin(radian) * c) as [number, number, number])
  const inGamut = (rgb: number[]) => rgb.every((value) => value >= -EPSILON && value <= 1 + EPSILON)

  let rgb = at(chroma)
  if (!inGamut(rgb)) {
    // 彩度为 0 的灰轴必定在色域内，所以二分一定收敛
    let low = 0
    let high = chroma
    while (high - low > 0.05) {
      const mid = (low + high) / 2
      if (inGamut(at(mid))) low = mid
      else high = mid
    }
    rgb = at(low)
  }

  return '#' + rgb
    .map((value) => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0'))
    .join('')
}

/** 线性化的 sRGB 分量。 */
function degamma(value: number) {
  value /= 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** `#rrggbb` -> LCh，`lch()` 的逆运算。 */
export function lchOf(hex: string) {
  const value = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0
  const r = degamma((value >> 16) & 255)
  const g = degamma((value >> 8) & 255)
  const b = degamma(value & 255)

  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) * 100 / WHITE_X
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 100 / WHITE_Y
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) * 100 / WHITE_Z

  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  const a = 500 * (fx - fy)
  const bb = 200 * (fy - fz)

  return {
    tone: 116 * fy - 16,
    chroma: Math.hypot(a, bb),
    hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360,
  }
}

/**
 * 把一个任意来源的颜色（头像主色、用户自选色）收进本设计系统。
 *
 * 只保留它的色相，色调与彩度一律换成设计系统里的取值——于是每个人都还有
 * 自己的颜色，整张图的明度节奏却是齐的，不会因为某个头像特别暗就糊成一团。
 * 彩度太低的灰色头像没有可用的色相，退回主色。
 */
export function harmonize(hex: string, tone: Tone, chroma = 48, fallbackHue = 0) {
  const source = lchOf(hex)
  const hue = source.chroma < 4 ? fallbackHue : source.hue
  return lch(tone, source.chroma < 4 ? Math.min(chroma, 6) : chroma, hue)
}

/** 一套色调板：固定色相与彩度，按色调取色。 */
export type Palette = (tone: Tone) => string

export function palette(hue: number, chroma: number): Palette {
  const cache = new Map<Tone, string>()
  return (tone) => {
    const hit = cache.get(tone)
    if (hit) return hit
    const value = lch(tone, chroma, hue)
    cache.set(tone, value)
    return value
  }
}

// ---------------------------------------------------------------------------
// 配色方案
// ---------------------------------------------------------------------------

export interface Palettes {
  primary: Palette
  secondary: Palette
  tertiary: Palette
  neutral: Palette
  neutralVariant: Palette
  error: Palette
}

export interface SourceOptions {
  /** 主色彩度，默认 56，够鲜艳又不至于在浅色调上大面积溢出色域。 */
  chroma?: number
  /**
   * 第三色相对主色的相位差，默认 +60°。
   * 这个值规范里是个经验值，并非永远合适：暖橙 +60° 会落到发闷的橄榄绿，
   * 这种时候改成 -60° 取玫红，强调色才跳得出来。
   */
  tertiaryShift?: number
}

/**
 * 按 M3 的推导规则从源色相生成六套色调板。
 *
 * Expressive 相比基础风格更敢用彩度：第三色比规范里的保守取值更高，
 * 中性色也留了一点源色的味道，成片的表面不会灰得发死。
 */
export function palettesOf(hue: number, options: SourceOptions = {}): Palettes {
  const { chroma = 56, tertiaryShift = 60 } = options
  return {
    primary: palette(hue, chroma),
    secondary: palette(hue, Math.max(16, chroma / 3.2)),
    tertiary: palette(hue + tertiaryShift, Math.max(28, chroma / 1.8)),
    neutral: palette(hue, 4),
    neutralVariant: palette(hue, 9),
    error: palette(36, 68),
  }
}

export interface Scheme {
  primary: string
  onPrimary: string
  primaryContainer: string
  onPrimaryContainer: string
  secondary: string
  onSecondary: string
  secondaryContainer: string
  onSecondaryContainer: string
  tertiary: string
  onTertiary: string
  tertiaryContainer: string
  onTertiaryContainer: string
  error: string
  onError: string
  errorContainer: string
  onErrorContainer: string
  background: string
  onBackground: string
  surface: string
  onSurface: string
  surfaceVariant: string
  onSurfaceVariant: string
  surfaceDim: string
  surfaceBright: string
  surfaceContainerLowest: string
  surfaceContainerLow: string
  surfaceContainer: string
  surfaceContainerHigh: string
  surfaceContainerHighest: string
  outline: string
  outlineVariant: string
  inverseSurface: string
  inverseOnSurface: string
  inversePrimary: string
  scrim: string
  shadow: string
}

/** 生成一套完整的角色配色。`dark` 为真时返回暗色方案。 */
export function scheme(hue: number, dark = false, options: SourceOptions = {}): Scheme {
  const p = palettesOf(hue, options)
  const { primary: P, secondary: S, tertiary: T, neutral: N, neutralVariant: V, error: E } = p

  if (dark) {
    return {
      primary: P(80), onPrimary: P(20), primaryContainer: P(30), onPrimaryContainer: P(90),
      secondary: S(80), onSecondary: S(20), secondaryContainer: S(30), onSecondaryContainer: S(90),
      tertiary: T(80), onTertiary: T(20), tertiaryContainer: T(30), onTertiaryContainer: T(90),
      error: E(80), onError: E(20), errorContainer: E(30), onErrorContainer: E(90),
      background: N(6), onBackground: N(90),
      surface: N(6), onSurface: N(90),
      surfaceVariant: V(30), onSurfaceVariant: V(80),
      surfaceDim: N(6), surfaceBright: N(24),
      surfaceContainerLowest: N(4), surfaceContainerLow: N(10), surfaceContainer: N(12),
      surfaceContainerHigh: N(17), surfaceContainerHighest: N(22),
      outline: V(60), outlineVariant: V(30),
      inverseSurface: N(90), inverseOnSurface: N(20), inversePrimary: P(40),
      scrim: N(0), shadow: N(0),
    }
  }

  return {
    primary: P(40), onPrimary: P(100), primaryContainer: P(90), onPrimaryContainer: P(30),
    secondary: S(40), onSecondary: S(100), secondaryContainer: S(90), onSecondaryContainer: S(30),
    tertiary: T(40), onTertiary: T(100), tertiaryContainer: T(90), onTertiaryContainer: T(30),
    error: E(40), onError: E(100), errorContainer: E(90), onErrorContainer: E(30),
    background: N(98), onBackground: N(10),
    surface: N(98), onSurface: N(10),
    surfaceVariant: V(90), onSurfaceVariant: V(30),
    surfaceDim: N(87), surfaceBright: N(98),
    surfaceContainerLowest: N(100), surfaceContainerLow: N(96), surfaceContainer: N(94),
    surfaceContainerHigh: N(92), surfaceContainerHighest: N(90),
    outline: V(50), outlineVariant: V(80),
    inverseSurface: N(20), inverseOnSurface: N(95), inversePrimary: P(80),
    scrim: N(0), shadow: N(0),
  }
}

// ---------------------------------------------------------------------------
// 形状 / 字体 / 高度
// ---------------------------------------------------------------------------

/**
 * M3 Expressive 形状刻度（px）。
 * Expressive 把圆角整体推大了一档，容器之间靠「圆角差」而不是分隔线来分层。
 */
export const SHAPE = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  largeIncreased: 20,
  extraLarge: 28,
  extraLargeIncreased: 32,
  extraExtraLarge: 48,
  full: 9999,
} as const

/** 正文与标题字体栈，覆盖 Windows / macOS / Linux 与随包字体三种情况。 */
export const FONT_STACK =
  '"Roboto Flex", "Roboto", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", system-ui, sans-serif'

/** 等宽字体栈，用于比分、倒计时这类需要对齐的数字。 */
export const MONO_STACK =
  '"Roboto Mono", "JetBrains Mono", "SF Mono", "Cascadia Mono", Consolas, "Noto Sans Mono", monospace'

export interface TypeStyle {
  size: number
  line: number
  weight: number
  tracking: number
}

/**
 * M3 Expressive 字阶。`emphasized` 档提高字重，用在需要被一眼看到的地方，
 * 这是 Expressive 与基础风格最直观的差别之一。
 */
export const TYPE = {
  displayLarge: { size: 57, line: 64, weight: 400, tracking: -0.25 },
  displayMedium: { size: 45, line: 52, weight: 400, tracking: 0 },
  displaySmall: { size: 36, line: 44, weight: 400, tracking: 0 },
  headlineLarge: { size: 32, line: 40, weight: 400, tracking: 0 },
  headlineMedium: { size: 28, line: 36, weight: 400, tracking: 0 },
  headlineSmall: { size: 24, line: 32, weight: 400, tracking: 0 },
  titleLarge: { size: 22, line: 28, weight: 400, tracking: 0 },
  titleMedium: { size: 16, line: 24, weight: 500, tracking: 0.15 },
  titleSmall: { size: 14, line: 20, weight: 500, tracking: 0.1 },
  bodyLarge: { size: 16, line: 24, weight: 400, tracking: 0.5 },
  bodyMedium: { size: 14, line: 20, weight: 400, tracking: 0.25 },
  bodySmall: { size: 12, line: 16, weight: 400, tracking: 0.4 },
  labelLarge: { size: 14, line: 20, weight: 500, tracking: 0.1 },
  labelMedium: { size: 12, line: 16, weight: 500, tracking: 0.5 },
  labelSmall: { size: 11, line: 16, weight: 500, tracking: 0.5 },
} satisfies Record<string, TypeStyle>

/**
 * Expressive 的强调字重。取 600 而非规范里的 500：很多机器上只装了 400 / 700 两档，
 * 500 会回落成常规字重，强调就白做了；600 在这种字体集下会匹配到 700，效果才稳定。
 * 正文维持 400，字重拉高反而伤可读性。
 */
export const EMPHASIZED_WEIGHT = { display: 600, headline: 600, title: 600, label: 600 } as const

/** 阴影高度（dp -> box-shadow），M3 只有 0 ~ 5 六档。 */
export const ELEVATION = [
  'none',
  '0 1px 2px 0 rgba(0,0,0,.30), 0 1px 3px 1px rgba(0,0,0,.15)',
  '0 1px 2px 0 rgba(0,0,0,.30), 0 2px 6px 2px rgba(0,0,0,.15)',
  '0 1px 3px 0 rgba(0,0,0,.30), 0 4px 8px 3px rgba(0,0,0,.15)',
  '0 2px 3px 0 rgba(0,0,0,.30), 0 6px 10px 4px rgba(0,0,0,.15)',
  '0 4px 4px 0 rgba(0,0,0,.30), 0 8px 12px 6px rgba(0,0,0,.15)',
] as const

// ---------------------------------------------------------------------------
// CSS 输出
// ---------------------------------------------------------------------------

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/** 把配色方案铺成 `--md-sys-color-*` 变量。 */
export function colorVars(s: Scheme) {
  return Object.entries(s).map(([role, value]) => `--md-sys-color-${kebab(role)}:${value}`).join(';')
}

/** 形状、字阶、高度的变量，与配色一起构成完整的令牌集。 */
export function systemVars() {
  const shape = Object.entries(SHAPE).map(([name, value]) => `--md-sys-shape-corner-${kebab(name)}:${value}px`)
  const elevation = ELEVATION.map((value, level) => `--md-sys-elevation-level${level}:${value}`)
  const type = Object.entries(TYPE).flatMap(([name, style]) => [
    `--md-sys-typescale-${kebab(name)}-size:${style.size}px`,
    `--md-sys-typescale-${kebab(name)}-line-height:${style.line}px`,
    `--md-sys-typescale-${kebab(name)}-weight:${style.weight}`,
    `--md-sys-typescale-${kebab(name)}-tracking:${style.tracking}px`,
  ])
  return [...shape, ...elevation, ...type, `--md-sys-typescale-font:${FONT_STACK}`, `--md-sys-typescale-font-mono:${MONO_STACK}`].join(';')
}

/** 一段可直接塞进 `<style>` 的基础样式：令牌 + 排版重置。 */
export function baseline(s: Scheme) {
  return `
:root{${colorVars(s)};${systemVars()}}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:var(--md-sys-color-background);
  color:var(--md-sys-color-on-surface);
  font-family:var(--md-sys-typescale-font);
  font-synthesis-weight:none;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  font-variant-numeric:tabular-nums;
}
.m3-display-large{font-size:57px;line-height:64px;font-weight:600;letter-spacing:-.25px}
.m3-display-medium{font-size:45px;line-height:52px;font-weight:600;letter-spacing:0}
.m3-display-small{font-size:36px;line-height:44px;font-weight:600;letter-spacing:0}
.m3-headline-large{font-size:32px;line-height:40px;font-weight:600;letter-spacing:0}
.m3-headline-medium{font-size:28px;line-height:36px;font-weight:600;letter-spacing:0}
.m3-headline-small{font-size:24px;line-height:32px;font-weight:600;letter-spacing:0}
.m3-title-large{font-size:22px;line-height:28px;font-weight:600;letter-spacing:0}
.m3-title-medium{font-size:16px;line-height:24px;font-weight:600;letter-spacing:.15px}
.m3-title-small{font-size:14px;line-height:20px;font-weight:600;letter-spacing:.1px}
.m3-body-large{font-size:16px;line-height:24px;font-weight:400;letter-spacing:.5px}
.m3-body-medium{font-size:14px;line-height:20px;font-weight:400;letter-spacing:.25px}
.m3-body-small{font-size:12px;line-height:16px;font-weight:400;letter-spacing:.4px}
.m3-label-large{font-size:14px;line-height:20px;font-weight:600;letter-spacing:.1px}
.m3-label-medium{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.5px}
.m3-label-small{font-size:11px;line-height:16px;font-weight:600;letter-spacing:.5px}
`
}

/**
 * 通用组件样式。各插件按需挑用，命名统一为 `m3-` 前缀。
 *
 * Expressive 的取向体现在三处：圆角整体偏大且同一张图里刻意拉开层次、
 * 强调元素用高彩度的容器色而不是描边、以及成组元素之间用间距而不是分隔线来断句。
 */
/** 金银铜。色调依次 58 / 66 / 48，深浅本身就排出了名次。 */
export const MEDAL = {
  gold: lch(58, 52, 85),
  silver: lch(66, 5, 260),
  bronze: lch(48, 36, 48),
} as const

export function components() {
  return `
.m3-surface{background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface)}
.m3-card{
  background:var(--md-sys-color-surface-container-low);
  color:var(--md-sys-color-on-surface);
  border-radius:var(--md-sys-shape-corner-extra-large);
  padding:24px;
}
.m3-card--elevated{background:var(--md-sys-color-surface-container-low);box-shadow:var(--md-sys-elevation-level1)}
.m3-card--outlined{background:var(--md-sys-color-surface);border:1px solid var(--md-sys-color-outline-variant)}
.m3-card--filled{background:var(--md-sys-color-surface-container-highest)}

/* 药丸形，Expressive 里用得最多的一种形状 */
.m3-chip{
  display:inline-flex;align-items:center;gap:6px;
  height:32px;padding:0 16px;
  border-radius:var(--md-sys-shape-corner-full);
  background:var(--md-sys-color-secondary-container);
  color:var(--md-sys-color-on-secondary-container);
  font-size:14px;line-height:20px;font-weight:600;letter-spacing:.1px;white-space:nowrap;
}
.m3-chip--primary{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.m3-chip--tertiary{background:var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container)}
.m3-chip--error{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
.m3-chip--outlined{background:transparent;border:1px solid var(--md-sys-color-outline);color:var(--md-sys-color-on-surface-variant)}

.m3-divider{height:1px;border:0;margin:0;background:var(--md-sys-color-outline-variant)}

/* 列表项：靠圆角与容器色分组，不画分隔线 */
.m3-list{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.m3-list-item{
  display:flex;align-items:center;gap:16px;
  min-height:56px;padding:8px 16px;
  border-radius:var(--md-sys-shape-corner-medium);
  background:var(--md-sys-color-surface-container);
  color:var(--md-sys-color-on-surface);
}
/* 一组里的首尾项圆角放大，整组读起来像一个整体 */
.m3-list-item:first-child{border-top-left-radius:var(--md-sys-shape-corner-extra-large);border-top-right-radius:var(--md-sys-shape-corner-extra-large)}
.m3-list-item:last-child{border-bottom-left-radius:var(--md-sys-shape-corner-extra-large);border-bottom-right-radius:var(--md-sys-shape-corner-extra-large)}
.m3-list-item--accent{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}

.m3-avatar{
  width:40px;height:40px;flex:none;
  border-radius:var(--md-sys-shape-corner-full);
  object-fit:cover;background:var(--md-sys-color-surface-container-highest);
}

/* 序号徽章，名次靠它一眼可辨 */
.m3-badge{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:28px;height:28px;padding:0 8px;flex:none;
  border-radius:var(--md-sys-shape-corner-full);
  background:var(--md-sys-color-surface-container-highest);
  color:var(--md-sys-color-on-surface-variant);
  font-size:14px;font-weight:600;letter-spacing:0;
  font-variant-numeric:tabular-nums;
}
/*
 * 前三名用真正的金银铜，而不是主题的主 / 次 / 第三色：
 * 名次的含义是固定的，跟着主题变色反而认不出来。三种金属色本身也走 LCh，
 * 色调彼此拉开一档，所以放在任何主题里明暗关系都成立。
 */
.m3-badge--gold{background:${MEDAL.gold};color:#fff}
.m3-badge--silver{background:${MEDAL.silver};color:#fff}
.m3-badge--bronze{background:${MEDAL.bronze};color:#fff}

/*
 * 进度 / 排行条。填充与轨道是两个独立的全圆角色块，中间留 4px 空隙——
 * 这是 M3 新版进度指示器的标志性细节，靠 flex 比例分配长度，不必算百分比。
 */
.m3-bar{display:flex;align-items:center;gap:4px;height:16px;flex:1;min-width:0}
.m3-bar__fill{
  height:100%;min-width:16px;
  border-radius:var(--md-sys-shape-corner-full);
  background:var(--md-sys-color-primary);
}
.m3-bar__track{
  height:100%;
  border-radius:var(--md-sys-shape-corner-full);
  background:var(--md-sys-color-surface-container-highest);
}
.m3-bar--on-accent .m3-bar__track{background:var(--md-sys-color-surface-container-lowest)}

/* 页眉：大标题 + 辅助说明，Expressive 强调标题本身的体量 */
.m3-header{display:flex;flex-direction:column;gap:4px;padding:8px 4px 20px}
.m3-header__title{font-size:32px;line-height:40px;font-weight:600;letter-spacing:0;color:var(--md-sys-color-on-surface);margin:0}
.m3-header__support{font-size:14px;line-height:20px;font-weight:400;letter-spacing:.25px;color:var(--md-sys-color-on-surface-variant);margin:0}

/* 页脚署名，压到最低对比度，不与正文抢视线 */
.m3-footnote{
  padding-top:16px;text-align:center;
  font-size:12px;line-height:16px;letter-spacing:.4px;
  color:var(--md-sys-color-outline);
}
`
}

/**
 * 浏览器端的配色小库，序列化进页面脚本用。
 *
 * 有些图是在页面里用 canvas 画的，那边拿不到这个模块。与其在客户端另写一套
 * HSL 近似，不如把同一套 LCh 运算原样送过去——服务端与浏览器端算出来的颜色
 * 必须一致，否则「同一支色相」的承诺在两边会对不上。
 *
 * 暴露的接口与本模块同名：`M3.lch` / `M3.lchOf` / `M3.harmonize`。
 */
export function clientColorScript() {
  return `const M3 = (() => {
  const WX = ${WHITE_X}, WY = ${WHITE_Y}, WZ = ${WHITE_Z}, EPS = ${EPSILON};
  const gamma = (v) => v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  const degamma = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) };

  function at(tone, chroma, hue) {
    const rad = hue * Math.PI / 180;
    const a = Math.cos(rad) * chroma, b = Math.sin(rad) * chroma;
    const fy = (tone + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const f = (t) => t > 6 / 29 ? t * t * t : 3 * Math.pow(6 / 29, 2) * (t - 4 / 29);
    const x = f(fx) * WX / 100, y = f(fy) * WY / 100, z = f(fz) * WZ / 100;
    return [
      gamma(3.2406 * x - 1.5372 * y - 0.4986 * z),
      gamma(-0.9689 * x + 1.8758 * y + 0.0415 * z),
      gamma(0.0557 * x - 0.204 * y + 1.057 * z),
    ];
  }
  const inGamut = (rgb) => rgb.every((v) => v >= -EPS && v <= 1 + EPS);

  function lch(tone, chroma, hue) {
    let rgb = at(tone, chroma, hue);
    if (!inGamut(rgb)) {
      let lo = 0, hi = chroma;
      while (hi - lo > 0.05) {
        const mid = (lo + hi) / 2;
        if (inGamut(at(tone, mid, hue))) lo = mid; else hi = mid;
      }
      rgb = at(tone, lo, hue);
    }
    return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
  }

  function lchOf(hex) {
    const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0;
    const r = degamma((n >> 16) & 255), g = degamma((n >> 8) & 255), b = degamma(n & 255);
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) * 100 / WX;
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 100 / WY;
    const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) * 100 / WZ;
    const f = (t) => t > Math.pow(6 / 29, 3) ? Math.cbrt(t) : t / (3 * Math.pow(6 / 29, 2)) + 4 / 29;
    const fx = f(x), fy = f(y), fz = f(z);
    const a = 500 * (fx - fy), bb = 200 * (fy - fz);
    return { tone: 116 * fy - 16, chroma: Math.hypot(a, bb), hue: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
  }

  function harmonize(hex, tone, chroma, fallbackHue) {
    const src = lchOf(hex);
    const gray = src.chroma < 4;
    return lch(tone, gray ? Math.min(chroma, 6) : chroma, gray ? (fallbackHue || 0) : src.hue);
  }

  return { lch, lchOf, harmonize };
})();`
}
