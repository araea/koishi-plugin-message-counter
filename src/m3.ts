/** Shared M3 tokens. Generated copies: scripts/sync-design-system.mjs. */
import { Hct, SchemeTonalSpot, hexFromArgb, argbFromHex } from './material-color'
import { MATERIAL_COLOR_SCRIPT } from './material-color-browser'
export type Tone = number
/** Historical API name retained for compatibility; uses official Material HCT. */
export function lch(tone: Tone, chroma: number, hue: number) {
  return hexFromArgb(Hct.from(hue, chroma, tone).toInt())
}
export function lchOf(hex: string) {
  const value = Hct.fromInt(argbFromHex(hex))
  return { tone: value.tone, chroma: value.chroma, hue: value.hue }
}
export function harmonize(hex: string, tone: Tone, chroma = 48, fallbackHue = 0) {
  const source = lchOf(hex)
  return lch(tone, source.chroma < 4 ? Math.min(chroma, 6) : chroma, source.chroma < 4 ? fallbackHue : source.hue)
}
export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const n = argbFromHex(hex)
    const rgb = [n >>> 16 & 255, n >>> 8 & 255, n & 255].map(v => {
      const c = v / 255
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4
    })
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
export function onColor(background: string) {
  return contrast(background, '#000000') >= contrast(background, '#ffffff') ? '#000000' : '#ffffff'
}
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

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
  const source = Hct.from(hue, options.chroma ?? 56, 50)
  const dynamic = new SchemeTonalSpot(source, dark, 0, '2025')
  return {
    primary: hexFromArgb(dynamic.primary),
    onPrimary: hexFromArgb(dynamic.onPrimary),
    primaryContainer: hexFromArgb(dynamic.primaryContainer),
    onPrimaryContainer: hexFromArgb(dynamic.onPrimaryContainer),
    secondary: hexFromArgb(dynamic.secondary),
    onSecondary: hexFromArgb(dynamic.onSecondary),
    secondaryContainer: hexFromArgb(dynamic.secondaryContainer),
    onSecondaryContainer: hexFromArgb(dynamic.onSecondaryContainer),
    tertiary: hexFromArgb(dynamic.tertiary),
    onTertiary: hexFromArgb(dynamic.onTertiary),
    tertiaryContainer: hexFromArgb(dynamic.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(dynamic.onTertiaryContainer),
    error: hexFromArgb(dynamic.error),
    onError: hexFromArgb(dynamic.onError),
    errorContainer: hexFromArgb(dynamic.errorContainer),
    onErrorContainer: hexFromArgb(dynamic.onErrorContainer),
    background: hexFromArgb(dynamic.background),
    onBackground: hexFromArgb(dynamic.onBackground),
    surface: hexFromArgb(dynamic.surface),
    onSurface: hexFromArgb(dynamic.onSurface),
    surfaceVariant: hexFromArgb(dynamic.surfaceVariant),
    onSurfaceVariant: hexFromArgb(dynamic.onSurfaceVariant),
    surfaceDim: hexFromArgb(dynamic.surfaceDim),
    surfaceBright: hexFromArgb(dynamic.surfaceBright),
    surfaceContainerLowest: hexFromArgb(dynamic.surfaceContainerLowest),
    surfaceContainerLow: hexFromArgb(dynamic.surfaceContainerLow),
    surfaceContainer: hexFromArgb(dynamic.surfaceContainer),
    surfaceContainerHigh: hexFromArgb(dynamic.surfaceContainerHigh),
    surfaceContainerHighest: hexFromArgb(dynamic.surfaceContainerHighest),
    outline: hexFromArgb(dynamic.outline),
    outlineVariant: hexFromArgb(dynamic.outlineVariant),
    inverseSurface: hexFromArgb(dynamic.inverseSurface),
    inverseOnSurface: hexFromArgb(dynamic.inverseOnSurface),
    inversePrimary: hexFromArgb(dynamic.inversePrimary),
    scrim: hexFromArgb(dynamic.scrim),
    shadow: hexFromArgb(dynamic.shadow),
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
  '"Roboto Flex", "Roboto", "Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", system-ui, sans-serif'

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
  const spacing = Object.entries(SPACING).map(([name, value]) => `--m3-spacing-${name}:${value}px`)
  return [...shape, ...elevation, ...type, ...spacing, `--md-sys-typescale-font:${FONT_STACK}`, `--md-sys-typescale-font-mono:${MONO_STACK}`].join(';')
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
${Object.entries(TYPE).map(([name, value]) => `.m3-${kebab(name)}{font-size:${value.size}px;line-height:${value.line}px;font-weight:${value.weight};letter-spacing:${value.tracking}px}`).join('\n')}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}

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
 * 名次的含义是固定的，跟着主题变色反而认不出来。三种金属色本身也走 HCT，
 * 色调彼此拉开一档，所以放在任何主题里明暗关系都成立。
 */
.m3-badge--gold{background:${MEDAL.gold};color:${onColor(MEDAL.gold)}}
.m3-badge--silver{background:${MEDAL.silver};color:${onColor(MEDAL.silver)}}
.m3-badge--bronze{background:${MEDAL.bronze};color:${onColor(MEDAL.bronze)}}

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

/*
 * 页脚署名。层次靠字号与字重拉开，不靠压低对比度 ——
 * outline 是描边色（WCAG 只要求 3:1），拿来写字会掉到 AA 线下。
 */
.m3-footnote{
  padding-top:16px;text-align:center;
  font-size:12px;line-height:16px;letter-spacing:.4px;
  color:var(--md-sys-color-on-surface-variant);
}
`
}

/**
 * 浏览器端的配色小库，序列化进页面脚本用。
 *
 * 有些图是在页面里用 canvas 画的，那边拿不到这个模块。与其在客户端另写一套
 * HSL 近似，不如把同一套 HCT 运算原样送过去——服务端与浏览器端算出来的颜色
 * 必须一致，否则「同一支色相」的承诺在两边会对不上。
 *
 * 暴露的接口与本模块同名：`M3.lch` / `M3.lchOf` / `M3.harmonize`。
 */
export function clientColorScript() {
  return MATERIAL_COLOR_SCRIPT + `;const M3 = (() => {
    const { Hct, hexFromArgb, argbFromHex } = MaterialColor;
    const lch = (tone, chroma, hue) => hexFromArgb(Hct.from(hue, chroma, tone).toInt());
    const lchOf = (hex) => { const c = Hct.fromInt(argbFromHex(hex)); return {tone:c.tone,chroma:c.chroma,hue:c.hue}; };
    const harmonize = (hex, tone, chroma = 48, fallbackHue = 0) => {
      const c = lchOf(hex); return lch(tone, c.chroma < 4 ? Math.min(chroma,6) : chroma, c.chroma < 4 ? fallbackHue : c.hue);
    };
    return {lch, lchOf, harmonize};
  })();`;
}

/** Shared chart typography; names keep the existing measurement/ellipsis policy. */
export const CHART_TYPE = { count: TYPE.titleLarge.size, percent: TYPE.bodyMedium.size, rank: TYPE.titleMedium.size, title: TYPE.headlineSmall.size, meta: TYPE.bodyMedium.size } as const
export const LEGACY_CHART_SIZE: Record<number, number> = {30: CHART_TYPE.count,20: CHART_TYPE.percent,22: CHART_TYPE.rank,32: CHART_TYPE.title,18: CHART_TYPE.meta,9: SPACING.sm}
