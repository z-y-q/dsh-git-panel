// test/git-graph.test.mjs — Git Graph 泳道布局算法(直测 lib/client.js 出货代码)。
// 通过无头装配(window stub + require('react'))取模块工厂返回的 __graphLayout。
import test from 'node:test'
import assert from 'node:assert/strict'

let registration = null
globalThis.window = { __ModuleLoader__: { load: (reg) => { registration = reg } } }

await import('../lib/client.js')
const React = (await import('react')).default
const mod = registration.factory((spec) => {
  if (spec === 'react') return React
  throw new Error('unexpected require: ' + spec)
})
const layout = mod.__graphLayout
if (typeof layout !== 'function') throw new Error('__graphLayout 未导出')

test('线性历史:单泳道', () => {
  const { rows, maxLanes } = layout([
    { hash: 'c3', parents: ['c2'] },
    { hash: 'c2', parents: ['c1'] },
    { hash: 'c1', parents: [] },
  ])
  assert.equal(rows.length, 3)
  assert.equal(maxLanes, 1)
  assert.deepEqual(rows.map(r => r.lane), [0, 0, 0])
  // 根提交 c1 无父:p0Target 为 null(不再向下画线)
  assert.equal(rows[2].p0Target, null)
  // 非根提交的第一父线指向本泳道
  assert.equal(rows[0].p0Target, 0)
})

test('分支 + 合并:双泳道、分叉线与泳道压缩', () => {
  const { rows, maxLanes } = layout([
    { hash: 'm', parents: ['a', 'f'] }, // merge(第一父 a,第二父 f)
    { hash: 'f', parents: ['b'] },      // feature 顶
    { hash: 'a', parents: ['b'] },
    { hash: 'b', parents: [] },
  ])
  // merge 行:lane 0,向 f 泳道(1)分出一条合并线
  assert.equal(rows[0].lane, 0)
  assert.deepEqual(rows[0].outTargets, [1])
  assert.equal(rows[0].p0Target, 0)
  // feature 行:占据 lane 1
  assert.equal(rows[1].lane, 1)
  // a 行:lane 0;a 之后两泳道都指向 b
  assert.equal(rows[2].lane, 0)
  // b 行:认领 lane 0;其第一父为空 → 无向下线
  assert.equal(rows[3].lane, 0)
  assert.equal(rows[3].p0Target, null)
  // 分叉期最大两个泳道
  assert.ok(maxLanes >= 2 && maxLanes <= 3, 'maxLanes=' + maxLanes)
})

test('无父与缺 parents 字段的兼容(旧数据/截断)', () => {
  const { rows } = layout([
    { hash: 'x' },            // 无 parents 字段 → 视为无父
    { hash: 'y', parents: [] },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].p0Target, null)
  assert.deepEqual(rows[0].outTargets, [])
})

test('多点分叉:同一提交被两个子提交引用', () => {
  const { rows, maxLanes } = layout([
    { hash: 'c2', parents: ['base'] },
    { hash: 'c1', parents: ['base'] },
    { hash: 'base', parents: [] },
  ])
  // c2 新开 lane0;c1 未在 lanes 中 → 新开 lane1;base 认领 lane0
  assert.deepEqual(rows.map(r => r.lane), [0, 1, 0])
  assert.ok(maxLanes >= 2)
})
