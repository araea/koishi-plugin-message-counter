import test from 'node:test'
import assert from 'node:assert/strict'
import { displayLimit } from '../src/ranking'

test('the row count follows the command, falls back to the default, and stops at the ceiling', () => {
  assert.equal(displayLimit(undefined, 20, 100), 20)
  assert.equal(displayLimit(30, 20, 100), 30)
  assert.equal(displayLimit(5000, 20, 100), 100)
  // 默认「全部」在有上限时只列到上限
  assert.equal(displayLimit(undefined, 0, 100), 100)
  // 上限 0 = 不设上限，保留从前的行为（0 仍是「全部」）
  assert.equal(displayLimit(5000, 20, 0), 5000)
  assert.equal(displayLimit(undefined, 0, 0), 0)
})
