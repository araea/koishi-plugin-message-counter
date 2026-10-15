import test from 'node:test'
import assert from 'node:assert/strict'
import { GRID_LINE, INK, INK_SOFT, PAPER } from '../src/paper'
import { MEDAL_INK, medalSpec } from '../src/medal'

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, bl] = rgb(hex).map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

test('ink on the paper is deep enough to read and soft enough not to glare', () => {
  assert.ok(contrast(INK, PAPER) >= 7, `正文墨 ${contrast(INK, PAPER).toFixed(2)}`)
  assert.ok(contrast(INK, PAPER) <= 14, `墨太硬会在大片白底上发晕：${contrast(INK, PAPER).toFixed(2)}`)
  assert.ok(contrast(INK_SOFT, PAPER) >= 4.5, `次级墨 ${contrast(INK_SOFT, PAPER).toFixed(2)}`)
})

test('the paper is not white, and warmer than daylight: red leads blue', () => {
  const [r, g, b] = rgb(PAPER)
  assert.ok(r < 255 && g < 255, '不是纯白')
  assert.ok(r > g && g > b, '暖：红 > 绿 > 蓝')
  assert.ok(r - b <= 12, '只是一点暖，不是米色')
})

test('the rim under an avatar is a hairline, not a line to read', () => {
  assert.ok(contrast(GRID_LINE, PAPER) >= 1.6 && contrast(GRID_LINE, PAPER) <= 3)
})

test('every medal still reads on this paper', () => {
  for (const rank of [1, 2, 3]) {
    assert.ok(contrast(MEDAL_INK[rank - 1], PAPER) >= 4.5)
    const { stops } = medalSpec(rank, 25)!.ring
    assert.ok(contrast(stops[0][1], PAPER) >= 3)
  }
})
