import test from 'node:test'
import assert from 'node:assert/strict'
import { MEDAL_INK, medalOuterRadius, medalReach, medalSpec } from '../src/medal'
import { scheme } from '../src/m3'

const PAPER = scheme(268).surface

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

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

const AVATAR = 25

test('rank numbers in medal ink read as body text on the paper, both ends of every ring as graphics', () => {
  for (const rank of [1, 2, 3]) {
    const ink = MEDAL_INK[rank - 1]
    assert.ok(contrast(ink, PAPER) >= 4.5, `第 ${rank} 名的名次色只有 ${contrast(ink, PAPER).toFixed(2)}∶1`)
    const { stops } = medalSpec(rank, AVATAR)!.ring
    for (const color of [stops[0][1], stops[stops.length - 1][1]]) {
      assert.ok(contrast(color, PAPER) >= 3, `第 ${rank} 名的圈只有 ${contrast(color, PAPER).toFixed(2)}∶1`)
    }
    assert.equal(stops[stops.length - 1][1], ink, '圈的深端就是名次数字的色')
  }
})

test('ring sits outside the avatar with a paper gap, and the champion is a hair thicker', () => {
  const silver = medalSpec(2, AVATAR)!.ring
  assert.equal(silver.outer, 28.5)
  assert.equal(silver.radius - silver.width / 2, AVATAR + 1.5, '内沿与头像之间是 1.5 的纸缝')
  assert.equal(medalOuterRadius(1, AVATAR), 29)
  assert.equal(medalSpec(1, AVATAR)!.ring.width, 2.5)
  assert.equal(medalSpec(3, AVATAR)!.ring.width, 2)
})

test('glow and crown belong to the champion alone; nobody below the podium has a medal', () => {
  const champion = medalSpec(1, AVATAR)!
  assert.ok(champion.glow && champion.crown)
  assert.equal(champion.glow.stops[0][1], 0.3)
  assert.equal(champion.glow.stops[champion.glow.stops.length - 1][1], 0)
  for (const rank of [2, 3]) {
    const medal = medalSpec(rank, AVATAR)!
    assert.equal(medal.glow, null)
    assert.equal(medal.crown, null)
  }
  for (const rank of [0, 4, 100, 1.5, -1]) assert.equal(medalSpec(rank, AVATAR), null)
})

test('the crown stays inside the glow, clear of the bar column', () => {
  const { crown, glow } = medalSpec(1, AVATAR)!
  const [a, b, c, d, e, f] = crown!.matrix
  const world = ([x, y]: readonly [number, number]) => [a * x + c * y + e, b * x + d * y + f]
  const points = [
    ...crown!.body.map(world),
    // 小球按半径外扩，取上下左右四点
    ...crown!.tips.flatMap(([x, y]) => [
      world([x - crown!.tipRadius, y]), world([x + crown!.tipRadius, y]),
      world([x, y - crown!.tipRadius]), world([x, y + crown!.tipRadius]),
    ]),
  ]
  const [top, right] = [Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0]))]
  // 画布在榜首上方留的就是 medalReach：皇冠与柔光都不能越过它
  assert.ok(-top <= AVATAR + medalReach(AVATAR), `皇冠顶在头像中心上方 ${-top.toFixed(1)}`)
  assert.ok(glow!.to - AVATAR <= medalReach(AVATAR))
  // 头像右沿与横条之间只隔 6，皇冠探进横条那一列的部分不能超过 acumen 的 12
  assert.ok(right < AVATAR + 12, `皇冠右缘在头像中心右侧 ${right.toFixed(1)}`)
})

test('the spec survives JSON, because message-counter ships it into the browser', () => {
  for (const rank of [1, 2, 3]) {
    const spec = medalSpec(rank, AVATAR)
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec)
  }
})
